// ===============================
// 🗺️ OpenStreetMap Provider
// Gestisce le query OSM con rate limiting e retry
// ===============================

const axios = require('axios');

class OSMProvider {
  constructor() {
    this.baseUrl = 'https://overpass-api.de/api/interpreter';
    this.requestDelay = 2000; // 2 secondi tra richieste
    this.maxRetries = 3;
    this.userAgent = 'WhatisBackend/1.0 (Educational Research)';
    this.lastRequest = 0;
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();
  }

  async queryOverpass(query, retryCount = 0) {
    try {
      await this.waitForRateLimit();
      
      const response = await axios.get(this.baseUrl, {
        params: { data: query },
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000
      });

      if (response.data && response.data.elements) {
        return response.data.elements;
      }
      return [];
    } catch (error) {
      console.log(`❌ OSM query attempt ${retryCount + 1} failed: ${error.response?.status} ${error.message}`);
      
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.queryOverpass(query, retryCount + 1);
      }
      
      return [];
    }
  }

  buildSimpleQuery(bbox) {
    // Query molto semplificata per evitare timeout - una categoria alla volta
    return `
      [out:json][timeout:15];
      (
        node["tourism"="attraction"](${bbox});
        node["tourism"="museum"](${bbox});
        node["historic"](${bbox});
        node["amenity"="place_of_worship"](${bbox});
        node["natural"="beach"](${bbox});
        node["leisure"="marina"](${bbox});
        node["seamark:type"="lighthouse"](${bbox});
        node["building"="palace"](${bbox});
        node["building"="villa"](${bbox});
        node["historic"="castle"](${bbox});
        node["historic"="monastery"](${bbox});
        node["historic"="abbey"](${bbox});
        way["tourism"="attraction"](${bbox});
        way["tourism"="museum"](${bbox});
        way["historic"](${bbox});
        way["amenity"="place_of_worship"](${bbox});
        way["natural"="beach"](${bbox});
        way["leisure"="marina"](${bbox});
        way["building"="palace"](${bbox});
        way["building"="villa"](${bbox});
        way["historic"="castle"](${bbox});
        way["historic"="monastery"](${bbox});
        way["historic"="abbey"](${bbox});
      );
      out center meta;
    `.replace(/\s+/g, ' ').trim();
  }

  buildExtendedQuery(bbox) {
    // Query estesa per trovare più POI turistici + ricerca per nomi specifici
    return `
      [out:json][timeout:20];
      (
        // Query originale estesa
        node["tourism"](${bbox});
        node["historic"](${bbox});
        node["amenity"](${bbox});
        node["natural"](${bbox});
        node["leisure"](${bbox});
        node["seamark"](${bbox});
        way["tourism"](${bbox});
        way["historic"](${bbox});
        way["amenity"](${bbox});
        way["natural"](${bbox});
        way["leisure"](${bbox});
        way["seamark"](${bbox});
        
        // Ricerca per nomi specifici famosi del Tigullio
        node["name"~"Cervara",i](${bbox});
        node["name"~"Durazzo",i](${bbox});
        node["name"~"San Fruttuoso",i](${bbox});
        node["name"~"Portofino",i](${bbox});
        node["name"~"Rapallo",i](${bbox});
        node["name"~"Santa Margherita",i](${bbox});
        node["name"~"Chiavari",i](${bbox});
        node["name"~"Sestri",i](${bbox});
        way["name"~"Cervara",i](${bbox});
        way["name"~"Durazzo",i](${bbox});
        way["name"~"San Fruttuoso",i](${bbox});
        way["name"~"Portofino",i](${bbox});
        way["name"~"Rapallo",i](${bbox});
        way["name"~"Santa Margherita",i](${bbox});
        way["name"~"Chiavari",i](${bbox});
        way["name"~"Sestri",i](${bbox});
      );
      out center meta;
    `.replace(/\s+/g, ' ').trim();
  }

  async fetchPOIs(bbox) {
    console.log(`🗺️ Fetching OSM data for bbox: ${bbox}`);
    
    let elements = [];
    
    // Prova prima con query semplice
    console.log(`📋 Trying simple query...`);
    const simpleQuery = this.buildSimpleQuery(bbox);
    elements = await this.queryOverpass(simpleQuery);
    
    // Se trova pochi risultati, prova con query estesa
    if (elements.length < 10) {
      console.log(`📋 Found only ${elements.length} POIs, trying extended query...`);
      const extendedQuery = this.buildExtendedQuery(bbox);
      const extendedElements = await this.queryOverpass(extendedQuery);
      elements = [...elements, ...extendedElements];
      
      // Rimuovi duplicati basati su ID
      const uniqueElements = elements.reduce((acc, element) => {
        if (!acc.find(e => e.id === element.id)) {
          acc.push(element);
        }
        return acc;
      }, []);
      elements = uniqueElements;
    }
    
    const pois = elements.map(element => {
      const tags = element.tags || {};
      const lat = element.lat || (element.center && element.center.lat);
      const lon = element.lon || (element.center && element.center.lon);
      
      if (!lat || !lon) return null;

      return {
        name: tags.name || this.generatePOIName(tags),
        lat: parseFloat(lat),
        lng: parseFloat(lon),
        category: this.categorizePOI(tags),
        tags: tags,
        source: 'osm',
        osmId: element.id
      };
    }).filter(poi => poi && poi.name !== 'POI senza nome');

    console.log(`✅ Found ${pois.length} POIs from OSM`);
    return pois;
  }

  generatePOIName(tags) {
    // Genera nomi più specifici per POI senza nome
    if (tags.tourism === 'museum') return 'Museo';
    if (tags.tourism === 'attraction') return 'Attrazione turistica';
    if (tags.historic === 'monument') return 'Monumento storico';
    if (tags.historic === 'castle') return 'Castello';
    if (tags.historic === 'church') return 'Chiesa';
    if (tags.amenity === 'place_of_worship') return 'Luogo di culto';
    if (tags.natural === 'beach') return 'Spiaggia';
    if (tags.leisure === 'marina') return 'Marina';
    if (tags['seamark:type'] === 'lighthouse') return 'Faro';
    if (tags.amenity === 'restaurant') return 'Ristorante';
    if (tags.amenity === 'hotel') return 'Hotel';
    
    return 'POI senza nome';
  }

  categorizePOI(tags) {
    // Tourism tags
    if (tags.tourism === 'museum') return 'museum';
    if (tags.tourism === 'attraction') return 'monument';
    if (tags.tourism === 'hotel') return 'hotel';
    if (tags.tourism === 'restaurant') return 'restaurant';
    if (tags.tourism === 'viewpoint') return 'viewpoint';
    
    // Historic tags
    if (tags.historic === 'monument') return 'monument';
    if (tags.historic === 'castle') return 'monument';
    if (tags.historic === 'church') return 'church';
    if (tags.historic === 'chapel') return 'church';
    if (tags.historic === 'ruins') return 'monument';
    
    // Amenity tags
    if (tags.amenity === 'place_of_worship') return 'church';
    if (tags.amenity === 'restaurant') return 'restaurant';
    if (tags.amenity === 'hotel') return 'hotel';
    if (tags.amenity === 'arts_centre') return 'museum';
    if (tags.amenity === 'theatre') return 'monument';
    if (tags.amenity === 'cinema') return 'monument';
    
    // Natural tags
    if (tags.natural === 'beach') return 'beach';
    if (tags.natural === 'cliff') return 'viewpoint';
    if (tags.natural === 'bay') return 'beach';
    if (tags.natural === 'cape') return 'viewpoint';
    
    // Leisure tags
    if (tags.leisure === 'marina') return 'marina';
    if (tags.leisure === 'park') return 'park';
    if (tags.leisure === 'nature_reserve') return 'park';
    
    // Seamark tags (maritime)
    if (tags['seamark:type'] === 'lighthouse') return 'lighthouse';
    if (tags.seamark) return 'lighthouse'; // Generic seamark
    
    return 'other';
  }
}

module.exports = OSMProvider;
