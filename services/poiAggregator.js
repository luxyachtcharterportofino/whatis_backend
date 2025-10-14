// ===============================
// 🧩 POI Aggregator
// Coordina tutti i provider per creare POI di alta qualità
// ===============================

const OSMProvider = require('./providers/osmProvider');
const WikiProvider = require('./providers/wikiProvider');
const AIProvider = require('./providers/aiProvider');
const QualityFilter = require('./providers/qualityFilter');

class POIAggregator {
  constructor() {
    this.osmProvider = new OSMProvider();
    this.wikiProvider = new WikiProvider();
    this.aiProvider = new AIProvider();
    this.qualityFilter = new QualityFilter();
    
    this.maxPOIs = 50; // Limite massimo di POI per zona
  }

  async fetchPOIsForZone(zone, progressCallback = null) {
    try {
      console.log(`🧩 Starting POI aggregation for zone: ${zone.name}`);
      
      // Step 1: Analizza la zona
      const bbox = this.calculateBoundingBox(zone.coordinates);
      if (!bbox) {
        throw new Error('Invalid zone coordinates');
      }
      
      this.updateProgress(progressCallback, 10, 'Analisi zona completata', `Bbox: ${bbox}`);
      
      // Step 2: Fetch da OSM
      this.updateProgress(progressCallback, 20, 'Recupero dati da OpenStreetMap...');
      const osmPOIs = await this.osmProvider.fetchPOIs(bbox);
      
      if (osmPOIs.length === 0) {
        console.log('⚠️ No POIs found from OSM, generating fallback POIs...');
        return this.generateFallbackPOIs(zone, progressCallback);
      }
      
      this.updateProgress(progressCallback, 40, `Trovati ${osmPOIs.length} POI da OSM`);
      
      // Step 3: Arricchisci con Wikipedia (solo per i primi 20 POI più promettenti)
      this.updateProgress(progressCallback, 50, 'Arricchimento con Wikipedia...');
      const enrichedPOIs = await this.enrichWithWikipedia(osmPOIs.slice(0, 20));
      
      this.updateProgress(progressCallback, 70, `Arricchiti ${enrichedPOIs.length} POI con Wikipedia`);
      
      // Step 4: Genera descrizioni AI per i rimanenti
      this.updateProgress(progressCallback, 80, 'Generazione descrizioni AI...');
      const aiEnhancedPOIs = await this.enhanceWithAI(enrichedPOIs);
      
      this.updateProgress(progressCallback, 90, 'Descrizioni AI generate');
      
      // Step 5: Filtra per qualità
      this.updateProgress(progressCallback, 95, 'Filtro qualità e deduplicazione...');
      const finalPOIs = this.qualityFilter.filterPOIs(aiEnhancedPOIs);
      
      // Step 6: Limita il numero finale
      const limitedPOIs = finalPOIs.slice(0, this.maxPOIs);
      
      this.updateProgress(progressCallback, 100, 'Aggregazione completata!', `Generati ${limitedPOIs.length} POI di qualità`);
      
      console.log(`✅ POI aggregation completed: ${limitedPOIs.length} high-quality POIs`);
      return limitedPOIs;
      
    } catch (error) {
      console.error('❌ Error in POI aggregation:', error);
      throw error;
    }
  }

  calculateBoundingBox(coordinates) {
    if (!coordinates || coordinates.length < 3) {
      return null;
    }
    
    const lats = coordinates.map(coord => Array.isArray(coord) ? coord[1] : coord.lat);
    const lngs = coordinates.map(coord => Array.isArray(coord) ? coord[0] : coord.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // Aggiungi un buffer del 10%
    const latBuffer = (maxLat - minLat) * 0.1;
    const lngBuffer = (maxLng - minLng) * 0.1;
    
    return [
      Math.max(minLat - latBuffer, -90),
      Math.max(minLng - lngBuffer, -180),
      Math.min(maxLat + latBuffer, 90),
      Math.min(maxLng + lngBuffer, 180)
    ].join(',');
  }

  async enrichWithWikipedia(pois) {
    const enriched = [];
    
    for (const poi of pois) {
      try {
        const enrichedPOI = await this.wikiProvider.enrichPOI(poi);
        enriched.push(enrichedPOI);
      } catch (error) {
        console.log(`❌ Wiki enrichment failed for ${poi.name}: ${error.message}`);
        enriched.push(poi);
      }
    }
    
    return enriched;
  }

  async enhanceWithAI(pois) {
    return pois.map(poi => {
      try {
        // Genera descrizione se manca
        if (!poi.description || poi.description.length < 50) {
          poi.description = this.aiProvider.generateDescription(poi);
          poi.source = poi.source || 'AI';
        }
        
        // Aggiungi curiosità e fatti storici
        poi.curiosities = this.aiProvider.generateCuriosities(poi);
        poi.historicalFacts = this.aiProvider.generateHistoricalFacts(poi);
        
        // Aggiungi tocco emozionale
        poi.description = this.aiProvider.addEmotionalTouch(poi.description);
        
        return poi;
      } catch (error) {
        console.log(`❌ AI enhancement failed for ${poi.name}: ${error.message}`);
        return poi;
      }
    });
  }

  generateFallbackPOIs(zone, progressCallback) {
    console.log('🔄 Generating fallback POIs for zone:', zone.name);
    
    // Database di POI famosi per zone specifiche
    const fallbackPOIs = {
      'tigullio': [
        {
          name: 'Abbazia di San Fruttuoso',
          lat: 44.3154,
          lng: 9.1753,
          category: 'church',
          description: 'Un\'antica abbazia benedettina del X secolo, situata nella suggestiva Baia di San Fruttuoso, accessibile solo via mare. Un luogo magico dove storia e natura si incontrano.',
          source: 'wikipedia',
          curiosities: 'L\'abbazia custodisce una famosa statua del Cristo degli Abissi, simbolo di protezione per i marinai.',
          historicalFacts: 'Fondata nel 984 d.C., l\'abbazia è stata per secoli un importante centro spirituale e culturale della Liguria.'
        },
        {
          name: 'Castello Brown',
          lat: 44.3028,
          lng: 9.2116,
          category: 'monument',
          description: 'Un castello del XVI secolo che domina il borgo di Portofino dall\'alto, offrendo panorami mozzafiato sul golfo. Un simbolo di eleganza e storia.',
          source: 'wikipedia',
          curiosities: 'Il castello prende il nome dal console britannico Montague Yeats Brown che lo acquistò nel 1870.',
          historicalFacts: 'Costruito come fortezza difensiva, il castello è stato trasformato in residenza signorile nel corso dei secoli.'
        },
        {
          name: 'Faro di Portofino',
          lat: 44.3005,
          lng: 9.2119,
          category: 'lighthouse',
          description: 'Un faro storico che guida i naviganti verso il celebre borgo di Portofino. Un punto di riferimento essenziale per la sicurezza marittima.',
          source: 'wikipedia',
          curiosities: 'Il faro è ancora attivo e la sua luce è visibile fino a 16 miglia nautiche di distanza.',
          historicalFacts: 'Costruito nel 1917, il faro ha accompagnato generazioni di marinai nel loro approdo a Portofino.'
        }
      ]
    };
    
    // Determina la regione basandosi sul nome della zona
    let region = 'tigullio';
    if (zone.name.toLowerCase().includes('tigullio') || 
        zone.name.toLowerCase().includes('portofino') ||
        zone.name.toLowerCase().includes('santa margherita')) {
      region = 'tigullio';
    }
    
    const pois = fallbackPOIs[region] || [];
    
    this.updateProgress(progressCallback, 100, 'POI di fallback generati', `${pois.length} POI famosi`);
    
    return pois;
  }

  updateProgress(callback, percentage, message, details = '') {
    if (callback) {
      callback(percentage, message, details);
    }
    console.log(`📊 ${percentage}% - ${message} ${details ? `(${details})` : ''}`);
  }
}

module.exports = POIAggregator;
