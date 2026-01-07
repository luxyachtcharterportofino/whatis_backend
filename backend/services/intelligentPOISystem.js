// ===============================
// 🧠 Intelligent POI System
// Sistema principale per la ricerca intelligente di POI
// ===============================

const MunicipalityDiscovery = require('./municipalityDiscovery');
const IntelligentPOISearchEngine = require('./intelligentPOISearchEngine');
const SemanticPOISearch = require('./semanticPOISearch');
const SemanticHelper = require('../utils/semanticHelper');
const fs = require('fs');
const path = require('path');

class IntelligentPOISystem {
  constructor() {
    this.municipalityDiscovery = new MunicipalityDiscovery();
    this.intelligentSearchEngine = new IntelligentPOISearchEngine();
    this.semanticSearch = new SemanticPOISearch(); // New semantic engine
    this.logFile = path.join(__dirname, '../logs/poiAutoSearch.log');
    this.cacheDir = path.join(__dirname, '../cache/municipalities');
    this.poiCacheDir = path.join(__dirname, '../cache/pois');
    this.ensureCacheDir();
  }

  /**
   * Assicura che le directory cache esistano
   */
  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.poiCacheDir)) {
      fs.mkdirSync(this.poiCacheDir, { recursive: true });
    }
  }

  /**
   * Avvia il processo di ricerca intelligente POI
   * @param {Object} zone - Zona selezionata
   * @param {Function} progressCallback - Callback per aggiornamenti progresso
   * @returns {Object} Risultato con municipi e POI
   */
  async startIntelligentPOISearch(zone, progressCallback = null) {
    const startTime = new Date();
    this.log(`🚀 Avvio ricerca intelligente POI per zona: ${zone.name}`);
    
    try {
      // Step 1: Controlla se esiste già una cache
      const cacheFile = path.join(this.cacheDir, `zone_${zone._id || zone.id}.json`);
      let municipalities = [];
      let fromCache = false;
      
      if (fs.existsSync(cacheFile)) {
        this.log(`📂 Cache trovata per zona ${zone.name}`);
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        municipalities = cacheData.municipalities;
        
        // Verifica se i confini della zona sono cambiati
        const cacheInvalid = this.isCacheInvalidated(zone, cacheData);
        
        if (cacheInvalid) {
          this.log(`🔄 Confini zona modificati, invalidazione cache e ricerca nuova`);
          this.log(`🗑️ Eliminando cache obsoleta: ${cacheFile}`);
          fs.unlinkSync(cacheFile);
          fromCache = false;
          // Fall through to search again
        } else if (!municipalities || municipalities.length === 0) {
          this.log(`⚠️ Cache vuota rilevata per zona ${zone.name}, eliminazione e ricerca nuova`);
          this.log(`🗑️ Eliminando cache file: ${cacheFile}`);
          fs.unlinkSync(cacheFile);
          fromCache = false;
          // Fall through to search again
        } else {
          fromCache = true;
          this.log(`✅ Caricati ${municipalities.length} municipi dalla cache per zona ${zone.name}`);
        }
      }
      
      // Step 2: Scoperta municipi (solo se non in cache o cache vuota)
      if (!fromCache) {
        this.updateProgress(progressCallback, 10, '🔍 Scoperta municipi nella zona...');
        municipalities = await this.municipalityDiscovery.findMunicipalitiesInZone(zone);
        
        // Step 3: Deduplicazione municipi con nomi simili
        municipalities = this.deduplicateMunicipalities(municipalities);
        
        // Step 4: Salva in cache SOLO se ha trovato municipi
        if (municipalities && municipalities.length > 0) {
          const cacheData = {
            zoneId: zone._id || zone.id,
            zoneName: zone.name,
            zoneCoordinates: zone.coordinates, // Salva le coordinate per controllo invalidazione
            municipalities: municipalities,
            timestamp: new Date().toISOString()
          };
          fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
          this.log(`💾 Cache salvata per zona ${zone.name} (${municipalities.length} municipi)`);
        } else {
          this.log(`⚠️ Nessun municipio trovato, cache non salvata`);
        }
      }
      
      this.log(`✅ Trovati ${municipalities.length} municipi: ${municipalities.map(m => m.name).join(', ')}`);
      
      return {
        success: true,
        municipalities: municipalities,
        zone: zone,
        fromCache: fromCache,
        message: `Trovati ${municipalities.length} municipi nella zona ${zone.name}`
      };
      
    } catch (error) {
      this.log(`❌ Errore ricerca intelligente: ${error.message}`);
      
      // Fallback: usa geocoding inverso per trovare municipi
      try {
        this.log('🔄 Tentativo fallback con geocoding inverso...');
        let fallbackMunicipalities = await this.municipalityDiscovery.getFallbackMunicipalities(zone);
        
        // Deduplica anche nel fallback
        fallbackMunicipalities = this.deduplicateMunicipalities(fallbackMunicipalities);
        
        if (fallbackMunicipalities.length > 0) {
          return {
            success: true,
            municipalities: fallbackMunicipalities,
            zone: zone,
            message: `Trovati ${fallbackMunicipalities.length} municipi tramite geocoding inverso`
          };
        }
      } catch (fallbackError) {
        this.log(`❌ Errore anche nel fallback: ${fallbackError.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Deduplica municipi con nomi simili (es. "Portovenere" vs "Porto Venere")
   */
  deduplicateMunicipalities(municipalities) {
    const deduplicated = [];
    const seen = new Set();
    
    for (const municipality of municipalities) {
      // Normalizza il nome (rimuove spazi, converte in minuscolo)
      const normalizedName = municipality.name.toLowerCase().replace(/\s+/g, '');
      
      // Controlla se abbiamo già visto un nome simile
      let isDuplicate = false;
      for (const existing of seen) {
        if (this.namesAreSimilar(normalizedName, existing)) {
          this.log(`🔗 Doppione trovato: "${municipality.name}" è simile a nome esistente`);
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        deduplicated.push(municipality);
        seen.add(normalizedName);
      }
    }
    
    if (deduplicated.length < municipalities.length) {
      this.log(`🧹 Deduplicazione: ${municipalities.length} → ${deduplicated.length} municipi`);
    }
    
    return deduplicated;
  }

  /**
   * Verifica se due nomi sono simili
   */
  namesAreSimilar(name1, name2) {
    // Rimuovi spazi e converti in minuscolo
    const n1 = name1.toLowerCase().replace(/\s+/g, '');
    const n2 = name2.toLowerCase().replace(/\s+/g, '');
    
    // Se sono identici
    if (n1 === n2) return true;
    
    // Calcola similarità
    const similarity = this.calculateStringSimilarity(n1, n2);
    
    // Considera simili se la similarità è > 0.85
    return similarity > 0.85;
  }

  /**
   * Salva POI provvisori in cache
   */
  saveProvisionalPOIs(municipalityId, zoneId, pois) {
    try {
      const cacheFile = path.join(this.poiCacheDir, `provisional_pois_${municipalityId}_${zoneId}.json`);
      const cacheData = {
        municipalityId: municipalityId,
        zoneId: zoneId,
        pois: pois,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      this.log(`💾 POI provvisori salvati in cache: ${pois.length} POI`);
    } catch (error) {
      this.log(`⚠️ Errore salvataggio cache POI: ${error.message}`);
    }
  }

  /**
   * Carica POI provvisori da cache
   */
  loadProvisionalPOIs(municipalityId, zoneId) {
    try {
      const cacheFile = path.join(this.poiCacheDir, `provisional_pois_${municipalityId}_${zoneId}.json`);
      
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        this.log(`📂 POI provvisori caricati da cache: ${cacheData.pois.length} POI`);
        return cacheData.pois;
      }
      
      return null;
    } catch (error) {
      this.log(`⚠️ Errore caricamento cache POI: ${error.message}`);
      return null;
    }
  }

  /**
   * Rimuove un POI dalla cache provvisoria
   */
  removePOIFromCache(municipalityId, zoneId, poiName) {
    try {
      const cacheFile = path.join(this.poiCacheDir, `provisional_pois_${municipalityId}_${zoneId}.json`);
      
      if (!fs.existsSync(cacheFile)) {
        return false;
      }
      
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const initialLength = cacheData.pois.length;
      
      // Remove the POI by name
      cacheData.pois = cacheData.pois.filter(poi => poi.name !== poiName);
      
      // If no POIs left, delete the cache file
      if (cacheData.pois.length === 0) {
        fs.unlinkSync(cacheFile);
        this.log(`🗑️ Cache POI eliminata (vuota dopo rimozione)`);
        return true;
      }
      
      // Update cache file with remaining POIs
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      this.log(`🗑️ POI rimosso da cache: ${poiName} (rimangono ${cacheData.pois.length} POI)`);
      
      return cacheData.pois.length < initialLength;
    } catch (error) {
      this.log(`⚠️ Errore rimozione POI da cache: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica se esistono POI provvisori in cache
   * Se il file esiste ma è vuoto, lo cancella
   */
  hasProvisionalPOIs(municipalityId, zoneId) {
    const cacheFile = path.join(this.poiCacheDir, `provisional_pois_${municipalityId}_${zoneId}.json`);
    
    // Se il file non esiste, non ci sono POI
    if (!fs.existsSync(cacheFile)) {
      return false;
    }
    
    try {
      // Leggi il file e controlla se contiene POI
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      
      // Se il file è vuoto o non contiene POI, cancellalo e ritorna false
      if (!cacheData.pois || cacheData.pois.length === 0) {
        fs.unlinkSync(cacheFile);
        this.log(`🗑️ File cache vuoto eliminato: ${cacheFile}`);
        return false;
      }
      
      // Il file contiene POI validi
      return true;
    } catch (error) {
      // Se c'è un errore nella lettura, cancella il file corrotto
      this.log(`⚠️ Errore lettura cache, eliminazione file: ${error.message}`);
      try {
        fs.unlinkSync(cacheFile);
      } catch (unlinkError) {
        // Ignora errori di cancellazione
      }
      return false;
    }
  }

  /**
   * Calcola il bounding box della zona dalle coordinate
   * @param {Array} coordinates - Array di coordinate del poligono
   * @returns {Object} Bounding box con {north, south, east, west}
   */
  calculateZoneBoundingBox(coordinates) {
    if (!coordinates || coordinates.length < 3) {
      return null;
    }
    
    const getLatLng = (coord) => {
      if (Array.isArray(coord)) {
        return { lat: coord[0], lng: coord[1] };
      }
      return { lat: coord.lat, lng: coord.lng };
    };
    
    const first = getLatLng(coordinates[0]);
    let minLat = first.lat, maxLat = first.lat;
    let minLng = first.lng, maxLng = first.lng;
    
    for (const coord of coordinates) {
      const { lat, lng } = getLatLng(coord);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    
    return {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    };
  }

  /**
   * Ricerca POI per un municipio specifico
   * @param {Object} municipality - Municipio selezionato
   * @param {Object} zone - Zona di appartenenza
   * @param {Function} progressCallback - Callback per aggiornamenti progresso
   * @returns {Array} Lista di POI arricchiti
   */
  async searchPOIsForMunicipality(municipality, zone, progressCallback = null) {
    const startTime = new Date();
    this.log(`🔍 Ricerca POI per municipio: ${municipality.name}`);
    console.log(`🔍 [INTELLIGENT POI] Avvio ricerca per: ${municipality.name}`);
    
    try {
      // FASE 0: Calculate zone bounding box for geographic filtering
      const boundingBox = this.calculateZoneBoundingBox(zone.coordinates);
      zone.boundingBox = boundingBox;
      
      // FASE 1: Nuova ricerca semantica multi-fonte (PRIMARY)
      this.updateProgress(progressCallback, 10, `🧠 Ricerca semantica multi-fonte per ${municipality.name}...`);
      console.log(`🧠 [INTELLIGENT POI] Fase 1: Semantic Multi-Source Search`);
      
      const semanticPOIs = await this.semanticSearch.searchPOIs(municipality, zone, progressCallback);
      
      this.log(`📍 Semantic Search: ${semanticPOIs.length} POI trovati`);
      console.log(`📍 [INTELLIGENT POI] Semantic Search: ${semanticPOIs.length} POI`);
      
      // FASE 2: Fallback al vecchio sistema se necessario
      let finalPOIs = semanticPOIs;
      
      if (semanticPOIs.length < 3) {
        console.warn(`[WARN] Semantic search returned insufficient POIs (${semanticPOIs.length}), fallback to intelligent engine triggered`);
        this.log(`⚠️ POI semantici insufficienti (${semanticPOIs.length}), attivazione fallback...`);
        
        this.updateProgress(progressCallback, 50, `🔄 Fallback Deep Context Parser...`);
        
        const intelligentPOIs = await this.intelligentSearchEngine.searchPOIsForMunicipality(
          municipality, 
          zone.coordinates, 
          progressCallback
        );
        
        const filteredPOIs = this.filterGenericPOIs(intelligentPOIs);
        
        this.log(`🔄 Fallback: ${filteredPOIs.length} POI aggiuntivi`);
        
        // Unisci e rimuovi duplicati
        finalPOIs = this.mergeUniquePOIs(semanticPOIs, filteredPOIs);
      }
      
      // Normalizzazione finale
      this.updateProgress(progressCallback, 90, `🧹 Normalizzazione finale POI...`);
      console.log(`🧹 [INTELLIGENT POI] Normalizzazione finale...`);
      const normalizedPOIs = this.normalizePOIs(finalPOIs, municipality, zone);
      
      // Filtro geografico finale: rimuovi POI fuori dalla zona
      const filteredByZone = SemanticHelper.filterPOIsByZone(normalizedPOIs, zone);
      this.log(`🗺️ Filtro geografico: ${filteredByZone.length} POI mantenuti (da ${normalizedPOIs.length} iniziali)`);
      console.log(`🗺️ [INTELLIGENT POI] Filtro geografico: ${filteredByZone.length} POI mantenuti`);
      
      // Salva POI provvisori in cache
      this.saveProvisionalPOIs(municipality.id || municipality.name, zone._id || zone.id, filteredByZone);
      
      this.log(`✅ Processo completato: ${filteredByZone.length} POI finali per ${municipality.name}`);
      console.log(`✅ [INTELLIGENT POI] Completato: ${filteredByZone.length} POI finali`);
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      this.log(`⏱️ Tempo totale: ${duration}s per ${municipality.name}`);
      console.log(`⏱️ [INTELLIGENT POI] Tempo totale: ${duration}s`);
      
      return filteredByZone;
      
    } catch (error) {
      this.log(`❌ Errore ricerca POI per ${municipality.name}: ${error.message}`);
      console.error(`❌ [INTELLIGENT POI] Errore: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalizza e valida POI
   */
  normalizePOIs(pois, municipality, zone) {
    const normalizedPOIs = [];
    
    for (const poi of pois) {
      try {
        // Clean and validate name separately to ensure no description leakage
        let cleanName = this.cleanString(poi.name);
        
        // Remove any description that might have leaked into name
        // Stop at common separators: colon, dash, bullet points
        const nameCleanupMatch = cleanName.match(/^([^:–—•\-\•]+)/);
        if (nameCleanupMatch && nameCleanupMatch[1]) {
          cleanName = nameCleanupMatch[1].trim();
        }
        
        // Remove trailing punctuation
        cleanName = cleanName.replace(/[.,;:]+$/, '').trim();
        
        const normalizedPOI = {
          name: cleanName,
          description: this.cleanString(poi.description || ''),
          lat: parseFloat(poi.lat),
          lng: parseFloat(poi.lng),
          zone: zone._id || zone.id,
          municipality: municipality.name,
          category: this.mapToExistingCategory(poi.category) || 'other',
          semanticCategory: poi.category || 'Other',
          source: this.mapSourceToValid(poi.source || 'internet'),
          imageUrl: poi.imageUrl || '',
          customIcon: poi.customIcon || poi.icon || this.getDefaultIcon(poi.category),
          extraInfo: {
            aiGenerated: poi.extraInfo?.aiGenerated || false,
            wikipedia: poi.extraInfo?.wikipediaUrl || poi.extraInfo?.wikipedia || '',
            website: poi.extraInfo?.website || poi.extraInfo?.sourceUrl || '',
            curiosities: this.cleanString(poi.extraInfo?.curiosities || ''),
            historicalFacts: this.cleanString(poi.extraInfo?.historicalFacts || ''),
            tags: poi.extraInfo?.tags || poi.extraInfo?.osmTags || [],
            osmId: poi.osmId || poi.extraInfo?.osmId || '',
            rating: 0,
            accessibility: 'public',
            intelligentSearch: true
          }
        };
        
        // Validazione coordinate
        if (isNaN(normalizedPOI.lat) || isNaN(normalizedPOI.lng)) {
          this.log(`⚠️ Coordinate non valide per ${poi.name}, saltato`);
          continue;
        }
        
        // Validazione nome
        if (!normalizedPOI.name || normalizedPOI.name.length < 2) {
          this.log(`⚠️ Nome non valido per POI, saltato`);
          continue;
        }
        
        normalizedPOIs.push(normalizedPOI);
        
      } catch (error) {
        this.log(`⚠️ Errore normalizzazione POI ${poi.name}: ${error.message}`);
      }
    }
    
    return normalizedPOIs;
  }

  /**
   * Pulisce stringhe da caratteri non validi
   */
  cleanString(str) {
    if (!str) return '';
    return str.toString().trim().replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
  }

  /**
   * Mappa il source a valori validi per il database
   */
  mapSourceToValid(source) {
    const sourceMap = {
      'Institutional': 'internet',
      'Wikipedia': 'wikipedia',
      'OSM': 'osm',
      'AI': 'AI',
      'Manual': 'manual'
    };
    
    return sourceMap[source] || 'internet';
  }

  /**
   * Mappa le nuove categorie semantiche a quelle esistenti nel database
   */
  mapToExistingCategory(semanticCategory) {
    const categoryMap = {
      'Religion': 'church',
      'Monument / Architecture': 'monument',
      'Museum / Culture': 'museum',
      'Nature / Landscape': 'park',
      'Marine / Nautical': 'harbor',
      'Archaeological / Historical site': 'monument',
      'Cultural / Event place': 'museum',
      'Civic / Urban landmark': 'monument',
      'Scientific / Educational': 'museum',
      'Other': 'other'
    };
    
    return categoryMap[semanticCategory] || 'other';
  }

  /**
   * Ottiene icona di default per categoria
   */
  getDefaultIcon(category) {
    const iconMap = {
      'church': '⛪',
      'monument': '🏛️',
      'museum': '🏛️',
      'beach': '🏖️',
      'harbor': '⚓',
      'lighthouse': '🗼',
      'park': '🌳',
      'cave': '🕳️',
      'mountain': '⛰️',
      'lake': '🏞️',
      'villa': '🏰',
      'other': '📍'
    };
    
    return iconMap[category] || '📍';
  }

  /**
   * Deduplica POI esistenti
   */
  async deduplicateWithExisting(newPOIs, existingPOIs, toleranceMeters = 50) {
    const deduplicatedPOIs = [];
    
    for (const newPOI of newPOIs) {
      const isDuplicate = existingPOIs.some(existing => 
        this.calculateDistance(newPOI, existing) < toleranceMeters &&
        this.similarNames(newPOI.name, existing.name)
      );
      
      if (!isDuplicate) {
        deduplicatedPOIs.push(newPOI);
      }
    }
    
    this.log(`🧹 Deduplicazione: ${newPOIs.length} → ${deduplicatedPOIs.length} POI (rimossi ${newPOIs.length - deduplicatedPOIs.length} duplicati)`);
    
    return deduplicatedPOIs;
  }

  /**
   * Calcola distanza tra due POI
   */
  calculateDistance(poi1, poi2) {
    const R = 6371000; // Raggio Terra in metri
    const dLat = (poi2.lat - poi1.lat) * Math.PI / 180;
    const dLng = (poi2.lng - poi1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(poi1.lat * Math.PI / 180) * Math.cos(poi2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Verifica se due nomi sono simili
   */
  similarNames(name1, name2) {
    const similarity = this.calculateStringSimilarity(name1.toLowerCase(), name2.toLowerCase());
    return similarity > 0.8;
  }

  /**
   * Calcola similarità tra stringhe
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Distanza di Levenshtein
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
   * Filtra POI generici OSM
   */
  filterGenericPOIs(pois) {
    const genericNames = [
      'bare_rock', 'water', 'wood', 'grass', 'forest', 'farm', 'road',
      'grassland', 'scrub', 'cunawara', 'heath', 'sand', 'mud', 'rock',
      'wetland', 'marsh', 'mangrove', 'tidal'
    ];
    
    return pois.filter(poi => {
      const nameLower = (poi.name || '').toLowerCase().trim();
      
      // Escludi solo numeri
      if (/^[IVXLCDM\d]+$/.test(nameLower)) return false;
      
      // Escludi nomi generici
      if (genericNames.includes(nameLower)) return false;
      
      // Escludi descrizioni generiche
      if (poi.description && poi.description.toLowerCase().includes('nessuna descrizione')) {
        if (genericNames.some(g => nameLower.includes(g))) return false;
      }
      
      return true;
    });
  }

  /**
   * Unisce POI unici da due fonti
   */
  mergeUniquePOIs(semanticPOIs, osmPOIs) {
    const merged = [...semanticPOIs];
    const existingNames = new Set(semanticPOIs.map(p => p.name.toLowerCase()));
    
    for (const osmPOI of osmPOIs) {
      if (!existingNames.has(osmPOI.name.toLowerCase())) {
        merged.push(osmPOI);
        existingNames.add(osmPOI.name.toLowerCase());
      }
    }
    
    return merged;
  }

  /**
   * Aggiorna progresso
   */
  updateProgress(progressCallback, percentage, message, details = '') {
    if (progressCallback) {
      progressCallback(percentage, message, details);
    }
    this.log(`📊 ${percentage}% - ${message} ${details}`);
  }

  /**
   * Verifica se la cache è invalidata confrontando le coordinate della zona
   * @param {Object} zone - Zona corrente con coordinate
   * @param {Object} cacheData - Dati della cache
   * @returns {boolean} True se la cache è invalidata
   */
  isCacheInvalidated(zone, cacheData) {
    try {
      // Se non ci sono coordinate salvate nella cache, considera invalidata
      if (!cacheData.zoneCoordinates) {
        this.log(`📍 Cache senza coordinate salvate, invalidazione necessaria`);
        return true;
      }
      
      // Se non ci sono coordinate attuali, mantieni cache
      if (!zone.coordinates || !Array.isArray(zone.coordinates)) {
        this.log(`⚠️ Zona senza coordinate valide, mantengo cache esistente`);
        return false;
      }
      
      const currentCoords = zone.coordinates;
      const cachedCoords = cacheData.zoneCoordinates;
      
      // Confronta il numero di punti
      if (currentCoords.length !== cachedCoords.length) {
        this.log(`📊 Numero di vertici cambiato: ${cachedCoords.length} → ${currentCoords.length}`);
        return true;
      }
      
      // Confronta ogni coordinata con una tolleranza per errori di arrotondamento
      const tolerance = 0.00001; // ~1 metro di tolleranza
      
      for (let i = 0; i < currentCoords.length; i++) {
        const current = currentCoords[i];
        const cached = cachedCoords[i];
        
        // Gestisci diversi formati di coordinate
        const currentLat = Array.isArray(current) ? current[0] : current.lat;
        const currentLng = Array.isArray(current) ? current[1] : current.lng;
        const cachedLat = Array.isArray(cached) ? cached[0] : cached.lat;
        const cachedLng = Array.isArray(cached) ? cached[1] : cached.lng;
        
        if (Math.abs(currentLat - cachedLat) > tolerance || 
            Math.abs(currentLng - cachedLng) > tolerance) {
          this.log(`📍 Coordinate cambiate al vertice ${i}: [${cachedLat}, ${cachedLng}] → [${currentLat}, ${currentLng}]`);
          return true;
        }
      }
      
      this.log(`✅ Coordinate zona invariate, cache valida`);
      return false;
      
    } catch (error) {
      this.log(`❌ Errore controllo invalidazione cache: ${error.message}`);
      // In caso di errore, invalida la cache per sicurezza
      return true;
    }
  }

  /**
   * Invalida manualmente la cache di una zona
   * @param {string} zoneId - ID della zona
   * @returns {boolean} True se la cache è stata eliminata
   */
  invalidateZoneCache(zoneId) {
    try {
      const cacheFile = path.join(this.cacheDir, `zone_${zoneId}.json`);
      
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        this.log(`🗑️ Cache invalidata manualmente per zona ${zoneId}`);
        return true;
      } else {
        this.log(`📂 Nessuna cache da invalidare per zona ${zoneId}`);
        return false;
      }
    } catch (error) {
      this.log(`❌ Errore invalidazione cache: ${error.message}`);
      return false;
    }
  }

  /**
   * Aggiorna il nome di un municipio nella cache
   * @param {string} zoneId - ID della zona
   * @param {string} municipalityId - ID del municipio
   * @param {string} newName - Nuovo nome del municipio
   * @returns {boolean} True se l'aggiornamento è riuscito
   */
  async updateMunicipalityNameInCache(zoneId, municipalityId, newName, oldName = null) {
    try {
      const cacheFile = path.join(this.cacheDir, `zone_${zoneId}.json`);
      
      if (!fs.existsSync(cacheFile)) {
        this.log(`⚠️ Cache file non trovato per zona ${zoneId}`);
        return false;
      }
      
      // Leggi la cache esistente
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      
      if (!cacheData.municipalities || !Array.isArray(cacheData.municipalities)) {
        this.log(`⚠️ Struttura cache non valida per zona ${zoneId}`);
        return false;
      }
      
      // Prima cerca per ID (più affidabile)
      let municipalityIndex = cacheData.municipalities.findIndex(
        m => m.id === municipalityId
      );
      
      // Se non trovato per ID, cerca per nome (municipalityId potrebbe essere un nome)
      if (municipalityIndex === -1) {
        municipalityIndex = cacheData.municipalities.findIndex(
          m => m.name === municipalityId
        );
      }
      
      // Se ancora non trovato e oldName è fornito, cerca per vecchio nome
      if (municipalityIndex === -1 && oldName) {
        municipalityIndex = cacheData.municipalities.findIndex(
          m => m.name === oldName
        );
        if (municipalityIndex !== -1) {
          this.log(`🔍 Municipio trovato per vecchio nome "${oldName}" nella cache`);
        }
      }
      
      if (municipalityIndex === -1) {
        this.log(`⚠️ Municipio ${municipalityId} (vecchio nome: ${oldName || 'N/A'}) non trovato nella cache`);
        return false;
      }
      
      const currentName = cacheData.municipalities[municipalityIndex].name;
      cacheData.municipalities[municipalityIndex].name = newName;
      
      // Aggiorna timestamp
      cacheData.timestamp = new Date().toISOString();
      
      // Salva la cache aggiornata
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      
      this.log(`✅ Municipio rinominato: "${currentName}" → "${newName}" nella cache zona ${zoneId}`);
      return true;
      
    } catch (error) {
      this.log(`❌ Errore aggiornamento nome municipio: ${error.message}`);
      return false;
    }
  }

  /**
   * Logging
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [POI-AUTO] ${message}`;
    
    console.log(logMessage);
    
    // Scrive su file di log
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Errore scrittura log:', error);
    }
  }
}

module.exports = IntelligentPOISystem;
