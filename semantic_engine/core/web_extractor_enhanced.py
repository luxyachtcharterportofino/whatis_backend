"""
✅ FIX MarineEnhanced: Modulo di estrazione avanzata dei contenuti web per diving center
Scarica le pagine web trovate (Google CSE / DuckDuckGo), pulisce l'HTML e inoltra il testo a GPT
per ottenere POI marini reali e affidabili.
"""

import asyncio
import aiohttp
from aiohttp import ClientTimeout
from typing import List, Dict, Optional
from urllib.parse import urlparse
import json

from bs4 import BeautifulSoup

from .utils import SemanticLogger, point_in_polygon
from .semantic_gpt_filter import get_gpt_filter

logger = SemanticLogger()

USER_AGENT = "Mozilla/5.0 (compatible; WhatisMarineBot/1.0; +https://whatismaritime.ai)"
FETCH_TIMEOUT_SECONDS = 10
MAX_TEXT_LENGTH = 15000

MARINE_TEXT_KEYWORDS = [
    "relitto", "relitti", "secca", "secche", "gorgonie", "profondità",
    "immersione", "immersioni", "subacquea", "subacqueo", "sub",
    "nave", "scafo", "barca", "prua", "poppa", "fondale", "reef",
    "grotte", "grotta", "statua", "visibilità", "parete", "pareti",
    "submarine", "wreck", "shipwreck"
]

INVALID_NAME_TOKENS = [
    "leggi", "scopri", "ottobre", "novembre", "dicembre", "settembre",
    "agosto", "luglio", "news", "description", "descrizione", "menu",
    "attenzione", "prenota"
]

ENHANCED_SYSTEM_PROMPT = (
    "Analizza il seguente testo estratto da un sito web di un diving center.\n\n"
    "Il tuo compito è individuare solo i luoghi di immersione SUBACQUEA reali menzionati nel testo "
    "(relitti, secche, grotte, pareti, statue, punti di immersione, barche affondate, ecc.).\n\n"
    "❌ Non considerare: nomi di mesi, pulsanti, frasi generiche (\"leggi tutto\", \"scopri di più\"), parole comuni "
    "o titoli non legati al mare.\n\n"
    "✅ Restituisci i risultati nel seguente formato JSON:\n"
    "{\n"
    "  \"pois\": [\n"
    "    {\n"
    "      \"nome\": \"...\",\n"
    "      \"tipo\": \"relitto / secca / grotta / parete / altro\",\n"
    "      \"profondità\": \"se disponibile (es. 35 m)\",\n"
    "      \"descrizione\": \"breve riassunto di una o due frasi\"\n"
    "    }\n"
    "  ]\n"
    "}\n\n"
    "Se non trovi alcun punto d'immersione reale, restituisci {\"pois\": []}."
)


def filter_marine_text(text: str) -> str:
    """Restituisce solo i paragrafi che contengono parole chiave subacquee."""
    if not text:
        return ""

    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    filtered = []
    for paragraph in paragraphs:
        lowered = paragraph.lower()
        if any(keyword in lowered for keyword in MARINE_TEXT_KEYWORDS):
            filtered.append(paragraph)
    if not filtered:
        return ""
    filtered_text = "\n".join(filtered)
    return filtered_text[:MAX_TEXT_LENGTH]


def is_valid_poi(poi: Dict) -> bool:
    name = (poi.get("nome") or "").strip()
    if not name or len(name) <= 4:
        return False
    lowered = name.lower()
    return not any(token in lowered for token in INVALID_NAME_TOKENS)


async def fetch_and_parse_url(url: str) -> str:
    """Scarica e restituisce il testo leggibile della pagina, pronto per GPT."""
    if not url:
        return ""

    try:
        timeout = ClientTimeout(total=FETCH_TIMEOUT_SECONDS)
        headers = {"User-Agent": USER_AGENT}

        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            async with session.get(url, allow_redirects=True) as response:
                if response.status != 200:
                    logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore fetch URL {url} - status {response.status}")
                    return ""

                html = await response.text(errors="ignore")

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
            tag.decompose()

        text_chunks = list(soup.stripped_strings)
        if not text_chunks:
            return ""

        text = " ".join(text_chunks)
        filtered_text = filter_marine_text(text)
        if filtered_text:
            return filtered_text
        return text[:MAX_TEXT_LENGTH]

    except asyncio.TimeoutError:
        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Timeout fetch URL {url} (>{FETCH_TIMEOUT_SECONDS}s)")
        return ""
    except aiohttp.ClientError as e:
        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore rete fetch URL {url}: {str(e)}")
        return ""
    except Exception as e:
        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore generico fetch URL {url}: {str(e)}")
        return ""


async def gpt_enhanced_extraction(text: str, source_url: str) -> List[Dict]:
    """Invia il testo completo al modulo GPT semantico, restituendo i POI marini trovati."""
    if not text or len(text.strip()) == 0:
        return []

    filtered_text = filter_marine_text(text)
    if not filtered_text:
        logger.logger.debug(f"[POI-MARINE] ⚠️ Nessun paragrafo marino rilevante in {source_url}")
        return []

    gpt_filter = get_gpt_filter()
    if not gpt_filter or not gpt_filter.is_operational:
        logger.logger.warning("🚨 [MARINE-GPT] GPT non operativo o chiave non valida — uso fallback classico")
        return []

    try:
        from openai import AsyncOpenAI  # Import locale per evitare dipendenza se non usato

        client = AsyncOpenAI(api_key=gpt_filter.api_key)
        prompt_text = (
            f"Testo diving center:\n<<<\n{filtered_text[:MAX_TEXT_LENGTH]}\n>>>"
        )

        response = await client.chat.completions.create(
            model=gpt_filter.model,
            messages=[
                {"role": "system", "content": ENHANCED_SYSTEM_PROMPT},
                {"role": "user", "content": prompt_text}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=1000
        )

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            return []

        payload = json.loads(content)
        pois_data = payload.get("pois", []) if isinstance(payload, dict) else []

        sanitized_pois: List[Dict] = []

        for entry in pois_data:
            if not isinstance(entry, dict):
                continue
            if not is_valid_poi(entry):
                continue

            name = (entry.get("nome") or "").strip()
            poi_type = (entry.get("tipo") or "marine").strip() or "marine"
            depth = (entry.get("profondità") or "").strip()
            description = (entry.get("descrizione") or "").strip()

            sanitized_pois.append({
                "name": name,
                "marine_type": poi_type.lower(),
                "type": poi_type.lower(),
                "depth": depth,
                "description": description,
                "confidence": 0.9,
                "source_summary": description
            })

        if sanitized_pois:
            summary = ", ".join(
                [
                    f"{poi['name']}" + (f" ({poi['depth']})" if poi.get('depth') else "")
                    for poi in sanitized_pois
                ]
            )
            logger.logger.info(f"✅ [MARINE-GPT] POI trovati: {summary}")
        else:
            logger.logger.info(f"[MARINE-GPT] ❌ Nessun POI marino trovato in {source_url} (enhanced)")

        return sanitized_pois

    except Exception as e:
        logger.logger.error(f"🚨 [MARINE-GPT] Errore durante analisi testo (enhanced) per {source_url}: {str(e)}")
        logger.logger.error("💡 Continuo senza GPT (fallback al filtro locale)")
        return []



async def enhanced_web_search(diving_urls: List[str],
                              zone_name: str,
                              polygon: List[List[float]]) -> List[Dict]:
    """Per ogni URL dei diving center, scarica, analizza e aggrega i POI trovati."""
    if not diving_urls:
        return []

    aggregated_pois: List[Dict] = []
    seen_names = set()

    logger.logger.info("🌊 [POI-MARINE] Enhanced mode attivo — analisi completa contenuti diving center")

    for url in diving_urls:
        try:
            text = await fetch_and_parse_url(url)
            if not text:
                continue

            poi_candidates = await gpt_enhanced_extraction(text, url)
            if not poi_candidates:
                continue

            for candidate in poi_candidates:
                name = (candidate.get("name") or "").strip()
                if not name:
                    continue

                name_key = name.lower()
                if name_key in seen_names:
                    continue

                # Conversione sicura confidence
                try:
                    confidence_raw = candidate.get("confidence", 0)
                    if isinstance(confidence_raw, str):
                        logger.logger.warning(f"[MARINE-GPT] ⚠️ Confidence come stringa per POI '{name}', convertito a float.")
                    confidence = float(confidence_raw or 0)
                except (ValueError, TypeError):
                    confidence = 0.0

                if confidence <= 0.3:  # Scarta risultati troppo incerti
                    continue

                lat = candidate.get("coordinates", {}).get("lat") if isinstance(candidate.get("coordinates"), dict) else None
                lng = candidate.get("coordinates", {}).get("lng") if isinstance(candidate.get("coordinates"), dict) else None

                try:
                    lat = float(lat) if lat is not None else None
                    lng = float(lng) if lng is not None else None
                except (ValueError, TypeError):
                    lat, lng = None, None

                if lat is None or lng is None:
                    logger.logger.warning(f"[MARINE-GPT] ⚠️ Coordinate mancanti per POI '{name}' - scarto")
                    continue

                if not point_in_polygon((lat, lng), polygon):
                    logger.logger.warning(f"[MARINE-GPT] ⚠️ POI fuori poligono '{name}' - scarto")
                    continue

                description = candidate.get("description") or ""
                description = description.strip()[:600]

                marine_type = candidate.get("type") or "marine"
                source = candidate.get("source") or "Web Enhanced"

                poi = {
                    "name": name,
                    "description": description,
                    "lat": lat,
                    "lng": lng,
                    "source": source,
                    "type": "marine",
                    "marine_type": marine_type,
                    "url": url,
                    "confidence": confidence,
                    "semantic_tags": ["marine", "enhanced"],
                    "ai_enhanced": True,
                    "metadata": {"mode": "enhanced"}
                }

                depth = candidate.get("depth")
                if depth:
                    poi["depth"] = depth

                aggregated_pois.append(poi)
                seen_names.add(name_key)
                logger.logger.info(f"[MARINE-GPT] ✅ POI enhanced aggiunto: {name} (confidence: {confidence})")

        except Exception as e:
            logger.logger.error(f"[POI-MARINE-WEB] ❌ Errore enhanced web search per {url}: {str(e)}")
            continue

    if aggregated_pois:
        summary = ", ".join(
            [
                f"{poi['name']}" + (f" ({poi['depth']})" if poi.get('depth') else "")
                for poi in aggregated_pois
            ]
        )
        logger.logger.info(f"✅ [MARINE-GPT] POI trovati: {summary}")
    else:
        logger.logger.warning("⚠️ Enhanced mode NON attivo — fallback standard usato")

    return aggregated_pois


