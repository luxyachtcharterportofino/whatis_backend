import asyncio
import aiohttp
from typing import List, Dict, Any, Optional, Tuple
from geopy.geocoders import Nominatim
from .utils import SemanticLogger, point_in_polygon
from .osm_query import discover_municipalities

logger = SemanticLogger()

class MunicipalityDiscoverer:
    """Scopre e organizza comuni e frazioni in una zona geografica"""
    
    def __init__(self):
        self.geocoder = Nominatim(user_agent="whatis_semantic_engine")
        self.session = None
        
        # Database di associazioni frazione -> comune per l'area ligure
        # Può essere espanso o caricato da file esterno
        self.fraction_mappings = {
            "fezzano": "porto venere",
            "le grazie": "porto venere", 
            "marola": "porto venere",
            "cadimare": "la spezia",
            "pitelli": "la spezia",
            "muggiano": "la spezia",
            "san terenzo": "lerici",
            "tellaro": "lerici",
            "fiascherino": "lerici",
            "montemarcello": "ameglia",
            "bocca di magra": "ameglia",
            "fiumaretta": "ameglia",
            "castelnuovo magra": "castelnuovo di magra",
            "molicciara": "castelnuovo di magra",
            "palvotrisia": "castelnuovo di magra"
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def discover_municipalities_in_zone(self, 
                                            polygon: List[List[float]],
                                            zone_name: str = "") -> List[Dict]:
        """Scopre tutti i comuni e frazioni in una zona"""
        try:
            # Calcola bounding box
            from .utils import GeoBoundingBox
            bbox = GeoBoundingBox.from_polygon(polygon)
            
            # Usa OSM per scoperta iniziale
            osm_municipalities = await discover_municipalities(bbox, polygon)
            
            # Arricchisci con ricerca per geocoding
            geocoded_municipalities = await self._geocode_discovery(zone_name, polygon)
            
            # Combina e organizza risultati
            all_municipalities = self._combine_municipality_data(
                osm_municipalities, geocoded_municipalities
            )
            
            # Organizza frazioni sotto comuni principali
            organized_municipalities = self._organize_fractions(all_municipalities)
            
            # Conta POI stimati per zona
            for municipality in organized_municipalities:
                municipality["poi_count"] = await self._estimate_poi_count(
                    municipality["name"], municipality["subdivisions"]
                )
            
            logger.log_municipality_discovery(
                zone_name, 
                [m["name"] for m in organized_municipalities]
            )
            
            return organized_municipalities
            
        except Exception as e:
            logger.log_error("Municipality Discovery", str(e), zone_name)
            return []
    
    async def _geocode_discovery(self, zone_name: str, polygon: List[List[float]]) -> List[Dict]:
        """Usa geocoding per scoprire comuni nella zona"""
        municipalities = []
        
        if not zone_name:
            return municipalities
        
        try:
            # Cerca località con termini geografici
            search_terms = self._build_municipality_search_terms(zone_name)
            
            for term in search_terms:
                try:
                    # ✅ FIX: Try/except robusto su chiamate HTTP Nominatim
                    locations = self.geocoder.geocode(
                        term, 
                        exactly_one=False,
                        limit=5,
                        country_codes="IT",
                        timeout=3  # ✅ FIX: Timeout 3s
                    )
                    
                    if locations:
                        for location in locations:
                            municipality = await self._process_geocoded_location(
                                location, polygon
                            )
                            if municipality:
                                municipalities.append(municipality)
                    
                    # Rate limiting per Nominatim
                    await asyncio.sleep(1)
                    
                except (TimeoutError, ConnectionError) as e:
                    # ✅ FIX: Log come warning, non error, e continua senza bloccare
                    logger.logger.warning(f"Geocoding timeout/connection for '{term}': {e} - continua senza bloccare")
                    continue
                except Exception as e:
                    # ✅ FIX: Log come warning, non error, e continua senza bloccare
                    logger.logger.warning(f"Geocoding error for '{term}': {e} - continua senza bloccare")
                    continue
                    
        except Exception as e:
            # ✅ FIX: Log come warning, non error, e continua senza bloccare
            logger.logger.warning(f"Geocode Discovery error: {e} - continua senza bloccare")
        
        return municipalities
    
    def _build_municipality_search_terms(self, zone_name: str) -> List[str]:
        """Costruisce termini per ricerca comuni"""
        terms = []
        
        # Aggiungi il nome della zona direttamente
        terms.append(f"{zone_name}, Italy")
        
        # Se la zona contiene indicatori geografici, cerca comuni nelle vicinanze
        geographic_indicators = {
            "golfo": ["comuni golfo", "città golfo"],
            "baia": ["comuni baia", "paesi baia"],
            "costa": ["comuni costa", "località costa"],
            "riviera": ["comuni riviera", "paesi riviera"]
        }
        
        zone_lower = zone_name.lower()
        for indicator, search_patterns in geographic_indicators.items():
            if indicator in zone_lower:
                for pattern in search_patterns:
                    terms.append(f"{pattern} {zone_name}")
        
        return terms
    
    async def _process_geocoded_location(self, location, polygon: List[List[float]]) -> Optional[Dict]:
        """Processa una location da geocoding"""
        try:
            lat, lng = location.latitude, location.longitude
            
            # Verifica se è nel poligono
            if not point_in_polygon((lat, lng), polygon):
                return None
            
            # Estrai informazioni amministrative
            address = location.raw.get('address', {})
            display_name = location.address
            
            # Determina nome e tipo del luogo
            place_name = self._extract_place_name(address, display_name)
            place_type = self._determine_place_type(address)
            
            if place_name:
                return {
                    "name": place_name,
                    "lat": lat,
                    "lng": lng,
                    "place_type": place_type,
                    "source": "geocoding",
                    "full_address": display_name
                }
                
        except Exception as e:
            logger.log_error("Geocoded Location Processing", str(e), "")
        
        return None
    
    def _extract_place_name(self, address: Dict, display_name: str) -> Optional[str]:
        """Estrae nome del luogo da dati geocoding"""
        # Priorità per tipi di luoghi
        name_fields = [
            'city', 'town', 'village', 'hamlet', 
            'suburb', 'neighbourhood', 'municipality'
        ]
        
        for field in name_fields:
            if field in address and address[field]:
                return address[field]
        
        # Fallback: prendi primo elemento che non sia provincia/regione
        parts = display_name.split(',')
        if parts:
            return parts[0].strip()
        
        return None
    
    def _determine_place_type(self, address: Dict) -> str:
        """Determina il tipo di luogo"""
        if 'city' in address:
            return 'city'
        elif 'town' in address:
            return 'town'  
        elif 'village' in address:
            return 'village'
        elif 'hamlet' in address:
            return 'hamlet'
        elif 'suburb' in address or 'neighbourhood' in address:
            return 'subdivision'
        else:
            return 'locality'
    
    def _combine_municipality_data(self, osm_data: List[Dict], geocoded_data: List[Dict]) -> List[Dict]:
        """Combina dati OSM e geocoding, rimuovendo duplicati"""
        combined = []
        seen_names = set()
        
        # Prima aggiungi dati OSM (più affidabili)
        for municipality in osm_data:
            name = municipality["name"].lower().strip()
            if name not in seen_names:
                seen_names.add(name)
                combined.append(municipality)
        
        # Poi aggiungi dati geocoding non duplicati
        for municipality in geocoded_data:
            name = municipality["name"].lower().strip()
            if name not in seen_names:
                seen_names.add(name)
                combined.append(municipality)
        
        return combined
    
    def _organize_fractions(self, municipalities: List[Dict]) -> List[Dict]:
        """Organizza frazioni sotto comuni principali"""
        main_municipalities = {}
        fractions = []
        
        # Separa comuni principali da frazioni
        for municipality in municipalities:
            name = municipality["name"].lower().strip()
            place_type = municipality.get("place_type", "")
            
            # È un comune principale?
            if place_type in ["city", "town"] or municipality.get("admin_level") == "8":
                if name not in main_municipalities:
                    main_municipalities[name] = {
                        "name": municipality["name"],
                        "subdivisions": [],
                        "poi_count": 0,
                        "lat": municipality.get("lat"),
                        "lng": municipality.get("lng")
                    }
            else:
                fractions.append(municipality)
        
        # Assegna frazioni ai comuni
        for fraction in fractions:
            fraction_name = fraction["name"].lower().strip()
            parent_municipality = self._find_parent_municipality(
                fraction_name, main_municipalities
            )
            
            if parent_municipality:
                main_municipalities[parent_municipality]["subdivisions"].append(
                    fraction["name"]
                )
            else:
                # Se non trova il comune parent, crea un nuovo comune
                main_municipalities[fraction_name] = {
                    "name": fraction["name"],
                    "subdivisions": [],
                    "poi_count": 0,
                    "lat": fraction.get("lat"),
                    "lng": fraction.get("lng")
                }
        
        return list(main_municipalities.values())
    
    def _find_parent_municipality(self, fraction_name: str, municipalities: Dict) -> Optional[str]:
        """Trova il comune parent di una frazione"""
        # Cerca nel mapping predefinito
        if fraction_name in self.fraction_mappings:
            parent = self.fraction_mappings[fraction_name]
            if parent in municipalities:
                return parent
        
        # Cerca nel nome (alcune frazioni contengono il nome del comune)
        for municipality_name in municipalities.keys():
            if municipality_name in fraction_name or fraction_name in municipality_name:
                return municipality_name
        
        # Cerca per vicinanza geografica (se disponibili coordinate)
        # TODO: implementare ricerca per distanza minima
        
        return None
    
    async def _estimate_poi_count(self, municipality_name: str, subdivisions: List[str]) -> int:
        """Stima il numero di POI in un comune"""
        # Stima basata su dimensioni e tipo di comune
        base_count = 20  # Base per comune piccolo
        
        # Adjust per comuni noti
        known_municipalities = {
            "la spezia": 150,
            "porto venere": 80,
            "lerici": 90,
            "cinque terre": 120,
            "monterosso": 60,
            "vernazza": 45,
            "corniglia": 30,
            "manarola": 35,
            "riomaggiore": 40
        }
        
        municipality_lower = municipality_name.lower()
        if municipality_lower in known_municipalities:
            base_count = known_municipalities[municipality_lower]
        
        # Bonus per numero di frazioni
        subdivision_bonus = len(subdivisions) * 5
        
        return base_count + subdivision_bonus

class MunicipalityAnalyzer:
    """Analizza e classifica i comuni trovati"""
    
    @staticmethod
    def classify_by_tourism(municipalities: List[Dict]) -> List[Dict]:
        """Classifica comuni per rilevanza turistica"""
        # Comuni con alta rilevanza turistica in Liguria
        high_tourism_municipalities = [
            "porto venere", "lerici", "monterosso", "vernazza", 
            "corniglia", "manarola", "riomaggiore", "portovenere"
        ]
        
        medium_tourism_municipalities = [
            "la spezia", "ameglia", "castelnuovo di magra", "sarzana"
        ]
        
        for municipality in municipalities:
            name_lower = municipality["name"].lower()
            
            if any(name in name_lower for name in high_tourism_municipalities):
                municipality["tourism_level"] = "high"
                municipality["poi_count"] *= 1.5  # Incrementa stima POI
            elif any(name in name_lower for name in medium_tourism_municipalities):
                municipality["tourism_level"] = "medium"
                municipality["poi_count"] *= 1.2
            else:
                municipality["tourism_level"] = "low"
        
        return municipalities
    
    @staticmethod
    def add_geographic_context(municipalities: List[Dict], zone_name: str) -> List[Dict]:
        """Aggiunge contesto geografico ai comuni"""
        zone_lower = zone_name.lower()
        
        # Definisci contesti geografici
        contexts = {
            "golfo": "coastal",
            "costa": "coastal", 
            "riviera": "coastal",
            "cinque terre": "unesco_heritage",
            "parco": "natural_area",
            "riserva": "protected_area"
        }
        
        geographic_context = "generic"
        for keyword, context in contexts.items():
            if keyword in zone_lower:
                geographic_context = context
                break
        
        for municipality in municipalities:
            municipality["geographic_context"] = geographic_context
        
        return municipalities

# Funzioni utility per uso esterno
async def discover_zone_municipalities(polygon: List[List[float]], 
                                     zone_name: str = "") -> List[Dict]:
    """Scopre tutti i comuni in una zona"""
    async with MunicipalityDiscoverer() as discoverer:
        municipalities = await discoverer.discover_municipalities_in_zone(
            polygon, zone_name
        )
        
        # Classifica per turismo
        municipalities = MunicipalityAnalyzer.classify_by_tourism(municipalities)
        
        # Aggiungi contesto geografico
        municipalities = MunicipalityAnalyzer.add_geographic_context(
            municipalities, zone_name
        )
        
        return municipalities
