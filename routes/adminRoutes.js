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

module.exports = router;