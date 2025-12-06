// ===============================
// 🤖 GPT POI Generator Service
// Servizio per generazione POI tramite OpenAI GPT-4o
// ===============================

const axios = require('axios');
const Logger = require('../utils/logger');

class GPTPoiGenerator {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    // Usa GPT-4o se disponibile, altrimenti fallback a gpt-4-turbo
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.timeout = 60000; // 60 secondi per risposte più complesse
    
    if (!this.apiKey) {
      Logger.warn('⚠️ OPENAI_API_KEY non configurata - il servizio GPT non sarà disponibile');
    }
  }

  /**
   * Verifica se il servizio è disponibile
   */
  isAvailable() {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  /**
   * Genera prompt per POI terrestri
   */
  generateTerrestrialPrompt(zoneName, municipality, coordinates) {
    const center = this.calculateCenter(coordinates);
    
    return `Sei un esperto di turismo e geografia italiana, specializzato nella Riviera di Levante (Liguria).

Il tuo compito è trovare i principali punti di interesse (POI) turistici, culturali, storici, naturali, esperienziali e panoramici nel Comune di ${municipality}, nella zona "${zoneName}".

Coordinate approssimative della zona: latitudine ${center.lat.toFixed(4)}, longitudine ${center.lng.toFixed(4)}.

FOCUS PRIORITARIO: Concentrati esclusivamente sui POI che si trovano nel Comune di ${municipality}. I POI devono essere reali, verificabili e rilevanti per turisti e visitatori.

Rispondi SOLO con un JSON valido, senza testo aggiuntivo, senza markdown, senza code blocks, seguendo questo schema esatto:

{
  "pois": [
    {
      "name": "Nome completo e preciso del POI",
      "category": "monument|church|viewpoint|museum|park|villa|beach|harbor|other",
      "lat": 44.1234,
      "lng": 9.5678,
      "description": "Descrizione breve, interessante e informativa del POI (max 200 caratteri)",
      "tags": ["tag1", "tag2"],
      "confidence_score": 0.85
    }
  ]
}

REQUISITI OBBLIGATORI:
- Fornisci tra 10 e 25 POI (non meno, non di più)
- Fornisci coordinate geografiche precise (lat, lng) per ogni POI
- La categoria deve essere una delle seguenti: monument, church, viewpoint, museum, park, villa, beach, harbor, other
- La descrizione deve essere breve ma informativa (max 200 caratteri)
- Tutti i POI devono essere REALI e verificabili, NON inventati
- Tutti i POI devono essere nel Comune di ${municipality} - NON includere POI di comuni limitrofi
- Coordinate devono essere realistiche e coerenti con la zona (lat ~${center.lat.toFixed(2)}, lng ~${center.lng.toFixed(2)})
- Nomi dei POI devono essere precisi, completi e verificabili (es: "Castello Brown" non "Castello")
- Per ogni POI, assegna un confidence_score da 0.0 a 1.0 che indica quanto sei sicuro che esista realmente
- Rispondi SOLO con JSON valido, senza altro testo`;
  }

  /**
   * Genera prompt per POI marini
   */
  generateMarinePrompt(zoneName, municipality, coordinates) {
    const center = this.calculateCenter(coordinates);
    
    return `Sei un esperto di immersioni subacquee e siti marini della Riviera di Levante (Liguria).

Il tuo compito è trovare relitti, secche, grotte marine, siti di immersione e punti di interesse subacquei nelle acque del Comune di ${municipality}, nella zona "${zoneName}".

Coordinate approssimative della zona: latitudine ${center.lat.toFixed(4)}, longitudine ${center.lng.toFixed(4)}.

FOCUS PRIORITARIO: Concentrati esclusivamente sui siti marini che si trovano nelle acque del Comune di ${municipality}. I siti devono essere reali, verificabili e rilevanti per subacquei e appassionati di immersioni.

Rispondi SOLO con un JSON valido, senza testo aggiuntivo, senza markdown, senza code blocks, seguendo questo schema esatto:

{
  "pois": [
    {
      "name": "Nome completo e preciso del sito marino",
      "category": "wreck|biological|cave|beach|harbor",
      "lat": 44.1234,
      "lng": 9.5678,
      "depth": 25.5,
      "description": "Descrizione breve del sito marino (max 200 caratteri)",
      "tags": ["immersione", "subacqueo"],
      "confidence_score": 0.85
    }
  ]
}

REQUISITI OBBLIGATORI:
- Fornisci tra 10 e 25 siti (non meno, non di più)
- Fornisci coordinate geografiche precise (lat, lng) per ogni sito
- La categoria deve essere: wreck (relitti), biological (siti biologici), cave (grotte), beach (spiagge), harbor (porti)
- La profondità (depth) è in metri, solo per relitti e siti subacquei
- La descrizione deve essere breve ma informativa (max 200 caratteri)
- Tutti i siti devono essere REALI e verificabili, NON inventati
- Tutti i siti devono essere nelle acque del Comune di ${municipality} - NON includere siti di comuni limitrofi
- Coordinate devono essere realistiche e coerenti con la zona (lat ~${center.lat.toFixed(2)}, lng ~${center.lng.toFixed(2)})
- Nomi dei siti devono essere precisi, completi e verificabili
- Per ogni sito, assegna un confidence_score da 0.0 a 1.0 che indica quanto sei sicuro che esista realmente
- Rispondi SOLO con JSON valido, senza altro testo`;
  }

  /**
   * Calcola il centro di una zona dalle coordinate
   */
  calculateCenter(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return { lat: 44.303, lng: 9.209 }; // Default Portofino
    }

    // Gestisce diversi formati di coordinate
    const lats = coordinates.map(coord => {
      if (Array.isArray(coord)) {
        // Prova a capire se è [lat, lng] o [lng, lat]
        const val1 = coord[0];
        const val2 = coord[1] || coord[0];
        // Se il primo valore è > 90, probabilmente è lng
        return Math.abs(val1) > 90 ? val2 : val1;
      }
      return coord.lat || coord[1] || 44.303;
    });

    const lngs = coordinates.map(coord => {
      if (Array.isArray(coord)) {
        const val1 = coord[0];
        const val2 = coord[1] || coord[0];
        return Math.abs(val1) > 90 ? val1 : val2;
      }
      return coord.lng || coord[0] || 9.209;
    });

    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
    };
  }

  /**
   * Genera POI terrestri per una zona
   */
  async generateTerrestrialPOIs(zoneName, municipality, coordinates, customPrompt = null) {
    try {
      if (!this.isAvailable()) {
        Logger.error('OpenAI API non disponibile - OPENAI_API_KEY mancante');
        throw new Error('OpenAI API non configurata');
      }

      const prompt = customPrompt || this.generateTerrestrialPrompt(zoneName, municipality, coordinates);
      const response = await this.callOpenAIAPI(prompt);
      
      if (!response) {
        throw new Error('Risposta OpenAI vuota');
      }

      let pois = this.parseAndValidateResponse(response);
      
      // Verifica e pulizia con secondo prompt se ci sono troppi POI o sospetti
      if (pois.length > 25 || pois.some(p => (p.confidence_score || 0.5) < 0.6)) {
        Logger.info('🔍 Esecuzione verifica e pulizia POI con GPT...');
        pois = await this.verifyAndCleanPOIs(pois, zoneName, municipality, 'terrestrial');
      }
      
      return this.normalizePOIs(pois, 'terrestrial');

    } catch (error) {
      Logger.error('Errore generazione POI terrestri GPT:', error);
      throw error;
    }
  }

  /**
   * Genera POI marini per una zona
   */
  async generateMarinePOIs(zoneName, municipality, coordinates, customPrompt = null) {
    try {
      if (!this.isAvailable()) {
        Logger.error('OpenAI API non disponibile - OPENAI_API_KEY mancante');
        throw new Error('OpenAI API non configurata');
      }

      const prompt = customPrompt || this.generateMarinePrompt(zoneName, municipality, coordinates);
      const response = await this.callOpenAIAPI(prompt);
      
      if (!response) {
        throw new Error('Risposta OpenAI vuota');
      }

      let pois = this.parseAndValidateResponse(response);
      
      // Verifica e pulizia con secondo prompt se necessario
      if (pois.length > 25 || pois.some(p => (p.confidence_score || 0.5) < 0.6)) {
        Logger.info('🔍 Esecuzione verifica e pulizia POI marini con GPT...');
        pois = await this.verifyAndCleanPOIs(pois, zoneName, municipality, 'marine');
      }
      
      return this.normalizePOIs(pois, 'marine');

    } catch (error) {
      Logger.error('Errore generazione POI marini GPT:', error);
      throw error;
    }
  }

  /**
   * Verifica e pulisce POI con secondo prompt GPT
   */
  async verifyAndCleanPOIs(pois, zoneName, municipality, type) {
    try {
      const poisJson = JSON.stringify(pois, null, 2);
      
      const verificationPrompt = `Sei un verificatore esperto di punti di interesse turistici italiani.

Hai ricevuto una lista di ${pois.length} POI per il Comune di ${municipality}, zona "${zoneName}".

Il tuo compito è:
1. Rimuovere POI che NON esistono realmente o sono inventati
2. Rimuovere duplicati (stesso nome o nome molto simile)
3. Correggere categorie errate
4. Uniformare descrizioni (max 200 caratteri)
5. Mantenere solo POI con confidence_score >= 0.6
6. Mantenere massimo 25 POI

Lista POI da verificare:
${poisJson}

Rispondi SOLO con un JSON valido seguendo lo stesso schema, contenente SOLO i POI verificati e validi, senza testo aggiuntivo.`;

      const response = await this.callOpenAIAPI(verificationPrompt);
      
      if (!response) {
        Logger.warn('Verifica GPT fallita, uso POI originali');
        return pois;
      }

      const verifiedPOIs = this.parseAndValidateResponse(response);
      Logger.info(`✅ Verifica GPT: ${pois.length} → ${verifiedPOIs.length} POI validi`);
      
      return verifiedPOIs;

    } catch (error) {
      Logger.warn('Errore verifica GPT, uso POI originali:', error.message);
      return pois; // Fallback ai POI originali
    }
  }

  /**
   * Chiama l'API OpenAI
   */
  async callOpenAIAPI(prompt) {
    try {
      const requestData = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Sei un assistente esperto di geografia e turismo italiano. Fornisci sempre risposte in formato JSON valido, senza testo aggiuntivo, senza markdown, senza code blocks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Bassa temperatura per risposte più precise
        max_tokens: 3000, // Più token per risposte più complete
        response_format: { type: "json_object" } // Forza formato JSON (GPT-4o supporta questo)
      };

      // Log dettagliato per debug (solo se DEBUG_GPT=true)
      if (process.env.DEBUG_GPT === 'true') {
        Logger.info('📤 GPT Request:', {
          model: requestData.model,
          promptLength: prompt.length,
          promptPreview: prompt.substring(0, 200) + '...',
          temperature: requestData.temperature,
          maxTokens: requestData.max_tokens
        });
      }

      const response = await axios.post(
        this.apiUrl,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const content = response.data.choices[0].message.content;
        
        // Log dettagliato per debug
        if (process.env.DEBUG_GPT === 'true') {
          Logger.info('📥 GPT Response:', {
            status: response.status,
            responseLength: content.length,
            responsePreview: content.substring(0, 200) + '...',
            tokensUsed: response.data.usage?.total_tokens,
            promptTokens: response.data.usage?.prompt_tokens,
            completionTokens: response.data.usage?.completion_tokens
          });
        }

        return content;
      }

      return null;

    } catch (error) {
      Logger.error('Errore chiamata OpenAI API:', error.message);
      if (error.response) {
        Logger.error('Status:', error.response.status);
        Logger.error('Data:', JSON.stringify(error.response.data, null, 2));
        
        // Log dettagliato errori
        if (error.response.status === 401) {
          Logger.error('❌ API Key invalida o mancante. Verifica OPENAI_API_KEY nel .env');
        } else if (error.response.status === 429) {
          Logger.error('❌ Rate limit raggiunto. Attendi o verifica crediti account OpenAI');
        } else if (error.response.status === 500) {
          Logger.error('❌ Errore server OpenAI. Riprova più tardi');
        }
      }
      throw error;
    }
  }

  /**
   * Parsa e valida la risposta JSON da OpenAI
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
        Logger.warn('Risposta GPT non contiene array pois');
        return [];
      }

      return parsed.pois;

    } catch (error) {
      Logger.error('Errore parsing risposta GPT:', error.message);
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
          source: 'gpt',
          semanticCategory: type === 'marine' ? 'marine' : 'terrestrial',
          extraInfo: {
            aiSummary: poi.description || '',
            tags: poi.tags || []
          },
          confidence: poi.confidence_score || poi.confidence || 0.8 // Supporta sia confidence_score che confidence
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
}

module.exports = GPTPoiGenerator;

