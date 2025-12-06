// ===============================
// 🌊 Andaly Whatis — Mobile App Routes
// ===============================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const GeographicArea = require("../models/GeographicArea");
const Zone = require("../models/Zone");
const Poi = require("../models/Poi");

/**
 * GET /mobile/areas
 * Restituisce tutte le aree geografiche attive per l'app mobile
 */
router.get("/areas", async (req, res) => {
  try {
    const { language = 'it' } = req.query;
    
    console.log(`📱 GET /mobile/areas richiesto (lingua: ${language})`);
    
    const areas = await GeographicArea.getActiveAreas();
    
    // Formatta le aree per l'app mobile
    const formattedAreas = areas.map(area => ({
      id: area._id,
      name: area.name,
      displayName: area.getDisplayName(language),
      description: area.getDescription(language),
      color: area.color,
      icon: area.icon,
      price: area.basePrice,
      priceFormatted: `€${(area.basePrice / 100).toFixed(2)}`,
      metadata: {
        centerLat: area.metadata.centerLat,
        centerLng: area.metadata.centerLng,
        zoomLevel: area.metadata.zoomLevel,
        previewImage: area.metadata.previewImage,
        tags: area.metadata.tags,
        primaryLanguage: area.metadata.primaryLanguage
      },
      sortOrder: area.sortOrder
    }));
    
    console.log(`✅ Aree geografiche trovate: ${formattedAreas.length}`);
    
    res.json({
      success: true,
      areas: formattedAreas,
      totalAreas: formattedAreas.length
    });
    
  } catch (err) {
    console.error("❌ Errore GET /mobile/areas:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore nel caricamento delle aree geografiche" 
    });
  }
});

/**
 * GET /mobile/areas/:areaId/zones
 * Restituisce tutte le zone di un'area geografica specifica
 */
router.get("/areas/:areaId/zones", async (req, res) => {
  try {
    const { areaId } = req.params;
    const { language = 'it' } = req.query;
    
    console.log(`📱 GET /mobile/areas/${areaId}/zones richiesto`);
    
    // Verifica che l'area esista
    const area = await GeographicArea.findById(areaId);
    if (!area) {
      return res.status(404).json({
        success: false,
        error: "Area geografica non trovata"
      });
    }
    
    // Trova tutte le zone dell'area
    const zones = await Zone.find({ geographicArea: areaId }).lean();
    
    // Conta i POI per ogni zona
    const zonesWithPOICount = await Promise.all(
      zones.map(async (zone) => {
        const poiCount = await Poi.countDocuments({ zone: zone._id });
        
        return {
          id: zone._id,
          name: zone.name,
          description: zone.description,
          coordinates: zone.coordinates,
          poiCount: poiCount,
          price: zone.customPrice || area.basePrice,
          priceFormatted: `€${((zone.customPrice || area.basePrice) / 100).toFixed(2)}`,
          appMetadata: zone.appMetadata || {
            difficulty: "easy",
            estimatedVisitTime: 2,
            bestSeason: "all_year",
            accessibility: "full"
          }
        };
      })
    );
    
    console.log(`✅ Zone trovate per area ${area.displayName}: ${zonesWithPOICount.length}`);
    
    res.json({
      success: true,
      area: {
        id: area._id,
        name: area.name,
        displayName: area.getDisplayName(language),
        description: area.getDescription(language)
      },
      zones: zonesWithPOICount,
      totalZones: zonesWithPOICount.length,
      totalPOIs: zonesWithPOICount.reduce((sum, zone) => sum + zone.poiCount, 0)
    });
    
  } catch (err) {
    console.error("❌ Errore GET /mobile/areas/:areaId/zones:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore nel caricamento delle zone" 
    });
  }
});

/**
 * GET /mobile/zones/:zoneId/pois
 * Restituisce tutti i POI di una zona specifica (per l'app mobile)
 */
router.get("/zones/:zoneId/pois", async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { language = 'it' } = req.query;
    
    console.log(`📱 GET /mobile/zones/${zoneId}/pois richiesto (lingua: ${language})`);
    
    // ✅ VALIDAZIONE: Verifica che zoneId sia un ObjectId valido
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      console.error(`❌ ZoneId non valido: ${zoneId} (deve essere un ObjectId MongoDB valido)`);
      return res.status(400).json({
        success: false,
        error: "ID zona non valido. L'ID deve essere un ObjectId MongoDB valido."
      });
    }
    
    // Verifica che la zona esista
    const zone = await Zone.findById(zoneId).populate('geographicArea');
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: "Zona non trovata"
      });
    }
    
    // Trova tutti i POI DEFINITIVI della zona (solo quelli scaricabili dai turisti)
    // ✅ CONVERSIONE ESPLICITA: Converti zoneId string in ObjectId per sicurezza
    // ✅ FILTRO: Solo POI definitivi (isDefinitive = true) - i turisti scaricano solo POI approvati
    const zoneObjectId = new mongoose.Types.ObjectId(zoneId);
    const pois = await Poi.find({ 
      zone: zoneObjectId,
      isDefinitive: true  // Solo POI definitivi scaricabili dai turisti
    }).lean();
    
    // Formatta i POI per l'app mobile
    const formattedPOIs = pois.map(poi => {
      // Ottieni nome e descrizione nella lingua richiesta
      const multilingual = poi.multilingual || {};
      const langData = multilingual[language] || {};
      
      return {
        id: poi._id,
        name: langData.name || poi.name,
        description: langData.description || poi.description,
        lat: poi.lat,
        lng: poi.lng,
        category: poi.category,
        semanticCategory: poi.semanticCategory,
        imageUrl: poi.imageUrl,
        customIcon: poi.customIcon,
        source: poi.source,
        extraInfo: {
          rating: poi.extraInfo?.rating || 0,
          accessibility: poi.extraInfo?.accessibility || "public",
          tags: poi.extraInfo?.tags || []
        }
      };
    });
    
    console.log(`✅ POI trovati per zona ${zone.name}: ${formattedPOIs.length}`);
    
    res.json({
      success: true,
      zone: {
        id: zone._id,
        name: zone.name,
        description: zone.description,
        geographicArea: zone.geographicArea ? {
          id: zone.geographicArea._id,
          name: zone.geographicArea.name,
          displayName: zone.geographicArea.displayName
        } : null
      },
      pois: formattedPOIs,
      totalPOIs: formattedPOIs.length
    });
    
  } catch (err) {
    console.error("❌ Errore GET /mobile/zones/:zoneId/pois:", err);
    
    // ✅ GESTIONE ERRORI MIGLIORATA: Distingue tra errori diversi
    let errorMessage = "Errore nel caricamento dei POI";
    let statusCode = 500;
    
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      errorMessage = "ID zona non valido. L'ID deve essere un ObjectId MongoDB valido.";
      statusCode = 400;
    } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      errorMessage = "Errore database";
      statusCode = 500;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

/**
 * GET /mobile/search
 * Ricerca globale per aree, zone e POI
 */
router.get("/search", async (req, res) => {
  try {
    const { q, language = 'it', type = 'all' } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Query di ricerca troppo corta (minimo 2 caratteri)"
      });
    }
    
    console.log(`📱 GET /mobile/search richiesto: "${q}" (tipo: ${type})`);
    
    const results = {
      areas: [],
      zones: [],
      pois: []
    };
    
    const searchRegex = new RegExp(q, 'i');
    
    // Ricerca nelle aree geografiche
    if (type === 'all' || type === 'areas') {
      const areas = await GeographicArea.find({
        isActive: true,
        $or: [
          { displayName: searchRegex },
          { description: searchRegex },
          { 'metadata.tags': searchRegex }
        ]
      }).limit(10);
      
      results.areas = areas.map(area => ({
        id: area._id,
        name: area.name,
        displayName: area.getDisplayName(language),
        description: area.getDescription(language),
        type: 'area',
        icon: area.icon,
        color: area.color
      }));
    }
    
    // Ricerca nelle zone
    if (type === 'all' || type === 'zones') {
      const zones = await Zone.find({
        $or: [
          { name: searchRegex },
          { description: searchRegex }
        ]
      }).populate('geographicArea').limit(20);
      
      results.zones = zones.map(zone => ({
        id: zone._id,
        name: zone.name,
        description: zone.description,
        type: 'zone',
        geographicArea: zone.geographicArea ? {
          id: zone.geographicArea._id,
          displayName: zone.geographicArea.displayName
        } : null
      }));
    }
    
    // Ricerca nei POI
    if (type === 'all' || type === 'pois') {
      const pois = await Poi.find({
        $or: [
          { name: searchRegex },
          { description: searchRegex },
          { semanticCategory: searchRegex },
          { 'extraInfo.tags': searchRegex }
        ]
      }).populate('zone').limit(50);
      
      results.pois = pois.map(poi => {
        const multilingual = poi.multilingual || {};
        const langData = multilingual[language] || {};
        
        return {
          id: poi._id,
          name: langData.name || poi.name,
          description: langData.description || poi.description,
          type: 'poi',
          category: poi.category,
          lat: poi.lat,
          lng: poi.lng,
          zone: poi.zone ? {
            id: poi.zone._id,
            name: poi.zone.name
          } : null
        };
      });
    }
    
    const totalResults = results.areas.length + results.zones.length + results.pois.length;
    
    console.log(`✅ Ricerca completata: ${totalResults} risultati trovati`);
    
    res.json({
      success: true,
      query: q,
      results: results,
      totalResults: totalResults
    });
    
  } catch (err) {
    console.error("❌ Errore GET /mobile/search:", err);
    res.status(500).json({ 
      success: false,
      error: "Errore durante la ricerca" 
    });
  }
});

module.exports = router;
