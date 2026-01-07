import asyncio
import aiohttp
import json
from typing import List, Dict, Any, Optional
from .utils import SemanticLogger

logger = SemanticLogger()

class POIEnricher:
    """Arricchisce POI con informazioni AI-generated"""
    
    def __init__(self):
        self.session = None
        # Configurazione per servizi AI (potrebbero essere OpenAI, local LLM, etc.)
        self.ai_config = {
            "enabled": False,  # Disabilitato by default per sicurezza
            "provider": "local",  # "openai", "local", "huggingface"
            "max_concurrent": 3,
            "timeout": 10
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def enrich_poi_batch(self, pois: List[Dict], zone_name: str = "") -> List[Dict]:
        """Arricchisce un batch di POI"""
        if not self.ai_config["enabled"] or not pois:
            return pois
        
        try:
            # Processa in batch per efficienza
            semaphore = asyncio.Semaphore(self.ai_config["max_concurrent"])
            
            enrichment_tasks = [
                self._enrich_single_poi(poi, zone_name, semaphore) 
                for poi in pois
            ]
            
            enriched_pois = await asyncio.gather(*enrichment_tasks, return_exceptions=True)
            
            # Filtra risultati validi
            valid_pois = []
            for i, result in enumerate(enriched_pois):
                if isinstance(result, Exception):
                    logger.log_error("POI Enrichment", str(result), pois[i].get("name", ""))
                    valid_pois.append(pois[i])  # Mantieni originale se errore
                else:
                    valid_pois.append(result)
            
            return valid_pois
            
        except Exception as e:
            logger.log_error("POI Batch Enrichment", str(e), zone_name)
            return pois  # Ritorna originali se errore generale
    
    async def _enrich_single_poi(self, poi: Dict, zone_name: str, semaphore) -> Dict:
        """Arricchisce un singolo POI"""
        async with semaphore:
            try:
                # Crea una copia per non modificare l'originale
                enriched_poi = poi.copy()
                
                # Arricchimento descrizione
                if len(poi.get("description", "")) < 50:
                    enhanced_description = await self._enhance_description(poi, zone_name)
                    if enhanced_description:
                        enriched_poi["ai_enhanced_description"] = enhanced_description
                
                # Genera suggerimenti visita
                visit_suggestions = await self._generate_visit_suggestions(poi, zone_name)
                if visit_suggestions:
                    enriched_poi["visit_suggestions"] = visit_suggestions
                
                # Calcola accessibilità
                accessibility_info = await self._analyze_accessibility(poi)
                if accessibility_info:
                    enriched_poi["accessibility_info"] = accessibility_info
                
                # Genera tag semantici
                semantic_tags = await self._generate_semantic_tags(poi)
                if semantic_tags:
                    enriched_poi["semantic_tags"] = semantic_tags
                
                # Flag AI enrichment
                enriched_poi["ai_enriched"] = True
                
                return enriched_poi
                
            except Exception as e:
                logger.log_error("Single POI Enrichment", str(e), poi.get("name", ""))
                return poi
    
    async def _enhance_description(self, poi: Dict, zone_name: str) -> Optional[str]:
        """Migliora la descrizione di un POI"""
        if not self._should_enhance_description(poi):
            return None
        
        try:
            # Simula chiamata AI per generare descrizione migliorata
            # In implementazione reale, qui ci sarebbe chiamata a:
            # - OpenAI GPT-4
            # - Local LLM (Llama, Mistral, etc.)
            # - Hugging Face API
            
            enhanced_description = await self._generate_enhanced_description_mock(poi, zone_name)
            return enhanced_description
            
        except Exception as e:
            logger.log_error("Description Enhancement", str(e), poi.get("name", ""))
            return None
    
    def _should_enhance_description(self, poi: Dict) -> bool:
        """Determina se la descrizione dovrebbe essere migliorata"""
        description = poi.get("description", "")
        
        # Migliora se descrizione è troppo corta o generica
        if len(description) < 30:
            return True
        
        # Migliora se contiene solo informazioni tecniche
        technical_only_indicators = [
            "built in", "elevation:", "coordinates", "osm id"
        ]
        
        if any(indicator in description.lower() for indicator in technical_only_indicators):
            return True
        
        return False
    
    async def _generate_enhanced_description_mock(self, poi: Dict, zone_name: str) -> str:
        """Mock di generazione descrizione AI-enhanced"""
        name = poi.get("name", "")
        poi_type = poi.get("type", "land")
        original_desc = poi.get("description", "")
        
        # Template base per diverse tipologie
        templates = {
            "church": f"{name} è una chiesa di grande interesse storico-artistico situata nella suggestiva area di {zone_name}. Rappresenta un importante esempio di architettura religiosa della regione.",
            "castle": f"{name} è un'antica fortezza che domina il paesaggio di {zone_name}. Le sue mura raccontano secoli di storia e offrono panorami mozzafiato sulla zona circostante.",
            "museum": f"{name} custodisce importanti testimonianze culturali del territorio di {zone_name}. Una visita permette di approfondire la storia locale e le tradizioni della zona.",
            "viewpoint": f"{name} offre uno dei panorami più spettacolari di {zone_name}. Il punto di osservazione regala vedute indimenticabili, particolarmente suggestive al tramonto.",
            "lighthouse": f"{name} è un faro storico che ha guidato i naviganti nelle acque di {zone_name} per generazioni. Simbolo della tradizione marittima locale.",
            "wreck": f"{name} è un relitto che riposa sui fondali di {zone_name}. Oggi meta di appassionati subacquei, ospita una ricca fauna marina.",
        }
        
        # Identifica tipo POI
        poi_category = "generic"
        name_lower = name.lower()
        
        for category in templates.keys():
            if category in name_lower or category in original_desc.lower():
                poi_category = category
                break
        
        if poi_category in templates:
            enhanced = templates[poi_category]
        else:
            enhanced = f"{name} rappresenta un punto di interesse significativo nell'area di {zone_name}. {original_desc}"
        
        return enhanced
    
    async def _generate_visit_suggestions(self, poi: Dict, zone_name: str) -> Optional[Dict]:
        """Genera suggerimenti per la visita"""
        try:
            poi_type = poi.get("type", "land")
            name = poi.get("name", "")
            
            suggestions = {
                "best_time": self._get_best_visit_time(poi),
                "duration": self._estimate_visit_duration(poi),
                "difficulty": self._assess_difficulty(poi),
                "tips": self._generate_visit_tips(poi, zone_name)
            }
            
            return suggestions
            
        except Exception as e:
            logger.log_error("Visit Suggestions", str(e), poi.get("name", ""))
            return None
    
    def _get_best_visit_time(self, poi: Dict) -> str:
        """Suggerisce il miglior momento per la visita"""
        poi_type = poi.get("type", "land")
        marine_type = poi.get("marine_type", "")
        name = poi.get("name", "").lower()
        
        if poi_type == "marine":
            if marine_type in ["wreck", "diving_site"]:
                return "Mattino (visibilità migliore), evitare condizioni di mare mosso"
            elif marine_type == "lighthouse":
                return "Tramonto (atmosfera suggestiva)"
        
        # POI terrestri
        if "viewpoint" in name or "belvedere" in name:
            return "Tramonto o alba per la luce migliore"
        elif "museum" in name or "museo" in name:
            return "Qualsiasi momento, preferibilmente mattino (meno affollato)"
        elif "church" in name or "chiesa" in name:
            return "Rispettare orari di culto, preferibile mattino o pomeriggio"
        
        return "Mattino o tardo pomeriggio"
    
    def _estimate_visit_duration(self, poi: Dict) -> str:
        """Stima la durata della visita"""
        name = poi.get("name", "").lower()
        poi_type = poi.get("type", "land")
        
        if poi_type == "marine":
            marine_type = poi.get("marine_type", "")
            if marine_type in ["wreck", "diving_site"]:
                return "2-4 ore (include preparazione e immersione)"
            return "30-60 minuti"
        
        # Durata per POI terrestri
        if "museum" in name or "museo" in name:
            return "1-2 ore"
        elif "castle" in name or "castello" in name:
            return "1.5-3 ore"
        elif "church" in name or "chiesa" in name:
            return "20-45 minuti"
        elif "viewpoint" in name or "panoram" in name:
            return "30-60 minuti"
        
        return "45-90 minuti"
    
    def _assess_difficulty(self, poi: Dict) -> str:
        """Valuta la difficoltà di accesso/visita"""
        poi_type = poi.get("type", "land") 
        depth = poi.get("depth")
        name = poi.get("name", "").lower()
        
        if poi_type == "marine":
            if depth:
                if depth <= 5:
                    return "Facile (snorkeling)"
                elif depth <= 18:
                    return "Medio (brevetto base)"
                elif depth <= 30:
                    return "Medio-Alto (brevetto avanzato)"
                else:
                    return "Difficile (brevetto tecnico)"
            return "Variabile"
        
        # Difficoltà POI terrestri (basata su indicatori nel nome)
        if any(word in name for word in ["peak", "summit", "monte", "vetta"]):
            return "Medio-Alto (escursionismo)"
        elif any(word in name for word in ["cliff", "scoglier", "dirupo"]):
            return "Medio (attenzione al percorso)"
        
        return "Facile"
    
    def _generate_visit_tips(self, poi: Dict, zone_name: str) -> List[str]:
        """Genera consigli pratici per la visita"""
        tips = []
        poi_type = poi.get("type", "land")
        name = poi.get("name", "").lower()
        
        if poi_type == "marine":
            tips.extend([
                "Verificare condizioni meteo-marine",
                "Informarsi presso diving center locali",
                "Rispettare l'ambiente marino"
            ])
            
            if poi.get("depth", 0) > 18:
                tips.append("Immersione solo con guide esperte")
        
        else:  # POI terrestri
            tips.extend([
                "Indossare scarpe comode",
                "Portare acqua, specialmente in estate"
            ])
            
            if "church" in name or "chiesa" in name:
                tips.extend([
                    "Vestirsi appropriatamente",
                    "Rispettare silenzio durante funzioni"
                ])
            
            if "museum" in name or "museo" in name:
                tips.extend([
                    "Verificare orari di apertura", 
                    "Possibili riduzioni per gruppi"
                ])
        
        # Consigli generali per la zona
        if "cinque terre" in zone_name.lower():
            tips.append("Considerare Cinque Terre Card per trasporti")
        elif "golfo" in zone_name.lower():
            tips.append("Sfruttare collegamenti marittimi tra località")
        
        return tips[:4]  # Massimo 4 consigli per non sovraccaricare
    
    async def _analyze_accessibility(self, poi: Dict) -> Optional[Dict]:
        """Analizza accessibilità del POI"""
        try:
            accessibility = {
                "mobility_impaired": "unknown",
                "family_friendly": "unknown", 
                "pet_friendly": "unknown",
                "public_transport": "unknown"
            }
            
            poi_type = poi.get("type", "land")
            name = poi.get("name", "").lower()
            
            # Analisi per POI marittimi
            if poi_type == "marine":
                accessibility["mobility_impaired"] = "not_accessible"
                accessibility["family_friendly"] = "conditional"  # Dipende dall'età
                accessibility["pet_friendly"] = "no"
                return accessibility
            
            # Analisi per POI terrestri
            if any(word in name for word in ["museum", "museo", "library", "biblioteca"]):
                accessibility["mobility_impaired"] = "likely_accessible"
                accessibility["family_friendly"] = "yes"
                accessibility["pet_friendly"] = "check_policy"
            
            elif any(word in name for word in ["peak", "cliff", "monte", "vetta", "scoglier"]):
                accessibility["mobility_impaired"] = "not_accessible"
                accessibility["family_friendly"] = "conditional"
                accessibility["pet_friendly"] = "yes"
            
            elif any(word in name for word in ["church", "chiesa", "cathedral"]):
                accessibility["mobility_impaired"] = "partial"
                accessibility["family_friendly"] = "yes" 
                accessibility["pet_friendly"] = "no"
            
            return accessibility
            
        except Exception as e:
            logger.log_error("Accessibility Analysis", str(e), poi.get("name", ""))
            return None
    
    async def _generate_semantic_tags(self, poi: Dict) -> Optional[List[str]]:
        """Genera tag semantici per il POI"""
        try:
            tags = []
            name = poi.get("name", "").lower()
            description = poi.get("description", "").lower()
            poi_type = poi.get("type", "land")
            
            text_content = f"{name} {description}"
            
            # Tag per categoria principale
            if poi_type == "marine":
                tags.append("marino")
                marine_type = poi.get("marine_type", "")
                if marine_type:
                    tags.append(marine_type)
            else:
                tags.append("terrestre")
            
            # Tag per tipologia turistica
            tourism_tags = {
                "cultural": ["chiesa", "museum", "monument", "castle", "historic"],
                "natural": ["park", "beach", "cliff", "peak", "nature", "viewpoint"],
                "recreational": ["theatre", "cinema", "garden", "marina"],
                "religious": ["chiesa", "church", "monastery", "cathedral", "sanctuary"]
            }
            
            for category, keywords in tourism_tags.items():
                if any(keyword in text_content for keyword in keywords):
                    tags.append(category)
            
            # Tag per periodo storico (se rilevabile)
            historical_periods = {
                "medieval": ["mediev", "xii", "xiii", "castello", "fortress"],
                "renaissance": ["rinascim", "xv", "xvi", "palace", "villa"],
                "modern": ["modern", "xx", "contemporary", "museo"]
            }
            
            for period, indicators in historical_periods.items():
                if any(indicator in text_content for indicator in indicators):
                    tags.append(period)
            
            # Tag per accessibilità
            if poi.get("accessibility_info", {}).get("family_friendly") == "yes":
                tags.append("family-friendly")
            
            if poi_type == "marine" and poi.get("depth", 50) <= 18:
                tags.append("diving-beginner")
            
            # Rimuovi duplicati e limita numero
            unique_tags = list(set(tags))[:8]  # Massimo 8 tag
            
            return unique_tags if unique_tags else None
            
        except Exception as e:
            logger.log_error("Semantic Tags Generation", str(e), poi.get("name", ""))
            return None

class TranslationEnricher:
    """Arricchisce POI con traduzioni multilingua"""
    
    def __init__(self):
        self.supported_languages = ["en", "fr", "de"]
        self.translation_enabled = False  # Disabilitato per default
    
    async def add_translations(self, pois: List[Dict]) -> List[Dict]:
        """Aggiunge traduzioni ai POI"""
        if not self.translation_enabled:
            return pois
        
        # Placeholder per sistema di traduzione
        # In implementazione reale integrerebbe servizi come:
        # - Google Translate API
        # - DeepL API
        # - Local translation models
        
        for poi in pois:
            translations = await self._generate_translations(poi)
            if translations:
                poi["translations"] = translations
        
        return pois
    
    async def _generate_translations(self, poi: Dict) -> Optional[Dict]:
        """Genera traduzioni per un POI"""
        # Mock implementation
        name = poi.get("name", "")
        description = poi.get("description", "")
        
        if not name:
            return None
        
        # Traduzioni mock per testing
        mock_translations = {
            "en": {
                "name": name,  # In reale implementation, qui ci sarebbe traduzione
                "description": description
            }
        }
        
        return mock_translations

# Funzioni utility per configurazione
def configure_ai_enrichment(provider: str = "local", 
                          enabled: bool = False,
                          api_key: str = "") -> Dict:
    """Configura il sistema di arricchimento AI"""
    config = {
        "provider": provider,
        "enabled": enabled,
        "api_key": api_key,
        "status": "configured" if enabled else "disabled"
    }
    
    # In implementazione reale, qui si salverebbe la configurazione
    logger.logger.info(f"AI Enrichment configured: {config}")
    
    return config
