// ===============================
// 🌊 Andaly Whatis — Admin Geographic Areas Routes
// ===============================

const express = require("express");
const router = express.Router();
const GeographicArea = require("../../models/GeographicArea");
const Zone = require("../../models/Zone");
const Logger = require('../../utils/logger');

/**
 * GET /admin/geographic-areas
 * Pagina di gestione delle aree geografiche
 */
router.get("/", async (req, res) => {
  try {
    const areas = await GeographicArea.find().sort({ sortOrder: 1 });
    
    // Conta le zone per ogni area
    const areasWithZoneCount = await Promise.all(
      areas.map(async (area) => {
        const zoneCount = await Zone.countDocuments({ geographicArea: area._id });
        return {
          ...area.toObject(),
          zoneCount: zoneCount
        };
      })
    );
    
    res.render("admin_geographic_areas", { 
      areas: areasWithZoneCount,
      title: "Gestione Aree Geografiche"
    });
  } catch (err) {
    Logger.error("Errore caricamento aree geografiche:", err);
    res.status(500).send("Errore server");
  }
});

/**
 * GET /admin/geographic-areas/api
 * API per ottenere tutte le aree geografiche (JSON)
 */
router.get("/api", async (req, res) => {
  try {
    const areas = await GeographicArea.find().sort({ sortOrder: 1 });
    
    const areasWithZoneCount = await Promise.all(
      areas.map(async (area) => {
        const zoneCount = await Zone.countDocuments({ geographicArea: area._id });
        return {
          ...area.toObject(),
          zoneCount: zoneCount
        };
      })
    );
    
    res.json({
      success: true,
      areas: areasWithZoneCount
    });
  } catch (err) {
    Logger.error("Errore API aree geografiche:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore nel caricamento delle aree geografiche" 
    });
  }
});

/**
 * POST /admin/geographic-areas
 * Crea una nuova area geografica
 */
router.post("/", async (req, res) => {
  try {
    const areaData = req.body;
    
    // Validazione base
    if (!areaData.name || !areaData.displayName) {
      return res.status(400).json({
        success: false,
        error: "Nome e nome visualizzato sono obbligatori"
      });
    }
    
    const area = new GeographicArea(areaData);
    const saved = await area.save();
    
    Logger.info(`Nuova area geografica creata: ${saved.displayName}`);
    
    res.json({
      success: true,
      area: saved,
      message: `Area geografica "${saved.displayName}" creata con successo`
    });
  } catch (err) {
    Logger.error("Errore creazione area geografica:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore durante la creazione dell'area geografica" 
    });
  }
});

/**
 * PUT /admin/geographic-areas/:id
 * Aggiorna un'area geografica esistente
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updated = await GeographicArea.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Area geografica non trovata"
      });
    }
    
    Logger.info(`Area geografica aggiornata: ${updated.displayName}`);
    
    res.json({
      success: true,
      area: updated,
      message: `Area geografica "${updated.displayName}" aggiornata con successo`
    });
  } catch (err) {
    Logger.error("Errore aggiornamento area geografica:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore durante l'aggiornamento dell'area geografica" 
    });
  }
});

/**
 * DELETE /admin/geographic-areas/:id
 * Elimina un'area geografica
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica se ci sono zone associate
    const zoneCount = await Zone.countDocuments({ geographicArea: id });
    if (zoneCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Impossibile eliminare l'area: ${zoneCount} zone sono ancora associate`
      });
    }
    
    const deleted = await GeographicArea.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Area geografica non trovata"
      });
    }
    
    Logger.info(`Area geografica eliminata: ${deleted.displayName}`);
    
    res.json({
      success: true,
      message: `Area geografica "${deleted.displayName}" eliminata con successo`
    });
  } catch (err) {
    Logger.error("Errore eliminazione area geografica:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore durante l'eliminazione dell'area geografica" 
    });
  }
});

/**
 * GET /admin/geographic-areas/:id/zones
 * Ottiene tutte le zone di un'area geografica
 */
router.get("/:id/zones", async (req, res) => {
  try {
    const { id } = req.params;
    
    const area = await GeographicArea.findById(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        error: "Area geografica non trovata"
      });
    }
    
    const zones = await Zone.find({ geographicArea: id });
    
    res.json({
      success: true,
      area: {
        id: area._id,
        name: area.name,
        displayName: area.displayName
      },
      zones: zones
    });
  } catch (err) {
    Logger.error("Errore caricamento zone area geografica:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore nel caricamento delle zone" 
    });
  }
});

/**
 * PUT /admin/geographic-areas/:areaId/assign-zone/:zoneId
 * Assegna una zona a un'area geografica
 */
router.put("/:areaId/assign-zone/:zoneId", async (req, res) => {
  try {
    const { areaId, zoneId } = req.params;
    
    // Verifica che l'area esista
    const area = await GeographicArea.findById(areaId);
    if (!area) {
      return res.status(404).json({
        success: false,
        error: "Area geografica non trovata"
      });
    }
    
    // Aggiorna la zona
    const zone = await Zone.findByIdAndUpdate(
      zoneId,
      { geographicArea: areaId },
      { new: true }
    );
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: "Zona non trovata"
      });
    }
    
    Logger.info(`Zona "${zone.name}" assegnata all'area "${area.displayName}"`);
    
    res.json({
      success: true,
      message: `Zona "${zone.name}" assegnata all'area "${area.displayName}"`
    });
  } catch (err) {
    Logger.error("Errore assegnazione zona ad area geografica:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore durante l'assegnazione della zona" 
    });
  }
});

/**
 * DELETE /admin/geographic-areas/:areaId/remove-zone/:zoneId
 * Rimuove una zona da un'area geografica
 */
router.delete("/:areaId/remove-zone/:zoneId", async (req, res) => {
  try {
    const { zoneId } = req.params;
    
    const zone = await Zone.findByIdAndUpdate(
      zoneId,
      { geographicArea: null },
      { new: true }
    );
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: "Zona non trovata"
      });
    }
    
    Logger.info(`Zona "${zone.name}" rimossa dall'area geografica`);
    
    res.json({
      success: true,
      message: `Zona "${zone.name}" rimossa dall'area geografica`
    });
  } catch (err) {
    Logger.error("Errore rimozione zona da area geografica:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore durante la rimozione della zona" 
    });
  }
});

module.exports = router;
