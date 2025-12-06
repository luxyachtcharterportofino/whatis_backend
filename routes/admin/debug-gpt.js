// ===============================
// 🔍 Debug GPT POI Generation
// Route per test e debug generazione POI GPT
// ===============================

const express = require('express');
const router = express.Router();
const GPTPoiGenerator = require('../../services/gptPoiGenerator');
const Logger = require('../../utils/logger');

// GET /admin/debug-gpt/test
// Test diretto API GPT
router.get('/test', async (req, res) => {
  try {
    const { municipality = 'Santa Margherita Ligure', zoneName = 'Portofino', type = 'terrestrial' } = req.query;

    const gptService = new GPTPoiGenerator();

    // Verifica disponibilità
    const isAvailable = gptService.isAvailable();
    
    if (!isAvailable) {
      return res.json({
        success: false,
        message: 'OpenAI API non disponibile',
        error: 'OPENAI_API_KEY mancante o vuota',
        check: {
          envVar: 'OPENAI_API_KEY',
          present: !!process.env.OPENAI_API_KEY,
          length: process.env.OPENAI_API_KEY?.length || 0
        }
      });
    }

    // Coordinate di test
    const testCoordinates = [
      [9.2111, 44.3356],
      [9.2200, 44.3400],
      [9.2000, 44.3300]
    ];

    // Genera prompt
    const prompt = type === 'marine' 
      ? gptService.generateMarinePrompt(zoneName, municipality, testCoordinates)
      : gptService.generateTerrestrialPrompt(zoneName, municipality, testCoordinates);

    // Test chiamata API
    let apiResponse = null;
    let apiError = null;
    
    try {
      apiResponse = await gptService.callOpenAIAPI(prompt);
    } catch (error) {
      apiError = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }

    res.json({
      success: true,
      configuration: {
        apiKeyPresent: !!process.env.OPENAI_API_KEY,
        apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
        model: gptService.model,
        available: isAvailable
      },
      test: {
        municipality,
        zoneName,
        type,
        coordinates: testCoordinates
      },
      prompt: {
        full: prompt,
        length: prompt.length,
        preview: prompt.substring(0, 300) + '...'
      },
      apiResponse: apiResponse ? {
        received: true,
        length: apiResponse.length,
        preview: apiResponse.substring(0, 500) + '...',
        full: apiResponse
      } : null,
      apiError: apiError,
      parsed: apiResponse ? (() => {
        try {
          const pois = gptService.parseAndValidateResponse(apiResponse);
          return {
            success: true,
            count: pois.length,
            pois: pois.slice(0, 3) // Primi 3 per preview
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      })() : null
    });

  } catch (error) {
    Logger.error('Errore test GPT:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.stack
    });
  }
});

// GET /admin/debug-gpt/prompt
// Mostra prompt generato senza chiamare API
router.get('/prompt', async (req, res) => {
  try {
    const { municipality = 'Santa Margherita Ligure', zoneName = 'Portofino', type = 'terrestrial' } = req.query;

    const gptService = new GPTPoiGenerator();
    const testCoordinates = [
      [9.2111, 44.3356],
      [9.2200, 44.3400],
      [9.2000, 44.3300]
    ];

    const prompt = type === 'marine' 
      ? gptService.generateMarinePrompt(zoneName, municipality, testCoordinates)
      : gptService.generateTerrestrialPrompt(zoneName, municipality, testCoordinates);

    res.json({
      success: true,
      prompt: prompt,
      metadata: {
        municipality,
        zoneName,
        type,
        length: prompt.length,
        coordinates: testCoordinates
      }
    });

  } catch (error) {
    Logger.error('Errore generazione prompt:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

