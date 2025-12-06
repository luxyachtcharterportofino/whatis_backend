/**
 * Admin Routes - POIs Management
 * 
 * Handles all POI-related admin routes including CRUD operations,
 * intelligent search, provisional POIs, and photo management.
 * 
 * @module routes/admin/pois
 */

const express = require("express");
const router = express.Router();
const Zone = require("../../models/Zone");
const Poi = require("../../models/Poi");
const fs = require("fs");
const path = require("path");
const multer = require('multer');
const sharp = require('sharp');
const Logger = require('../../utils/logger');

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
const photosDir = path.join(__dirname, '../../public/photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// =====================
// ROTTA GET /admin/pois (tabella POI)
// =====================
router.get("/", async (req, res) => {
  try {
    // Costruisci il filtro usando zone_id o zone (entrambi supportati)
    const zoneId = req.query.zone_id || req.query.zone;
    
    // Valida e costruisci il filtro
    let filter = {};
    if (zoneId && zoneId !== "undefined" && zoneId !== "" && zoneId.length === 24) {
      // Verifica che sia un ObjectId valido (24 caratteri esadecimali)
      const mongoose = require("mongoose");
      if (mongoose.Types.ObjectId.isValid(zoneId)) {
        filter = { zone: zoneId };
        Logger.info(`🔍 Filtro POI per zona: ${zoneId}`);
      } else {
        Logger.warn(`⚠️ Zone ID non valido: ${zoneId}`);
      }
    } else {
      Logger.info(`🔍 Caricamento tutti i POI (nessun filtro zona)`);
    }
    
    const pois = await Poi.find(filter).populate("zone", "name");
    
    // Log per debug
    Logger.info(`✅ Trovati ${pois.length} POI con filtro:`, JSON.stringify(filter));

    // Se richiesto JSON → restituisce dati grezzi
    if (req.query.format === "json") {
      return res.json(pois);
    }

    // Altrimenti mostra tabella EJS
    // Ottieni il nome della zona se è specificata
    let zoneName = null;
    if (zoneId && zoneId !== "undefined" && zoneId !== "") {
      const zone = await Zone.findById(zoneId);
      zoneName = zone ? zone.name : null;
    }
    
    // Carica tutte le zone per il dropdown scoperta e filtri
    const zones = await Zone.find().select("name _id").sort({ name: 1 }).lean();
    
    res.render("admin_pois", { 
      pois, 
      zoneName,
      zones,
      selectedZoneId: zoneId || null,
      selectedMunicipality: req.query.municipality || null,
      showDiscoveryButton: true,
      req: req // Pass req per accedere ai query params (message)
    });
  } catch (err) {
    Logger.error("Errore caricamento tabella POI:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA POST /admin/pois (creazione POI)
// =====================
router.post("/", upload.single('photo'), async (req, res) => {
  try {
    let finalImageUrl = req.body.imageUrl || '';

    // Se c'è una foto caricata, processala
    if (req.file) {
      // Genera nome file unico
      const timestamp = Date.now();
      const filename = `poi_${Date.now()}_${timestamp}.jpg`;
      const filepath = path.join(photosDir, filename);

      // EXIF auto-orientation + optional manual rotation
      const rotateDeg = parseInt(req.body.rotateDegrees || '0', 10) || 0;
      let pipeline = sharp(req.file.buffer).rotate(); // auto-orient via EXIF
      if (rotateDeg !== 0) pipeline = pipeline.rotate(rotateDeg);
      await pipeline
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
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
    Logger.error("Errore salvataggio POI:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================
// ROTTA DELETE /admin/pois/:id (eliminazione POI)
// =====================
router.delete("/:id", async (req, res) => {
  try {
    await Poi.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    Logger.error("Errore eliminazione POI:", err);
    res.status(500).json({ success: false });
  }
});

// =====================
// ROTTA GET /admin/poi/edit/:id (modifica POI)
// =====================
router.get("/edit/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      return res.status(400).send("ID POI non valido");
    }
    
    const poi = await Poi.findById(poiId).populate('zone');
    
    if (!poi) {
      return res.status(404).send("POI non trovato");
    }

    const cacheBust = req.query.rotated ? Date.now() : '';
    res.render('poi_edit', { poi, cacheBust });
    
  } catch (error) {
    Logger.error("Errore caricamento POI:", error);
    res.status(500).send("Errore durante il caricamento del POI");
  }
});

// =====================
// ROTTA POST /admin/poi/update/:id (salva modifiche POI)
// =====================
router.post("/update/:id", (req, res) => {
  upload.any()(req, res, async (uploadErr) => {
    if (uploadErr) {
      Logger.error("Errore upload aggiornamento POI:", uploadErr);
      const message = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? "La foto supera il limite massimo di 5MB"
        : uploadErr.message || "Errore durante il caricamento dei dati";
      return res.status(400).json({
        success: false,
        message
      });
    }

    try {
      const poiId = req.params.id;
      
      // Validate ObjectId format
      if (!poiId || poiId.length !== 24) {
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
        customIcon,
        photoAttribution
      } = req.body;

      // Convert and validate required fields
      const poiName = name ? name.trim() : '';
      const poiLat = lat ? parseFloat(lat) : null;
      const poiLng = lng ? parseFloat(lng) : null;

      // Validate required fields
      if (!poiName || poiName === '') {
        return res.status(400).json({
          success: false,
          message: "Il nome è obbligatorio"
        });
      }
      
      if (poiLat === null || Number.isNaN(poiLat)) {
        return res.status(400).json({
          success: false,
          message: "La latitudine è obbligatoria e deve essere un numero valido"
        });
      }
      
      if (poiLng === null || Number.isNaN(poiLng)) {
        return res.status(400).json({
          success: false,
          message: "La longitudine è obbligatoria e deve essere un numero valido"
        });
      }

      // Find and update POI
      const poi = await Poi.findById(poiId);
      if (!poi) {
        return res.status(404).json({
          success: false,
          message: "POI non trovato"
        });
      }

      // Check if coordinates are being modified
      const coordinatesChanged = (poi.lat !== poiLat || poi.lng !== poiLng);
      
      // Update POI fields
      poi.name = poiName;
      poi.category = category || 'other';
      poi.description = description || '';
      poi.lat = poiLat;
      poi.lng = poiLng;
      poi.source = source || 'manual';
      poi.customIcon = customIcon || '';
      
      // Se le coordinate sono state modificate, confermale (l'admin le sta verificando)
      if (coordinatesChanged && poiLat && poiLng) {
        poi.coordStatus = "confirmed";
      }
      
      // Mantieni isDefinitive se il POI era già definitivo
      // (non viene sovrascritto, rimane true se era true)
      // I POI definitivi possono essere modificati ma rimangono definitivi

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

      // Update photo attribution if provided
      if (photoAttribution !== undefined) {
        if (!poi.imageLicenseStatus) {
          poi.imageLicenseStatus = {};
        }
        poi.imageLicenseStatus.attribution = photoAttribution.trim() || '';
      }

      // Handle photo upload
      const photoFile = req.files ? req.files.find(f => f.fieldname === 'photo') : null;
      if (photoFile) {
        try {
          // EXIF auto-orientation + optional manual rotation
          const rotateDeg = parseInt(req.body.rotateDegrees || '0', 10) || 0;
          let pipeline = sharp(photoFile.buffer).rotate(); // auto-orient via EXIF
          if (rotateDeg !== 0) pipeline = pipeline.rotate(rotateDeg);
          const processedImage = await pipeline
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
          
        } catch (photoError) {
          Logger.error('Errore processamento foto:', photoError);
          // Don't fail the entire update if photo processing fails
        }
      }

      await poi.save();
      
      return res.json({
        success: true,
        message: "POI aggiornato con successo",
        poi: poi
      });

    } catch (error) {
      Logger.error("Errore aggiornamento POI:", error);
      return res.status(500).json({
        success: false,
        message: "Errore durante l'aggiornamento del POI",
        error: error.message
      });
    }
  });
});

// =====================
// ROTTA POST /admin/poi/rotate/:id (ruota immagine esistente)
// =====================
router.post("/rotate/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    const rotateDeg = parseInt(req.body.rotateDegrees || '0', 10) || 0;
    if (!poiId || poiId.length !== 24) {
      return res.redirect(`/admin/poi/edit/${poiId}?rotated=1`);
    }

    const poi = await Poi.findById(poiId);
    if (!poi || !poi.imageUrl || !poi.imageUrl.trim()) {
      return res.redirect(`/admin/poi/edit/${poiId}?rotated=1`);
    }

    // Costruisci path fisico del file a partire dall'URL pubblico
    const basename = path.basename(poi.imageUrl);
    // Supporta sia /photos che /uploads
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    let filePath = path.join(photosDir, basename);
    if (poi.imageUrl.startsWith('/uploads')) {
      filePath = path.join(uploadsDir, basename);
    }

    try {
      // Leggi, auto-orienta da EXIF, ruota e sovrascrivi il file
      const output = await sharp(filePath)
        .rotate() // auto-orient via EXIF
        .rotate(rotateDeg)
        .jpeg({ quality: 85 })
        .toBuffer();
      await fs.promises.writeFile(filePath, output);

      // Salva info opzionale in DB
      if (!poi.extraInfo) poi.extraInfo = {};
      poi.extraInfo.lastManualRotation = rotateDeg;
      poi.extraInfo.lastManualRotationAt = new Date();
      await poi.save();
    } catch (imgErr) {
      Logger.error('Errore rotazione immagine esistente:', imgErr);
    }

    return res.redirect(`/admin/poi/edit/${poiId}?rotated=1`);
  } catch (err) {
    Logger.error('Errore endpoint rotazione immagine:', err);
    return res.redirect(`/admin/poi/edit/${req.params.id}?rotated=1`);
  }
});

// =====================
// ROTTA POST /admin/poi/make-definitive/:id (rendi POI definitivo)
// =====================
router.post("/make-definitive/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "ID POI non valido"
      });
    }
    
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        message: "POI non trovato"
      });
    }
    
    // Rendi il POI definitivo
    poi.isDefinitive = true;
    // Se le coordinate sono presenti, imposta sempre coordStatus a "confirmed"
    // Un POI definitivo deve avere coordinate confermate
    if (poi.lat && poi.lng) {
      poi.coordStatus = "confirmed";
    }
    await poi.save();
    
    Logger.info(`✅ POI "${poi.name}" (${poiId}) reso definitivo`);
    
    res.json({
      success: true,
      message: "POI reso definitivo con successo",
      poi: poi
    });
    
  } catch (error) {
    Logger.error("Errore nel rendere definitivo il POI:", error);
    res.status(500).json({
      success: false,
      message: "Errore durante l'operazione: " + error.message
    });
  }
});

// =====================
// ROTTA GET /admin/poi/delete/:id (elimina POI)
// =====================
router.get("/delete/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      return res.status(400).send("ID POI non valido");
    }
    
    const deletedPOI = await Poi.findByIdAndDelete(poiId);
    if (!deletedPOI) {
      return res.status(404).send("POI non trovato");
    }
    
    res.redirect("/admin/pois?message=POI eliminato con successo");
    
  } catch (error) {
    Logger.error("Errore eliminazione POI:", error);
    res.status(500).send("Errore durante l'eliminazione del POI");
  }
});

// =====================
// ROTTA POST /admin/pois/check-photo-licenses (verifica licenze foto POI definitivi)
// =====================
router.post("/check-photo-licenses", async (req, res) => {
  try {
    const PhotoLicenseChecker = require('../../services/photoLicenseChecker');
    const checker = new PhotoLicenseChecker();
    
    Logger.info('🔍 Avvio verifica licenze foto POI definitivi');
    
    // Verifica tutti i POI definitivi
    const results = await checker.checkAllDefinitivePOIs(null, (progress) => {
      // Log progresso (opzionale, per debug)
      if (progress.current % 10 === 0 || progress.current === progress.total) {
        Logger.info(`📊 Progresso: ${progress.current}/${progress.total} - ${progress.poi}: ${progress.status}`);
      }
    });
    
    res.json({
      success: true,
      message: `Verifica completata: ${results.checked} POI verificati`,
      results: results
    });
    
  } catch (error) {
    Logger.error("Errore verifica licenze foto:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================
// ROTTA POST /admin/pois/:id/check-photo-license (verifica licenza singola foto)
// =====================
router.post("/:id/check-photo-license", async (req, res) => {
  try {
    const poiId = req.params.id;
    
    // Validate ObjectId format
    if (!poiId || poiId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "ID POI non valido"
      });
    }
    
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        message: "POI non trovato"
      });
    }
    
    const PhotoLicenseChecker = require('../../services/photoLicenseChecker');
    const checker = new PhotoLicenseChecker();
    
    // Verifica licenza
    const licenseInfo = await checker.checkImageLicense(poi);
    
    // Aggiorna il POI
    if (!poi.imageLicenseStatus) {
      poi.imageLicenseStatus = {};
    }
    
    poi.imageLicenseStatus.status = licenseInfo.status;
    poi.imageLicenseStatus.source = licenseInfo.source || '';
    poi.imageLicenseStatus.author = licenseInfo.author || '';
    poi.imageLicenseStatus.authorUrl = licenseInfo.authorUrl || '';
    poi.imageLicenseStatus.license = licenseInfo.license || '';
    poi.imageLicenseStatus.photoUrl = licenseInfo.photoUrl || '';
    poi.imageLicenseStatus.attribution = licenseInfo.attribution || '';
    poi.imageLicenseStatus.checkedAt = licenseInfo.checkedAt || new Date();
    poi.imageLicenseStatus.notes = licenseInfo.notes || '';
    
    await poi.save();
    
    res.json({
      success: true,
      message: "Licenza verificata con successo",
      licenseInfo: licenseInfo,
      poi: poi
    });
    
  } catch (error) {
    Logger.error("Errore verifica licenza foto:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
