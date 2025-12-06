// ===============================
// 🔍 Admin Routes - Perplexity Search Module
// Route per ricerca POI tramite Perplexity API
// ===============================

const express = require('express');
const router = express.Router();
const Zone = require('../../models/Zone');
const Poi = require('../../models/Poi');
const PerplexitySearchService = require('../../services/perplexitySearch');
const PerplexityDeduplicator = require('../../services/perplexityDeduplicator');
const Logger = require('../../utils/logger');

// Inizializza servizi
const perplexityService = new PerplexitySearchService();
const deduplicator = new PerplexityDeduplicator();

// ===============================
// 🔍 GET /admin/perplexity/ui
// ⚠️ DEPRECATED - Questa route è stata sostituita dalla nuova pipeline integrata
// Redirect alla pagina zone per usare il nuovo sistema
// ===============================
router.get('/ui', async (req, res) => {
  Logger.warn('⚠️ Tentativo di accesso alla vecchia UI Perplexity - redirect a /admin/zones');
  res.redirect('/admin/zones?message=La vecchia interfaccia Perplexity è stata sostituita. Usa il pulsante "🚀 Genera POI" nella pagina Zone.');
});

// ===============================
// 🔍 GET /admin/perplexity/test
// Route di test per verificare configurazione
// ===============================
router.get('/test', async (req, res) => {
  try {
    const hasApiKey = !!process.env.PERPLEXITY_API_KEY;
    const isEnabled = process.env.PERPLEXITY_ENABLED === 'true';
    
    const testZone = 'Santa Margherita Ligure';
    const testCoordinates = [
      [9.2111, 44.3356],
      [9.2200, 44.3400],
      [9.2000, 44.3300]
    ];

    let testResults = {
      configuration: {
        hasApiKey: hasApiKey,
        isEnabled: isEnabled,
        serviceAvailable: perplexityService.isAvailable(),
        mode: hasApiKey && isEnabled ? 'API' : 'MOCK'
      },
      testZone: testZone,
      results: null,
      duplicates: null,
      suggestions: null
    };

    // Esegui test solo se abilitato
    if (isEnabled) {
      // Cerca zona nel database
      const zone = await Zone.findOne({ name: { $regex: testZone, $options: 'i' } });
      
      if (zone) {
        // Cerca POI terrestri
        const terrestrialPOIs = await perplexityService.searchTerrestrialPOIs(
          testZone,
          zone.coordinates || testCoordinates
        );

        // Trova POI esistenti nella zona
        const existingPOIs = await Poi.find({ zone: zone._id });

        // Deduplicazione
        const dedupResult = deduplicator.findDuplicates(terrestrialPOIs, existingPOIs);

        testResults.results = {
          found: terrestrialPOIs.length,
          new: dedupResult.new.length,
          duplicates: dedupResult.duplicates.length
        };
        testResults.duplicates = dedupResult.duplicates;
        testResults.suggestions = dedupResult.suggestions;
      } else {
        testResults.results = {
          found: 0,
          message: 'Zona di test non trovata nel database'
        };
      }
    }

    res.json({
      success: true,
      message: hasApiKey 
        ? 'Perplexity API configurata correttamente' 
        : 'Modalità MOCK attiva (manca PERPLEXITY_API_KEY)',
      ...testResults
    });

  } catch (error) {
    Logger.error('Errore test Perplexity:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il test',
      error: error.message
    });
  }
});

// ===============================
// 🔍 GET /admin/perplexity/pois/:zoneId
// Cerca POI terrestri per una zona
// ===============================
router.get('/pois/:zoneId', async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { autoSave = 'false' } = req.query; // Query param per salvataggio automatico (default: false)

    // Trova zona
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zona non trovata'
      });
    }

    // Verifica se Perplexity è abilitato
    if (process.env.PERPLEXITY_ENABLED !== 'true') {
      return res.status(503).json({
        success: false,
        message: 'Modulo Perplexity non abilitato',
        enabled: false
      });
    }

    Logger.info(`🔍 Ricerca POI terrestri Perplexity per zona: ${zone.name}`);

    // Cerca POI tramite Perplexity
    const perplexityPOIs = await perplexityService.searchTerrestrialPOIs(
      zone.name,
      zone.coordinates
    );

    // Trova POI esistenti nella zona
    const existingPOIs = await Poi.find({ zone: zoneId });

    // Deduplicazione intelligente
    const dedupResult = deduplicator.findDuplicates(perplexityPOIs, existingPOIs);

    // Preparazione risposta
    const response = {
      success: true,
      zone: {
        id: zone._id,
        name: zone.name
      },
      stats: {
        totalFound: perplexityPOIs.length,
        new: dedupResult.new.length,
        duplicates: dedupResult.duplicates.length,
        suggestions: dedupResult.suggestions.length
      },
      newPOIs: dedupResult.new, // POI nuovi senza duplicati
      duplicates: dedupResult.duplicates, // POI duplicati trovati
      suggestions: dedupResult.suggestions, // Suggerimenti di merge
      mode: perplexityService.isAvailable() ? 'API' : 'MOCK',
      warning: !perplexityService.isAvailable() 
        ? 'Modalità MOCK attiva - PERPLEXITY_API_KEY non configurata' 
        : null
    };

    // Salvataggio automatico SOLO se esplicitamente richiesto
    if (autoSave === 'true' && dedupResult.new.length > 0) {
      Logger.info(`💾 Salvataggio automatico ${dedupResult.new.length} POI nuovi`);
      
      const savedPOIs = [];
      for (const poiData of dedupResult.new) {
        try {
          const poi = new Poi({
            ...poiData,
            zone: zoneId
          });
          await poi.save();
          savedPOIs.push(poi);
        } catch (error) {
          Logger.error(`Errore salvataggio POI ${poiData.name}:`, error);
        }
      }

      response.autoSaved = {
        count: savedPOIs.length,
        pois: savedPOIs.map(p => ({ id: p._id, name: p.name }))
      };
    }

    res.json(response);

  } catch (error) {
    Logger.error('Errore ricerca POI terrestri Perplexity:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante la ricerca POI',
      error: error.message
    });
  }
});

// ===============================
// 🔍 GET /admin/perplexity/wrecks/:zoneId
// Cerca POI marini (relitti) per una zona
// ===============================
router.get('/wrecks/:zoneId', async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { autoSave = 'false' } = req.query;

    // Trova zona
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zona non trovata'
      });
    }

    // Verifica se Perplexity è abilitato
    if (process.env.PERPLEXITY_ENABLED !== 'true') {
      return res.status(503).json({
        success: false,
        message: 'Modulo Perplexity non abilitato',
        enabled: false
      });
    }

    Logger.info(`🌊 Ricerca POI marini Perplexity per zona: ${zone.name}`);

    // Cerca POI marini tramite Perplexity
    const marinePOIs = await perplexityService.searchMarinePOIs(
      zone.name,
      zone.coordinates
    );

    // Trova POI marini esistenti nella zona
    const existingPOIs = await Poi.find({ 
      zone: zoneId,
      category: { $in: ['wreck', 'biological', 'cave', 'beach', 'harbor'] }
    });

    // Deduplicazione intelligente
    const dedupResult = deduplicator.findDuplicates(marinePOIs, existingPOIs);

    // Preparazione risposta
    const response = {
      success: true,
      zone: {
        id: zone._id,
        name: zone.name
      },
      stats: {
        totalFound: marinePOIs.length,
        new: dedupResult.new.length,
        duplicates: dedupResult.duplicates.length,
        suggestions: dedupResult.suggestions.length
      },
      newPOIs: dedupResult.new,
      duplicates: dedupResult.duplicates,
      suggestions: dedupResult.suggestions,
      mode: perplexityService.isAvailable() ? 'API' : 'MOCK',
      warning: !perplexityService.isAvailable() 
        ? 'Modalità MOCK attiva - PERPLEXITY_API_KEY non configurata' 
        : null
    };

    // Salvataggio automatico SOLO se esplicitamente richiesto
    if (autoSave === 'true' && dedupResult.new.length > 0) {
      Logger.info(`💾 Salvataggio automatico ${dedupResult.new.length} POI marini nuovi`);
      
      const savedPOIs = [];
      for (const poiData of dedupResult.new) {
        try {
          const poi = new Poi({
            ...poiData,
            zone: zoneId
          });
          await poi.save();
          savedPOIs.push(poi);
        } catch (error) {
          Logger.error(`Errore salvataggio POI marino ${poiData.name}:`, error);
        }
      }

      response.autoSaved = {
        count: savedPOIs.length,
        pois: savedPOIs.map(p => ({ id: p._id, name: p.name }))
      };
    }

    res.json(response);

  } catch (error) {
    Logger.error('Errore ricerca POI marini Perplexity:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante la ricerca POI marini',
      error: error.message
    });
  }
});

// ===============================
// 🔍 POST /admin/perplexity/merge/:poiId
// Applica merge suggestion manualmente (futuro)
// ===============================
router.post('/merge/:poiId', async (req, res) => {
  try {
    const { poiId } = req.params;
    const { newData } = req.body;

    if (!newData) {
      return res.status(400).json({
        success: false,
        message: 'Dati per merge non forniti'
      });
    }

    // Trova POI esistente
    const existingPOI = await Poi.findById(poiId);
    if (!existingPOI) {
      return res.status(404).json({
        success: false,
        message: 'POI non trovato'
      });
    }

    // ⚠️ IMPORTANTE: Non sovrascrivere, solo aggiornare campi specifici
    // L'utente deve esplicitamente scegliere cosa aggiornare
    if (newData.description && newData.description.length > existingPOI.description.length) {
      existingPOI.description = newData.description;
    }

    if (newData.extraInfo?.aiSummary && !existingPOI.extraInfo?.aiSummary) {
      existingPOI.extraInfo = existingPOI.extraInfo || {};
      existingPOI.extraInfo.aiSummary = newData.extraInfo.aiSummary;
    }

    await existingPOI.save();

    res.json({
      success: true,
      message: 'Merge applicato con successo',
      poi: existingPOI
    });

  } catch (error) {
    Logger.error('Errore merge POI:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il merge',
      error: error.message
    });
  }
});

module.exports = router;

