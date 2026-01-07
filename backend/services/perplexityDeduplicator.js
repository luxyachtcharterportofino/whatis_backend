// ===============================
// 🔍 Perplexity Deduplicator
// Servizio per deduplicazione intelligente e merge suggestion
// ===============================

const Logger = require('../utils/logger');

class PerplexityDeduplicator {
  constructor() {
    // Soglia distanza per considerare duplicati (in metri)
    this.distanceThreshold = 100; // 100 metri
    
    // Soglia similarità nome (0-1)
    this.nameSimilarityThreshold = 0.7;
  }

  /**
   * Trova duplicati tra POI nuovi e esistenti
   * @param {Array} newPOIs - POI da Perplexity
   * @param {Array} existingPOIs - POI già nel database
   * @returns {Object} - { duplicates: [], new: [], suggestions: [] }
   */
  findDuplicates(newPOIs, existingPOIs) {
    const duplicates = [];
    const newPOIsList = [];
    const suggestions = [];

    for (const newPOI of newPOIs) {
      let isDuplicate = false;
      let bestMatch = null;
      let bestScore = 0;

      for (const existingPOI of existingPOIs) {
        const matchScore = this.calculateMatchScore(newPOI, existingPOI);
        
        if (matchScore > bestScore) {
          bestScore = matchScore;
          bestMatch = existingPOI;
        }

        // Considera duplicato se score > soglia
        if (matchScore >= 0.6) {
          isDuplicate = true;
        }
      }

      if (isDuplicate && bestMatch) {
        // Crea suggestion di merge
        const suggestion = this.createMergeSuggestion(newPOI, bestMatch, bestScore);
        suggestions.push(suggestion);
        duplicates.push({
          new: newPOI,
          existing: bestMatch,
          score: bestScore
        });
      } else {
        // POI nuovo, nessun duplicato trovato
        newPOIsList.push(newPOI);
      }
    }

    return {
      duplicates: duplicates,
      new: newPOIsList,
      suggestions: suggestions,
      stats: {
        totalNew: newPOIs.length,
        duplicates: duplicates.length,
        new: newPOIsList.length,
        suggestions: suggestions.length
      }
    };
  }

  /**
   * Calcola score di matching tra due POI (0-1)
   */
  calculateMatchScore(poi1, poi2) {
    let score = 0;
    let factors = 0;

    // 1. Similarità nome (peso: 40%)
    const nameSimilarity = this.calculateNameSimilarity(poi1.name, poi2.name);
    score += nameSimilarity * 0.4;
    factors += 0.4;

    // 2. Distanza geografica (peso: 50%)
    const distance = this.calculateDistance(
      { lat: poi1.lat, lng: poi1.lng },
      { lat: poi2.lat, lng: poi2.lng }
    );
    const distanceScore = Math.max(0, 1 - (distance / this.distanceThreshold));
    score += distanceScore * 0.5;
    factors += 0.5;

    // 3. Categoria (peso: 10%)
    if (poi1.category === poi2.category) {
      score += 0.1;
    }
    factors += 0.1;

    return score / factors;
  }

  /**
   * Calcola similarità tra due nomi (0-1)
   * Usa algoritmo Levenshtein normalizzato
   */
  calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;

    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();

    // Se identici
    if (s1 === s2) return 1;

    // Se uno contiene l'altro
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.9;
    }

    // Calcola distanza Levenshtein
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calcola distanza Levenshtein tra due stringhe
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
   * Calcola distanza geografica tra due punti (in metri)
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // Raggio Terra in metri
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Crea suggestion di merge tra POI nuovo e esistente
   */
  createMergeSuggestion(newPOI, existingPOI, matchScore) {
    const improvements = [];

    // Verifica miglioramenti possibili
    if (newPOI.description && newPOI.description.length > existingPOI.description?.length) {
      improvements.push('Descrizione più dettagliata disponibile');
    }

    if (newPOI.extraInfo?.aiSummary && !existingPOI.extraInfo?.aiSummary) {
      improvements.push('Riassunto AI disponibile');
    }

    // Verifica coordinate più precise
    const distance = this.calculateDistance(
      { lat: newPOI.lat, lng: newPOI.lng },
      { lat: existingPOI.lat, lng: existingPOI.lng }
    );
    
    if (distance > 10) { // Se differenza > 10 metri
      improvements.push('Coordinate potenzialmente più precise');
    }

    // Verifica categoria
    if (newPOI.category && newPOI.category !== existingPOI.category) {
      improvements.push(`Categoria alternativa: ${newPOI.category}`);
    }

    return {
      existing: {
        id: existingPOI._id || existingPOI.id,
        name: existingPOI.name,
        lat: existingPOI.lat,
        lng: existingPOI.lng,
        category: existingPOI.category,
        description: existingPOI.description || ''
      },
      nuovo: {
        name: newPOI.name,
        lat: newPOI.lat,
        lng: newPOI.lng,
        category: newPOI.category,
        description: newPOI.description || ''
      },
      matchScore: matchScore,
      distance: distance,
      possibili_miglioramenti: improvements,
      raccomandazione: matchScore >= 0.8 
        ? 'Duplicato molto probabile - verifica manualmente' 
        : 'Possibile duplicato - verifica prima di aggiungere'
    };
  }
}

module.exports = PerplexityDeduplicator;

