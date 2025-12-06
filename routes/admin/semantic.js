/**
 * Admin Routes - Semantic Search Management
 * 
 * Handles semantic search functionality integration:
 * - GET /admin/semantic/status - Check semantic engine status
 * - POST /admin/semantic/search - Perform semantic search
 * - POST /admin/semantic/municipalities - Discover municipalities
 * - GET /admin/semantic/stats - Get usage statistics
 * - POST /admin/semantic/cache/clear - Clear cache
 * 
 * @module routes/admin/semantic
 */

const express = require("express");
const router = express.Router();
const semanticConnector = require("../../services/semanticConnector");
// marinePoiStorage rimosso - parte della ricerca marina automatica deprecata
const Logger = require('../../utils/logger');
const Poi = require("../../models/Poi");
const Zone = require("../../models/Zone");

// =====================
// GET /admin/semantic/status - Stato del servizio semantico
// =====================
router.get("/status", async (req, res) => {
  try {
    const isAvailable = await semanticConnector.isSemanticEngineAvailable();
    const stats = semanticConnector.getUsageStats();
    
    res.json({
      available: isAvailable,
      service_url: "http://127.0.0.1:5000",  // ✅ FIX MarineAudit: Porta uniformata a 5000
      stats: stats,
      last_check: new Date().toISOString()
    });
  } catch (error) {
    Logger.error("Error checking semantic engine status:", error);
    res.status(500).json({
      available: false,
      error: error.message
    });
  }
});

// =====================
// POST /admin/semantic/search - Ricerca semantica per zona
// =====================
router.post("/search", async (req, res) => {
  try {
    let { zoneName, polygon, extendMarine, marineOnly, enableAI, mode, zone } = req.body;

    if (!zoneName && zone) {
      zoneName = zone;
    }
    
    // Validazione input
    if (!zoneName || !polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Parametri mancanti: zoneName e polygon (min 3 punti) sono obbligatori"
      });
    }
    
    const searchMode = (mode || 'standard').toLowerCase();

    Logger.info(`Admin semantic search request for zone: ${zoneName}`, {
      polygonPoints: polygon.length,
      extendMarine: !!extendMarine,
      marineOnly: !!marineOnly,
      enableAI: !!enableAI,
      mode: searchMode
    });

    if (searchMode === 'enhanced') {
      Logger.info('🌊 Enhanced mode requested — sending to semantic engine');
    } else {
      Logger.info('ℹ️ Standard semantic mode attivo');
    }
    
    // ✅ FIX: Check dei parametri marineOnly e extendMarine - non forzare a true di default
    // Esegui ricerca semantica
    const results = await semanticConnector.semanticSearch(
      zoneName,
      polygon,
      extendMarine || false, // ✅ FIX: Non forzare a true di default
      enableAI !== false, // Default true
      marineOnly || false, // ✅ FIX: Non forzare a true di default - Se true, cerca SOLO POI marini
      searchMode
    );
    
    Logger.info(`Semantic search completed for zone: ${zoneName}`, {
      totalPOIs: results.statistics?.total_pois || 0,
      municipalities: results.statistics?.total_municipalities || 0,
      sources: results.statistics?.sources_used || []
    });
    
    // Marine POI storage rimosso - parte della ricerca marina automatica deprecata
    
    // Salva risultati in cache provvisoria per revisione admin
    const cacheData = {
      zone_name: zoneName,
      search_timestamp: new Date().toISOString(),
      results: results,
      status: 'pending_review'
    };
    
    // Salva in cache semantic (gestita dal connector)
    // Gli admin potranno poi approvare i POI singolarmente
    
    res.json({
      success: true,
      results: results,
      cache_data: cacheData
    });
    
  } catch (error) {
    Logger.error("Admin semantic search error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// POST /admin/semantic/municipalities - Scoperta comuni
// =====================
router.post("/municipalities", async (req, res) => {
  try {
    const { polygon, zoneName } = req.body;
    
    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Poligono non valido (minimo 3 punti)"
      });
    }
    
    Logger.info(`Admin municipality discovery for zone: ${zoneName || 'Unnamed'}`);
    
    const municipalities = await semanticConnector.discoverMunicipalities(
      polygon,
      zoneName || ''
    );
    
    Logger.info(`Found ${municipalities.length} municipalities for zone: ${zoneName}`);
    
    res.json({
      success: true,
      municipalities: municipalities
    });
    
  } catch (error) {
    Logger.error("Municipality discovery error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// POST /admin/semantic/approve-poi - Approva singolo POI
// =====================
router.post("/approve-poi", async (req, res) => {
  try {
    const { poi, zoneId } = req.body;
    
    if (!poi || !zoneId) {
      return res.status(400).json({
        success: false,
        error: "POI e zona sono obbligatori"
      });
    }
    
    // Verifica che la zona esista
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: "Zona non trovata"
      });
    }
    
    // Controlla duplicati
    const existingPoi = await Poi.findOne({
      name: poi.name,
      zone: zoneId,
      coordinates: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [poi.lng, poi.lat]
          },
          $maxDistance: 100 // 100 metri
        }
      }
    });
    
    if (existingPoi) {
      return res.status(409).json({
        success: false,
        error: "POI già esistente nelle vicinanze",
        existing_poi: existingPoi
      });
    }
    
    // Crea nuovo POI dal risultato semantico con supporto multilingua
    const langMap = {
      'it': 'it', 'fr': 'fr', 'es': 'es', 'el': 'el', 'hr': 'hr', 'de': 'de', 'en': 'en'
    };
    const detectedLang = (poi.lang || '').toLowerCase();
    const langKey = langMap[detectedLang] || 'en';

    const multilingual = {};
    if (langKey !== 'it') {
      multilingual[langKey] = {
        name: '',
        description: poi.description || poi.ai_enhanced_description || '',
        aiSummary: '',
        curiosities: '',
        historicalFacts: ''
      };
    }

    const baseDescription = (langKey === 'it')
      ? (poi.description || poi.ai_enhanced_description || '')
      : '';

    const newPoi = new Poi({
      name: poi.name,
      description: baseDescription,
      lat: poi.lat,
      lng: poi.lng,
      zone: zoneId,
      multilingual,
      icon: poi.type === 'marine' ? 'anchor' : 'star',
      source: 'semantic_search',
      extraInfo: {
        wikipediaUrl: poi.wikipedia_url || poi.wikidata_url || '',
        aiSummary: '',
      },
      metadata: {
        semantic_source: poi.source,
        relevance_score: poi.relevance_score,
        poi_type: poi.type,
        marine_type: poi.marine_type,
        depth: poi.depth,
        semantic_tags: poi.semantic_tags,
        visit_suggestions: poi.visit_suggestions,
        accessibility_info: poi.accessibility_info,
        approved_at: new Date().toISOString(),
        approved_by: 'admin'
      }
    });
    
    await newPoi.save();
    
    Logger.info(`Approved semantic POI: ${poi.name} in zone: ${zone.name}`);
    
    res.json({
      success: true,
      poi: newPoi,
      message: "POI approvato e salvato con successo"
    });
    
  } catch (error) {
    Logger.error("POI approval error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// POST /admin/semantic/reject-poi - Rifiuta singolo POI
// ===================== 
router.post("/reject-poi", async (req, res) => {
  try {
    const { poi, reason } = req.body;
    
    Logger.info(`Rejected semantic POI: ${poi?.name || 'Unknown'}`, {
      reason: reason || 'No reason provided',
      poi_source: poi?.source
    });
    
    // Log per analytics (in futuro per migliorare l'AI)
    // Qui si potrebbero salvare i rifiuti per training
    
    res.json({
      success: true,
      message: "POI rifiutato"
    });
    
  } catch (error) {
    Logger.error("POI rejection error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// GET /admin/semantic/stats - Statistiche utilizzo
// =====================
router.get("/stats", async (req, res) => {
  try {
    const stats = semanticConnector.getUsageStats();
    
    // Aggiungi statistiche dal database
    const dbStats = {
      semantic_pois_total: await Poi.countDocuments({ source: 'semantic_search' }),
      semantic_pois_marine: await Poi.countDocuments({ 
        source: 'semantic_search',
        'metadata.poi_type': 'marine'
      }),
      semantic_pois_land: await Poi.countDocuments({ 
        source: 'semantic_search',
        'metadata.poi_type': 'land'  
      }),
      zones_with_semantic_pois: await Poi.distinct('zone', { source: 'semantic_search' }).then(zones => zones.length)
    };
    
    res.json({
      connector_stats: stats,
      database_stats: dbStats,
      retrieved_at: new Date().toISOString()
    });
    
  } catch (error) {
    Logger.error("Error retrieving semantic stats:", error);
    res.status(500).json({
      error: error.message
    });
  }
});

// =====================
// POST /admin/semantic/cache/clear - Pulisce cache
// =====================
router.post("/cache/clear", async (req, res) => {
  try {
    await semanticConnector.cleanupCache();
    semanticConnector.resetStats();
    
    Logger.info("Semantic cache cleared by admin");
    
    res.json({
      success: true,
      message: "Cache pulita con successo"
    });
    
  } catch (error) {
    Logger.error("Error clearing semantic cache:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// GET /admin/semantic/config - Configurazione corrente
// =====================
router.get("/config", async (req, res) => {
  try {
    const config = {
      python_service_url: "http://127.0.0.1:5000",  // ✅ FIX MarineAudit: Porta uniformata a 5000
      timeout_ms: 30000,
      retry_attempts: 3,
      cache_ttl_hours: 24,
      features: {
        semantic_search: true,
        municipality_discovery: true,
        marine_extension: true,
        ai_enrichment: true,
        multilingual: false // Configurabile in futuro
      }
    };
    
    res.json(config);
    
  } catch (error) {
    Logger.error("Error retrieving semantic config:", error);
    res.status(500).json({
      error: error.message
    });
  }
});


module.exports = router;
