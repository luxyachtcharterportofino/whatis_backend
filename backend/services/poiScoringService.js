// ===============================
// 📊 POI Scoring Service
// Sistema di scoring multi-fonte per POI
// ===============================

const Logger = require('../utils/logger');

class POIScoringService {
  constructor() {
    // Pesi per ogni fonte di scoring
    this.weights = {
      gptConfidence: 0.3,      // Confidence score da GPT
      openTripMapMatch: 0.25,   // Match con OpenTripMap
      wikidataMatch: 0.25,      // Match con Wikidata
      geocodingPrecision: 0.1,  // Precisione geocoding
      distanceFromCenter: 0.1   // Distanza dal centro comune
    };
  }

  /**
   * Calcola score combinato per un POI
   * @param {Object} poi - POI con metadati
   * @param {Object} context - Contesto { municipality, zoneCenter, geocodingResult }
   * @returns {Object} - Score breakdown e score totale (0-100)
   */
  calculateScore(poi, context = {}) {
    const scores = {
      gptConfidence: 0,
      openTripMapMatch: 0,
      wikidataMatch: 0,
      geocodingPrecision: 0,
      distanceFromCenter: 0
    };

    // 1. GPT Confidence Score (0-100)
    if (poi.confidence !== undefined) {
      scores.gptConfidence = Math.min(100, Math.max(0, poi.confidence * 100));
    } else {
      scores.gptConfidence = 70; // Default se non presente
    }

    // 2. OpenTripMap Match Score
    if (poi.verification?.openTripMap) {
      const match = poi.verification.openTripMap;
      scores.openTripMapMatch = match.matchScore ? match.matchScore * 100 : 80;
    } else {
      scores.openTripMapMatch = 0;
    }

    // 3. Wikidata Match Score
    if (poi.verification?.wikidata) {
      scores.wikidataMatch = 90; // Se verificato da Wikidata, score alto
    } else {
      scores.wikidataMatch = 0;
    }

    // 4. Geocoding Precision Score
    if (poi.geocodingSource && poi.geocodingConfidence) {
      let precisionScore = poi.geocodingConfidence * 100;
      
      // Bonus per fonti più affidabili
      if (poi.geocodingSource === 'nominatim') precisionScore += 5;
      if (poi.geocodingSource === 'google') precisionScore += 10;
      if (poi.geocodingSource === 'wikidata') precisionScore += 15;
      
      scores.geocodingPrecision = Math.min(100, precisionScore);
    } else if (poi.lat && poi.lng) {
      // Se ha coordinate ma non info geocoding, assume coordinate da GPT
      scores.geocodingPrecision = 60;
    } else {
      scores.geocodingPrecision = 0;
    }

    // 5. Distance from Center Score
    if (context.zoneCenter && poi.lat && poi.lng) {
      const distance = this.calculateDistance(
        poi.lat, poi.lng,
        context.zoneCenter.lat, context.zoneCenter.lng
      );
      
      // Score decresce con la distanza
      // 0-2km: 100, 2-5km: 80, 5-10km: 60, >10km: 40
      if (distance <= 2) {
        scores.distanceFromCenter = 100;
      } else if (distance <= 5) {
        scores.distanceFromCenter = 80;
      } else if (distance <= 10) {
        scores.distanceFromCenter = 60;
      } else {
        scores.distanceFromCenter = Math.max(20, 100 - (distance * 2));
      }
    } else {
      scores.distanceFromCenter = 50; // Default se non calcolabile
    }

    // Calcola score totale pesato
    const totalScore = 
      scores.gptConfidence * this.weights.gptConfidence +
      scores.openTripMapMatch * this.weights.openTripMapMatch +
      scores.wikidataMatch * this.weights.wikidataMatch +
      scores.geocodingPrecision * this.weights.geocodingPrecision +
      scores.distanceFromCenter * this.weights.distanceFromCenter;

    return {
      total: Math.round(totalScore),
      breakdown: scores,
      verified: !!(poi.verification?.openTripMap || poi.verification?.wikidata)
    };
  }

  /**
   * Calcola distanza tra due punti (Haversine, in km)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raggio Terra in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converte gradi in radianti
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calcola centro di una zona
   */
  calculateZoneCenter(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    const lats = coordinates.map(coord => {
      if (Array.isArray(coord)) {
        const val1 = coord[0];
        const val2 = coord[1] || coord[0];
        return Math.abs(val1) > 90 ? val2 : val1;
      }
      return coord.lat || 0;
    });

    const lngs = coordinates.map(coord => {
      if (Array.isArray(coord)) {
        const val1 = coord[0];
        const val2 = coord[1] || coord[0];
        return Math.abs(val1) > 90 ? val1 : val2;
      }
      return coord.lng || 0;
    });

    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
    };
  }
}

module.exports = POIScoringService;

