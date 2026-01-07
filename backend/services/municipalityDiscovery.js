// ===============================
// 🏘️ Municipality Discovery Service
// Scopre i municipi all'interno di una zona selezionata
// ===============================

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const geoSplitter = require('../utils/geoSplitter');

class MunicipalityDiscovery {
  constructor() {
    // Overpass API mirrors list (try in order)
    this.overpassMirrors = [
      { url: 'https://overpass-api.de/api/interpreter', name: 'api.de' },
      { url: 'https://overpass.openstreetmap.fr/api/interpreter', name: 'openstreetmap.fr' },
      { url: 'https://overpass.kumi.systems/api/interpreter', name: 'kumi.systems' },
      { url: 'https://overpass.nchc.org.tw/api/interpreter', name: 'nchc.org.tw' }
    ];
    
    // Default to first mirror
    this.overpassUrl = this.overpassMirrors[0].url;
    
    this.logFile = path.join(__dirname, '../logs/municipality_discovery.log');
    this.ensureLogDir();
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds between retries
    this.queryDelay = 1500; // 1.5 seconds between sub-queries
    this.mirrorRetryDelay = 2000; // 2 seconds between mirror attempts
  }
  
  ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    try {
      fs.appendFileSync(this.logFile, logMessage);
    } catch (err) {
      // Silently ignore log write errors
    }
  }

  /**
   * Trova tutti i municipi all'interno di una zona
   * @param {Object} zone - Zona con coordinate
   * @returns {Array} Lista di municipi con nome, coordinate e informazioni
   */
  async findMunicipalitiesInZone(zone) {
    this.log(`🚀 Ricerca municipi per zona: ${zone.name}`);
    this.log(`📊 Zone coordinates: ${JSON.stringify(zone.coordinates?.slice(0, 3))}... (${zone.coordinates?.length} points)`);
    
    try {
      // Calcola bounding box della zona
      const bbox = this.calculateBoundingBox(zone.coordinates);
      if (!bbox) {
        throw new Error('Coordinate zona non valide');
      }

      this.log(`📍 Bounding box calcolato: ${bbox}`);
      
      // Parse and log bounding box details
      const [minLat, minLng, maxLat, maxLng] = bbox.split(',').map(parseFloat);
      this.log(`📐 Bounding box dettagli: lat(${minLat.toFixed(4)} - ${maxLat.toFixed(4)}) lng(${minLng.toFixed(4)} - ${maxLng.toFixed(4)})`);

      // Query Overpass globale per confini amministrativi
      this.log('🌐 Chiamata Overpass API (modalità globale)...');
      const municipalities = await this.findMunicipalitiesExpanded(zone, bbox);
      
      this.log(`✅ Trovati ${municipalities.length} municipi per ${zone.name}`);
      
      return municipalities;

    } catch (error) {
      this.log(`❌ Errore ricerca municipi: ${error.message}`);
      this.log(`❌ Stack trace: ${error.stack}`);
      return [];
    }
  }

  /**
   * Processa i dati dei municipi da Overpass (legacy function - redirects to processMunicipalities)
   */
  processMunicipalityData(elements, zone) {
    // Redirect to the updated processMunicipalities function
    return this.processMunicipalities(elements, zone);
  }

  /**
   * Rimuove duplicati dai municipi
   */
  removeDuplicateMunicipalities(municipalities) {
    const seen = new Set();
    const unique = [];
    
    for (const municipality of municipalities) {
      const key = municipality.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(municipality);
      }
    }
    
    return unique;
  }

  /**
   * Calcola il centro di una relazione
   */
  calculateRelationCenter(relation) {
    if (relation.center) {
      return { lat: relation.center.lat, lng: relation.center.lon };
    }
    return null;
  }

  /**
   * Verifica se un punto è dentro la zona (più permissivo)
   */
  isPointInZone(point, zoneCoordinates) {
    if (!zoneCoordinates || zoneCoordinates.length < 3) return false;
    
    const getLatLng = (coord) => {
      if (Array.isArray(coord)) {
        return { lat: coord[0], lng: coord[1] };
      }
      return { lat: coord.lat, lng: coord.lng };
    };
    
    // Calcola bounding box della zona
    const first = getLatLng(zoneCoordinates[0]);
    let minLat = first.lat, maxLat = first.lat;
    let minLng = first.lng, maxLng = first.lng;
    
    for (const coord of zoneCoordinates) {
      const { lat, lng } = getLatLng(coord);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    
    // Check if point is in bounding box (quick check)
    const inBBox = point.lat >= minLat && point.lat <= maxLat && 
                   point.lng >= minLng && point.lng <= maxLng;
    
    if (!inBBox) return false;
    
    // Now do precise point-in-polygon check
    const x = point.lng, y = point.lat;
    let inside = false;
    
    for (let i = 0, j = zoneCoordinates.length - 1; i < zoneCoordinates.length; j = i++) {
      const { lat: yi, lng: xi } = getLatLng(zoneCoordinates[i]);
      const { lat: yj, lng: xj } = getLatLng(zoneCoordinates[j]);
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Fetch municipalities from Nominatim as fallback when Overpass fails
   */
  async fetchFromNominatim(bboxString, zone) {
    try {
      this.log('🔄 Fallback: Using Nominatim to find municipalities...');
      
      // Parse bbox string
      const bbox = geoSplitter.parseOverpassFormat(bboxString);
      const { north, south, east, west } = bbox;
      
      // Nominatim reverse search with bounding box
      const nominatimUrl = `https://nominatim.openstreetmap.org/search`;
      const params = {
        format: 'json',
        bounded: '1',
        polygon_geojson: '1',
        viewbox: `${west},${north},${east},${south}`, // west,north,east,south
        extratags: '1',
        featuretype: 'city',
        limit: 50,
        q: zone.name || ''
      };
      
      // Add User-Agent header (required by Nominatim)
      const response = await axios.get(nominatimUrl, {
        params: params,
        headers: {
          'User-Agent': 'Whatis-Backend/1.0'
        },
        timeout: 20000
      });
      
      const results = response.data || [];
      this.log(`📍 Nominatim found ${results.length} results`);
      
      const municipalities = [];
      
      for (const place of results) {
        if (place.display_name && place.lat && place.lon) {
          // Extract municipality name (usually first part of display_name)
          const name = place.display_name.split(',')[0].trim();
          
          municipalities.push({
            name: name,
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
            adminLevel: '8',
            country: this.extractCountry(place),
            population: place.extratags?.population || null,
            wikipedia: place.extratags?.wikipedia || null,
            wikidata: place.extratags?.wikidata || null,
            type: 'municipality',
            source: 'nominatim',
            placeType: 'city',
            zone: zone.name
          });
        }
      }
      
      this.log(`✅ Nominatim fallback: ${municipalities.length} municipalities found`);
      return municipalities;
      
    } catch (error) {
      this.log(`⚠️ Nominatim fallback failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Extract country from Nominatim place data
   */
  extractCountry(place) {
    // Try to find country in address components
    const address = place.address;
    if (address) {
      if (address.country) return address.country;
      if (address.country_code) {
        const countryCode = address.country_code.toUpperCase();
        const countryMap = {
          'FR': 'France', 'IT': 'Italy', 'ES': 'Spain', 'DE': 'Germany',
          'GB': 'United Kingdom', 'US': 'United States', 'CA': 'Canada',
          'CH': 'Switzerland', 'AT': 'Austria', 'BE': 'Belgium',
          'NL': 'Netherlands', 'PT': 'Portugal', 'GR': 'Greece'
        };
        return countryMap[countryCode] || countryCode;
      }
    }
    return 'Unknown';
  }

  /**
   * Fetch from Overpass API using multiple mirrors
   * Tries each mirror in order until one succeeds
   */
  async fetchOverpass(query) {
    for (let i = 0; i < this.overpassMirrors.length; i++) {
      const mirror = this.overpassMirrors[i];
      const startTime = Date.now();
      
      try {
        this.log(`[INFO] Trying mirror #${i + 1} (${mirror.name})...`);
        
        const response = await axios.post(mirror.url, query, {
          headers: { 'Content-Type': 'text/plain' },
          timeout: 60000
        });
        
        const responseTime = Date.now() - startTime;
        
        // Check if response indicates error
        if (response.status >= 500) {
          this.log(`[WARN] Mirror #${i + 1} (${mirror.name}) returned status ${response.status}`);
          if (i < this.overpassMirrors.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.mirrorRetryDelay));
            continue;
          }
        }
        
        this.log(`[INFO] Mirror #${i + 1} (${mirror.name}) succeeded in ${responseTime}ms`);
        return response.data;
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Check if it's a timeout or server error
        if (error.response?.status >= 500 || error.code === 'ECONNABORTED' || error.response?.status === 504) {
          this.log(`[WARN] Mirror #${i + 1} (${mirror.name}) failed after ${responseTime}ms: ${error.response?.status || error.code}`);
          
          // Try next mirror if available
          if (i < this.overpassMirrors.length - 1) {
            this.log(`[INFO] Switching to next mirror...`);
            await new Promise(resolve => setTimeout(resolve, this.mirrorRetryDelay));
            continue;
          }
        }
        
        // For other errors, try next mirror
        if (i < this.overpassMirrors.length - 1) {
          this.log(`[WARN] Mirror #${i + 1} (${mirror.name}) error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, this.mirrorRetryDelay));
          continue;
        }
        
        // Last mirror failed
        throw error;
      }
    }
    
    // All mirrors failed
    throw new Error('All Overpass mirrors unreachable');
  }

  /**
   * Esegue query Overpass e restituisce i risultati (with multi-mirror support + Nominatim fallback)
   */
  async queryOverpass(bboxString, zone) {
    const globalQuery = `[out:json][timeout:60];
(
  relation["boundary"="administrative"]["admin_level"~"6|7|8|9"](${bboxString});
  node["place"~"town|village|city"](${bboxString});
);
out body;
>;
out skel qt;`;
    
    this.log(`🔍 Overpass query for ${zone.name}:`);
    this.log(`📋 Query: ${globalQuery.replace(/\n/g, ' ').replace(/\s+/g, ' ')}`);
    this.log(`📦 Bbox: ${bboxString}`);
    
    try {
      const response = await this.fetchOverpass(globalQuery);
      this.log(`📊 Overpass response: ${response.elements?.length || 0} elements received`);
      
      if (response.elements && response.elements.length > 0) {
        // Log first few elements for debugging
        const sample = response.elements.slice(0, 3);
        this.log(`📋 Sample elements: ${JSON.stringify(sample.map(e => ({
          type: e.type,
          id: e.id,
          name: e.tags?.name,
          place: e.tags?.place,
          admin_level: e.tags?.admin_level
        })))}`);
      }
      
      return response.elements || [];
    } catch (error) {
      this.log(`❌ All Overpass mirrors unreachable: ${error.message}`);
      this.log('⚠️ Overpass failed — using Nominatim fallback');
      
      // Fallback to Nominatim
      const nominatimResults = await this.fetchFromNominatim(bboxString, zone);
      if (nominatimResults.length > 0) {
        this.log(`✅ Nominatim fallback successful: ${nominatimResults.length} municipalities found`);
        return nominatimResults;
      }
      
      // If Nominatim also failed, throw error
      throw error;
    }
  }

  /**
   * Ricerca municipi con criterio allargato (global, non solo Italia)
   * Con retry e split automatico in caso di timeout
   */
  async findMunicipalitiesExpanded(zone, bbox) {
    let allMunicipalities = [];
    
    // Retry loop
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.log(`🔍 Ricerca municipi globali (tentativo ${attempt}/${this.maxRetries}) per zona: ${zone.name}`);
        this.log(`📦 Bounding box: ${bbox}`);
        
        this.log('🌐 Chiamata Overpass API (globale)...');
        
        const elements = await this.queryOverpass(bbox, zone);
        this.log(`📊 Risposta Overpass: ${elements.length} elementi trovati`);
        
        allMunicipalities = this.processMunicipalities(elements, zone);
        
        if (allMunicipalities.length > 0) {
          this.log(`✅ Ricerca completata: ${allMunicipalities.length} municipi trovati`);
          return this.deduplicateAndSort(allMunicipalities, zone);
        }
        
        // If no results, try splitting on last attempt
        if (attempt === this.maxRetries && allMunicipalities.length === 0) {
          this.log('⚠️ Nessun risultato, provo con split del bounding box...');
          return await this.findMunicipalitiesWithSplit(zone, bbox);
        }
        
      } catch (error) {
        // Handle 504 Gateway Timeout or other errors
        if (error.response?.status === 504 || error.code === 'ECONNABORTED') {
          this.log(`⚠️ Timeout API Overpass (tentativo ${attempt}/${this.maxRetries}): ${error.message}`);
          
          if (attempt === this.maxRetries) {
            this.log('🔄 Tentativo con split del bounding box...');
            return await this.findMunicipalitiesWithSplit(zone, bbox);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          
        } else {
          // Other errors - throw immediately
          this.log(`❌ Errore Overpass: ${error.message}`);
          throw error;
        }
      }
    }
    
    return [];
  }

  /**
   * Cerca municipi dividendo il bounding box in tile più piccoli
   */
  async findMunicipalitiesWithSplit(zone, bboxString) {
    this.log('⚠️ Overpass timeout — splitting bounding box...');
    
    // Parse bbox string to object
    const bbox = geoSplitter.parseOverpassFormat(bboxString);
    
    // Split into 2x2 grid
    const subBoxes = geoSplitter.splitBoundingBox(bbox, 2, 2);
    this.log(`📐 Bounding box diviso in ${subBoxes.length} sub-boxes`);
    
    const allMunicipalities = [];
    
    // Query each sub-box with delay
    for (let i = 0; i < subBoxes.length; i++) {
      const subBox = subBoxes[i];
      const subBoxString = geoSplitter.bboxToOverpassFormat(subBox);
      
      this.log(`🔍 Query sub-box ${i + 1}/${subBoxes.length}...`);
      
      try {
        // Delay between queries
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, this.queryDelay));
        }
        
        const elements = await this.queryOverpass(subBoxString, zone);
        const municipalities = this.processMunicipalities(elements, zone);
        
        this.log(`✅ Sub-box ${i + 1} processata: ${municipalities.length} municipi`);
        allMunicipalities.push(...municipalities);
        
      } catch (error) {
        this.log(`⚠️ Errore sub-box ${i + 1}: ${error.message}`);
        // Continue with other boxes
      }
    }
    
    this.log(`✅ Total merged: ${allMunicipalities.length} municipi da tutte le sub-boxes`);
    
    return this.deduplicateAndSort(allMunicipalities, zone);
  }

  /**
   * Processa elementi Overpass in oggetti municipality
   */
  processMunicipalities(elements, zone) {
    const municipalities = [];
    
    for (const element of elements) {
      if (element.tags && element.tags.name) {
        let center = null;
        let placeType = 'unknown';
        let adminLevel = '8';
        
        // Handle different element types
        if (element.type === 'relation' && element.center) {
          // Administrative boundary relation
          center = { lat: element.center.lat, lng: element.center.lon };
          placeType = 'administrative_boundary';
          adminLevel = element.tags.admin_level || '8';
        } else if (element.type === 'node' && element.lat && element.lon) {
          // Place node (town, city, village)
          center = { lat: element.lat, lng: element.lon };
          placeType = element.tags.place || 'place';
          adminLevel = element.tags.admin_level || '8';
        }
        
        // Only process if we have valid coordinates
        if (center) {
          // Extract country from ISO code or other tags
          let country = 'Unknown';
          if (element.tags['ISO3166-1:alpha2']) {
            const countryCode = element.tags['ISO3166-1:alpha2'];
            const countryMap = {
              'FR': 'France', 'IT': 'Italy', 'ES': 'Spain', 'DE': 'Germany',
              'GB': 'United Kingdom', 'US': 'United States', 'CA': 'Canada',
              'CH': 'Switzerland', 'AT': 'Austria', 'BE': 'Belgium',
              'NL': 'Netherlands', 'PT': 'Portugal', 'GR': 'Greece'
            };
            country = countryMap[countryCode] || countryCode;
          } else if (element.tags['addr:country']) {
            country = element.tags['addr:country'];
          }
          
          municipalities.push({
            id: `${element.type}_${element.id}`, // Unique ID combining type and OSM ID
            name: element.tags.name,
            lat: center.lat,
            lng: center.lng,
            adminLevel: adminLevel,
            country: country,
            population: element.tags.population || null,
            wikipedia: element.tags.wikipedia || null,
            wikidata: element.tags.wikidata || null,
            type: 'municipality',
            source: 'overpass',
            placeType: placeType,
            zone: zone.name,
            osmType: element.type,
            osmId: element.id
          });
        }
      }
    }
    
    this.log(`[INFO] Processed ${municipalities.length} municipalities from ${elements.length} Overpass elements`);
    return municipalities;
  }

  /**
   * Deduplica e ordina i municipi
   */
  deduplicateAndSort(municipalities, zone) {
    // Remove duplicates
    let unique = this.removeDuplicateMunicipalities(municipalities);
    
    // Group fractions under main municipalities (only for Italy)
    const italianMunicipalities = unique.filter(m => m.country === 'Italy');
    const nonItalianMunicipalities = unique.filter(m => m.country !== 'Italy');
    
    if (italianMunicipalities.length > 0) {
      unique = [...this.groupFractionsUnderMunicipalities(italianMunicipalities), ...nonItalianMunicipalities];
    }
    
    // Determine source used
    const sources = [...new Set(unique.map(m => m.source))];
    const sourceStr = sources.join(', ');
    
    // Log summary
    this.log(`✅ Ricerca completata: ${unique.length} municipi trovati per zona "${zone.name}"`);
    this.log(`📊 Esempio municipi: ${unique.slice(0, 3).map(m => m.name).join(', ')}`);
    if (unique.length > 0) {
      const countries = [...new Set(unique.map(m => m.country))];
      this.log(`🌍 Paesi: ${countries.join(', ')}`);
      this.log(`📍 Sorgente: ${sourceStr}`);
    } else {
      this.log(`⚠️ Nessun municipio trovato per zona: ${zone.name}`);
    }
    
    // Log discovery summary
    this.log(`[INFO] Discovery summary — Zone: ${zone.name}`);
    this.log(`  Municipalities found: ${unique.length}`);
    this.log(`  Source(s): ${sourceStr}`);
    this.log(`  Fallback used: ${sourceStr.includes('nominatim') ? 'yes (Nominatim)' : 'no (Overpass only)'}`);
    
    // Additional logging as requested
    console.log(`[INFO] Municipalities found: ${unique.length}`);
    
    return unique.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Raggruppa le frazioni sotto i comuni principali (solo per l'Italia)
   * @param {Array} municipalities - Lista di municipi italiani
   * @returns {Array} Lista filtrata con solo i comuni principali
   */
  groupFractionsUnderMunicipalities(municipalities) {
    // Identifica comuni principali e frazioni
    const mainMunicipalities = [];
    const fractions = [];
    
    for (const municipality of municipalities) {
      if (this.isMainMunicipality(municipality)) {
        mainMunicipalities.push(municipality);
      } else if (this.isFraction(municipality)) {
        fractions.push(municipality);
      } else {
        // Se non siamo sicuri, mantieni come comune principale
        mainMunicipalities.push(municipality);
      }
    }
    
    this.log(`🏛️ Identificati ${mainMunicipalities.length} comuni principali e ${fractions.length} frazioni`);
    
    // Per ogni frazione, trova il comune principale più vicino
    const groupedFractions = [];
    for (const fraction of fractions) {
      const nearestMunicipality = this.findNearestMunicipality(fraction, mainMunicipalities);
      if (nearestMunicipality && this.calculateDistance(fraction, nearestMunicipality) < 15000) { // 15km max
        // Aggiungi la frazione come proprietà del comune principale
        if (!nearestMunicipality.fractions) {
          nearestMunicipality.fractions = [];
        }
        nearestMunicipality.fractions.push({
          name: fraction.name,
          lat: fraction.lat,
          lng: fraction.lng,
          adminLevel: fraction.adminLevel,
          placeType: fraction.placeType
        });
        groupedFractions.push(fraction.name);
      } else {
        // Se non trova un comune vicino, mantieni come comune separato
        mainMunicipalities.push(fraction);
      }
    }
    
    if (groupedFractions.length > 0) {
      this.log(`🔗 Frazioni raggruppate: ${groupedFractions.join(', ')}`);
    }
    
    return mainMunicipalities;
  }

  /**
   * Verifica se un municipio è un comune principale
   */
  isMainMunicipality(municipality) {
    // Comuni principali: admin_level 8 o place=city/town
    return (
      municipality.adminLevel === '8' ||
      municipality.placeType === 'city' ||
      municipality.placeType === 'town' ||
      municipality.placeType === 'administrative_boundary'
    );
  }

  /**
   * Verifica se un municipio è una frazione
   */
  isFraction(municipality) {
    // Frazioni: admin_level 9 o place=village/hamlet
    return (
      municipality.adminLevel === '9' ||
      municipality.placeType === 'village' ||
      municipality.placeType === 'hamlet' ||
      municipality.placeType === 'suburb'
    );
  }

  /**
   * Trova il comune principale più vicino a una frazione
   */
  findNearestMunicipality(fraction, municipalities) {
    let nearest = null;
    let minDistance = Infinity;
    
    for (const municipality of municipalities) {
      const distance = this.calculateDistance(fraction, municipality);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = municipality;
      }
    }
    
    return nearest;
  }

  /**
   * Calcola distanza tra due punti (in metri)
   */
  calculateDistance(point1, point2) {
    const R = 6371000; // Raggio Terra in metri
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calcola bounding box dalle coordinate della zona
   */
  calculateBoundingBox(coordinates) {
    if (!coordinates || coordinates.length < 3) return null;
    
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
    
    return `${minLat},${minLng},${maxLat},${maxLng}`;
  }
}

module.exports = MunicipalityDiscovery;