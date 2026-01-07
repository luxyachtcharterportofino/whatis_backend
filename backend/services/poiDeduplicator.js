// ===============================
// 🔄 POI Deduplicator Service
// Servizio avanzato per deduplicazione POI
// ===============================

const Logger = require('../utils/logger');

class POIDeduplicator {
  constructor() {
    // Soglie per deduplicazione
    this.nameSimilarityThreshold = 0.8; // 80% similarità nome
    this.distanceThreshold = 0.15; // 150 metri
    this.categorySimilarityThreshold = 0.7; // 70% similarità categoria
  }

  /**
   * Deduplica array di POI
   * @param {Array} pois - Array di POI da deduplicare
   * @returns {Array} - Array di POI deduplicati
   */
  deduplicate(pois) {
    if (!pois || pois.length === 0) {
      return [];
    }

    const uniquePOIs = [];
    const seen = new Set();

    for (let i = 0; i < pois.length; i++) {
      const poi = pois[i];
      
      // Normalizza nome per confronto
      const normalizedName = this.normalizeName(poi.name);
      const nameKey = normalizedName.toLowerCase().trim();

      // Salta se già visto esattamente
      if (seen.has(nameKey)) {
        Logger.debug(`POI duplicato saltato (nome esatto): ${poi.name}`);
        continue;
      }

      // Controlla duplicati con altri criteri
      let isDuplicate = false;
      for (const existingPOI of uniquePOIs) {
        if (this.isDuplicate(poi, existingPOI)) {
          isDuplicate = true;
          Logger.debug(`POI duplicato saltato (similarità): ${poi.name} ~ ${existingPOI.name}`);
          break;
        }
      }

      if (!isDuplicate) {
        seen.add(nameKey);
        uniquePOIs.push(poi);
      }
    }

    Logger.info(`✅ Deduplicazione: ${pois.length} → ${uniquePOIs.length} POI unici`);
    return uniquePOIs;
  }

  /**
   * Verifica se due POI sono duplicati
   */
  isDuplicate(poi1, poi2) {
    // 1. Similarità nome
    const nameSimilarity = this.calculateNameSimilarity(poi1.name, poi2.name);
    if (nameSimilarity < this.nameSimilarityThreshold) {
      return false; // Nomi troppo diversi
    }

    // 2. Distanza geografica
    if (poi1.lat && poi1.lng && poi2.lat && poi2.lng) {
      const distance = this.calculateDistance(poi1.lat, poi1.lng, poi2.lat, poi2.lng);
      if (distance > this.distanceThreshold) {
        return false; // Troppo distanti
      }
    }

    // 3. Similarità categoria
    const categorySimilarity = this.calculateCategorySimilarity(poi1.category, poi2.category);
    if (categorySimilarity < this.categorySimilarityThreshold) {
      return false; // Categorie troppo diverse
    }

    // Se passa tutti i controlli, è un duplicato
    return true;
  }

  /**
   * Normalizza nome per confronto
   */
  normalizeName(name) {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Rimuovi punteggiatura
      .replace(/\s+/g, ' ')     // Normalizza spazi
      .trim();
  }

  /**
   * Calcola similarità tra due nomi (0-1)
   */
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    const s1 = this.normalizeName(name1);
    const s2 = this.normalizeName(name2);
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // Contiene
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
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

  /**
   * Calcola distanza geografica (Haversine, in km)
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
   * Calcola similarità tra categorie (0-1)
   */
  calculateCategorySimilarity(cat1, cat2) {
    if (!cat1 || !cat2) return 0;
    if (cat1 === cat2) return 1.0;

    // Categorie semanticamente simili
    const categoryGroups = {
      'monument': ['monument', 'church', 'villa', 'lighthouse'],
      'church': ['church', 'monument'],
      'museum': ['museum', 'monument'],
      'park': ['park', 'viewpoint'],
      'beach': ['beach', 'harbor'],
      'harbor': ['harbor', 'beach', 'marina'],
      'wreck': ['wreck', 'biological', 'cave']
    };

    for (const [key, group] of Object.entries(categoryGroups)) {
      if (group.includes(cat1) && group.includes(cat2)) {
        return 0.8; // Categorie simili
      }
    }

    return 0.3; // Categorie diverse
  }
}

module.exports = POIDeduplicator;

