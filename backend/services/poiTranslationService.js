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
   * Translate POI content to target language using OpenAI
   * @param {Object} poiContent - POI content in Italian
   * @param {string} targetLang - Target language code
   * @returns {Promise<Object>} Translated content
   */
  static async translatePOIContent(poiContent, targetLang, sourceLang = null) {
    try {
      console.log(`🌍 Translating POI content to ${targetLang}:`, {
        name: poiContent.name?.substring(0, 50) + '...',
        targetLang
      });
      // Only DeepL (no Google fallback)
      if (!process.env.DEEPL_API_KEY) {
        throw new Error('DEEPL_API_KEY non configurata');
      }
      console.log('🌐 Using DeepL API Free');
      const deepl = await this.translateWithDeepL(poiContent, targetLang, sourceLang);
      if (!deepl) throw new Error('Errore DeepL');
      return deepl;
      
    } catch (error) {
      console.error(`❌ Translation error for ${targetLang}:`, error);
      // No fallback provider: return empty result
      return { name: '', description: '' };
    }
  }

  /**
   * Translate using DeepL API Free if DEEPL_API_KEY is set
   */
  static async translateWithDeepL(content, targetLang, sourceLang = null) {
    try {
      const apiKey = process.env.DEEPL_API_KEY;
      if (!apiKey) return null;

      const deeplLangMap = {
        'en': 'EN',
        'fr': 'FR',
        'es': 'ES',
        'de': 'DE',
        'ru': 'RU',
        'it': 'IT'
      };
      const target = deeplLangMap[targetLang] || 'EN';

      const result = { 
        name: content.name || '', 
        description: content.description || ''
      };

      // Helper call to DeepL API - translates a single text
      const callDeepl = async (text) => {
        if (!text || !text.trim()) return '';
        const params = new URLSearchParams();
        params.append('text', text);
        params.append('target_lang', target);
        // Source language optional; set if known
        if (sourceLang && deeplLangMap[sourceLang]) {
          params.append('source_lang', deeplLangMap[sourceLang]);
        }
        const resp = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });
        if (!resp.ok) {
          const textBody = await resp.text();
          throw new Error(`DeepL HTTP ${resp.status}: ${textBody}`);
        }
        const data = await resp.json();
        const translations = data && data.translations && data.translations[0];
        return translations ? translations.text : '';
      };

      // Translate only name and description (2 API calls per POI per target language)
      // This minimizes DeepL API usage by translating only essential fields
      if (content.name) {
        try { result.name = await callDeepl(content.name); } catch (e) { console.error('DeepL name:', e.message); }
      }
      if (content.description) {
        try { result.description = await callDeepl(content.description); } catch (e) { console.error('DeepL description:', e.message); }
      }
      return result;
    } catch (error) {
      console.error('DeepL error:', error.message);
      return null; // fall back to other providers
    }
  }

  /**
   * Translate using OpenAI API
   */
  static async translateWithOpenAI(content, targetLang) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const languageNames = {
        'en': 'English',
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'ru': 'Russian'
      };

      const targetLanguage = languageNames[targetLang] || 'English';

      const result = {
        name: content.name || '',
        description: content.description || ''
      };

      // Translate name
      if (content.name) {
        try {
          const nameResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: `Translate the following Italian place name to ${targetLanguage}. Return ONLY the translated name, nothing else: "${content.name}"`
            }],
            max_tokens: 50
          });
          result.name = nameResponse.choices[0].message.content.trim();
        } catch (error) {
          console.error('Error translating name:', error);
          // Return empty string on error, don't fallback to Italian
          result.name = '';
        }
      }

      // Translate description
      if (content.description) {
        try {
          const descResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
              role: "user",
              content: `Translate the following Italian text to ${targetLanguage}. This is a tourist description of a point of interest. Return ONLY the translated text, nothing else:\n\n"${content.description}"`
            }],
            max_tokens: 500
          });
          result.description = descResponse.choices[0].message.content.trim();
        } catch (error) {
          console.error('Error translating description:', error);
          // Return empty string on error, don't fallback to Italian
          result.description = '';
        }
      }

      return result;
    } catch (error) {
      console.error('OpenAI error:', error.message);
      // Fallback to Google Translate if OpenAI fails
      return await this.translateWithGoogleTranslate(content, targetLang);
    }
  }

  /**
   * Translate using Google Translate (fallback)
   */
  static async translateWithGoogleTranslate(content, targetLang) {
    try {
      const { translate } = require('@vitalets/google-translate-api');
      
      const languageCodes = {
        'en': 'en',
        'fr': 'fr',
        'es': 'es',
        'de': 'de',
        'ru': 'ru',
        'it': 'it'
      };

      const targetCode = languageCodes[targetLang] || 'en';
      const result = {
        name: content.name || '',
        description: content.description || ''
      };

      // Add delay to avoid rate limiting (2 seconds between requests)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Translate name
      if (content.name) {
        try {
          const nameResult = await translate(content.name, { to: targetCode });
          result.name = nameResult.text;
        } catch (error) {
          console.error('Error translating name with Google:', error);
          // Return empty string on error, don't fallback to Italian
          result.name = '';
        }
      }

      // Add another delay before description translation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Translate description
      if (content.description) {
        try {
          const descResult = await translate(content.description, { to: targetCode });
          result.description = descResult.text;
        } catch (error) {
          console.error('Error translating description with Google:', error);
          // Return empty string on error, don't fallback to Italian
          result.description = '';
        }
      }

      return result;
    } catch (error) {
      console.error('Google Translate error:', error);
      // Return empty translations instead of mock
      return {
        name: '',
        description: ''
      };
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
        description: content.description ? `English: ${content.description}` : ''
      },
      'fr': {
        name: content.name ? `${content.name} (Français)` : '',
        description: content.description ? `Français: ${content.description}` : ''
      },
      'es': {
        name: content.name ? `${content.name} (Español)` : '',
        description: content.description ? `Español: ${content.description}` : ''
      },
      'de': {
        name: content.name ? `${content.name} (Deutsch)` : '',
        description: content.description ? `Deutsch: ${content.description}` : ''
      },
      'ru': {
        name: content.name ? `${content.name} (Русский)` : '',
        description: content.description ? `Русский: ${content.description}` : ''
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

      // Skip if already translated and appears complete
      if (poi.multilingual && poi.multilingual[targetLang] && poi.isTranslationComplete?.(targetLang)) {
        console.log(`ℹ️ Skipping translation for ${poi.name} in ${targetLang} (already present)`);
        return poi;
      }

      // Detect source language and pick source content accordingly
      const { sourceLang, sourceContent } = this.detectSourceLanguageAndContent(poi);
      if (sourceLang === targetLang) {
        console.log(`ℹ️ Source equals target (${targetLang}) for ${poi.name}, skipping`);
        return poi;
      }

      // Translate content
      const translatedContent = await this.translatePOIContent(sourceContent, targetLang, sourceLang);

      // Update POI with translations
      if (!poi.multilingual) {
        poi.multilingual = {};
      }
      
      poi.multilingual[targetLang] = translatedContent;
      
      // Mark as modified to ensure save
      poi.markModified('multilingual');
      await poi.save();

      // Verify that translation was saved correctly (reload from DB)
      const savedPOI = await Poi.findById(poiId);
      const savedTranslation = savedPOI.multilingual?.[targetLang];
      
      console.log(`✅ POI ${poi.name} translated to ${targetLang}`, {
        hasName: !!(savedTranslation?.name && savedTranslation.name.trim()),
        hasDescription: !!(savedTranslation?.description && savedTranslation.description.trim()),
        isComplete: savedPOI.isTranslationComplete(targetLang)
      });

      return savedPOI;

    } catch (error) {
      console.error(`❌ Error translating POI ${poiId} to ${targetLang}:`, error);
      throw error;
    }
  }

  /**
   * Determine source language and content for a POI.
   * Prefers base Italian if present, otherwise uses first available multilingual with content.
   */
  static detectSourceLanguageAndContent(poi) {
    // 1) If base fields (Italian) have content, assume 'it'
    const baseHasContent = (poi.description && poi.description.trim()) || (poi.name && poi.name.trim());
    if (baseHasContent) {
      return {
        sourceLang: 'it',
        sourceContent: {
          name: poi.name || '',
          description: poi.description || ''
        }
      };
    }

    // 2) Otherwise look into multilingual content (FR, ES, DE, RU, EN)
    const langOrder = ['fr', 'es', 'de', 'ru', 'en'];
    for (const lang of langOrder) {
      const tr = poi.multilingual?.[lang];
      if (tr && ((tr.description && tr.description.trim()) || (tr.name && tr.name.trim()))) {
        return {
          sourceLang: lang,
          sourceContent: {
            name: tr.name || '',
            description: tr.description || ''
          }
        };
      }
    }

    // 3) Fallback to Italian empty fields (ensures call still works)
    return {
      sourceLang: 'it',
      sourceContent: {
        name: poi.name || '',
        description: poi.description || ''
      }
    };
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

  /**
   * Return active translation provider: 'deepl' if DEEPL_API_KEY is set, otherwise 'none'.
   */
  static getActiveProvider() {
    return process.env.DEEPL_API_KEY ? 'deepl' : 'none';
  }

  /**
   * Detect source language for a given POI id using current detection logic.
   * @param {string} poiId
   * @returns {Promise<{sourceLang:string, hasContent:boolean}>}
   */
  static async detectPOISourceLanguage(poiId) {
    const poi = await Poi.findById(poiId);
    if (!poi) throw new Error(`POI not found: ${poiId}`);
    const { sourceLang, sourceContent } = this.detectSourceLanguageAndContent(poi);
    const hasContent = !!((sourceContent?.description && sourceContent.description.trim()) || (sourceContent?.name && sourceContent.name.trim()));
    return { sourceLang, hasContent };
  }
}

module.exports = POITranslationService;
