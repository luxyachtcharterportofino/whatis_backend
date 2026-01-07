/**
 * Semantic POI Search Engine
 * 
 * Multi-source semantic POI extraction from Wikipedia, Wikidata, and OSM
 * with intelligent filtering and deduplication.
 * 
 * @module services/semanticPOISearch
 */

const axios = require('axios');
const cheerio = require('cheerio');
const SemanticHelper = require('../utils/semanticHelper');
const Logger = require('../utils/logger');
const { updateProgress } = require('../utils/progressHelper');

class SemanticPOISearch {
  constructor() {
    this.wikipediaUrl = 'https://it.wikipedia.org/api/rest_v1';
    this.wikidataUrl = 'https://query.wikidata.org/sparql';
    this.overpassUrl = 'https://overpass-api.de/api/interpreter';
    this.requestDelay = 1500;
    this.lastRequestTime = 0;
  }

  /**
   * Check if a point is inside the zone polygon
   * @param {Object} point - Point with lat and lng
   * @param {Array} zoneCoordinates - Zone polygon coordinates
   * @returns {boolean} True if point is inside zone
   */
  isPointInZone(point, zoneCoordinates) {
    if (!zoneCoordinates || zoneCoordinates.length < 3) return false;
    
    const getLatLng = (coord) => {
      if (Array.isArray(coord)) {
        return { lat: coord[0], lng: coord[1] };
      }
      return { lat: coord.lat, lng: coord.lng };
    };
    
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
   * Perform semantic POI search for a municipality
   * @param {Object} municipality - Municipality data
   * @param {Object} zone - Zone data
   * @param {Function} progressCallback - Progress callback
   * @returns {Array} Array of POIs
   */
  async searchPOIs(municipality, zone, progressCallback = null) {
    try {
      // Validate and enhance municipality data
      if (!municipality || !municipality.lat || !municipality.lng) {
        Logger.warn(`⚠️ Municipality data missing for ${municipality?.name || 'unknown'}`);
        
        // Use zone center if municipality data is missing
        if (zone.boundingBox) {
          municipality = {
            name: zone.name,
            lat: (zone.boundingBox.south + zone.boundingBox.north) / 2,
            lng: (zone.boundingBox.west + zone.boundingBox.east) / 2,
            bbox: zone.boundingBox
          };
          Logger.info(`📍 Using zone center: ${municipality.lat}, ${municipality.lng}`);
        } else {
          throw new Error('Cannot determine municipality or zone boundaries');
        }
      }
      
      Logger.info(`🔍 Avvio ricerca semantica POI per: ${municipality.name}`);
      
      const allPOIs = [];
      
      // Step 1: Wikipedia + Wikidata search
      updateProgress(progressCallback, 20, '📚 Ricerca Wikipedia e Wikidata...', 'Estrazione POI da fonti culturali');
      const wikiPOIs = await this.searchWikipediaWikidata(municipality, zone);
      allPOIs.push(...wikiPOIs);
      
      // Step 2: OSM tourism search
      updateProgress(progressCallback, 50, '🗺️ Ricerca OpenStreetMap...', 'Estrazione POI da mappa');
      const osmPOIs = await this.searchOSMTourism(municipality, zone);
      allPOIs.push(...osmPOIs);
      
      // Count POIs by source
      const wikiCount = allPOIs.filter(poi => poi.source === 'Wikipedia').length;
      const wikidataCount = allPOIs.filter(poi => poi.source === 'Wikidata').length;
      const osmCount = allPOIs.filter(poi => poi.source === 'OSM').length;
      
      Logger.info(`📊 POI trovati per sorgente: Wikipedia: ${wikiCount} | Wikidata: ${wikidataCount} | OSM: ${osmCount}`);
      
      // Step 3: Filter and deduplicate
      updateProgress(progressCallback, 80, '🔧 Filtraggio e deduplicazione...', 'Pulizia risultati');
      let filteredPOIs = SemanticHelper.filterQualityPOIs(allPOIs);
      const beforeDedup = filteredPOIs.length;
      filteredPOIs = SemanticHelper.deduplicatePOIs(filteredPOIs);
      
      Logger.info(`🔧 Dopo filtri: ${filteredPOIs.length} POI (da ${beforeDedup} iniziali)`);
      
      // Step 4: Validate POIs are within zone bounding box
      if (zone.boundingBox) {
        const bbox = {
          minLat: zone.boundingBox.south,
          maxLat: zone.boundingBox.north,
          minLng: zone.boundingBox.west,
          maxLng: zone.boundingBox.east
        };
        
        const beforeBboxFilter = filteredPOIs.length;
        filteredPOIs = filteredPOIs.filter(poi => SemanticHelper.validatePOILocation(poi, bbox));
        
        Logger.info(`📦 Bounding box filter: ${filteredPOIs.length} POI (rimossi ${beforeBboxFilter - filteredPOIs.length} fuori zona)`);
        Logger.info(`📍 Bounding box: ${bbox.minLat.toFixed(4)}, ${bbox.minLng.toFixed(4)} - ${bbox.maxLat.toFixed(4)}, ${bbox.maxLng.toFixed(4)}`);
      }
      
      // Step 5: Normalize
      filteredPOIs = filteredPOIs.map(poi => SemanticHelper.normalizePOI(poi));
      
      updateProgress(progressCallback, 100, '✅ Ricerca completata', `Trovati ${filteredPOIs.length} POI`);
      
      Logger.success(`✅ Ricerca completata: ${filteredPOIs.length} POI validi per ${municipality.name}`);
      
      return filteredPOIs;
      
    } catch (error) {
      Logger.error(`Errore ricerca semantica POI:`, error);
      return [];
    }
  }

  /**
   * Search POIs from Wikipedia and Wikidata
   * @param {Object} municipality - Municipality data
   * @param {Object} zone - Zone data
   * @returns {Array} Array of POIs
   */
  async searchWikipediaWikidata(municipality, zone) {
    try {
      const pois = [];
      
      // Get Wikipedia page
      const wikiPage = await this.getWikipediaPage(municipality.name);
      if (!wikiPage) return pois;
      
      // Extract POIs from Wikipedia
      const wikiPOIs = await this.extractPOIsFromWikipedia(wikiPage, municipality, zone);
      pois.push(...wikiPOIs);
      
      // Search Wikidata for additional POIs
      const wikidataPOIs = await this.searchWikidata(municipality, zone);
      pois.push(...wikidataPOIs);
      
      return pois;
      
    } catch (error) {
      Logger.error(`Errore ricerca Wikipedia/Wikidata:`, error);
      return [];
    }
  }

  /**
   * Get Wikipedia page content
   * @param {string} municipalityName - Municipality name
   * @returns {Object|null} Wikipedia page data
   */
  async getWikipediaPage(municipalityName) {
    try {
      await this.rateLimit();
      
      // Try different name variants
      const variants = [
        municipalityName,
        `Comune di ${municipalityName}`,
        `${municipalityName} (Italia)`
      ];
      
      for (const name of variants) {
        try {
          const response = await axios.get(
            `${this.wikipediaUrl}/page/html/${encodeURIComponent(name)}`,
            { timeout: 15000 }
          );
          
          if (response.data && response.data.length > 5000) {
            Logger.info(`✅ Pagina Wikipedia trovata: ${name}`);
            return {
              html: response.data,
              title: name
            };
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
      
    } catch (error) {
      Logger.warn(`Impossibile ottenere pagina Wikipedia: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract POIs from Wikipedia HTML
   * @param {Object} page - Wikipedia page data
   * @param {Object} municipality - Municipality data
   * @param {Object} zone - Zone data
   * @returns {Array} Array of POIs
   */
  async extractPOIsFromWikipedia(page, municipality, zone) {
    try {
      const $ = cheerio.load(page.html);
      const pois = [];
      
      // Look for "Monumenti e luoghi d'interesse" section
      const sections = $('h2, h3');
      
      sections.each((i, el) => {
        const sectionText = $(el).text().toLowerCase();
        
        // Check if this is a POI section
        const poiKeywords = [
          'monumenti', 'luoghi', 'interesse', 'patrimonio',
          'chiese', 'castelli', 'musei', 'villa', 'palazzi'
        ];
        
        const isPOISection = poiKeywords.some(keyword => sectionText.includes(keyword));
        
        if (isPOISection) {
          // Extract POIs from this section
          const poiList = $(el).nextUntil('h2, h3');
          
          poiList.find('li').each((j, li) => {
            const text = $(li).text().trim();
            
            if (text && text.length > 10) {
              // Try to extract POI name - stop at first colon, dash, or bullet point
              let name = '';
              let description = text;
              
              // Match name until first separator
              const match = text.match(/^([^:–—•\-\•]+?)([:–—•\-\•]|\.)/);
              if (match && match[1]) {
                name = match[1].trim();
                description = text.substring(match[0].length).trim();
              } else {
                // Fallback: take first sentence or first 100 characters
                const firstSentence = text.split(/[.:;]/)[0].trim();
                if (firstSentence.length > 5 && firstSentence.length < 100) {
                  name = firstSentence;
                  description = text.substring(firstSentence.length).trim();
                } else {
                  // Last resort: first 80 characters
                  name = text.substring(0, 80).trim();
                  description = text.substring(80).trim();
                }
              }
              
              // Clean name - remove trailing dots, commas
              name = name.replace(/[.,;]+$/, '').trim();
              
              // Clean and validate name
              if (name && SemanticHelper.isMeaningfulPOIName(name)) {
                // Use municipality coordinates as POI location
                // Wikipedia extraction doesn't provide individual coordinates
                pois.push({
                  name: name,
                  description: description.substring(0, 500),
                  lat: municipality.lat,
                  lng: municipality.lng,
                  zone: zone.name,
                  municipality: municipality.name,
                  semanticCategory: 'heritage',
                  source: 'Wikipedia',
                  // Mark as approximate location
                  isApproximateLocation: true
                });
              }
            }
          });
        }
      });
      
      return pois;
      
    } catch (error) {
      Logger.error(`Errore estrazione POI da Wikipedia:`, error);
      return [];
    }
  }

  /**
   * Search Wikidata for POIs
   * @param {Object} municipality - Municipality data
   * @param {Object} zone - Zone data
   * @returns {Array} Array of POIs
   */
  async searchWikidata(municipality, zone) {
    try {
      const pois = [];
      
      // Calculate center point for geographic search (use zone center if available)
      let centerLat = municipality.lat;
      let centerLng = municipality.lng;
      
      if (zone.boundingBox) {
        centerLat = (zone.boundingBox.north + zone.boundingBox.south) / 2;
        centerLng = (zone.boundingBox.east + zone.boundingBox.west) / 2;
      }
      
      Logger.debug(`🔍 Ricerca Wikidata per ${municipality.name} centrata su: ${centerLat}, ${centerLng}`);
      
      // SPARQL query to find heritage sites WITH GEOGRAPHIC DISTANCE FILTER (within 30km)
      const query = `
        SELECT ?item ?itemLabel ?location ?image WHERE {
          ?item wdt:P625 ?location .
          OPTIONAL { ?item wdt:P18 ?image . }
          
          # Filter for heritage/cultural sites
          { ?item wdt:P31/wdt:P279* wd:Q340169 . } # Historic monument
          UNION
          { ?item wdt:P31/wdt:P279* wd:Q226933 . } # Castle
          UNION
          { ?item wdt:P31/wdt:P279* wd:Q16970 . }  # Church
          UNION
          { ?item wdt:P31/wdt:P279* wd:Q33506 . }  # Museum
          UNION
          { ?item wdt:P31/wdt:P279* wd:Q619610 . } # Archaeological site
          
          # Geographic distance filter (within 30km of zone/municipality center)
          FILTER(geof:distance(?location, "Point(${centerLng} ${centerLat})"^^geo:wktLiteral) < 30000)
          
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en" . }
        }
        LIMIT 50
      `;
      
      await this.rateLimit();
      
      const response = await axios.get(this.wikidataUrl, {
        params: { query, format: 'json' },
        headers: {
          'User-Agent': 'Whatis Backend/1.0',
          'Accept': 'application/sparql-results+json'
        },
        timeout: 30000
      });
      
      const results = response.data.results.bindings;
      
      for (const result of results) {
        const name = result.itemLabel?.value;
        const location = result.location?.value;
        const image = result.image?.value;
        
        if (name && SemanticHelper.isMeaningfulPOIName(name)) {
                        // Parse location (format: Point(lng lat))
              let lat, lng;
              if (location) {
                const coords = location.match(/Point\(([-.\d]+) ([-.\d]+)\)/);
                if (coords) {
                  lng = parseFloat(coords[1]);
                  lat = parseFloat(coords[2]);
                }
              }
              
              // If no valid coordinates, skip this POI
              if (!lat || !lng) {
                Logger.debug(`POI ${name} senza coordinate valide, scartato`);
                continue;
              }
              
              // CRITICAL: Filter POI to be inside the zone polygon
              if (!this.isPointInZone({ lat, lng }, zone.coordinates)) {
                Logger.debug(`POI Wikidata ${name} fuori dalla zona, scartato`);
                continue;
              }
          
          pois.push({
            name: name,
            description: '',
            lat: lat,
            lng: lng,
            image: image || '',
            zone: zone.name,
            municipality: municipality.name,
            semanticCategory: 'heritage',
            source: 'Wikidata'
          });
        }
      }
      
      return pois;
      
    } catch (error) {
      Logger.warn(`Errore ricerca Wikidata: ${error.message}`);
      return [];
    }
  }

  /**
   * Search OSM for tourism POIs
   * @param {Object} municipality - Municipality data
   * @param {Object} zone - Zone data
   * @returns {Array} Array of POIs
   */
  async searchOSMTourism(municipality, zone) {
    try {
      // Use zone bounding box if available, otherwise fallback to municipality-centered box
      let bbox;
      if (zone.boundingBox) {
        // Use zone bounding box for accurate geographic filtering
        const bboxObj = zone.boundingBox;
        bbox = `${bboxObj.south},${bboxObj.west},${bboxObj.north},${bboxObj.east}`;
        Logger.debug(`🔍 Ricerca OSM per ${municipality.name} usando ZONE bounding box: ${bbox}`);
      } else {
        // Fallback to municipality-centered box
        const radius = 0.08; // ~8-9km radius
        bbox = this.calculateBbox(municipality.lat, municipality.lng, radius);
        Logger.debug(`🔍 Ricerca OSM per ${municipality.name} con fallback bbox: ${bbox}`);
      }
      
      const query = `
        [out:json][timeout:25];
        (
          node["tourism"~"^attraction$|^museum$|^viewpoint$"][name](${bbox});
          node["historic"~"^castle$|^monument$|^church$|^ruins$|^fort$|^tower$"][name](${bbox});
          way["tourism"~"^attraction$|^museum$"][name](${bbox});
          way["historic"~"^castle$|^monument$|^church$|^ruins$|^fort$|^tower$"][name](${bbox});
        );
        out center body;
      `;
      
      await this.rateLimit();
      
      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 30000
      });
      
      const pois = [];
      const elements = response.data.elements || [];
      
      Logger.debug(`📊 OSM restituito ${elements.length} elementi per ${municipality.name}`);
      
      for (const element of elements) {
        if (!element.tags || !element.tags.name) continue;
        
        const name = element.tags.name;
        
        if (!SemanticHelper.isMeaningfulPOIName(name)) continue;
        
        // Get coordinates
        let lat, lng;
        if (element.center) {
          lat = element.center.lat;
          lng = element.center.lon;
        } else if (element.lat && element.lon) {
          lat = element.lat;
          lng = element.lon;
        }
        
        if (!lat || !lng) continue;
        
        // CRITICAL: Filter POI to be inside the zone polygon
        if (!this.isPointInZone({ lat, lng }, zone.coordinates)) {
          Logger.debug(`❌ POI OSM ${name} fuori dalla zona, scartato`);
          continue;
        }
        
        // Determine category
        let category = 'other';
        if (element.tags.historic) category = element.tags.historic;
        else if (element.tags.tourism) category = element.tags.tourism;
        else if (element.tags.amenity === 'place_of_worship') category = 'church';
        
        pois.push({
          name: name,
          description: element.tags.description || '',
          lat: lat,
          lng: lng,
          zone: zone.name,
          municipality: municipality.name,
          semanticCategory: category,
          source: 'OSM'
        });
      }
      
      Logger.debug(`✅ POI OSM accettati: ${pois.length} su ${elements.length}`);
      return pois;
      
    } catch (error) {
      Logger.warn(`Errore ricerca OSM: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate bounding box for Overpass API
   * Format: (south,west,north,east) = (minLat,minLng,maxLat,maxLng)
   * @param {number} lat - Latitude (center)
   * @param {number} lng - Longitude (center)
   * @param {number} radius - Radius in degrees
   * @returns {string} Bounding box string (south,west,north,east)
   */
  calculateBbox(lat, lng, radius) {
    const south = lat - radius;
    const west = lng - radius;
    const north = lat + radius;
    const east = lng + radius;
    return `${south},${west},${north},${east}`;
  }

  /**
   * Rate limiting helper
   * @returns {Promise} Promise that resolves after delay
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }
}

module.exports = SemanticPOISearch;
