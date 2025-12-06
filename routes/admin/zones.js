/**
 * Admin Routes - Zones Management
 * 
 * Handles all zone-related admin routes:
 * - GET /admin/zones - List all zones
 * - POST /admin/zones - Create new zone
 * - PUT /admin/zones/:id - Update zone
 * - DELETE /admin/zones/:id - Delete zone
 * 
 * @module routes/admin/zones
 */

const express = require("express");
const router = express.Router();
const Zone = require("../../models/Zone");
const Poi = require("../../models/Poi");
const Logger = require('../../utils/logger');

// =====================
// ROTTA GET /admin/zones (tabella zone)
// =====================
router.get("/", async (req, res) => {
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
    Logger.error("Errore caricamento zone:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA POST /admin/zones (creazione zona)
// =====================
router.post("/", async (req, res) => {
  try {
    const { name, description, coordinates } = req.body;
    
    // 🔒 Validazione coordinate PRIMA di salvare
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      Logger.error(`❌ Tentativo creazione zona con coordinate invalide: ${coordinates?.length || 0} punti`);
      return res.status(400).json({ 
        success: false, 
        message: `Coordinate non valide: richiesti almeno 3 punti, ricevuti ${coordinates?.length || 0}` 
      });
    }
    
    // Verifica che ogni punto sia un array di 2 numeri
    const invalidPoints = coordinates.filter(p => 
      !Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number'
    );
    
    if (invalidPoints.length > 0) {
      Logger.error(`❌ ${invalidPoints.length} punti non validi su ${coordinates.length} nella nuova zona`);
      return res.status(400).json({ 
        success: false, 
        message: `${invalidPoints.length} punti non validi nelle coordinate` 
      });
    }
    
    Logger.info(`✅ Creazione nuova zona "${name}" con ${coordinates.length} coordinate validate`);
    
    const newZone = new Zone({
      name,
      description,
      coordinates,
    });
    await newZone.save();
    res.json({ success: true, _id: newZone._id });
  } catch (err) {
    Logger.error("Errore salvataggio zona:", err);
    res.status(500).json({ success: false, message: "Errore server" });
  }
});

// =====================
// ROTTA PUT /admin/zones/:id (aggiornamento zona)
// =====================
router.put("/:id", async (req, res) => {
  try {
    const { name, description, coordinates } = req.body;
    
    // 🔒 Validazione e normalizzazione coordinate PRIMA di salvare
    let normalizedCoordinates = coordinates;
    
    if (coordinates) {
      // Log formato ricevuto per debug
      Logger.info(`📥 PUT /admin/zones/${req.params.id}: formato coordinate ricevuto`, {
        isArray: Array.isArray(coordinates),
        length: Array.isArray(coordinates) ? coordinates.length : 'N/A',
        firstSample: Array.isArray(coordinates) ? coordinates[0] : coordinates
      });
      
      // Normalizza formato: gestisce sia [coords] che [[coords]] che [[[coords]]]
      if (Array.isArray(coordinates)) {
        // Se è array annidato triplo [[[lat,lng]...]]
        if (coordinates.length > 0 && Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]) && Array.isArray(coordinates[0][0][0])) {
          normalizedCoordinates = coordinates[0];
          Logger.info(`🔧 Normalizzato formato GeoJSON triplo: estratto primo anello (${normalizedCoordinates.length} punti)`);
        }
        // Se è array annidato doppio [[lat,lng]...] o [coords] (dove coords è array)
        else if (coordinates.length > 0 && Array.isArray(coordinates[0])) {
          // Se il primo elemento è già un array di punti, è OK
          if (coordinates[0].length >= 2 && typeof coordinates[0][0] === 'number') {
            normalizedCoordinates = coordinates;
          } else {
            // Altrimenti potrebbe essere [[[punti]]] ma senza il livello più esterno, usa direttamente
            normalizedCoordinates = coordinates;
          }
        }
        
        // Verifica finale che sia un array di array con almeno 3 punti
        const finalCoords = normalizedCoordinates;
        if (!Array.isArray(finalCoords) || finalCoords.length < 3) {
          Logger.error(`❌ Coordinate non valide: ${finalCoords.length} punti (minimo 3 richiesti)`);
          return res.status(400).json({ 
            success: false, 
            message: `Coordinate non valide: richiesti almeno 3 punti, ricevuti ${finalCoords.length}` 
          });
        }
        
        // Verifica che ogni punto sia un array di 2 numeri
        const invalidPoints = finalCoords.filter(p => 
          !Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number'
        );
        
        if (invalidPoints.length > 0) {
          Logger.error(`❌ ${invalidPoints.length} punti non validi su ${finalCoords.length}`);
          return res.status(400).json({ 
            success: false, 
            message: `${invalidPoints.length} punti non validi nelle coordinate` 
          });
        }
        
        Logger.info(`✅ Coordinate validate: ${finalCoords.length} punti validi`);
      } else {
        Logger.error(`❌ Coordinate non sono un array:`, typeof coordinates);
        return res.status(400).json({ 
          success: false, 
          message: 'Coordinate devono essere un array' 
        });
      }
    }
    
    // Salva solo se le coordinate sono valide
    const updateData = { name, description };
    if (normalizedCoordinates) {
      updateData.coordinates = normalizedCoordinates;
    }
    
    const updatedZone = await Zone.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!updatedZone) {
      return res.status(404).json({ success: false, message: "Zona non trovata" });
    }
    
    Logger.info(`✅ Zona ${req.params.id} aggiornata con successo (${updateData.coordinates?.length || 'N/A'} coordinate)`);
    res.json({ success: true, zone: updatedZone });
  } catch (err) {
    Logger.error("Errore aggiornamento zona:", err);
    res.status(500).json({ success: false, message: "Errore server" });
  }
});

// =====================
// ROTTA DELETE /admin/zones/:id (eliminazione zona)
// =====================
router.delete("/:id", async (req, res) => {
  try {
    await Zone.findByIdAndDelete(req.params.id);
    await Poi.deleteMany({ zone: req.params.id });
    res.json({ success: true });
  } catch (err) {
    Logger.error("Errore eliminazione zona:", err);
    res.status(500).json({ success: false });
  }
});

// ===============================
// 🚀 POI GENERATION ROUTES
// ===============================

const POIGenerationPipeline = require('../../services/poiGenerationPipeline');

// POST /admin/zones/:id/generate-pois
// Genera POI per una zona
router.post("/:id/generate-pois", async (req, res) => {
  try {
    const { type = 'both', customPrompt = null, municipality = null } = req.body;
    const zoneId = req.params.id;

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Zona non trovata' 
      });
    }

    // Validazione comune
    if (!municipality) {
      return res.status(400).json({
        success: false,
        message: 'Comune è obbligatorio'
      });
    }

    Logger.info(`🚀 Generazione POI con GPT per zona: ${zone.name} (tipo: ${type}, comune: ${municipality})`);

    const pipeline = new POIGenerationPipeline();
    
    // Genera POI (senza salvare)
    const results = await pipeline.generatePOIsForZone(
      zone,
      type,
      customPrompt,
      municipality,
      (percentage, message) => {
        // Progress callback (potrebbe essere usato per SSE in futuro)
        Logger.debug(`Progress: ${percentage}% - ${message}`);
      }
    );

    // Salva risultati in sessione per la pagina di revisione
    // In alternativa, potremmo salvare in un database temporaneo
    // Per ora usiamo un approccio semplice: restituiamo i risultati
    // e li salveremo in sessione o in un file temporaneo

    res.json({
      success: true,
      results: results,
      message: `Generati ${results.validated.length} POI validati`
    });

  } catch (error) {
    Logger.error('Errore generazione POI:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante la generazione POI'
    });
  }
});

// POST /admin/zones/:id/save-pois
// Salva POI approvati nel database
router.post("/:id/save-pois", async (req, res) => {
  try {
    const { pois } = req.body; // Array di POI da salvare
    const zoneId = req.params.id;

    if (!Array.isArray(pois) || pois.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nessun POI da salvare'
      });
    }

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zona non trovata'
      });
    }

    const savedPOIs = [];
    const errors = [];

    for (const poiData of pois) {
      try {
        // Verifica duplicati (stesso nome e coordinate simili)
        const existingPOI = await Poi.findOne({
          zone: zoneId,
          name: poiData.name,
          lat: { $gte: poiData.lat - 0.001, $lte: poiData.lat + 0.001 },
          lng: { $gte: poiData.lng - 0.001, $lte: poiData.lng + 0.001 }
        });

        if (existingPOI) {
          Logger.warn(`POI duplicato saltato: ${poiData.name}`);
          errors.push({
            poi: poiData.name,
            reason: 'POI duplicato già esistente'
          });
          continue;
        }

        // Crea nuovo POI
        const poi = new Poi({
          name: poiData.name,
          description: poiData.description || '',
          lat: poiData.lat,
          lng: poiData.lng,
          zone: zoneId,
          category: poiData.category || 'other',
          semanticCategory: poiData.semanticCategory || '',
          source: 'gpt',
          extraInfo: {
            aiSummary: poiData.description || '',
            tags: poiData.extraInfo?.tags || []
          },
          arVisible: true,
          arPriority: 1
        });

        await poi.save();
        savedPOIs.push(poi);

        Logger.info(`✅ POI salvato: ${poi.name}`);

        // TODO: Avvia traduzioni automatiche se configurate
        // await triggerAutomaticTranslations(poi);

      } catch (error) {
        Logger.error(`Errore salvataggio POI ${poiData.name}:`, error);
        errors.push({
          poi: poiData.name,
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      saved: savedPOIs.length,
      errors: errors.length,
      message: `Salvati ${savedPOIs.length} POI, ${errors.length} errori`
    });

  } catch (error) {
    Logger.error('Errore salvataggio POI:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante il salvataggio POI'
    });
  }
});

// GET /admin/zones/:id/review-pois
// Pagina di revisione POI generati
router.get("/:id/review-pois", async (req, res) => {
  try {
    const zoneId = req.params.id;
    const zone = await Zone.findById(zoneId);
    
    if (!zone) {
      return res.status(404).send('Zona non trovata');
    }

    res.render("admin_review_pois", { 
      zone: zone,
      zoneId: zoneId
    });
  } catch (error) {
    Logger.error('Errore caricamento pagina revisione:', error);
    res.status(500).send('Errore server');
  }
});

// POST /admin/zones/:id/geocode-poi
// Ri-geocodifica un singolo POI
router.post("/:id/geocode-poi", async (req, res) => {
  try {
    const { poiName } = req.body;
    const zoneId = req.params.id;

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zona non trovata'
      });
    }

    const GeocodingService = require('../../services/geocodingService');
    const geocodingService = new GeocodingService();

    const result = await geocodingService.geocodePOI(
      poiName,
      zone.name,
      'Italia',
      zone.coordinates
    );

    if (result) {
      res.json({
        success: true,
        lat: result.lat,
        lng: result.lng,
        source: result.source,
        displayName: result.displayName
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Geocoding fallito'
      });
    }

  } catch (error) {
    Logger.error('Errore geocoding POI:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Errore durante il geocoding'
    });
  }
});

module.exports = router;
