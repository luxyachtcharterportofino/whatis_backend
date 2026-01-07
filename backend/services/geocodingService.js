// ===============================
// 🌍 Geocoding Service
// Servizio per geocoding con fallback multipli
// ===============================

const axios = require('axios');
const Logger = require('../utils/logger');
const Poi = require('../models/Poi');

class GeocodingService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_API_KEY || '';
    this.nominatimBaseUrl = 'https://nominatim.openstreetmap.org/search';
    this.wikidataSparqlUrl = 'https://query.wikidata.org/sparql';
    
    // Rate limiting per Nominatim (1 req/sec)
    this.lastNominatimCall = 0;
    this.nominatimMinInterval = 1000;
  }

  /**
   * Geocodifica un POI con fallback multipli
   * @param {string} poiName - Nome del POI
   * @param {string} zoneName - Nome della zona
   * @param {string} country - Paese (default: "Italia")
   * @param {Array} zoneCoordinates - Coordinate della zona per validazione
   * @returns {Object|null} - { lat, lng, source } o null se fallisce
   */
  async geocodePOI(poiName, zoneName, country = 'Italia', zoneCoordinates = []) {
    // Pulisci il nome del POI
    const cleanName = this.cleanPOIName(poiName);
    
    if (!cleanName || cleanName.length < 3) {
      Logger.warn(`Nome POI troppo corto per geocoding: ${poiName}`);
      return null;
    }

    // Costruisci query di ricerca
    const searchQuery = `${cleanName}, ${zoneName}, ${country}`;
    
    Logger.info(`🔍 Geocoding POI: "${cleanName}" in zona "${zoneName}"`);

    // Prova fallback in ordine
    let result = null;

    // 1. Nominatim (default)
    try {
      result = await this.geocodeWithNominatim(searchQuery, cleanName, zoneName);
      if (result) {
        Logger.info(`✅ Geocoding Nominatim riuscito: ${result.lat}, ${result.lng}`);
        return result;
      }
    } catch (error) {
      Logger.warn(`Nominatim fallito: ${error.message}`);
    }

    // 2. Google Geocoding (se disponibile)
    if (this.googleApiKey) {
      try {
        result = await this.geocodeWithGoogle(searchQuery);
        if (result) {
          Logger.info(`✅ Geocoding Google riuscito: ${result.lat}, ${result.lng}`);
          return result;
        }
      } catch (error) {
        Logger.warn(`Google Geocoding fallito: ${error.message}`);
      }
    }

    // 3. Wikidata SPARQL
    try {
      result = await this.geocodeWithWikidata(cleanName, zoneName);
      if (result) {
        Logger.info(`✅ Geocoding Wikidata riuscito: ${result.lat}, ${result.lng}`);
        return result;
      }
    } catch (error) {
      Logger.warn(`Wikidata fallito: ${error.message}`);
    }

    // 4. Database interno (cerca POI simili già esistenti)
    try {
      result = await this.geocodeFromDatabase(cleanName, zoneName);
      if (result) {
        Logger.info(`✅ Geocoding da database riuscito: ${result.lat}, ${result.lng}`);
        return result;
      }
    } catch (error) {
      Logger.warn(`Database geocoding fallito: ${error.message}`);
    }

    Logger.warn(`❌ Geocoding fallito per: ${cleanName}`);
    return null;
  }

  /**
   * Geocoding con Nominatim (OpenStreetMap)
   */
  async geocodeWithNominatim(query, poiName, zoneName) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastNominatimCall;
    if (timeSinceLastCall < this.nominatimMinInterval) {
      await new Promise(resolve => setTimeout(resolve, this.nominatimMinInterval - timeSinceLastCall));
    }
    this.lastNominatimCall = Date.now();

    try {
      const response = await axios.get(this.nominatimBaseUrl, {
        params: {
          q: query,
          format: 'json',
          limit: 5,
          addressdetails: 1,
          countrycodes: 'it' // Focus su Italia
        },
        headers: {
          'User-Agent': 'WhatisBackend/1.0' // Nominatim richiede User-Agent
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        // Preferisci risultati con nome simile
        const results = response.data;
        
        // Cerca risultato con nome più simile
        let bestMatch = results[0];
        let bestScore = this.calculateNameSimilarity(poiName, results[0].display_name);
        
        for (const result of results.slice(1)) {
          const score = this.calculateNameSimilarity(poiName, result.display_name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = result;
          }
        }

        return {
          lat: parseFloat(bestMatch.lat),
          lng: parseFloat(bestMatch.lon),
          source: 'nominatim',
          displayName: bestMatch.display_name,
          confidence: bestScore
        };
      }

      return null;
    } catch (error) {
      Logger.error('Errore Nominatim geocoding:', error.message);
      throw error;
    }
  }

  /**
   * Geocoding con Google Geocoding API
   */
  async geocodeWithGoogle(query) {
    if (!this.googleApiKey) {
      return null;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: query,
          key: this.googleApiKey,
          region: 'it' // Focus su Italia
        },
        timeout: 10000
      });

      if (response.data && response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;

        return {
          lat: location.lat,
          lng: location.lng,
          source: 'google',
          displayName: result.formatted_address,
          confidence: 0.9
        };
      }

      return null;
    } catch (error) {
      Logger.error('Errore Google Geocoding:', error.message);
      throw error;
    }
  }

  /**
   * Geocoding con Wikidata SPARQL
   */
  async geocodeWithWikidata(poiName, zoneName) {
    try {
      // Query SPARQL per trovare entità Wikidata con coordinate
      const sparqlQuery = `
        SELECT ?item ?itemLabel ?lat ?lon WHERE {
          ?item rdfs:label "${poiName}"@it .
          ?item wdt:P625 ?coord .
          BIND(xsd:decimal(strbefore(str(?coord), " ")) AS ?lat)
          BIND(xsd:decimal(strafter(str(?coord), " ")) AS ?lon)
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it" }
        }
        LIMIT 1
      `;

      const response = await axios.get(this.wikidataSparqlUrl, {
        params: {
          query: sparqlQuery,
          format: 'json'
        },
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'WhatisBackend/1.0'
        },
        timeout: 10000
      });

      if (response.data && response.data.results && response.data.results.bindings.length > 0) {
        const binding = response.data.results.bindings[0];
        return {
          lat: parseFloat(binding.lat.value),
          lng: parseFloat(binding.lon.value),
          source: 'wikidata',
          displayName: binding.itemLabel?.value || poiName,
          confidence: 0.8
        };
      }

      return null;
    } catch (error) {
      Logger.error('Errore Wikidata geocoding:', error.message);
      throw error;
    }
  }

  /**
   * Cerca coordinate nel database interno (POI simili già esistenti)
   */
  async geocodeFromDatabase(poiName, zoneName) {
    try {
      // Cerca POI con nome simile
      const similarPOIs = await Poi.find({
        name: { $regex: this.escapeRegex(poiName), $options: 'i' }
      }).limit(5);

      if (similarPOIs.length > 0) {
        // Prendi il POI con nome più simile
        let bestMatch = similarPOIs[0];
        let bestScore = this.calculateNameSimilarity(poiName, bestMatch.name);

        for (const poi of similarPOIs.slice(1)) {
          const score = this.calculateNameSimilarity(poiName, poi.name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = poi;
          }
        }

        // Solo se la similarità è abbastanza alta (> 0.7)
        if (bestScore > 0.7) {
          return {
            lat: bestMatch.lat,
            lng: bestMatch.lng,
            source: 'database',
            displayName: bestMatch.name,
            confidence: bestScore
          };
        }
      }

      return null;
    } catch (error) {
      Logger.error('Errore database geocoding:', error.message);
      throw error;
    }
  }

  /**
   * Pulisce il nome del POI rimuovendo caratteri non necessari
   */
  cleanPOIName(name) {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/^Punto di interesse[:\s]*/i, '')
      .replace(/^POI[:\s]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calcola similarità tra due nomi (0-1)
   */
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // Contiene
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    
    // Levenshtein distance (semplificato)
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    
    const distance = this.levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calcola distanza di Levenshtein
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = GeocodingService;

