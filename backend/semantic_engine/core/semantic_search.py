import asyncio
from typing import List, Dict, Any, Optional, Tuple
from .utils import SemanticLogger, POIDeduplicator, GeoBoundingBox, generate_cache_key, detect_country_from_polygon
from .osm_query import search_osm_pois
from .wiki_extractor import search_wiki_pois
from .geo_municipal import discover_zone_municipalities
from .marine_explorer import explore_marine_area, MarineAreaDetector
from .enrich_ai import POIEnricher
from .semantic_enricher import enrich_poi_list
from .extended_enrichment import enrich_poi_batch_with_extended_search
import json
import os

logger = SemanticLogger()

class SemanticPOISearchEngine:
    """Engine principale per la ricerca semantica avanzata di POI"""
    
    def __init__(self):
        self.deduplicator = POIDeduplicator(distance_threshold=50)
        self.enricher = POIEnricher()
        self.cache_dir = "../cache/semantic/"
        self._ensure_cache_dir()
    
    def _ensure_cache_dir(self):
        """Crea directory cache se non esiste"""
        os.makedirs(self.cache_dir, exist_ok=True)
    
    async def semantic_search(self, zone_name: str, 
                            polygon: List[List[float]], 
                            extend_marine: bool = False,
                            enable_ai_enrichment: bool = True,
                            marine_only: bool = False,
                            mode: str = "standard") -> Dict:
        """Ricerca semantica completa per una zona
        
        Args:
            zone_name: Nome della zona
            polygon: Poligono coordinati
            extend_marine: Estende ricerca al mare (aggiunge POI marini)
            enable_ai_enrichment: Abilita arricchimento AI
            marine_only: Se True, cerca SOLO POI marini (salta terrestri)
        """
        
        logger.log_search_request(zone_name, polygon, extend_marine)
        search_mode = (mode or "standard").lower()
        if search_mode == "enhanced":
            logger.logger.info("🌊 [POI-MARINE] Enhanced mode attivo — pipeline GPT avanzata")
        
        try:
            # 0. Rilevamento paese
            # ✅ FIX MarineUniversal: Country detection universale (senza fallback hardcoded)
            country_code, country_name = await detect_country_from_polygon(polygon)
            if not country_code or country_code == "":
                country_code, country_name = None, None  # ✅ FIX MarineUniversal: Fallback a None (non hardcoded IT)
            
            # ✅ FIX MarineUniversal: Verifica se è zona estera (qualsiasi paese diverso da IT o None)
            is_foreign = (country_code is not None and country_code != "" and country_code != "IT")
            if is_foreign:
                self._log_foreign_zone(country_code, country_name)
            
            # 1. Calcola bounding box
            bbox = GeoBoundingBox.from_polygon(polygon)
            
            # 2. Estendi per area marina se richiesto (universale - qualsiasi zona costiera)
            if extend_marine:
                bbox = GeoBoundingBox.extend_marine(bbox, polygon, extension_km=5.0)
            
            # ✅ FIX MarineDeep: 3. Controllo cache (invalida sempre alla prima esecuzione dopo modifiche)
            invalidate_cache = os.getenv("INVALIDATE_CACHE", "false").lower() == "true"
            cache_result = await self._check_cache(zone_name, polygon, extend_marine, marine_only, invalidate_cache, search_mode)
            
            if cache_result:
                logger.log_search_results(zone_name, len(cache_result.get("pois", [])), 
                                        len(cache_result.get("municipalities", [])))
                return cache_result
            
            # 4. Ricerca parallela da multiple fonti
            # Se marine_only=True, cerca SOLO POI marini (salta terrestri e municipi)
            if marine_only:
                # Solo ricerca marina
                logger.logger.info(f"🌊 RICERCA SOLO MARINA - Saltando POI terrestri e discovery municipi")
                osm_pois = []
                wiki_pois = []
                municipalities = []
                marine_data = await explore_marine_area(zone_name, bbox, polygon, mode=search_mode)
                unique_pois = marine_data.get("marine_pois", [])
            else:
                # Ricerca normale (terrestri + opzionale marina)
                search_tasks = [
                    self._search_osm_pois(bbox, polygon, extend_marine),
                    self._search_wiki_pois(zone_name, bbox, polygon, extend_marine, country_code),
                    self._discover_municipalities(zone_name, polygon)
                ]
                
                osm_pois, wiki_pois, municipalities = await asyncio.gather(*search_tasks)
                
                # 5. Combina e deduplica POI
                all_pois = osm_pois + wiki_pois
                unique_pois = self.deduplicator.deduplicate(all_pois)
                
                # 6. Ricerca marina se richiesta (solo se extend_marine=True)
                marine_data = {}
                if extend_marine:
                    marine_data = await explore_marine_area(zone_name, bbox, polygon, mode=search_mode)
                    if marine_data.get("marine_pois"):
                        # Aggiungi POI marini ai risultati
                        unique_pois.extend(marine_data["marine_pois"])
            
            # 7. Arricchimento AI se abilitato
            if enable_ai_enrichment:
                # Use the new semantic enricher for better results
                unique_pois = await enrich_poi_list(unique_pois, zone_name)
                
                # 7.1. Arricchimento esteso web per POI senza descrizione o con descrizione breve
                # Non blocca mai la ricerca principale - gestisce errori internamente
                try:
                    # Estrai nome comune principale se disponibile
                    municipality_name = ""
                    if municipalities and len(municipalities) > 0:
                        municipality_name = municipalities[0].get("name", "")
                    
                    # Arricchisci POI con descrizioni mancanti o brevi (non bloccante)
                    unique_pois = await enrich_poi_batch_with_extended_search(
                        unique_pois, 
                        zone_name, 
                        municipality_name
                    )
                except Exception as e:
                    # In caso di errore, mantieni i POI come sono (non blocca la ricerca)
                    logger.log_error("Extended Web Enrichment", str(e), zone_name)
                    logger.logger.warning(f"[EXTENDED SEARCH] Errore arricchimento esteso, continuando con POI esistenti")
                    # unique_pois rimane invariato
            
            # ✅ FIX MarineType: Assicura che tutti i POI marini abbiano type="marine" prima di organizzare i risultati
            for poi in unique_pois:
                if poi.get("marine_type") or poi.get("type") in ["wreck", "marine"]:
                    # Se ha marine_type o type è wreck/marine, assicura che type sia "marine"
                    if poi.get("type") != "marine":
                        poi["type"] = "marine"
            
            # 8. Organizza risultati finali
            result = self._organize_final_results(
                unique_pois, municipalities, marine_data, zone_name
            )
            # Add country metadata for frontend/UX
            result["country"] = {"code": country_code, "name": country_name}
            
            # ✅ FIX MarineDebug: Log di debug prima del return
            logger.logger.info(f"[DEBUG] Final result for zone {zone_name}: {len(result['pois'])} POIs (land: {len([p for p in result['pois'] if p.get('type') == 'land'])}, marine: {len([p for p in result['pois'] if p.get('type') == 'marine'])})")
            
            # 9. Salva in cache
            await self._save_to_cache(zone_name, polygon, extend_marine, result, marine_only, search_mode)
            
            logger.log_search_results(zone_name, len(result["pois"]), len(result["municipalities"]))
            
            return result
            
        except Exception as e:
            logger.log_error("Semantic Search", str(e), zone_name)
            return self._empty_result()
    
    async def _search_osm_pois(self, bbox: Tuple[float, float, float, float], 
                              polygon: List[List[float]], 
                              extend_marine: bool) -> List[Dict]:
        """Ricerca POI da OpenStreetMap"""
        try:
            return await search_osm_pois(bbox, include_marine=extend_marine)
        except Exception as e:
            logger.log_error("OSM POI Search", str(e), "")
            return []
    
    async def _search_wiki_pois(self, zone_name: str,
                               bbox: Tuple[float, float, float, float],
                               polygon: List[List[float]],
                               extend_marine: bool,
                               country_code: str = None) -> List[Dict]:
        """Ricerca POI da Wikipedia/Wikidata (universale - qualsiasi paese)"""
        try:
            # ✅ FIX MarineUniversal: Mappa lingue universale (non limitata a IT)
            lang_map = {
                "IT": "it", "FR": "fr", "ES": "es", "GR": "el", "HR": "hr",
                "DE": "de", "CH": "it", "AT": "de", "SI": "sl",
                "GB": "en", "US": "en", "PT": "pt", "NL": "nl", "BE": "nl",
                "DK": "da", "SE": "sv", "NO": "no", "FI": "fi", "PL": "pl",
                "CZ": "cs", "SK": "sk", "HU": "hu", "RO": "ro", "BG": "bg",
                "TR": "tr", "RU": "ru", "UA": "uk", "IL": "he", "EG": "ar",
                "TN": "ar", "MA": "ar", "DZ": "ar", "LY": "ar", "CY": "el",
            }
            lang = lang_map.get(country_code, "en") if country_code else "en"  # ✅ FIX MarineUniversal: Default "en" se paese non rilevato
            return await search_wiki_pois(zone_name, bbox, polygon, include_marine=extend_marine, lang=lang)
        except Exception as e:
            logger.log_error("Wiki POI Search", str(e), zone_name)
            return []
    
    async def _discover_municipalities(self, zone_name: str, 
                                     polygon: List[List[float]]) -> List[Dict]:
        """Scopre comuni nella zona"""
        try:
            return await discover_zone_municipalities(polygon, zone_name)
        except Exception as e:
            logger.log_error("Municipality Discovery", str(e), zone_name)
            return []
    
    def _organize_final_results(self, pois: List[Dict], 
                               municipalities: List[Dict],
                               marine_data: Dict, 
                               zone_name: str) -> Dict:
        """Organizza i risultati finali"""
        
        # ✅ FIX MarineType: Separa POI terrestri e marini (accetta anche type="wreck" come tipo marino)
        land_pois = [poi for poi in pois if poi.get("type") == "land"]
        # ✅ FIX MarineType: Accetta sia "marine" che "wreck" come tipo marino (per compatibilità)
        marine_pois = [poi for poi in pois if poi.get("type") in ["marine", "wreck"] or poi.get("marine_type")]
        
        # ✅ FIX MarineType: Assicura che tutti i POI marini abbiano type="marine" per consistenza
        for poi in marine_pois:
            if poi.get("type") != "marine":
                poi["type"] = "marine"
        
        # Ordina per relevance score
        land_pois.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        marine_pois.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        
        # Combina POI per output
        all_pois = land_pois + marine_pois
        
        result = {
            "zone_name": zone_name,
            "municipalities": municipalities,
            "pois": all_pois,
            "statistics": {
                "total_pois": len(all_pois),
                "land_pois": len(land_pois),
                "marine_pois": len(marine_pois),
                "total_municipalities": len(municipalities),
                "sources_used": self._get_sources_used(all_pois)
            }
        }
        
        # Aggiungi dati marini se presenti
        if marine_data:
            result["marine_analysis"] = {
                "marine_route": marine_data.get("marine_route", {}),
                "depth_analysis": marine_data.get("depth_analysis", {}),
                "is_coastal": True
            }
        else:
            result["marine_analysis"] = {"is_coastal": False}
        
        return result

    def _log_foreign_zone(self, code: str, name: str):
        try:
            logger.logger.info(f"[INFO] Zona estera rilevata: {code} ({name}) — attivo modello Overpass internazionale.")
        except Exception:
            pass
    
    def _get_sources_used(self, pois: List[Dict]) -> List[str]:
        """Ottiene lista delle fonti utilizzate"""
        sources = set()
        for poi in pois:
            source = poi.get("source", "Unknown")
            sources.add(source)
        return list(sources)
    
    def _normalize_poi_accessibility(self, poi: Dict) -> Dict:
        """Normalizza il campo accessibility da stringa a dizionario se necessario"""
        if "accessibility" in poi and isinstance(poi["accessibility"], str):
            # Convert old string format to dict format
            accessibility_str = poi["accessibility"]
            depth = poi.get("depth")
            poi["accessibility"] = {
                "level": accessibility_str,
                "depth_meters": depth if depth is not None else None,
                "difficulty": accessibility_str,
                "requirements": poi.get("diving_requirements", "Informarsi localmente")
            }
        elif "accessibility" not in poi or poi.get("accessibility") is None:
            # Se mancante, crea un dizionario di default
            poi["accessibility"] = {
                "level": "unknown",
                "depth_meters": poi.get("depth"),
                "difficulty": "unknown",
                "requirements": "Informarsi localmente"
            }
        return poi
    
    async def _check_cache(self, zone_name: str, polygon: List[List[float]], 
                          extend_marine: bool, marine_only: bool = False,
                          invalidate_cache: bool = False,
                          mode: str = "standard") -> Optional[Dict]:
        """✅ FIX MarineDeep: Controlla se esiste risultato in cache (invalida se richiesto)"""
        try:
            # ✅ FIX MarineDeep: Se invalidazione richiesta, salta cache
            if invalidate_cache:
                logger.logger.info(f"[POI-MARINE] ⚠️ Cache invalidation forced - skipping cache check")
                return None
            
            # Include marine_only nella cache key per distinguere ricerche marine da terrestri
            cache_key = generate_cache_key(f"{zone_name}_{extend_marine}_{marine_only}_{mode}", polygon)
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
            
            if os.path.exists(cache_file):
                # Verifica età del cache (massimo 24 ore)
                import time
                file_age = time.time() - os.path.getmtime(cache_file)
                if file_age < 86400:  # 24 ore
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cached_result = json.load(f)
                        
                        # ✅ FIX MarineWreckFinder: Se è una ricerca marina (marine_only=True), verifica qualità cache PRIMA di restituirla
                        if marine_only:
                            pois_count = len(cached_result.get("pois", []))
                            logger.logger.info(f"[POI-MARINE] 🔍 Verifica qualità cache: {pois_count} POI trovati per '{zone_name}'")
                            
                            # ✅ FIX MarineWreckFinder: Invalida cache se contiene 0 POI o se contiene molti duplicati (probabilmente vecchia logica)
                            if pois_count == 0:
                                logger.logger.warning(f"[POI-MARINE] ⚠️ Cache marina con 0 POI trovata per '{zone_name}' - Invalidando cache per rigenerare con ricerca SOLO diving center")
                                try:
                                    os.remove(cache_file)
                                except Exception as e:
                                    logger.log_error("Cache Invalidation", str(e), zone_name)
                                return None
                            
                            # ✅ FIX MarineWreckFinder: Controlla se ci sono POI da Wikipedia/Wikidata/DBpedia (NON devono essere presenti per ricerca marina!)
                            sources = [poi.get("source", "").lower() for poi in cached_result.get("pois", [])]
                            wikipedia_count = sum(1 for source in sources if "wikipedia" in source or "wikidata" in source or "dbpedia" in source or "fallback" in source)
                            logger.logger.info(f"[POI-MARINE] 🔍 Verifica source: {wikipedia_count} POI da Wikipedia/Wikidata/DBpedia/Fallback trovati")
                            if wikipedia_count >= 1:
                                logger.logger.warning(f"[POI-MARINE] ⚠️ Cache marina con {wikipedia_count} POI da Wikipedia/Wikidata/DBpedia/Fallback trovata per '{zone_name}' - Invalidando cache per rigenerare con ricerca SOLO diving center")
                                try:
                                    os.remove(cache_file)
                                    logger.logger.info(f"[POI-MARINE] ✅ Cache Python invalidata e rimossa: {cache_file}")
                                except Exception as e:
                                    logger.log_error("Cache Invalidation", str(e), zone_name)
                                return None
                            
                            # ✅ FIX MarineWreckFinder: Controlla se ci sono duplicati Moskva - probabilmente vecchia cache
                            names = [poi.get("name", "").lower() for poi in cached_result.get("pois", [])]
                            moskva_count = sum(1 for name in names if "moskva" in name or "moscow" in name or "moscova" in name)
                            logger.logger.info(f"[POI-MARINE] 🔍 Verifica Moskva: {moskva_count} trovati nei nomi POI")
                            if moskva_count >= 1:  # ✅ FIX MarineWreckFinder: Se c'è almeno 1 Moskva, invalida cache (non dovrebbe esserci)
                                logger.logger.warning(f"[POI-MARINE] ⚠️ Cache marina con {moskva_count} duplicati Moskva trovata per '{zone_name}' - Invalidando cache per rigenerare con nuova logica")
                                try:
                                    os.remove(cache_file)
                                    logger.logger.info(f"[POI-MARINE] ✅ Cache invalidata e rimossa: {cache_file}")
                                except Exception as e:
                                    logger.log_error("Cache Invalidation", str(e), zone_name)
                                return None
                            
                            # ✅ FIX MarineWreckFinder: Controlla se ci sono descrizioni irrilevanti (es. "Canada", "Ontario")
                            descriptions = [poi.get("description", "").lower() for poi in cached_result.get("pois", [])]
                            irrelevant_count = sum(1 for desc in descriptions if "canada" in desc or "ontario" in desc or "canadian" in desc)
                            logger.logger.info(f"[POI-MARINE] 🔍 Verifica descrizioni irrilevanti: {irrelevant_count} trovati")
                            if irrelevant_count >= 1:  # Se c'è almeno 1 descrizione irrilevante, invalida cache
                                logger.logger.warning(f"[POI-MARINE] ⚠️ Cache marina con {irrelevant_count} descrizioni irrilevanti (Canada/Ontario) trovata per '{zone_name}' - Invalidando cache per rigenerare con nuova logica")
                                try:
                                    os.remove(cache_file)
                                    logger.logger.info(f"[POI-MARINE] ✅ Cache invalidata e rimossa: {cache_file}")
                                except Exception as e:
                                    logger.log_error("Cache Invalidation", str(e), zone_name)
                                return None
                            
                            logger.logger.info(f"[POI-MARINE] ✅ Cache marina valida per '{zone_name}' - {pois_count} POI, 0 Wikipedia, 0 Moskva, 0 descrizioni irrilevanti")
                        
                        logger.logger.info(f"Cache hit for zone: {zone_name}")
                        
                        # Normalizza accessibility per tutti i POI dalla cache (converti stringa -> dict)
                        if "pois" in cached_result and isinstance(cached_result["pois"], list):
                            cached_result["pois"] = [
                                self._normalize_poi_accessibility(poi.copy())
                                for poi in cached_result["pois"]
                            ]
                        
                        return cached_result
            
        except Exception as e:
            logger.log_error("Cache Check", str(e), zone_name)
        
        return None
    
    async def _save_to_cache(self, zone_name: str, polygon: List[List[float]], 
                           extend_marine: bool, result: Dict, marine_only: bool = False,
                           mode: str = "standard"):
        """Salva risultato in cache"""
        try:
            # Include marine_only nella cache key per distinguere ricerche marine da terrestri
            cache_key = generate_cache_key(f"{zone_name}_{extend_marine}_{marine_only}_{mode}", polygon)
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
            
            # Aggiungi metadata cache
            cached_result = result.copy()
            cached_result["cache_metadata"] = {
                "cached_at": asyncio.get_event_loop().time(),
                "zone_name": zone_name,
                "extend_marine": extend_marine,
                "mode": mode
            }
            
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cached_result, f, indent=2, ensure_ascii=False)
                
            logger.logger.info(f"Saved cache for zone: {zone_name}")
            
        except Exception as e:
            logger.log_error("Cache Save", str(e), zone_name)
    
    def _empty_result(self) -> Dict:
        """Risultato vuoto in caso di errore"""
        return {
            "zone_name": "",
            "municipalities": [],
            "pois": [],
            "statistics": {
                "total_pois": 0,
                "land_pois": 0, 
                "marine_pois": 0,
                "total_municipalities": 0,
                "sources_used": []
            },
            "marine_analysis": {"is_coastal": False}
        }

class POIQualityAnalyzer:
    """Analizza la qualità e rilevanza dei POI trovati"""
    
    @staticmethod
    def analyze_poi_quality(pois: List[Dict]) -> Dict:
        """Analizza la qualità complessiva dei POI"""
        if not pois:
            return {"quality_score": 0, "recommendations": []}
        
        total_score = 0
        source_distribution = {}
        description_quality = {"detailed": 0, "basic": 0, "poor": 0}
        
        for poi in pois:
            # Score individuale
            score = poi.get("relevance_score", 0)
            total_score += score
            
            # Distribuzione fonti
            source = poi.get("source", "Unknown")
            source_distribution[source] = source_distribution.get(source, 0) + 1
            
            # Qualità descrizione
            desc_len = len(poi.get("description", ""))
            if desc_len > 100:
                description_quality["detailed"] += 1
            elif desc_len > 20:
                description_quality["basic"] += 1
            else:
                description_quality["poor"] += 1
        
        avg_quality = total_score / len(pois)
        
        # Genera raccomandazioni
        recommendations = []
        if avg_quality < 2.0:
            recommendations.append("Considerare fonti aggiuntive per migliorare la qualità")
        if description_quality["poor"] > len(pois) * 0.3:
            recommendations.append("Arricchire le descrizioni con informazioni turistiche")
        if len(source_distribution) < 2:
            recommendations.append("Diversificare le fonti di informazione")
        
        return {
            "quality_score": round(avg_quality, 2),
            "source_distribution": source_distribution,
            "description_quality": description_quality,
            "recommendations": recommendations
        }

class SemanticFilterEngine:
    """Engine per filtri semantici avanzati"""
    
    def __init__(self):
        self.tourism_categories = {
            "cultural": ["museo", "monument", "church", "castle", "archaeological"],
            "natural": ["park", "beach", "cliff", "peak", "nature"],
            "marine": ["lighthouse", "wreck", "diving", "reef", "marina"],
            "recreational": ["viewpoint", "garden", "theatre", "cinema"]
        }
    
    def categorize_pois(self, pois: List[Dict]) -> Dict[str, List[Dict]]:
        """Categorizza POI per tipo turistico"""
        categories = {category: [] for category in self.tourism_categories.keys()}
        categories["other"] = []
        
        for poi in pois:
            poi_text = f"{poi.get('name', '')} {poi.get('description', '')}".lower()
            categorized = False
            
            for category, keywords in self.tourism_categories.items():
                if any(keyword in poi_text for keyword in keywords):
                    categories[category].append(poi)
                    categorized = True
                    break
            
            if not categorized:
                categories["other"].append(poi)
        
        return categories
    
    def filter_by_relevance(self, pois: List[Dict], min_score: float = 2.0) -> List[Dict]:
        """Filtra POI per punteggio di rilevanza minimo"""
        return [poi for poi in pois if poi.get("relevance_score", 0) >= min_score]
    
    def filter_by_type(self, pois: List[Dict], poi_types: List[str]) -> List[Dict]:
        """Filtra POI per tipo (land/marine)"""
        return [poi for poi in pois if poi.get("type") in poi_types]
    
    def sort_by_criteria(self, pois: List[Dict], criteria: str = "relevance") -> List[Dict]:
        """Ordina POI per diversi criteri"""
        if criteria == "relevance":
            return sorted(pois, key=lambda x: x.get("relevance_score", 0), reverse=True)
        elif criteria == "name":
            return sorted(pois, key=lambda x: x.get("name", ""))
        elif criteria == "source":
            return sorted(pois, key=lambda x: x.get("source", ""))
        else:
            return pois

# Funzioni utility per uso esterno
async def perform_semantic_search(zone_name: str, 
                                polygon: List[List[float]], 
                                extend_marine: bool = False,
                                enable_ai: bool = True,
                                marine_only: bool = False,
                                mode: str = "standard") -> Dict:
    """Esegue ricerca semantica completa"""
    engine = SemanticPOISearchEngine()
    return await engine.semantic_search(zone_name, polygon, extend_marine, enable_ai, marine_only, mode)

def analyze_search_results(search_result: Dict) -> Dict:
    """Analizza i risultati di una ricerca semantica"""
    pois = search_result.get("pois", [])
    
    # Analisi qualità
    quality_analyzer = POIQualityAnalyzer()
    quality_analysis = quality_analyzer.analyze_poi_quality(pois)
    
    # Categorizzazione
    filter_engine = SemanticFilterEngine()
    categorized_pois = filter_engine.categorize_pois(pois)
    
    return {
        "quality_analysis": quality_analysis,
        "categorized_pois": categorized_pois,
        "summary": {
            "total_categories": len([cat for cat, pois_list in categorized_pois.items() if pois_list]),
            "most_represented_category": max(categorized_pois.items(), key=lambda x: len(x[1]))[0],
            "average_relevance": sum(p.get("relevance_score", 0) for p in pois) / len(pois) if pois else 0
        }
    }

