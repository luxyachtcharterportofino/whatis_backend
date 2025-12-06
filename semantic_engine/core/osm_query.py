import requests
import asyncio
import aiohttp
import json
from typing import List, Dict, Any, Tuple, Optional
from .utils import SemanticLogger, POIValidator

logger = SemanticLogger()

class OverpassQueryBuilder:
    """Costruisce query Overpass API per diversi tipi di POI"""
    
    def __init__(self):
        self.base_url = "https://overpass-api.de/api/interpreter"
        self.timeout = 60  # Aumentato a 60 secondi per query complesse
    
    def build_tourist_query(self, bbox: Tuple[float, float, float, float]) -> str:
        """Costruisce query per POI turistici terrestri"""
        south, west, north, east = bbox
        
        query = f"""
        [out:json][timeout:50];
        (
          // Monumenti e attrazioni
          node["tourism"~"^(attraction|museum|castle|monument|viewpoint|archaeological_site)$"]({south},{west},{north},{east});
          way["tourism"~"^(attraction|museum|castle|monument|viewpoint|archaeological_site)$"]({south},{west},{north},{east});
          
          // Edifici religiosi
          node["amenity"="place_of_worship"]({south},{west},{north},{east});
          way["amenity"="place_of_worship"]({south},{west},{north},{east});
          node["building"="church"]({south},{west},{north},{east});
          way["building"="church"]({south},{west},{north},{east});
          
          // Edifici storici
          node["historic"~"^(castle|fortress|monument|archaeological_site|ruins|palace|manor)$"]({south},{west},{north},{east});
          way["historic"~"^(castle|fortress|monument|archaeological_site|ruins|palace|manor)$"]({south},{west},{north},{east});
          
          // Parchi e giardini
          node["leisure"~"^(park|garden|nature_reserve)$"]({south},{west},{north},{east});
          way["leisure"~"^(park|garden|nature_reserve)$"]({south},{west},{north},{east});
          
          // Musei e cultura
          node["amenity"~"^(library|theatre|cinema|arts_centre)$"]({south},{west},{north},{east});
          way["amenity"~"^(library|theatre|cinema|arts_centre)$"]({south},{west},{north},{east});
          
          // Punti panoramici naturali
          node["natural"~"^(peak|cliff|beach|cape)$"]({south},{west},{north},{east});
          way["natural"~"^(peak|cliff|beach|cape)$"]({south},{west},{north},{east});
        );
        out geom;
        """
        return query
    
    def build_marine_query(self, bbox: Tuple[float, float, float, float]) -> str:
        """✅ FIX MarineDeep: Costruisce query per SOLO POI subacquei (relitti, reef, shoal, ostacoli sommersi)
        Esclude rigorosamente: porti, fari, marine, baie, isole, città, coste
        """
        south, west, north, east = bbox
        
        query = f"""
        [out:json][timeout:50];
        (
          // ✅ FIX MarineDeep: SOLO RELITTI subacquei
          node["historic"="wreck"]({south},{west},{north},{east});
          way["historic"="wreck"]({south},{west},{north},{east});
          node["seamark:type"="wreck"]({south},{west},{north},{east});
          node["seamark:wreck:category"]({south},{west},{north},{east});
          node["wreck"]({south},{west},{north},{east});
          node["site_type"="wreck"]({south},{west},{north},{east});
          node["name"~"^(relitto|wreck|shipwreck|naufragio)"]({south},{west},{north},{east});
          way["name"~"^(relitto|wreck|shipwreck|naufragio)"]({south},{west},{north},{east});
          
          // ✅ FIX MarineDeep: SOLO REEF e SHOAL sommersi
          node["natural"="reef"]({south},{west},{north},{east});
          way["natural"="reef"]({south},{west},{north},{east});
          node["natural"="shoal"]({south},{west},{north},{east});
          way["natural"="shoal"]({south},{west},{north},{east});
          node["natural"="bank"]({south},{west},{north},{east});
          way["natural"="bank"]({south},{west},{north},{east});
          
          // ✅ FIX MarineDeep: SOLO OSTACOLI SOMMERSI
          node["seamark:type"="obstruction"]({south},{west},{north},{east});
          way["seamark:type"="obstruction"]({south},{west},{north},{east});
          node["seamark:obstruction:category"]({south},{west},{north},{east});
          node["underwater"="yes"]({south},{west},{north},{east});
          way["underwater"="yes"]({south},{west},{north},{east});
          
          // ✅ FIX MarineDeep: SOLO SITI IMMERSIONE SUBACQUEI
          node["sport"="diving"]({south},{west},{north},{east});
          way["sport"="diving"]({south},{west},{north},{east});
          node["leisure"="diving"]({south},{west},{north},{east});
          node["scuba_diving"="yes"]({south},{west},{north},{east});
          node["diving_site"="yes"]({south},{west},{north},{east});
          node["seamark:type"="diving"]({south},{west},{north},{east});
          
          // ✅ FIX MarineDeep: GROTTE SUBACQUEE
          node["natural"="cave"]({south},{west},{north},{east});
          way["natural"="cave"]({south},{west},{north},{east});
          node["submarine_cave"="yes"]({south},{west},{north},{east});
          
          // ✅ FIX MarineDeep: Relitti con nome specifico (solo se subacqueo)
          node["name"~"^(relitto|wreck|shipwreck|naufragio|secca|reef|shoal|scoglio.*sommerso)"]({south},{west},{north},{east});
          way["name"~"^(relitto|wreck|shipwreck|naufragio|secca|reef|shoal|scoglio.*sommerso)"]({south},{west},{north},{east});
        );
        out body;
        """
        return query
    
    def build_municipality_query(self, bbox: Tuple[float, float, float, float]) -> str:
        """Costruisce query per comuni e frazioni"""
        south, west, north, east = bbox
        
        query = f"""
        [out:json][timeout:50];
        (
          // Comuni
          rel["admin_level"="8"]["place"~"^(city|town|village)$"]({south},{west},{north},{east});
          node["place"~"^(city|town|village)$"]({south},{west},{north},{east});
          
          // Frazioni e località
          node["place"~"^(hamlet|suburb|neighbourhood|locality)$"]({south},{west},{north},{east});
          
          // Boundaries amministrativi
          rel["admin_level"~"^(8|9|10)$"]({south},{west},{north},{east});
        );
        out geom;
        """
        return query

class OSMDataExtractor:
    """Estrae e processa dati da OpenStreetMap"""
    
    def __init__(self):
        self.query_builder = OverpassQueryBuilder()
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def execute_query(self, query: str) -> Dict:
        """Esegue una query Overpass API - ✅ FIX: Try/except robusto su chiamate HTTP"""
        try:
            async with self.session.post(
                self.query_builder.base_url,
                data=query,
                timeout=aiohttp.ClientTimeout(total=90)  # Aumentato timeout per richieste lente
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    # ✅ FIX: Log come warning, non error, e continua
                    logger.logger.warning(f"OSM Query HTTP {response.status} - continua senza bloccare")
                    return {"elements": []}
        except (asyncio.TimeoutError, aiohttp.ClientError) as e:
            # ✅ FIX: Log come warning, non error, e continua senza bloccare
            logger.logger.warning(f"OSM Query timeout/connection error: {e} - continua senza bloccare")
            return {"elements": []}
        except Exception as e:
            # ✅ FIX: Log come warning, non error, e continua senza bloccare
            logger.logger.warning(f"OSM Query error: {e} - continua senza bloccare")
            return {"elements": []}
    
    def extract_poi_data(self, osm_data: Dict, poi_type: str = "land") -> List[Dict]:
        """Estrae dati POI dai risultati OSM"""
        pois = []
        
        for element in osm_data.get("elements", []):
            try:
                poi = self._process_osm_element(element, poi_type)
                if poi and POIValidator.is_tourist_relevant(poi):
                    pois.append(poi)
            except Exception as e:
                logger.log_error("POI Extraction", str(e), "")
                continue
        
        return pois
    
    def _is_surface_element(self, tags: Dict, name: str, description: str = "") -> bool:
        """✅ FIX MarineDeep: Verifica se un elemento è di superficie (porto, faro, marina, baia, isola, città)
        Restituisce True se è di superficie → deve essere escluso dalla ricerca marina
        """
        text = (name + " " + description).lower()
        
        # ✅ FIX MarineDeep: Tag OSM che indicano elementi di superficie (ESTESO)
        surface_tags = [
            "port", "harbour", "harbor", "marina", "lighthouse", "beacon",
            "beach", "bay", "coastline", "coast", "city", "town", "village",
            "island", "islet", "place", "promontory", "peninsula"
        ]
        
        for tag_key in tags:
            tag_value = str(tags[tag_key]).lower()
            if any(surface in tag_value for surface in surface_tags):
                return True
        
        # ✅ FIX MarineDeep: Parole chiave nel nome/descrizione che indicano superficie (ESTESO)
        surface_keywords = [
            "porto", "port", "harbour", "harbor", "marina",
            "faro", "lighthouse", "phare", "far",
            "spiaggia", "beach", "plage",
            "baia", "bay", "baie",
            "isola", "island", "île",
            "città", "city", "ville", "town",
            "costa", "coast", "coastline", "côte",
            "capo", "cape", "cap",
            "promontory", "promontorio", "promontòire",
            "peninsula", "penisola", "péninsule"
        ]
        
        return any(keyword in text for keyword in surface_keywords)
    
    def _is_irrelevant_wreck(self, name: str, description: str = "") -> bool:
        """✅ FIX MarineDeep: Verifica se un relitto ha un nome che indica chiaramente un relitto noto di altra località"""
        text = (name + " " + description).lower()
        
        # Escludi solo relitti con nomi noti che indicano chiaramente altre località
        # Esempio: Moskva è notoriamente nel Mar Nero, non può apparire in altre zone
        irrelevant_keywords = [
            "moskva", "moscova", "moscow", "москва",  # Relitto noto nel Mar Nero
            # Altri relitti noti di altre zone possono essere aggiunti qui se necessario
        ]
        
        return any(keyword in text for keyword in irrelevant_keywords)
    
    def _process_osm_element(self, element: Dict, poi_type: str) -> Optional[Dict]:
        """Processa un singolo elemento OSM - Universale per qualsiasi zona"""
        # Ottieni coordinate
        lat, lng = self._get_coordinates(element)
        if not lat or not lng:
            return None
        
        # NOTA: Non facciamo controllo geografico hardcoded - ogni zona può essere in qualsiasi parte del mondo
        # Il filtro geografico viene fatto a livello superiore usando il poligono della zona
        
        # Ottieni nome
        tags = element.get("tags", {})
        name = self._get_name(tags)
        if not name:
            return None
        
        # Costruisci POI
        poi = {
            "name": name,
            "lat": lat,
            "lng": lng,
            "source": "OSM",
            "type": poi_type,
            "osm_id": element.get("id"),
            "osm_type": element.get("type")
        }
        
        # Aggiungi descrizione e metadati
        description = self._build_description(tags)
        if description:
            poi["description"] = description
        
        # ✅ FIX MarineDeep: Metadati specifici per POI marittimi SUBACQUEI
        if poi_type == "marine":
            # ✅ FIX MarineDeep: Filtro semantico - escludi elementi di superficie
            if self._is_surface_element(tags, name, description):
                logger.logger.debug(f"[POI-MARINE] ⚠️ Escluso elemento di superficie: {name}")
                return None
            
            self._add_marine_metadata(poi, tags)
            
            # ✅ FIX MarineDeep: Verifica se è un POI subacqueo valido
            is_wreck = (
                tags.get("historic") == "wreck" or
                tags.get("seamark:type") == "wreck" or
                tags.get("seamark:wreck:category") or
                tags.get("wreck") or
                tags.get("site_type") == "wreck"
            )
            
            is_reef_shoal = (
                tags.get("natural") in ["reef", "shoal", "bank"] or
                "reef" in name.lower() or
                "shoal" in name.lower() or
                "secca" in name.lower() or
                "scoglio sommerso" in name.lower()
            )
            
            is_underwater_obstruction = (
                tags.get("seamark:type") == "obstruction" or
                tags.get("underwater") == "yes"
            )
            
            is_diving_site = (
                tags.get("sport") == "diving" or
                tags.get("leisure") == "diving" or
                tags.get("scuba_diving") == "yes" or
                tags.get("diving_site") == "yes" or
                tags.get("seamark:type") == "diving"
            )
            
            is_submarine_cave = (
                tags.get("natural") == "cave" or
                tags.get("submarine_cave") == "yes"
            )
            
            # ✅ FIX MarineDeep: Assegna tipo marino solo se è subacqueo
            if is_wreck:
                poi["marine_type"] = "wreck"
                # Escludi solo relitti con nomi noti di altre località (es. Moskva nel Mar Nero)
                if self._is_irrelevant_wreck(name, description):
                    logger.logger.warning(f"[POI-MARINE] ⚠️ Relitto OSM irrilevante '{name}' escluso")
                    return None
            elif is_reef_shoal:
                poi["marine_type"] = "reef"
            elif is_underwater_obstruction:
                poi["marine_type"] = "obstruction"
            elif is_diving_site:
                poi["marine_type"] = "diving_site"
            elif is_submarine_cave:
                poi["marine_type"] = "cave"
            else:
                # ✅ FIX MarineDeep: Se non è un POI subacqueo valido, escludilo
                logger.logger.debug(f"[POI-MARINE] ⚠️ POI non subacqueo escluso: {name}")
                return None
        
        # Calcola relevance score
        poi["relevance_score"] = POIValidator.calculate_relevance_score(poi)
        
        return poi
    
    def _get_coordinates(self, element: Dict) -> Tuple[Optional[float], Optional[float]]:
        """Ottieni coordinate da elemento OSM"""
        if element.get("type") == "node":
            return element.get("lat"), element.get("lon")
        elif element.get("type") == "way" and "center" in element:
            center = element["center"]
            return center.get("lat"), center.get("lon")
        elif "geometry" in element and element["geometry"]:
            # Prendi il primo punto della geometria
            first_point = element["geometry"][0]
            return first_point.get("lat"), first_point.get("lon")
        
        return None, None
    
    def _get_name(self, tags: Dict) -> Optional[str]:
        """Ottieni nome da tag OSM"""
        name_tags = ["name", "name:it", "name:en", "official_name", "short_name"]
        
        for tag in name_tags:
            if tag in tags and tags[tag].strip():
                return tags[tag].strip()
        
        # Fallback per alcuni tipi specifici
        if "tourism" in tags:
            return f"{tags['tourism'].title()} POI"
        elif "historic" in tags:
            return f"{tags['historic'].title()} Site"
        
        return None
    
    def _build_description(self, tags: Dict) -> str:
        """Costruisce descrizione da tag OSM"""
        description_parts = []
        
        # Aggiungi tipo principale
        main_type = self._get_main_type(tags)
        if main_type:
            description_parts.append(main_type)
        
        # Aggiungi descrizione specifica
        if "description" in tags:
            description_parts.append(tags["description"])
        elif "note" in tags:
            description_parts.append(tags["note"])
        
        # Aggiungi informazioni storiche
        if "start_date" in tags:
            description_parts.append(f"Built in {tags['start_date']}")
        
        # Aggiungi altezza se disponibile
        if "ele" in tags:
            try:
                elevation = float(tags["ele"])
                description_parts.append(f"Elevation: {elevation}m")
            except ValueError:
                pass
        
        return ". ".join(description_parts)
    
    def _get_main_type(self, tags: Dict) -> str:
        """Ottieni tipo principale del POI"""
        type_mappings = {
            "tourism": {
                "attraction": "Tourist attraction",
                "museum": "Museum", 
                "castle": "Castle",
                "monument": "Monument",
                "viewpoint": "Viewpoint",
                "archaeological_site": "Archaeological site"
            },
            "historic": {
                "castle": "Historic castle",
                "fortress": "Fortress",
                "monument": "Historic monument",
                "ruins": "Historic ruins",
                "palace": "Historic palace"
            },
            "amenity": {
                "place_of_worship": "Place of worship",
                "library": "Library",
                "theatre": "Theatre"
            },
            "natural": {
                "peak": "Mountain peak",
                "cliff": "Cliff",
                "beach": "Beach",
                "reef": "Reef"
            }
        }
        
        for category, values in type_mappings.items():
            if category in tags and tags[category] in values:
                return values[tags[category]]
        
        return ""
    
    def _add_marine_metadata(self, poi: Dict, tags: Dict):
        """Aggiunge metadati specifici per POI marittimi"""
        # Profondità per immersioni e relitti
        if "depth" in tags:
            try:
                poi["depth"] = float(tags["depth"])
            except ValueError:
                pass
        
        # Tipo di seamark
        if "seamark:type" in tags:
            poi["seamark_type"] = tags["seamark:type"]
        
        # Informazioni per diving
        if tags.get("sport") == "diving" or tags.get("leisure") == "diving":
            poi["diving_site"] = True
            if "diving:visibility" in tags:
                poi["visibility"] = tags["diving:visibility"]
    
    def extract_municipalities(self, osm_data: Dict, polygon: List[List[float]]) -> List[Dict]:
        """Estrae dati sui comuni dai risultati OSM"""
        municipalities = {}
        
        for element in osm_data.get("elements", []):
            try:
                municipality = self._process_municipality_element(element, polygon)
                if municipality:
                    name = municipality["name"]
                    if name not in municipalities:
                        municipalities[name] = {
                            "name": name,
                            "subdivisions": [],
                            "poi_count": 0
                        }
                    
                    if municipality.get("is_subdivision"):
                        municipalities[name]["subdivisions"].append(municipality["subdivision_name"])
            except Exception as e:
                logger.log_error("Municipality Extraction", str(e), "")
                continue
        
        return list(municipalities.values())
    
    def _process_municipality_element(self, element: Dict, polygon: List[List[float]]) -> Optional[Dict]:
        """Processa un elemento municipalità OSM"""
        tags = element.get("tags", {})
        
        # Ottieni coordinate per verificare se è nel poligono
        lat, lng = self._get_coordinates(element)
        if not lat or not lng:
            return None
        
        # Verifica se il punto è nel poligono della zona
        from .utils import point_in_polygon
        if not point_in_polygon((lat, lng), polygon):
            return None
        
        name = self._get_name(tags)
        if not name:
            return None
        
        place_type = tags.get("place", "")
        admin_level = tags.get("admin_level", "")
        
        # Determina se è un comune principale o una frazione
        is_main_municipality = place_type in ["city", "town"] or admin_level == "8"
        is_subdivision = place_type in ["hamlet", "suburb", "neighbourhood", "village"]
        
        result = {
            "name": name,
            "lat": lat,
            "lng": lng,
            "place_type": place_type,
            "admin_level": admin_level
        }
        
        if is_subdivision:
            result["is_subdivision"] = True
            result["subdivision_name"] = name
            # Cerca il comune principale più vicino
            # Per ora usiamo il nome della frazione, in futuro si può implementare la ricerca del comune parent
        
        return result

# Funzioni di utility per uso esterno
async def search_osm_pois(bbox: Tuple[float, float, float, float], 
                          include_marine: bool = False) -> List[Dict]:
    """Cerca POI su OSM data un bounding box"""
    async with OSMDataExtractor() as extractor:
        # Query per POI terrestri
        tourist_query = extractor.query_builder.build_tourist_query(bbox)
        tourist_data = await extractor.execute_query(tourist_query)
        land_pois = extractor.extract_poi_data(tourist_data, "land")
        
        all_pois = land_pois
        
        # Query per POI marittimi se richiesto
        if include_marine:
            marine_query = extractor.query_builder.build_marine_query(bbox)
            marine_data = await extractor.execute_query(marine_query)
            marine_pois = extractor.extract_poi_data(marine_data, "marine")
            all_pois.extend(marine_pois)
        
        return all_pois

async def discover_municipalities(bbox: Tuple[float, float, float, float], 
                                polygon: List[List[float]]) -> List[Dict]:
    """Scopre comuni e frazioni in una zona"""
    async with OSMDataExtractor() as extractor:
        query = extractor.query_builder.build_municipality_query(bbox)
        data = await extractor.execute_query(query)
        municipalities = extractor.extract_municipalities(data, polygon)
        
        # Log scoperta
        mun_names = [m["name"] for m in municipalities]
        logger.log_municipality_discovery("", mun_names)
        
        return municipalities
