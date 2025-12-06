// ===============================
// 🗺️ OpenTripMap Service
// Servizio per verifica POI tramite OpenTripMap API
// ===============================

const axios = require('axios');
const Logger = require('../utils/logger');

class OpenTripMapService {
  constructor() {
    this.apiKey = process.env.OPENTRIPMAP_API_KEY || '';
    this.baseUrl = 'https://api.opentripmap.io/0.1/en/places';
    this.timeout = 10000;
  }

  /**
   * Verifica se il servizio è disponibile
   */
  isAvailable() {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  /**
   * Cerca POI in un'area geografica
   * @param {number} lat - Latitudine centro
   * @param {number} lng - Longitudine centro
   * @param {number} radius - Raggio in km (default: 5)
   * @param {Array} kinds - Tipi di POI da cercare (opzionale)
   * @returns {Array} - Array di POI trovati
   */
  async searchPOIs(lat, lng, radius = 5, kinds = null) {
    try {
      if (!this.isAvailable()) {
        Logger.debug('OpenTripMap API non disponibile - OPENTRIPMAP_API_KEY mancante');
        return [];
      }

      const params = {
        apikey: this.apiKey,
        lon: lng,
        lat: lat,
        radius: radius * 1000, // Converti km in metri
        limit: 50,
        format: 'json'
      };

      if (kinds && kinds.length > 0) {
        params.kinds = kinds.join(',');
      }

      const response = await axios.get(`${this.baseUrl}/radius`, {
        params: params,
        timeout: this.timeout
      });

      if (response.data && Array.isArray(response.data)) {
        Logger.info(`✅ OpenTripMap trovati ${response.data.length} POI`);
        return this.normalizePOIs(response.data);
      }

      return [];

    } catch (error) {
      Logger.warn('Errore ricerca OpenTripMap:', error.message);
      // Fallback silenzioso - non blocca la pipeline
      return [];
    }
  }

  /**
   * Verifica se un POI esiste in OpenTripMap
   * @param {string} poiName - Nome del POI
   * @param {number} lat - Latitudine
   * @param {number} lng - Longitudine
   * @param {number} radius - Raggio di ricerca in km (default: 1)
   * @returns {Object|null} - POI matchato o null
   */
  async verifyPOI(poiName, lat, lng, radius = 1) {
    try {
      if (!this.isAvailable()) {
        return null;
      }

      // Cerca POI nelle vicinanze
      const nearbyPOIs = await this.searchPOIs(lat, lng, radius);

      if (nearbyPOIs.length === 0) {
        return null;
      }

      // Trova il match migliore per nome
      let bestMatch = null;
      let bestScore = 0;

      for (const poi of nearbyPOIs) {
        const score = this.calculateNameSimilarity(poiName, poi.name);
        if (score > bestScore && score > 0.7) { // Soglia minima 70%
          bestScore = score;
          bestMatch = { ...poi, matchScore: score };
        }
      }

      if (bestMatch) {
        Logger.info(`✅ OpenTripMap verifica POI "${poiName}": match con score ${bestScore.toFixed(2)}`);
      }

      return bestMatch;

    } catch (error) {
      Logger.warn('Errore verifica OpenTripMap:', error.message);
      return null;
    }
  }

  /**
   * Ottiene dettagli completi di un POI tramite xid
   */
  async getPOIDetails(xid) {
    try {
      if (!this.isAvailable()) {
        return null;
      }

      const response = await axios.get(`${this.baseUrl}/xid/${xid}`, {
        params: {
          apikey: this.apiKey
        },
        timeout: this.timeout
      });

      if (response.data) {
        return this.normalizePOIDetails(response.data);
      }

      return null;

    } catch (error) {
      Logger.warn('Errore dettagli OpenTripMap:', error.message);
      return null;
    }
  }

  /**
   * Normalizza POI da OpenTripMap
   */
  normalizePOIs(pois) {
    return pois.map(poi => ({
      name: poi.name || '',
      lat: poi.point?.lat || poi.lat,
      lng: poi.point?.lon || poi.lon,
      category: this.mapOpenTripMapKind(poi.kinds?.[0] || ''),
      description: poi.preview?.text || '',
      xid: poi.xid,
      rank: poi.rate || 0,
      source: 'opentripmap',
      extraInfo: {
        wikipedia: poi.wikipedia || '',
        image: poi.preview?.source || ''
      }
    })).filter(poi => poi.name && poi.lat && poi.lng);
  }

  /**
   * Normalizza dettagli POI
   */
  normalizePOIDetails(poi) {
    return {
      name: poi.name || '',
      lat: poi.point?.lat || poi.lat,
      lng: poi.point?.lon || poi.lon,
      category: this.mapOpenTripMapKind(poi.kinds?.[0] || ''),
      description: poi.wikipedia_extracts?.text || poi.preview?.text || '',
      xid: poi.xid,
      rank: poi.rate || 0,
      source: 'opentripmap',
      extraInfo: {
        wikipedia: poi.wikipedia || '',
        image: poi.preview?.source || poi.image || '',
        url: poi.url || '',
        address: poi.address || {}
      }
    };
  }

  /**
   * Mappa categorie OpenTripMap alle categorie del sistema
   */
  mapOpenTripMapKind(kind) {
    const kindMap = {
      'historic': 'monument',
      'religion': 'church',
      'cultural': 'museum',
      'natural': 'park',
      'architecture': 'monument',
      'beaches': 'beach',
      'marinas': 'harbor',
      'lighthouses': 'lighthouse',
      'viewpoints': 'viewpoint',
      'museums': 'museum',
      'churches': 'church',
      'monuments': 'monument',
      'parks': 'park',
      'villas': 'villa'
    };

    const normalizedKind = kind.toLowerCase().replace(/_/g, '');
    
    for (const [key, value] of Object.entries(kindMap)) {
      if (normalizedKind.includes(key)) {
        return value;
      }
    }

    return 'other';
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
    
    // Levenshtein distance
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
}

module.exports = OpenTripMapService;

