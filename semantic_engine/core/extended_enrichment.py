#!/usr/bin/env python3
"""
Extended Web Enrichment - Ricerca estesa web per arricchimento POI
Estende le descrizioni POI quando Wikipedia/Wikidata/DBpedia non forniscono informazioni sufficienti

Funzionalità:
- Ricerca mirata su siti web italiani (comuni, turismo, cultura)
- Estrazione snippet pertinenti da pagine web
- Generazione riassunto AI da snippet multipli
- Logging dettagliato delle fonti trovate

Author: Semantic Engine AI
"""

import asyncio
import aiohttp
import re
import os
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import quote, urljoin
from bs4 import BeautifulSoup
import logging

from .utils import SemanticLogger

logger = SemanticLogger()

# Configurazione domini consentiti
ALLOWED_DOMAINS = [
    ".gov.it", ".turismo.it", ".liguria.it", ".musei.it", 
    ".it", ".org", ".beniculturali.it", ".visitliguria.it",
    ".comune.", ".provincia.", ".regione.liguria.it"
]

# Domini specifici da evitare (spam, notizie, social)
BLOCKED_DOMAINS = [
    "facebook.com", "twitter.com", "instagram.com", "youtube.com",
    "google.com", "linkedin.com", "pinterest.com", "tripadvisor.com"
]

class ExtendedWebEnricher:
    """Gestisce la ricerca estesa su web per arricchire descrizioni POI"""
    
    def __init__(self, enabled: bool = False):
        self.enabled = enabled
        self.session = None
        self.max_snippets = 5
        self.snippet_max_length = 500
        self.summary_max_length = 600
        
    async def __aenter__(self):
        if self.enabled:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=10),
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; whatis-backend-semantic/1.0; +http://whatis-backend.local/)"
                }
            )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def enrich_poi_description(self, poi: Dict, zone_name: str = "", municipality: str = "") -> Optional[str]:
        """
        Arricchisce la descrizione di un POI se è assente o troppo breve
        
        Args:
            poi: Dizionario POI con name, description, type, etc.
            zone_name: Nome della zona geografica
            municipality: Nome del comune (opzionale)
            
        Returns:
            Descrizione arricchita o None se non è possibile arricchire
        """
        if not self.enabled:
            return None
        
        description = poi.get("description", "").strip()
        
        # Verifica se necessita arricchimento
        if len(description) >= 50:
            return None  # Descrizione già sufficiente
        
        try:
            poi_name = poi.get("name", "")
            poi_type = poi.get("type", "land")
            
            logger.logger.info(f"[EXTENDED SEARCH] Avvio ricerca web per POI: {poi_name} (descrizione: {len(description)} caratteri)")
            
            # Costruisci query di ricerca
            search_queries = self._build_search_queries(poi_name, zone_name, municipality, poi_type)
            
            # Cerca snippet su web
            snippets = await self._search_web_snippets(search_queries, poi_name)
            
            if not snippets or len(snippets) == 0:
                logger.logger.warning(f"[EXTENDED SEARCH] Nessuna fonte trovata per POI: {poi_name}")
                return None
            
            # Estrai fonti principali
            sources = self._extract_sources(snippets)
            logger.logger.info(f"[EXTENDED SEARCH] Fonti trovate: {len(sources)} ({', '.join(sources[:3])})")
            
            # Genera riassunto AI da snippet
            summary = await self._ai_summarize_texts(snippets, poi_name, zone_name)
            
            if not summary:
                logger.logger.warning(f"[EXTENDED SEARCH] Impossibile generare riassunto per POI: {poi_name}")
                return None
            
            # Limita lunghezza riassunto
            if len(summary) > self.summary_max_length:
                summary = summary[:self.summary_max_length].rsplit('.', 1)[0] + '.'
            
            # Aggiungi fonte principale al riassunto
            if sources:
                main_source = sources[0] if sources else "fonti ufficiali"
                summary_with_source = f"{summary} (Descrizione generata da {main_source})"
            else:
                summary_with_source = summary
            
            logger.logger.info(f"[EXTENDED SEARCH] Descrizione arricchita per POI: {poi_name} ({len(summary_with_source)} caratteri)")
            
            return summary_with_source
            
        except Exception as e:
            logger.log_error("Extended Web Enrichment", str(e), poi.get("name", ""))
            return None
    
    def _build_search_queries(self, poi_name: str, zone_name: str, 
                             municipality: str, poi_type: str) -> List[str]:
        """Costruisce query di ricerca ottimizzate"""
        queries = []
        
        # Query principale: nome POI + comune/zona
        base_query = poi_name
        if municipality:
            queries.append(f"{base_query} {municipality}")
            queries.append(f"{base_query} comune {municipality}")
        if zone_name:
            queries.append(f"{base_query} {zone_name}")
        
        # Query con keyword tematiche
        keywords = self._get_thematic_keywords(poi_type)
        for keyword in keywords[:2]:  # Limita a 2 keyword
            if municipality:
                queries.append(f"{base_query} {municipality} {keyword}")
            else:
                queries.append(f"{base_query} {keyword}")
        
        # Rimuovi duplicati mantenendo ordine
        seen = set()
        unique_queries = []
        for q in queries:
            if q not in seen:
                seen.add(q)
                unique_queries.append(q)
        
        return unique_queries[:5]  # Massimo 5 query
    
    def _get_thematic_keywords(self, poi_type: str) -> List[str]:
        """Restituisce keyword tematiche in base al tipo di POI"""
        keywords_map = {
            "land": ["storia", "turismo", "monumento", "cultura", "arte"],
            "marine": ["immersione", "relitto", "diving", "faro", "marina"],
            "church": ["chiesa", "religione", "architettura", "storia sacra"],
            "castle": ["castello", "fortezza", "storia medievale", "architettura militare"],
            "museum": ["museo", "collezione", "arte", "cultura", "storia"],
            "viewpoint": ["panorama", "belvedere", "vista", "paesaggio"],
            "beach": ["spiaggia", "mare", "turistico", "bagnasciuga"]
        }
        
        # Determina categoria principale
        category = poi_type
        if category not in keywords_map:
            category = "land"
        
        return keywords_map.get(category, keywords_map["land"])
    
    async def _search_web_snippets(self, queries: List[str], poi_name: str) -> List[Dict[str, str]]:
        """
        Cerca snippet di testo pertinenti sul web
        Usa DuckDuckGo Instant Answer API o similari (contenuto educativo/legale)
        """
        all_snippets = []
        
        for query in queries:
            try:
                # Cerca usando DuckDuckGo Instant Answer API (legale, educativo)
                snippets = await self._search_duckduckgo(query, poi_name)
                all_snippets.extend(snippets)
                
                # Limita totale snippet
                if len(all_snippets) >= self.max_snippets:
                    break
                    
                # Rate limiting
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.logger.warning(f"[EXTENDED SEARCH] Errore ricerca query '{query}': {e}")
                continue
        
        # Filtra e ordina snippet per rilevanza
        filtered_snippets = self._filter_relevant_snippets(all_snippets, poi_name)
        
        return filtered_snippets[:self.max_snippets]
    
    async def _search_duckduckgo(self, query: str, poi_name: str) -> List[Dict[str, str]]:
        """
        Cerca su DuckDuckGo Instant Answer API
        Alternativa legale e educativa a Google Search API
        """
        snippets = []
        
        try:
            # DuckDuckGo Instant Answer API
            url = "https://api.duckduckgo.com/"
            params = {
                "q": query,
                "format": "json",
                "no_html": "1",
                "skip_disambig": "1"
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Estrai Abstract (descrizione principale)
                    if data.get("AbstractText"):
                        abstract = data["AbstractText"]
                        source = data.get("AbstractSource", "DuckDuckGo")
                        url_source = data.get("AbstractURL", "")
                        
                        if self._is_allowed_domain(url_source):
                            snippets.append({
                                "title": data.get("Heading", query),
                                "text": abstract[:self.snippet_max_length],
                                "source": source,
                                "url": url_source
                            })
                    
                    # Estrai RelatedTopics (argomenti correlati)
                    if data.get("RelatedTopics"):
                        for topic in data["RelatedTopics"][:3]:  # Limita a 3
                            if isinstance(topic, dict) and topic.get("Text"):
                                text = topic["Text"]
                                url_source = topic.get("FirstURL", "")
                                
                                if self._is_allowed_domain(url_source) and self._is_relevant(text, poi_name):
                                    snippets.append({
                                        "title": topic.get("Text", query).split(" - ")[0],
                                        "text": text[:self.snippet_max_length],
                                        "source": self._extract_domain_name(url_source),
                                        "url": url_source
                                    })
            
            # Fallback: cerca direttamente su domini consentiti
            if not snippets:
                snippets = await self._search_direct_domains(query, poi_name)
                
        except Exception as e:
            logger.logger.warning(f"[EXTENDED SEARCH] Errore ricerca DuckDuckGo per '{query}': {e}")
            # Fallback a ricerca diretta
            snippets = await self._search_direct_domains(query, poi_name)
        
        return snippets
    
    async def _search_direct_domains(self, query: str, poi_name: str) -> List[Dict[str, str]]:
        """
        Cerca direttamente su domini consentiti (fallback)
        Implementazione semplificata che cerca su pagine specifiche italiane
        """
        snippets = []
        max_retries = 2
        retry_delay = 1
        
        # Lista domini base da cui cercare
        base_domains = [
            "visitliguria.it",
            "turismoinliguria.it",
            "parks.it",
            "beniculturali.it",
            "regione.liguria.it"
        ]
        
        # Cerca su ogni dominio (con retry)
        for domain in base_domains[:3]:  # Limita a 3 domini
            for attempt in range(max_retries):
                try:
                    # Costruisci URL di ricerca (formato semplificato)
                    search_url = f"https://{domain}/search?q={quote(query)}"
                    
                    async with self.session.get(search_url, allow_redirects=True) as response:
                        if response.status == 200:
                            content = await response.text()
                            snippets_found = await self._extract_snippets_from_html(content, query, poi_name, domain)
                            snippets.extend(snippets_found)
                            
                            if snippets_found:
                                break  # Se trovati snippet, passa al dominio successivo
                        
                except asyncio.TimeoutError:
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                    continue
                except Exception as e:
                    logger.logger.debug(f"[EXTENDED SEARCH] Errore ricerca su {domain}: {e}")
                    break
            
            # Rate limiting tra domini
            await asyncio.sleep(0.5)
            
            # Limita totale snippet
            if len(snippets) >= self.max_snippets:
                break
        
        return snippets
    
    async def _extract_snippets_from_html(self, html_content: str, query: str, poi_name: str, domain: str) -> List[Dict[str, str]]:
        """Estrae snippet pertinenti da contenuto HTML"""
        snippets = []
        
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Cerca in sezioni comuni di pagine turistiche italiane
            selectors = [
                ('h1, h2, h3', lambda tag: tag.get_text()),
                ('p', lambda tag: tag.get_text()),
                ('.description, .content, .poi-description', lambda tag: tag.get_text()),
                ('article p, .article p', lambda tag: tag.get_text())
            ]
            
            found_texts = []
            
            for selector, extractor in selectors:
                tags = soup.select(selector)
                for tag in tags[:10]:  # Limita per performance
                    text = extractor(tag).strip()
                    
                    if text and len(text) > 50:
                        # Verifica rilevanza
                        if self._is_relevant(text, poi_name):
                            found_texts.append({
                                "title": tag.name if hasattr(tag, 'name') else "",
                                "text": text[:self.snippet_max_length],
                                "source": self._extract_domain_name(domain),
                                "url": domain
                            })
            
            # Rimuovi duplicati
            seen_texts = set()
            for snippet in found_texts:
                text_hash = hash(snippet["text"][:100])
                if text_hash not in seen_texts:
                    seen_texts.add(text_hash)
                    snippets.append(snippet)
            
            return snippets[:3]  # Massimo 3 snippet per dominio
            
        except Exception as e:
            logger.logger.debug(f"[EXTENDED SEARCH] Errore estrazione HTML da {domain}: {e}")
            return []
    
    def _is_allowed_domain(self, url: str) -> bool:
        """Verifica se l'URL appartiene a un dominio consentito"""
        if not url:
            return False
        
        url_lower = url.lower()
        
        # Controlla domini bloccati
        for blocked in BLOCKED_DOMAINS:
            if blocked in url_lower:
                return False
        
        # Controlla domini consentiti
        for allowed in ALLOWED_DOMAINS:
            if allowed in url_lower:
                return True
        
        return False
    
    def _extract_domain_name(self, url: str) -> str:
        """Estrae il nome del dominio da un URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc.replace("www.", "")
            
            # Estrai nome organizzazione dal dominio
            parts = domain.split(".")
            if len(parts) >= 2:
                org_name = parts[-2].capitalize() if len(parts) >= 2 else domain
                return org_name
            return domain
        except:
            return "Fonte web"
    
    def _is_relevant(self, text: str, poi_name: str) -> bool:
        """Verifica se un testo è rilevante per il POI"""
        if not text or not poi_name:
            return False
        
        text_lower = text.lower()
        poi_words = set(poi_name.lower().split())
        
        # Verifica presenza di parole chiave del POI
        poi_word_matches = sum(1 for word in poi_words if len(word) > 3 and word in text_lower)
        
        # Deve avere almeno una corrispondenza significativa
        return poi_word_matches >= max(1, len(poi_words) // 2)
    
    def _filter_relevant_snippets(self, snippets: List[Dict], poi_name: str) -> List[Dict]:
        """Filtra snippet per rilevanza e rimuove duplicati"""
        filtered = []
        seen_texts = set()
        
        for snippet in snippets:
            text = snippet.get("text", "").lower()
            title = snippet.get("title", "").lower()
            
            # Skip duplicati approssimativi
            text_hash = hash(text[:100])  # Hash dei primi 100 caratteri
            if text_hash in seen_texts:
                continue
            seen_texts.add(text_hash)
            
            # Verifica rilevanza
            if self._is_relevant(text + " " + title, poi_name):
                filtered.append(snippet)
        
        # Ordina per rilevanza (più parole del POI = più rilevante)
        filtered.sort(
            key=lambda s: sum(1 for word in poi_name.lower().split() if word in (s.get("text", "") + s.get("title", "")).lower()),
            reverse=True
        )
        
        return filtered
    
    def _extract_sources(self, snippets: List[Dict]) -> List[str]:
        """Estrae lista di fonti principali dai snippet"""
        sources = []
        seen_sources = set()
        
        for snippet in snippets:
            source = snippet.get("source", "")
            if source and source not in seen_sources:
                sources.append(source)
                seen_sources.add(source)
        
        return sources
    
    async def _ai_summarize_texts(self, snippets: List[Dict], poi_name: str, zone_name: str = "") -> Optional[str]:
        """
        Genera un riassunto AI coerente da snippet multipli
        
        Args:
            snippets: Lista di snippet con title, text, source
            poi_name: Nome del POI
            zone_name: Nome della zona (opzionale)
            
        Returns:
            Riassunto testuale di massimo 600 caratteri
        """
        if not snippets:
            return None
        
        try:
            # Combina tutti i snippet in un unico testo
            combined_text = self._combine_snippets(snippets)
            
            # Genera riassunto usando algoritmo di estrazione chiave
            # (in produzione, qui si userebbe un LLM come GPT-4, Claude, o modello locale)
            summary = self._generate_summary(combined_text, poi_name, zone_name)
            
            return summary
            
        except Exception as e:
            logger.log_error("AI Summary Generation", str(e), poi_name)
            return None
    
    def _combine_snippets(self, snippets: List[Dict]) -> str:
        """Combina snippet multipli in un unico testo"""
        combined_parts = []
        
        for i, snippet in enumerate(snippets[:5], 1):
            title = snippet.get("title", "")
            text = snippet.get("text", "")
            
            if text:
                combined_parts.append(f"{title}: {text}")
        
        return " | ".join(combined_parts)
    
    def _generate_summary(self, combined_text: str, poi_name: str, zone_name: str = "") -> str:
        """
        Genera riassunto intelligente da testo combinato
        Usa estrazione di frasi chiave e sintesi semantica
        
        In produzione, qui si integrerebbe:
        - OpenAI GPT-4/3.5-turbo
        - Anthropic Claude
        - Local LLM (Llama, Mistral)
        - Hugging Face Transformers
        """
        # Algoritmo di sintesi semplificato (placeholder per LLM)
        # Estrai frasi più informative
        
        sentences = re.split(r'[.!?]\s+', combined_text)
        
        # Filtra frasi più lunghe e informative
        informative_sentences = [
            s for s in sentences 
            if len(s) > 30 and any(word in s.lower() for word in poi_name.lower().split())
        ]
        
        # Se non ci sono frasi informativi, usa le prime frasi più lunghe
        if not informative_sentences:
            informative_sentences = sorted(
                [s for s in sentences if len(s) > 20],
                key=len,
                reverse=True
            )[:3]
        
        # Combina frasi più rilevanti
        summary_parts = []
        current_length = 0
        
        for sentence in informative_sentences:
            if current_length + len(sentence) <= self.summary_max_length:
                summary_parts.append(sentence)
                current_length += len(sentence) + 2  # +2 per spazio e punto
            else:
                break
        
        # Genera riassunto finale
        if summary_parts:
            summary = ". ".join(summary_parts)
            # Aggiungi punto finale se manca
            if not summary.endswith(('.', '!', '?')):
                summary += "."
            
            # Limita lunghezza finale
            if len(summary) > self.summary_max_length:
                summary = summary[:self.summary_max_length].rsplit('.', 1)[0] + '.'
            
            return summary
        else:
            # Fallback: usa prima frase utile o genera descrizione generica
            first_useful = next((s for s in sentences if len(s) > 30), None)
            if first_useful:
                return first_useful[:self.summary_max_length] + ("." if not first_useful.endswith('.') else "")
            else:
                # Descrizione generica basata sul nome
                if zone_name:
                    return f"{poi_name} è un punto di interesse situato nell'area di {zone_name}. Rappresenta una destinazione di interesse turistico e culturale."
                else:
                    return f"{poi_name} è un punto di interesse turistico di rilevante importanza. Offre opportunità di scoperta e visita per turisti e appassionati."


# Funzioni utility per uso esterno
async def enrich_poi_with_extended_search(poi: Dict, zone_name: str = "", municipality: str = "") -> Optional[str]:
    """
    Arricchisce un POI con ricerca web estesa se necessario
    
    Args:
        poi: Dizionario POI
        zone_name: Nome zona geografica
        municipality: Nome comune
        
    Returns:
        Descrizione arricchita o None
    """
    # Leggi configurazione da variabile d'ambiente
    enabled = os.getenv("ENABLE_EXTENDED_ENRICHMENT", "false").lower() == "true"
    
    if not enabled:
        return None
    
    async with ExtendedWebEnricher(enabled=True) as enricher:
        return await enricher.enrich_poi_description(poi, zone_name, municipality)


async def ai_summarize_texts(snippets: List[Dict], poi_name: str, zone_name: str = "") -> Optional[str]:
    """
    Funzione utility per generare riassunto AI da snippet multipli
    Usabile esternamente per integrazione con altri moduli
    
    Args:
        snippets: Lista di snippet con title, text, source
        poi_name: Nome del POI
        zone_name: Nome della zona (opzionale)
        
    Returns:
        Riassunto testuale di massimo 600 caratteri
    """
    if not snippets:
        return None
    
    async with ExtendedWebEnricher(enabled=True) as enricher:
        return await enricher._ai_summarize_texts(snippets, poi_name, zone_name)


async def enrich_poi_batch_with_extended_search(pois: List[Dict], zone_name: str = "", municipality: str = "") -> List[Dict]:
    """
    Arricchisce un batch di POI con ricerca web estesa
    
    Args:
        pois: Lista di dizionari POI
        zone_name: Nome zona geografica
        municipality: Nome comune
        
    Returns:
        Lista di POI arricchiti (non modifica mai i POI originali se errore)
    """
    try:
        enabled = os.getenv("ENABLE_EXTENDED_ENRICHMENT", "false").lower() == "true"
        
        if not enabled or not pois:
            return pois
        
        logger.logger.info(f"[EXTENDED SEARCH] Arricchimento esteso abilitato per {len(pois)} POI")
        
        async with ExtendedWebEnricher(enabled=True) as enricher:
            enriched_pois = []
            enriched_count = 0
            
            for poi in pois:
                try:
                    # Verifica se necessita arricchimento (descrizione < 50 caratteri o mancante)
                    description = poi.get("description", "").strip()
                    if len(description) >= 50:
                        # Descrizione già sufficiente, mantieni originale
                        enriched_pois.append(poi)
                        continue
                    
                    enriched_description = await enricher.enrich_poi_description(poi, zone_name, municipality)
                    
                    if enriched_description:
                        enriched_poi = poi.copy()
                        enriched_poi["description"] = enriched_description
                        enriched_poi["description_source"] = "extended_web_search"
                        enriched_pois.append(enriched_poi)
                        enriched_count += 1
                    else:
                        # Nessuna descrizione arricchita trovata, mantieni originale
                        enriched_pois.append(poi)
                        
                except Exception as e:
                    # In caso di errore, mantieni sempre il POI originale
                    logger.logger.warning(f"[EXTENDED SEARCH] Errore arricchimento POI '{poi.get('name', '')}': {e}")
                    enriched_pois.append(poi)  # Mantieni originale se errore
            
            if enriched_count > 0:
                logger.logger.info(f"[EXTENDED SEARCH] Arricchiti {enriched_count}/{len(pois)} POI con ricerca web estesa")
            
            return enriched_pois
            
    except Exception as e:
        # In caso di errore generale, restituisci sempre i POI originali
        logger.log_error("Extended Enrichment Batch", str(e), zone_name)
        logger.logger.warning(f"[EXTENDED SEARCH] Errore generale, restituiti POI originali")
        return pois  # Restituisci originali se errore generale

