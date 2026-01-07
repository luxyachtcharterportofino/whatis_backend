/**
 * Admin Main Router
 * 
 * Central entry point for all admin routes.
 * Imports and assembles modular sub-routers while maintaining
 * full backward compatibility with existing paths and behavior.
 * 
 * @module routes/admin/main
 */

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Zone = require("../../models/Zone");
const Poi = require("../../models/Poi");
const fs = require("fs");
const path = require("path");
const multer = require('multer');
const sharp = require('sharp');
const Logger = require('../../utils/logger');
const { updateProgress } = require('../../utils/progressHelper');
const EnvHelper = require('../../utils/envHelper');
const ApiKeysHelper = require('../../utils/apiKeysHelper');

// Import modular routes
const zonesRoutes = require('./zones');
const poisBasicRoutes = require('./pois');
const geographicAreasRoutes = require('./geographic-areas');
const semanticRoutes = require('./semantic');
const tourGuidesRoutes = require('./tour-guides');

// Configurazione multer per upload foto (shared across routes)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'), false);
    }
  }
});

// Directory per le foto
const photosDir = path.join(__dirname, '../../public/photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// =====================
// REGISTER MODULAR ROUTES
// =====================
router.use('/zones', zonesRoutes);
router.use('/pois', poisBasicRoutes);
router.use('/poi', poisBasicRoutes); // Mount POI singular routes for /poi/edit, /poi/update, etc.
router.use('/geographic-areas', geographicAreasRoutes); // Geographic areas management
router.use('/semantic', semanticRoutes); // Semantic search engine integration
router.use('/tour-guides', tourGuidesRoutes); // Tour guides management

// =====================
// DASHBOARD & HOME ROUTES
// =====================

// GET /admin/dashboard (dashboard principale)
router.get("/dashboard", async (req, res) => {
  try {
    const zoneCount = await Zone.countDocuments();
    const poiCount = await Poi.countDocuments();
    const translationCount = await Poi.countDocuments({ 
      "translations.0": { $exists: true } 
    });
    
    // Carica configurazione API keys
    let apiKeys = [];
    try {
      const apiKeysPath = path.join(__dirname, '../../config/api_keys.json');
      
      if (fs.existsSync(apiKeysPath)) {
        const apiKeysData = JSON.parse(fs.readFileSync(apiKeysPath, 'utf8'));
        
        // Verifica stato di ogni API key
        apiKeys = apiKeysData.map(api => ({
          ...api,
          isActive: !!(process.env[api.env_var] && process.env[api.env_var].trim() !== '')
        }));
      }
    } catch (error) {
      Logger.error("Errore caricamento API keys:", error);
      // Continua senza API keys se c'è un errore
    }
    
    res.render("admin_dashboard", { 
      zoneCount, 
      poiCount, 
      translationCount,
      apiKeys 
    });
  } catch (err) {
    Logger.error("Errore caricamento dashboard:", err);
    res.status(500).send("Errore server");
  }
});

// GET /admin (redirect a dashboard)
router.get("/", (req, res) => {
  res.redirect("/admin/dashboard");
});

// ===============================
// 🔑 API KEYS MANAGEMENT ROUTES
// ===============================

// GET /admin/api/get-key/:envVar
// Ottiene i dati di un'API key (senza il valore per sicurezza)
router.get("/api/get-key/:envVar", async (req, res) => {
  try {
    const { envVar } = req.params;
    const apiKey = ApiKeysHelper.findApiKey(envVar);
    
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key non trovata'
      });
    }

    // Non restituire il valore per sicurezza, solo indicare se esiste
    res.json({
      success: true,
      api: {
        ...apiKey,
        hasValue: !!(process.env[envVar] && process.env[envVar].trim() !== '')
      }
    });

  } catch (error) {
    Logger.error('Errore lettura API key:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante la lettura dell\'API key'
    });
  }
});

// POST /admin/api/add-key
// Aggiunge una nuova API key
router.post("/api/add-key", async (req, res) => {
  try {
    const { name, env_var, description, icon, tooltip, value } = req.body;

    // Validazione
    if (!name || !env_var) {
      return res.status(400).json({
        success: false,
        message: 'Nome API e variabile ENV sono obbligatori'
      });
    }

    // Verifica formato env_var (solo lettere maiuscole, numeri e underscore)
    if (!/^[A-Z_][A-Z0-9_]*$/.test(env_var)) {
      return res.status(400).json({
        success: false,
        message: 'Variabile ENV deve contenere solo lettere maiuscole, numeri e underscore, e iniziare con una lettera o underscore'
      });
    }

    // Aggiungi/aggiorna variabile in .env se value è fornito
    if (value && value.trim() !== '') {
      EnvHelper.setEnvVariable(env_var, value.trim());
    }

    // Aggiungi API key al JSON
    const newApi = ApiKeysHelper.addApiKey({
      name: name.trim(),
      env_var: env_var.trim(),
      description: description || '',
      icon: icon || '🔑',
      tooltip: tooltip || description || ''
    });

    res.json({
      success: true,
      message: 'API key aggiunta con successo',
      api: newApi
    });

  } catch (error) {
    Logger.error('Errore aggiunta API key:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante l\'aggiunta dell\'API key'
    });
  }
});

// POST /admin/api/update-key
// Aggiorna una API key esistente
router.post("/api/update-key", async (req, res) => {
  try {
    const { old_env_var, name, env_var, description, icon, tooltip, value } = req.body;

    // Validazione
    if (!old_env_var) {
      return res.status(400).json({
        success: false,
        message: 'Variabile ENV originale è obbligatoria'
      });
    }

    // Verifica formato env_var se fornito
    if (env_var && !/^[A-Z_][A-Z0-9_]*$/.test(env_var)) {
      return res.status(400).json({
        success: false,
        message: 'Variabile ENV deve contenere solo lettere maiuscole, numeri e underscore'
      });
    }

    // Aggiorna variabile in .env se value è fornito
    if (value !== undefined) {
      const targetEnvVar = env_var || old_env_var;
      
      if (value.trim() === '') {
        // Rimuovi variabile se valore vuoto
        EnvHelper.removeEnvVariable(targetEnvVar);
      } else {
        // Aggiorna o aggiungi variabile
        if (old_env_var !== targetEnvVar) {
          // Se env_var è cambiato, rimuovi il vecchio e aggiungi il nuovo
          EnvHelper.removeEnvVariable(old_env_var);
        }
        EnvHelper.setEnvVariable(targetEnvVar, value.trim());
      }
    }

    // Aggiorna API key nel JSON
    const updatedApi = ApiKeysHelper.updateApiKey(old_env_var, {
      name: name ? name.trim() : undefined,
      env_var: env_var ? env_var.trim() : undefined,
      description: description !== undefined ? description : undefined,
      icon: icon !== undefined ? icon : undefined,
      tooltip: tooltip !== undefined ? tooltip : undefined
    });

    res.json({
      success: true,
      message: 'API key aggiornata con successo',
      api: updatedApi
    });

  } catch (error) {
    Logger.error('Errore aggiornamento API key:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante l\'aggiornamento dell\'API key'
    });
  }
});

// GET /admin/map (pagina mappa admin)
router.get("/map", async (req, res) => {
  try {
    res.render("map");
  } catch (err) {
    Logger.error("Errore caricamento mappa:", err);
    res.status(500).send("Errore server");
  }
});

// GET /admin/translations (pagina traduzioni admin)
router.get("/translations", async (req, res) => {
  try {
    res.render("admin_translations");
  } catch (err) {
    Logger.error("Errore caricamento traduzioni:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// POI ADVANCED ROUTES
// These are kept here temporarily until full modularization
// =====================

// POST /admin/pois/auto (auto import POI with real-time progress)
router.post("/pois/auto", async (req, res) => {
  try {
    const { zoneId, coordinates } = req.body;
    
    if (!zoneId) {
      return res.status(400).json({ 
        success: false, 
        message: "Zone ID is required" 
      });
    }

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid coordinates array is required" 
      });
    }

    // Get zone information
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: "Zone not found" 
      });
    }
    
    // Initialize intelligent POI system
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    // Start intelligent search
    const result = await poiSystem.startIntelligentPOISearch(zone);
    
    if (result.success) {
      // ✅ FIX: Estrai flag includeMarineExtension dalla zona - gestione coerente
      const rawFlag = zone.includeMarineExtension;
      const includeMarineExtension = rawFlag === true || rawFlag === 'true' || rawFlag === 1;
      
      // ✅ FIX: Log ridotto - solo se necessario (non flooding)
      if (rawFlag !== includeMarineExtension) {
        Logger.info(`[POIS/AUTO] Zone: ${zone.name}, includeMarineExtension: ${rawFlag} → ${includeMarineExtension}`);
      }
      
      const responseData = {
        success: true,
        municipalities: result.municipalities,
        zone: {
          _id: zone._id,
          name: zone.name,
          includeMarineExtension: includeMarineExtension
        },
        includeMarineExtension: includeMarineExtension, // Aggiunto anche qui per compatibilità
        fromCache: result.fromCache || false,
        message: `Trovati ${result.municipalities.length} municipi nella zona`
      };
      
      Logger.info(`[POIS/AUTO] Response data:`, JSON.stringify(responseData, null, 2));
      
      res.json(responseData);
    } else {
      throw new Error(result.message || 'Errore durante la ricerca municipi');
    }
    
  } catch (err) {
    Logger.error("Error in intelligent POI system:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error during intelligent POI search" 
    });
  }
});

// GET /admin/pois/select-municipality (selezione municipio)
router.get("/pois/select-municipality", async (req, res) => {
  try {
    const { zoneId } = req.query;
    
    Logger.info(`[SELECT-MUNICIPALITY] Route chiamata con zoneId: ${zoneId}`);
    
    if (!zoneId) {
      return res.status(400).send("Zone ID is required");
    }
    
    // Validazione preventiva: verifica che zoneId sia un ObjectId valido
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      Logger.warn(`[SELECT-MUNICIPALITY] Invalid zoneId format: ${zoneId}`);
      return res.status(400).send("ID zona non valido");
    }
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).send("Zone not found");
    }
    
    // ✅ FIX: Log ridotto - solo informazioni essenziali (non flooding)
    Logger.info(`[SELECT-MUNICIPALITY] Zona: ${zone.name}, includeMarineExtension: ${zone.includeMarineExtension}`);
    
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    const result = await poiSystem.startIntelligentPOISearch(zone);
    
    Logger.info(`[SELECT-MUNICIPALITY] Municipi trovati: ${result.municipalities?.length || 0}`);
    
    // Se richiesto formato JSON → restituisce JSON puro
    // Altrimenti renderizza la vista EJS
    // Passa il flag includeMarineExtension esplicitamente (può essere undefined, null, o false)
    // Leggi il valore direttamente dall'oggetto Mongoose (potrebbe essere undefined)
    // PRIMA controlla se c'è un toggle globale attivo nella richiesta (query param o header)
    // Poi usa il flag del DB come fallback
    const globalToggleEnabled = req.query.marineExtension === 'true' || req.headers['x-marine-extension'] === 'true';
    const rawFlag = zone.includeMarineExtension;
    const dbFlag = rawFlag === true || rawFlag === 'true' || rawFlag === 1;
    // Se il toggle globale è ON, forza includeMarineExtension a true (funziona per tutte le zone)
    const includeMarineExtension = globalToggleEnabled || dbFlag;
    
    if (req.query.format === "json") {
      Logger.info(`[SELECT-MUNICIPALITY JSON] Zone: ${zone.name}, includeMarineExtension: ${includeMarineExtension}`);
      console.log(`[SELECT-MUNICIPALITY JSON] Zone: ${zone.name}, includeMarineExtension: ${includeMarineExtension}`);
      
      return res.json({
      success: true,
      municipalities: result.municipalities,
        zone: { 
          _id: zone._id, 
          name: zone.name, 
          includeMarineExtension: includeMarineExtension 
        },
        includeMarineExtension: includeMarineExtension, // Aggiunto anche qui per compatibilità
      message: `Trovati ${result.municipalities.length} municipi nella zona`
      });
    }
    
    // ✅ FIX: Log ridotto - solo informazioni essenziali (non flooding)
    Logger.info(`[SELECT-MUNICIPALITY] Zone: ${zone.name}, includeMarineExtension: ${includeMarineExtension}, Municipi: ${result.municipalities?.length || 0}`);
    
    res.render("municipality_selection", {
      zone: zone.toObject(),
      municipalities: result.municipalities || [],
      includeMarineExtension: includeMarineExtension
    });
    
  } catch (err) {
    Logger.error("Error loading municipality selection:", err);
    res.status(500).send("Error loading municipality selection");
  }
});

// POST /admin/pois/search-municipality (ricerca POI per municipio)
router.post("/pois/search-municipality", async (req, res) => {
  try {
    const { municipality, zone } = req.body;
    
    if (!municipality || !zone) {
      return res.status(400).json({ 
        success: false, 
        message: "Municipality and zone are required" 
      });
    }
    
    // Generate unique operation ID
    const operationId = `poi_search_${municipality.name}_${Date.now()}`;
    
    // Initialize progress manager
    const progressManager = require('../../services/progressManager');
    progressManager.startOperation(operationId, `Ricerca POI Intelligente - ${municipality.name}`, 100);
    
    // Initialize intelligent POI system
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    // Search POIs for municipality with progress callback
    const pois = await poiSystem.searchPOIsForMunicipality(municipality, zone, (percentage, message, details) => {
      progressManager.updateProgress(operationId, percentage, message, details);
    });
    
    // Complete operation with POI data
    progressManager.completeOperation(operationId, `Ricerca completata: ${pois.length} POI trovati`, pois);
    
    res.json({
      success: true,
      pois: pois,
      municipality: municipality,
      operationId: operationId,
      message: `Trovati ${pois.length} POI per ${municipality.name}`
    });
    
  } catch (err) {
    Logger.error("Error searching POIs for municipality:", err);
    
    // Mark operation as error if it was started
    if (req.body.municipality) {
      const operationId = `poi_search_${req.body.municipality.name}_${Date.now()}`;
      const progressManager = require('../../services/progressManager');
      progressManager.errorOperation(operationId, err.message);
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Error searching POIs for municipality" 
    });
  }
});

// Additional POI routes - kept for backward compatibility
// TODO: Migrate to pois.js module in next phase

// GET /admin/pois/provisional/:zoneId/:municipalityId
router.get("/pois/provisional/:zoneId/:municipalityId", async (req, res) => {
  try {
    const { zoneId, municipalityId } = req.params;
    
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    const pois = poiSystem.loadProvisionalPOIs(municipalityId, zoneId);
    
    if (pois) {
      res.json({
        success: true,
        pois: pois,
        message: `Trovati ${pois.length} POI provvisori`
      });
    } else {
      res.json({
        success: false,
        pois: [],
        message: "Nessun POI provvisorio trovato"
      });
    }
  } catch (err) {
    Logger.error("Error loading provisional POIs:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error loading provisional POIs" 
    });
  }
});

// GET /admin/pois/has-provisional/:zoneId/:municipalityId
router.get("/pois/has-provisional/:zoneId/:municipalityId", async (req, res) => {
  try {
    const { zoneId, municipalityId } = req.params;
    
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    const hasCache = poiSystem.hasProvisionalPOIs(municipalityId, zoneId);
    
    res.json({
      success: true,
      hasCache: hasCache
    });
  } catch (err) {
    Logger.error("Error checking provisional POIs:", err);
    res.status(500).json({ 
      success: false, 
      hasCache: false
    });
  }
});

// GET /admin/pois/progress/:operationId
router.get("/pois/progress/:operationId", (req, res) => {
  try {
    const { operationId } = req.params;
    const progressManager = require('../../services/progressManager');
    
    const status = progressManager.getOperationStatus(operationId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Operation not found"
      });
    }
    
    res.json({
      success: true,
      operation: status
    });
    
  } catch (err) {
    Logger.error("Error getting progress:", err);
    res.status(500).json({
      success: false,
      message: "Error getting progress"
    });
  }
});

// DELETE /admin/pois/provisional/:zoneId/:municipalityId/:poiName
router.delete("/pois/provisional/:zoneId/:municipalityId/:poiName", async (req, res) => {
  try {
    const { zoneId, municipalityId, poiName } = req.params;
    
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    const success = poiSystem.removePOIFromCache(municipalityId, zoneId, poiName);
    
    if (success) {
      res.json({
        success: true,
        message: `POI "${poiName}" rimosso dalla cache provvisoria`
      });
    } else {
      res.status(404).json({
        success: false,
        message: "POI non trovato nella cache"
      });
    }
  } catch (err) {
    Logger.error("Error removing POI from cache:", err);
    res.status(500).json({
      success: false,
      message: "Error removing POI from cache"
    });
  }
});

// DELETE /admin/zones/:zoneId/cache (invalida cache municipi per zona)
router.delete("/zones/:zoneId/cache", async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    if (!zoneId) {
      return res.status(400).json({
        success: false,
        message: "Zone ID is required"
      });
    }
    
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    const success = poiSystem.invalidateZoneCache(zoneId);
    
    if (success) {
      res.json({
        success: true,
        message: "Cache municipi invalidata con successo"
      });
    } else {
      res.json({
        success: true,
        message: "Nessuna cache da invalidare"
      });
    }
  } catch (err) {
    Logger.error("Error invalidating zone cache:", err);
    res.status(500).json({
      success: false,
      message: "Error invalidating zone cache"
    });
  }
});

// PUT /admin/municipalities/update-name (aggiorna nome municipio nella cache)
router.put("/municipalities/update-name", async (req, res) => {
  try {
    const { zoneId, municipalityId, newName, oldName } = req.body;
    
    if (!zoneId || !municipalityId || !newName) {
      return res.status(400).json({
        success: false,
        message: "Zone ID, municipality ID, and new name are required"
      });
    }
    
    const IntelligentPOISystem = require('../../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    // Update municipality name in cache (pass oldName if provided)
    const success = await poiSystem.updateMunicipalityNameInCache(zoneId, municipalityId, newName, oldName);
    
    if (success) {
      res.json({
        success: true,
        message: `Municipality name updated to "${newName}"`
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Municipality not found in cache"
      });
    }
  } catch (err) {
    Logger.error("Error updating municipality name:", err);
    res.status(500).json({
      success: false,
      message: "Error updating municipality name"
    });
  }
});

module.exports = router;
