const express = require("express");
const router = express.Router();
const Poi = require("../models/Poi");
const Zone = require("../models/Zone");
const POIAutoFetcher = require("../services/poiAutoFetcher");

// ===============================
// 📍 LISTA POI (JSON o pagina)
// ===============================
router.get("/", async (req, res) => {
  try {
    let filter = {};
    
    // Filtra per zona se specificata e valida (supporta sia zone che zone_id)
    const zoneId = req.query.zone_id || req.query.zone;
    if (zoneId && zoneId !== "undefined" && zoneId !== "") {
      filter.zone = zoneId;
      console.log(`📍 Loading POIs for zone: ${zoneId}`);
    } else {
      console.log("📍 Loading all POIs");
    }
    
    // Filtra per categoria se specificata
    if (req.query.category && req.query.category !== "undefined" && req.query.category !== "") {
      filter.category = req.query.category;
      console.log(`📍 Filtering by category: ${req.query.category}`);
    }
    
    const pois = await Poi.find(filter).populate("zone", "name").sort({ updatedAt: -1 });
    console.log(`✅ Found ${pois.length} POIs`);
    
    // Ottieni il nome della zona se è specificata
    let zoneName = null;
    if (zoneId && zoneId !== "undefined" && zoneId !== "") {
      const zone = await Zone.findById(zoneId);
      zoneName = zone ? zone.name : null;
    }
    
    // Carica tutte le zone per il filtro
    const zones = await Zone.find().select("name _id").sort({ name: 1 }).lean();
    
    if (req.query.format === "json") return res.json(pois);
    res.render("admin_pois", { pois, zoneName, zones, selectedZoneId: zoneId || null, selectedMunicipality: req.query.municipality || null });
  } catch (err) {
    console.error("❌ Errore caricamento POI:", err);
    // Return JSON error even for non-JSON requests to be consistent
    if (req.query.format === "json") {
      return res.status(500).json({ 
        success: false, 
        error: "Errore server", 
        message: err.message 
      });
    }
    res.status(500).send("Errore server");
  }
});

// ===============================
// 🔄 PATCH POI (per aggiornare coordStatus)
// ===============================
router.patch("/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    const updates = req.body;
    
    console.log(`🔄 Patching POI: ${poiId}`, updates);
    
    // Se vengono modificate le coordinate, imposta coordStatus a "confirmed"
    if (updates.lat !== undefined || updates.lng !== undefined) {
      updates.coordStatus = "confirmed";
    }
    
    const updatedPOI = await Poi.findByIdAndUpdate(
      poiId,
      updates,
      { new: true, runValidators: true }
    ).populate("zone", "name");
    
    if (!updatedPOI) {
      return res.status(404).json({
        success: false,
        message: "POI non trovato"
      });
    }
    
    console.log(`✅ POI patched successfully: ${updatedPOI.name}`);
    res.json({
      success: true,
      message: "POI aggiornato con successo",
      poi: updatedPOI
    });
  } catch (err) {
    console.error("❌ Errore patch POI:", err);
    res.status(500).json({
      success: false,
      message: "Errore durante l'aggiornamento del POI"
    });
  }
});

// ===============================
// ➕ AGGIUNTA POI
// ===============================
router.post("/", async (req, res) => {
  try {
    const { name, lat, lng, zone, description } = req.body;
    console.log("📍 Creating POI with data:", { name, lat, lng, zone, description });

    if (!name || !lat || !lng || !zone) {
      console.error("❌ Missing required fields:", { name, lat, lng, zone });
      return res.status(400).json({ success: false, message: "Dati mancanti" });
    }

    const poi = new Poi({
      name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zone,
      description: description || "",
      coordStatus: req.body.coordStatus || "unconfirmed" // Se specificato, usa quello, altrimenti default
    });

    await poi.save();
    console.log("✅ POI created successfully:", poi._id);
    res.json({ success: true, poi });
  } catch (err) {
    console.error("❌ Errore durante il salvataggio del POI:", err);
    res.status(500).json({ success: false, message: "Errore server" });
  }
});

// ===============================
// 🔍 GET SINGLE POI
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    const poi = await Poi.findById(poiId).populate("zone", "name");
    
    if (!poi) {
      return res.status(404).json({
        success: false,
        message: "POI non trovato"
      });
    }
    
    console.log(`🔍 Retrieved POI: ${poi.name}`);
    res.json({ success: true, poi });
  } catch (err) {
    console.error("❌ Errore recupero POI:", err);
    res.status(500).json({
      success: false,
      message: "Errore durante il recupero del POI"
    });
  }
});

// ===============================
// ✏️ AGGIORNA POI
// ===============================
router.put("/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    const { name, lat, lng, zone, description, category, source } = req.body;
    
    console.log(`✏️ Updating POI: ${poiId}`);
    
    // Validate required fields
    if (!name || !lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Nome, latitudine e longitudine sono obbligatori"
      });
    }
    
    const updatedPOI = await Poi.findByIdAndUpdate(
      poiId, 
      {
        name,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        zone: zone || undefined,
        description: description || "",
        category: category || "other",
        source: source || "manual",
        coordStatus: "confirmed" // Quando modificato manualmente, le coordinate sono confermate
      },
      { new: true, runValidators: true }
    ).populate("zone", "name");
    
    if (!updatedPOI) {
      return res.status(404).json({
        success: false,
        message: "POI non trovato"
      });
    }
    
    console.log(`✅ POI updated successfully: ${updatedPOI.name}`);
    res.json({
      success: true,
      message: "POI aggiornato con successo",
      poi: updatedPOI
    });
  } catch (err) {
    console.error("❌ Errore aggiornamento POI:", err);
    res.status(500).json({
      success: false,
      message: "Errore durante l'aggiornamento del POI"
    });
  }
});

// ===============================
// 🗑️ ELIMINA POI
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    const poiId = req.params.id;
    console.log(`🗑️ Deleting POI: ${poiId}`);
    
    const deletedPOI = await Poi.findByIdAndDelete(poiId);
    if (!deletedPOI) {
      return res.status(404).json({ 
        success: false, 
        message: "POI non trovato" 
      });
    }
    
    console.log(`✅ POI deleted successfully: ${deletedPOI.name}`);
    res.json({ 
      success: true, 
      message: "POI eliminato con successo",
      deletedPOI: { id: deletedPOI._id, name: deletedPOI.name }
    });
  } catch (err) {
    console.error("❌ Errore eliminazione POI:", err);
    res.status(500).json({ 
      success: false, 
      message: "Errore durante l'eliminazione del POI" 
    });
  }
});

// ===============================
// 🧠 AUTO FETCH POIs
// ===============================
router.post("/auto", async (req, res) => {
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
    
    // Initialize auto fetcher
    const fetcher = new POIAutoFetcher();
    
    // Fetch POIs from external sources
    const fetchedPOIs = await fetcher.fetchPOIsForZone(zoneData);
    
    // Save POIs to database
    const savedPOIs = [];
    for (const poiData of fetchedPOIs) {
      try {
        const poi = new Poi({
          ...poiData,
          zone: zoneId,
          description: poiData.extraInfo?.aiSummary || poiData.description || ""
        });
        
        await poi.save();
        savedPOIs.push(poi);
        console.log(`✅ Saved POI: ${poi.name} (${poi.category})`);
      } catch (saveError) {
        console.error(`❌ Error saving POI ${poiData.name}:`, saveError);
      }
    }

    console.log(`✅ Auto-fetched and saved ${savedPOIs.length} POIs`);
    
    res.json({
      success: true,
      message: `Successfully imported ${savedPOIs.length} POIs`,
      pois: savedPOIs,
      count: savedPOIs.length
    });

  } catch (error) {
    console.error("❌ Error in auto POI fetch:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching POIs",
      error: error.message
    });
  }
});

// ===============================
// 📊 GET POIs BY CATEGORY
// ===============================
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { zone } = req.query;
    
    let filter = { category };
    if (zone && zone !== "undefined" && zone !== "") {
      filter.zone = zone;
    }
    
    const pois = await Poi.find(filter).populate("zone", "name");
    
    console.log(`📊 Found ${pois.length} POIs in category: ${category}`);
    
    res.json({
      success: true,
      category,
      pois,
      count: pois.length
    });
    
  } catch (error) {
    console.error("❌ Error fetching POIs by category:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching POIs by category",
      error: error.message
    });
  }
});

// ===============================
// 📊 GET POI CATEGORIES
// ===============================
router.get("/categories", async (req, res) => {
  try {
    const categories = await Poi.distinct("category");
    const categoryCounts = await Poi.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      categories,
      categoryCounts
    });
    
  } catch (error) {
    console.error("❌ Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message
    });
  }
});

// ===============================
// 🎯 GET AR-READY POIs
// ===============================
router.get("/ar", async (req, res) => {
  try {
    const { zone, category, limit = 50 } = req.query;
    
    let filter = { arVisible: true };
    if (zone && zone !== "undefined" && zone !== "") {
      filter.zone = zone;
    }
    if (category && category !== "undefined" && category !== "") {
      filter.category = category;
    }
    
    const pois = await Poi.find(filter)
      .select("name lat lng category customIcon arIcon arPriority extraInfo.aiSummary")
      .populate("zone", "name")
      .sort({ arPriority: -1, _id: -1 })
      .limit(parseInt(limit));
    
    // Format for AR consumption
    const arPOIs = pois.map(poi => ({
      id: poi._id,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      category: poi.category,
      icon: poi.customIcon || poi.arIcon, // Priority to custom icon
      priority: poi.arPriority,
      summary: poi.extraInfo?.aiSummary || "",
      zone: poi.zone?.name || ""
    }));
    
    console.log(`🎯 Generated ${arPOIs.length} AR-ready POIs`);
    
    res.json({
      success: true,
      pois: arPOIs,
      count: arPOIs.length,
      metadata: {
        generated: new Date().toISOString(),
        version: "1.0"
      }
    });
    
  } catch (error) {
    console.error("❌ Error generating AR POIs:", error);
    res.status(500).json({
      success: false,
      message: "Error generating AR POIs",
      error: error.message
    });
  }
});

module.exports = router;