// ===============================
// 🚀 POI Generation Pipeline
// Pipeline completa per generazione POI automatica
// ===============================

const GPTPoiGenerator = require('./gptPoiGenerator');
const GeocodingService = require('./geocodingService');
const GeographicValidator = require('./geographicValidator');
const OpenTripMapService = require('./openTripMapService');
const WikidataPoiService = require('./wikidataPoiService');
const POIDeduplicator = require('./poiDeduplicator');
const POIScoringService = require('./poiScoringService');
const Logger = require('../utils/logger');

class POIGenerationPipeline {
  constructor() {
    this.gptService = new GPTPoiGenerator();
    this.geocodingService = new GeocodingService();
    this.validator = new GeographicValidator();
    this.openTripMapService = new OpenTripMapService();
    this.wikidataService = new WikidataPoiService();
    this.deduplicator = new POIDeduplicator();
    this.scoringService = new POIScoringService();
  }

  /**
   * Genera POI per una zona
   * @param {Object} zone - Zona { _id, name, coordinates, includeMarineExtension }
   * @param {string} type - 'terrestrial' | 'marine' | 'both'
   * @param {string} customPrompt - Prompt personalizzato (opzionale)
   * @param {string} municipality - Comune selezionato
   * @param {Function} progressCallback - Callback per aggiornamenti progresso
   * @returns {Array} - Array di POI generati e validati
   */
  async generatePOIsForZone(zone, type = 'both', customPrompt = null, municipality = null, progressCallback = null) {
    try {
      Logger.info(`🚀 Avvio generazione POI per zona: ${zone.name} (tipo: ${type})`);

      const results = {
        generated: [],
        deduplicated: [],
        verified: [],
        geocoded: [],
        validated: [],
        scored: [],
        errors: []
      };

      // STEP 1: Genera POI con GPT
      await this.updateProgress(progressCallback, 5, 'Generazione POI con GPT...');
      const gptPOIs = await this.generateWithGPT(zone, type, customPrompt, municipality);
      results.generated = gptPOIs;
      
      Logger.info(`✅ Generati ${gptPOIs.length} POI da GPT`);

      if (gptPOIs.length === 0) {
        Logger.warn('Nessun POI generato da GPT');
        return results;
      }

      // STEP 2: Deduplicazione preliminare
      await this.updateProgress(progressCallback, 10, 'Deduplicazione preliminare...');
      const deduplicatedPOIs = this.deduplicator.deduplicate(gptPOIs);
      results.deduplicated = deduplicatedPOIs;
      Logger.info(`✅ Deduplicati: ${gptPOIs.length} → ${deduplicatedPOIs.length} POI`);

      // STEP 3: Estrai nomi e pulisci
      await this.updateProgress(progressCallback, 15, 'Pulizia nomi POI...');
      const cleanedPOIs = this.cleanPOINames(deduplicatedPOIs);
      Logger.info(`✅ Puliti ${cleanedPOIs.length} nomi POI`);

      // STEP 4: Geocoding per ogni POI (PRIMA della verifica, serve avere coordinate)
      await this.updateProgress(progressCallback, 30, 'Geocoding POI...');
      const geocodedPOIs = await this.geocodePOIs(cleanedPOIs, zone, progressCallback);
      results.geocoded = geocodedPOIs;
      
      Logger.info(`✅ Geocodificati ${geocodedPOIs.length} POI`);

      // STEP 5: Verifica con OpenTripMap e Wikidata (DOPO geocoding, abbiamo coordinate)
      await this.updateProgress(progressCallback, 60, 'Verifica POI con fonti reali...');
      const verifiedPOIs = await this.verifyPOIs(geocodedPOIs, zone, municipality);
      results.verified = verifiedPOIs;
      Logger.info(`✅ Verificati ${verifiedPOIs.length} POI`);

      // STEP 6: Validazione geografica
      await this.updateProgress(progressCallback, 75, 'Validazione geografica...');
      const validatedPOIs = await this.validatePOIs(verifiedPOIs, zone);
      results.validated = validatedPOIs;
      
      Logger.info(`✅ Validati ${validatedPOIs.length} POI`);

      // STEP 7: Scoring multi-fonte
      await this.updateProgress(progressCallback, 90, 'Calcolo score POI...');
      const scoredPOIs = await this.scorePOIs(validatedPOIs, zone, municipality);
      results.scored = scoredPOIs;
      
      Logger.info(`✅ Scored ${scoredPOIs.length} POI`);

      await this.updateProgress(progressCallback, 100, 'Completato!');

      // Restituisci i POI finali con scoring (sostituisce validated)
      results.validated = scoredPOIs;
      return results;

    } catch (error) {
      Logger.error('Errore nella pipeline di generazione POI:', error);
      throw error;
    }
  }

  /**
   * Genera POI con GPT
   */
  async generateWithGPT(zone, type, customPrompt, municipality) {
    try {
      if (!municipality) {
        Logger.error('Comune è obbligatorio per la generazione GPT');
        throw new Error('Comune è obbligatorio');
      }

      const allPOIs = [];

      // Genera POI terrestri
      if (type === 'terrestrial' || type === 'both') {
        const terrestrialPOIs = await this.gptService.generateTerrestrialPOIs(
          zone.name,
          municipality,
          zone.coordinates,
          customPrompt
        );
        allPOIs.push(...terrestrialPOIs);
        Logger.info(`✅ Generati ${terrestrialPOIs.length} POI terrestri da GPT`);
      }

      // Genera POI marini (solo se zona include estensione marina)
      if ((type === 'marine' || type === 'both') && zone.includeMarineExtension) {
        const marinePOIs = await this.gptService.generateMarinePOIs(
          zone.name,
          municipality,
          zone.coordinates,
          customPrompt
        );
        allPOIs.push(...marinePOIs);
        Logger.info(`✅ Generati ${marinePOIs.length} POI marini da GPT`);
      }

      return allPOIs;

    } catch (error) {
      Logger.error('Errore generazione GPT:', error);
      // Non bloccare la pipeline, restituisci array vuoto
      return [];
    }
  }

  /**
   * Pulisce i nomi dei POI rimuovendo duplicati e generici
   */
  cleanPOINames(pois) {
    const cleaned = [];
    const seenNames = new Set();

    for (const poi of pois) {
      const cleanName = this.geocodingService.cleanPOIName(poi.name);
      
      // Salta nomi generici
      if (this.isGenericName(cleanName)) {
        Logger.warn(`POI saltato (nome generico): ${cleanName}`);
        continue;
      }

      // Salta duplicati
      const nameKey = cleanName.toLowerCase().trim();
      if (seenNames.has(nameKey)) {
        Logger.warn(`POI saltato (duplicato): ${cleanName}`);
        continue;
      }

      seenNames.add(nameKey);
      cleaned.push({
        ...poi,
        name: cleanName,
        originalName: poi.name
      });
    }

    return cleaned;
  }

  /**
   * Verifica se un nome è generico
   */
  isGenericName(name) {
    const genericPatterns = [
      /^punto di interesse/i,
      /^poi/i,
      /^luogo/i,
      /^sito/i,
      /^attrazione/i,
      /^posto/i
    ];

    return genericPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Geocodifica tutti i POI
   */
  async geocodePOIs(pois, zone, progressCallback) {
    const geocoded = [];
    const total = pois.length;

    for (let i = 0; i < pois.length; i++) {
      const poi = pois[i];
      
      await this.updateProgress(
        progressCallback,
        30 + (i / total) * 50,
        `Geocoding ${i + 1}/${total}: ${poi.name}`
      );

      try {
        // Se il POI ha già coordinate da GPT, verifichiamo prima se sono valide
        if (poi.lat && poi.lng && this.validator.isValidCoordinate(poi.lat, poi.lng)) {
          // Usa le coordinate esistenti
          geocoded.push({
            ...poi,
            geocodingSource: 'gpt',
            geocodingConfidence: 0.7
          });
          Logger.info(`✅ POI "${poi.name}" usa coordinate da GPT`);
        } else {
          // Geocodifica
          const geocodeResult = await this.geocodingService.geocodePOI(
            poi.name,
            zone.name,
            'Italia',
            zone.coordinates
          );

          if (geocodeResult) {
            geocoded.push({
              ...poi,
              lat: geocodeResult.lat,
              lng: geocodeResult.lng,
              geocodingSource: geocodeResult.source,
              geocodingConfidence: geocodeResult.confidence || 0.5,
              geocodingDisplayName: geocodeResult.displayName
            });
            Logger.info(`✅ Geocodificato: ${poi.name} → ${geocodeResult.lat}, ${geocodeResult.lng}`);
          } else {
            Logger.warn(`❌ Geocoding fallito per: ${poi.name}`);
            // Mantieni il POI ma segnala che non ha coordinate valide
            geocoded.push({
              ...poi,
              lat: null,
              lng: null,
              geocodingSource: 'failed',
              geocodingError: 'Geocoding fallito'
            });
          }
        }

        // Rate limiting per non sovraccaricare i servizi
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        Logger.error(`Errore geocoding POI ${poi.name}:`, error);
        geocoded.push({
          ...poi,
          lat: null,
          lng: null,
          geocodingSource: 'error',
          geocodingError: error.message
        });
      }
    }

    return geocoded;
  }

  /**
   * Valida tutti i POI geocodificati
   */
  async validatePOIs(pois, zone) {
    const validated = [];

    for (const poi of pois) {
      // Se non ha coordinate, salta
      if (!poi.lat || !poi.lng) {
        validated.push({
          ...poi,
          validation: {
            valid: false,
            reason: 'Coordinate mancanti',
            distance: null
          }
        });
        continue;
      }

      const validation = this.validator.validatePOI(poi, zone);
      
      validated.push({
        ...poi,
        validation: validation
      });

      if (validation.valid) {
        Logger.info(`✅ POI validato: ${poi.name} (${validation.distance?.toFixed(2) || 'N/A'} km dalla zona)`);
      } else {
        Logger.warn(`❌ POI non valido: ${poi.name} - ${validation.reason}`);
      }
    }

    return validated;
  }

  /**
   * Verifica POI con OpenTripMap e Wikidata
   */
  async verifyPOIs(pois, zone, municipality) {
    const verifiedPOIs = [];
    const zoneCenter = this.scoringService.calculateZoneCenter(zone.coordinates);

    for (const poi of pois) {
      const verifiedPOI = { ...poi, verification: {} };

      // Verifica OpenTripMap
      if (poi.lat && poi.lng) {
        try {
          const otmMatch = await this.openTripMapService.verifyPOI(poi.name, poi.lat, poi.lng);
          if (otmMatch) {
            verifiedPOI.verification.openTripMap = otmMatch;
            Logger.info(`✅ OpenTripMap verifica: ${poi.name}`);
          }
        } catch (error) {
          Logger.debug(`OpenTripMap verifica fallita per ${poi.name}:`, error.message);
        }
      }

      // Verifica Wikidata
      if (poi.lat && poi.lng) {
        try {
          const wikidataMatch = await this.wikidataService.verifyPOI(poi.name, poi.lat, poi.lng);
          if (wikidataMatch) {
            verifiedPOI.verification.wikidata = wikidataMatch;
            Logger.info(`✅ Wikidata verifica: ${poi.name}`);
          }
        } catch (error) {
          Logger.debug(`Wikidata verifica fallita per ${poi.name}:`, error.message);
        }
      }

      verifiedPOIs.push(verifiedPOI);
    }

    return verifiedPOIs;
  }

  /**
   * Calcola score per tutti i POI
   */
  async scorePOIs(pois, zone, municipality) {
    const zoneCenter = this.scoringService.calculateZoneCenter(zone.coordinates);
    
    return pois.map(poi => {
      const score = this.scoringService.calculateScore(poi, {
        municipality: municipality,
        zoneCenter: zoneCenter
      });

      return {
        ...poi,
        score: score.total,
        scoreBreakdown: score.breakdown,
        verified: score.verified
      };
    });
  }

  /**
   * Aggiorna progresso
   */
  async updateProgress(callback, percentage, message) {
    if (callback && typeof callback === 'function') {
      try {
        await callback(percentage, message);
      } catch (error) {
        Logger.error('Errore callback progresso:', error);
      }
    }
  }
}

module.exports = POIGenerationPipeline;

