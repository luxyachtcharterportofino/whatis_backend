const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Zone = require("../models/Zone");
const Poi = require("../models/Poi");
const fs = require("fs");
const path = require("path");
const multer = require('multer');
const sharp = require('sharp');

// Configurazione multer per upload foto
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
const photosDir = path.join(__dirname, '../public/photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// =====================
// ROTTA GET /admin/dashboard (dashboard principale)
// =====================
router.get("/dashboard", async (req, res) => {
  try {
    const zoneCount = await Zone.countDocuments();
    const poiCount = await Poi.countDocuments();
    const translationCount = await Poi.countDocuments({ 
      "translations.0": { $exists: true } 
    });
    
    res.render("admin_dashboard", { 
      zoneCount, 
      poiCount, 
      translationCount 
    });
  } catch (err) {
    console.error("Errore caricamento dashboard:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA GET /admin (redirect a dashboard)
// =====================
router.get("/", (req, res) => {
  res.redirect("/admin/dashboard");
});


// =====================
// PAGINA MAPPA ADMIN
// =====================
router.get("/map", async (req, res) => {
  try {
    res.render("map");
  } catch (err) {
    console.error("Errore caricamento mappa:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// PAGINA TRADUZIONI ADMIN
// =====================
router.get("/translations", async (req, res) => {
  try {
    res.render("admin_translations");
  } catch (err) {
    console.error("Errore caricamento traduzioni:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA GET /admin/zones (tabella zone)
// =====================
router.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find();

    // Se richiesto formato JSON → restituisce JSON puro
    if (req.query.format === "json") {
      return res.json(zones);
    }

    // Altrimenti mostra tabella admin_zones
    // Aggiungi il conteggio POI per ogni zona
    const zonesWithCount = await Promise.all(zones.map(async (zone) => {
      const poiCount = await Poi.countDocuments({ zone: zone._id });
      return { ...zone.toObject(), poiCount };
    }));

    res.render("admin_zones", { zones: zonesWithCount });
  } catch (err) {
    console.error("Errore caricamento zone:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA POST /admin/zones (creazione zona)
// =====================
router.post("/zones", async (req, res) => {
  try {
    const newZone = new Zone({
      name: req.body.name,
      description: req.body.description,
      coordinates: req.body.coordinates,
    });
    await newZone.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Errore salvataggio zona:", err);
    res.status(500).json({ success: false });
  }
});

// =====================
// ROTTA PUT /admin/zones/:id (aggiornamento zona)
// =====================
router.put("/zones/:id", async (req, res) => {
  try {
    const { name, description, coordinates } = req.body;
    
    const updatedZone = await Zone.findByIdAndUpdate(
      req.params.id,
      { name, description, coordinates },
      { new: true }
    );
    
    if (!updatedZone) {
      return res.status(404).json({ success: false, message: "Zona non trovata" });
    }
    
    res.json({ success: true, zone: updatedZone });
  } catch (err) {
    console.error("Errore aggiornamento zona:", err);
    res.status(500).json({ success: false, message: "Errore server" });
  }
});

// =====================
// ROTTA DELETE /admin/zones/:id (eliminazione zona)
// =====================
router.delete("/zones/:id", async (req, res) => {
  try {
    await Zone.findByIdAndDelete(req.params.id);
    await Poi.deleteMany({ zone: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("Errore eliminazione zona:", err);
    res.status(500).json({ success: false });
  }
});

// =====================
// ROTTA GET /admin/pois (tabella POI)
// =====================
router.get("/pois", async (req, res) => {
  try {
    const filter = req.query.zone ? { zone: req.query.zone } : {};
    const pois = await Poi.find(filter).populate("zone", "name");

    // Se richiesto JSON → restituisce dati grezzi
    if (req.query.format === "json") {
      return res.json(pois);
    }

    // Altrimenti mostra tabella EJS
    // Ottieni il nome della zona se è specificata
    const zoneId = req.query.zone_id || req.query.zone;
    let zoneName = null;
    if (zoneId && zoneId !== "undefined" && zoneId !== "") {
      const zone = await Zone.findById(zoneId);
      zoneName = zone ? zone.name : null;
    }
    
    // Carica tutte le zone per i filtri
    const zones = await Zone.find().select("name _id").sort({ name: 1 }).lean();
    
    res.render("admin_pois", { 
      pois, 
      zoneName,
      zones,
      selectedZoneId: zoneId || null,
      selectedMunicipality: req.query.municipality || null
    });
  } catch (err) {
    console.error("Errore caricamento tabella POI:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA POST /admin/pois (creazione POI)
// =====================
router.post("/pois", upload.single('photo'), async (req, res) => {
  try {
    let finalImageUrl = req.body.imageUrl || '';

    // Se c'è una foto caricata, processala
    if (req.file) {
      // Genera nome file unico
      const timestamp = Date.now();
      const filename = `poi_${Date.now()}_${timestamp}.jpg`;
      const filepath = path.join(photosDir, filename);

      // Ridimensiona e ottimizza l'immagine
      await sharp(req.file.buffer)
        .resize(800, 600, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(filepath);

      finalImageUrl = `/photos/${filename}`;
    }

    const newPoi = new Poi({
      name: req.body.name,
      description: req.body.description || '',
      lat: req.body.lat,
      lng: req.body.lng,
      zone: req.body.zone,
      category: req.body.category || 'other',
      semanticCategory: req.body.semanticCategory || '',
      source: req.body.source || 'manual',
      imageUrl: finalImageUrl,
      customIcon: req.body.customIcon || '',
      extraInfo: req.body.extraInfo ? JSON.parse(req.body.extraInfo) : {}
    });
    
    await newPoi.save();
    res.json({ success: true, poi: newPoi });
  } catch (err) {
    console.error("Errore salvataggio POI:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================
// ROTTA DELETE /admin/pois/:id (eliminazione POI)
// =====================
router.delete("/pois/:id", async (req, res) => {
  try {
    await Poi.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Errore eliminazione POI:", err);
    res.status(500).json({ success: false });
  }
});

// =====================
// ROTTA POST /admin/pois/auto (auto import POI with real-time progress)
// =====================
router.post("/pois/auto", async (req, res) => {
  try {
    const { zoneId, coordinates } = req.body;
    
    console.log('🔍 POST /admin/pois/auto ricevuto');
    console.log('📍 Zone ID:', zoneId);
    console.log('📍 Coordinates (count):', coordinates ? coordinates.length : 0);
    console.log('📍 First coordinate:', coordinates ? coordinates[0] : null);
    
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

    console.log(`🧠 Avvio nuovo sistema intelligente POI per zona: ${zone.name}`);
    
    // Initialize intelligent POI system
    const IntelligentPOISystem = require('../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    // Start intelligent search
    const result = await poiSystem.startIntelligentPOISearch(zone);
    
    if (result.success) {
      // Return municipalities for modal display
      res.json({
        success: true,
        municipalities: result.municipalities,
        message: `Trovati ${result.municipalities.length} municipi nella zona`
      });
    } else {
      throw new Error(result.message || 'Errore durante la ricerca municipi');
    }
    
  } catch (err) {
    console.error("❌ Error in intelligent POI system:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error during intelligent POI search" 
    });
  }
});


// =====================
// ROTTA GET /admin/poi/edit/:id (modifica POI)
// =====================
router.get("/poi/edit/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    console.log(`🔍 Attempting to edit POI with ID: ${poiId}`);
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      console.error("❌ Invalid POI ID format:", poiId);
      return res.status(400).send("ID POI non valido");
    }
    
    const poi = await Poi.findById(poiId).populate('zone');
    
    if (!poi) {
      console.error("❌ POI not found with ID:", poiId);
      return res.status(404).send("POI non trovato");
    }

    console.log(`✅ POI found: ${poi.name} (Zone: ${poi.zone ? poi.zone.name : 'N/A'})`);
    res.render('poi_edit', { poi });
    
  } catch (error) {
    console.error("❌ Error loading POI for edit:", error);
    res.status(500).send("Errore durante il caricamento del POI");
  }
});

// =====================
// ROTTA POST /admin/poi/update/:id (salva modifiche POI)
// =====================
router.post("/poi/update/:id", upload.any(), async (req, res) => {
  try {
    const poiId = req.params.id;
    console.log(`💾 Attempting to update POI with ID: ${poiId}`);
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      console.error("❌ Invalid POI ID format:", poiId);
      return res.status(400).json({
        success: false,
        message: "ID POI non valido"
      });
    }
    
    
    const {
      name,
      category,
      description,
      aiSummary,
      curiosities,
      historicalFacts,
      source,
      lat,
      lng,
      customIcon
    } = req.body;

    console.log(`📝 Update data:`, { name, category, source, lat, lng });

    // Convert and validate required fields
    const poiName = name ? name.trim() : '';
    const poiLat = lat ? parseFloat(lat) : null;
    const poiLng = lng ? parseFloat(lng) : null;
    
    

    // Validate required fields - more lenient validation
    if (!poiName || poiName === '') {
      console.error("❌ Missing name:", poiName);
      return res.status(400).json({
        success: false,
        message: "Il nome è obbligatorio"
      });
    }
    
    if (poiLat === null || poiLat === NaN || isNaN(poiLat)) {
      console.error("❌ Invalid latitude:", { poiLat, lat, latType: typeof lat });
      return res.status(400).json({
        success: false,
        message: "La latitudine è obbligatoria e deve essere un numero valido"
      });
    }
    
    if (poiLng === null || poiLng === NaN || isNaN(poiLng)) {
      console.error("❌ Invalid longitude:", { poiLng, lng, lngType: typeof lng });
      return res.status(400).json({
        success: false,
        message: "La longitudine è obbligatoria e deve essere un numero valido"
      });
    }

    // Find and update POI
    const poi = await Poi.findById(poiId);
    if (!poi) {
      console.error("❌ POI not found with ID:", poiId);
      return res.status(404).json({
        success: false,
        message: "POI non trovato"
      });
    }

    // Update POI fields
    poi.name = poiName;
    poi.category = category || 'other';
    poi.description = description || '';
    poi.lat = poiLat;
    poi.lng = poiLng;
    poi.source = source || 'manual';
    poi.customIcon = customIcon || '';

    // Update extraInfo
    if (!poi.extraInfo) {
      poi.extraInfo = {};
    }
    
    if (aiSummary) poi.extraInfo.aiSummary = aiSummary;
    if (curiosities) poi.extraInfo.curiosities = curiosities;
    if (historicalFacts) poi.extraInfo.historicalFacts = historicalFacts;
    
    // Mark as manually edited
    poi.extraInfo.manuallyEdited = true;
    poi.extraInfo.lastEdited = new Date();

    // Handle photo upload
    const photoFile = req.files ? req.files.find(f => f.fieldname === 'photo') : null;
    if (photoFile) {
      try {
        console.log(`📸 Processing uploaded photo for POI: ${poi.name}`);
        
        // Resize and optimize the image
        const processedImage = await sharp(photoFile.buffer)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        // Generate unique filename
        const filename = `poi_${poiId}_${Date.now()}.jpg`;
        const filepath = path.join(photosDir, filename);
        
        // Save the processed image
        await fs.promises.writeFile(filepath, processedImage);
        
        // Update POI with new image URL
        poi.imageUrl = `/photos/${filename}`;
        console.log(`✅ Photo uploaded and saved: ${poi.imageUrl}`);
        
      } catch (photoError) {
        console.error('❌ Error processing photo:', photoError);
        // Don't fail the entire update if photo processing fails
      }
    }

    await poi.save();

    console.log(`✅ POI updated successfully: ${poi.name}`);
    
    res.json({
      success: true,
      message: "POI aggiornato con successo",
      poi: poi
    });

  } catch (error) {
    console.error("❌ Error updating POI:", error);
    res.status(500).json({
      success: false,
      message: "Errore durante l'aggiornamento del POI",
      error: error.message
    });
  }
});

// =====================
// ROTTA GET /admin/poi/delete/:id (elimina POI)
// =====================
router.get("/poi/delete/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    console.log(`🗑️ Attempting to delete POI with ID: ${poiId}`);
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      console.error("❌ Invalid POI ID format:", poiId);
      return res.status(400).send("ID POI non valido");
    }
    
    const deletedPOI = await Poi.findByIdAndDelete(poiId);
    if (!deletedPOI) {
      console.error("❌ POI not found with ID:", poiId);
      return res.status(404).send("POI non trovato");
    }
    
    console.log(`✅ POI deleted successfully: ${deletedPOI.name}`);
    res.redirect("/admin/pois?message=POI eliminato con successo");
    
  } catch (error) {
    console.error("❌ Error deleting POI:", error);
    res.status(500).send("Errore durante l'eliminazione del POI");
  }
});

// =====================
// ROTTA GET /admin/pois/select-municipality (selezione municipio)
// =====================
router.get("/pois/select-municipality", async (req, res) => {
  try {
    const { zoneId } = req.query;
    
    if (!zoneId) {
      return res.status(400).send("Zone ID is required");
    }
    
    // Validazione preventiva: verifica che zoneId sia un ObjectId valido
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      console.warn(`[SELECT-MUNICIPALITY] Invalid zoneId format: ${zoneId}`);
      return res.status(400).send("ID zona non valido");
    }
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).send("Zone not found");
    }
    
    // Initialize intelligent POI system
    const IntelligentPOISystem = require('../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    // Get municipalities for zone
    const result = await poiSystem.startIntelligentPOISearch(zone);
    
    // Se richiesto formato JSON → restituisce JSON puro
    if (req.query.format === "json") {
      return res.json({
      success: true,
      municipalities: result.municipalities,
        zone: { _id: zone._id, name: zone.name, includeMarineExtension: zone.includeMarineExtension || false },
      message: `Trovati ${result.municipalities.length} municipi nella zona`
      });
    }
    
    // Altrimenti renderizza la vista EJS
    // Passa il flag includeMarineExtension esplicitamente (può essere undefined, null, o false)
    // Leggi il valore direttamente dall'oggetto Mongoose (potrebbe essere undefined)
    const rawFlag = zone.includeMarineExtension;
    const includeMarineExtension = rawFlag === true || rawFlag === 'true' || rawFlag === 1;
    
    // Log dettagliato per debug
    console.log(`[DEBUG] Zone: ${zone.name}`);
    console.log(`[DEBUG] Raw includeMarineExtension from DB: ${rawFlag} (type: ${typeof rawFlag})`);
    console.log(`[DEBUG] Processed includeMarineExtension: ${includeMarineExtension}`);
    console.log(`[DEBUG] Municipalities count: ${result.municipalities?.length || 0}`);
    
    res.render("municipality_selection", {
      zone: zone.toObject(),
      municipalities: result.municipalities || [],
      includeMarineExtension: includeMarineExtension
    });
    
  } catch (err) {
    console.error("❌ Error loading municipality selection:", err);
    res.status(500).send("Error loading municipality selection");
  }
});

// =====================
// ROTTA POST /admin/pois/search-municipality (ricerca POI per municipio)
// =====================
router.post("/pois/search-municipality", async (req, res) => {
  try {
    console.log('🔍 [ROUTE] Ricevuta richiesta ricerca POI per municipio');
    const { municipality, zone } = req.body;
    
    console.log('🔍 [ROUTE] Municipality:', municipality);
    console.log('🔍 [ROUTE] Zone:', zone);
    
    if (!municipality || !zone) {
      console.log('❌ [ROUTE] Municipality o zone mancanti');
      return res.status(400).json({ 
        success: false, 
        message: "Municipality and zone are required" 
      });
    }
    
    console.log(`🔍 [ROUTE] Ricerca POI per municipio: ${municipality.name}`);
    
    // Generate unique operation ID
    const operationId = `poi_search_${municipality.name}_${Date.now()}`;
    
    // Initialize progress manager
    const progressManager = require('../services/progressManager');
    progressManager.startOperation(operationId, `Ricerca POI Intelligente - ${municipality.name}`, 100);
    
    // Initialize intelligent POI system
    console.log('🧠 [ROUTE] Inizializzazione sistema intelligente...');
    const IntelligentPOISystem = require('../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    console.log('🔍 [ROUTE] Avvio ricerca POI...');
    
    // Search POIs for municipality with progress callback
    const pois = await poiSystem.searchPOIsForMunicipality(municipality, zone, (percentage, message, details) => {
      // Update progress manager
      progressManager.updateProgress(operationId, percentage, message, details);
    });
    
    console.log(`✅ [ROUTE] Ricerca completata: ${pois.length} POI trovati`);
    
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
    console.error("❌ [ROUTE] Error searching POIs for municipality:", err);
    
    // Mark operation as error if it was started
    if (req.body.municipality) {
      const operationId = `poi_search_${req.body.municipality.name}_${Date.now()}`;
      const progressManager = require('../services/progressManager');
      progressManager.errorOperation(operationId, err.message);
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Error searching POIs for municipality" 
    });
  }
});

// =====================
// ROTTA GET /admin/pois/provisional/:zoneId/:municipalityId (carica POI provvisori)
// =====================
router.get("/pois/provisional/:zoneId/:municipalityId", async (req, res) => {
  try {
    const { zoneId, municipalityId } = req.params;
    
    const IntelligentPOISystem = require('../services/intelligentPOISystem');
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
    console.error("❌ [ROUTE] Error loading provisional POIs:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error loading provisional POIs" 
    });
  }
});

// =====================
// ROTTA GET /admin/pois/has-provisional/:zoneId/:municipalityId (verifica cache POI)
// =====================
router.get("/pois/has-provisional/:zoneId/:municipalityId", async (req, res) => {
  try {
    const { zoneId, municipalityId } = req.params;
    
    const IntelligentPOISystem = require('../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    const hasCache = poiSystem.hasProvisionalPOIs(municipalityId, zoneId);
    
    res.json({
      success: true,
      hasCache: hasCache
    });
  } catch (err) {
    console.error("❌ [ROUTE] Error checking provisional POIs:", err);
    res.status(500).json({ 
      success: false, 
      hasCache: false
    });
  }
});

// =====================
// ROTTA GET /admin/pois/progress/:operationId (polling progresso)
// =====================
router.get("/pois/progress/:operationId", (req, res) => {
  try {
    const { operationId } = req.params;
    const progressManager = require('../services/progressManager');
    
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
    console.error("❌ [ROUTE] Error getting progress:", err);
    res.status(500).json({
      success: false,
      message: "Error getting progress"
    });
  }
});

// =====================
// ROTTA POST /admin/pois/save-municipality-pois (salva POI municipio)
// =====================
router.post("/pois/save-municipality-pois", async (req, res) => {
  try {
    const { pois, municipality, zone } = req.body;
    
    if (!pois || !Array.isArray(pois)) {
      return res.status(400).json({ 
        success: false, 
        message: "POIs array is required" 
      });
    }
    
    console.log(`💾 Salvataggio ${pois.length} POI per municipio: ${municipality.name}`);
    
    // Get existing POIs for deduplication
    const existingPOIs = await Poi.find({ zone: zone._id });
    
    // Initialize intelligent POI system for deduplication
    const IntelligentPOISystem = require('../services/intelligentPOISystem');
    const poiSystem = new IntelligentPOISystem();
    
    // Deduplicate with existing POIs
    const deduplicatedPOIs = await poiSystem.deduplicateWithExisting(pois, existingPOIs);
    
    // Save new POIs
    const savedPOIs = [];
    for (const poiData of deduplicatedPOIs) {
      try {
        const poi = new Poi(poiData);
        await poi.save();
        savedPOIs.push(poi);
        console.log(`✅ Saved POI: ${poi.name} (${poi.category})`);
      } catch (saveError) {
        console.error(`❌ Error saving POI ${poiData.name}:`, saveError);
      }
    }
    
    console.log(`✅ Saved ${savedPOIs.length} new POIs for ${municipality.name}`);
    
    res.json({
      success: true,
      savedCount: savedPOIs.length,
      skippedCount: pois.length - savedPOIs.length,
      message: `Salvati ${savedPOIs.length} POI per ${municipality.name}`
    });
    
  } catch (err) {
    console.error("❌ Error saving municipality POIs:", err);
    res.status(500).json({ 
      success: false, 
      message: "Error saving municipality POIs" 
    });
  }
});

// Route per salvare l'elenco POI provvisorio
router.post("/pois/save-list", async (req, res) => {
  try {
    const { municipalityName, poiListData } = req.body;
    
    if (!municipalityName || !poiListData) {
      return res.status(400).json({
        success: false,
        error: "Dati mancanti: municipalityName e poiListData sono obbligatori"
      });
    }
    
    // Crea il nome del file
    const sanitizedName = municipalityName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `poi_list_${sanitizedName}_${timestamp}.json`;
    const filepath = path.join(__dirname, '../saved_poi_lists', filename);
    
    // Crea la directory se non esiste
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Salva il file
    fs.writeFileSync(filepath, JSON.stringify(poiListData, null, 2));
    
    console.log(`✅ Elenco POI salvato: ${filename}`);
    
    res.json({
      success: true,
      filename: filename,
      filepath: filepath,
      message: `Elenco POI salvato per ${municipalityName}`
    });
    
  } catch (error) {
    console.error("❌ Error saving POI list:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route per caricare l'elenco POI salvato
router.post("/pois/load-list", async (req, res) => {
  try {
    const { municipalityName } = req.body;
    
    if (!municipalityName) {
      return res.status(400).json({
        success: false,
        error: "Nome del municipio mancante"
      });
    }
    
    // Cerca il file più recente per il municipio
    const sanitizedName = municipalityName.replace(/[^a-zA-Z0-9]/g, '_');
    const savedListsDir = path.join(__dirname, '../saved_poi_lists');
    
    if (!fs.existsSync(savedListsDir)) {
      return res.status(404).json({
        success: false,
        error: "Nessun elenco POI salvato trovato"
      });
    }
    
    // Trova tutti i file per questo municipio
    const files = fs.readdirSync(savedListsDir);
    const municipalityFiles = files.filter(file => 
      file.startsWith(`poi_list_${sanitizedName}_`) && file.endsWith('.json')
    );
    
    if (municipalityFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Nessun elenco POI trovato per ${municipalityName}`
      });
    }
    
    // Prendi il file più recente
    const latestFile = municipalityFiles.sort().pop();
    const filepath = path.join(savedListsDir, latestFile);
    
    // Leggi il file
    const fileContent = fs.readFileSync(filepath, 'utf8');
    const poiListData = JSON.parse(fileContent);
    
    console.log(`✅ Elenco POI caricato: ${latestFile}`);
    
    res.json({
      success: true,
      filename: latestFile,
      poiListData: poiListData,
      message: `Elenco POI caricato per ${municipalityName}`
    });
    
  } catch (error) {
    console.error("❌ Error loading POI list:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// ROTTA POST /admin/pois/update-photo (aggiorna foto POI)
// =====================
router.post("/pois/update-photo", async (req, res) => {
  try {
    const { poiId, poiName, category } = req.body;
    
    if (!poiId || !poiName) {
      return res.status(400).json({
        success: false,
        error: "poiId e poiName sono obbligatori"
      });
    }
    
    // Trova il POI nel database
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: "POI non trovato"
      });
    }
    
    // Cerca foto per il POI usando il sistema intelligente
    const intelligentPOISearchEngine = require('../services/intelligentPOISearchEngine');
    const engine = new intelligentPOISearchEngine();
    
    const testPOI = {
      name: poiName,
      municipality: poi.zone?.name || '',
      category: category || poi.category || 'Other',
      description: poi.description || ''
    };
    
    const imageUrl = await engine.findPOIImage(testPOI);
    
    if (imageUrl) {
      // Aggiorna il POI con la nuova foto
      poi.imageUrl = imageUrl;
      await poi.save();
      
      console.log(`✅ Foto aggiornata per POI ${poiName}: ${imageUrl}`);
      
      res.json({
        success: true,
        imageUrl: imageUrl,
        message: `Foto aggiornata per ${poiName}`
      });
    } else {
      res.json({
        success: false,
        error: `Nessuna foto trovata per ${poiName}`
      });
    }
    
  } catch (error) {
    console.error("❌ Error updating POI photo:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// ROTTA POST /admin/pois/upload-photo (upload foto POI)
// =====================
router.post("/pois/upload-photo", upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Nessun file immagine fornito"
      });
    }

    const { poiId } = req.body;
    
    if (!poiId) {
      return res.status(400).json({
        success: false,
        error: "ID POI mancante"
      });
    }

    // Trova il POI
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: "POI non trovato"
      });
    }

    // Genera nome file unico
    const timestamp = Date.now();
    const filename = `poi_${poiId}_${timestamp}.jpg`;
    const filepath = path.join(photosDir, filename);

    // Ridimensiona e ottimizza l'immagine
    await sharp(req.file.buffer)
      .resize(800, 600, { 
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Salva l'URL della foto nel POI
    const photoUrl = `/photos/${filename}`;
    poi.imageUrl = photoUrl;
    await poi.save();

    console.log(`✅ Foto caricata per POI ${poi.name}: ${photoUrl}`);

    res.json({
      success: true,
      imageUrl: photoUrl,
      message: `Foto caricata con successo per ${poi.name}`
    });

  } catch (error) {
    console.error("❌ Error uploading photo:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// ROTTA POST /admin/pois/save-with-photo (salva POI con foto)
// =====================
router.post("/pois/save-with-photo", upload.single('photo'), async (req, res) => {
  try {
    const { name, description, lat, lng, zone, category, semanticCategory, source, imageUrl, customIcon, extraInfo } = req.body;
    
    let finalImageUrl = imageUrl || '';

    // Se c'è una foto caricata, processala
    if (req.file) {
      // Genera nome file unico
      const timestamp = Date.now();
      const filename = `poi_${Date.now()}_${timestamp}.jpg`;
      const filepath = path.join(photosDir, filename);

      // Ridimensiona e ottimizza l'immagine
      await sharp(req.file.buffer)
        .resize(800, 600, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(filepath);

      finalImageUrl = `/photos/${filename}`;
    }

    // Crea il POI
    const newPoi = new Poi({
      name,
      description,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zone,
      category,
      semanticCategory,
      source: source || 'manual',
      imageUrl: finalImageUrl,
      customIcon,
      extraInfo: extraInfo ? JSON.parse(extraInfo) : {}
    });

    await newPoi.save();

    console.log(`✅ POI salvato con foto: ${name}`);

    res.json({
      success: true,
      poi: newPoi,
      message: `POI ${name} salvato con successo`
    });

  } catch (error) {
    console.error("❌ Error saving POI with photo:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;