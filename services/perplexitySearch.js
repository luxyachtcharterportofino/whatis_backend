// ===============================
// 🔍 Perplexity Search Module
// Servizio per ricerca POI terrestri e marini tramite Perplexity API
// ===============================

const axios = require('axios');
const Logger = require('../utils/logger');

class PerplexitySearchService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.enabled = process.env.PERPLEXITY_ENABLED === 'true';
    this.apiUrl = 'https://api.perplexity.ai/chat/completions';
    this.model = 'llama-3.1-sonar-large-128k-online'; // Modello con accesso web
    
    // Timeout per le chiamate API
    this.timeout = 30000; // 30 secondi
  }

  /**
   * Verifica se il servizio è disponibile
   */
  isAvailable() {
    return this.enabled && this.apiKey.length > 0;
  }

  /**
   * Genera prompt per POI terrestri
   */
  generateTerrestrialPrompt(zoneName, coordinates, municipality = null) {
    const center = this.calculateCenter(coordinates);
    
    // Costruisci contesto geografico
    let locationContext = `zona "${zoneName}"`;
    if (municipality) {
      locationContext = `Comune di ${municipality}, nella zona "${zoneName}"`;
    }
    
    return `Trova i principali punti di interesse (POI) turistici, culturali, storici, naturali, esperienziali e panoramici nel ${locationContext} (coordinate approssimative: lat ${center.lat.toFixed(4)}, lng ${center.lng.toFixed(4)}).

${municipality ? `FOCUS PRIORITARIO: Concentrati sui POI che si trovano specificamente nel Comune di ${municipality}.` : ''}

Rispondi SOLO in formato JSON valido, senza testo aggiuntivo, con questo schema esatto:

{
  "pois": [
    {
      "name": "Nome del POI",
      "category": "monument|church|viewpoint|museum|park|villa|other",
      "lat": 44.1234,
      "lng": 9.5678,
      "description": "Descrizione breve e interessante del POI (max 200 caratteri)"
    }
  ]
}

IMPORTANTE:
- Fornisci coordinate geografiche precise (lat, lng) per ogni POI
- La categoria deve essere una delle seguenti: monument, church, viewpoint, museum, park, villa, other
- La descrizione deve essere breve ma informativa
- Massimo 15 POI per zona
- ${municipality ? `Priorità ai POI nel Comune di ${municipality}` : ''}
- Rispondi SOLO con JSON valido, senza markdown, senza code blocks`;
  }

  /**
   * Genera prompt per POI marini
   */
  generateMarinePrompt(zoneName, coordinates, municipality = null) {
    const center = this.calculateCenter(coordinates);
    
    // Costruisci contesto geografico
    let locationContext = `zona "${zoneName}"`;
    if (municipality) {
      locationContext = `Comune di ${municipality}, nella zona "${zoneName}"`;
    }
    
    return `Quali relitti, secche, grotte marine, siti di immersione, punti di interesse subacquei si trovano nel ${locationContext} (coordinate approssimative: lat ${center.lat.toFixed(4)}, lng ${center.lng.toFixed(4)})?

${municipality ? `FOCUS PRIORITARIO: Concentrati sui siti marini che si trovano nelle acque del Comune di ${municipality}.` : ''}

Rispondi SOLO in formato JSON valido, senza testo aggiuntivo, con questo schema esatto:

{
  "pois": [
    {
      "name": "Nome del sito marino",
      "category": "wreck|biological|cave|beach|harbor",
      "lat": 44.1234,
      "lng": 9.5678,
      "depth": 25.5,
      "description": "Descrizione breve del sito marino (max 200 caratteri)"
    }
  ]
}

IMPORTANTE:
- Fornisci coordinate geografiche precise (lat, lng) per ogni sito
- La categoria deve essere: wreck (relitti), biological (siti biologici), cave (grotte), beach (spiagge), harbor (porti)
- La profondità (depth) è in metri, solo per relitti e siti subacquei
- La descrizione deve essere breve ma informativa
- Massimo 15 POI per zona
- ${municipality ? `Priorità ai siti marini nel Comune di ${municipality}` : ''}
- Rispondi SOLO con JSON valido, senza markdown, senza code blocks`;
  }

  /**
   * Calcola il centro di una zona dalle coordinate
   */
  calculateCenter(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return { lat: 44.303, lng: 9.209 }; // Default Portofino
    }

    const lats = coordinates.map(coord => 
      Array.isArray(coord) ? (coord[1] || coord[0]) : (coord.lat || coord[1])
    );
    const lngs = coordinates.map(coord => 
      Array.isArray(coord) ? (coord[0] || coord[1]) : (coord.lng || coord[0])
    );

    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
    };
  }

  /**
   * Cerca POI terrestri per una zona
   */
  async searchTerrestrialPOIs(zoneName, coordinates, municipality = null) {
    try {
      if (!this.isAvailable()) {
        Logger.warn('Perplexity API non disponibile, uso modalità MOCK');
        return this.getMockTerrestrialPOIs(zoneName, coordinates);
      }

      const prompt = this.generateTerrestrialPrompt(zoneName, coordinates, municipality);
      const response = await this.callPerplexityAPI(prompt);
      
      if (!response) {
        Logger.warn('Risposta Perplexity vuota, uso modalità MOCK');
        return this.getMockTerrestrialPOIs(zoneName, coordinates);
      }

      const pois = this.parseAndValidateResponse(response);
      return this.normalizePOIs(pois, 'terrestrial');

    } catch (error) {
      Logger.error('Errore ricerca POI terrestri Perplexity:', error);
      Logger.warn('Fallback a modalità MOCK');
      return this.getMockTerrestrialPOIs(zoneName, coordinates);
    }
  }

  /**
   * Cerca POI marini per una zona
   */
  async searchMarinePOIs(zoneName, coordinates, municipality = null) {
    try {
      if (!this.isAvailable()) {
        Logger.warn('Perplexity API non disponibile, uso modalità MOCK');
        return this.getMockMarinePOIs(zoneName, coordinates);
      }

      const prompt = this.generateMarinePrompt(zoneName, coordinates, municipality);
      const response = await this.callPerplexityAPI(prompt);
      
      if (!response) {
        Logger.warn('Risposta Perplexity vuota, uso modalità MOCK');
        return this.getMockMarinePOIs(zoneName, coordinates);
      }

      const pois = this.parseAndValidateResponse(response);
      return this.normalizePOIs(pois, 'marine');

    } catch (error) {
      Logger.error('Errore ricerca POI marini Perplexity:', error);
      Logger.warn('Fallback a modalità MOCK');
      return this.getMockMarinePOIs(zoneName, coordinates);
    }
  }

  /**
   * Chiama l'API Perplexity
   */
  async callPerplexityAPI(prompt) {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Sei un assistente esperto di geografia e turismo. Fornisci sempre risposte in formato JSON valido, senza testo aggiuntivo.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Bassa temperatura per risposte più precise
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      }

      return null;

    } catch (error) {
      Logger.error('Errore chiamata Perplexity API:', error.message);
      if (error.response) {
        Logger.error('Status:', error.response.status);
        Logger.error('Data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Parsa e valida la risposta JSON da Perplexity
   */
  parseAndValidateResponse(responseText) {
    try {
      // Rimuovi eventuali markdown code blocks
      let cleaned = responseText.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '');
      cleaned = cleaned.replace(/^```\s*/i, '');
      cleaned = cleaned.replace(/\s*```$/i, '');
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      
      if (!parsed.pois || !Array.isArray(parsed.pois)) {
        Logger.warn('Risposta Perplexity non contiene array pois');
        return [];
      }

      return parsed.pois;

    } catch (error) {
      Logger.error('Errore parsing risposta Perplexity:', error.message);
      Logger.debug('Risposta originale:', responseText);
      return [];
    }
  }

  /**
   * Normalizza i POI nel formato standard del backend
   */
  normalizePOIs(pois, type = 'terrestrial') {
    const normalized = [];

    for (const poi of pois) {
      try {
        // Validazione campi obbligatori
        if (!poi.name || !poi.lat || !poi.lng) {
          Logger.warn(`POI saltato per campi mancanti:`, poi);
          continue;
        }

        // Normalizza categoria
        const category = this.normalizeCategory(poi.category, type);
        
        // Normalizza coordinate
        const lat = parseFloat(poi.lat);
        const lng = parseFloat(poi.lng);
        
        if (isNaN(lat) || isNaN(lng)) {
          Logger.warn(`POI saltato per coordinate invalide:`, poi);
          continue;
        }

        const normalizedPOI = {
          name: poi.name.trim(),
          description: (poi.description || '').trim(),
          lat: lat,
          lng: lng,
          category: category,
          source: 'perplexity',
          semanticCategory: type === 'marine' ? 'marine' : 'terrestrial',
          extraInfo: {
            aiSummary: poi.description || '',
            tags: []
          }
        };

        // Aggiungi profondità per POI marini
        if (type === 'marine' && poi.depth !== undefined) {
          normalizedPOI.extraInfo.depth = parseFloat(poi.depth);
        }

        normalized.push(normalizedPOI);

      } catch (error) {
        Logger.error('Errore normalizzazione POI:', error);
        continue;
      }
    }

    return normalized;
  }

  /**
   * Normalizza la categoria POI
   */
  normalizeCategory(category, type) {
    const validCategories = [
      'monument', 'church', 'marina', 'beach', 'biological',
      'wreck', 'viewpoint', 'village', 'event', 'restaurant',
      'hotel', 'museum', 'park', 'harbor', 'lighthouse',
      'cave', 'mountain', 'lake', 'river', 'villa', 'other'
    ];

    if (!category) {
      return type === 'marine' ? 'wreck' : 'other';
    }

    const normalized = category.toLowerCase().trim();
    
    if (validCategories.includes(normalized)) {
      return normalized;
    }

    // Mapping categorie comuni
    const categoryMap = {
      'monumento': 'monument',
      'chiesa': 'church',
      'relitto': 'wreck',
      'panorama': 'viewpoint',
      'museo': 'museum',
      'parco': 'park',
      'porto': 'harbor',
      'faro': 'lighthouse',
      'grotta': 'cave',
      'montagna': 'mountain',
      'lago': 'lake',
      'fiume': 'river',
      'villa': 'villa',
      'spiaggia': 'beach'
    };

    return categoryMap[normalized] || 'other';
  }

  /**
   * POI MOCK per terrestri (usato quando API non disponibile)
   */
  getMockTerrestrialPOIs(zoneName, coordinates) {
    const center = this.calculateCenter(coordinates);
    
    Logger.info(`Generazione MOCK POI terrestri per zona: ${zoneName}`);
    
    // POI mock generici basati sulla zona
    const mockPOIs = [
      {
        name: `Punto Panoramico - ${zoneName}`,
        description: `Uno splendido punto panoramico che offre viste mozzafiato sulla zona di ${zoneName}`,
        lat: center.lat + 0.001,
        lng: center.lng + 0.001,
        category: 'viewpoint',
        source: 'perplexity',
        semanticCategory: 'terrestrial',
        extraInfo: {
          aiSummary: `Punto panoramico nella zona di ${zoneName}`,
          tags: ['panorama', 'vista']
        }
      },
      {
        name: `Chiesa Storica - ${zoneName}`,
        description: `Un importante edificio religioso che testimonia la storia di ${zoneName}`,
        lat: center.lat - 0.001,
        lng: center.lng - 0.001,
        category: 'church',
        source: 'perplexity',
        semanticCategory: 'terrestrial',
        extraInfo: {
          aiSummary: `Chiesa storica nella zona di ${zoneName}`,
          tags: ['storia', 'religione']
        }
      }
    ];

    return mockPOIs;
  }

  /**
   * POI MOCK per marini (usato quando API non disponibile)
   */
  getMockMarinePOIs(zoneName, coordinates) {
    const center = this.calculateCenter(coordinates);
    
    Logger.info(`Generazione MOCK POI marini per zona: ${zoneName}`);
    
    const mockPOIs = [
      {
        name: `Sito di Immersione - ${zoneName}`,
        description: `Un interessante sito di immersione nella zona di ${zoneName}`,
        lat: center.lat + 0.002,
        lng: center.lng + 0.002,
        category: 'wreck',
        source: 'perplexity',
        semanticCategory: 'marine',
        extraInfo: {
          aiSummary: `Sito di immersione nella zona di ${zoneName}`,
          depth: 25,
          tags: ['immersione', 'subacqueo']
        }
      }
    ];

    return mockPOIs;
  }
}

module.exports = PerplexitySearchService;

