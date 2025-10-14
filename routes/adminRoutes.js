const express = require("express");
const router = express.Router();
const Zone = require("../models/Zone");
const Poi = require("../models/Poi");

// =====================
// DASHBOARD ADMIN
// =====================
router.get("/", async (req, res) => {
  try {
    const zoneCount = await Zone.countDocuments();
    const poiCount = await Poi.countDocuments();
    res.render("admin_dashboard", { zoneCount, poiCount });
  } catch (err) {
    console.error("Errore caricamento dashboard:", err);
    res.status(500).send("Errore server");
  }
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
// ROTTA GET /admin/zones
// =====================
router.get("/zones", async (req, res) => {
  try {
    const zones = await Zone.find();

    // Se richiesto formato JSON → restituisce JSON puro
    if (req.query.format === "json") {
      return res.json(zones);
    }

    // Altrimenti mostra tabella admin_zones
    res.render("admin_zones", { zones });
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
// ROTTA GET /admin/pois
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
    res.render("admin_pois", { pois });
  } catch (err) {
    console.error("Errore caricamento tabella POI:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA POST /admin/pois (creazione POI)
// =====================
router.post("/pois", async (req, res) => {
  try {
    const newPoi = new Poi({
      name: req.body.name,
      lat: req.body.lat,
      lng: req.body.lng,
      zone: req.body.zone,
    });
    await newPoi.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Errore salvataggio POI:", err);
    res.status(500).json({ success: false });
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

    console.log(`🧠 Auto-fetching POIs for zone: ${zone.name}`);
    console.log(`📍 Using provided coordinates:`, coordinates);
    
    // Use provided coordinates for POI generation
    const zoneData = {
      name: zone.name,
      coordinates: coordinates
    };
    
    // Initialize auto fetcher with progress callback
    const POIAutoFetcher = require("../services/poiAutoFetcher");
    const fetcher = new POIAutoFetcher();
    
    // Set up progress tracking
    let progressStep = 0;
    const totalSteps = 100;
    
    // Set up streaming response headers
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sendProgress = (step, message, details = '') => {
      progressStep = step;
      // Send progress update via streaming response
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        step: step,
        percentage: Math.round((step / totalSteps) * 100),
        message: message,
        details: details,
        timestamp: new Date().toISOString()
      })}\n\n`);
    };
    
    // Send initial progress
    sendProgress(5, 'Inizializzazione sistema...');
    
    // Fetch POIs from external sources with progress updates
    sendProgress(10, 'Ricerca POI da OpenStreetMap...');
    const fetchedPOIs = await fetcher.fetchPOIsForZone(zoneData, (progress, message, details) => {
      // Map internal progress to our progress scale (10-80)
      const mappedProgress = 10 + Math.round((progress / 100) * 70);
      sendProgress(mappedProgress, message, details);
    });
    
    sendProgress(80, 'Elaborazione POI completata, salvataggio in corso...');
    
    // Save POIs to database with progress updates
    const savedPOIs = [];
    const totalPOIs = fetchedPOIs.length;
    
    for (let i = 0; i < fetchedPOIs.length; i++) {
      const poiData = fetchedPOIs[i];
      try {
        const poi = new Poi({
          ...poiData,
          zone: zoneId,
          description: poiData.extraInfo?.aiSummary || poiData.description || ""
        });
        
        await poi.save();
        savedPOIs.push(poi);
        console.log(`✅ Saved POI: ${poi.name} (${poi.category})`);
        
        // Update progress for each POI saved
        const saveProgress = 80 + Math.round((i / totalPOIs) * 15);
        sendProgress(saveProgress, `Salvando POI: ${poi.name}`, `POI ${i + 1}/${totalPOIs}`);
        
      } catch (saveError) {
        console.error(`❌ Error saving POI ${poiData.name}:`, saveError);
        sendProgress(95, `Errore salvando: ${poiData.name}`, saveError.message);
      }
    }

    sendProgress(100, 'Importazione completata!');
    console.log(`✅ Auto-fetched and saved ${savedPOIs.length} POIs`);
    
    // Send final result
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      success: true,
      message: `Successfully imported ${savedPOIs.length} POIs`,
      pois: savedPOIs,
      count: savedPOIs.length
    })}\n\n`);
    
    res.end();

  } catch (error) {
    console.error("❌ Error in auto POI fetch:", error);
    
    // Send error via streaming response if headers not sent yet
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({
        success: false,
        message: error.message || "Errore durante l'importazione automatica dei POI"
      }));
    } else {
      // Send error via streaming
      res.write(`data: ${JSON.stringify({
        type: 'error',
        success: false,
        message: error.message || "Errore durante l'importazione automatica dei POI"
      })}\n\n`);
      res.end();
    }
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
router.post("/poi/update/:id", async (req, res) => {
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

    // Validate required fields
    if (!name || !lat || !lng) {
      console.error("❌ Missing required fields:", { name, lat, lng });
      return res.status(400).json({
        success: false,
        message: "Nome, latitudine e longitudine sono obbligatori"
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
    poi.name = name;
    poi.category = category || 'other';
    poi.description = description || '';
    poi.lat = parseFloat(lat);
    poi.lng = parseFloat(lng);
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

module.exports = router;