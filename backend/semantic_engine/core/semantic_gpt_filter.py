"""
✅ FIX MarineGPTFilter: Modulo opzionale per filtro semantico GPT dei testi dei diving center
Filtra testi usando GPT per identificare POI marini reali (relitti, punti immersione, ecc.)
Completamente opzionale e non invasivo - attivo solo se USE_GPT_FILTER=True nel .env
"""

import os
import json
import asyncio
from typing import Dict, Optional, List
from .utils import SemanticLogger

logger = SemanticLogger()

# ✅ FIX MarineGPTFilter: Configurazione GPT (opzionale)
USE_GPT_FILTER = os.getenv("USE_GPT_FILTER", "false").lower() == "true"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GPT_MODEL = os.getenv("GPT_MODEL", "gpt-4o-mini")  # Default: gpt-4o-mini per costi ridotti

# ✅ FIX MarineGPTFilter: SYSTEM PROMPT per GPT (multilingue, universale, dettagliato)
SYSTEM_PROMPT = """Sei un analista semantico esperto di turismo subacqueo e geografia marina per il progetto Whatis — Marine Semantic Engine.

Il tuo compito è identificare SOLO luoghi fisici marini reali che un subacqueo può visitare: relitti, statue sommerse, secche, grotte, pareti subacquee, ecc.

ISTRUZIONI OPERATIVE:
1. Leggi attentamente tutto il testo.
2. Se il testo NON parla di immersioni, relitti o luoghi fisici → restituisci [].
3. Se parla di più punti di immersione → restituisci una lista di POI.
4. I nomi devono essere plausibili e coerenti, NON parole generiche o pulsanti.
5. Scarta SEMPRE: "Description", "Leggi Tutto", "Dettagli", "Prenota", "Attenzione ai dettagli", "Foto", "Scopri di più", testi promozionali o istruzioni, titoli senza riferimento geografico o subacqueo.
6. Se non sei sicuro che sia un luogo reale, imposta "confidence": 0.5 o inferiore.
7. Restituisci SEMPRE solo JSON valido, senza testo extra o commenti.

Comportati come un analista esperto di immersioni, non come un motore di ricerca.
Se un testo parla di un posto che un sub può effettivamente visitare → lo accetti.
Se parla di qualsiasi altra cosa → lo scarti."""

# ✅ FIX MarineGPTFilter: Prompt per GPT livello 1 (classificazione rapida)
GPT_PROMPT_LEVEL1 = """Analizza il seguente testo e determina se descrive un luogo fisico marino reale (relitto, punto d'immersione, secca, statua, grotta, parete subacquea, ecc.).

Rispondi **solo** in JSON con il seguente formato:
{{
  "isMarinePOI": true/false,
  "poiName": "nome del relitto o punto se presente (o stringa vuota se non presente)",
  "reason": "breve spiegazione del perché (in italiano o inglese)"
}}

Se il testo NON descrive un luogo fisico reale, restituisci:
{{
  "isMarinePOI": false,
  "poiName": "",
  "reason": "testo pubblicitario/generico senza riferimenti a luoghi fisici"
}}

Testo da analizzare:
<<< {text} >>>
"""

# ✅ FIX MarineGPTFilter: Prompt per GPT livello 2 (estrazione dettagliata)
GPT_PROMPT_LEVEL2 = """Analizza il seguente testo e estrai TUTTI i luoghi fisici marini reali menzionati (relitti, statue sommerse, secche, grotte, pareti subacquee, ecc.).

Rispondi **solo** in JSON con il seguente formato:
{{
  "pois": [
    {{
      "name": "nome del luogo o relitto",
      "type": "categoria (relitto, grotta, secca, parete, statua, diving_site, reef, other)",
      "confidence": valore tra 0.0 e 1.0,
      "context": "frase breve che spiega da dove lo hai dedotto",
      "source": "dominio del sito o nome della fonte (se disponibile)"
    }}
  ]
}}

Se il testo NON descrive luoghi fisici reali, restituisci:
{{
  "pois": []
}}

IMPORTANTE:
- I nomi devono essere plausibili e coerenti, NON parole generiche o pulsanti.
- Scarta SEMPRE: "Description", "Leggi Tutto", "Dettagli", "Prenota", "Attenzione ai dettagli", "Foto", "Scopri di più".
- Se non sei sicuro che sia un luogo reale, imposta "confidence": 0.5 o inferiore.
- Restituisci SEMPRE solo JSON valido, senza testo extra o commenti.

Testo da analizzare:
<<< {text} >>>
"""

class GPTFilterError(Exception):
    """✅ FIX MarineGPTFilter: Eccezione personalizzata per errori GPT"""
    pass

class SemanticGPTFilter:
    """✅ FIX MarineGPTFilter: Filtro semantico GPT per testi dei diving center"""
    
    def __init__(self):
        self.is_enabled = USE_GPT_FILTER
        self.api_key = OPENAI_API_KEY
        self.model = GPT_MODEL
        self.is_operational = False
        
        # ✅ FIX MarineGPTFilter: Verifica configurazione all'inizializzazione
        if self.is_enabled:
            self._check_configuration()
    
    def _check_configuration(self) -> bool:
        """✅ FIX MarineGPTFilter: Verifica configurazione GPT
        
        Returns:
            True se GPT è configurato correttamente, False altrimenti
        """
        if not self.api_key or len(self.api_key.strip()) == 0:
            logger.logger.error("🚨 [MARINE-GPT] ERRORE: il modulo GPT non è operativo (chiave mancante o limite superato).")
            logger.logger.error("💡 Controlla il file .env o ricarica credito per riattivare il servizio semantico.")
            self.is_operational = False
            return False
        
        self.is_operational = True
        logger.logger.info("✅ [MARINE-GPT] Modulo GPT attivo e configurato correttamente")
        return True
    
    async def _call_gpt(self, prompt: str, max_retries: int = 2) -> Optional[Dict]:
        """✅ FIX MarineGPTFilter: Chiama GPT API con retry logic
        
        Args:
            prompt: Prompt da inviare a GPT
            max_retries: Numero massimo di tentativi
            
        Returns:
            Risposta JSON da GPT o None in caso di errore
        """
        if not self.is_enabled or not self.is_operational:
            return None
        
        try:
            # ✅ FIX MarineGPTFilter: Import OpenAI solo se necessario
            try:
                from openai import AsyncOpenAI
            except ImportError:
                logger.logger.error("🚨 [MARINE-GPT] ERRORE: libreria openai non installata.")
                logger.logger.error("💡 Installa con: pip install openai")
                self.is_operational = False
                return None
            
            client = AsyncOpenAI(api_key=self.api_key)
            
            for attempt in range(max_retries):
                try:
                    response = await client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,  # ✅ FIX MarineGPTFilter: Temperatura molto bassa per risposte più deterministiche e coerenti
                        max_tokens=1000  # ✅ FIX MarineGPTFilter: Aumentato per supportare liste di POI
                    )
                    
                    # ✅ FIX MarineGPTFilter: Estrai risposta JSON
                    content = response.choices[0].message.content
                    if content:
                        try:
                            result = json.loads(content)
                            return result
                        except json.JSONDecodeError as e:
                            logger.logger.warning(f"[MARINE-GPT] ⚠️ Risposta GPT non è JSON valido: {e}")
                            if attempt < max_retries - 1:
                                await asyncio.sleep(1)
                                continue
                            return None
                    
                    return None
                    
                except Exception as e:
                    error_msg = str(e).lower()
                    
                    # ✅ FIX MarineGPTFilter: Gestione errori specifici
                    if "rate limit" in error_msg or "quota" in error_msg:
                        logger.logger.error("🚨 [MARINE-GPT] ERRORE: il modulo GPT non è operativo (chiave mancante o limite superato).")
                        logger.logger.error("💡 Controlla il file .env o ricarica credito per riattivare il servizio semantico.")
                        self.is_operational = False
                        return None
                    elif "authentication" in error_msg or "invalid" in error_msg:
                        logger.logger.error("🚨 [MARINE-GPT] ERRORE: il modulo GPT non è operativo (chiave mancante o limite superato).")
                        logger.logger.error("💡 Controlla il file .env o ricarica credito per riattivare il servizio semantico.")
                        self.is_operational = False
                        return None
                    else:
                        if attempt < max_retries - 1:
                            logger.logger.warning(f"[MARINE-GPT] ⚠️ Errore chiamata GPT (tentativo {attempt + 1}/{max_retries}): {e}")
                            await asyncio.sleep(1)
                            continue
                        else:
                            logger.logger.warning(f"[MARINE-GPT] ⚠️ Errore chiamata GPT dopo {max_retries} tentativi: {e}")
                            return None
            
            return None
            
        except Exception as e:
            logger.logger.error(f"🚨 [MARINE-GPT] ERRORE: errore generico chiamata GPT: {e}")
            logger.logger.error("💡 Continuo senza GPT (fallback al filtro locale)")
            return None
    
    async def gpt_filter_level1(self, text: str) -> Optional[Dict]:
        """✅ FIX MarineGPTFilter: Classificatore logico rapido - decide se il testo parla di un POI marino
        
        Args:
            text: Testo da analizzare
            
        Returns:
            Dict con campi isMarinePOI, poiName, reason o None in caso di errore
        """
        if not self.is_enabled:
            return None
        
        if not self.is_operational:
            return None
        
        if not text or len(text.strip()) == 0:
            return None
        
        try:
            # ✅ FIX MarineGPTFilter: Prepara prompt
            prompt = GPT_PROMPT_LEVEL1.format(text=text[:2000])  # Limita a 2000 caratteri per efficienza
            
            # ✅ FIX MarineGPTFilter: Chiama GPT
            result = await self._call_gpt(prompt)
            
            if result:
                is_marine_poi = result.get("isMarinePOI", False)
                poi_name = result.get("poiName", "")
                reason = result.get("reason", "")
                
                # ✅ FIX MarineGPTFilter: Valida che poiName non sia una parola generica
                if is_marine_poi and poi_name:
                    # Filtra parole generiche comuni
                    generic_words = ["description", "dettagli", "leggi tutto", "prenota", "attenzione", "foto", "scopri", 
                                   "details", "read more", "book", "photo", "discover", "description", "détails", 
                                   "réserver", "photo", "découvrir"]
                    poi_name_lower = poi_name.lower().strip()
                    if any(gw in poi_name_lower for gw in generic_words) or len(poi_name_lower) < 3:
                        logger.logger.info(f"[MARINE-GPT] ❌ Scartato: nome generico '{poi_name}' — {reason}")
                        return {"isMarinePOI": False, "poiName": "", "reason": f"Nome generico: {poi_name}"}
                
                if is_marine_poi:
                    logger.logger.info(f"[MARINE-GPT] ✅ Testo analizzato — rilevato POI marino '{poi_name}' (confidence: {result.get('confidence', 'N/A')})")
                else:
                    logger.logger.info(f"[MARINE-GPT] ❌ Scartato: '{text[:50]}...' — {reason}")
                
                return result
            else:
                # ✅ FIX MarineGPTFilter: Fallback silenzioso se GPT non risponde
                return None
                
        except Exception as e:
            logger.logger.warning(f"[MARINE-GPT] ⚠️ Errore filtro livello 1: {e}")
            logger.logger.warning("💡 Continuo senza GPT (fallback al filtro locale)")
            return None
    
    async def gpt_extractor_level2(self, text: str) -> Optional[Dict]:
        """✅ FIX MarineGPTFilter: Analisi più profonda per estrarre nomi, categorie e coordinate stimate
        
        Args:
            text: Testo da analizzare
            
        Returns:
            Dict con informazioni dettagliate del POI o None in caso di errore
        """
        if not self.is_enabled:
            return None
        
        if not self.is_operational:
            return None
        
        if not text or len(text.strip()) == 0:
            return None
        
        try:
            # ✅ FIX MarineGPTFilter: Prepara prompt
            prompt = GPT_PROMPT_LEVEL2.format(text=text[:3000])  # Limita a 3000 caratteri per analisi più profonda
            
            # ✅ FIX MarineGPTFilter: Chiama GPT
            result = await self._call_gpt(prompt)
            
            if result:
                # ✅ FIX MarineGPTFilter: Gestisci formato nuovo con lista di POI
                pois_list = result.get("pois", [])
                
                if not pois_list or len(pois_list) == 0:
                    logger.logger.info(f"[MARINE-GPT] ❌ Estrazione livello 2 — nessun POI marino trovato nel testo")
                    return {"pois": []}
                
                # ✅ FIX MarineGPTFilter: Filtra POI con confidence troppo bassa o nomi generici
                valid_pois = []
                for poi in pois_list:
                    poi_name = poi.get("name", "").strip()
                    # ✅ FIX ConfidenceConversion: Conversione sicura a float per evitare errori di tipo
                    try:
                        confidence_raw = poi.get("confidence", 0.0)
                        if isinstance(confidence_raw, str):
                            logger.logger.warning(f"[MARINE-GPT] ⚠️ Confidence come stringa per POI '{poi_name}', convertito a float.")
                        confidence = float(confidence_raw or 0)
                    except (ValueError, TypeError):
                        confidence = 0.0
                    poi_type = poi.get("type", "other")
                    
                    # Filtra POI con confidence troppo bassa
                    if confidence < 0.5:
                        logger.logger.debug(f"[MARINE-GPT] ⚠️ POI '{poi_name}' scartato: confidence troppo bassa ({confidence})")
                        continue
                    
                    # Filtra nomi generici
                    if not poi_name or len(poi_name) < 3:
                        logger.logger.debug(f"[MARINE-GPT] ⚠️ POI scartato: nome vuoto o troppo breve")
                        continue
                    
                    generic_words = ["description", "dettagli", "leggi tutto", "prenota", "attenzione", "foto", "scopri", 
                                   "details", "read more", "book", "photo", "discover", "description", "détails", 
                                   "réserver", "photo", "découvrir"]
                    poi_name_lower = poi_name.lower().strip()
                    if any(gw in poi_name_lower for gw in generic_words):
                        logger.logger.debug(f"[MARINE-GPT] ⚠️ POI '{poi_name}' scartato: nome generico")
                        continue
                    
                    valid_pois.append(poi)
                    logger.logger.info(f"[MARINE-GPT] ✅ Estrazione livello 2 — POI marino '{poi_name}' (tipo: {poi_type}, confidence: {confidence})")
                
                if valid_pois:
                    logger.logger.info(f"[MARINE-GPT] ✅ Estrazione livello 2 — trovati {len(valid_pois)} POI marini validi")
                    return {"pois": valid_pois}
                else:
                    logger.logger.info(f"[MARINE-GPT] ❌ Estrazione livello 2 — nessun POI marino valido dopo filtri")
                    return {"pois": []}
            else:
                # ✅ FIX MarineGPTFilter: Fallback silenzioso se GPT non risponde
                return None
                
        except Exception as e:
            logger.logger.warning(f"[MARINE-GPT] ⚠️ Errore estrazione livello 2: {e}")
            logger.logger.warning("💡 Continuo senza GPT (fallback al filtro locale)")
            return None

# ✅ FIX MarineGPTFilter: Istanza globale del filtro GPT
_gpt_filter_instance = None

def get_gpt_filter() -> Optional[SemanticGPTFilter]:
    """✅ FIX MarineGPTFilter: Ottiene istanza singleton del filtro GPT
    
    Returns:
        Istanza del filtro GPT o None se non abilitato
    """
    global _gpt_filter_instance
    
    if not USE_GPT_FILTER:
        return None
    
    if _gpt_filter_instance is None:
        _gpt_filter_instance = SemanticGPTFilter()
    
    return _gpt_filter_instance

