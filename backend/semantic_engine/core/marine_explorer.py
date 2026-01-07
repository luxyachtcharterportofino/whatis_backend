import asyncio
import aiohttp
import json
from typing import List, Dict, Any, Optional, Tuple
from .utils import SemanticLogger, GeoBoundingBox, POIValidator, point_in_polygon
from .osm_query import OSMDataExtractor

logger = SemanticLogger()

class MarineAreaDetector:
    """Rileva se una zona tocca il mare e calcola estensioni marine"""
    
    # Coordinate approssimative della costa ligure per rilevamento
    LIGURIAN_COAST_BOUNDS = {
        "north": 44.3,
        "south": 43.5,
        "west": 7.5,
        "east": 10.2
    }
    
    @staticmethod
    def is_coastal_zone(polygon: List[List[float]]) -> bool:
        """Determina se una zona tocca la costa"""
        bounds = MarineAreaDetector.LIGURIAN_COAST_BOUNDS
        
        for point in polygon:
            lat, lng = point[0], point[1]
            
            # Verifica se è nell'area costiera ligure
            if (bounds["south"] <= lat <= bounds["north"] and 
                bounds["west"] <= lng <= bounds["east"]):
                
                # Controllo più preciso per vicinanza costa
                if MarineAreaDetector._is_near_coast(lat, lng):
                    return True
        
        return False
    
    @staticmethod
    def _is_near_coast(lat: float, lng: float) -> bool:
        """Controllo dettagliato per vicinanza alla costa"""
        # Zone costiere note della Liguria
        coastal_zones = [
            # Golfo dei Poeti
            {"lat_min": 44.0, "lat_max": 44.12, "lng_min": 9.8, "lng_max": 9.95},
            # Cinque Terre
            {"lat_min": 44.1, "lat_max": 44.15, "lng_min": 9.6, "lng_max": 9.75},
            # Costa del Levante
            {"lat_min": 44.0, "lat_max": 44.3, "lng_min": 9.0, "lng_max": 10.0},
            # Costa del Ponente  
            {"lat_min": 43.7, "lat_max": 44.1, "lng_min": 7.5, "lng_max": 9.0}
        ]
        
        for zone in coastal_zones:
            if (zone["lat_min"] <= lat <= zone["lat_max"] and 
                zone["lng_min"] <= lng <= zone["lng_max"]):
                return True
        
        return False
    
    @staticmethod
    def calculate_marine_extension(polygon: List[List[float]], 
                                 extension_km: float = 5.0) -> Tuple[float, float, float, float]:
        """Calcola estensione marina del bounding box - Universale per qualsiasi zona"""
        bbox = GeoBoundingBox.from_polygon(polygon)
        
        # Estendi sempre verso il mare per qualsiasi zona costiera
        # (non solo Liguria - funziona universalmente)
        return GeoBoundingBox.extend_marine(bbox, polygon, extension_km)

class MarinePOICollector:
    """Colleziona POI marittimi da diverse fonti"""
    
    def __init__(self):
        self.session = None
        
        # Database locale di POI marittimi noti - Relitti reali della Liguria
        self.known_marine_pois = {
            "golfo_dei_poeti": [
                {
                    "name": "Relitto della Mohawk Deer",
                    "lat": 44.0342, "lng": 9.8956,
                    "depth": 32,
                    "description": "Cargo affondato nel 1974, oggi ricco di vita marina. Visibile a 32 metri di profondità.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                },
                {
                    "name": "Relitto Washington",
                    "lat": 44.328, "lng": 9.217,
                    "depth": 28,
                    "description": "Relitto della nave Washington, affondata nella seconda guerra mondiale. Ricca di vita marina.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                },
                {
                    "name": "Relitto Ischia",
                    "lat": 44.315, "lng": 9.235,
                    "depth": 35,
                    "description": "Relitto del peschereccio Ischia, punto di immersione molto popolare.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                },
                {
                    "name": "Faro di Tino", 
                    "lat": 44.0255, "lng": 9.8505,
                    "description": "Faro storico sull'isola del Tino, punto di riferimento per la navigazione.",
                    "type": "marine", "marine_type": "lighthouse",
                    "source": "LocalDB"
                }
            ],
            "cinque_terre": [
                {
                    "name": "Secca del Ferale",
                    "lat": 44.1245, "lng": 9.6834, 
                    "depth": 18,
                    "description": "Secca rocciosa ricca di gorgonie e spugne. Ottima per immersioni ricreative.",
                    "type": "marine", "marine_type": "reef",
                    "source": "LocalDB"
                }
            ],
            "portofino": [
                {
                    "name": "Relitto KT UJ2216",
                    "lat": 44.320, "lng": 9.215,
                    "depth": 42,
                    "description": "Relitto di un motopesca, immersione tecnica per subacquei avanzati.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                },
                {
                    "name": "Relitto Jörn",
                    "lat": 44.318, "lng": 9.220,
                    "depth": 38,
                    "description": "Relitto del peschereccio Jörn, affondato nel Golfo di Portofino.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                }
            ],
            "tigullio": [
                {
                    "name": "Relitto Mohawk Deer",
                    "lat": 44.0342, "lng": 9.8956,
                    "depth": 32,
                    "description": "Cargo affondato nel 1974 nel Golfo dei Poeti, oggi ricco di vita marina.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                },
                {
                    "name": "Relitto Washington",
                    "lat": 44.328, "lng": 9.217,
                    "depth": 28,
                    "description": "Relitto storico della seconda guerra mondiale nel Golfo del Tigullio.",
                    "type": "marine", "marine_type": "wreck",
                    "source": "LocalDB"
                }
            ]
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    # ✅ FIX MarineAudit: Metodi collect_marine_pois() e deep_marine_search() rimossi - ridondanti
    # Usa direttamente la funzione globale deep_marine_search()
    
    def _get_local_marine_pois(self, zone_name: str, polygon: List[List[float]]) -> List[Dict]:
        """Ottieni POI dal database locale"""
        zone_key = zone_name.lower().replace(" ", "_")
        local_pois = []
        
        # Cerca nel database locale
        if zone_key in self.known_marine_pois:
            candidate_pois = self.known_marine_pois[zone_key]
        else:
            # Cerca per parole chiave nel nome della zona
            candidate_pois = []
            zone_lower = zone_name.lower()
            
            # Cerca match per parole chiave (più flessibile)
            for key, pois in self.known_marine_pois.items():
                key_words = key.split("_")
                # Match se almeno una parola chiave è presente nel nome zona
                if any(word in zone_lower for word in key_words if len(word) > 3):
                    candidate_pois.extend(pois)
            
            # Se non trovato, non cerchiamo in altre zone - ogni zona deve avere i suoi POI specifici
            # (il database locale è principalmente per zone liguri, ma può essere esteso per altre zone)
        
        # Filtra per poligono (universale - qualsiasi zona nel mondo)
        for poi in candidate_pois:
            if point_in_polygon((poi["lat"], poi["lng"]), polygon):
                poi_copy = poi.copy()
                if "source" not in poi_copy:
                    poi_copy["source"] = "LocalDB"
                local_pois.append(poi_copy)
        
        return local_pois
    
    async def _get_osm_marine_pois(self, bbox: Tuple[float, float, float, float],
                                  polygon: List[List[float]]) -> List[Dict]:
        """Ottieni POI marittimi da OpenStreetMap"""
        try:
            async with OSMDataExtractor() as extractor:
                # Query specifica per POI marittimi
                marine_query = extractor.query_builder.build_marine_query(bbox)
                marine_data = await extractor.execute_query(marine_query)
                marine_pois = extractor.extract_poi_data(marine_data, "marine")
                
                # Filtra per poligono (universale - qualsiasi zona nel mondo)
                filtered_pois = []
                for poi in marine_pois:
                    # Verifica se è dentro il poligono della zona selezionata
                    if point_in_polygon((poi["lat"], poi["lng"]), polygon):
                        # Controllo: escludi solo relitti con nomi noti di altre località lontane
                        # (es. Moskva che è notoriamente nel Mar Nero, non può essere in altre zone)
                        if poi.get("marine_type") == "wreck":
                            name = poi.get("name", "").lower()
                            description = poi.get("description", "").lower()
                            text = name + " " + description
                            
                            # Escludi solo se il nome/descrizione indica chiaramente che è un relitto noto di altre zone
                            irrelevant_keywords = [
                                "moskva", "moscova", "moscow", "москва",  # Relitto noto nel Mar Nero
                                # Nota: NON escludiamo per coordinate geografiche, solo per nomi noti
                            ]
                            
                            if any(keyword in text for keyword in irrelevant_keywords):
                                logger.logger.warning(f"⚠️ Relitto OSM irrilevante '{poi.get('name')}' escluso (nome indica relitto noto di altra località)")
                                continue
                        
                        filtered_pois.append(poi)
                
                logger.logger.info(f"✅ OSM Marine: trovati {len(filtered_pois)} POI marini validi (filtro poligono zona)")
                return filtered_pois
                
        except Exception as e:
            logger.log_error("OSM Marine POI", str(e), "")
            return []
    
    async def _get_wiki_marine_pois(self, zone_name: str,
                                    bbox: Tuple[float, float, float, float],
                                    polygon: List[List[float]]) -> List[Dict]:
        """Ottieni POI marini da Wikipedia/Wikidata/DBpedia - Ricerca specifica per relitti e fari"""
        wiki_marine_pois = []
        
        try:
            from .wiki_extractor import WikiMarineExtractor, WikipediaExtractor, WikidataExtractor, DBpediaExtractor
            from .utils import point_in_polygon
            
            # 1. Ricerca marina specifica su Wikipedia (relitti, fari, punti immersione)
            try:
                async with WikiMarineExtractor() as marine_extractor:
                    wiki_marine = await marine_extractor.search_marine_pois(zone_name, bbox, polygon)
                    wiki_marine_pois.extend(wiki_marine)
                    logger.logger.info(f"✅ Marine Wikipedia: trovati {len(wiki_marine)} POI")
            except Exception as e:
                logger.log_error("Marine Wikipedia Search", str(e), zone_name)
            
            # 2. Ricerca Wikidata specifica per relitti marini nella zona
            try:
                wikidata_extractor = WikidataExtractor()
                async with wikidata_extractor:
                    # Query SPARQL per relitti marini nell'area
                    south, west, north, east = bbox
                    
                    # Cerca relitti (shipwreck) e fari (lighthouse) nell'area
                    query = f"""
                    PREFIX wikibase: <http://wikiba.se/ontology#>
                    PREFIX wd: <http://www.wikidata.org/entity/>
                    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
                    PREFIX p: <http://www.wikidata.org/prop/>
                    PREFIX psv: <http://www.wikidata.org/prop/statement/value/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    
                    SELECT DISTINCT ?item ?itemLabel ?lat ?lon ?description WHERE {{
                      {{
                        ?item wdt:P31 wd:Q2867476 .  # Relitto (shipwreck)
                      }} UNION {{
                        ?item wdt:P31/wdt:P279* wd:Q39715 .  # Faro (lighthouse)
                      }} UNION {{
                        ?item wdt:P31 wd:Q39825 .  # Diving site
                      }}
                      
                      # Estrai coordinate
                      ?item p:P625 ?coordStatement .
                      ?coordStatement psv:P625 ?coordNode .
                      ?coordNode wikibase:geoLatitude ?lat .
                      ?coordNode wikibase:geoLongitude ?lon .
                      
                      # Filtro geografico
                      FILTER(?lat >= {south} && ?lat <= {north} &&
                             ?lon >= {west} && ?lon <= {east}) .
                      
                      OPTIONAL {{ ?item schema:description ?description . FILTER(LANG(?description) = "it" || LANG(?description) = "en" || LANG(?description) = "fr") }}
                      
                      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "it,en,fr" . }}
                    }}
                    LIMIT 100
                    """
                    
                    from SPARQLWrapper import SPARQLWrapper, JSON
                    
                    sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
                    sparql.setQuery(query)
                    sparql.setReturnFormat(JSON)
                    
                    # Esegui query con retry (SPARQLWrapper è sincrono, quindi usiamo asyncio.to_thread o loop.run_in_executor)
                    import asyncio
                    max_retries = 3
                    results = None
                    for attempt in range(max_retries):
                        try:
                            # Esegui query sincrona in thread pool per non bloccare
                            loop = asyncio.get_event_loop()
                            results = await loop.run_in_executor(None, lambda: sparql.query().convert())
                            break
                        except Exception as e:
                            if attempt < max_retries - 1:
                                await asyncio.sleep(2)
                                continue
                            raise
                    
                    wikidata_count = 0
                    for result in results.get("results", {}).get("bindings", []):
                        poi = await wikidata_extractor._process_wikidata_result(result, polygon, "it")
                        if poi:
                            # Verifica che sia un POI marino
                            type_label = result.get("typeLabel", {}).get("value", "").lower() if "typeLabel" in result else ""
                            if "wreck" in type_label or "shipwreck" in type_label:
                                poi["marine_type"] = "wreck"
                            elif "lighthouse" in type_label or "faro" in type_label:
                                poi["marine_type"] = "lighthouse"
                            else:
                                poi["marine_type"] = "marine_poi"
                            
                            poi["type"] = "marine"
                            
                            # Escludi relitti irrilevanti (solo Moskva)
                            name_lower = poi.get("name", "").lower()
                            if "moskva" in name_lower or "moscova" in name_lower or "moscow" in name_lower:
                                logger.logger.warning(f"⚠️ Relitto Wikidata irrilevante '{poi.get('name')}' escluso (nome indica relitto noto di altra località)")
                                continue
                            
                            # Il filtro poligono è già fatto in _process_wikidata_result
                            # Se il POI è arrivato qui, è dentro il poligono
                            wiki_marine_pois.append(poi)
                            wikidata_count += 1
                    
                    logger.logger.info(f"✅ Marine Wikidata: trovati {wikidata_count} relitti/fari nell'area")
            except Exception as e:
                logger.log_error("Marine Wikidata Search", str(e), zone_name)
            
        except Exception as e:
            logger.log_error("Wiki Marine POI Collection", str(e), zone_name)
        
        return wiki_marine_pois
    
    async def _get_specialized_marine_pois(self, zone_name: str,
                                        bbox: Tuple[float, float, float, float],
                                        polygon: List[List[float]]) -> List[Dict]:
        """Ottieni POI da fonti specializzate marine"""
        specialized_pois = []
        
        try:
            # Simula ricerca da database diving/nautica
            # In una implementazione reale, qui si farebbero chiamate a:
            # - Database relitti
            # - Siti diving specializzati  
            # - Portolani digitali
            # - Database fari
            
            # Per ora, genera alcuni POI basati sulla zona
            generated_pois = self._generate_contextual_marine_pois(zone_name, bbox, polygon)
            specialized_pois.extend(generated_pois)
            
        except Exception as e:
            logger.log_error("Specialized Marine POI", str(e), zone_name)
        
        return specialized_pois
    
    def _generate_contextual_marine_pois(self, zone_name: str,
                                       bbox: Tuple[float, float, float, float],
                                       polygon: List[List[float]]) -> List[Dict]:
        """Genera POI marittimi contestuali basati sulla zona"""
        generated_pois = []
        south, west, north, east = bbox
        
        # Centro della zona
        center_lat = (north + south) / 2
        center_lng = (east + west) / 2
        
        # Genera POI in base al nome della zona
        zone_lower = zone_name.lower()
        
        if "golfo" in zone_lower:
            # Genera punti di immersione tipici di un golfo
            diving_spots = [
                {
                    "name": f"Sito immersione {zone_name}",
                    "lat": center_lat - 0.01,
                    "lng": center_lng + 0.02,
                    "depth": 25,
                    "description": f"Sito di immersione nel {zone_name} con ricca fauna marina",
                    "type": "marine",
                    "marine_type": "diving_site",
                    "source": "Generated"
                }
            ]
            generated_pois.extend(diving_spots)
        
        if "cinque terre" in zone_lower or "monterosso" in zone_lower:
            # Area marina protetta
            protected_areas = [
                {
                    "name": "Area Marina Protetta Cinque Terre",
                    "lat": center_lat,
                    "lng": center_lng,
                    "description": "Area marina protetta con eccezionale biodiversità",
                    "type": "marine", 
                    "marine_type": "protected_area",
                    "source": "Generated"
                }
            ]
            generated_pois.extend(protected_areas)
        
        # Filtra per poligono
        filtered_pois = []
        for poi in generated_pois:
            if point_in_polygon((poi["lat"], poi["lng"]), polygon):
                filtered_pois.append(poi)
        
        return filtered_pois

class MarineRouteGenerator:
    """Genera itinerari marittimi"""
    
    @staticmethod
    def generate_marine_route(marine_pois: List[Dict]) -> Dict:
        """Genera un itinerario marino suggerito"""
        if not marine_pois:
            return {}
        
        # Ordina POI per tipologia e rilevanza
        lighthouses = [p for p in marine_pois if p.get("marine_type") == "lighthouse"]
        wrecks = [p for p in marine_pois if p.get("marine_type") == "wreck"]
        diving_sites = [p for p in marine_pois if p.get("marine_type") == "diving_site"]
        reefs = [p for p in marine_pois if p.get("marine_type") == "reef"]
        
        route = {
            "name": "Itinerario Marino Suggerito",
            "description": "Percorso marino ottimizzato per escursioni nautiche",
            "waypoints": [],
            "estimated_duration": "Mezza giornata",
            "difficulty": "Facile"
        }
        
        # Costruisci itinerario logico
        waypoints = []
        
        # Inizia dai fari (punti di riferimento)
        waypoints.extend(sorted(lighthouses, key=lambda x: x.get("relevance_score", 0), reverse=True)[:2])
        
        # Aggiungi siti immersione
        waypoints.extend(sorted(diving_sites, key=lambda x: x.get("relevance_score", 0), reverse=True)[:2])
        
        # Aggiungi relitti accessibili (profondità < 40m)
        accessible_wrecks = [w for w in wrecks if w.get("depth", 50) < 40]
        waypoints.extend(sorted(accessible_wrecks, key=lambda x: x.get("relevance_score", 0), reverse=True)[:1])
        
        route["waypoints"] = waypoints[:6]  # Max 6 waypoints
        
        # Aggiorna durata in base al numero di punti
        if len(waypoints) <= 2:
            route["estimated_duration"] = "2-3 ore"
        elif len(waypoints) <= 4:
            route["estimated_duration"] = "Mezza giornata"
        else:
            route["estimated_duration"] = "Giornata intera"
        
        return route

class DepthAnalyzer:
    """Analizza profondità e accessibilità dei POI marini"""
    
    @staticmethod
    def categorize_by_depth(marine_pois: List[Dict]) -> Dict[str, List[Dict]]:
        """Categorizza POI marini per fascia di profondità"""
        categories = {
            "surface": [],      # 0-5m
            "shallow": [],      # 5-18m  
            "recreational": [], # 18-40m
            "technical": [],    # 40m+
            "unknown": []       # senza info profondità
        }
        
        for poi in marine_pois:
            depth = poi.get("depth")
            
            if depth is None:
                categories["unknown"].append(poi)
            elif depth <= 5:
                categories["surface"].append(poi)
            elif depth <= 18:
                categories["shallow"].append(poi)
            elif depth <= 40:
                categories["recreational"].append(poi)
            else:
                categories["technical"].append(poi)
        
        return categories
    
    @staticmethod
    def add_accessibility_info(marine_pois: List[Dict]) -> List[Dict]:
        """Aggiunge informazioni di accessibilità ai POI marini"""
        for poi in marine_pois:
            depth = poi.get("depth")
            marine_type = poi.get("marine_type", "")
            
            # Determina accessibilità (deve essere un dict per Pydantic)
            if depth is None:
                accessibility_level = "unknown"
                requirements = "Informarsi localmente"
            elif depth <= 5:
                accessibility_level = "easy"
                requirements = "Snorkeling, nuoto"
            elif depth <= 18:
                accessibility_level = "moderate"  
                requirements = "Open Water Diver"
            elif depth <= 30:
                accessibility_level = "advanced"
                requirements = "Advanced Open Water Diver"
            else:
                accessibility_level = "expert"
                requirements = "Deep Diving specialty"
            
            # Convert accessibility to dict format (Pydantic expects Dict[str, Any])
            poi["accessibility"] = {
                "level": accessibility_level,
                "depth_meters": depth if depth is not None else None,
                "difficulty": accessibility_level,
                "requirements": requirements
            }
            poi["diving_requirements"] = requirements
            
            # Aggiungi note specifiche per tipo
            if marine_type == "wreck":
                poi["safety_notes"] = "Attenzione a strutture instabili, non entrare senza addestramento"
            elif marine_type == "reef":
                poi["safety_notes"] = "Rispettare la fauna marina, non toccare coralli"
            elif marine_type == "lighthouse":
                poi["safety_notes"] = "Avvicinamento possibile solo in condizioni di mare calmo"
        
        return marine_pois

# ✅ FIX MarineAudit: Ricerca marina SOLO fonti semantiche (Wikipedia, Wikidata, DBpedia)
async def deep_marine_search(zone_name: str,
                           bbox: Tuple[float, float, float, float],
                           polygon: List[List[float]],
                           mode: str = "standard") -> List[Dict]:
    """✅ FIX MarineAudit: Ricerca POI subacquei autentici usando SOLO fonti semantiche
    Fonti: Wikipedia, Wikidata, DBpedia
    Restituisce solo POI sotto la superficie del mare (relitti, reef, shoal, ostacoli sommersi)
    """
    search_mode = (mode or "standard").lower()
    logger.logger.info(f"[POI-MARINE] 🌊 Search started — zone: {zone_name} (mode: {search_mode})")
    
    marine_pois = []
    
    # ✅ FIX MarineAudit: Ricerca parallela da fonti semantiche (Wikipedia, Wikidata, DBpedia)
    try:
        wiki_pois = await _search_semantic_sources(zone_name, bbox, polygon, mode=mode)
        marine_pois.extend(wiki_pois)
        
        if wiki_pois:
            wrecks = sum(1 for p in wiki_pois if p.get("marine_type") == "wreck")
            reefs = sum(1 for p in wiki_pois if p.get("marine_type") == "reef")
            other = len(wiki_pois) - wrecks - reefs
            logger.logger.info(f"[POI-MARINE] ✅ Semantic sources: {wrecks} wrecks, {reefs} reefs, {other} other")
    except Exception as e:
        logger.log_error("Semantic Sources Search", str(e), zone_name)
    
    # ✅ FIX MarinePOI: Filtra rigorosamente tutti i risultati (subacquei + dentro zona + nel mare + deduplica + validazione geografica)
    filtered_pois = []
    duplicates_count = 0
    skipped_count = 0  # POI fuori zona o di superficie
    
    from .utils import is_in_zone, is_in_water, POIDeduplicator
    from geopy.distance import geodesic
    
    # ✅ FIX MarinePOI: Lista relitti noti con zone geografiche specifiche (universale - qualsiasi zona)
    # Moskva è notoriamente nel Mar Nero (44.0-45.0N, 28.0-35.0E)
    # Se un POI con nome "Moskva" ha coordinate fuori dal Mar Nero, è probabilmente un errore/duplicato
    known_irrelevant_wrecks = {
        "moskva": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)},  # Mar Nero
        "moscova": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)},
        "moscow": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)},
        "москва": {"lat_range": (44.0, 45.0), "lng_range": (28.0, 35.0)}
    }
    
    # ✅ FIX MarinePOI: Deduplicazione Python migliorata (nome case-insensitive + distanza più stretta)
    seen_pois = []  # Lista di POI già visti per deduplicazione
    
    for poi in marine_pois:
        # ✅ FIX MarinePOI: 0. Escludi relitti noti fuori zona (es. Moskva nel Mar Nero)
        poi_name_lower = (poi.get("name", "") or "").lower().strip()
        description_lower = (poi.get("description", "") or "").lower()
        
        is_irrelevant = False
        for wreck_name, geo_range in known_irrelevant_wrecks.items():
            if wreck_name in poi_name_lower or wreck_name in description_lower:
                # ✅ FIX MarinePOI: Verifica coordinate: se è fuori dal range geografico noto, escludilo (universale)
                lat, lng = poi.get("lat", 0), poi.get("lng", 0)
                
                # ✅ FIX MarinePOI: Se coordinate sono fuori dal range geografico noto del relitto, escludi (universale)
                # Esempio: Moskva è nel Mar Nero (28-35°E), se coordinate sono 8-10°E (Mediterraneo occidentale), è un errore
                if not (geo_range["lat_range"][0] <= lat <= geo_range["lat_range"][1] and
                       geo_range["lng_range"][0] <= lng <= geo_range["lng_range"][1]):
                    skipped_count += 1
                    logger.logger.info(f"[POI-MARINE] ⚠️ Escluso relitto irrilevante '{poi.get('name')}' (coordinate {lat}, {lng} fuori zona geografica nota: {geo_range['lat_range']}, {geo_range['lng_range']})")
                    is_irrelevant = True
                    break
        
        if is_irrelevant:
            continue  # ✅ FIX MarinePOI: Salta questo POI e passa al successivo
        
        # Se non è un relitto irrilevante, continua con i filtri normali
        # ✅ FIX MarineWeb: 1. Verifica che sia un POI subacqueo (rilassato per web search)
        # Per web search, accetta anche risultati che parlano di destinazioni subacquee
        # (poi estrarremo i nomi dei relitti dal contenuto)
        if not _is_underwater_poi(poi):
            # ✅ FIX MarineWeb: Se è da web search e contiene indicatori di destinazioni subacquee, accetta comunque
            if poi.get("source") == "Web Search" or poi.get("source") == "Google CSE":
                text = ((poi.get("name", "") or "") + " " + (poi.get("description", "") or "")).lower()
                underwater_indicators = [
                    "destinazioni subacquee", "diving site", "sito di immersione", "relitto", "wreck",
                    "shipwreck", "naufragio", "underwater", "subacqueo", "immersion", "scuba"
                ]
                if any(indicator in text for indicator in underwater_indicators):
                    logger.logger.info(f"[POI-MARINE] ℹ️ POI da web search con indicatori subacquei accettato: '{poi.get('name', '')}' (estrarremo relitti dal contenuto)")
                    # Non saltare - continuerà con i filtri successivi
                else:
                    skipped_count += 1
                    logger.logger.warning(f"[POI-MARINE] ⚠️ POI escluso (non subacqueo): '{poi.get('name', '')}' (source: {poi.get('source', 'unknown')})")
                    continue
            else:
                skipped_count += 1
                logger.logger.warning(f"[POI-MARINE] ⚠️ POI escluso (non subacqueo): '{poi.get('name', '')}' (source: {poi.get('source', 'unknown')})")
                continue
        
        # ✅ FIX MarinePOI: 2. Verifica che sia dentro il poligono della zona
        if not is_in_zone(poi["lat"], poi["lng"], polygon):
            skipped_count += 1
            logger.logger.warning(f"[POI-MARINE] ⚠️ POI escluso (fuori zona): '{poi.get('name', '')}' ({poi.get('lat')}, {poi.get('lng')}) (source: {poi.get('source', 'unknown')})")
            continue
        
        # ✅ FIX MarinePOI: 3. Verifica che sia nel mare (non su terraferma)
        # ✅ FIX MarineWeb: Per coordinate stimate (da web search), usa controllo meno rigoroso
        is_water_check = await is_in_water(poi["lat"], poi["lng"])
        if not is_water_check:
            # Se è da web search e coordinate sono stimate, accetta comunque se è dentro il poligono
            if poi.get("source") == "Web Search" and poi.get("url"):
                logger.logger.info(f"[POI-MARINE] ℹ️ POI da web search con coordinate stimate: '{poi.get('name', '')}' ({poi.get('lat')}, {poi.get('lng')}) - accetto anche se non in mare (coordinate stimate)")
            else:
                skipped_count += 1
                logger.logger.warning(f"[POI-MARINE] ⚠️ POI escluso (non in mare): '{poi.get('name', '')}' ({poi.get('lat')}, {poi.get('lng')}) (source: {poi.get('source', 'unknown')})")
                continue
        
        # ✅ FIX MarinePOI: 4. Deduplicazione migliorata (nome case-insensitive + distanza più stretta)
        is_duplicate = False
        
        for seen_poi in seen_pois:
            seen_name_lower = (seen_poi.get("name", "") or "").lower().strip()
            
            # ✅ FIX MarinePOI: Se nome è identico (case-insensitive), soglia più stretta (50m)
            if poi_name_lower == seen_name_lower:
                distance_km = geodesic(
                    (poi["lat"], poi["lng"]),
                    (seen_poi["lat"], seen_poi["lng"])
                ).kilometers
                
                if distance_km < 0.05:  # 50m per nomi identici
                    is_duplicate = True
                    duplicates_count += 1
                    break
            
            # ✅ FIX MarinePOI: Se nome è simile (contenuto), soglia intermedia (100m)
            elif (len(poi_name_lower) > 3 and len(seen_name_lower) > 3 and
                  (poi_name_lower in seen_name_lower or seen_name_lower in poi_name_lower)):
                distance_km = geodesic(
                    (poi["lat"], poi["lng"]),
                    (seen_poi["lat"], seen_poi["lng"])
                ).kilometers
                
                if distance_km < 0.1:  # 100m per nomi simili
                    is_duplicate = True
                    duplicates_count += 1
                    break
        
        if not is_duplicate:
            seen_pois.append(poi)
            filtered_pois.append(poi)
    
    # ✅ FIX MarinePOI: Deduplica anche con POIDeduplicator per sicurezza (soglia 50m)
    deduplicator = POIDeduplicator(distance_threshold=50)  # 50m per POI marini (più rigoroso)
    unique_pois = deduplicator.deduplicate(filtered_pois)
    
    if len(filtered_pois) != len(unique_pois):
        duplicates_count += len(filtered_pois) - len(unique_pois)
    
    # ✅ FIX MarineType: Assicura che tutti i POI marini abbiano type="marine" per compatibilità con _organize_final_results
    for poi in unique_pois:
        if not poi.get("type") or poi.get("type") not in ["marine", "land"]:
            # Se type è "wreck" o altro valore, imposta a "marine"
            poi["type"] = "marine"
        # Assicura anche che marine_type sia presente
        if not poi.get("marine_type"):
            poi["marine_type"] = poi.get("type", "wreck")  # Fallback a "wreck" se type era "wreck"
    
    # ✅ FIX MarineDebug: Log di debug prima del return
    logger.logger.info(f"[DEBUG] Returning {len(unique_pois)} marine POIs for zone {zone_name}")
    if len(unique_pois) > 0:
        logger.logger.debug(f"[DEBUG] Sample POI types: {[poi.get('type', 'unknown') for poi in unique_pois[:3]]}")
    
    # ✅ FIX MarineAudit: Log finale con formato richiesto
    logger.logger.info(f"[POI-MARINE] 🌊 Search completed — {zone_name}: {len(unique_pois)} valid POI, {duplicates_count} removed, {skipped_count} out of zone")
    
    return unique_pois

async def _search_semantic_sources(zone_name: str,
                                  bbox: Tuple[float, float, float, float],
                                  polygon: List[List[float]],
                                  mode: str = "standard") -> List[Dict]:
    """✅ FIX MarineDivingCenter: Ricerca POI subacquei SOLO da Web Search (diving center e centri di immersione)
    Fonti: SOLO Web Search (diving center e centri di immersione) - ESCLUSO Wikipedia, Wikidata, DBpedia
    Logica: Cerca diving center per municipio → Analizza massimo 3 siti → Estrae relitti specifici → Rielabora descrizioni con AI
    """
    pois = []
    
    try:
        from .web_search import MarineWebSearcher
        from .geo_municipal import discover_zone_municipalities
        
        # ✅ FIX MarineWreckFinder: Scopri municipi della zona per ricerche più efficaci (con gestione errori migliorata)
        municipalities = []
        try:
            logger.logger.info(f"[POI-MARINE] 🔍 Scoperta municipi per zona '{zone_name}'...")
            # ✅ FIX MarineWreckFinder: Ordine corretto parametri (polygon, zone_name) - non (bbox, polygon)
            municipalities_data = await discover_zone_municipalities(polygon, zone_name)
            
            # ✅ FIX MarineWreckFinder: Gestione robusta dei dati municipi (evita errori float/list)
            if not isinstance(municipalities_data, list):
                logger.logger.warning(f"[POI-MARINE] ⚠️ municipalities_data non è una lista: {type(municipalities_data)} - uso lista vuota")
                municipalities_data = []
            
            for m in municipalities_data:
                try:
                    # ✅ FIX MarineWreckFinder: Verifica che m sia un dict
                    if not isinstance(m, dict):
                        logger.logger.debug(f"[POI-MARINE] ⚠️ Municipio non è un dict: {type(m)} - continuo")
                        continue
                    
                    # ✅ FIX MarineWreckFinder: Estrai name con gestione robusta
                    m_name = m.get("name", "")
                    
                    # ✅ FIX MarineWreckFinder: Se name è una lista, prendi il primo elemento
                    if isinstance(m_name, list):
                        if len(m_name) > 0:
                            m_name = m_name[0]
                        else:
                            m_name = ""
                    
                    # ✅ FIX MarineWreckFinder: Se name è ancora non una stringa, prova a convertirlo
                    if not isinstance(m_name, str):
                        m_name = str(m_name) if m_name else ""
                    
                    # ✅ FIX MarineSemantic: Verifica che name sia una stringa valida
                    if m_name and isinstance(m_name, str) and len(m_name.strip()) > 0:
                        m_name = m_name.strip()
                        municipalities.append(m_name)  # Aggiungi tutti i municipi, il filtro sarà applicato in MarineSemanticContext
                    else:
                        logger.logger.debug(f"[POI-MARINE] ⚠️ Nome municipio non valido: '{m_name}' (type: {type(m_name)}) - continuo")
                        continue
                        
                except (AttributeError, TypeError, KeyError, IndexError) as e:
                    logger.logger.debug(f"[POI-MARINE] ⚠️ Errore processamento municipio: {str(e)} (type: {type(m)}) - continuo")
                    continue
            
            if municipalities:
                logger.logger.info(f"[POI-MARINE] ✅ Trovati {len(municipalities)} municipi: {', '.join(municipalities[:5])}{'...' if len(municipalities) > 5 else ''}")
            else:
                logger.logger.warning(f"[POI-MARINE] ⚠️ Nessun municipio trovato per zona '{zone_name}' - cercherò a livello di zona")
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE] ⚠️ Errore scoperta municipi: {str(e)} - continuo senza municipi (cercherò a livello di zona)")
            import traceback
            logger.logger.debug(f"[POI-MARINE] Traceback: {traceback.format_exc()}")
        
        # ✅ FIX MarineDivingCenter: Ricerca SOLO Web (diving center e centri di immersione) - ESCLUSO Wikipedia, Wikidata, DBpedia
        logger.logger.info(f"[POI-MARINE] 🔍 Ricerca web SOLO per zona '{zone_name}' (ESCLUSO Wikipedia, Wikidata, DBpedia - solo diving center)...")
        web_searcher = MarineWebSearcher(mode=mode)
        web_results = await web_searcher.search_marine_wrecks(zone_name, bbox, polygon, municipalities)
        logger.logger.info(f"[POI-MARINE] ✅ Web Search: trovati {len(web_results)} POI da diving center")
        # ✅ FIX MarinePOI: I POI da Web Search sono già filtrati (in area)
        pois = web_results  # Usa direttamente i risultati (già filtrati)
        logger.logger.info(f"[POI-MARINE] ✅ Web Search: {len(pois)} POI da processare in deep_marine_search()")
        
        logger.logger.info(f"[POI-MARINE] ✅ Ricerca web completata: {len(pois)} POI totali")
        
    except Exception as e:
        logger.log_error("Semantic Sources Search", str(e), zone_name)
    
    return pois

# ✅ FIX MarineAudit: Funzioni obsolete rimosse (_search_overpass_marine, _semantic_fallback_search)
# La ricerca marina usa SOLO fonti semantiche (Wikipedia, Wikidata, DBpedia)

def _is_underwater_poi(poi: Dict) -> bool:
    """✅ FIX MarineDeep: Verifica se un POI è realmente subacqueo (escludi fari, porti, marine, spiagge)"""
    name = (poi.get("name", "") or "").lower()
    description = (poi.get("description", "") or "").lower()
    marine_type = poi.get("marine_type", "").lower()
    text = f"{name} {description} {marine_type}"
    
    # ✅ FIX MarineDeep: Escludi elementi di superficie
    surface_keywords = [
        "porto", "port", "harbour", "harbor", "marina",
        "faro", "lighthouse", "phare", "far",
        "spiaggia", "beach", "plage",
        "baia", "bay", "baie",
        "isola", "island", "île",
        "città", "city", "ville", "town",
        "costa", "coast", "coastline", "côte",
        "capo", "cape", "cap"
    ]
    
    if any(keyword in text for keyword in surface_keywords):
        return False
    
    # ✅ FIX MarineDeep: Verifica che sia un POI subacqueo valido
    underwater_keywords = [
        "wreck", "relitto", "shipwreck", "naufragio",
        "reef", "secca", "shoal", "banco", "scoglio sommerso",
        "underwater", "submerged", "subacqueo",
        "diving", "immersion", "scuba"
    ]
    
    if any(keyword in text for keyword in underwater_keywords):
        return True
    
    # ✅ FIX MarineDeep: Verifica marine_type
    if marine_type in ["wreck", "reef", "shoal", "obstruction", "diving_site", "cave"]:
        return True
    
    return False

# ✅ FIX MarineAudit: Funzione _validate_marine_poi() rimossa - ridondante
# I filtri sono già applicati direttamente in deep_marine_search() durante il loop

# Funzioni utility per uso esterno
async def explore_marine_area(zone_name: str,
                            bbox: Tuple[float, float, float, float], 
                            polygon: List[List[float]],
                            mode: str = "standard") -> Dict:
    """✅ FIX MarineAudit: Esplora completamente un'area marina usando SOLO fonti semantiche
    Fonti: Wikipedia, Wikidata, DBpedia (nessun fallback OSM)
    """
    
    # Estendi bounding box per area marina
    marine_bbox = MarineAreaDetector.calculate_marine_extension(polygon)
    
    # ✅ FIX MarineAudit: Usa deep_marine_search per ricerca SOLO da fonti semantiche
    marine_pois = await deep_marine_search(zone_name, marine_bbox, polygon, mode=mode)
    
    # ✅ FIX MarineType: Assicura che tutti i POI abbiano type="marine" dopo deep_marine_search
    for poi in marine_pois:
        if not poi.get("type") or poi.get("type") not in ["marine", "land"]:
            poi["type"] = "marine"
    
    # Aggiungi info accessibilità
    marine_pois = DepthAnalyzer.add_accessibility_info(marine_pois)
    
    # ✅ FIX MarineType: Assicura nuovamente dopo add_accessibility_info (potrebbe modificare i POI)
    for poi in marine_pois:
        if poi.get("marine_type") or poi.get("type") in ["wreck", "marine"]:
            if poi.get("type") != "marine":
                poi["type"] = "marine"
    
    # Genera itinerario marino
    marine_route = MarineRouteGenerator.generate_marine_route(marine_pois)
    
    # Analisi profondità
    depth_analysis = DepthAnalyzer.categorize_by_depth(marine_pois)

    if mode == "enhanced" and not marine_pois:
        logger.logger.warning("⚠️ Enhanced mode NON attivo — fallback standard usato")
    
    return {
        "marine_pois": marine_pois,
        "marine_route": marine_route, 
        "depth_analysis": depth_analysis,
        "total_marine_pois": len(marine_pois)
    }
