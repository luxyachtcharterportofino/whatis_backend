// ===============================
// 🧠 Wikipedia Smart POI Extractor
// Estrazione intelligente POI con AI semantica
// ===============================

const axios = require('axios');
const cheerio = require('cheerio');

class WikipediaSmartExtractor {
  constructor() {
    this.wikipediaUrl = 'https://it.wikipedia.org/api/rest_v1';
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.requestDelay = 1000;
    this.lastRequestTime = 0;
  }

  /**
   * Estrae POI intelligenti da Wikipedia per un municipio
   */
  async extractPOIs(municipality, zoneId, progressCallback = null) {
    try {
      this.log(`🧠 Inizio estrazione intelligente per: ${municipality.name}`);
      
      // Step 1: Scarica HTML Wikipedia
      this.updateProgress(progressCallback, 20, '📥 Download Wikipedia...', 'Scaricamento pagina HTML');
      const wikiHTML = await this.downloadWikipediaHTML(municipality.name);
      
      if (!wikiHTML) {
        this.log(`⚠️ Impossibile scaricare Wikipedia per ${municipality.name}`);
        return [];
      }
      
      // Step 2: Estrai sezioni rilevanti
      this.updateProgress(progressCallback, 40, '✂️ Estrazione sezioni...', 'Parsing contenuto strutturato');
      const relevantText = this.extractRelevantSections(wikiHTML);
      
      if (!relevantText || relevantText.length < 100) {
        this.log(`⚠️ Testo insufficiente estratta da Wikipedia per ${municipality.name}`);
        return [];
      }
      
      this.log(`📝 Testo estratto: ${relevantText.length} caratteri`);
      
      // Step 3: Analisi semantica con AI
      this.updateProgress(progressCallback, 60, '🤖 Analisi AI...', 'Estrazione semantica POI');
      const aiPOIs = await this.extractPOIsWithAI(relevantText, municipality.name);
      
      if (aiPOIs.length === 0) {
        this.log(`⚠️ AI non ha estratto POI, fallback a parsing manuale`);
        const manualPOIs = this.extractPOIsManually(relevantText, municipality, zoneId);
        return this.enrichWithCoordinates(manualPOIs, municipality);
      }
      
      // Step 4: Arricchimento con coordinate
      this.updateProgress(progressCallback, 80, '📍 Ricerca coordinate...', 'Geolocalizzazione POI');
      const enrichedPOIs = await this.enrichWithCoordinates(aiPOIs, municipality);
      
      this.log(`✅ Estrazione completata: ${enrichedPOIs.length} POI trovati`);
      return enrichedPOIs;
      
    } catch (error) {
      this.log(`❌ Errore estrazione: ${error.message}`);
      return [];
    }
  }

  /**
   * Scarica HTML Wikipedia per il municipio
   */
  async downloadWikipediaHTML(municipalityName) {
    try {
      await this.rateLimit();
      
      // Prova diverse varianti del nome
      const nameVariants = [
        municipalityName,
        `Comune di ${municipalityName}`,
        `${municipalityName} (Italia)`,
        `${municipalityName} (comune italiano)`
      ];
      
      for (const name of nameVariants) {
        try {
          const response = await axios.get(`${this.wikipediaUrl}/page/html/${encodeURIComponent(name)}`, {
            timeout: 15000
          });
          
          if (response.data && response.data.length > 5000) {
            this.log(`✅ Pagina Wikipedia trovata per: ${name}`);
            return response.data;
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      this.log(`⚠️ Errore download Wikipedia: ${error.message}`);
      return null;
    }
  }

  /**
   * Estrae sezioni rilevanti dall'HTML
   */
  extractRelevantSections(html) {
    try {
      const $ = cheerio.load(html);
      let text = '';
      
      // Sezioni da cercare
      const targetSections = [
        'Monumenti e luoghi d\'interesse',
        'Architetture religiose',
        'Architetture civili',
        'Architetture militari',
        'Fortificazioni',
        'Castelli',
        'Musei',
        'Parchi',
        'Aree naturali',
        'Spiagge'
      ];
      
      // Cerca tutti gli h2 e h3
      $('h2, h3').each((i, elem) => {
        const heading = $(elem).text().trim();
        
        // Se l'heading contiene una sezione target
        if (targetSections.some(section => heading.includes(section))) {
          // Prendi tutto il contenuto fino al prossimo h2/h3
          let next = $(elem).nextAll('h2, h3').first();
          
          $(elem).nextUntil(next).each((i, content) => {
            if ($(content).is('p, li')) {
              text += $(content).text() + ' ';
            }
          });
        }
      });
      
      // Se non ha trovato sezioni specifiche, prendi tutto il testo
      if (text.length < 200) {
        $('p, li').each((i, elem) => {
          text += $(elem).text() + ' ';
        });
      }
      
      return text.trim();
    } catch (error) {
      this.log(`⚠️ Errore parsing HTML: ${error.message}`);
      return '';
    }
  }

  /**
   * Estrae POI usando AI
   */
  async extractPOIsWithAI(text, municipalityName) {
    if (!this.openaiApiKey) {
      this.log(`⚠️ OPENAI_API_KEY non configurata, uso estrazione manuale`);
      return [];
    }
    
    try {
      await this.rateLimit();
      
      const prompt = `Analizza il seguente testo di Wikipedia riguardante "${municipalityName}" ed estrai TUTTI i luoghi di interesse (POI) culturali, storici, religiosi o naturali.

IMPORTANTE:
- Estrai SOLO nomi completi di POI specifici (es. "Castello di Lerici", "Villa Magni", "Chiesa di San Francesco")
- Escludi generici come "panorama", "vista", "mare", "borgo", numeri romani/arabi
- Per ogni POI fornisci: nome, categoria (Chiesa/Castello/Villa/Museo/Spiaggia/Monumento), descrizione breve 50-100 parole
- Formato output: JSON array con campi: name, category, description

TESTO:
${text.substring(0, 8000)}

Rispondi SOLO con JSON valido, nessun altro testo.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Sei un esperto di turismo italiano. Estrai Points of Interest da testi Wikipedia.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      const aiContent = response.data?.choices?.[0]?.message?.content;
      if (!aiContent) return [];
      
      // Estrai JSON dalla risposta
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      
      const pois = JSON.parse(jsonMatch[0]);
      
      return pois.map(poi => ({
        name: poi.name,
        category: this.mapCategory(poi.category),
        description: poi.description || '',
        lat: null,
        lng: null,
        source: 'Wikipedia+AI',
        extraInfo: {
          aiGenerated: true,
          confidence: 85
        }
      }));
      
    } catch (error) {
      this.log(`⚠️ Errore AI: ${error.message}`);
      return [];
    }
  }

  /**
   * Estrae POI manualmente (fallback)
   */
  extractPOIsManually(text, municipality, zoneId) {
    const pois = [];
    const keywords = {
      'Chiesa': 'Religion',
      'Basilica': 'Religion',
      'Oratorio': 'Religion',
      'Santuario': 'Religion',
      'Castello': 'Monument / Architecture',
      'Forte': 'Monument / Architecture',
      'Torre': 'Monument / Architecture',
      'Villa': 'Monument / Architecture',
      'Palazzo': 'Monument / Architecture',
      'Museo': 'Museum / Culture',
      'Spiaggia': 'Nature / Landscape',
      'Parco': 'Nature / Landscape'
    };
    
    for (const [keyword, category] of Object.entries(keywords)) {
      const regex = new RegExp(`${keyword}\\s+(?:di|di |del |della |dei )?([A-ZÀ-Ÿ][a-zÀ-Ÿ\\s']{2,40})`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const poiName = match[0].trim();
        
        if (poiName.length > 8 && poiName.length < 100) {
          pois.push({
            name: poiName,
            category,
            description: `Luogo di interesse di ${municipality.name} citato su Wikipedia`,
            lat: null,
            lng: null,
            municipality: municipality.name,
            source: 'Wikipedia',
            extraInfo: {
              confidence: 60
            }
          });
        }
      }
    }
    
    return pois;
  }

  /**
   * Arricchisce POI con coordinate
   */
  async enrichWithCoordinates(pois, municipality) {
    for (const poi of pois) {
      try {
        await this.rateLimit();
        
        // Cerca coordinate su Nominatim
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: `${poi.name}, ${municipality.name}, Italia`,
            format: 'json',
            limit: 1,
            addressdetails: 1
          },
          timeout: 5000,
          headers: {
            'User-Agent': 'WhatisApp/1.0'
          }
        });
        
        if (response.data?.length > 0) {
          poi.lat = parseFloat(response.data[0].lat);
          poi.lng = parseFloat(response.data[0].lon);
        }
      } catch (e) {
        // Coordinati rimangono null
      }
    }
    
    return pois;
  }

  /**
   * Mappa categoria da AI a standard
   */
  mapCategory(aiCategory) {
    const mapping = {
      'Chiesa': 'Religion',
      'Castello': 'Monument / Architecture',
      'Villa': 'Monument / Architecture',
      'Museo': 'Museum / Culture',
      'Spiaggia': 'Nature / Landscape',
      'Monumento': 'Monument / Architecture'
    };
    
    return mapping[aiCategory] || 'Cultural / Event place';
  }

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - elapsed));
    }
    
    this.lastRequestTime = Date.now();
  }

  log(message) {
    console.log(`[WIKI-SMART] ${message}`);
  }

  updateProgress(callback, percent, title, message) {
    if (callback) callback(percent, title, message);
  }
}

module.exports = WikipediaSmartExtractor;
