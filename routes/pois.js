const express = require("express");
const router = express.Router();
const Poi = require("../models/Poi");

// ===============================
// 📄 LISTA POI (JSON o pagina)
// ===============================
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.zone) filter.zone = req.query.zone;

    const pois = await Poi.find(filter).populate("zone", "name");
    if (req.query.format === "json") return res.json(pois);
    res.render("admin_pois", { pois });
  } catch (err) {
    console.error("Errore caricamento POI:", err);
    res.status(500).send("Errore server");
  }
});

// ===============================
// ➕ CREAZIONE POI (manuale o automatica)
// ===============================
router.post("/", async (req, res) => {
  try {
    const { name, lat, lng, zone, description, category } = req.body;

    if (!name || !lat || !lng || !zone) {
      return res
        .status(400)
        .json({ success: false, message: "Dati mancanti" });
    }

    const poi = new Poi({
      name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zone,
      category: category || "generico",
      description:
        typeof description === "object"
          ? description
          : { it: description || "" },
    });

    await poi.save();
    res.json({ success: true, poi });
  } catch (err) {
    console.error("❌ Errore durante il salvataggio POI:", err);
    res.status(500).json({ success: false });
  }
});

// ===============================
// ✏️ AGGIORNAMENTO POI (drag, rename, edit testo)
// ===============================
router.put("/:id", async (req, res) => {
  try {
    const { name, lat, lng, description, category } = req.body;
    const poi = await Poi.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(lat && { lat }),
        ...(lng && { lng }),
        ...(description && { description }),
        ...(category && { category }),
      },
      { new: true }
    );
    res.json({ success: true, poi });
  } catch (err) {
    console.error("Errore aggiornamento POI:", err);
    res.status(500).json({ success: false });
  }
});

// ===============================
// 🗑️ ELIMINAZIONE POI
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    await Poi.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Errore eliminazione POI:", err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;