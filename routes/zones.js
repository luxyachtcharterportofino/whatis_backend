const express = require("express");
const router = express.Router();
const Zone = require("../models/Zone");
const Poi = require("../models/Poi");

// ===============================
// 🗺️ VISUALIZZA TUTTE LE ZONE
// ===============================
router.get("/", async (req, res) => {
  try {
    const zones = await Zone.find();
    if (req.query.format === "json") return res.json(zones);
    res.render("admin_zones", { zones });
  } catch (err) {
    console.error("Errore caricamento zone:", err);
    res.status(500).send("Errore server");
  }
});

// ===============================
// ➕ CREA ZONA
// ===============================
router.post("/add", async (req, res) => {
  try {
    const zone = new Zone(req.body);
    await zone.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Errore salvataggio zona:", err);
    res.status(500).json({ success: false });
  }
});

// ===============================
// ❌ ELIMINA ZONA + POI ASSOCIATI
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await Poi.deleteMany({ zone: id });
    await Zone.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Errore eliminazione zona:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;