// ===============================
// 🌊 Andaly Whatis — Zone Routes
// ===============================

const express = require("express");
const router = express.Router();
const Zone = require("../models/Zone");
const Poi = require("../models/Poi");

// ===============================
// GET /zones — restituisce sempre JSON
// ===============================
router.get("/", async (req, res) => {
  try {
    console.log("📥 GET /zones richiesto");
    const zones = await Zone.find().lean();
    console.log("✅ Zone trovate:", zones.length);
    res.json(zones);
  } catch (err) {
    console.error("❌ Errore GET /zones:", err);
    res.status(500).json({ error: "Errore nel caricamento delle zone" });
  }
});

// ===============================
// POST /zones — crea una nuova zona
// ===============================
router.post("/", async (req, res) => {
  try {
    console.log("📥 POST /zones richiesto con dati:", req.body);
    const { name, description, coordinates } = req.body;
    const zone = new Zone({ name, description, coordinates });
    const saved = await zone.save();
    console.log("✅ Zona salvata:", saved._id);
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Errore POST /zones:", err);
    res.status(500).json({ error: "Errore creazione zona" });
  }
});

// ===============================
// PUT /zones/:id — aggiorna una zona
// ===============================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("📥 PUT /zones/:id richiesto per zona:", id, "con dati:", req.body);
    const updated = await Zone.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Zona non trovata" });
    console.log("✅ Zona aggiornata:", updated._id);
    res.json(updated);
  } catch (err) {
    console.error("❌ Errore PUT /zones/:id:", err);
    res.status(500).json({ error: "Errore aggiornamento zona" });
  }
});

// ===============================
// DELETE /zones/:id — elimina una zona
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Zone.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Zona non trovata" });

    // Elimina i POI associati alla zona
    await Poi.deleteMany({ zone: id });

    res.json({ message: "Zona e POI associati eliminati" });
  } catch (err) {
    console.error("❌ Errore DELETE /zones/:id:", err);
    res.status(500).json({ error: "Errore eliminazione zona" });
  }
});

module.exports = router;