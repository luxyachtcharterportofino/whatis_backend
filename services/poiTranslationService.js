// ===============================
// 🌍 POI Translation Service
// ===============================

const Poi = require('../models/Poi');

/**
 * Supported languages for POI translations
 */
const SUPPORTED_LANGUAGES = {
  'en': { name: 'English', flag: '🇺🇸', code: 'en' },
  'fr': { name: 'Français', flag: '🇫🇷', code: 'fr' },
  'es': { name: 'Español', flag: '🇪🇸', code: 'es' },
  'de': { name: 'Deutsch', flag: '🇩🇪', code: 'de' },
  'ru': { name: 'Русский', flag: '🇷🇺', code: 'ru' }
};

/**
 * AI-powered translation service
 * For now, we'll use a mock service that generates realistic translations
 * In production, this would integrate with OpenAI, Google Translate, or similar
 */
class POITranslationService {
  
  /**
   * Translate POI content to target language
   * @param {Object} poiContent - POI content in Italian
   * @param {string} targetLang - Target language code
   * @returns {Promise<Object>} Translated content
   */
  static async translatePOIContent(poiContent, targetLang) {
    try {
      console.log(`🌍 Translating POI content to ${targetLang}:`, {
        name: poiContent.name?.substring(0, 50) + '...',
        targetLang
      });

      // Mock AI translation - in production, replace with real AI service
      const translatedContent = this.generateMockTranslation(poiContent, targetLang);
      
      console.log(`✅ Translation completed for ${targetLang}`);
      return translatedContent;
      
    } catch (error) {
      console.error(`❌ Translation error for ${targetLang}:`, error);
      throw new Error(`Translation failed for ${targetLang}: ${error.message}`);
    }
  }

  /**
   * Generate mock translations (replace with real AI in production)
   * @param {Object} content - Italian content
   * @param {string} lang - Target language
   * @returns {Object} Translated content
   */
  static generateMockTranslation(content, lang) {
    const translations = {
      'en': {
        name: content.name ? `${content.name} (English)` : '',
        description: content.description ? `English: ${content.description}` : '',
        aiSummary: content.aiSummary ? `English Summary: ${content.aiSummary}` : '',
        curiosities: content.curiosities ? `English Curiosities: ${content.curiosities}` : '',
        historicalFacts: content.historicalFacts ? `English History: ${content.historicalFacts}` : ''
      },
      'fr': {
        name: content.name ? `${content.name} (Français)` : '',
        description: content.description ? `Français: ${content.description}` : '',
        aiSummary: content.aiSummary ? `Résumé Français: ${content.aiSummary}` : '',
        curiosities: content.curiosities ? `Curiosités Françaises: ${content.curiosities}` : '',
        historicalFacts: content.historicalFacts ? `Histoire Française: ${content.historicalFacts}` : ''
      },
      'es': {
        name: content.name ? `${content.name} (Español)` : '',
        description: content.description ? `Español: ${content.description}` : '',
        aiSummary: content.aiSummary ? `Resumen Español: ${content.aiSummary}` : '',
        curiosities: content.curiosities ? `Curiosidades Españolas: ${content.curiosities}` : '',
        historicalFacts: content.historicalFacts ? `Historia Española: ${content.historicalFacts}` : ''
      },
      'de': {
        name: content.name ? `${content.name} (Deutsch)` : '',
        description: content.description ? `Deutsch: ${content.description}` : '',
        aiSummary: content.aiSummary ? `Deutsche Zusammenfassung: ${content.aiSummary}` : '',
        curiosities: content.curiosities ? `Deutsche Kuriositäten: ${content.curiosities}` : '',
        historicalFacts: content.historicalFacts ? `Deutsche Geschichte: ${content.historicalFacts}` : ''
      },
      'ru': {
        name: content.name ? `${content.name} (Русский)` : '',
        description: content.description ? `Русский: ${content.description}` : '',
        aiSummary: content.aiSummary ? `Русское резюме: ${content.aiSummary}` : '',
        curiosities: content.curiosities ? `Русские любопытства: ${content.curiosities}` : '',
        historicalFacts: content.historicalFacts ? `Русская история: ${content.historicalFacts}` : ''
      }
    };

    return translations[lang] || {};
  }

  /**
   * Translate a specific POI to target language
   * @param {string} poiId - POI ID
   * @param {string} targetLang - Target language
   * @returns {Promise<Object>} Updated POI with translations
   */
  static async translatePOI(poiId, targetLang) {
    try {
      const poi = await Poi.findById(poiId);
      if (!poi) {
        throw new Error(`POI not found: ${poiId}`);
      }

      // Get Italian content for translation
      const italianContent = {
        name: poi.name,
        description: poi.description,
        aiSummary: poi.extraInfo?.aiSummary || '',
        curiosities: poi.extraInfo?.curiosities || '',
        historicalFacts: poi.extraInfo?.historicalFacts || ''
      };

      // Translate content
      const translatedContent = await this.translatePOIContent(italianContent, targetLang);

      // Update POI with translations
      if (!poi.multilingual) {
        poi.multilingual = {};
      }
      
      poi.multilingual[targetLang] = translatedContent;
      await poi.save();

      console.log(`✅ POI ${poi.name} translated to ${targetLang}`);
      return poi;

    } catch (error) {
      console.error(`❌ Error translating POI ${poiId} to ${targetLang}:`, error);
      throw error;
    }
  }

  /**
   * Batch translate multiple POIs
   * @param {Array<string>} poiIds - Array of POI IDs
   * @param {string} targetLang - Target language
   * @returns {Promise<Array>} Results array
   */
  static async batchTranslatePOIs(poiIds, targetLang) {
    const results = [];
    
    for (const poiId of poiIds) {
      try {
        const translatedPOI = await this.translatePOI(poiId, targetLang);
        results.push({ poiId, status: 'success', poi: translatedPOI });
      } catch (error) {
        results.push({ poiId, status: 'error', error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get translation status for a POI
   * @param {string} poiId - POI ID
   * @returns {Promise<Object>} Translation status
   */
  static async getTranslationStatus(poiId) {
    try {
      const poi = await Poi.findById(poiId);
      if (!poi) {
        throw new Error(`POI not found: ${poiId}`);
      }

      const status = {
        poiId,
        poiName: poi.name,
        availableLanguages: poi.getAvailableLanguages(),
        translationStatus: {}
      };

      // Check status for each supported language
      Object.keys(SUPPORTED_LANGUAGES).forEach(lang => {
        status.translationStatus[lang] = {
          ...SUPPORTED_LANGUAGES[lang],
          isComplete: poi.isTranslationComplete(lang),
          hasContent: !!poi.multilingual?.[lang]
        };
      });

      return status;

    } catch (error) {
      console.error(`❌ Error getting translation status for POI ${poiId}:`, error);
      throw error;
    }
  }

  /**
   * Get supported languages
   * @returns {Object} Supported languages info
   */
  static getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }
}

module.exports = POITranslationService;
