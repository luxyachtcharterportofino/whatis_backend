// ===============================
// 🎯 Quality Filter
// Filtra e classifica POI per rilevanza turistica
// ===============================

class QualityFilter {
  constructor() {
    this.minScore = 5; // Punteggio minimo per essere accettato
    this.maxDistance = 50; // Metri - distanza massima tra POI simili
  }

  filterPOIs(pois) {
    console.log(`🎯 Filtering ${pois.length} POIs for tourist relevance...`);
    
    // Step 1: Rimuovi duplicati
    const uniquePOIs = this.removeDuplicates(pois);
    console.log(`📍 After deduplication: ${uniquePOIs.length} POIs`);
    
    // Step 2: Filtra per qualità
    const qualityPOIs = this.filterByQuality(uniquePOIs);
    console.log(`📍 After quality filter: ${qualityPOIs.length} POIs`);
    
    // Step 3: Filtra per distanza
    const spacedPOIs = this.filterByDistance(qualityPOIs);
    console.log(`📍 After distance filter: ${spacedPOIs.length} POIs`);
    
    // Step 4: Ordina per punteggio
    const sortedPOIs = this.sortByScore(spacedPOIs);
    
    return sortedPOIs;
  }

  removeDuplicates(pois) {
    const seen = new Set();
    const unique = [];
    
    for (const poi of pois) {
      const key = `${poi.name.toLowerCase()}_${poi.lat.toFixed(4)}_${poi.lng.toFixed(4)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(poi);
      }
    }
    
    return unique;
  }

  filterByQuality(pois) {
    return pois.filter(poi => {
      // Filtra POI con nomi generici
      if (this.isGenericName(poi.name)) {
        return false;
      }
      
      const score = this.calculateQualityScore(poi);
      poi.qualityScore = score;
      return score >= this.minScore;
    });
  }

  calculateQualityScore(poi) {
    let score = 0;
    
    // Punteggio base per categoria
    const categoryScores = {
      'museum': 8,
      'monument': 9,
      'church': 8,
      'beach': 7,
      'marina': 6,
      'lighthouse': 7,
      'park': 6,
      'other': 3
    };
    
    score += categoryScores[poi.category] || 3;
    
    // Bonus per nomi specifici (non generici)
    if (this.isSpecificName(poi.name)) {
      score += 2;
    }
    
    // Bonus per descrizione ricca
    if (poi.description && poi.description.length > 100) {
      score += 2;
    }
    
    // Bonus per fonte affidabile
    if (poi.source && poi.source.includes('Wikipedia')) {
      score += 1;
    }
    
    // Penalità per nomi generici
    if (this.isGenericName(poi.name)) {
      score -= 5;
    }
    
    // Penalità per POI non turistici
    if (this.isNonTouristPOI(poi.name)) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  isSpecificName(name) {
    const specificIndicators = [
      'di ', 'del ', 'della ', 'dei ', 'delle ',
      'San ', 'Santa ', 'Sant\'', 'Santo ',
      'Villa ', 'Castello ', 'Palazzo ', 'Torre ',
      'Abbazia ', 'Monastero ', 'Basilica ', 'Duomo ',
      'Museo ', 'Galleria ', 'Parco ', 'Giardino '
    ];
    
    return specificIndicators.some(indicator => 
      name.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  isGenericName(name) {
    const genericNames = [
      'monumento', 'chiesa', 'villa', 'palazzo', 'torre',
      'monument', 'church', 'villa', 'palace', 'tower',
      'poi', 'punto di interesse', 'luogo', 'sito',
      'statua', 'statue', 'edificio', 'building'
    ];
    
    const lowerName = name.toLowerCase().trim();
    
    // Se il nome è solo una categoria generica
    if (genericNames.includes(lowerName)) {
      return true;
    }
    
    // Se il nome è troppo corto
    if (lowerName.length <= 3) {
      return true;
    }
    
    // Se il nome è solo "Monumento" + numero o solo "monument"
    if (/^(monumento|monument)\s*\d*$/i.test(lowerName)) {
      return true;
    }
    
    // Se il nome contiene solo parole generiche
    if (/^(monumento|monument|chiesa|church|villa|palazzo|torre|tower)\s*$/i.test(lowerName)) {
      return true;
    }
    
    return false;
  }

  isNonTouristPOI(name) {
    const nonTouristIndicators = [
      'scuola', 'ufficio', 'uffici', 'parcheggio', 'parking',
      'supermercato', 'negozio', 'shop', 'banca', 'bank',
      'farmacia', 'pharmacy', 'ospedale', 'hospital',
      'stazione', 'station', 'fermata', 'stop',
      'cimitero', 'cemetery', 'deposito', 'warehouse'
    ];
    
    const lowerName = name.toLowerCase();
    return nonTouristIndicators.some(indicator => lowerName.includes(indicator));
  }

  filterByDistance(pois) {
    const filtered = [];
    
    for (const poi of pois) {
      let tooClose = false;
      
      for (const existing of filtered) {
        const distance = this.calculateDistance(poi, existing);
        if (distance < this.maxDistance) {
          // Se sono troppo vicini, mantieni quello con punteggio più alto
          if (poi.qualityScore > existing.qualityScore) {
            const index = filtered.indexOf(existing);
            filtered[index] = poi;
          }
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        filtered.push(poi);
      }
    }
    
    return filtered;
  }

  calculateDistance(poi1, poi2) {
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = poi1.lat * Math.PI/180;
    const φ2 = poi2.lat * Math.PI/180;
    const Δφ = (poi2.lat - poi1.lat) * Math.PI/180;
    const Δλ = (poi2.lon - poi1.lon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  sortByScore(pois) {
    return pois.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }
}

module.exports = QualityFilter;
