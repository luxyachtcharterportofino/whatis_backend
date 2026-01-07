import logging
import json
import hashlib
import asyncio  # ✅ FIX: Import aggiunto per retry in detect_country_from_polygon
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from geopy.distance import geodesic
from shapely.geometry import Point, Polygon
import math
import aiohttp

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/semantic_engine.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class POIDeduplicator:
    """Gestisce la deduplicazione dei POI basata su distanza geografica e similarità del nome"""
    
    def __init__(self, distance_threshold=50):  # metri
        self.distance_threshold = distance_threshold
    
    def calculate_distance(self, poi1: Dict, poi2: Dict) -> float:
        """Calcola la distanza in metri tra due POI"""
        point1 = (poi1['lat'], poi1['lng'])
        point2 = (poi2['lat'], poi2['lng'])
        return geodesic(point1, point2).meters
    
    def name_similarity(self, name1: str, name2: str) -> float:
        """Calcola similarità tra nomi (0-1)"""
        name1 = name1.lower().strip()
        name2 = name2.lower().strip()
        
        if name1 == name2:
            return 1.0
        
        # Check if one name contains the other
        if name1 in name2 or name2 in name1:
            return 0.8
        
        # Simple word overlap
        words1 = set(name1.split())
        words2 = set(name2.split())
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        if len(union) == 0:
            return 0.0
        
        return len(intersection) / len(union)
    
    def deduplicate(self, pois: List[Dict]) -> List[Dict]:
        """Deduplica lista di POI"""
        if not pois:
            return []
        
        unique_pois = []
        
        for poi in pois:
            is_duplicate = False
            
            for existing_poi in unique_pois:
                distance = self.calculate_distance(poi, existing_poi)
                similarity = self.name_similarity(poi['name'], existing_poi['name'])
                
                # Se sono vicini e hanno nomi simili, è un duplicato
                if distance < self.distance_threshold and similarity > 0.6:
                    is_duplicate = True
                    
                    # Mantieni quello con più informazioni o dalla fonte migliore
                    if self._is_better_poi(poi, existing_poi):
                        # Sostituisci il POI esistente
                        index = unique_pois.index(existing_poi)
                        unique_pois[index] = poi
                    
                    break
            
            if not is_duplicate:
                unique_pois.append(poi)
        
        logger.info(f"Deduplicated {len(pois)} POIs to {len(unique_pois)}")
        return unique_pois
    
    def _is_better_poi(self, poi1: Dict, poi2: Dict) -> bool:
        """Determina quale POI è migliore"""
        # Priorità delle fonti
        source_priority = {'Wikipedia': 3, 'Wikidata': 2, 'OSM': 1}
        
        priority1 = source_priority.get(poi1.get('source', ''), 0)
        priority2 = source_priority.get(poi2.get('source', ''), 0)
        
        if priority1 != priority2:
            return priority1 > priority2
        
        # Se stessa fonte, preferisci quello con più informazioni
        info1 = len(poi1.get('description', ''))
        info2 = len(poi2.get('description', ''))
        
        return info1 > info2

class GeoBoundingBox:
    """Gestisce il calcolo e l'estensione dei bounding box"""
    
    @staticmethod
    def from_polygon(polygon: List[List[float]]) -> Tuple[float, float, float, float]:
        """Calcola bounding box da poligono [lat, lng]"""
        lats = [point[0] for point in polygon]
        lngs = [point[1] for point in polygon]
        
        return (
            min(lats),  # south
            min(lngs),  # west
            max(lats),  # north
            max(lngs)   # east
        )
    
    @staticmethod
    def extend_marine(bbox: Tuple[float, float, float, float], 
                     polygon: List[List[float]], 
                     extension_km: float = 5.0) -> Tuple[float, float, float, float]:
        """Estende il bounding box verso il mare se la zona tocca la costa"""
        south, west, north, east = bbox
        
        # Controlla se la zona tocca potenzialmente il mare
        # (per il Mar Ligure, se tocca sud/ovest)
        if GeoBoundingBox._touches_sea(polygon):
            # Estendi verso il mare (circa 5km)
            km_to_deg_lat = 1 / 111.0  # 1 grado lat ≈ 111 km
            km_to_deg_lng = 1 / (111.0 * math.cos(math.radians((north + south) / 2)))
            
            extension_lat = extension_km * km_to_deg_lat
            extension_lng = extension_km * km_to_deg_lng
            
            # Estendi il bounding box
            return (
                south - extension_lat,  # più a sud
                west - extension_lng,   # più a ovest  
                north,
                east
            )
        
        return bbox
    
    @staticmethod
    def _touches_sea(polygon: List[List[float]]) -> bool:
        """Determina se il poligono tocca il mare (semplificato per Mar Ligure)"""
        # Per ora, controllo semplice: se qualche punto è vicino alla costa ligure
        for point in polygon:
            lat, lng = point[0], point[1]
            # Zona approssimativa Mar Ligure
            if 43.5 <= lat <= 44.5 and 8.0 <= lng <= 10.0:
                return True
        return False

class POIValidator:
    """Valida e filtra i POI per rilevanza turistica"""
    
    # Parole chiave che indicano rilevanza turistica
    TOURIST_KEYWORDS = [
        'museo', 'church', 'castello', 'torre', 'palazzo', 'villa', 'giardino',
        'parco', 'spiaggia', 'porto', 'faro', 'monastero', 'chiesa', 'cathedral',
        'monument', 'archaeological', 'historic', 'fortress', 'abbey', 'sanctuary',
        'viewpoint', 'panorama', 'belvedere', 'acquario', 'zoo', 'theatre',
        'teatro', 'cinema', 'gallery', 'galleria', 'library', 'biblioteca'
    ]
    
    # Parole chiave per POI marittimi
    MARINE_KEYWORDS = [
        'relitto', 'wreck', 'shipwreck', 'faro', 'lighthouse', 'boa', 'buoy',
        'secca', 'reef', 'shoal', 'immersion', 'diving', 'subacqueo', 'underwater'
    ]
    
    @staticmethod
    def is_tourist_relevant(poi: Dict) -> bool:
        """Determina se un POI è turisticamente rilevante"""
        name = poi.get('name', '').lower()
        description = poi.get('description', '').lower()
        poi_type = poi.get('type', '').lower()
        
        text_to_check = f"{name} {description} {poi_type}"
        
        # Check per POI marittimi
        if poi.get('type') == 'marine':
            return any(keyword in text_to_check for keyword in POIValidator.MARINE_KEYWORDS)
        
        # Check per POI terrestri
        return any(keyword in text_to_check for keyword in POIValidator.TOURIST_KEYWORDS)
    
    @staticmethod
    def calculate_relevance_score(poi: Dict) -> float:
        """Calcola un punteggio di rilevanza 1-5"""
        score = 1.0
        
        name = poi.get('name', '').lower()
        description = poi.get('description', '').lower()
        source = poi.get('source', '')
        
        # Bonus per fonte affidabile
        source_bonus = {'Wikipedia': 1.5, 'Wikidata': 1.2, 'OSM': 1.0}
        score *= source_bonus.get(source, 1.0)
        
        # Bonus per descrizione dettagliata
        if len(description) > 100:
            score += 0.8
        elif len(description) > 50:
            score += 0.4
        
        # Bonus per parole chiave importanti
        important_keywords = ['unesco', 'world heritage', 'national', 'famous', 'historic']
        for keyword in important_keywords:
            if keyword in description:
                score += 0.3
        
        return min(score, 5.0)

class SemanticLogger:
    """Logger specializzato per il semantic engine"""
    # ✅ FIX: Logging ridotto - 1 riga ogni 30 secondi
    _last_log_time = {}
    _log_interval = 30  # secondi
    
    def __init__(self):
        self.logger = logger
    
    def _should_log(self, key: str) -> bool:
        """✅ FIX: Verifica se deve loggare (max 1 volta ogni 30 secondi)"""
        import time
        now = time.time()
        if key not in self._last_log_time or (now - self._last_log_time[key]) >= self._log_interval:
            self._last_log_time[key] = now
            return True
        return False
    
    def log_search_request(self, zone_name: str, polygon: List, extend_marine: bool):
        """Log richiesta di ricerca - ✅ FIX: Logging ridotto"""
        if self._should_log(f"search_request_{zone_name}"):
            self.logger.info(f"SEARCH REQUEST - Zone: {zone_name}, Points: {len(polygon)}, Marine: {extend_marine}")
    
    def log_search_results(self, zone_name: str, total_pois: int, municipalities: int):
        """Log risultati ricerca - ✅ FIX: Logging ridotto"""
        if self._should_log(f"search_results_{zone_name}"):
            self.logger.info(f"SEARCH RESULTS - Zone: {zone_name}, POIs: {total_pois}, Municipalities: {municipalities}")
    
    def log_error(self, operation: str, error: str, zone_name: str = ""):
        """Log errore - ✅ FIX: Sempre loggato (errori importanti)"""
        # ✅ FIX: Errori sempre loggati (non throttlati)
        self.logger.error(f"ERROR - Operation: {operation}, Zone: {zone_name}, Error: {error}")
    
    def log_municipality_discovery(self, zone_name: str, municipalities: List[str]):
        """Log scoperta municipi - ✅ FIX: Logging ridotto"""
        if self._should_log(f"municipality_discovery_{zone_name}"):
            self.logger.info(f"MUNICIPALITY DISCOVERY - Zone: {zone_name}, Found: {municipalities}")

def point_in_polygon(point: Tuple[float, float], polygon: List[List[float]]) -> bool:
    """Controlla se un punto è dentro un poligono"""
    try:
        shapely_point = Point(point[1], point[0])  # lng, lat for Shapely
        shapely_polygon = Polygon([(p[1], p[0]) for p in polygon])  # lng, lat
        return shapely_polygon.contains(shapely_point)
    except Exception as e:
        logger.error(f"Error in point_in_polygon: {e}")
        return False

def is_in_zone(lat: float, lng: float, polygon: List[List[float]]) -> bool:
    """✅ FIX MarineDeep: Verifica se un punto è dentro al poligono della zona (usa shapely)
    Alias di point_in_polygon per chiarezza semantica
    """
    return point_in_polygon((lat, lng), polygon)

# ✅ FIX MarineDeep: Validazione geografica "solo mare"
async def is_in_water(lat: float, lng: float) -> bool:
    """✅ FIX MarineDeep: Verifica se un punto è effettivamente nel mare usando reverse geocoding
    Restituisce True se il punto è nel mare, False se è su terraferma
    """
    try:
        # Usa Nominatim reverse geocoding per verificare se è nel mare
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lng}&zoom=10&addressdetails=1"
        headers = {
            "User-Agent": "whatis-backend-semantic/1.0 (marine-validation)"
        }
        
        timeout = aiohttp.ClientTimeout(total=3)
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    # Se fallisce, assume che sia nel mare (non blocca)
                    return True
                
                data = await resp.json()
                addr = (data or {}).get("address", {})
                
                # ✅ FIX MarineDeep: Verifica se è su terraferma
                place_type = addr.get("place_type", "").lower()
                place_class = addr.get("class", "").lower()
                
                # Escludi se è chiaramente su terraferma
                land_indicators = [
                    "city", "town", "village", "hamlet", "suburb", "neighbourhood",
                    "road", "building", "house", "farm", "residential"
                ]
                
                if place_type in land_indicators or place_class in land_indicators:
                    return False
                
                # Se non ha indicatori di terraferma, assume che sia nel mare
                return True
                
    except Exception as e:
        # Se fallisce, assume che sia nel mare (non blocca la ricerca)
        logger.warning(f"[POI-MARINE] ⚠️ Water validation failed for ({lat}, {lng}): {e} - assuming water")
        return True

def generate_cache_key(zone_name: str, polygon: List) -> str:
    """Genera chiave cache univoca per una zona"""
    polygon_str = json.dumps(polygon, sort_keys=True)
    content = f"{zone_name}_{polygon_str}"
    return hashlib.md5(content.encode()).hexdigest()

# ================================
# 🌍 GEO HELPERS (Country detection)
# ================================

async def detect_country_from_polygon(polygon: List[List[float]]) -> Tuple[str, str]:
    """Detect country_code and country_name using Nominatim from polygon centroid.
    Returns: (country_code_upper, country_name) or (None, None) on failure as fallback.
    ✅ FIX MarineUniversal: Retry robusto con timeout=3s, max_retries=2, fallback a None se vuoto (universale)
    """
    try:
        if not polygon:
            return None, None  # ✅ FIX MarineUniversal: Fallback a None se vuoto (non hardcoded IT)
        
        # Compute centroid (simple average; sufficient for small zones)
        lat = sum(p[0] for p in polygon) / len(polygon)
        lng = sum(p[1] for p in polygon) / len(polygon)
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lng}&zoom=3&addressdetails=1"
        headers = {
            "User-Agent": "whatis-backend-semantic/1.0 (country-detect)"
        }
        
        # ✅ FIX MarineUniversal: Timeout aumentato a 3s con retry robusto
        max_retries = 2
        retry_delay = 1.0
        
        for attempt in range(max_retries):
            try:
                timeout = aiohttp.ClientTimeout(total=3)  # ✅ FIX MarineUniversal: 3s timeout
                async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                    async with session.get(url) as resp:
                        if resp.status != 200:
                            if attempt < max_retries - 1:
                                await asyncio.sleep(retry_delay)
                                continue
                            return None, None  # ✅ FIX MarineUniversal: Fallback a None (non hardcoded IT)
                        data = await resp.json()
                        addr = (data or {}).get("address", {})
                        code = (addr.get("country_code") or "").upper()
                        name = addr.get("country") or ""
                        
                        # ✅ FIX MarineUniversal: Se codice vuoto, fallback a None (non hardcoded IT)
                        if not code:
                            return None, None
                        
                        return code, name
            except (asyncio.TimeoutError, aiohttp.ClientError) as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    continue
                # ✅ FIX MarineUniversal: Log come warning, non error, e fallback silenzioso
                logger.warning(f"Country detection failed (attempt {attempt + 1}/{max_retries}): {e}")
                return None, None  # ✅ FIX MarineUniversal: Fallback a None (non hardcoded IT)
            except Exception as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    continue
                logger.warning(f"Country detection error: {e}")  # ✅ FIX MarineUniversal: Warning, non error
                return None, None  # ✅ FIX MarineUniversal: Fallback a None (non hardcoded IT)
        
        return None, None  # ✅ FIX MarineUniversal: Fallback finale (non hardcoded IT)
    except Exception as e:
        logger.warning(f"Country detection failed: {e}")  # ✅ FIX MarineUniversal: Warning, non error
        return None, None  # ✅ FIX MarineUniversal: Fallback a None se vuoto (non hardcoded IT)
