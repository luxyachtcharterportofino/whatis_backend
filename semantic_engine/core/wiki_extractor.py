import asyncio
import aiohttp
import wikipedia
import requests
import json
from typing import List, Dict, Any, Optional, Tuple
from SPARQLWrapper import SPARQLWrapper, JSON
from .utils import SemanticLogger, POIValidator, point_in_polygon
import time

logger = SemanticLogger()

class WikipediaExtractor:
    """Estrae POI turistici da Wikipedia"""
    
    def __init__(self, lang: str = "it"):
        try:
            wikipedia.set_lang(lang or "it")  # Default italiano
        except Exception:
            wikipedia.set_lang("en")
        self.session = None
        self.lang = (lang or "it").lower()
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search_wikipedia_pois(self, zone_name: str, 
                                   bbox: Tuple[float, float, float, float],
                                   polygon: List[List[float]]) -> List[Dict]:
        """Cerca POI su Wikipedia per zona geografica con retry logic"""
        south, west, north, east = bbox
        pois = []
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                # Costruisci termini di ricerca
                search_terms = self._build_search_terms(zone_name)
                
                for term in search_terms:
                    try:
                        # Cerca pagine Wikipedia
                        search_results = wikipedia.search(term, results=10)
                        
                        for page_title in search_results[:5]:  # Limita per performance
                            poi = await self._extract_poi_from_page(page_title, bbox, polygon)
                            if poi:
                                pois.append(poi)
                                
                    except Exception as e:
                        if attempt < max_retries - 1:
                            logger.logger.warning(f"Wikipedia search term '{term}' failed (attempt {attempt + 1}/{max_retries}), retrying...")
                            await asyncio.sleep(retry_delay)
                            continue
                        logger.log_error("Wikipedia Search", str(e), zone_name)
                        continue
                        
                    # Pausa per non sovraccaricare Wikipedia API
                    await asyncio.sleep(0.5)
                    
                # Se arriviamo qui, la ricerca è riuscita
                return self._filter_and_deduplicate(pois)
                
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.logger.warning(f"Wikipedia POI search failed (attempt {attempt + 1}/{max_retries}): {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.log_error("Wikipedia POI Search", str(e), zone_name)
        
        return self._filter_and_deduplicate(pois)
    
    def _build_search_terms(self, zone_name: str) -> List[str]:
        """Costruisce termini di ricerca per Wikipedia"""
        base_terms = [zone_name]
        
        # Aggiungi termini turistici combinati
        tourist_terms = [
            f"{zone_name} turismo",
            f"{zone_name} monumenti", 
            f"{zone_name} chiese",
            f"{zone_name} musei",
            f"{zone_name} castelli",
            f"cosa vedere {zone_name}",
            f"attrazioni {zone_name}"
        ]
        
        # Aggiungi termini geografici se zona contiene indicatori geografici
        if any(word in zone_name.lower() for word in ["golfo", "baia", "costa", "riviera"]):
            tourist_terms.extend([
                f"{zone_name} spiagge",
                f"{zone_name} fari",
                f"{zone_name} porto"
            ])
        
        return base_terms + tourist_terms
    
    def _is_irrelevant_wreck(self, name: str, description: str = "", lat: float = None, lng: float = None) -> bool:
        """✅ FIX MarinePOI: Verifica se un relitto è irrilevante (nome + coordinate geografiche)
        Esclude relitti noti fuori zona (es. Moskva nel Mar Nero se coordinate sono in Liguria)
        """
        text = (name + " " + description).lower()
        
        # ✅ FIX MarinePOI: Lista relitti noti con zone geografiche
        irrelevant_wrecks = {
            "moskva": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)},  # Mar Nero
            "moscova": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)},
            "moscow": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)},
            "москва": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)}
        }
        
        for wreck_name, geo_range in irrelevant_wrecks.items():
            if wreck_name in text:
                # ✅ FIX MarinePOI: Se coordinate sono disponibili, verifica se sono fuori dal range geografico noto
                if lat is not None and lng is not None:
                    if not (geo_range["lat_range"][0] <= lat <= geo_range["lat_range"][1] and
                           geo_range["lng_range"][0] <= lng <= geo_range["lng_range"][1]):
                        # Fuori dal range geografico noto → escludi
                        return True
                else:
                    # Coordinate non disponibili → escludi per sicurezza se nome indica chiaramente il relitto
                    return True
        
        return False
    
    async def _extract_poi_from_page(self, page_title: str, 
                                    bbox: Tuple[float, float, float, float],
                                    polygon: List[List[float]]) -> Optional[Dict]:
        """Estrae POI da una pagina Wikipedia"""
        try:
            page = wikipedia.page(page_title, auto_suggest=False)
            
            # Prova a ottenere coordinate
            coordinates = self._extract_coordinates(page)
            if not coordinates:
                return None
            
            lat, lng = coordinates
            
            # Verifica se è nell'area di interesse (usa solo bbox e polygon della zona selezionata - universale)
            if not self._is_in_area(lat, lng, bbox, polygon):
                return None
            
            # Costruisci POI
            poi = {
                "name": page.title,
                "description": self._clean_summary(page.summary),
                "lat": lat,
                "lng": lng,
                "source": "Wikipedia",
                "type": "land",
                "wikipedia_url": page.url,
                "wikipedia_pageid": page.pageid,
                "lang": self.lang
            }
            
            # CONTROLLO RELITTI IRRILEVANTI: Escludi solo relitti con nomi noti di altre località
            # Verifica se è un relitto marino
            if any(word in page.content.lower() for word in ['relitto', 'wreck', 'naufragio', 'affondato', 'shipwreck']):
                poi["marine_type"] = "wreck"
                # ✅ FIX MarinePOI: Escludi solo relitti con nomi noti fuori zona (es. Moskva nel Mar Nero)
                if self._is_irrelevant_wreck(page.title, page.summary, poi.get("lat"), poi.get("lng")):
                    logger.logger.warning(f"⚠️ Relitto irrilevante '{page.title}' escluso (nome/coordinate indicano relitto noto di altra località)")
                    return None
            
            # Verifica rilevanza turistica
            if POIValidator.is_tourist_relevant(poi):
                poi["relevance_score"] = POIValidator.calculate_relevance_score(poi)
                return poi
                
        except Exception as e:
            logger.log_error("Wikipedia Page Extraction", str(e), page_title)
        
        return None
    
    def _extract_coordinates(self, page) -> Optional[Tuple[float, float]]:
        """Estrae coordinate da pagina Wikipedia"""
        try:
            # Prova coordinate dirette - gestisci diversi formati possibili
            try:
                if hasattr(page, 'coordinates'):
                    coords = page.coordinates
                    if coords:
                        # Se è una lista/tupla di coordinate
                        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                            return (float(coords[0]), float(coords[1]))
                        # Se è un dizionario con lat/lng
                        elif isinstance(coords, dict):
                            if 'lat' in coords and 'lng' in coords:
                                return (float(coords['lat']), float(coords['lng']))
                            elif 'latitude' in coords and 'longitude' in coords:
                                return (float(coords['latitude']), float(coords['longitude']))
                        # Se è direttamente una tupla (lat, lng)
                        elif isinstance(coords, tuple) and len(coords) == 2:
                            return coords
            except (AttributeError, KeyError, TypeError, ValueError) as e:
                # Se l'accesso a coordinates fallisce, continua con altri metodi
                pass
            
            # Cerca nel contenuto coordinate nel formato {{coord|...}}
            content = page.content
            import re
            
            # Pattern per coordinate in formato italiano
            coord_patterns = [
                r'{{[Cc]oord\|([0-9.]+)\|([0-9.]+)',
                r'coordinate\s*=\s*([0-9.]+)[°]?\s*[NS]?\s*([0-9.]+)[°]?\s*[EW]?',
                r'lat\s*=\s*([0-9.]+).*?lon\s*=\s*([0-9.]+)'
            ]
            
            for pattern in coord_patterns:
                matches = re.search(pattern, content, re.IGNORECASE)
                if matches:
                    try:
                        lat = float(matches.group(1))
                        lng = float(matches.group(2))
                        
                        # ✅ FIX MarinePOI: Validazione coordinate universale (qualsiasi zona nel mondo)
                        # Coordinate valide: lat [-90, 90], lng [-180, 180]
                        if -90 <= lat <= 90 and -180 <= lng <= 180:
                            return lat, lng
                    except ValueError:
                        continue
                        
        except Exception as e:
            logger.log_error("Coordinate Extraction", str(e), "")
        
        return None
    
    def _is_in_area(self, lat: float, lng: float, 
                   bbox: Tuple[float, float, float, float],
                   polygon: List[List[float]]) -> bool:
        """Verifica se un punto è nell'area di interesse"""
        south, west, north, east = bbox
        
        # Prima verifica bounding box (più veloce)
        if not (south <= lat <= north and west <= lng <= east):
            return False
        
        # Poi verifica poligono preciso
        return point_in_polygon((lat, lng), polygon)
    
    def _clean_summary(self, summary: str) -> str:
        """Pulisce il summary di Wikipedia"""
        if not summary:
            return ""
        
        # Rimuovi riferimenti e parentesi eccessive
        import re
        
        # Rimuovi note [1], [2], etc.
        summary = re.sub(r'\[\d+\]', '', summary)
        
        # Mantieni solo primi 200 caratteri per brevità
        if len(summary) > 200:
            summary = summary[:200].rsplit('.', 1)[0] + '.'
        
        return summary.strip()
    
    def _filter_and_deduplicate(self, pois: List[Dict]) -> List[Dict]:
        """Filtra e deduplica POI Wikipedia"""
        # Rimuovi duplicati per nome
        seen_names = set()
        unique_pois = []
        
        for poi in pois:
            name_key = poi['name'].lower().strip()
            if name_key not in seen_names:
                seen_names.add(name_key)
                unique_pois.append(poi)
        
        # Ordina per relevance score
        unique_pois.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        return unique_pois

class WikidataExtractor:
    """Estrae POI turistici da Wikidata tramite SPARQL"""
    
    def __init__(self):
        self.sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
        self.sparql.setReturnFormat(JSON)
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search_wikidata_pois(self, bbox: Tuple[float, float, float, float],
                                  polygon: List[List[float]], lang: str = "it") -> List[Dict]:
        """Cerca POI turistici su Wikidata in un'area geografica con retry logic"""
        south, west, north, east = bbox
        
        # Query SPARQL per POI turistici nell'area
        lang = (lang or "it").lower()
        query = f"""
        PREFIX wikibase: <http://wikiba.se/ontology#>
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        PREFIX p: <http://www.wikidata.org/prop/>
        PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX schema: <http://schema.org/>
        
        SELECT DISTINCT ?item ?itemLabel ?lat ?lon ?typeLabel ?description WHERE {{
          ?item wdt:P31 ?type .
          
          # Estrai lat e lon dalla coordinate (sintassi Wikidata standard)
          ?item p:P625 ?coordStatement .
          ?coordStatement psv:P625 ?coordNode .
          ?coordNode wikibase:geoLatitude ?lat .
          ?coordNode wikibase:geoLongitude ?lon .
          
          # Filtro geografico
          FILTER(?lat >= {south} && ?lat <= {north} &&
                 ?lon >= {west} && ?lon <= {east}) .
          
          # Tipi turistici
          VALUES ?type {{
            wd:Q23413      # castello
            wd:Q33506      # museo  
            wd:Q16970      # chiesa
            wd:Q811979     # monumento
            wd:Q570116     # sito turistico
            wd:Q839954     # sito archeologico
            wd:Q1107656    # viewpoint
            wd:Q207694     # faro
            wd:Q2867476    # relitto
            wd:Q2652911    # palazzo storico
            wd:Q44613      # monastero
            wd:Q34442      # strada
            wd:Q1229071    # forte
          }}
          
          OPTIONAL {{ ?item schema:description ?description . FILTER(LANG(?description) = "{lang}") }}
          
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{lang},en" . }}
        }}
        LIMIT 100
        """
        
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                self.sparql.setQuery(query)
                results = self.sparql.query().convert()
                
                pois = []
                for result in results["results"]["bindings"]:
                    poi = await self._process_wikidata_result(result, polygon, lang)
                    if poi:
                        pois.append(poi)
                
                return pois
                
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.logger.warning(f"Wikidata query attempt {attempt + 1}/{max_retries} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.log_error("Wikidata Query", str(e), "")
                    return []
        
        return []
    
    async def _process_wikidata_result(self, result: Dict, polygon: List[List[float]], lang: str = "it") -> Optional[Dict]:
        """Processa un risultato Wikidata"""
        try:
            # Estrai coordinate direttamente da ?lat e ?lon
            if "lat" not in result or "lon" not in result:
                return None
            
            lat = float(result["lat"]["value"])
            lng = float(result["lon"]["value"])
            
            # Verifica se è nel poligono (universale - qualsiasi zona nel mondo)
            if not point_in_polygon((lat, lng), polygon):
                return None
            
            # Costruisci POI
            name = result["itemLabel"]["value"]
            description = result.get("description", {}).get("value", f"Luogo di interesse turistico")
            
            poi = {
                "name": name,
                "lat": lat,
                "lng": lng,
                "source": "Wikidata",
                "type": "land",
                "wikidata_id": result["item"]["value"].split('/')[-1],
                "lang": (lang or "it").lower(),
                "description": description
            }
            
            # CONTROLLO RELITTI IRRILEVANTI: Escludi solo relitti con nomi noti di altre località
            type_label = result.get("typeLabel", {}).get("value", "").lower()
            if "relitto" in type_label or "wreck" in type_label or "shipwreck" in type_label:
                poi["marine_type"] = "wreck"
                # ✅ FIX MarinePOI: Escludi solo relitti con nomi noti fuori zona (es. Moskva nel Mar Nero)
                wiki_extractor = WikipediaExtractor(lang=lang)
                if wiki_extractor._is_irrelevant_wreck(name, description, poi.get("lat"), poi.get("lng")):
                    logger.logger.warning(f"⚠️ Relitto irrilevante '{name}' escluso (nome/coordinate indicano relitto noto di altra località)")
                    return None
            
            # Verifica rilevanza turistica
            if POIValidator.is_tourist_relevant(poi):
                poi["relevance_score"] = POIValidator.calculate_relevance_score(poi)
                return poi
                
        except Exception as e:
            logger.log_error("Wikidata Result Processing", str(e), "")
        
        return None

class DBpediaExtractor:
    """Estrae POI turistici da DBpedia tramite SPARQL"""
    
    def __init__(self, lang: str = "it"):
        self.sparql = SPARQLWrapper("https://dbpedia.org/sparql")
        self.sparql.setReturnFormat(JSON)
        self.lang = (lang or "it").lower()
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search_dbpedia_pois(self, bbox: Tuple[float, float, float, float],
                                 polygon: List[List[float]], lang: str = "it") -> List[Dict]:
        """✅ FIX MarineAudit: Cerca POI marini subacquei su DBpedia (relitti, reef, diving sites)
        Versione specializzata per ricerca marina - esclude fari, porti, marine
        """
        south, west, north, east = bbox
        
        # ✅ FIX MarineAudit: Query SPARQL SOLO per POI subacquei (relitti, reef, diving sites)
        lang = (lang or "it").lower()
        query = f"""
        PREFIX geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbp: <http://dbpedia.org/property/>
        
        SELECT DISTINCT ?uri ?name ?lat ?lon ?abstract ?type WHERE {{
          ?uri rdf:type ?type .
          ?uri geo:lat ?lat .
          ?uri geo:long ?lon .
          ?uri rdfs:label ?name .
          
          # ✅ FIX MarineAudit: Filtro geografico
          FILTER(?lat >= {south} && ?lat <= {north} &&
                 ?lon >= {west} && ?lon <= {east}) .
          
          # ✅ FIX MarineAudit: SOLO POI subacquei (relitti, reef) - escludi fari, porti, marine
          {{
            ?uri rdf:type dbo:Shipwreck .  # ✅ FIX MarineAudit: Relitti
          }} UNION {{
            ?uri rdf:type dbo:Reef .  # ✅ FIX MarineAudit: Reef
          }} UNION {{
            ?uri dbp:type "shipwreck" .  # ✅ FIX MarineAudit: Relitti (alternativa)
          }} UNION {{
            ?uri dbp:type "wreck" .  # ✅ FIX MarineAudit: Relitti (alternativa)
          }}
          
          # ✅ FIX MarineAudit: Escludi esplicitamente fari, porti, marine
          FILTER NOT EXISTS {{
            ?uri rdf:type dbo:Lighthouse .
          }}
          FILTER NOT EXISTS {{
            ?uri rdf:type dbo:Port .
          }}
          FILTER NOT EXISTS {{
            ?uri rdf:type dbo:Harbour .
          }}
          
          # Limita a lingua specifica se disponibile
          FILTER(LANG(?name) = "{lang}" || LANG(?name) = "en") .
          
          OPTIONAL {{
            ?uri dbo:abstract ?abstract .
            FILTER(LANG(?abstract) = "{lang}" || LANG(?abstract) = "en") .
          }}
        }}
        LIMIT 100
        """
        
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                self.sparql.setQuery(query)
                results = self.sparql.query().convert()
                
                pois = []
                for result in results["results"]["bindings"]:
                    poi = await self._process_dbpedia_result(result, polygon, lang)
                    if poi:
                        pois.append(poi)
                
                return pois
                
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.logger.warning(f"DBpedia query attempt {attempt + 1}/{max_retries} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                else:
                    logger.log_error("DBpedia Query", str(e), "")
                    return []
        
        return []
    
    async def _process_dbpedia_result(self, result: Dict, polygon: List[List[float]], lang: str = "it") -> Optional[Dict]:
        """Processa un risultato DBpedia"""
        try:
            # Estrai coordinate
            lat = float(result["lat"]["value"])
            lng = float(result["lon"]["value"])
            
            # Verifica se è nel poligono (universale - qualsiasi zona nel mondo)
            if not point_in_polygon((lat, lng), polygon):
                return None
            
            # Estrai nome
            name = result["name"]["value"]
            
            # Estrai descrizione se disponibile
            if "abstract" in result:
                abstract = result["abstract"]["value"]
                description = abstract[:300] if len(abstract) > 300 else abstract
            else:
                description = f"{name} è un luogo di interesse turistico."
            
            # Costruisci POI
            poi = {
                "name": name,
                "lat": lat,
                "lng": lng,
                "source": "DBpedia",
                "type": "land",
                "dbpedia_uri": result["uri"]["value"],
                "lang": (lang or "it").lower(),
                "description": description
            }
            
            # Aggiungi tipo se disponibile
            if "type" in result:
                poi["dbpedia_type"] = result["type"]["value"].split("/")[-1]
                # CONTROLLO RELITTI IRRILEVANTI: Escludi solo relitti con nomi noti di altre località
                dbpedia_type = poi["dbpedia_type"].lower()
                if "wreck" in dbpedia_type or "shipwreck" in dbpedia_type:
                    poi["marine_type"] = "wreck"
                    # ✅ FIX MarinePOI: Escludi solo relitti con nomi noti fuori zona (es. Moskva nel Mar Nero)
                    wiki_extractor = WikipediaExtractor(lang=lang)
                    if wiki_extractor._is_irrelevant_wreck(name, description, poi.get("lat"), poi.get("lng")):
                        logger.logger.warning(f"⚠️ Relitto irrilevante '{name}' escluso (nome/coordinate indicano relitto noto di altra località)")
                        return None
            
            # Verifica rilevanza turistica
            if POIValidator.is_tourist_relevant(poi):
                poi["relevance_score"] = POIValidator.calculate_relevance_score(poi)
                return poi
                
        except Exception as e:
            logger.log_error("DBpedia Result Processing", str(e), "")
        
        return None

class WikiMarineExtractor:
    """Estrazione specifica per POI marittimi da fonti Wiki"""
    
    def __init__(self):
        self.wikipedia_extractor = WikipediaExtractor()
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def search_marine_pois(self, zone_name: str,
                               bbox: Tuple[float, float, float, float],
                               polygon: List[List[float]]) -> List[Dict]:
        """✅ FIX MarineDeep: Cerca SOLO POI subacquei (relitti, reef, shoal, ostacoli sommersi)
        Esclude rigorosamente: fari, porti, marine, baie, isole
        """
        
        # ✅ FIX MarinePOI: Termini di ricerca SOLO per POI subacquei (ridotti per evitare timeout)
        # Limiti ricerca a 10 termini principali per evitare blocchi
        marine_search_terms = [
            f"{zone_name} relitti",
            f"{zone_name} wreck",
            f"{zone_name} shipwreck",
            f"{zone_name} secca",
            f"{zone_name} reef",
            f"relitti {zone_name}",
            f"wreck {zone_name}",
            f"diving site {zone_name}",
            f"naufragio {zone_name}",
            f"underwater {zone_name}",
            # ✅ FIX MarinePOI: Termini generici per relitti (universale - funziona per qualsiasi zona costiera)
            # ✅ FIX MarineDeep: Esclusi "fari", "lighthouse", "port", "marina", "harbor", "bay", "island"
        ]
        
        marine_pois = []
        
        logger.logger.info(f"[POI-MARINE] 🔍 Ricerca Wikipedia con {len(marine_search_terms)} termini...")
        
        for i, term in enumerate(marine_search_terms, 1):
            try:
                logger.logger.info(f"[POI-MARINE] 🔍 Termine {i}/{len(marine_search_terms)}: '{term}'")
                search_results = wikipedia.search(term, results=3)  # ✅ FIX MarinePOI: Ridotto da 5 a 3 per velocità
                logger.logger.info(f"[POI-MARINE] ✅ Termine '{term}': trovati {len(search_results)} risultati Wikipedia")
                
                for page_title in search_results:
                    logger.logger.debug(f"[POI-MARINE] 🔍 Estrazione POI da pagina: '{page_title}'")
                    poi = await self._extract_marine_poi(page_title, bbox, polygon)
                    if poi:
                        marine_pois.append(poi)
                        logger.logger.info(f"[POI-MARINE] ✅ POI aggiunto: '{poi.get('name', '')}' (lat: {poi.get('lat')}, lng: {poi.get('lng')})")
                    else:
                        logger.logger.debug(f"[POI-MARINE] ⚠️ POI escluso da pagina: '{page_title}'")
                        
                await asyncio.sleep(0.3)  # ✅ FIX MarinePOI: Ridotto da 0.5 a 0.3 per velocità
                
            except Exception as e:
                logger.log_error("Marine Wikipedia Search", str(e), term)
                logger.logger.warning(f"[POI-MARINE] ⚠️ Errore ricerca termine '{term}': {str(e)}")
                continue
        
        logger.logger.info(f"[POI-MARINE] ✅ Ricerca Wikipedia completata: {len(marine_pois)} POI trovati")
        
        return self._filter_marine_pois(marine_pois)
    
    async def _extract_marine_poi(self, page_title: str,
                                 bbox: Tuple[float, float, float, float],
                                 polygon: List[List[float]]) -> Optional[Dict]:
        """Estrae POI marittimo da pagina Wikipedia"""
        try:
            logger.logger.debug(f"[POI-MARINE] 📄 Caricamento pagina Wikipedia: '{page_title}'")
            page = wikipedia.page(page_title, auto_suggest=False)
            logger.logger.debug(f"[POI-MARINE] ✅ Pagina caricata: '{page.title}' (content length: {len(page.content)})")
            
            # ✅ FIX MarineDeep: Verifica se è realmente un POI subacqueo (escludi fari, porti, ecc.)
            content = page.content.lower()
            title = page.title.lower()
            
            # ✅ FIX MarineDeep: Indicatori SOLO per POI subacquei
            underwater_indicators = [
                'relitto', 'wreck', 'naufragio', 'shipwreck',
                'immersion', 'diving', 'subacque', 'underwater', 'reef', 'shoal',
                'affondato', 'sunk', 'nave affondata', 'ship sunk', 'secca',
                'scoglio sommerso', 'submerged', 'underwater wreck'
            ]
            
            # ✅ FIX MarineDeep: Escludi elementi di superficie
            surface_keywords = [
                'faro', 'lighthouse', 'phare', 'far',
                'porto', 'port', 'harbour', 'harbor', 'marina',
                'spiaggia', 'beach', 'baia', 'bay', 'isola', 'island'
            ]
            
            # ✅ FIX MarineDeep: Se contiene parole chiave di superficie, escludi
            if any(keyword in title or keyword in content[:500] for keyword in surface_keywords):
                # Verifica se NON è subacqueo (es. se è un faro o un porto)
                if not any(indicator in content for indicator in underwater_indicators):
                    return None
            
            # ✅ FIX MarineDeep: Deve contenere almeno un indicatore subacqueo
            if not any(indicator in content for indicator in underwater_indicators):
                logger.logger.debug(f"[POI-MARINE] ⚠️ Esclusa pagina Wikipedia '{page.title}' (nessun indicatore subacqueo)")
                return None
            
            # ✅ FIX MarinePOI: Valida che la descrizione sia rilevante per la zona (evita pagine sbagliate)
            # Se la descrizione contiene riferimenti geografici irrilevanti (es. "canada", "ontario"), escludi
            irrelevant_geo_keywords = [
                "canada", "canadian", "ontario", "quebec", "novo scotia",
                "black sea", "mar nero", "черное море", "ukraine", "ucraina",
                "russia", "russia", "mediterranean"  # OK per Liguria, ma controlla se è troppo generico
            ]
            
            # Se contiene molti riferimenti geografici irrilevanti, escludi
            irrelevant_count = sum(1 for keyword in irrelevant_geo_keywords if keyword in content[:1000].lower())
            if irrelevant_count >= 2:  # Se 2+ riferimenti irrilevanti, probabilmente pagina sbagliata
                logger.logger.debug(f"[POI-MARINE] ⚠️ Esclusa pagina Wikipedia '{page.title}' (troppi riferimenti geografici irrilevanti: {irrelevant_count})")
                return None
            
            # Estrai coordinate
            coordinates = self.wikipedia_extractor._extract_coordinates(page)
            if not coordinates:
                logger.logger.debug(f"[POI-MARINE] ⚠️ Esclusa pagina Wikipedia '{page.title}' (coordinate non trovate)")
                return None
            
            lat, lng = coordinates
            
            # Verifica area (rilassato: permette POI leggermente fuori zona per poi filtrarli in deep_marine_search)
            if not self.wikipedia_extractor._is_in_area(lat, lng, bbox, polygon):
                logger.logger.debug(f"[POI-MARINE] ⚠️ Esclusa pagina Wikipedia '{page.title}' (coordinate {lat}, {lng} fuori area)")
                return None
            
            # ✅ FIX MarinePOI: Valida descrizione prima di estrarre (evita contenuti irrilevanti)
            summary = self.wikipedia_extractor._clean_summary(page.summary)
            
            # ✅ FIX MarinePOI: Se la descrizione contiene riferimenti geografici irrilevanti, pulisci
            irrelevant_geo_keywords = [
                "canada", "canadian", "ontario", "quebec", "novo scotia",
                "black sea", "mar nero", "черное море", "ukraine", "ucraina",
                "russia", "russia"
            ]
            
            # Se contiene riferimenti geografici irrilevanti, estrai solo frasi rilevanti
            if any(keyword in summary.lower() for keyword in irrelevant_geo_keywords):
                sentences = summary.split('.')
                relevant_sentences = [
                    s.strip() for s in sentences 
                    if any(word in s.lower() for word in ['relitto', 'wreck', 'affondato', 'naufragio', 'shipwreck', 'sunk', 'secca'])
                    and not any(keyword in s.lower() for keyword in irrelevant_geo_keywords)
                ]
                
                if relevant_sentences:
                    summary = '. '.join(relevant_sentences[:2]) + '.'  # Max 2 frasi rilevanti
                else:
                    # Se non ci sono frasi rilevanti, usa descrizione generica
                    summary = f"Relitto marino nella zona."
                    logger.logger.debug(f"[POI-MARINE] ⚠️ Descrizione Wikipedia irrilevante per '{page.title}' - usata descrizione generica")
            
            # Costruisci POI marino
            poi = {
                "name": page.title,
                "description": summary,
                "lat": lat,
                "lng": lng,
                "source": "Wikipedia",
                "type": "marine",
                "wikipedia_url": page.url
            }
            
            # Aggiungi metadati marini specifici
            self._add_marine_metadata(poi, content)
            
            if POIValidator.is_tourist_relevant(poi):
                poi["relevance_score"] = POIValidator.calculate_relevance_score(poi)
                return poi
                
        except Exception as e:
            logger.log_error("Marine POI Extraction", str(e), page_title)
        
        return None
    
    def _add_marine_metadata(self, poi: Dict, content: str):
        """Aggiunge metadati marini specifici"""
        # Cerca profondità
        import re
        
        depth_patterns = [
            r'profondit[àa]\s*[di\s]*([0-9]+)\s*metri',
            r'depth\s*[of\s]*([0-9]+)\s*meters?',
            r'([0-9]+)\s*metri\s*di\s*profondit[àa]'
        ]
        
        for pattern in depth_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                try:
                    poi["depth"] = int(match.group(1))
                    break
                except ValueError:
                    continue
        
        # Determina tipo di POI marino
        if any(word in content for word in ['relitto', 'wreck', 'naufragio', 'affondato']):
            poi["marine_type"] = "wreck"
        elif any(word in content for word in ['faro', 'lighthouse']):
            poi["marine_type"] = "lighthouse"  
        elif any(word in content for word in ['immersion', 'diving', 'subacque']):
            poi["marine_type"] = "diving_site"
        else:
            poi["marine_type"] = "marine_poi"
    
    def _filter_marine_pois(self, pois: List[Dict]) -> List[Dict]:
        """Filtra e ordina POI marini"""
        # Deduplica per nome
        seen = set()
        unique_pois = []
        
        for poi in pois:
            key = poi['name'].lower().strip()
            if key not in seen:
                seen.add(key)
                unique_pois.append(poi)
        
        # Ordina per relevance score
        unique_pois.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        return unique_pois

# Funzioni di utility per uso esterno
async def search_wiki_pois(zone_name: str, 
                          bbox: Tuple[float, float, float, float],
                          polygon: List[List[float]], 
                          include_marine: bool = False,
                          lang: str = "it") -> List[Dict]:
    """Cerca POI su Wikipedia, Wikidata e DBpedia"""
    all_pois = []
    
    # Wikipedia search
    try:
        async with WikipediaExtractor(lang=lang) as wiki_extractor:
            wikipedia_pois = await wiki_extractor.search_wikipedia_pois(zone_name, bbox, polygon)
            all_pois.extend(wikipedia_pois)
            logger.logger.info(f"✅ Wikipedia: trovati {len(wikipedia_pois)} POI")
    except Exception as e:
        logger.log_error("Wikipedia Search", str(e), zone_name)
    
    # Wikidata search  
    try:
        async with WikidataExtractor() as wikidata_extractor:
            wikidata_pois = await wikidata_extractor.search_wikidata_pois(bbox, polygon, lang)
            all_pois.extend(wikidata_pois)
            logger.logger.info(f"✅ Wikidata: trovati {len(wikidata_pois)} POI")
    except Exception as e:
        logger.log_error("Wikidata Search", str(e), zone_name)
    
    # DBpedia search
    try:
        async with DBpediaExtractor(lang=lang) as dbpedia_extractor:
            dbpedia_pois = await dbpedia_extractor.search_dbpedia_pois(bbox, polygon, lang)
            all_pois.extend(dbpedia_pois)
            logger.logger.info(f"✅ DBpedia: trovati {len(dbpedia_pois)} POI")
    except Exception as e:
        logger.log_error("DBpedia Search", str(e), zone_name)
    
    # Marine search se richiesto
    if include_marine:
        try:
            async with WikiMarineExtractor() as marine_extractor:
                marine_pois = await marine_extractor.search_marine_pois(zone_name, bbox, polygon)
                all_pois.extend(marine_pois)
                logger.logger.info(f"✅ Marine Wiki: trovati {len(marine_pois)} POI")
        except Exception as e:
            logger.log_error("Marine Wiki Search", str(e), zone_name)
    
    return all_pois
