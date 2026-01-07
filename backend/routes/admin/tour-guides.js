/**
 * Admin Routes - Tour Guides Management
 * 
 * Handles all tour guide-related admin routes:
 * - GET /admin/tour-guides - List all zones with tour guides management
 * - GET /admin/tour-guides/:zoneId - Show form to edit tour guides for a zone
 * - POST /admin/tour-guides/:zoneId - Save tour guides for a zone
 * 
 * @module routes/admin/tour-guides
 */

const express = require("express");
const router = express.Router();
const Zone = require("../../models/Zone");
const Logger = require('../../utils/logger');

// =====================
// ROTTA GET /admin/tour-guides (lista zone)
// =====================
router.get("/", async (req, res) => {
  try {
    const zones = await Zone.find().select('_id name description tourGuides').sort({ name: 1 });

    // Se richiesto formato JSON → restituisce JSON puro
    if (req.query.format === "json") {
      return res.json(zones);
    }

    res.render("admin_tour_guides", { zones });
  } catch (err) {
    Logger.error("Errore caricamento zone per guide turistiche:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA GET /admin/tour-guides/:zoneId (form modifica guide per zona)
// =====================
router.get("/:zoneId", async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).send("Zona non trovata");
    }

    res.render("admin_tour_guides_edit", { zone });
  } catch (err) {
    Logger.error("Errore caricamento zona per modifica guide:", err);
    res.status(500).send("Errore server");
  }
});

// =====================
// ROTTA POST /admin/tour-guides/:zoneId (salva guide per zona)
// =====================
router.post("/:zoneId", async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { tourGuides } = req.body; // Array di guide turistiche

    // Validazione
    if (!Array.isArray(tourGuides)) {
      return res.status(400).json({
        success: false,
        message: "tourGuides deve essere un array"
      });
    }

    // Validazione ogni guida
    for (const guide of tourGuides) {
      if (!guide.name || !guide.website) {
        return res.status(400).json({
          success: false,
          message: "Ogni guida deve avere almeno 'name' e 'website'"
        });
      }
    }

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zona non trovata"
      });
    }

    // Log dati ricevuti
    console.log(`📥 [Tour Guides] Ricevute ${tourGuides.length} guide per zona ${zone.name} (ID: ${zoneId})`);
    console.log(`📥 [Tour Guides] Dati ricevuti:`, JSON.stringify(tourGuides, null, 2));

    // Aggiorna le guide turistiche
    zone.tourGuides = tourGuides.map(guide => ({
      name: guide.name.trim(),
      website: guide.website.trim(),
      description: guide.description ? guide.description.trim() : "",
      phone: guide.phone ? guide.phone.trim() : "",
      email: guide.email ? guide.email.trim() : ""
    }));

    await zone.save();

    console.log(`✅ Guide turistiche aggiornate per zona ${zone.name}: ${zone.tourGuides.length} guide salvate`);
    console.log(`✅ [Tour Guides] Guide salvate nel DB:`, JSON.stringify(zone.tourGuides, null, 2));
    
    res.json({
      success: true,
      message: `Guide turistiche salvate con successo per "${zone.name}"`,
      zone: {
        id: zone._id,
        name: zone.name,
        tourGuides: zone.tourGuides
      }
    });
  } catch (err) {
    Logger.error("Errore salvataggio guide turistiche:", err);
    res.status(500).json({
      success: false,
      message: "Errore server"
    });
  }
});

module.exports = router;

