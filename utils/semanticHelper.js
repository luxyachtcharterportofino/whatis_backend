/**
 * Semantic Helper Utility
 * 
 * Provides text cleaning, deduplication, and semantic filtering
 * for POI extraction and processing.
 * 
 * @module utils/semanticHelper
 */

const Logger = require('./logger');

class SemanticHelper {

  /**
   * Clean and normalize POI name
   * @param {string} name - POI name
   * @returns {string} Cleaned name
   */
  static cleanName(name) {
    if (!name || typeof name !== 'string') return '';
    
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^\d+[\.\)]\s*/, '') // Remove leading numbers
      .replace(/\s*\(.*?\)\s*$/, '') // Remove trailing parentheses
      .substring(0, 200); // Max length
  }

  /**
   * Clean and normalize POI description
   * @param {string} description - POI description
   * @returns {string} Cleaned description
   */
  static cleanDescription(description) {
    if (!description || typeof description !== 'string') return '';
    
    return description
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .substring(0, 1000); // Max length
  }

  /**
   * Check if a POI name is meaningful and not generic
   * @param {string} name - POI name
   * @returns {boolean} True if meaningful
   */
  static isMeaningfulPOIName(name) {
    if (!name || name.length < 3) return false;
    
    const normalized = name.toLowerCase().trim();
    
    // Generic terms to exclude
    const genericTerms = [
      'bare_rock', 'water', 'wood', 'grass', 'forest', 'farm', 'road',
      'sea', 'panorama', 'italy', 'beautiful view', 'nice place',
      'casa', 'edificio', 'palazzo generico', 'monumento',
      'italia', 'paese', 'città'
    ];
    
    // Check for generic terms
    for (const term of genericTerms) {
      if (normalized.includes(term)) return false;
    }
    
    // Reject purely numeric names
    if (/^\d+$/.test(normalized)) return false;
    
    // Must contain at least one letter
    if (!/[a-zàèéìòù]/.test(normalized)) return false;
    
    return true;
  }

  /**
   * Check if a POI is tourist-relevant
   * @param {Object} poi - POI object
   * @returns {boolean} True if tourist-relevant
   */
  static isTouristRelevant(poi) {
    if (!poi || !poi.semanticCategory) return false;
    
    const category = poi.semanticCategory.toLowerCase();
    
    // Tourist-relevant categories
    const relevantCategories = [
      'monument', 'church', 'castle', 'museum', 'archaeological site',
      'villa', 'fort', 'beach', 'park', 'port', 'harbor',
      'wreck', 'underwater', 'cave', 'viewpoint', 'heritage',
      'cathedral', 'abbey', 'monastery', 'palace', 'tower',
      'statue', 'fountain', 'bridge', 'historical building'
    ];
    
    return relevantCategories.some(relevant => category.includes(relevant));
  }

  /**
   * Validate if a POI location is within the bounding box
   * @param {Object} poi - POI object with lat and lng
   * @param {Object} bbox - Bounding box with minLat, minLng, maxLat, maxLng
   * @returns {boolean} True if POI is within bounding box
   */
  static validatePOILocation(poi, bbox) {
    if (!poi || !bbox) return false;
    
    const lat = poi.lat || poi.latitude;
    const lng = poi.lng || poi.longitude;
    
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    
    // Check if coordinates are within bounding box
    const inBounds = 
      lat >= bbox.minLat && 
      lat <= bbox.maxLat &&
      lng >= bbox.minLng && 
      lng <= bbox.maxLng;
    
    return inBounds;
  }

  /**
   * Filter POIs by zone bounding box
   * Removes any POI located outside the current zone's bounding box
   * @param {Array} results - Array of POI objects
   * @param {Object} zone - Zone object with coordinates
   * @returns {Array} Filtered POI array
   */
  static filterPOIsByZone(results, zone) {
    if (!results || !Array.isArray(results)) return [];
    if (!zone || !zone.coordinates || zone.coordinates.length === 0) return results;

    try {
      // Compute min/max of zone coordinates
      const lats = zone.coordinates.map(c => Array.isArray(c) ? c[0] : c.lat);
      const lngs = zone.coordinates.map(c => Array.isArray(c) ? c[1] : c.lng);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Keep only POIs inside the bounding box
      const filtered = results.filter(poi => {
        if (!poi) return false;
        
        const lat = parseFloat(poi.lat || poi.latitude);
        const lng = parseFloat(poi.lng || poi.longitude);
        
        if (isNaN(lat) || isNaN(lng)) return false;
        
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
      });

      Logger.debug(`[FILTER] POI filtered by zone ${zone.name || 'unknown'}: ${filtered.length} kept (from ${results.length} total)`);
      
      return filtered;
      
    } catch (error) {
      Logger.error(`Error filtering POIs by zone: ${error.message}`);
      return results; // Return original results if filtering fails
    }
  }

  /**
   * Deduplicate POIs by name similarity and proximity
   * @param {Array} pois - Array of POIs
   * @param {number} distanceThreshold - Distance threshold in meters (default: 200)
   * @returns {Array} Deduplicated POIs
   */
  static deduplicatePOIs(pois, distanceThreshold = 200) {
    if (!pois || pois.length === 0) return [];
    
    const seen = new Map();
    const deduplicated = [];
    
    for (const poi of pois) {
      const key = SemanticHelper.getPOIKey(poi);
      
      if (!seen.has(key)) {
        seen.set(key, poi);
        deduplicated.push(poi);
      } else {
        // Check if they're too close - keep the one with more details
        const existing = seen.get(key);
        if (SemanticHelper.areClose(poi, existing, distanceThreshold)) {
          // Keep the one with better description
          if (poi.description && poi.description.length > existing.description.length) {
            const index = deduplicated.indexOf(existing);
            deduplicated[index] = poi;
            seen.set(key, poi);
          }
        } else {
          // Different locations - keep both
          deduplicated.push(poi);
        }
      }
    }
    
    Logger.debug(`Deduplicazione: ${pois.length} → ${deduplicated.length} POI`);
    return deduplicated;
  }

  /**
   * Get a unique key for a POI (for deduplication)
   * @param {Object} poi - POI object
   * @returns {string} Unique key
   */
  static getPOIKey(poi) {
    const name = SemanticHelper.cleanName(poi.name).toLowerCase();
    return name;
  }

  /**
   * Calculate distance between two POIs in meters
   * @param {Object} poi1 - First POI
   * @param {Object} poi2 - Second POI
   * @returns {number} Distance in meters
   */
  static calculateDistance(poi1, poi2) {
    if (!poi1 || !poi2) return Infinity;
    
    const lat1 = poi1.lat || poi1.latitude;
    const lng1 = poi1.lng || poi1.longitude;
    const lat2 = poi2.lat || poi2.latitude;
    const lng2 = poi2.lng || poi2.longitude;
    
    if (typeof lat1 !== 'number' || typeof lng1 !== 'number' || 
        typeof lat2 !== 'number' || typeof lng2 !== 'number') {
      return Infinity;
    }
    
    // Haversine formula
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if two POIs are close to each other
   * @param {Object} poi1 - First POI
   * @param {Object} poi2 - Second POI
   * @param {number} threshold - Distance threshold in meters
   * @returns {boolean} True if close
   */
  static areClose(poi1, poi2, threshold = 200) {
    const distance = SemanticHelper.calculateDistance(poi1, poi2);
    return distance <= threshold;
  }

  /**
   * Calculate semantic similarity between two names
   * @param {string} name1 - First name
   * @param {string} name2 - Second name
   * @returns {number} Similarity score (0-1)
   */
  static calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 1;
    
    // Substring match
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // Use Levenshtein distance
    const distance = SemanticHelper.levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Distance
   */
  static levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }
    
    return dp[m][n];
  }

  /**
   * Filter POIs by quality criteria
   * @param {Array} pois - Array of POIs
   * @returns {Array} Filtered POIs
   */
  static filterQualityPOIs(pois) {
    return pois.filter(poi => {
      // Must have valid name
      if (!SemanticHelper.isMeaningfulPOIName(poi.name)) {
        Logger.debug(`POI filtrato (nome non valido): ${poi.name}`);
        return false;
      }
      
      // Must have coordinates
      if (!poi.lat || !poi.lng) {
        Logger.debug(`POI filtrato (mancano coordinate): ${poi.name}`);
        return false;
      }
      
      // Must be tourist-relevant (if category specified)
      if (poi.semanticCategory && !SemanticHelper.isTouristRelevant(poi)) {
        // Allow if no category but has good description
        if (!poi.description || poi.description.length < 50) {
          Logger.debug(`POI filtrato (non rilevante): ${poi.name}`);
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Normalize POI data structure
   * @param {Object} poi - Raw POI data
   * @returns {Object} Normalized POI
   */
  static normalizePOI(poi) {
    return {
      name: SemanticHelper.cleanName(poi.name),
      description: SemanticHelper.cleanDescription(poi.description || ''),
      lat: parseFloat(poi.lat || poi.latitude),
      lng: parseFloat(poi.lng || poi.longitude),
      image: poi.image || poi.imageUrl || '',
      zone: poi.zone || '',
      municipality: poi.municipality || '',
      semanticCategory: poi.semanticCategory || poi.category || 'other',
      source: poi.source || 'unknown',
      status: 'temporary'
    };
  }
}

module.exports = SemanticHelper;
