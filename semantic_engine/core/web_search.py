"""
✅ FIX MarineWreckFinder: Modulo di ricerca web per POI marini (relitti)
Cerca SOLO su diving center locali e estrae relitti specifici dai loro contenuti
"""

import asyncio
import aiohttp
import re
from typing import List, Dict, Optional, Tuple
from urllib.parse import quote, urlparse
from collections import defaultdict
from bs4 import BeautifulSoup
from .utils import SemanticLogger, point_in_polygon

logger = SemanticLogger()

SUSPICIOUS_NAME_TOKENS = [
    "leggi", "scopri", "prenota", "contatti", "contact", "news", "notizie",
    "ottobre", "novembre", "dicembre", "settembre", "agosto", "luglio",
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "pdf", "cookie", "privacy", "policy", "description", "descrizione",
    "gallery", "shop", "store", "cart", "login", "signup", "register",
    "2024", "2025", "facebook", "instagram", "linkedin", "twitter", "rss"
]

TRUSTED_DOMAIN_KEYWORDS = [
    "diving", "dive", "sub", "scuba", "immersion", "plongee", "plongée",
    "buceo", "tauchen", "apnea", "underwater", "nautica", "marina", "porto",
    "port", "yacht"
]

TRUSTED_TLD_PRIORITY = [
    ".it", ".fr", ".es", ".pt", ".gr", ".hr", ".si", ".de", ".co.uk", ".ch"
]

# ✅ FIX MarineSemantic: Classe per gestire contesto geografico e semantico della ricerca marina
class MarineSemanticContext:
    """✅ FIX MarineSemantic: Gestisce contesto geografico e semantico per ricerca POI marini universale"""
    
    # Toponimi globali da escludere (risultati fuori contesto geografico)
    EXCLUDED_GLOBAL_PLACES = [
        # Americhe
        "mexico", "caribbean", "caraibi", "caraibes", "bahamas", "cuba", "jamaica",
        "costa rica", "belize", "honduras", "panama", "colombia", "venezuela",
        "brazil", "brasil", "argentina", "chile", "peru", "ecuador",
        # Asia/Pacifico
        "bali", "indonesia", "thailand", "thailandia", "philippines", "filippine",
        "malaysia", "maldives", "maldive", "red sea", "mar rosso", "egypt", "egitto",
        "australia", "australia", "new zealand", "fiji", "palau", "micronesia",
        # Altri
        "africa", "africa", "south africa", "sudafrica", "kenya", "tanzania",
        "seychelles", "seychelles", "mauritius", "mauritius"
    ]
    
    # Pattern per identificare frazioni/località minori (non riconosciute globalmente)
    FRACTION_PATTERNS = [
        'di ', 'del ', 'della ', "dell'", 'in ', 'sul ', 'sulla ', 'sulle ',
        'San ', 'Santa ', 'Santo ', "Sant'", 'Sant ', 'S. ', 'S. ',
        'La ', 'Lo ', 'Il ', 'Le ', 'Gli ', 'I ',
        'Costa ', 'Punta ', 'Baia ', 'Golfo ', 'Porto ', 'Cala ',
        'Sella ', 'Piano ', 'Poggio ', 'Borgo ', 'Villaggio ', 'Località ',
        'Semaforo ', 'Scogli ', 'Batterie ', 'Bocche ', 'Campo ', 'Mulino ',
        'Frazione ', 'Fraz. ', 'Fraz ', 'Località ', 'Loc. ', 'Loc '
    ]
    
    # Keywords semantiche per identificare contenuti rilevanti (multilingue)
    SEMANTIC_KEYWORDS = {
        'wreck': ['wreck', 'shipwreck', 'relitto', 'naufragio', 'épave', 'pez', 'wrack', 'ναυάγιο'],
        'diving': ['diving', 'dive', 'scuba', 'immersion', 'subacque', 'plongée', 'buceo', 'tauchen', 'κατάδυση'],
        'marine': ['marine', 'marino', 'marin', 'marino', 'meer', 'θάλασσα'],
        'depth': ['depth', 'profondità', 'profondeur', 'profundidad', 'tiefe', 'βάθος'],
        'site': ['site', 'sito', 'site', 'sitio', 'stelle', 'θέση']
    }
    
    @staticmethod
    def filter_main_municipalities(municipalities: List[str], zone_name: Optional[str] = None) -> List[str]:
        """✅ FIX MarineSemantic: Filtra solo comuni principali (esclude frazioni/località minori)
        
        Args:
            municipalities: Lista di nomi municipi
            
        Returns:
            Lista di comuni principali (riconosciuti globalmente)
        """
        if not municipalities:
            return []
        
        zone_tokens = []
        if zone_name:
            zone_tokens = [token for token in zone_name.lower().split() if len(token) > 3]

        def score_name(name: str) -> int:
            lowered = name.lower()
            score = 0
            coastal_hints = [
                'mare', 'marina', 'maritt', 'porto', 'port', 'baia', 'spiagg',
                'riv', 'riviera', 'golfo', 'golf', 'isola', 'tigullio', 'camogli',
                'sestri', 'rapallo', 'chiavari', 'lavagna', 'portofino', 'moneglia',
                'nautica', 'pesc'
            ]
            for hint in coastal_hints:
                if hint in lowered:
                    score += 2
            if any(token in lowered for token in zone_tokens):
                score += 1
            if len(lowered) <= 8:
                score += 1
            return score
        
        scored_municipalities: List[Tuple[int, str]] = []
        
        for m in municipalities:
            if not isinstance(m, str) or len(m.strip()) == 0:
                continue
            
            m_name = m.strip()
            
            # Escludi se contiene pattern di frazione/località
            is_fraction = any(pattern in m_name for pattern in MarineSemanticContext.FRACTION_PATTERNS)
            
            # Escludi se troppo lungo (probabilmente frazione composta)
            is_too_long = len(m_name.split()) > 3
            
            # Escludi se troppo corto (probabilmente abbreviazione)
            is_too_short = len(m_name) < 3
            
            # Includi solo comuni principali
            if not is_fraction and not is_too_long and not is_too_short:
                score = score_name(m_name)
                scored_municipalities.append((score, m_name))
                logger.logger.debug(f"[POI-MARINE] ✅ Comune candidato: '{m_name}' (score={score})")
            else:
                logger.logger.debug(f"[POI-MARINE] ⚠️ Escluso (probabilmente frazione): '{m_name}'")
        
        if not scored_municipalities:
            fallback = municipalities[:6]
            logger.logger.warning(f"[POI-MARINE] ⚠️ Utilizzo fallback municipi (nessun candidato costiero rilevato): {', '.join(fallback)}")
            return fallback

        scored_municipalities.sort(key=lambda item: (-item[0], item[1]))
        trimmed = [name for _, name in scored_municipalities[:6]]

        if len(trimmed) < len(municipalities):
            logger.logger.info(f"[POI-MARINE] ✅ Municipi costieri selezionati ({len(trimmed)}/{len(municipalities)}): {', '.join(trimmed)}")

        return trimmed
    
    @staticmethod
    def build_semantic_queries(municipality: str, country_name: Optional[str] = None) -> List[str]:
        """✅ FIX MarineSemantic: Costruisce query semantiche pertinenti e umane
        
        Args:
            municipality: Nome comune principale
            country_name: Nome paese (opzionale)
            
        Returns:
            Lista di query semantiche pertinenti
        """
        queries = []
        
        # Query base con comune
        if country_name:
            # Query con paese (più specifiche)
            queries.extend([
                f"diving center {municipality} {country_name} relitti",
                f"immersioni relitti {municipality} {country_name}",
                f"wreck diving {municipality} {country_name}",
                f"scuba diving {municipality} {country_name} wreck",
            ])
            
            # Query multilingue basate su paese
            country_lower = country_name.lower()
            if "italy" in country_lower or "italia" in country_lower:
                queries.extend([
                    f"centro immersione {municipality} {country_name} relitti",
                    f"diving {municipality} {country_name} immersioni relitti",
                ])
            elif "france" in country_lower or "france" in country_lower:
                queries.extend([
                    f"centre de plongée {municipality} {country_name} épaves",
                    f"plongée {municipality} {country_name} épaves",
                ])
            elif "spain" in country_lower or "españa" in country_lower:
                queries.extend([
                    f"centro de buceo {municipality} {country_name} pecios",
                    f"buceo {municipality} {country_name} pecios",
                ])
        else:
            # Query senza paese (universali)
            queries.extend([
                f"diving center {municipality} relitti",
                f"immersioni relitti {municipality}",
                f"wreck diving {municipality}",
                f"scuba diving {municipality} wreck",
            ])
        
        return queries[:3]  # Limita a 3 query più pertinenti
    
    @staticmethod
    def is_geographically_relevant(url: str, title: str, snippet: str, 
                                   zone_municipalities: List[str]) -> bool:
        """✅ FIX MarineSemantic: Verifica rilevanza geografica preventiva
        
        Args:
            url: URL del risultato
            title: Titolo del risultato
            snippet: Snippet del risultato
            zone_municipalities: Lista di comuni nella zona
            
        Returns:
            True se geograficamente rilevante, False altrimenti
        """
        text = (url + " " + title + " " + snippet).lower()
        
        # Escludi se contiene toponimi globali fuori contesto
        for excluded_place in MarineSemanticContext.EXCLUDED_GLOBAL_PLACES:
            if excluded_place in text:
                logger.logger.debug(f"[POI-MARINE] ⚠️ Escluso (toponimo globale): '{excluded_place}' in {url}")
                return False
        
        # Includi se contiene riferimenti a comuni della zona
        for municipality in zone_municipalities:
            if municipality.lower() in text:
                return True
        
        # Se non contiene riferimenti espliciti, accetta (potrebbe essere generico ma valido)
        return True
    
    @staticmethod
    def has_semantic_relevance(content: str) -> bool:
        """✅ FIX MarineSemantic: Verifica rilevanza semantica del contenuto
        
        Args:
            content: Contenuto da analizzare
            
        Returns:
            True se semanticamente rilevante, False altrimenti
        """
        content_lower = content.lower()
        
        # Deve contenere almeno una keyword di ogni categoria rilevante
        has_wreck = any(kw in content_lower for kw in MarineSemanticContext.SEMANTIC_KEYWORDS['wreck'])
        has_diving = any(kw in content_lower for kw in MarineSemanticContext.SEMANTIC_KEYWORDS['diving'])
        has_marine = any(kw in content_lower for kw in MarineSemanticContext.SEMANTIC_KEYWORDS['marine'])
        
        # Almeno 2 su 3 categorie devono essere presenti
        relevance_score = sum([has_wreck, has_diving, has_marine])
        
        if relevance_score >= 2:
            return True
        
        logger.logger.debug(f"[POI-MARINE] ⚠️ Contenuto non semanticamente rilevante (score: {relevance_score}/3)")
        return False

# ✅ FIX MarineFilter: Funzione per filtrare nomi validi di relitti (rimuove parole comuni e termini generici)
def filter_valid_wreck_names(names: List[str]) -> List[str]:
    """✅ FIX MarineFilter: Filtra nomi di relitti per rimuovere parole comuni e termini generici
    
    Args:
        names: Lista di nomi estratti dal contenuto
        
    Returns:
        Lista di nomi validi (solo nomi propri o titoli plausibili)
    """
    if not names:
        return []
    
    valid_names = []
    filtered_count = 0
    
    # ✅ FIX MarineFilter: Parole comuni da escludere (singole parole troppo brevi o generiche)
    common_words = {
        # Italiano - Articoli e preposizioni
        'Il', 'La', 'Lo', 'Le', 'Gli', 'I', 'Un', 'Una', 'Uno', 'Del', 'Della', 'Dell', 'Dei', 'Delle',
        'Di', 'Da', 'In', 'Su', 'Con', 'Per', 'Tra', 'Fra',
        # Italiano - Parole comuni
        'Durante', 'Dettagli', 'Immersioni', 'Immersione', 'Piroscafo', 'Nave', 'Submarine',
        'Foto', 'Guarda', 'Scopri', 'Cerca', 'Notifiche', 'Vetrina', 'Abbonati', 'Meteo', 'Newsletter',
        'Edizioni', 'Sezioni', 'Genova', 'Liguria', 'Savona', 'Italia', 'Mondo', 'Economia', 'Cultura',
        'Marinara', 'Scuole', 'Tecnici', 'Novembre', 'Comune', 'Sfratto', 'Congresso', 'Sifo', 'Secolo',
        'XIX', 'Assonat', 'Porti', 'Ormeggi', 'Turismo', 'Yacht', 'Barche', 'Navi', 'Epoca', 'News',
        'Report', 'Notizie', 'Articolo', 'Giornale', 'Quotidiano', 'Reporter', 'Nautica',
        # Inglese - Articoli e preposizioni
        'The', 'Of', 'A', 'An', 'In', 'On', 'At', 'By', 'For', 'With', 'From', 'To',
        # Inglese - Parole comuni
        'Home', 'Center', 'Diving', 'Dive', 'During', 'Details', 'Photo',
        'Watch', 'Discover', 'Search', 'Show', 'All', 'Phone', 'Address', 'Find', 'Most', 'Recent',
        'Note', 'Sorry', 'Please', 'Free', 'What', 'Their', 'That', 'This', 'Having', 'Landed',
        # Francese - Articoli e preposizioni
        'Le', 'La', 'Les', 'De', 'Du', 'Des', 'Dans', 'Sur', 'Avec', 'Pour', 'Par',
        # Francese - Parole comuni
        'Centre', 'Plongée', 'Pendant', 'Détails', 'Photo',
        'Regarder', 'Découvrir', 'Rechercher',
        # Spagnolo - Articoli e preposizioni
        'El', 'La', 'Los', 'Las', 'De', 'Del', 'En', 'Con', 'Por', 'Para',
        # Spagnolo - Parole comuni
        'Centro', 'Buceo', 'Durante', 'Detalles', 'Foto',
        'Ver', 'Descubrir', 'Buscar',
        # Tedesco - Articoli e preposizioni
        'Das', 'Die', 'Der', 'Von', 'Des', 'In', 'Mit', 'Für', 'Auf',
        # Tedesco - Parole comuni
        'Zentrum', 'Tauchen', 'Während', 'Details', 'Foto',
        'Ansehen', 'Entdecken', 'Suchen',
        # Greco - Articoli
        'Το', 'Η', 'Οι', 'Της', 'Του', 'Των',
    }
    
    # ✅ FIX MarineFilter: Prefissi comuni che devono essere seguiti da un nome proprio o codice
    wreck_prefixes = {
        'relitto', 'wreck', 'shipwreck', 'naufragio', 'épave', 'naufrage', 'pez', 'wrack',
        'schiffswrack', 'ναυάγιο', 'piroscafo', 'nave', 'ship', 'submarine', 'sottomarino',
        'cargo', 'tanker', 'petroliera', 'battello', 'motonave', 'vapore', 'steamer'
    }
    
    for name in names:
        if not isinstance(name, str) or len(name.strip()) == 0:
            filtered_count += 1
            continue
        
        name_clean = name.strip()
        
        # ✅ FIX MarineFilter: Regola A - Accetta nomi con almeno una parola con iniziale maiuscola
        words = name_clean.split()
        has_capitalized_word = False
        for word in words:
            # Verifica se la parola inizia con maiuscola ed è seguita da lettere o numeri
            if len(word) > 1 and word[0].isupper() and (word[1:].isalnum() or any(c.isdigit() for c in word[1:])):
                has_capitalized_word = True
                break
        
        if not has_capitalized_word:
            filtered_count += 1
            logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (nessuna parola maiuscola valida): '{name_clean}'")
            continue
        
        # ✅ FIX MarineFilter: Regola B - Scarta parole singole comuni o troppo brevi
        if len(words) == 1:
            # Se è una singola parola, deve essere lunga almeno 4 caratteri e non essere comune
            if len(name_clean) < 4 or name_clean in common_words:
                filtered_count += 1
                logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (parola singola comune/breve): '{name_clean}'")
                continue
        
        # ✅ FIX MarineFilter: Regola C - Se inizia con prefisso comune, deve essere seguito da nome proprio o codice
        first_word_lower = words[0].lower() if words else ""
        if first_word_lower in wreck_prefixes:
            # Se inizia con prefisso, deve avere almeno 2 parole (prefisso + nome/codice)
            if len(words) < 2:
                filtered_count += 1
                logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (prefisso senza nome): '{name_clean}'")
                continue
            
            # ✅ FIX MarineFilter: Gestisci anche prefissi multipli (es. "Relitto del Piroscafo Umbria")
            # Cerca la prima parola non comune dopo il prefisso (salta preposizioni)
            prepositions = {'del', 'della', 'dell', 'di', 'de', 'du', 'des', 'el', 'la', 'los', 'das', 'die', 'der', 'von', 'des', 'of', 'the', 'le', 'les'}
            second_word_idx = 1
            while second_word_idx < len(words) and words[second_word_idx].lower() in prepositions:
                second_word_idx += 1
            
            if second_word_idx >= len(words):
                filtered_count += 1
                logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (prefisso senza nome dopo preposizioni): '{name_clean}'")
                continue
            
            second_word = words[second_word_idx]
            is_proper_name = second_word[0].isupper() if len(second_word) > 0 else False
            # ✅ FIX MarineFilter: Codice può contenere trattini (es. "U-455", "U-455")
            second_word_clean = second_word.replace('-', '').replace('_', '')
            is_code = any(c.isupper() or c.isdigit() for c in second_word_clean) if len(second_word_clean) > 0 else False
            
            if not (is_proper_name or is_code):
                filtered_count += 1
                logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (prefisso senza nome proprio/codice): '{name_clean}'")
                continue
        
        # ✅ FIX MarineFilter: Filtri aggiuntivi - Escludi nomi troppo lunghi o con caratteri strani
        if len(name_clean) > 50:
            filtered_count += 1
            logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (troppo lungo): '{name_clean}'")
            continue
        
        # Escludi se contiene URL o caratteri strani
        if name_clean.lower().startswith('http') or any(char in name_clean for char in ['/', '\\', '@', '#', '%']):
            filtered_count += 1
            logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (caratteri strani/URL): '{name_clean}'")
            continue
        
        # ✅ FIX MarineFilter: Escludi se contiene solo parole comuni (inclusi articoli e preposizioni)
        # Conta quante parole NON sono comuni (case-insensitive)
        non_common_words = [w for w in words if w not in common_words and w.capitalize() not in common_words]
        
        # Se tutte le parole sono comuni, escludi
        if len(non_common_words) == 0:
            filtered_count += 1
            logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (solo parole comuni): '{name_clean}'")
            continue
        
        # ✅ FIX MarineFilter: Se inizia con articolo/preposizione comune, deve avere almeno 2 parole non comuni
        # Ma se contiene un prefisso wreck valido, accettalo (es. "Relitto U-455" è valido anche se "Relitto" è comune)
        first_word = words[0] if words else ""
        first_word_lower = first_word.lower() if first_word else ""
        has_wreck_prefix = first_word_lower in wreck_prefixes
        first_word_is_common = first_word in common_words or first_word.capitalize() in common_words
        
        if first_word_is_common and not has_wreck_prefix and len(non_common_words) < 2:
            filtered_count += 1
            logger.logger.debug(f"[MARINE-FILTER] ⚠️ Nome scartato (inizia con articolo/preposizione comune senza nome valido): '{name_clean}'")
            continue
        
        # ✅ FIX MarineFilter: Nome valido - aggiungilo alla lista
        valid_names.append(name_clean)
        logger.logger.debug(f"[MARINE-FILTER] ✅ Nome valido: '{name_clean}'")
    
    # ✅ FIX MarineFilter: Log riepilogativo
    if filtered_count > 0:
        logger.logger.info(f"[MARINE-FILTER] Filtrati {filtered_count}/{len(names)} nomi non validi — rimossi termini generici")
    
    return valid_names

# ✅ FIX MarineWreckFinder: Keywords universali per identificare relitti (multilingue, a livello di modulo)
WRECK_INDICATORS = [
    # Inglese
    "wreck", "shipwreck", "sunk", "sunken", "underwater wreck",
    "diving wreck", "wreck diving", "ship wreck",
    # Italiano
    "relitto", "naufragio", "nave affondata", "affondata", "affondato",
    "subacqueo", "immersione relitto", "relitto sommerso",
    # Francese
    "épave", "naufrage", "navire coulé", "coulé", "plongée épave",
    # Spagnolo
    "pez", "naufragio", "barco hundido", "hundido", "buceo pez",
    # Tedesco
    "wrack", "schiffswrack", "versenkt", "tauchen wrack",
    # Greco
    "ναυάγιο", "βυθισμένο",
]

class MarineWebSearcher:
    """✅ FIX MarineWeb: Ricerca POI marini (relitti) tramite ricerca web su siti specializzati"""
    
    def __init__(self, mode: str = "standard"):
        self.timeout = aiohttp.ClientTimeout(total=10)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self.mode = (mode or "standard").lower()
        self._reset_source_tracking()
        
        # ✅ FIX MarineUniversal: Siti specializzati per ricerca relitti marini (opzionali - non limitati a Italia)
        # Questi sono usati solo come riferimento, non come filtro obbligatorio
        # La ricerca funziona universalmente su qualsiasi diving center trovato
        self.specialized_sites = [
            # Siti internazionali (universali)
            "wreckdiving.com",
            "divezone.net",
            "scubadiving.com",
            # Siti italiani (opzionali - se zona è in Italia)
            "diveitalia.com",
            "subacquea.it",
            "relitti.it",
            "diveitaly.com",
            # Siti francesi (opzionali - se zona è in Francia)
            "plongee.fr",
            "epaves.fr",
            # Siti spagnoli (opzionali - se zona è in Spagna)
            "buceo.com",
            "pecios.es",
        ]

    def _reset_source_tracking(self):
        self.accepted_domains: set = set()
        self.excluded_domains: Dict[str, set] = defaultdict(set)
        self.suspicious_names: List[str] = []

    def _track_accepted_domain(self, domain: str):
        if not domain:
            return
        self.accepted_domains.add(domain)

    def _log_domain_exclusion(self, domain: str, reason: str):
        if not domain:
            return
        self.excluded_domains[reason].add(domain)

    def _finalize_source_logging(self):
        if self.accepted_domains:
            sorted_domains = sorted(self.accepted_domains)
            logger.logger.info(f"[POI-MARINE] ✅ Fonti affidabili utilizzate: {', '.join(sorted_domains)}")
        else:
            logger.logger.warning("[POI-MARINE] ⚠️ Nessuna fonte affidabile identificata per questa ricerca")
        if self.excluded_domains:
            for reason, domains in self.excluded_domains.items():
                logger.logger.info(f"[POI-MARINE] ⚠️ Fonti escluse ({reason}): {', '.join(sorted(domains))}")
        if self.suspicious_names:
            logger.logger.info(f"[POI-MARINE] ⚠️ Nomi sospetti rilevati e scartati: {', '.join(sorted(set(self.suspicious_names)))}")

    @staticmethod
    def _is_suspicious_name(name: str) -> bool:
        if not name:
            return True
        lowered = name.lower().strip()
        if len(lowered) < 3:
            return True
        return any(token in lowered for token in SUSPICIOUS_NAME_TOKENS)

    def _is_domain_allowed(self, domain: str, country_name: Optional[str] = None) -> bool:
        if not domain:
            return False
        lowered = domain.lower()
        excluded_keywords = [
            'facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'tripadvisor',
            'booking', 'amazon', 'ebay', 'reddit', 'bing', 'google', 'yahoo',
            'pinterest', 'wordpress', 'blogspot', 'medium', 'weebly', 'shopify',
            'alibaba', 'trip', 'kayak', 'expedia', 'airbnb', 'skyscanner'
        ]
        if any(keyword in lowered for keyword in excluded_keywords):
            self._log_domain_exclusion(domain, 'excluded_keyword')
            return False

        excluded_tlds = {'.gov', '.gouv', '.edu', '.int'}
        for tld in excluded_tlds:
            if lowered.endswith(tld):
                self._log_domain_exclusion(domain, 'institutional_domain')
                return False

        tld = '.' + lowered.split('.')[-1]
        has_trusted_tld = tld in TRUSTED_TLD_PRIORITY
        has_trusted_keyword = any(keyword in lowered for keyword in TRUSTED_DOMAIN_KEYWORDS)

        if country_name and country_name.lower() in ('italia', 'italy', 'it'):
            if not has_trusted_tld and not has_trusted_keyword:
                self._log_domain_exclusion(domain, 'non_local_domain')
                return False

        # Se TLD non affidabile, richiedi keyword marina esplicita
        if not has_trusted_tld and not has_trusted_keyword:
            self._log_domain_exclusion(domain, 'generic_domain')
            return False

        return True

    def _evaluate_marine_pois(self, pois: List[Dict]) -> List[Dict]:
        if not pois:
            return []

        valid_pois: List[Dict] = []
        dropped_missing_coords: List[str] = []
        dropped_suspicious: List[str] = []

        total_raw = len(pois)

        for poi in pois:
            name = poi.get('name', '')
            lat = poi.get('lat')
            lng = poi.get('lng')

            if self._is_suspicious_name(name):
                dropped_suspicious.append(name)
                continue

            if lat is None or lng is None:
                dropped_missing_coords.append(name)
                continue

            valid_pois.append(poi)

        if dropped_suspicious:
            self.suspicious_names.extend(dropped_suspicious)
            logger.logger.warning(f"[POI-MARINE] ⚠️ POI scartati per nomi sospetti: {', '.join(set(dropped_suspicious))}")

        if dropped_missing_coords:
            logger.logger.warning(f"[POI-MARINE] ⚠️ POI scartati per coordinate mancanti: {', '.join(set(dropped_missing_coords))}")

        valid_count = len(valid_pois)
        logger.logger.info(f"[POI-MARINE] 📊 Verifica congruità: {valid_count}/{total_raw} POI validi dopo filtri qualitativi")

        if valid_count == 0:
            logger.logger.warning("[POI-MARINE] ⚠️ Nessun POI valido dopo la verifica di congruità")
        elif valid_count < total_raw:
            logger.logger.info(f"[POI-MARINE] ℹ️ POI rimossi durante la verifica: {total_raw - valid_count}")

        return valid_pois
    
    async def search_marine_wrecks(self, 
                                   zone_name: str,
                                   bbox: Tuple[float, float, float, float],
                                   polygon: List[List[float]],
                                   municipalities: List[str] = None) -> List[Dict]:
        """✅ FIX MarineWeb: Ricerca relitti marini tramite ricerca web mirata
        
        Args:
            zone_name: Nome della zona (es. "Tigullio nuova")
            bbox: Bounding box (south, west, north, east)
            polygon: Poligono della zona
            municipalities: Lista di nomi municipi (es. ["Lerici", "Porto Venere"]) - opzionale
            
        Returns:
            Lista di POI marini trovati
        """
        logger.logger.info(f"[POI-MARINE-WEB] 🔍 Ricerca web relitti per zona '{zone_name}'...")
        self._reset_source_tracking()
        
        marine_pois = []
        
        # ✅ FIX MarineUniversal: Determina paese per query più specifiche (universale - qualsiasi paese)
        country_name = None  # Default: nessun default hardcoded
        try:
            from .utils import detect_country_from_polygon
            _, country_name = await detect_country_from_polygon(polygon)
            if not country_name or country_name == "":
                country_name = None  # ✅ FIX MarineUniversal: Se non rilevato, non usare default hardcoded
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore detection paese: {str(e)} - continuo senza paese")
            country_name = None
        
        # ✅ FIX MarineSemantic: Se municipi sono disponibili, filtra solo comuni principali
        if municipalities and len(municipalities) > 0:
            # ✅ FIX MarineSemantic: Filtra solo comuni principali (esclude frazioni/località minori)
            main_municipalities = MarineSemanticContext.filter_main_municipalities(municipalities, zone_name)
            
            if main_municipalities:
                logger.logger.info(f"[POI-MARINE-WEB] ✅ Trovati {len(main_municipalities)} comuni principali: {', '.join(main_municipalities[:5])}{'...' if len(main_municipalities) > 5 else ''}")
                
                # ✅ FIX MarineSemantic: Per ogni comune principale, costruisci query semantiche pertinenti
                for municipality in main_municipalities:
                    try:
                        # ✅ FIX MarineSemantic: Costruisci query semantiche pertinenti e umane
                        diving_center_queries = MarineSemanticContext.build_semantic_queries(municipality, country_name)
                        
                        # ✅ FIX MarineSemantic: Google CSE per cercare diving center (massimo 3 siti per municipio)
                        diving_center_sites = []
                        try:
                            import os
                            if os.getenv("ENABLE_CSE_DIVE_WRECK", "").lower() == "true":
                                # ✅ FIX MarineSemantic: Cerca diving center con Google CSE
                                for query in diving_center_queries:
                                    logger.logger.info(f"[POI-MARINE-WEB] 🔍 Google CSE per diving center '{municipality}': '{query}'...")
                                    cse_results = await self._search_google_cse(query)
                                    if cse_results:
                                        logger.logger.info(f"[POI-MARINE-WEB] ✅ Google CSE per '{municipality}': trovati {len(cse_results)} risultati")
                                        
                                        # ✅ FIX MarineSemantic: Filtra risultati con validazione geografica preventiva
                                        for result in cse_results:
                                            url = result.get("link", "")
                                            snippet = result.get("snippet", "")
                                            title = result.get("title", "")
                                            
                                            # ✅ FIX MarineSemantic: Verifica rilevanza geografica preventiva
                                            if not MarineSemanticContext.is_geographically_relevant(url, title, snippet, main_municipalities):
                                                continue
                                            
                                            domain = urlparse(url).netloc.lower()
                                            if not self._is_domain_allowed(domain, country_name):
                                                continue
                                            
                                            # ✅ FIX MarineSemantic: Verifica che sia un diving center
                                            is_diving_center = any(keyword in (url + snippet + title).lower() for keyword in [
                                                'diving', 'dive', 'scuba', 'dive center', 'diving center',
                                                'immersion', 'subacque', 'centro sub', 'centro immersione',
                                                'plongée', 'plongee', 'centre de plongée', 'plongée sous-marine',
                                                'buceo', 'centro de buceo', 'buceo submarino',
                                                'tauchen', 'tauchzentrum', 'tauchschule',
                                                'κατάδυση', 'κέντρο κατάδυσης',
                                            ])
                                            is_wikipedia = 'wikipedia' in url.lower() or 'wikidata' in url.lower()
                                            
                                            if is_diving_center and not is_wikipedia:
                                                diving_center_sites.append((url, title, snippet))
                                                self._track_accepted_domain(domain)
                                                logger.logger.info(f"[POI-MARINE-WEB] ✅ Diving center trovato: {url}")
                                            
                                            # ✅ FIX MarineSemantic: Limita a massimo 3 siti per municipio
                                            if len(diving_center_sites) >= 3:
                                                break
                                        
                                        # ✅ FIX MarineSemantic: Se abbiamo trovato 3 siti, esci dal loop
                                        if len(diving_center_sites) >= 3:
                                            break
                        except Exception as e:
                            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore Google CSE per municipio '{municipality}': {str(e)}")
                        
                        # ✅ FIX MarineSemantic: Se non abbiamo trovato abbastanza con Google CSE, usa DuckDuckGo
                        if len(diving_center_sites) < 3:
                            for query in diving_center_queries:
                                try:
                                    logger.logger.info(f"[POI-MARINE-WEB] 🔍 DuckDuckGo per diving center '{municipality}': '{query}'...")
                                    search_results = await self._duckduckgo_search(query, max_results=3)
                                    
                                    if search_results:
                                        logger.logger.info(f"[POI-MARINE-WEB] ✅ Ricerca '{query}': trovati {len(search_results)} risultati web")
                                        
                                        for url, title, snippet in search_results:
                                            # ✅ FIX MarineSemantic: Verifica rilevanza geografica preventiva
                                            if not MarineSemanticContext.is_geographically_relevant(url, title, snippet, main_municipalities):
                                                continue
                                            
                                            domain = urlparse(url).netloc.lower()
                                            if not self._is_domain_allowed(domain, country_name):
                                                continue
                                            
                                            # ✅ FIX MarineSemantic: Verifica che sia un diving center
                                            is_wikipedia = 'wikipedia' in url.lower() or 'wikidata' in url.lower()
                                            is_diving_center = any(keyword in (url + snippet + title).lower() for keyword in [
                                                'diving', 'dive', 'scuba', 'dive center', 'diving center',
                                                'immersion', 'subacque', 'centro sub', 'centro immersione',
                                                'plongée', 'plongee', 'centre de plongée', 'plongée sous-marine',
                                                'buceo', 'centro de buceo', 'buceo submarino',
                                                'tauchen', 'tauchzentrum', 'tauchschule',
                                                'κατάδυση', 'κέντρο κατάδυσης',
                                            ])
                                            
                                            if is_diving_center and not is_wikipedia:
                                                if (url, title, snippet) not in diving_center_sites:
                                                    diving_center_sites.append((url, title, snippet))
                                                    self._track_accepted_domain(domain)
                                                    logger.logger.info(f"[POI-MARINE-WEB] ✅ Diving center trovato: {url}")
                                            
                                            # ✅ FIX MarineSemantic: Limita a massimo 3 siti per municipio
                                            if len(diving_center_sites) >= 3:
                                                break
                                        
                                        # ✅ FIX MarineSemantic: Se abbiamo trovato 3 siti, esci dal loop
                                        if len(diving_center_sites) >= 3:
                                            break
                                        
                                        await asyncio.sleep(0.3)  # Rate limiting
                                except Exception as e:
                                    logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore ricerca DuckDuckGo per '{query}': {str(e)}")
                                    continue
                        
                        # ✅ FIX MarineSemantic: Analizza massimo 3 siti diving center per trovare relitti specifici
                        logger.logger.info(f"[POI-MARINE-WEB] 🔍 Analizzando {len(diving_center_sites)} diving center per municipio '{municipality}'...")

                        if self.mode == "enhanced" and diving_center_sites:
                            try:
                                logger.logger.info("🌊 [POI-MARINE] Enhanced mode attivo — analisi completa contenuti diving center")
                                urls_to_analyze = [url for url, _, _ in diving_center_sites[:3]]
                                enhanced_pois = await enhanced_web_search(urls_to_analyze, zone_name, polygon)
                                for poi in enhanced_pois:
                                    if poi:
                                        marine_pois.append(poi)
                                        logger.logger.info(f"[MARINE] Wreck found (enhanced): {poi.get('name', '')} near {municipality}")
                                if enhanced_pois:
                                    continue
                            except Exception as e:
                                logger.logger.error(f"[POI-MARINE] ❌ Errore enhanced mode per municipio '{municipality}': {str(e)}")

                        for url, title, snippet in diving_center_sites[:3]:  # Massimo 3 siti
                            try:
                                # ✅ FIX MarineSemantic: Estrai relitti specifici dal contenuto del diving center
                                pois_result = await self._extract_marine_poi_from_url(url, title, snippet, bbox, polygon, zone_name, municipalities)
                                
                                # ✅ FIX MarineSemantic: Gestisci sia lista che singolo POI
                                if pois_result:
                                    if isinstance(pois_result, list):
                                        # Se è una lista, aggiungi tutti i POI
                                        appended = False
                                        for poi in pois_result:
                                            if poi:
                                                self._track_accepted_domain(domain)
                                                appended = True
                                                marine_pois.append(poi)
                                                logger.logger.info(f"[MARINE] Wreck found: {poi.get('name', '')}")
                                                logger.logger.info(f"[POI-MARINE-WEB] ✅ POI trovato: '{poi.get('name', '')}' (lat: {poi.get('lat')}, lng: {poi.get('lng')}) da {url}")
                                        if not appended:
                                            logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Lista vuota da {url} dopo filtraggio")
                                    else:
                                        # Se è un singolo POI, aggiungilo
                                        self._track_accepted_domain(domain)
                                        marine_pois.append(pois_result)
                                        logger.logger.info(f"[MARINE] Wreck found: {pois_result.get('name', '')}")
                                        logger.logger.info(f"[POI-MARINE-WEB] ✅ POI trovato: '{pois_result.get('name', '')}' (lat: {pois_result.get('lat')}, lng: {pois_result.get('lng')}) da {url}")
                                else:
                                    logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ POI escluso da: {url} (titolo: '{title}') - vedi log precedenti per motivo")
                            except Exception as e:
                                logger.logger.error(f"[POI-MARINE-WEB] ❌ Errore estrazione POI da {url}: {str(e)}")
                                continue
                    
                    except Exception as e:
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore ricerca per municipio '{municipality}': {str(e)}")
                        continue
        else:
            # ✅ FIX MarineWeb: Fallback: cerca per zona se municipi non disponibili
            logger.logger.info(f"[POI-MARINE-WEB] ⚠️ Nessun municipio disponibile, cercherò per zona '{zone_name}'...")
            
            # ✅ FIX MarineWeb: Integrazione Google CSE (opzionale, non intrusiva)
            try:
                import os
                if os.getenv("ENABLE_CSE_DIVE_WRECK", "").lower() == "true":
                    logger.logger.info(f"[POI-MARINE-WEB] 🔍 Ricerca Google CSE per zona '{zone_name}'...")
                    cse_results = await self._search_google_cse(zone_name)
                    if cse_results:
                        logger.logger.info(f"[POI-MARINE-WEB] ✅ Google CSE: trovati {len(cse_results)} risultati")
                        for result in cse_results:
                            poi = await self._extract_marine_poi_from_cse_result(result, bbox, polygon, zone_name)
                            if poi:
                                marine_pois.append(poi)
                                logger.logger.info(f"[POI-MARINE-WEB] ✅ POI da Google CSE: '{poi.get('name', '')}' (lat: {poi.get('lat')}, lng: {poi.get('lng')})")
                    else:
                        logger.logger.info(f"[POI-MARINE-WEB] ℹ️ Google CSE: nessun risultato trovato")
            except Exception as e:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore Google CSE (continuo con DuckDuckGo): {str(e)}")
            
            # ✅ FIX MarineUniversal: Termini di ricerca universali per relitti marini (multilingue, adattivi al paese)
            search_terms = []
            
            if country_name:
                # Query con paese rilevato (es. "Tigullio wreck Italy")
                search_terms.extend([
                    f"{zone_name} wreck {country_name}",
                    f"{zone_name} shipwreck {country_name}",
                    f"{zone_name} diving wreck {country_name}",
                    f"wreck {zone_name} {country_name}",
                ])
                
                # ✅ FIX MarineUniversal: Aggiungi query in lingua locale se paese noto
                if "italy" in country_name.lower() or "italia" in country_name.lower():
                    search_terms.extend([
                        f"{zone_name} relitti {country_name}",
                        f"{zone_name} naufragio {country_name}",
                        f"relitti {zone_name}",
                    ])
                elif "france" in country_name.lower() or "france" in country_name.lower():
                    search_terms.extend([
                        f"{zone_name} épaves {country_name}",
                        f"{zone_name} naufrage {country_name}",
                        f"épaves {zone_name}",
                    ])
                elif "spain" in country_name.lower() or "españa" in country_name.lower():
                    search_terms.extend([
                        f"{zone_name} pecios {country_name}",
                        f"{zone_name} naufragio {country_name}",
                        f"pecios {zone_name}",
                    ])
            else:
                # ✅ FIX MarineUniversal: Query senza paese (universale - funziona per qualsiasi zona)
                search_terms.extend([
                    f"{zone_name} wreck",
                    f"{zone_name} shipwreck",
                    f"{zone_name} diving wreck",
                    f"wreck {zone_name}",
                ])
            
            logger.logger.info(f"[POI-MARINE-WEB] 🔍 Eseguendo {len(search_terms)} ricerche web...")
            
            # ✅ FIX MarineWeb: Cerca su DuckDuckGo (o altri motori di ricerca)
            for i, term in enumerate(search_terms, 1):
                try:
                    logger.logger.info(f"[POI-MARINE-WEB] 🔍 Ricerca web {i}/{len(search_terms)}: '{term}'")
                    
                    # Cerca risultati web
                    search_results = await self._duckduckgo_search(term, max_results=5)  # ✅ FIX MarineWeb: Ridotto a 5 per velocità
                    
                    logger.logger.info(f"[POI-MARINE-WEB] ✅ Ricerca '{term}': trovati {len(search_results)} risultati web")
                    
                    for url, title, snippet in search_results:
                        # ✅ FIX MarineWreckFinder: Estrai informazioni da pagine rilevanti
                        logger.logger.info(f"[POI-MARINE-WEB] 🔍 Processando risultato {len(marine_pois) + 1}: '{title}' da {url}")
                        logger.logger.debug(f"[POI-MARINE-WEB] 📄 Snippet: {snippet[:100]}...")
                        try:
                            domain = urlparse(url).netloc.lower()
                            if not self._is_domain_allowed(domain, country_name):
                                continue
                            
                            pois_result = await self._extract_marine_poi_from_url(url, title, snippet, bbox, polygon, zone_name, municipalities)
                            # ✅ FIX MarineWreckFinder: Gestisci sia lista che singolo POI
                            if pois_result:
                                if isinstance(pois_result, list):
                                    # Se è una lista, aggiungi tutti i POI
                                    appended = False
                                    for poi in pois_result:
                                        if poi:
                                            self._track_accepted_domain(domain)
                                            appended = True
                                            marine_pois.append(poi)
                                            logger.logger.info(f"[MARINE] Wreck found: {poi.get('name', '')}")
                                            logger.logger.info(f"[POI-MARINE-WEB] ✅ POI trovato: '{poi.get('name', '')}' (lat: {poi.get('lat')}, lng: {poi.get('lng')}) da {url}")
                                    if not appended:
                                        logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Lista vuota da {url} dopo filtraggio")
                                else:
                                    # Se è un singolo POI, aggiungilo
                                    self._track_accepted_domain(domain)
                                    marine_pois.append(pois_result)
                                    logger.logger.info(f"[MARINE] Wreck found: {pois_result.get('name', '')}")
                                    logger.logger.info(f"[POI-MARINE-WEB] ✅ POI trovato: '{pois_result.get('name', '')}' (lat: {pois_result.get('lat')}, lng: {pois_result.get('lng')}) da {url}")
                            else:
                                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ POI escluso da: {url} (titolo: '{title}') - vedi log precedenti per motivo")
                        except Exception as e:
                            logger.logger.error(f"[POI-MARINE-WEB] ❌ Errore estrazione POI da {url}: {str(e)}")
                            continue
                    
                    await asyncio.sleep(0.5)  # ✅ FIX MarineWeb: Ridotto rate limiting da 1s a 0.5s
                    
                except Exception as e:
                    logger.log_error("Marine Web Search", str(e), zone_name)
                    logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore ricerca termine '{term}': {str(e)}")
                    continue
        
        logger.logger.info(f"[POI-MARINE-WEB] ✅ Ricerca web completata: {len(marine_pois)} POI trovati (prima del filtro)")
        filtered_pois = self._evaluate_marine_pois(marine_pois)
        logger.logger.info(f"[POI-MARINE-WEB] ✅ POI validi dopo verifica congruità: {len(filtered_pois)}")
        self._finalize_source_logging()
        
        return filtered_pois
    
    async def _duckduckgo_search(self, query: str, max_results: int = 10) -> List[Tuple[str, str, str]]:
        """✅ FIX MarineWeb: Ricerca su DuckDuckGo tramite libreria dedicata o fallback HTML"""
        results = []
        
        try:
            # Prova prima con libreria dedicata (se disponibile)
            try:
                from duckduckgo_search import DDGS
                logger.logger.info(f"[POI-MARINE-WEB] 🔍 Ricerca DuckDuckGo con libreria: '{query}'")
                with DDGS() as ddgs:
                    search_results = ddgs.text(query, max_results=max_results)
                    for result in search_results:
                        results.append((
                            result.get('href', ''),
                            result.get('title', ''),
                            result.get('body', '')
                        ))
                    logger.logger.info(f"[POI-MARINE-WEB] ✅ Ricerca DuckDuckGo con libreria: {len(results)} risultati")
                    return results
            except ImportError:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Libreria duckduckgo-search non disponibile, uso fallback HTML")
            except Exception as e:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore libreria DuckDuckGo: {str(e)}, uso fallback HTML")
            
            # Fallback: DuckDuckGo HTML scraping (migliorato)
            url = f"https://html.duckduckgo.com/html/?q={quote(query)}"
            
            async with aiohttp.ClientSession(timeout=self.timeout, headers=self.headers) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # ✅ FIX MarineWeb: Estrai risultati dalla pagina HTML (metodi multipli)
                        # Metodo 1: Cerca classi standard
                        result_links = soup.find_all('a', class_='result__a', limit=max_results)
                        if not result_links:
                            # Metodo 2: Cerca per href pattern
                            result_links = soup.find_all('a', href=lambda x: x and ('uddg=' in x or '/l/?kh=' in x), limit=max_results)
                        if not result_links:
                            # Metodo 3: Cerca tutti i link con risultati
                            result_links = soup.find_all('a', limit=max_results * 2)
                        
                        for link in result_links[:max_results]:
                            href = link.get('href', '')
                            title = link.get_text(strip=True)
                            
                            # Skip se non è un risultato valido
                            if not title or len(title) < 5:
                                continue
                            
                            # Estrai snippet (descrizione) - cerca in vari modi
                            snippet = ""
                            snippet_elem = link.find_next('a', class_='result__snippet')
                            if not snippet_elem:
                                snippet_elem = link.find_next('div', class_='result__snippet')
                            if not snippet_elem:
                                snippet_elem = link.find_next('span', class_='result__snippet')
                            if snippet_elem:
                                snippet = snippet_elem.get_text(strip=True)
                            
                            if href and title:
                                # Decodifica URL DuckDuckGo
                                if href.startswith('/l/?kh=') or 'uddg=' in href:
                                    # Estrai URL reale
                                    import urllib.parse
                                    if 'uddg=' in href:
                                        parts = href.split('uddg=')
                                        if len(parts) > 1:
                                            real_url = urllib.parse.unquote(parts[1].split('&')[0])
                                            if real_url.startswith('http'):
                                                results.append((real_url, title, snippet))
                                    else:
                                        # Prova a decodificare direttamente
                                        try:
                                            decoded = urllib.parse.unquote(href)
                                            if decoded.startswith('http'):
                                                results.append((decoded, title, snippet))
                                        except:
                                            pass
                                elif href.startswith('http'):
                                    results.append((href, title, snippet))
                        
                        if results:
                            logger.logger.info(f"[POI-MARINE-WEB] ✅ Fallback HTML: trovati {len(results)} risultati")
                        else:
                            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Fallback HTML: nessun risultato trovato per '{query}'")
        
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore ricerca DuckDuckGo: {str(e)}")
        
        return results
    
    async def _extract_marine_poi_from_url(self,
                                          url: str,
                                          title: str,
                                          snippet: str,
                                          bbox: Tuple[float, float, float, float],
                                          polygon: List[List[float]],
                                          zone_name: str,
                                          municipalities: List[str] = None) -> Optional[Dict]:
        """✅ FIX MarineDivingCenter: Estrae POI marino da URL diving center - analizza contenuto e trova relitti specifici"""
        
        try:
            # ✅ FIX MarineWreckFinder: Verifica che sia un diving center REALE (non Wikipedia, non giornali, non news)
            domain = urlparse(url).netloc.lower()
            if not self._is_domain_allowed(domain):
                logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Escluso (dominio non attendibile): {domain}")
                return None
            
            # ✅ FIX MarineWreckFinder: Escludi esplicitamente giornali, news, Wikipedia, NauticaReport, ecc.
            excluded_domains = [
                'wikipedia.org', 'wikidata.org', 'dbpedia.org', 'ilsecoloxix.it', 'levantenews.it',
                'primocanale.it', 'msn.com', 'nauticareport.it', 'news', 'giornale', 'quotidiano',
                'secoloxix', 'reporter', 'notizie', 'articolo', 'blog', 'forum', 'yacht', 'barche',
                'porti', 'ormeggi', 'turismo', 'nautica', 'report'
            ]
            
            is_excluded = any(excluded in domain for excluded in excluded_domains)
            is_wikipedia = 'wikipedia' in url.lower() or 'wikidata' in url.lower() or 'dbpedia' in url.lower()
            
            if is_excluded or is_wikipedia:
                logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Escluso (dominio non valido): {domain} (titolo: '{title}')")
                return None
            
            # ✅ FIX MarineWreckFinder: Verifica che sia un diving center REALE (controlla URL, titolo e snippet)
            # Deve contenere keyword specifiche di diving center E NON contenere keyword di giornali/news
            diving_keywords = [
                'diving', 'dive', 'scuba', 'dive center', 'diving center',
                'immersion', 'subacque', 'centro sub', 'centro immersione',
                'scuba diving', 'diving club', 'diving school'
            ]
            
            news_keywords = [
                'news', 'notizie', 'giornale', 'quotidiano', 'articolo', 'reporter', 'report',
                'nautica report', 'porti', 'ormeggi', 'turismo', 'yacht', 'barche', 'navi',
                'epoca', 'turismo', 'ormeggi'
            ]
            
            text_lower = (domain + title + snippet).lower()
            
            # Deve contenere keyword diving E NON contenere keyword news
            has_diving_keywords = any(keyword in text_lower for keyword in diving_keywords)
            has_news_keywords = any(keyword in text_lower for keyword in news_keywords)
            
            if not has_diving_keywords or has_news_keywords:
                logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Escluso (non diving center REALE): {domain} (titolo: '{title}') - has_diving: {has_diving_keywords}, has_news: {has_news_keywords}")
                return None
            
            logger.logger.info(f"[MARINE] Diving center: {url}")
            logger.logger.info(f"[POI-MARINE-WEB] ✅ Diving center trovato: {domain} (titolo: '{title}') - analizzerò contenuto per trovare relitti")
            
            # ✅ FIX MarineWreckFinder: Log per debug
            logger.logger.debug(f"[MARINE] Analyzing diving center: {domain} for wrecks in zone: {zone_name}")
            
            # ✅ FIX MarineDivingCenter: Estrai informazioni dalla pagina web
            page_content = await self._fetch_page_content(url)
            
            if not page_content:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Pagina non scaricabile: {url} - ESCLUSO")
                return None
            
            # ✅ FIX MarineSemantic: Verifica rilevanza semantica del contenuto prima di processarlo
            # Prendi un campione del contenuto per la validazione (primi 5000 caratteri)
            content_sample = page_content[:5000] if len(page_content) > 5000 else page_content
            if not MarineSemanticContext.has_semantic_relevance(content_sample):
                logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Contenuto non semanticamente rilevante: {url} - ESCLUSO")
                return None
            
            # ✅ FIX MarineGPTFilter: Filtro GPT opzionale (se abilitato)
            try:
                from .semantic_gpt_filter import get_gpt_filter
                gpt_filter = get_gpt_filter()
                if gpt_filter and gpt_filter.is_operational:
                    # ✅ FIX MarineGPTFilter: Analizza contenuto con GPT (livello 1 - classificazione rapida)
                    gpt_result = await gpt_filter.gpt_filter_level1(content_sample)
                    if gpt_result:
                        is_marine_poi = gpt_result.get("isMarinePOI", False)
                        if not is_marine_poi:
                            logger.logger.info(f"[MARINE-GPT] ❌ Contenuto scartato da GPT: {gpt_result.get('reason', 'Non è un POI marino')}")
                            return None
                        else:
                            logger.logger.info(f"[MARINE-GPT] ✅ Contenuto validato da GPT: {gpt_result.get('poiName', 'POI marino')}")
            except Exception as e:
                # ✅ FIX MarineGPTFilter: Fallback silenzioso se GPT non è disponibile
                logger.logger.debug(f"[MARINE-GPT] ⚠️ Filtro GPT non disponibile (continuo senza GPT): {e}")
                pass  # Continua senza GPT
            
            # ✅ FIX MarineSemantic: Cerca sempre nel contenuto per trovare relitti specifici menzionati
            # I centri diving spesso hanno liste di relitti con nomi e descrizioni!
            wreck_names_raw = self._extract_wreck_names_from_content(page_content, zone_name)
            
            # ✅ FIX MarineFilter: Filtra nomi validi (rimuove parole comuni e termini generici)
            wreck_names = filter_valid_wreck_names(wreck_names_raw)
            
            if wreck_names:
                # ✅ FIX MarineDivingCenter: Trovati relitti specifici nel contenuto! Crea POI per ciascuno
                logger.logger.info(f"[POI-MARINE-WEB] ✅ Trovati {len(wreck_names)} relitti specifici in pagina: {wreck_names}")
                
                # ✅ FIX MarineDivingCenter: Per ogni relitto trovato, estrai informazioni dal contenuto e rielabora con AI
                pois_list = []
                for wreck_name in wreck_names:
                    # ✅ FIX MarineGPTFilter: Filtro GPT opzionale per nome relitto (se abilitato)
                    try:
                        from .semantic_gpt_filter import get_gpt_filter
                        gpt_filter = get_gpt_filter()
                        if gpt_filter and gpt_filter.is_operational:
                            # ✅ FIX MarineGPTFilter: Estrai contesto del relitto dal contenuto
                            wreck_context = self._extract_wreck_context(page_content, wreck_name)
                            if wreck_context:
                                # ✅ FIX MarineGPTFilter: Analizza contesto con GPT (livello 2 - estrazione dettagliata)
                                gpt_result = await gpt_filter.gpt_extractor_level2(wreck_context)
                                if gpt_result:
                                    pois_list = gpt_result.get("pois", [])
                                    
                                    if not pois_list or len(pois_list) == 0:
                                        logger.logger.info(f"[MARINE-GPT] ❌ Relitto '{wreck_name}' scartato da GPT: nessun POI marino trovato")
                                        continue
                                    
                                    # ✅ FIX MarineGPTFilter: Usa il primo POI valido estratto da GPT
                                    first_poi = pois_list[0]
                                    extracted_name = first_poi.get("name", "").strip()
                                    poi_type = first_poi.get("type", "wreck")
                                    # ✅ FIX ConfidenceConversion: Conversione sicura a float per evitare errori di tipo
                                    try:
                                        confidence_raw = first_poi.get("confidence", 0.0)
                                        confidence = float(confidence_raw or 0)
                                    except (ValueError, TypeError):
                                        confidence = 0.0
                                    
                                    if extracted_name and extracted_name != wreck_name:
                                        logger.logger.info(f"[MARINE-GPT] ✅ Nome relitto corretto da GPT: '{wreck_name}' → '{extracted_name}' (confidence: {confidence})")
                                        wreck_name = extracted_name
                                    else:
                                        logger.logger.info(f"[MARINE-GPT] ✅ Relitto '{wreck_name}' validato da GPT (tipo: {poi_type}, confidence: {confidence})")
                    except Exception as e:
                        # ✅ FIX MarineGPTFilter: Fallback silenzioso se GPT non è disponibile
                        logger.logger.debug(f"[MARINE-GPT] ⚠️ Filtro GPT non disponibile per '{wreck_name}' (continuo senza GPT): {e}")
                        pass  # Continua senza GPT
                    
                    # Estrai coordinate e descrizione dal contenuto per questo relitto specifico
                    coordinates = self._extract_coordinates_for_wreck(page_content, wreck_name, bbox)
                    description = self._extract_description_for_wreck(page_content, wreck_name)
                    
                    if self._is_suspicious_name(wreck_name):
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Nome relitto sospetto '{wreck_name}' - POI scartato")
                        continue

                    # Se non abbiamo coordinate, segnala POI incompleto
                    if not coordinates:
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Coordinate mancanti per '{wreck_name}' - POI incompleto, scarto")
                        continue
                    
                    lat, lng = coordinates
                    
                    # ✅ FIX MarineWreckFinder: Verifica che sia dentro la zona
                    from .utils import point_in_polygon
                    if not point_in_polygon((lat, lng), polygon):
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ POI fuori zona: '{wreck_name}' ({lat}, {lng}) - ESCLUSO")
                        continue
                    
                    # ✅ FIX MarineWreckFinder: Estrai profondità se disponibile
                    depth = self._extract_depth(page_content, wreck_name)
                    if depth:
                        description += f" Profondità: {depth}."
                        logger.logger.info(f"[MARINE] Wreck detected: {wreck_name} - {depth} depth")
                    else:
                        logger.logger.info(f"[MARINE] Wreck detected: {wreck_name}")
                    
                    # ✅ FIX MarineWreckFinder: Rielabora descrizione con AI per renderla storica e interessante per turisti
                    description = await self._ai_summarize_wreck_description(wreck_name, description, zone_name)
                    
                    # Costruisci POI
                    poi = {
                        "name": wreck_name,
                        "description": description,
                        "lat": lat,
                        "lng": lng,
                        "source": "Web Search",  # ✅ FIX MarineWreckFinder: Source è "Web Search" (non Wikipedia)
                        "type": "marine",
                        "marine_type": "wreck",
                        "url": url
                    }
                    
                    # ✅ FIX MarineWreckFinder: Aggiungi profondità se disponibile
                    if depth:
                        poi["depth"] = depth
                    
                    pois_list.append(poi)
                    logger.logger.info(f"[POI-MARINE] ✅ POI accettato: {wreck_name} — motivo: valid wreck term & coordinate verificate")
                    
                    # ✅ FIX MarineWreckFinder: Log formattato come richiesto
                    municipality_name = ""
                    if municipalities and isinstance(municipalities, list) and len(municipalities) > 0:
                        # Trova il municipio più vicino alle coordinate (usa il primo disponibile per ora)
                        for m in municipalities:
                            if isinstance(m, str) and len(m.strip()) > 0:
                                municipality_name = m.strip()
                                break  # Usa il primo municipio valido
                    
                    logger.logger.info(f"[MARINE] POI saved: {wreck_name} ({municipality_name if municipality_name else zone_name})")
                    logger.logger.info(f"[POI-MARINE-WEB] ✅ POI creato per relitto '{wreck_name}': {poi.get('name')} (lat: {poi.get('lat')}, lng: {poi.get('lng')})")
                
                # ✅ FIX MarineWreckFinder: Restituisci TUTTI i POI trovati (non solo il primo)
                if pois_list:
                    logger.logger.info(f"[MARINE] Returning {len(pois_list)} wrecks from diving center: {[p.get('name') for p in pois_list]}")
                    # ✅ FIX MarineWreckFinder: Restituisci lista di POI (non singolo POI)
                    # Nota: La funzione restituisce Optional[Dict], ma restituiamo una lista di POI
                    # Questo sarà gestito dal chiamante (search_marine_wrecks)
                    return pois_list  # ✅ FIX MarineWreckFinder: Restituisci lista completa
                else:
                    logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Nessun POI valido creato dai {len(wreck_names)} relitti trovati")
                    return None
            else:
                # ✅ FIX MarineWreckFinder: Nessun relitto specifico trovato nel contenuto
                # Prova a estrarre da titolo/snippet se contiene indicatori di relitto
                text = (title + " " + snippet).lower()
                if any(indicator in text for indicator in WRECK_INDICATORS):
                    name_raw = self._extract_wreck_name(title, page_content, zone_name)
                    
                    # ✅ FIX MarineFilter: Filtra nome estratto (rimuove parole comuni e termini generici)
                    name_filtered = filter_valid_wreck_names([name_raw]) if name_raw else []
                    
                    if not name_filtered:
                        # Se il nome filtrato è vuoto, escludi
                        logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Nome generico '{name_raw}' - cercherò relitti nel contenuto")
                        return None  # Escludi - probabilmente non è un relitto specifico
                    
                    name = name_filtered[0]  # Prendi il primo nome valido
                    
                    # ✅ FIX MarineWeb: Verifica aggiuntiva che il nome non sia generico (home page, ecc.)
                    if any(keyword in name.lower() for keyword in ['home', 'centro sub', 'diving center', 'dive center']):
                        # Se è un nome generico, cerca comunque nel contenuto per trovare relitti
                        logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Nome generico '{name}' - cercherò relitti nel contenuto")
                        return None  # Escludi - probabilmente non è un relitto specifico
                    
                    # Estrai descrizione e rielabora con AI
                    raw_description = self._extract_description(snippet, page_content)
                    description = await self._ai_summarize_wreck_description(name, raw_description, zone_name)
                    
                    # Estrai coordinate
                    coordinates = self._extract_coordinates(page_content, bbox)
                    if not coordinates:
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Coordinate mancanti per '{name}' - POI incompleto, scarto")
                        return None
                    
                    lat, lng = coordinates
                    
                    # ✅ FIX MarineWeb: Verifica che sia dentro la zona
                    if not point_in_polygon((lat, lng), polygon):
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ POI fuori zona: '{name}' ({lat}, {lng}) - ESCLUSO (coordinate devono essere dentro il poligono)")
                        return None
                    
                    # Costruisci POI
                    poi = {
                        "name": name,
                        "description": description,
                        "lat": lat,
                        "lng": lng,
                        "source": "Web Search",
                        "type": "marine",  # ✅ FIX MarineType: type deve essere "marine" per compatibilità con _organize_final_results
                        "marine_type": "wreck",
                        "url": url
                    }
                    
                    if self._is_suspicious_name(name):
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Nome relitto sospetto '{name}' - POI scartato")
                        return None

                    logger.logger.info(f"[POI-MARINE] ✅ POI accettato: {name} — motivo: wreck indicator nel titolo/snippet con coordinate coerenti")
                    return poi
                else:
                    # Nessun indicatore di relitto - escludi
                    logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Nessun indicatore relitto nel titolo/snippet: {domain} - ESCLUSO (titolo: '{title[:50]}...', snippet: '{snippet[:50]}...')")
                    return None
            
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore estrazione POI da {url}: {str(e)}")
            return None
    
    async def _fetch_page_content(self, url: str) -> Optional[str]:
        """✅ FIX MarineWeb: Scarica contenuto pagina web"""
        try:
            logger.logger.debug(f"[POI-MARINE-WEB] 🔍 Scaricamento pagina: {url}")
            async with aiohttp.ClientSession(timeout=self.timeout, headers=self.headers) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        content = await response.text()
                        logger.logger.debug(f"[POI-MARINE-WEB] ✅ Pagina scaricata: {len(content)} caratteri")
                        return content
                    else:
                        logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore HTTP {response.status} per {url}")
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore fetch pagina {url}: {str(e)}")
        return None
    
    def _extract_wreck_name(self, title: str, content: str, zone_name: str) -> str:
        """✅ FIX MarineUniversal: Estrae nome relitto da titolo/contenuto (universale - multilingue)"""
        # Prova a estrarre nome dal titolo
        title_clean = title.strip()
        
        # ✅ FIX MarineUniversal: Rimuovi prefissi comuni (multilingue)
        prefixes = [
            # Inglese
            "Wreck ", "Shipwreck ", "The wreck ", "The shipwreck ",
            # Italiano
            "Relitto ", "Naufragio ", "Il relitto ", "La nave ",
            # Francese
            "Épave ", "Naufrage ", "L'épave ", "Le naufrage ",
            # Spagnolo
            "Pez ", "Naufragio ", "El pez ", "La nave ",
            # Tedesco
            "Wrack ", "Schiffswrack ", "Das Wrack ", "Der Wrack ",
            # Greco
            "Ναυάγιο ", "Το ναυάγιο ",
            # Generici
            "Il ", "La ", "Lo ", "The ", "Le ", "Les ", "El ", "Los ", "Das ", "Die ", "Der "
        ]
        
        for prefix in prefixes:
            if title_clean.lower().startswith(prefix.lower()):
                title_clean = title_clean[len(prefix):].strip()
        
        # Se il titolo è troppo corto, cerca nel contenuto
        if len(title_clean) < 3:
            # ✅ FIX MarineUniversal: Cerca pattern multilingue "Relitto/Wreck/Épave [Nome]" nel contenuto
            pattern = r'(?:relitto|wreck|shipwreck|naufragio|épave|naufrage|pez|naufragio|wrack|schiffswrack|ναυάγιο)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                title_clean = match.group(1)
        
        # ✅ FIX MarineUniversal: Fallback universale (non hardcoded in italiano)
        return title_clean if title_clean else f"Wreck {zone_name}"
    
    def _extract_description(self, snippet: str, content: str) -> str:
        """✅ FIX MarineUniversal: Estrae descrizione da snippet/contenuto (universale - multilingue)"""
        # Usa snippet se disponibile
        if snippet and len(snippet) > 20:
            return snippet[:500]  # Limita a 500 caratteri
        
        # Altrimenti cerca nel contenuto
        soup = BeautifulSoup(content, 'html.parser')
        
        # Rimuovi script e style
        for script in soup(["script", "style"]):
            script.decompose()
        
        # ✅ FIX MarineUniversal: Cerca paragrafi rilevanti (multilingue)
        paragraphs = soup.find_all('p')
        for p in paragraphs:
            text = p.get_text(strip=True)
            # Keywords universali per identificare descrizioni di relitti (multilingue)
            wreck_keywords = [
                # Inglese
                'wreck', 'shipwreck', 'sunk', 'sunken', 'underwater',
                # Italiano
                'relitto', 'naufragio', 'affondato', 'sommerso', 'subacqueo',
                # Francese
                'épave', 'naufrage', 'coulé', 'sous-marin', 'submergé',
                # Spagnolo
                'pez', 'naufragio', 'hundido', 'submarino', 'sumergido',
                # Tedesco
                'wrack', 'schiffswrack', 'versenkt', 'unterwasser', 'untergetaucht',
                # Greco
                'ναυάγιο', 'βυθισμένο', 'υποβρύχιο',
            ]
            if len(text) > 50 and any(word in text.lower() for word in wreck_keywords):
                return text[:500]
        
        # ✅ FIX MarineUniversal: Fallback universale (non hardcoded in italiano)
        return snippet[:500] if snippet else "Marine wreck."
    
    def _extract_coordinates(self, content: str, bbox: Tuple[float, float, float, float]) -> Optional[Tuple[float, float]]:
        """✅ FIX MarineWeb: Estrae coordinate da contenuto pagina"""
        # Pattern per coordinate (lat, lng) - pattern più completi
        patterns = [
            r'lat[itude]*[:=]\s*(\d+\.\d+).*lng[ongitude]*[:=]\s*(\d+\.\d+)',  # lat: 44.1234 lng: 9.5678
            r'GPS[:=]\s*(\d+\.\d+)[,\s]+(\d+\.\d+)',  # GPS: 44.1234, 9.5678
            r'coordinat[ae][:=]\s*(\d+\.\d+)[,\s]+(\d+\.\d+)',  # coordinate: 44.1234, 9.5678
            r'(\d+\.\d+)[°\s,]+(\d+\.\d+)',  # 44.1234° 9.5678
            r'(\d+\.\d+),\s*(\d+\.\d+)',  # 44.1234, 9.5678
        ]
        
        south, west, north, east = bbox
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                try:
                    # Gestisci diversi formati di coordinate
                    if len(match) == 2:
                        lat = float(match[0])
                        lng = float(match[1])
                    elif len(match) == 6:
                        # Formato gradi/minuti/secondi
                        lat_deg = float(match[0])
                        lat_min = float(match[1])
                        lat_sec = float(match[2])
                        lng_deg = float(match[3])
                        lng_min = float(match[4])
                        lng_sec = float(match[5])
                        lat = lat_deg + lat_min/60 + lat_sec/3600
                        lng = lng_deg + lng_min/60 + lng_sec/3600
                    else:
                        continue
                    
                    # Verifica che siano coordinate valide e nel bbox
                    if (-90 <= lat <= 90 and -180 <= lng <= 180 and
                        south <= lat <= north and west <= lng <= east):
                        logger.logger.debug(f"[POI-MARINE-WEB] ✅ Coordinate estratte: {lat}, {lng}")
                        return (lat, lng)
                except (ValueError, IndexError):
                    continue
        
        return None
    
    def _extract_wreck_names_from_content(self, content: str, zone_name: str) -> List[str]:
        """✅ FIX MarineWreckFinder: Estrae nomi di relitti specifici dal contenuto pagina diving center (migliorato)"""
        wreck_names = []
        
        # ✅ FIX MarineWreckFinder: Pattern migliorati per trovare nomi di relitti nei diving center
        # Pattern più specifici per diving center (es. "Relitto Haven", "Wreck Mohawk Deer", "Haven - 45m")
        patterns = [
            # Pattern con nome relitto dopo keyword (es. "Relitto Haven", "Wreck Mohawk Deer")
            r'(?:relitto|wreck|shipwreck|naufragio|épave|naufrage|pez|wrack|schiffswrack|ναυάγιο)\s+(?:del|della|dell\'|di|denominato|chiamato|nome|of|the|de|du|des|el|la|los|das|die|der|το|της|του)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)',
            r'(?:relitto|wreck|shipwreck|naufragio|épave|naufrage|pez|wrack|schiffswrack|ναυάγιο)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)',
            # Pattern con nome relitto prima di keyword (es. "Haven relitto", "Mohawk Deer wreck")
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)\s+(?:relitto|wreck|shipwreck|naufragio|épave|naufrage|pez|wrack|schiffswrack|ναυάγιο)',
            # Pattern con nome relitto seguito da profondità (es. "Haven - 45m", "Mohawk Deer - 52 metri")
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)\s*[-–—]\s*\d+\s*(?:m|metri|meters|ft|feet)',
            # Pattern con nome relitto in liste (es. "• Haven", "- Mohawk Deer", "1. Genoa")
            r'(?:[•\-\d\.]\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)',
        ]
        
        # ✅ FIX MarineWreckFinder: Escludi parole generiche e nomi troppo lunghi (probabilmente non sono relitti)
        generic_words = [
            # Italiano
            'Il', 'La', 'Lo', 'Del', 'Della', 'Dell', 'Di', 'Dei', 'Delle', 'Home', 'Centro', 'Sub',
            'Comune', 'Scuole', 'Tecnici', 'novembre', 'Sezioni', 'Cerca', 'Notifiche', 'Vetrina',
            'Abbonati', 'Meteo', 'Newsletter', 'Edizioni', 'Genova', 'Liguria', 'Levante', 'Savona',
            'La Spezia', 'Imperia', 'Piemonte', 'Italia', 'Mondo', 'Economia', 'Cultura', 'Marinara',
            'Sfratto', 'Congresso', 'Sifo', 'Secolo', 'XIX', 'Assonat', 'Porti', 'Ormeggi', 'Turismo',
            'Yacht', 'Barche', 'Navi', 'Epoca', 'News', 'Report', 'Notizie', 'Articolo', 'Giornale',
            'Quotidiano', 'Reporter', 'Nautica', 'Report', 'Portofino', 'Rapallo', 'Sestri', 'Levante',
            'Camogli', 'Lavagna', 'Chiavari', 'Santa', 'Margherita', 'Ligure', 'Riva', 'Trigoso',
            # Inglese
            'The', 'Of', 'A', 'An', 'Home', 'Center', 'Diving', 'Dive', 'Yacht', 'Barche', 'Navi',
            'Epoca', 'Turismo', 'Ormeggi', 'Porti', 'News', 'Report',
            # Francese
            'Le', 'La', 'Les', 'De', 'Du', 'Des', 'Centre', 'Plongée',
            # Spagnolo
            'El', 'La', 'Los', 'Las', 'De', 'Del', 'De la', 'De los', 'De las', 'Centro', 'Buceo',
            # Tedesco
            'Das', 'Die', 'Der', 'Von', 'Des', 'Zentrum', 'Tauchen',
            # Greco
            'Το', 'Η', 'Οι', 'Της', 'Του', 'Των',
        ]
        
        # ✅ FIX MarineWreckFinder: Usa BeautifulSoup per estrarre testo pulito
        try:
            soup = BeautifulSoup(content, 'html.parser')
            # Rimuovi script e style
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            # Estrai testo da paragrafi e liste
            text_content = soup.get_text(separator=' ', strip=True)
        except:
            text_content = content
        
        # ✅ FIX MarineWreckFinder: Cerca pattern nel contenuto (molto più selettivo)
        for pattern in patterns:
            matches = re.findall(pattern, text_content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                name = match.strip()
                
                # ✅ FIX MarineWreckFinder: Filtri molto più rigorosi
                # 1. Lunghezza minima 4 caratteri, massima 50 caratteri (nomi troppo lunghi sono probabilmente errori)
                if len(name) < 4 or len(name) > 50:
                    continue
                
                # 2. Non deve essere una parola generica
                if name in generic_words:
                    continue
                
                # 3. Non deve contenere URL o caratteri strani
                if name.lower().startswith('http') or any(char in name for char in ['/', '\\', '@', '#', '%']):
                    continue
                
                # 4. Non deve contenere keyword di navigazione/pagina, giornali, news, o nomi di comuni
                # ✅ FIX MarineWreckFinder: Escludi anche parole comuni inglesi/italiane che non sono nomi di relitti
                if any(keyword in name.lower() for keyword in [
                    'home', 'centro', 'center', 'diving', 'dive', 'sub', 'page', 'site', 'menu',
                    'cerca', 'notifiche', 'vetrina', 'abbonati', 'meteo', 'newsletter', 'edizioni',
                    'sezioni', 'genova', 'liguria', 'savona', 'italia', 'mondo', 'economia', 'cultura',
                    'marinara', 'scuole', 'tecnici', 'novembre', 'comune', 'sfratto', 'congresso',
                    'sifo', 'secolo', 'xix', 'assonat', 'porti', 'ormeggi', 'turismo', 'yacht',
                    'barche', 'navi', 'epoca', 'news', 'report', 'notizie', 'articolo', 'giornale',
                    'quotidiano', 'reporter', 'nautica', 'portofino', 'rapallo', 'sestri', 'levante',
                    'camogli', 'lavagna', 'chiavari', 'santa', 'margherita', 'ligure', 'riva', 'trigoso',
                    # ✅ FIX MarineWreckFinder: Escludi parole comuni che spesso vengono estratte erroneamente
                    'padi', 'tutti', 'iscriviti', 'reviews', 'april', 'read', 'more', 'dates', 'secure',
                    'booking', 'process', 'this', 'having', 'landed', 'sono', 'sufficienti', 'gommone',
                    'pm', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'address', 'via', 'fortunato',
                    'sign', 'up', 'show', 'all', 'phone', 'currency', 'eur', 'voltage', 'limited',
                    'supply', 'find', 'most', 'recently', 'in', 'note', 'norte', 'mz', 'entre',
                    'playa', 'del', 'carmen', 'kitts', 'maarten', 'south', 'wetsuit', 'what',
                    'free', 'nitrox', 'their', 'please', 'note', 'that', 'sorry', 'terza', 'attivit',
                    'terzo', 'quarta', 'messaggio', 'precedente', 'laggi', 'banner', 'preferenze',
                    'statistiche', 'marketing', 'minimum', 'depth', 'la', 'petroliera', 'coperta'
                ]):
                    continue
                
                # 5. Non deve essere una frase completa (massimo 3 parole)
                words = name.split()
                if len(words) > 3:
                    continue
                
                # 6. Deve iniziare con una lettera maiuscola (probabilmente un nome proprio)
                if not name[0].isupper():
                    continue
                
                # 7. Non deve contenere solo numeri o caratteri speciali
                if not any(c.isalpha() for c in name):
                    continue
                
                # ✅ FIX MarineWreckFinder: Se passa tutti i filtri, è probabilmente un nome di relitto valido
                if name not in wreck_names:
                    wreck_names.append(name)
                    logger.logger.debug(f"[MARINE] Wreck name extracted: '{name}'")
        
        # ✅ FIX MarineWreckFinder: Se non trovati con pattern, cerca in liste HTML (spesso diving center hanno liste di relitti)
        if not wreck_names:
            try:
                soup = BeautifulSoup(content, 'html.parser')
                # Cerca in liste (ul, ol)
                for list_tag in soup.find_all(['ul', 'ol']):
                    for item in list_tag.find_all('li', limit=10):
                        item_text = item.get_text(strip=True)
                        # ✅ FIX MarineWreckFinder: Verifica che contenga indicatori di relitto E che sia in un contesto diving
                        if any(indicator in item_text.lower() for indicator in WRECK_INDICATORS):
                            # Estrai nome (prima parte del testo, prima di " - " o "(" o "—")
                            name = re.split(r'[-–—(]', item_text)[0].strip()
                            
                            # ✅ FIX MarineWreckFinder: Applica gli stessi filtri rigorosi
                            if (len(name) >= 4 and len(name) <= 50 and 
                                name not in generic_words and 
                                not name.lower().startswith('http') and
                                not any(keyword in name.lower() for keyword in [
                                    'home', 'centro', 'center', 'diving', 'dive', 'sub', 'page', 'site', 'menu',
                                    'cerca', 'notifiche', 'marinara', 'scuole', 'tecnici', 'novembre', 'comune',
                                    'sfratto', 'congresso', 'sifo', 'secolo', 'xix', 'assonat', 'porti', 'ormeggi',
                                    'turismo', 'yacht', 'barche', 'navi', 'epoca', 'news', 'report', 'notizie',
                                    'articolo', 'giornale', 'quotidiano', 'reporter', 'nautica', 'portofino',
                                    'rapallo', 'sestri', 'levante', 'camogli', 'lavagna', 'chiavari', 'santa',
                                    'margherita', 'ligure', 'riva', 'trigoso',
                                    # ✅ FIX MarineWreckFinder: Escludi parole comuni che spesso vengono estratte erroneamente
                                    'padi', 'tutti', 'iscriviti', 'reviews', 'april', 'read', 'more', 'dates', 'secure',
                                    'booking', 'process', 'this', 'having', 'landed', 'sono', 'sufficienti', 'gommone',
                                    'pm', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'address', 'via', 'fortunato',
                                    'sign', 'up', 'show', 'all', 'phone', 'currency', 'eur', 'voltage', 'limited',
                                    'supply', 'find', 'most', 'recently', 'in', 'note', 'norte', 'mz', 'entre',
                                    'playa', 'del', 'carmen', 'kitts', 'maarten', 'south', 'wetsuit', 'what',
                                    'free', 'nitrox', 'their', 'please', 'note', 'that', 'sorry', 'terza', 'attivit',
                                    'terzo', 'quarta', 'messaggio', 'precedente', 'laggi', 'banner', 'preferenze',
                                    'statistiche', 'marketing', 'minimum', 'depth', 'la', 'petroliera', 'coperta'
                                ]) and
                                len(name.split()) <= 3 and
                                name[0].isupper() and
                                any(c.isalpha() for c in name)):
                                if name not in wreck_names:
                                    wreck_names.append(name)
                                    logger.logger.debug(f"[MARINE] Wreck name from list: '{name}'")
            except Exception as e:
                logger.logger.debug(f"[MARINE] Error extracting from HTML lists: {str(e)}")
        
        logger.logger.info(f"[MARINE] Found {len(wreck_names)} wreck names in content: {wreck_names}")
        return wreck_names[:5]  # ✅ FIX MarineWreckFinder: Aumentato a 5 relitti per pagina
    
    def _extract_coordinates_for_wreck(self, content: str, wreck_name: str, bbox: Tuple[float, float, float, float]) -> Optional[Tuple[float, float]]:
        """✅ FIX MarineWeb: Estrae coordinate per un relitto specifico"""
        # Cerca coordinate vicino al nome del relitto (entro 300 caratteri)
        name_pos = content.lower().find(wreck_name.lower())
        if name_pos >= 0:
            context = content[max(0, name_pos - 150):name_pos + 300]
            coordinates = self._extract_coordinates(context, bbox)
            if coordinates:
                logger.logger.debug(f"[POI-MARINE-WEB] ✅ Coordinate trovate per '{wreck_name}': {coordinates}")
            return coordinates
        return None
    
    def _extract_wreck_context(self, content: str, wreck_name: str) -> str:
        """✅ FIX MarineGPTFilter: Estrae contesto del relitto dal contenuto per analisi GPT
        
        Args:
            content: Contenuto completo della pagina
            wreck_name: Nome del relitto da cercare
            
        Returns:
            Contesto estratto (circa 500 caratteri intorno al nome)
        """
        try:
            # ✅ FIX MarineGPTFilter: Cerca nome relitto nel contenuto (case-insensitive)
            content_lower = content.lower()
            wreck_name_lower = wreck_name.lower()
            
            # Trova posizione del nome nel contenuto
            pos = content_lower.find(wreck_name_lower)
            if pos == -1:
                # Se non trovato, usa un campione del contenuto
                return content[:500]
            
            # ✅ FIX MarineGPTFilter: Estrai contesto (250 caratteri prima e dopo)
            start = max(0, pos - 250)
            end = min(len(content), pos + len(wreck_name) + 250)
            context = content[start:end]
            
            return context.strip()
        except Exception as e:
            logger.logger.debug(f"[MARINE-GPT] ⚠️ Errore estrazione contesto per '{wreck_name}': {e}")
            return content[:500]  # Fallback: usa primi 500 caratteri
    
    def _extract_description_for_wreck(self, content: str, wreck_name: str) -> str:
        """✅ FIX MarineWreckFinder: Estrae descrizione e profondità per un relitto specifico (migliorato)"""
        # ✅ FIX MarineWreckFinder: Usa BeautifulSoup per estrarre testo pulito
        try:
            soup = BeautifulSoup(content, 'html.parser')
            # Rimuovi script e style
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            text_content = soup.get_text(separator=' ', strip=True)
        except:
            text_content = content
        
        # ✅ FIX MarineWreckFinder: Cerca frasi che contengono il nome del relitto
        sentences = text_content.split('.')
        # ✅ FIX MarineWreckFinder: Keywords universali per identificare descrizioni di relitti (multilingue)
        wreck_keywords = [
            # Inglese
            'wreck', 'shipwreck', 'sunk', 'sunken', 'underwater',
            # Italiano
            'relitto', 'naufragio', 'affondato', 'sommerso', 'subacqueo',
            # Francese
            'épave', 'naufrage', 'coulé', 'sous-marin', 'submergé',
            # Spagnolo
            'pez', 'naufragio', 'hundido', 'submarino', 'sumergido',
            # Tedesco
            'wrack', 'schiffswrack', 'versenkt', 'unterwasser', 'untergetaucht',
            # Greco
            'ναυάγιο', 'βυθισμένο', 'υποβρύχιο',
        ]
        relevant_sentences = [
            s.strip() for s in sentences 
            if wreck_name.lower() in s.lower() and 
            any(word in s.lower() for word in wreck_keywords)
        ]
        
        description = '. '.join(relevant_sentences[:3])[:500] if relevant_sentences else ""
        
        # ✅ FIX MarineWreckFinder: Estrai profondità (es. "40m", "52 metri", "120 feet")
        depth = self._extract_depth(content, wreck_name)
        if depth:
            description += f" Profondità: {depth}."
        
        if description:
            return description
        
        # ✅ FIX MarineWreckFinder: Fallback universale
        return f"Wreck {wreck_name} in the area."
    
    def _extract_depth(self, content: str, wreck_name: str) -> Optional[str]:
        """✅ FIX MarineWreckFinder: Estrae profondità del relitto (es. 40m, 52 metri, 120 feet)"""
        # ✅ FIX MarineWreckFinder: Cerca profondità vicino al nome del relitto (entro 200 caratteri)
        name_pos = content.lower().find(wreck_name.lower())
        if name_pos >= 0:
            context = content[max(0, name_pos - 100):name_pos + 200]
            # Pattern per profondità (es. "40m", "52 metri", "120 feet", "45 metri")
            depth_patterns = [
                r'(\d+)\s*(?:m|metri|meters|metres)\b',
                r'(\d+)\s*(?:ft|feet|piedi)\b',
                r'profondit[àa]?\s*[:=]\s*(\d+)\s*(?:m|metri|meters|metres|ft|feet|piedi)?\b',
                r'depth\s*[:=]\s*(\d+)\s*(?:m|metri|meters|metres|ft|feet|piedi)?\b',
            ]
            
            for pattern in depth_patterns:
                matches = re.findall(pattern, context, re.IGNORECASE)
                if matches:
                    depth_value = matches[0]
                    # Determina unità
                    if 'ft' in context.lower() or 'feet' in context.lower() or 'piedi' in context.lower():
                        return f"{depth_value} ft"
                    else:
                        return f"{depth_value} m"
        
        return None
    
    async def _search_wreck_details(self, wreck_name: str, zone_name: str, 
                                   bbox: Tuple[float, float, float, float],
                                   polygon: List[List[float]]) -> Optional[Dict]:
        """✅ FIX MarineWeb: Cerca informazioni specifiche su un relitto trovato"""
        try:
            logger.logger.info(f"[POI-MARINE-WEB] 🔍 Ricerca dettagli per relitto '{wreck_name}'...")
            
            # Cerca informazioni specifiche su questo relitto
            search_query = f"{wreck_name} relitto {zone_name}"
            search_results = await self._duckduckgo_search(search_query, max_results=3)
            
            best_description = None
            best_coordinates = None
            
            for url, title, snippet in search_results:
                # Se il risultato sembra rilevante, scarica la pagina
                if wreck_name.lower() in title.lower() or wreck_name.lower() in snippet.lower():
                    page_content = await self._fetch_page_content(url)
                    if page_content:
                        # Estrai descrizione più dettagliata
                        description = self._extract_description_for_wreck(page_content, wreck_name)
                        if description and len(description) > 50:
                            best_description = description
                        
                        # Estrai coordinate specifiche per questo relitto
                        coordinates = self._extract_coordinates_for_wreck(page_content, wreck_name, bbox)
                        if coordinates:
                            best_coordinates = coordinates
                            break  # Coordinate trovate, usa questa pagina
            
            # Se non trovi coordinate specifiche, prova a estrarle dalla zona
            if not best_coordinates:
                # Cerca coordinate nel contenuto delle pagine trovate
                for url, title, snippet in search_results:
                    if wreck_name.lower() in title.lower():
                        page_content = await self._fetch_page_content(url)
                        if page_content:
                            coordinates = self._extract_coordinates(page_content, bbox)
                            if coordinates:
                                best_coordinates = coordinates
                                break
            
            # Se ancora non trovi coordinate, segnala POI incompleto
            if not best_coordinates:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Coordinate non trovate per '{wreck_name}' dopo tentativi multipli - POI incompleto, scarto")
                return None
            
            # Rielabora descrizione con AI
            raw_description = best_description or f"Relitto {wreck_name} nella zona {zone_name}."
            description = await self._ai_summarize_wreck_description(wreck_name, raw_description, zone_name)
            
            # Costruisci POI
            poi = {
                "name": wreck_name,
                "description": description,
                "lat": best_coordinates[0],
                "lng": best_coordinates[1],
                "source": "Web Search",
                "type": "marine",  # ✅ FIX MarineType: type deve essere "marine" per compatibilità con _organize_final_results
                "marine_type": "wreck",
                "url": search_results[0][0] if search_results else ""
            }
            
            logger.logger.info(f"[POI-MARINE-WEB] ✅ POI creato per relitto '{wreck_name}': {description[:50]}...")
            return poi
            
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore ricerca dettagli per '{wreck_name}': {str(e)}")
            return None
    
    async def _ai_summarize_wreck_description(self, wreck_name: str, raw_description: str, zone_name: str) -> str:
        """✅ FIX MarineWeb: Rielabora descrizione del relitto con AI (non copiare, rielaborare!)"""
        try:
            # ✅ FIX MarineWeb: Usa la funzione AI summarize_texts da extended_enrichment
            try:
                from .extended_enrichment import ai_summarize_texts
                
                # Prepara snippet per AI summarization
                snippets = [{
                    "title": f"Relitto {wreck_name}",
                    "text": raw_description,
                    "url": ""
                }]
                
                # Chiama AI per rielaborare (non copiare!)
                ai_description = await ai_summarize_texts(snippets, wreck_name, zone_name)
                
                if ai_description and len(ai_description) > 20:
                    logger.logger.info(f"[POI-MARINE-WEB] ✅ Descrizione rielaborata con AI per '{wreck_name}': {len(ai_description)} caratteri")
                    return ai_description[:500]  # Limita a 500 caratteri
                else:
                    logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ AI non ha generato descrizione valida per '{wreck_name}' - uso descrizione originale")
                    return raw_description[:500]
                    
            except ImportError:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Modulo AI enrichment non disponibile - uso descrizione originale")
                return raw_description[:500]
            except Exception as e:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore AI enrichment per '{wreck_name}': {str(e)} - uso descrizione originale")
                return raw_description[:500]
                
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore generico AI summarization: {str(e)}")
            return raw_description[:500]
    
    async def _search_google_cse(self, query: str) -> List[Dict]:
        """✅ FIX MarineWeb: Chiama Google CSE tramite API Node.js interna con query specifica
        
        Args:
            query: Query di ricerca (es. "relitti Lerici Italy" o "Golfo dei Poeti 3")
        """
        try:
            import os
            # Chiama endpoint Node.js interno
            node_api_url = f"http://127.0.0.1:3000/admin/google-cse/search"
            
            async with aiohttp.ClientSession(timeout=self.timeout, headers=self.headers) as session:
                async with session.post(
                    node_api_url,
                    json={"query": query},  # ✅ FIX MarineWeb: Passa query con chiave 'query' per usare useCustomQuery=true
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("success") and data.get("enabled"):
                            return data.get("results", [])
                        else:
                            logger.logger.debug(f"[POI-MARINE-WEB] Google CSE non abilitato o disabilitato")
                            return []
                    else:
                        logger.logger.warning(f"[POI-MARINE-WEB] Google CSE API error: {response.status}")
                        return []
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] Errore chiamata Google CSE: {str(e)}")
            return []
    
    async def _extract_marine_poi_from_cse_result(self, 
                                                 cse_result: Dict,
                                                 bbox: Tuple[float, float, float, float],
                                                 polygon: List[List[float]],
                                                 zone_name: str) -> Optional[Dict]:
        """✅ FIX MarineWeb: Estrae POI marino da risultato Google CSE"""
        try:
            title = cse_result.get("title", "")
            link = cse_result.get("link", "")
            snippet = cse_result.get("snippet", "")
            
            if not title or not link:
                return None

            domain = urlparse(link).netloc.lower()
            if not self._is_domain_allowed(domain):
                logger.logger.debug(f"[POI-MARINE-WEB] ⚠️ Escluso risultato CSE (dominio non attendibile): {domain}")
                return None
            self._track_accepted_domain(domain)
            
            # ✅ Estrai informazioni dalla pagina web (se disponibile)
            page_content = await self._fetch_page_content(link)
            
            if not page_content:
                # Se non posso scaricare la pagina, usa snippet come descrizione
                description = snippet[:500] if snippet else f"Centro diving o sito relitti nella zona {zone_name}."
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Pagina non scaricabile: {link} - uso snippet")
            else:
                # Estrai descrizione migliore dalla pagina
                description = self._extract_description(snippet, page_content)
            
            # ✅ Estrai coordinate dalla pagina o usa punto dentro poligono
            coordinates = None
            if page_content:
                coordinates = self._extract_coordinates(page_content, bbox)
            
            if not coordinates:
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Coordinate non trovate per '{title}' - POI incompleto, scarto")
                return None
            
            lat, lng = coordinates
            
            # ✅ Verifica che sia dentro la zona
            from .utils import point_in_polygon
            if not point_in_polygon((lat, lng), polygon):
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ POI fuori zona: '{title}' ({lat}, {lng}) - ESCLUSO")
                return None
            
            # ✅ Estrai nome relitto o centro diving
            name = self._extract_wreck_name(title, page_content or "", zone_name)
            if self._is_suspicious_name(name):
                logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Nome sospetto da CSE '{name}' - POI scartato")
                return None
            
            # ✅ Rielabora descrizione con AI
            description = await self._ai_summarize_wreck_description(name, description, zone_name)
            
            # Costruisci POI
            poi = {
                "name": name,
                "description": description,
                "lat": lat,
                "lng": lng,
                "source": "Google CSE",
                "type": "marine",  # ✅ FIX MarineType: type deve essere "marine" per compatibilità con _organize_final_results
                "marine_type": "wreck",
                "url": link
            }
            
            logger.logger.info(f"[POI-MARINE] ✅ POI accettato: {name} — motivo: risultato Google CSE con coordinate verificate")
            return poi
            
        except Exception as e:
            logger.logger.warning(f"[POI-MARINE-WEB] ⚠️ Errore estrazione POI da Google CSE: {str(e)}")
            return None

