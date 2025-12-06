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
// ✅ FIX: Logging ridotto per evitare flooding
let lastZonesLog = 0;
const ZONES_LOG_INTERVAL = 30000; // 30 secondi

router.get("/", async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastZonesLog >= ZONES_LOG_INTERVAL) {
      console.log("📥 GET /zones richiesto"); // ✅ FIX: Log solo ogni 30 secondi
      lastZonesLog = now;
    }
    const zones = await Zone.find().lean();
    if (now - lastZonesLog >= ZONES_LOG_INTERVAL) {
      console.log("✅ Zone trovate:", zones.length); // ✅ FIX: Log solo ogni 30 secondi
    }
    res.json(zones);
  } catch (err) {
    console.error("❌ Errore GET /zones:", err); // ✅ FIX: Errori sempre loggati
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
    
    // 🔒 Validazione coordinate PRIMA di salvare
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      console.error(`❌ Tentativo creazione zona con coordinate invalide: ${coordinates?.length || 0} punti`);
      return res.status(400).json({ 
        error: `Coordinate non valide: richiesti almeno 3 punti, ricevuti ${coordinates?.length || 0}` 
      });
    }
    
    // Verifica che ogni punto sia un array di 2 numeri
    const invalidPoints = coordinates.filter(p => 
      !Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number'
    );
    
    if (invalidPoints.length > 0) {
      console.error(`❌ ${invalidPoints.length} punti non validi su ${coordinates.length}`);
      return res.status(400).json({ 
        error: `${invalidPoints.length} punti non validi nelle coordinate` 
      });
    }
    
    console.log(`✅ Creazione zona "${name}" con ${coordinates.length} coordinate validate`);
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
    const { coordinates } = req.body;
    console.log("📥 PUT /zones/:id richiesto per zona:", id, "con dati:", req.body);
    
    // 🔒 Validazione coordinate se presenti nel body
    if (coordinates !== undefined) {
      if (!Array.isArray(coordinates) || coordinates.length < 3) {
        console.error(`❌ Tentativo aggiornamento zona ${id} con coordinate invalide: ${coordinates?.length || 0} punti`);
        return res.status(400).json({ 
          error: `Coordinate non valide: richiesti almeno 3 punti, ricevuti ${coordinates?.length || 0}` 
        });
      }
      
      // Verifica che ogni punto sia un array di 2 numeri
      const invalidPoints = coordinates.filter(p => 
        !Array.isArray(p) || p.length < 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number'
      );
      
      if (invalidPoints.length > 0) {
        console.error(`❌ ${invalidPoints.length} punti non validi su ${coordinates.length}`);
        return res.status(400).json({ 
          error: `${invalidPoints.length} punti non validi nelle coordinate` 
        });
      }
      
      console.log(`✅ Coordinate validate per zona ${id}: ${coordinates.length} punti`);
    }
    
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

    // Redirect alla pagina zone dopo l'eliminazione
    res.redirect("/admin/zones");
  } catch (err) {
    console.error("❌ Errore DELETE /zones/:id:", err);
    res.status(500).json({ error: "Errore eliminazione zona" });
  }
});

module.exports = router;