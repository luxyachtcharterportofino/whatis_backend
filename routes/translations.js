// ===============================
// 🌍 Translation Routes
// ===============================

const express = require('express');
const router = express.Router();
const Poi = require('../models/Poi');
const POITranslationService = require('../services/poiTranslationService');

// ===============================
// 🌍 TRANSLATION MANAGEMENT
// ===============================

/**
 * GET /translations/languages
 * Get supported languages
 */
router.get('/languages', (req, res) => {
  try {
    const languages = POITranslationService.getSupportedLanguages();
    res.json({
      success: true,
      languages
    });
  } catch (error) {
    console.error('❌ Error getting languages:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle lingue supportate'
    });
  }
});

/**
 * GET /translations/status/:poiId
 * Get translation status for a specific POI
 */
router.get('/status/:poiId', async (req, res) => {
  try {
    const { poiId } = req.params;
    const status = await POITranslationService.getTranslationStatus(poiId);
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('❌ Error getting translation status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore nel recupero dello stato delle traduzioni'
    });
  }
});

/**
 * POST /translations/translate/:poiId/:language
 * Translate a POI to specific language
 */
router.post('/translate/:poiId/:language', async (req, res) => {
  try {
    const { poiId, language } = req.params;
    const supportedLanguages = POITranslationService.getSupportedLanguages();
    
    if (!supportedLanguages[language]) {
      return res.status(400).json({
        success: false,
        error: `Lingua non supportata: ${language}`
      });
    }
    
    const translatedPOI = await POITranslationService.translatePOI(poiId, language);
    
    res.json({
      success: true,
      message: `POI tradotto con successo in ${supportedLanguages[language].name}`,
      poi: translatedPOI
    });
  } catch (error) {
    console.error('❌ Error translating POI:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante la traduzione del POI'
    });
  }
});

/**
 * POST /translations/batch-translate
 * Batch translate multiple POIs
 */
router.post('/batch-translate', async (req, res) => {
  try {
    const { poiIds, language } = req.body;
    
    if (!Array.isArray(poiIds) || poiIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista POI non valida'
      });
    }
    
    const supportedLanguages = POITranslationService.getSupportedLanguages();
    if (!supportedLanguages[language]) {
      return res.status(400).json({
        success: false,
        error: `Lingua non supportata: ${language}`
      });
    }
    
    const results = await POITranslationService.batchTranslatePOIs(poiIds, language);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    res.json({
      success: true,
      message: `Traduzione batch completata: ${successCount} successi, ${errorCount} errori`,
      results,
      summary: {
        total: poiIds.length,
        success: successCount,
        errors: errorCount
      }
    });
  } catch (error) {
    console.error('❌ Error batch translating POIs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante la traduzione batch'
    });
  }
});

/**
 * PUT /translations/:poiId/batch
 * Update multiple translations for a POI at once
 */
router.put('/:poiId/batch', async (req, res) => {
  try {
    const { poiId } = req.params;
    const translations = req.body; // Object with language codes as keys
    
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI non trovato'
      });
    }
    
    // Initialize multilingual object if not exists
    if (!poi.multilingual) {
      poi.multilingual = {};
    }
    
    // Update each language translation
    Object.keys(translations).forEach(language => {
      const translation = translations[language];
      poi.multilingual[language] = {
        name: translation.name || '',
        description: translation.description || '',
        aiSummary: translation.aiSummary || '',
        curiosities: translation.curiosities || '',
        historicalFacts: translation.historicalFacts || ''
      };
    });
    
    await poi.save();
    
    res.json({
      success: true,
      message: `Traduzioni aggiornate per ${Object.keys(translations).length} lingue`,
      poi
    });
  } catch (error) {
    console.error('❌ Error updating batch translations:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante l\'aggiornamento delle traduzioni'
    });
  }
});

/**
 * PUT /translations/:poiId/:language
 * Update translation for a specific POI and language
 */
router.put('/:poiId/:language', async (req, res) => {
  try {
    const { poiId, language } = req.params;
    const { name, description, aiSummary, curiosities, historicalFacts } = req.body;
    
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI non trovato'
      });
    }
    
    // Initialize multilingual object if not exists
    if (!poi.multilingual) {
      poi.multilingual = {};
    }
    
    // Update translation
    poi.multilingual[language] = {
      name: name || poi.multilingual[language]?.name || '',
      description: description || poi.multilingual[language]?.description || '',
      aiSummary: aiSummary || poi.multilingual[language]?.aiSummary || '',
      curiosities: curiosities || poi.multilingual[language]?.curiosities || '',
      historicalFacts: historicalFacts || poi.multilingual[language]?.historicalFacts || ''
    };
    
    await poi.save();
    
    res.json({
      success: true,
      message: `Traduzione aggiornata per ${language}`,
      poi
    });
  } catch (error) {
    console.error('❌ Error updating translation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante l\'aggiornamento della traduzione'
    });
  }
});

/**
 * DELETE /translations/:poiId/:language
 * Delete translation for a specific POI and language
 */
router.delete('/:poiId/:language', async (req, res) => {
  try {
    const { poiId, language } = req.params;
    
    const poi = await Poi.findById(poiId);
    if (!poi) {
      return res.status(404).json({
        success: false,
        error: 'POI non trovato'
      });
    }
    
    // Remove translation
    if (poi.multilingual && poi.multilingual[language]) {
      delete poi.multilingual[language];
      await poi.save();
    }
    
    res.json({
      success: true,
      message: `Traduzione eliminata per ${language}`
    });
  } catch (error) {
    console.error('❌ Error deleting translation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante l\'eliminazione della traduzione'
    });
  }
});

// ===============================
// 🌍 MULTILINGUAL POI API
// ===============================

/**
 * GET /pois/multilingual/:language
 * Get POIs in specific language
 */
router.get('/pois/multilingual/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const { zone } = req.query;
    
    let filter = {};
    if (zone) {
      filter.zone = zone;
    }
    
    const pois = await Poi.find(filter).populate('zone', 'name');
    
    // Transform POIs to include localized content
    const localizedPOIs = pois.map(poi => {
      const localizedContent = poi.getLocalizedContent(language);
      return {
        _id: poi._id,
        ...localizedContent,
        category: poi.category,
        source: poi.source,
        lat: poi.lat,
        lng: poi.lng,
        zone: poi.zone,
        customIcon: poi.customIcon,
        arIcon: poi.getEffectiveIcon(),
        arPriority: poi.arPriority,
        arVisible: poi.arVisible,
        availableLanguages: poi.getAvailableLanguages(),
        originalLanguage: 'it' // Italian is the base language
      };
    });
    
    res.json({
      success: true,
      language,
      pois: localizedPOIs,
      count: localizedPOIs.length
    });
  } catch (error) {
    console.error('❌ Error getting multilingual POIs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore nel recupero dei POI multilingua'
    });
  }
});

module.exports = router;
