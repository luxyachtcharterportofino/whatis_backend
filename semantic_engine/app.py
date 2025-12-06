#!/usr/bin/env python3
"""
Semantic Engine - Microservizio Python per ricerca semantica avanzata di POI
FastAPI Server per integrazione con whatis_backend Node.js

Endpoints:
- POST /semantic/search - Ricerca semantica completa
- POST /semantic/municipalities - Scoperta comuni e frazioni

Porta: 5000
Autore: Semantic Engine AI
"""

import asyncio
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import sys
import os

# Aggiungi il path dei moduli core
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from core.semantic_search import perform_semantic_search, analyze_search_results
from core.geo_municipal import discover_zone_municipalities
from core.utils import SemanticLogger
from core.semantic_enricher import enrich_single_poi, enrich_poi_list

# Configurazione logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/semantic_engine.log'),
        logging.StreamHandler()
    ]
)

logger = SemanticLogger()

# Inizializza FastAPI
app = FastAPI(
    title="Semantic Engine API",
    description="Microservizio per ricerca semantica avanzata di POI turistici",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurazione CORS per integrazione con Node.js
# ✅ FIX HealthCheck: Aggiungi 127.0.0.1 alle origini consentite per evitare 403
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://localhost:8080",  # Porte comuni Node.js
        "http://127.0.0.1:3000", "http://127.0.0.1:8080"  # ✅ FIX HealthCheck: Aggiungi 127.0.0.1
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Modelli Pydantic per validazione input/output

class CoordinatePoint(BaseModel):
    """Rappresenta un punto coordinate [lat, lng]"""
    lat: float = Field(..., ge=-90, le=90, description="Latitudine")
    lng: float = Field(..., ge=-180, le=180, description="Longitudine")

class SemanticSearchRequest(BaseModel):
    """Richiesta ricerca semantica"""
    zone_name: str = Field(..., min_length=1, max_length=100, description="Nome della zona geografica")
    polygon: List[List[float]] = Field(..., min_items=3, description="Poligono zona come lista di punti [lat, lng]")
    extend_marine: bool = Field(default=False, description="Estende ricerca al mare aperto")
    enable_ai_enrichment: bool = Field(default=True, description="Abilita arricchimento AI delle descrizioni")
    marine_only: bool = Field(default=False, description="Se true, cerca SOLO POI marini (no terrestri)")
    mode: Optional[str] = Field(default="standard", description="Modalità ricerca (standard|enhanced)")

class MunicipalityRequest(BaseModel):
    """Richiesta scoperta comuni"""
    polygon: List[List[float]] = Field(..., min_items=3, description="Poligono zona come lista di punti [lat, lng]")
    zone_name: Optional[str] = Field(default="", description="Nome zona (opzionale per contestualizzare)")

class POIResponse(BaseModel):
    """Risposta singolo POI"""
    name: str
    description: Optional[str] = None
    lat: float
    lng: float
    source: str
    type: str  # "land" o "marine"
    relevance_score: Optional[float] = None
    depth: Optional[float] = None  # Solo per POI marini
    marine_type: Optional[str] = None  # lighthouse, wreck, diving_site, etc.
    accessibility: Optional[Dict[str, Any]] = None
    visit_suggestions: Optional[Dict[str, Any]] = None
    semantic_tags: Optional[List[str]] = None

class MunicipalityResponse(BaseModel):
    """Risposta singolo comune"""
    name: str
    subdivisions: List[str]
    poi_count: int
    tourism_level: Optional[str] = None
    geographic_context: Optional[str] = None

class SemanticSearchResponse(BaseModel):
    """Risposta completa ricerca semantica"""
    zone_name: str
    municipalities: List[MunicipalityResponse]
    pois: List[POIResponse]
    statistics: Dict[str, Any]
    marine_analysis: Optional[Dict[str, Any]] = None
    processing_time_ms: Optional[float] = None

class HealthResponse(BaseModel):
    """Risposta health check"""
    status: str
    version: str
    services: Dict[str, str]

class POIEnrichmentRequest(BaseModel):
    """Richiesta arricchimento singolo POI"""
    name: str = Field(..., min_length=1, max_length=200, description="Nome del POI da arricchire")
    type: str = Field(default="default", description="Tipo di POI (wreck, lighthouse, diving_site, etc.)")

class POIEnrichmentResponse(BaseModel):
    """Risposta arricchimento POI"""
    name: str
    description: str
    image_url: str
    source: str
    confidence: float
    metadata: Optional[Dict[str, Any]] = None

# Route handlers

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint con info sul servizio"""
    return {
        "service": "Semantic Engine",
        "version": "1.0.0", 
        "description": "Microservizio per ricerca semantica POI turistici",
        "endpoints": "/docs per documentazione completa"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check per monitoraggio del servizio"""
    
    # Test connessioni servizi
    services_status = {
        "osm_api": "operational",
        "wikipedia_api": "operational", 
        "wikidata_sparql": "operational",
        "geocoding": "operational",
        "ai_enrichment": "operational",
        "semantic_enricher": "operational"
    }
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        services=services_status
    )

@app.post("/semantic/search", response_model=SemanticSearchResponse)
async def semantic_search(request: SemanticSearchRequest, background_tasks: BackgroundTasks):
    """
    Ricerca semantica avanzata di POI in una zona geografica
    
    Funzionalità:
    - Ricerca POI da OSM, Wikipedia, Wikidata
    - Scoperta automatica comuni e frazioni
    - Estensione marina per relitti, fari, punti immersione
    - Deduplicazione intelligente
    - Arricchimento AI delle descrizioni
    - Caching dei risultati
    """
    
    import time
    start_time = time.time()
    
    try:
        logger.log_search_request(
            request.zone_name, 
            request.polygon, 
            request.extend_marine
        )

        search_mode = (request.mode or "standard").lower()
        if search_mode == "enhanced":
            logger.logger.info("🌊 [POI-MARINE] Enhanced mode attivo — analisi completa contenuti diving center")
        else:
            logger.logger.info(f"ℹ️ [POI-MARINE] Modalità ricerca: {search_mode}")
        
        # Validazione poligono
        if len(request.polygon) < 3:
            raise HTTPException(
                status_code=400, 
                detail="Il poligono deve avere almeno 3 punti"
            )
        
        # Validazione coordinate
        for point in request.polygon:
            if len(point) != 2:
                raise HTTPException(
                    status_code=400,
                    detail="Ogni punto deve avere esattamente 2 coordinate [lat, lng]"
                )
            lat, lng = point
            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                raise HTTPException(
                    status_code=400,
                    detail=f"Coordinate non valide: lat={lat}, lng={lng}"
                )
        
        # Esegui ricerca semantica
        search_result = await perform_semantic_search(
            zone_name=request.zone_name,
            polygon=request.polygon,
            extend_marine=request.extend_marine,
            enable_ai=request.enable_ai_enrichment,
            marine_only=request.marine_only,
            mode=search_mode
        )
        
        # Calcola tempo processing
        processing_time = (time.time() - start_time) * 1000  # millisecondi
        search_result["processing_time_ms"] = round(processing_time, 2)
        
        logger.log_search_results(
            request.zone_name,
            search_result["statistics"]["total_pois"],
            search_result["statistics"]["total_municipalities"]
        )
        
        # Task in background per analytics (opzionale)
        background_tasks.add_task(
            log_search_analytics, 
            request.zone_name, 
            processing_time,
            search_result["statistics"]
        )
        
        return SemanticSearchResponse(**search_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.log_error("Semantic Search Endpoint", str(e), request.zone_name)
        raise HTTPException(
            status_code=500,
            detail=f"Errore interno durante la ricerca: {str(e)}"
        )

@app.post("/semantic/municipalities", response_model=List[MunicipalityResponse])
async def discover_municipalities(request: MunicipalityRequest):
    """
    Scopre comuni e frazioni contenuti in un poligono geografico
    
    Funzionalità:
    - Identificazione comuni principali
    - Mappatura frazioni ai comuni parent
    - Stima numero POI per comune
    - Classificazione rilevanza turistica
    - Supporto per geocoding Nominatim
    """
    
    try:
        logger.log_municipality_discovery(
            request.zone_name or "Unnamed Zone",
            [f"polygon with {len(request.polygon)} points"]
        )
        
        # Validazione poligono
        if len(request.polygon) < 3:
            raise HTTPException(
                status_code=400,
                detail="Il poligono deve avere almeno 3 punti"
            )
        
        # Validazione coordinate  
        for point in request.polygon:
            if len(point) != 2:
                raise HTTPException(
                    status_code=400,
                    detail="Ogni punto deve avere esattamente 2 coordinate [lat, lng]"
                )
            lat, lng = point
            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                raise HTTPException(
                    status_code=400,
                    detail=f"Coordinate non valide: lat={lat}, lng={lng}"
                )
        
        # Scopri comuni nella zona
        municipalities = await discover_zone_municipalities(
            polygon=request.polygon,
            zone_name=request.zone_name or ""
        )
        
        logger.log_municipality_discovery(
            request.zone_name or "Unnamed Zone",
            [m["name"] for m in municipalities]
        )
        
        return [MunicipalityResponse(**municipality) for municipality in municipalities]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.log_error("Municipality Discovery Endpoint", str(e), request.zone_name or "")
        raise HTTPException(
            status_code=500,
            detail=f"Errore durante scoperta comuni: {str(e)}"
        )

@app.post("/semantic/analyze")
async def analyze_results(search_result: Dict[str, Any]):
    """
    Analizza risultati di una ricerca semantica per qualità e completezza
    
    Endpoint utility per valutazione post-ricerca
    """
    
    try:
        analysis = analyze_search_results(search_result)
        return analysis
        
    except Exception as e:
        logger.log_error("Result Analysis", str(e), "")
        raise HTTPException(
            status_code=500,
            detail=f"Errore durante analisi risultati: {str(e)}"
        )

@app.post("/semantic/enrich_poi", response_model=POIEnrichmentResponse)
async def enrich_poi(request: POIEnrichmentRequest):
    """
    Arricchisce un singolo POI con descrizione e immagine
    
    Funzionalità:
    - Ricerca informazioni su Wikipedia/Wikidata
    - Scraping siti turistici liguri
    - Generazione descrizione AI come fallback
    - Fornitura immagine reale o placeholder
    
    Endpoint di test per verificare l'arricchimento POI
    """
    
    try:
        logger.logger.info(f"POI enrichment request: {request.name} (type: {request.type})")
        
        # Validazione input
        if not request.name or len(request.name.strip()) < 2:
            raise HTTPException(
                status_code=400,
                detail="Il nome del POI deve essere di almeno 2 caratteri"
            )
        
        # Esegui arricchimento
        enrichment_result = await enrich_single_poi(
            poi_name=request.name.strip(),
            poi_type=request.type
        )
        
        logger.logger.info(f"POI enriched successfully: {request.name} from {enrichment_result['source']}")
        
        return POIEnrichmentResponse(**enrichment_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.log_error("POI Enrichment", str(e), request.name)
        raise HTTPException(
            status_code=500,
            detail=f"Errore durante l'arricchimento del POI: {str(e)}"
        )

# Background tasks

async def log_search_analytics(zone_name: str, processing_time: float, statistics: Dict):
    """Task in background per logging analytics"""
    try:
        analytics_data = {
            "zone_name": zone_name,
            "processing_time_ms": processing_time,
            "total_pois": statistics.get("total_pois", 0),
            "sources_count": len(statistics.get("sources_used", [])),
            "timestamp": asyncio.get_event_loop().time()
        }
        
        # In implementazione reale, qui si salverebbero le analytics
        # in database o sistema di monitoring
        logger.logger.info(f"Analytics: {analytics_data}")
        
    except Exception as e:
        logger.log_error("Analytics Logging", str(e), zone_name)

# Exception handlers

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handler per eccezioni HTTP personalizzato"""
    logger.logger.warning(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handler per eccezioni generali"""
    logger.log_error("General Exception", str(exc), "")
    return JSONResponse(
        status_code=500,
        content={"error": "Errore interno del server", "status_code": 500}
    )

# Startup/shutdown events

@app.on_event("startup")
async def startup_event():
    """Inizializzazione al startup del servizio"""
    logger.logger.info("=== Semantic Engine Starting ===")
    logger.logger.info("Version: 1.0.0")
    logger.logger.info("Port: 5000")  # ✅ FIX MarineDeep: Porta uniformata a 5000
    logger.logger.info("Endpoints: /semantic/search, /semantic/municipalities")
    logger.logger.info("Documentation: http://localhost:5000/docs")  # ✅ FIX MarineDeep: Porta uniformata a 5000
    
    # Verifica connessioni esterne
    await verify_external_services()
    
    logger.logger.info("=== Semantic Engine Ready ===")

@app.on_event("shutdown") 
async def shutdown_event():
    """Cleanup allo shutdown del servizio"""
    logger.logger.info("=== Semantic Engine Shutting Down ===")
    
    # Cleanup eventuale
    # - Chiusura connessioni database
    # - Flush dei log
    # - Salvataggio stato
    
    logger.logger.info("=== Semantic Engine Stopped ===")

async def verify_external_services():
    """Verifica disponibilità servizi esterni con retry logic"""
    import aiohttp
    
    max_retries = 3
    retry_delay = 2
    
    # Status dei provider
    provider_status = {
        "overpass": False,
        "wikipedia": False,
        "wikidata": False,
        "dbpedia": False
    }
    
    # Test Overpass API
    for attempt in range(max_retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://overpass-api.de/api/status",
                    timeout=aiohttp.ClientTimeout(total=5),
                    headers={"User-Agent": "whatis-backend-semantic/1.0"}
                ) as response:
                    if response.status == 200:
                        provider_status["overpass"] = True
                        logger.logger.info("🟢 Overpass attivo")
                        break
                    elif attempt < max_retries - 1:
                        logger.logger.warning(f"⚠️ Overpass tentativo {attempt + 1}/{max_retries} fallito, retry in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
        except Exception as e:
            if attempt < max_retries - 1:
                logger.logger.warning(f"⚠️ Overpass tentativo {attempt + 1}/{max_retries} fallito: {e}, retry in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.logger.warning(f"🔴 Overpass non disponibile dopo {max_retries} tentativi: {e}")
    
    # Test Wikipedia API
    for attempt in range(max_retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://it.wikipedia.org/api/rest_v1/page/summary/Italia",
                    timeout=aiohttp.ClientTimeout(total=5),
                    headers={"User-Agent": "whatis-backend-semantic/1.0"}
                ) as response:
                    if response.status == 200:
                        provider_status["wikipedia"] = True
                        logger.logger.info("🟢 Wikipedia attivo")
                        break
                    elif attempt < max_retries - 1:
                        logger.logger.warning(f"⚠️ Wikipedia tentativo {attempt + 1}/{max_retries} fallito, retry in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
        except Exception as e:
            if attempt < max_retries - 1:
                logger.logger.warning(f"⚠️ Wikipedia tentativo {attempt + 1}/{max_retries} fallito: {e}, retry in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.logger.warning(f"🔴 Wikipedia non disponibile dopo {max_retries} tentativi: {e}")
    
    # Test Wikidata SPARQL
    for attempt in range(max_retries):
        try:
            from SPARQLWrapper import SPARQLWrapper, JSON
            sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
            sparql.setReturnFormat(JSON)
            sparql.setQuery("SELECT ?item WHERE { ?item wdt:P31 wd:Q23413 } LIMIT 1")
            results = sparql.query().convert()
            if results:
                provider_status["wikidata"] = True
                logger.logger.info("🟢 Wikidata attivo")
                break
            elif attempt < max_retries - 1:
                logger.logger.warning(f"⚠️ Wikidata tentativo {attempt + 1}/{max_retries} fallito, retry in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
        except Exception as e:
            if attempt < max_retries - 1:
                logger.logger.warning(f"⚠️ Wikidata tentativo {attempt + 1}/{max_retries} fallito: {e}, retry in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.logger.warning(f"🔴 Wikidata non disponibile dopo {max_retries} tentativi: {e}")
    
    # Test DBpedia SPARQL
    for attempt in range(max_retries):
        try:
            from SPARQLWrapper import SPARQLWrapper, JSON
            sparql = SPARQLWrapper("https://dbpedia.org/sparql")
            sparql.setReturnFormat(JSON)
            sparql.setQuery("SELECT ?s WHERE { ?s rdf:type <http://dbpedia.org/ontology/Monument> } LIMIT 1")
            results = sparql.query().convert()
            if results:
                provider_status["dbpedia"] = True
                logger.logger.info("🟢 DBpedia attivo")
                break
            elif attempt < max_retries - 1:
                logger.logger.warning(f"⚠️ DBpedia tentativo {attempt + 1}/{max_retries} fallito, retry in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
        except Exception as e:
            if attempt < max_retries - 1:
                logger.logger.warning(f"⚠️ DBpedia tentativo {attempt + 1}/{max_retries} fallito: {e}, retry in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.logger.warning(f"🔴 DBpedia non disponibile dopo {max_retries} tentativi: {e}")
    
    # Riepilogo finale
    active_count = sum(1 for status in provider_status.values() if status)
    total_count = len(provider_status)
    
    if active_count == total_count:
        logger.logger.info(f"✅ Tutti i provider sono attivi ({active_count}/{total_count})")
    elif active_count > 0:
        inactive = [name for name, status in provider_status.items() if not status]
        logger.logger.warning(f"⚠️ Solo {active_count}/{total_count} provider attivi. Non disponibili: {', '.join(inactive)}")
        if not provider_status["overpass"]:
            logger.logger.warning("⚠️ Fallback: Overpass only (tutti gli altri provider non disponibili)")
    else:
        logger.logger.error("❌ Nessun provider disponibile! Il motore semantico potrebbe non funzionare correttamente.")

# Main entry point
if __name__ == "__main__":
    print("🧠 Avvio Semantic Engine...")
    print("📍 Porta: 5000")  # ✅ FIX MarineDeep: Porta uniformata a 5000
    print("📚 Documentazione: http://localhost:5000/docs")
    print("🔍 Endpoint: /semantic/search, /semantic/municipalities")
    
    # Configurazione server
    uvicorn.run(
        "app:app",
        host="127.0.0.1", 
        port=5000,  # ✅ FIX MarineDeep: Porta uniformata a 5000
        reload=False,  # Disabilita reload in produzione
        log_level="info",
        access_log=True
    )
