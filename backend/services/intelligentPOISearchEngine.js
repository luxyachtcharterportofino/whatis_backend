// ===============================
// 🧠 Intelligent POI Search Engine
// Sistema multilivello per ricerca POI intelligente
// ===============================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class IntelligentPOISearchEngine {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/poiAutoSearch.log');
    
    // Overpass API mirrors list (multi-mirror retry)
    this.overpassMirrors = [
      { url: 'https://overpass-api.de/api/interpreter', name: 'api.de' },
      { url: 'https://overpass.openstreetmap.fr/api/interpreter', name: 'openstreetmap.fr' },
      { url: 'https://overpass.kumi.systems/api/interpreter', name: 'kumi.systems' },
      { url: 'https://overpass.nchc.org.tw/api/interpreter', name: 'nchc.org.tw' }
    ];
    
    // Configurazione API
    this.overpassUrl = this.overpassMirrors[0].url;
    this.wikidataUrl = 'https://query.wikidata.org/sparql';
    this.wikipediaUrl = 'https://it.wikipedia.org/api/rest_v1';
    this.wikimediaUrl = 'https://commons.wikimedia.org/api/rest_v1';
    
    // Rate limiting
    this.requestDelay = 1000; // 1 secondo tra le richieste
    this.lastRequestTime = 0;
    this.mirrorRetryDelay = 2000; // 2 seconds between mirror attempts
    
    // Inizializza estrattore smart
    try {
      const WikipediaSmartExtractor = require('./wikiSmartExtractor');
      this.smartExtractor = new WikipediaSmartExtractor();
    } catch (e) {
      this.smartExtractor = null;
    }
  }

  /**
   * Ricerca intelligente POI per municipio
   * @param {Object} municipality - Municipio selezionato
   * @param {Array} zoneCoordinates - Coordinate della zona
   * @param {Function} progressCallback - Callback per progresso
   * @returns {Array} Lista di POI arricchiti
   */
  async searchPOIsForMunicipality(municipality, zoneCoordinates, progressCallback = null) {
    const startTime = new Date();
    this.log(`🚀 Avvio ricerca intelligente POI per: ${municipality.name}`);
    
    try {
      const allPOIs = [];
      
      // Step 1: Ricerca Wikipedia/Wikidata (PRIORITÀ ALTA)
      this.updateProgress(progressCallback, 10, '📚 Ricerca Wikipedia/Wikidata...', 'Arricchimento con dati storici');
      const wikiPOIs = await this.searchWikipediaPOIs(municipality);
      allPOIs.push(...wikiPOIs);
      this.log(`📖 Wikipedia: trovati ${wikiPOIs.length} POI`);
      
      // Step 2: Ricerca siti istituzionali (PRIORITÀ ALTA)
      this.updateProgress(progressCallback, 30, '🏛️ Ricerca siti istituzionali...', 'Siti turistici e culturali');
      const institutionalPOIs = await this.searchInstitutionalPOIs(municipality);
      allPOIs.push(...institutionalPOIs);
      this.log(`🏛️ Siti istituzionali: trovati ${institutionalPOIs.length} POI`);
      
      // Step 3: Ricerca OpenStreetMap (FALLBACK)
      this.updateProgress(progressCallback, 50, '🗺️ Ricerca OpenStreetMap...', 'Estrazione POI culturali e storici');
      const osmPOIs = await this.searchOSMPOIs(municipality, zoneCoordinates);
      allPOIs.push(...osmPOIs);
      this.log(`📍 OSM: trovati ${osmPOIs.length} POI`);
      
      // Step 4: Deduplicazione e filtraggio
      this.updateProgress(progressCallback, 70, '🧹 Deduplicazione e filtraggio...', 'Rimozione duplicati e POI non validi');
      const filteredPOIs = await this.deduplicateAndFilterPOIs(allPOIs, municipality);
      this.log(`🧹 Dopo filtraggio: ${filteredPOIs.length} POI`);
      
      // Step 5: Arricchimento AI delle descrizioni
      this.updateProgress(progressCallback, 80, '🤖 Arricchimento AI...', 'Generazione descrizioni dettagliate');
      const aiEnrichedPOIs = await this.enrichPOIsWithAIDescriptions(filteredPOIs, municipality);
      this.log(`🤖 POI arricchiti con AI: ${aiEnrichedPOIs.length}`);
      
      // Step 6: Arricchimento finale (immagini)
      this.updateProgress(progressCallback, 90, '✨ Arricchimento finale...', 'Immagini e metadati');
      const enrichedPOIs = await this.enrichPOIsWithImagesAndDescriptions(aiEnrichedPOIs);
      this.log(`✨ POI arricchiti: ${enrichedPOIs.length}`);
      
      // Step 7: Categorizzazione semantica
      this.updateProgress(progressCallback, 95, '🏷️ Categorizzazione semantica...', 'Classificazione intelligente');
      const categorizedPOIs = this.categorizePOIsSemantically(enrichedPOIs);
      
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      this.log(`✅ Ricerca completata in ${duration}s: ${categorizedPOIs.length} POI finali`);
      
      return categorizedPOIs;
      
    } catch (error) {
      this.log(`❌ Errore ricerca POI per ${municipality.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ricerca POI da OpenStreetMap (solo culturali, storici, naturali)
   */
  async searchOSMPOIs(municipality, zoneCoordinates) {
    try {
      this.log(`🔍 START searchOSMPOIs per ${municipality.name}`);
      this.log(`   municipality.lat: ${municipality.lat}, municipality.lng: ${municipality.lng}`);
      this.log(`   zoneCoordinates: ${JSON.stringify(zoneCoordinates)}`);
      
      // Crea un bounding box più piccolo intorno al municipio specifico
      let bbox;
      
      if (municipality.lat && municipality.lng) {
        // Usa le coordinate del municipio per creare un bounding box più preciso
        // Format: minLon,minLat,maxLon,maxLat
        const margin = 0.1; // Circa 10km di margine
        const minLon = municipality.lng - margin;
        const minLat = municipality.lat - margin;
        const maxLon = municipality.lng + margin;
        const maxLat = municipality.lat + margin;
        bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
        this.log(`📍 Ricerca POI per municipio ${municipality.name} con bounding box: ${bbox}`);
      } else {
        // Fallback al bounding box della zona
        bbox = this.calculateBoundingBox(zoneCoordinates);
        this.log(`⚠️ Coordinate municipio non disponibili, uso bounding box della zona: ${bbox}`);
      }
      
      if (!bbox) {
        this.log(`❌ Bbox non valido, ritorno array vuoto`);
        return [];
      }

      this.log(`✅ Chiamata searchOSMPOIsWithBbox con bbox: ${bbox}`);
      const result = await this.searchOSMPOIsWithBbox(bbox, municipality);
      this.log(`✅ searchOSMPOIsWithBbox ha restituito ${result.length} POI`);
      return result;

    } catch (error) {
      this.log(`❌ Errore ricerca OSM: ${error.message}`);
      this.log(`❌ Stack trace: ${error.stack}`);
      return [];
    }
  }

  /**
   * Fallback OSM search (solo se Deep Context non ha trovato abbastanza POI)
   */
  async searchOSMPOIsFallback(municipality, zoneCoordinates) {
    this.log(`🗺️ Fallback OSM attivato per ${municipality.name}`);
    return this.searchOSMPOIs(municipality, zoneCoordinates);
  }


  /**
   * Ricerca POI con bounding box
   */
  /**
   * Fetch from Overpass API with multi-mirror retry
   * Tries each mirror in order until one succeeds
   */
  async fetchOverpassSafely(query) {
    for (let i = 0; i < this.overpassMirrors.length; i++) {
      const mirror = this.overpassMirrors[i];
      const startTime = Date.now();
      
      try {
        this.log(`[INFO] Trying mirror #${i + 1} (${mirror.name})...`);
        
        const response = await axios.post(mirror.url, query, {
          headers: { 'Content-Type': 'text/plain' },
          timeout: 60000 // Extended timeout for large queries
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
    this.log(`❌ All Overpass mirrors failed. Fallback to Wikipedia/Wikidata only.`);
    return null;
  }

  async searchOSMPOIsWithBbox(bbox, municipality) {
    try {
      this.log(`🔍 START searchOSMPOIsWithBbox con bbox: ${bbox}`);
      
      // Query OSM per POI culturali, storici e naturali (NO commerciali)
      // ESPANSIVA: Include castelli, fortezze, ville, torri, architettura militare, architettura civile
      const query = `
        [out:json][timeout:45];
        (
          // Luoghi di culto
          node["amenity"="place_of_worship"](${bbox});
          way["amenity"="place_of_worship"](${bbox});
          relation["amenity"="place_of_worship"](${bbox});
          
          // Monumenti e memoriali (TUTTI i tipi)
          node["historic"](${bbox});
          way["historic"](${bbox});
          relation["historic"](${bbox});
          
          // Musei e cultura
          node["tourism"="museum"](${bbox});
          way["tourism"="museum"](${bbox});
          relation["tourism"="museum"](${bbox});
          
          // Castelli e fortezze
          node["historic"="castle"](${bbox});
          way["historic"="castle"](${bbox});
          relation["historic"="castle"](${bbox});
          node["historic"="fortress"](${bbox});
          way["historic"="fortress"](${bbox});
          relation["historic"="fortress"](${bbox});
          node["historic"="ruins"](${bbox});
          way["historic"="ruins"](${bbox});
          relation["historic"="ruins"](${bbox});
          
          // Architettura civile e ville
          node["building"="palace"](${bbox});
          way["building"="palace"](${bbox});
          node["historic"="manor"](${bbox});
          way["historic"="manor"](${bbox});
          node["historic"="villa"](${bbox});
          way["historic"="villa"](${bbox});
          
          // Torre e strutture militari
          node["historic"="tower"](${bbox});
          way["historic"="tower"](${bbox});
          node["man_made"="tower"](${bbox});
          way["man_made"="tower"](${bbox});
          
          // Luoghi naturali (esclusi picchi/montagne)
          node["natural"]["natural"!="peak"]["natural"!="volcano"]["natural"!="ridge"](${bbox});
          way["natural"]["natural"!="peak"]["natural"!="volcano"]["natural"!="ridge"](${bbox});
          relation["natural"]["natural"!="peak"]["natural"!="volcano"]["natural"!="ridge"](${bbox});
          
          // Spiagge e luoghi marini
          node["natural"="beach"](${bbox});
          way["natural"="beach"](${bbox});
          relation["natural"="beach"](${bbox});
          
          // Porti e marina
          node["harbour"="yes"](${bbox});
          way["harbour"="yes"](${bbox});
          relation["harbour"="yes"](${bbox});
          node["leisure"="marina"](${bbox});
          way["leisure"="marina"](${bbox});
          
          // Fari
          node["man_made"="lighthouse"](${bbox});
          way["man_made"="lighthouse"](${bbox});
          relation["man_made"="lighthouse"](${bbox});
          
          // Parchi e giardini
          node["leisure"="park"](${bbox});
          way["leisure"="park"](${bbox});
          relation["leisure"="park"](${bbox});
          
          // Punti panoramici
          node["natural"="viewpoint"](${bbox});
          way["natural"="viewpoint"](${bbox});
          relation["natural"="viewpoint"](${bbox});
        );
        out center;
      `;

      await this.rateLimit();
      
      // Use multi-mirror fetch
      const data = await this.fetchOverpassSafely(query);
      
      if (!data) {
        this.log(`❌ All mirrors failed, returning empty results`);
        return [];
      }

      this.log(`✅ Ricevuta risposta OSM, elementi: ${data?.elements?.length || 0}`);
      const result = this.processOSMResults(data.elements, municipality);
      this.log(`✅ processOSMResults ha restituito ${result.length} POI`);
      return result;
      
    } catch (error) {
      this.log(`❌ Errore in searchOSMPOIsWithBbox: ${error.message}`);
      this.log(`❌ Stack trace: ${error.stack}`);
      return [];
    }
  }


  /**
   * Ricerca POI da Wikipedia/Wikidata
   */
  async searchWikipediaPOIs(municipality) {
    try {
      this.log(`📖 Inizio ricerca Wikipedia per: ${municipality.name}`);
      
      // Prova prima con il nuovo estrattore smart (se disponibile)
      if (this.smartExtractor) {
        try {
          this.log(`🧠 Tentativo con estrattore smart...`);
          const smartPOIs = await this.smartExtractor.extractPOIs(municipality, null, null);
          
          if (smartPOIs && smartPOIs.length > 0) {
            this.log(`✅ Smart extractor: trovati ${smartPOIs.length} POI`);
            return smartPOIs;
          }
        } catch (smartError) {
          this.log(`⚠️ Smart extractor fallito: ${smartError.message}`);
        }
      }
      
      // Fallback al metodo base
      this.log(`📖 Uso metodo base Wikipedia...`);
      const pois = [];
      
      // Usa l'API Wikipedia per ottenere testo completo e links
      try {
        this.log(`📖 Chiamata API Wikipedia per: ${municipality.name}`);
        
        const pageData = await axios.get(`${this.wikipediaUrl}/page/summary/${encodeURIComponent(municipality.name)}`, {
          timeout: 15000
        });
        
        if (pageData.data) {
          // Estrai POI direttamente dal testo dell'abstract
          const text = pageData.data.extract || '';
          const links = pageData.data.content_urls?.desktop?.page || '';
          
          this.log(`📝 Testo estratto: ${text.length} caratteri`);
          
          // Cerca POI nel testo usando pattern semplificato
          const poiPatterns = [
            /(?:Chiesa|Basilica|Oratorio|Santuario|Duomo|Cattedrale|Abbazia)\s+(?:di|di |del |della |dei )?([A-ZÀ-Ÿ][a-zÀ-Ÿ\s']{2,30})/gi,
            /(?:Castello|Forte|Rocca|Torre|Fortezza)\s+(?:di|di |del |della |dei )?([A-ZÀ-Ÿ][a-zÀ-Ÿ\s']{2,30})/gi,
            /(?:Villa|Palazzo)\s+([A-ZÀ-Ÿ][a-zÀ-Ÿ\s']{2,30})/gi,
            /(?:Museo)\s+(?:di|del |della |dei )?([A-ZÀ-Ÿ][a-zÀ-Ÿ\s']{2,30})/gi
          ];
          
          const foundNames = new Set();
          
          for (const pattern of poiPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
              const poiName = match[0].trim();
              if (poiName.length > 5 && poiName.length < 100 && !foundNames.has(poiName)) {
                foundNames.add(poiName);
                
                pois.push({
                  name: poiName,
                  lat: municipality.lat || null,
                  lng: municipality.lng || null,
                  municipality: municipality.name,
                  source: 'Wikipedia',
                  category: 'Cultural / Event place',
                  description: `Luogo di interesse di ${municipality.name} citato su Wikipedia`,
                  extraInfo: {
                    wikipediaUrl: links,
                    extractedFrom: 'Wikipedia Summary'
                  }
                });
              }
            }
          }
          
          this.log(`✅ Trovati ${pois.length} POI da Wikipedia summary`);
        }
      } catch (wikiError) {
        this.log(`⚠️ Errore API Wikipedia: ${wikiError.message}`);
      }

      return pois;

    } catch (error) {
      this.log(`❌ Errore ricerca Wikipedia: ${error.message}`);
      return [];
    }
  }

  /**
   * Estrae POI dalla pagina HTML di Wikipedia con descrizioni complete
   */
  extractPOIsFromWikipediaHTML(html, municipality) {
    const pois = [];
    
    try {
      this.log(`🔍 Analisi HTML Wikipedia per estrarre POI con descrizioni...`);
      
      // Cerca blocchi di POI con descrizioni: <li>Chiesa di X. Descrizione...</li>
      // Pattern per catturare nome POI + descrizione nello stesso elemento
      const sectionPattern = /<h[2-3][^>]*>([^<]+)<\/h[2-3]>/gi;
      let sectionMatch;
      
      // Cerca nelle sezioni "Architetture religiose", "Castelli", etc.
      const targetSections = ['Architetture religiose', 'Architetture civili', 'Architetture militari', 'Castelli', 'Musei', 'Monumenti'];
      
      // Estrai tutte le sezioni rilevanti
      const sections = [];
      while ((sectionMatch = sectionPattern.exec(html)) !== null) {
        const sectionTitle = sectionMatch[1].trim();
        if (targetSections.some(title => sectionTitle.includes(title))) {
          sections.push({
            title: sectionTitle,
            position: sectionMatch.index
          });
        }
      }
      
      // Per ogni sezione, estrai POI con descrizioni
      for (const section of sections) {
        const nextSection = sections.find(s => s.position > section.position);
        const sectionEnd = nextSection ? nextSection.position : html.length;
        const sectionContent = html.substring(section.position, sectionEnd);
        
        // Cerca pattern tipo: "<li>Chiesa di San Francesco. Descrizione dettagliata...</li>"
        // o "<p><strong>Castello</strong>. Descrizione...</p>"
        const poiPatterns = [
          // Pattern per lista <li>Nome POI. Descrizione</li>
          /<li[^>]*>([^<]*?(?:Chiesa|Basilica|Oratorio|Santuario|Duomo|Cattedrale|Abbazia|Castello|Villa|Palazzo|Museo|Spiaggia|Baia|Caletta|Promontorio|Monte|Parco)[^.]*\.)\s*([^<]{50,300}?)<\/li>/gi,
          // Pattern per paragrafi <p>Nome POI. Descrizione</p>
          /<p[^>]*><strong>([^<]+)<\/strong>[,\s.]+\s*([^<]{50,300}?)<\/p>/gi,
          // Pattern per righe separate
          /(Chiesa|Basilica|Oratorio|Santuario|Duomo|Cattedrale|Abbazia|Castello|Villa|Palazzo|Museo)\s+(?:di|di |del |della |dei )?([A-ZÀ-Ÿ][^.<]{3,80}?)(?:\.|\n)\s*([^<\n]{50,300}?)[.\n]/gi
        ];
        
        for (const pattern of poiPatterns) {
          let match;
          while ((match = pattern.exec(sectionContent)) !== null) {
            let poiName, poiDescription;
            
            // Gestisci i diversi pattern
            if (match[0].includes('<li>')) {
              poiName = match[1].replace(/<\/?[^>]+>/g, '').trim();
              poiDescription = match[2].replace(/<\/?[^>]+>/g, '').trim();
            } else if (match[0].includes('<strong>')) {
              poiName = match[1];
              poiDescription = match[2].replace(/<\/?[^>]+>/g, '').trim();
            } else {
              // Pattern generico
              const fullText = match[0];
              poiName = `${match[1]} ${match[2]}`.trim();
              poiDescription = match[3]?.replace(/<\/?[^>]+>/g, '').trim();
            }
            
            // Pulisci e valida
            poiName = poiName
              .replace(/<\/?[^>]+>/g, '')
              .replace(/^\d+[\.\)]\s*/, '') // Rimuovi numerazioni
              .replace(/\s+/g, ' ')
              .trim();
            
            poiDescription = poiDescription
              .replace(/<\/?[^>]+>/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (poiName && poiName.length > 5 && poiName.length < 150) {
              // Evita duplicati
              if (!pois.find(p => {
                const similarity = this.calculateStringSimilarity(p.name, poiName);
                return similarity > 0.7;
              })) {
                pois.push({
                  name: poiName,
                  lat: null,
                  lng: null,
                  municipality: municipality.name,
                  source: 'Wikipedia',
                  category: 'Cultural / Event place',
                  description: poiDescription || `Luogo di interesse di ${municipality.name} citato su Wikipedia`,
                  extraInfo: {
                    wikipediaUrl: `https://it.wikipedia.org/wiki/${encodeURIComponent(municipality.name)}`,
                    extractedFrom: 'Wikipedia HTML',
                    hasDescription: !!poiDescription
                  }
                });
              }
            }
          }
        }
      }
      
      this.log(`✅ Estrazione completata: ${pois.length} POI trovati (${pois.filter(p => p.extraInfo.hasDescription).length} con descrizione)`);
      
    } catch (error) {
      this.log(`⚠️ Errore estrazione HTML: ${error.message}`);
    }
    
    return pois;
  }

  /**
   * Calcola similarità tra due stringhe (per deduplicazione)
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calcola distanza di Levenshtein tra due stringhe
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
   * Arricchisce i POI con descrizioni AI dettagliate
   */
  async enrichPOIsWithAIDescriptions(pois, municipality) {
    this.log(`🤖 Arricchimento AI per ${pois.length} POI...`);
    
    const enrichedPOIs = [];
    
    for (const poi of pois) {
      try {
        // Genera descrizione AI solo se non ha già una descrizione dettagliata
        if (!poi.description || poi.description.includes('citato su Wikipedia') || poi.description.includes('Nessuna descrizione')) {
          await this.rateLimit();
          
          const aiDescription = await this.generateAIDescription(poi, municipality);
          if (aiDescription) {
            poi.description = aiDescription;
            poi.extraInfo = poi.extraInfo || {};
            poi.extraInfo.aiGenerated = true;
            this.log(`✅ Descrizione AI generata per: ${poi.name}`);
          }
        }
        
        enrichedPOIs.push(poi);
        
      } catch (error) {
        this.log(`⚠️ Errore AI per ${poi.name}: ${error.message}`);
        enrichedPOIs.push(poi); // Aggiungi comunque il POI senza descrizione AI
      }
    }
    
    return enrichedPOIs;
  }

  /**
   * Genera descrizione AI per un singolo POI
   */
  async generateAIDescription(poi, municipality) {
    try {
      const prompt = `Genera una descrizione turistica dettagliata e accattivante per il seguente luogo di interesse:

Nome: ${poi.name}
Comune: ${municipality.name}
Categoria: ${poi.category || 'Luogo di interesse'}

La descrizione deve essere:
- Lunga 2-3 frasi (50-100 parole)
- Orientata al turismo
- Includere informazioni storiche/culturali se note
- Scritta in italiano
- Accattivante e informativa

Rispondi SOLO con la descrizione, senza introduzioni o spiegazioni.`;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Sei un esperto di turismo italiano. Genera descrizioni accattivanti per luoghi di interesse.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }
      
    } catch (error) {
      this.log(`⚠️ Errore generazione AI: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Ricerca POI da siti istituzionali
   */
  async searchInstitutionalPOIs(municipality) {
    try {
      const pois = [];
      
      // URL pattern per siti istituzionali e turistici
      const institutionalUrls = [
        `https://www.comune.${municipality.name.toLowerCase().replace(/\s+/g, '')}.it`,
        `https://www.${municipality.name.toLowerCase().replace(/\s+/g, '')}.it`,
        `https://turismo.${municipality.name.toLowerCase().replace(/\s+/g, '')}.it`,
        `https://www.${municipality.name.toLowerCase().replace(/\s+/g, '')}.com`,
        `https://www.visitlevanto.it`, // Sito turistico Levanto
        `https://www.cinqueterre.eu`, // Sito Cinque Terre
        `https://www.turismoinliguria.it`, // Sito turistico Liguria
        `https://www.parconazionale5terre.it` // Parco Nazionale Cinque Terre
      ];

      for (const url of institutionalUrls) {
        await this.rateLimit();
        
        try {
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; WhatisBot/1.0)'
            }
          });
          
          const extractedPOIs = this.extractPOIsFromHTML(response.data, municipality, url);
          pois.push(...extractedPOIs);
          
        } catch (urlError) {
          // Continua con il prossimo URL
          continue;
        }
      }

      return pois;

    } catch (error) {
      this.log(`❌ Errore ricerca siti istituzionali: ${error.message}`);
      return [];
    }
  }

  /**
   * Processa risultati OSM
   */
  processOSMResults(elements, municipality) {
    const pois = [];
    
    for (const element of elements) {
      try {
        const poi = {
          name: this.extractOSMName(element),
          lat: element.lat || element.center?.lat,
          lng: element.lon || element.center?.lon,
          municipality: municipality.name,
          source: 'OSM',
          category: this.categorizeOSMElement(element),
          description: this.generateOSMDescription(element),
          osmId: element.id,
          tags: element.tags || {},
          extraInfo: {
            osmType: element.type,
            osmTags: element.tags || {}
          }
        };

        if (poi.lat && poi.lng && poi.name) {
          pois.push(poi);
        }
      } catch (error) {
        this.log(`⚠️ Errore processamento elemento OSM: ${error.message}`);
      }
    }
    
    return pois;
  }

  /**
   * Estrae nome da elemento OSM
   */
  extractOSMName(element) {
    const tags = element.tags || {};
    return tags.name || tags['name:it'] || tags['name:en'] || tags.amenity || tags.historic || tags.natural || 'Luogo senza nome';
  }

  /**
   * Categorizza elemento OSM
   */
  categorizeOSMElement(element) {
    const tags = element.tags || {};
    
    if (tags.amenity === 'place_of_worship') return 'Religion';
    if (tags.historic) return 'Monument / Architecture';
    if (tags.tourism === 'museum') return 'Museum / Culture';
    if (tags.natural === 'beach') return 'Nature / Landscape';
    if (tags.harbour === 'yes') return 'Marine / Nautical';
    if (tags.man_made === 'lighthouse') return 'Marine / Nautical';
    if (tags.leisure === 'park') return 'Nature / Landscape';
    if (tags.natural === 'viewpoint') return 'Nature / Landscape';
    
    return 'Other';
  }

  /**
   * Genera descrizione da elemento OSM
   */
  generateOSMDescription(element) {
    const tags = element.tags || {};
    const descriptions = [];
    
    if (tags.historic) descriptions.push(`Sito storico: ${tags.historic}`);
    if (tags.religion) descriptions.push(`Religione: ${tags.religion}`);
    if (tags.denomination) descriptions.push(`Denominazione: ${tags.denomination}`);
    if (tags.architect) descriptions.push(`Architetto: ${tags.architect}`);
    if (tags.built) descriptions.push(`Anno di costruzione: ${tags.built}`);
    
    return descriptions.join('. ');
  }

  /**
   * Estrae POI da dati Wikipedia
   */
  extractPOIFromWikipedia(data, municipality) {
    if (!data.extract || !data.coordinates) return null;
    
    return {
      name: data.title,
      lat: data.coordinates.lat,
      lng: data.coordinates.lon,
      municipality: municipality.name,
      source: 'Wikipedia',
      category: 'Cultural / Event place',
      description: data.extract,
      wikipediaUrl: data.content_urls?.desktop?.page || '',
      extraInfo: {
        wikipediaSummary: data.extract,
        wikipediaUrl: data.content_urls?.desktop?.page || ''
      }
    };
  }

  /**
   * Estrae POI da HTML di siti istituzionali
   */
  extractPOIsFromHTML(html, municipality, sourceUrl) {
    const pois = [];
    
    try {
      // Pattern per trovare luoghi di interesse
      const patterns = [
        /<h[1-6][^>]*>([^<]*(?:chiesa|basilica|duomo|cattedrale|santuario)[^<]*)<\/h[1-6]>/gi,
        /<h[1-6][^>]*>([^<]*(?:monumento|statua|torre|castello|forte)[^<]*)<\/h[1-6]>/gi,
        /<h[1-6][^>]*>([^<]*(?:museo|galleria|pinacoteca)[^<]*)<\/h[1-6]>/gi,
        /<h[1-6][^>]*>([^<]*(?:spiaggia|baia|caletta|parco|giardino)[^<]*)<\/h[1-6]>/gi,
        /<h[1-6][^>]*>([^<]*(?:porto|marina|molo|faro)[^<]*)<\/h[1-6]>/gi
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const name = match[1].trim();
          if (name && name.length > 3) {
            pois.push({
              name: name,
              lat: null, // Sarà geocodificato dopo
              lng: null,
              municipality: municipality.name,
              source: 'Institutional',
              category: 'Cultural / Event place',
              description: `Luogo di interesse di ${municipality.name}`,
              extraInfo: {
                sourceUrl: sourceUrl,
                extractedFrom: 'HTML parsing'
              }
            });
          }
        }
      }
    } catch (error) {
      this.log(`⚠️ Errore parsing HTML: ${error.message}`);
    }
    
    return pois;
  }

  /**
   * Deduplica e filtra POI
   */
  async deduplicateAndFilterPOIs(pois, municipality) {
    this.log(`🧹 Inizio filtraggio: ${pois.length} POI totali per ${municipality.name}`);
    
    const filtered = [];
    const seen = new Set();
    const mountains = []; // Per limitare le montagne
    
    let skippedInvalid = 0;
    let skippedInvalidName = 0;
    let skippedMunicipality = 0;
    let sampleSkipped = []; // Per debug: campione di POI scartati
    
    for (const poi of pois) {
      // Filtra POI non validi
      if (!this.isValidPOI(poi)) {
        skippedInvalid++;
        if (sampleSkipped.length < 3) {
          sampleSkipped.push({ name: poi.name, reason: 'Invalid', category: poi.category });
        }
        continue;
      }
      
      // Filtra POI con nomi solo numerici
      if (!this.hasValidName(poi.name)) {
        skippedInvalidName++;
        if (sampleSkipped.length < 3) {
          sampleSkipped.push({ name: poi.name, reason: 'Invalid name', category: poi.category });
        }
        continue;
      }
      
      // Filtra POI del municipio corretto
      if (!this.isPOIInMunicipality(poi, municipality)) {
        skippedMunicipality++;
        if (sampleSkipped.length < 3) {
          sampleSkipped.push({ name: poi.name, reason: 'Not in municipality', category: poi.category, lat: poi.lat, lng: poi.lng });
        }
        continue;
      }
      
      // Gestisci montagne separatamente
      if (poi.category === 'Nature / Landscape' && this.isMountain(poi)) {
        this.log(`🏔️ Montagna rilevata: "${poi.name}" - Altitudine: ${this.extractAltitude(poi) || 'N/A'}`);
        mountains.push(poi);
        continue;
      }
      
      // Crea chiave univoca
      const key = `${poi.name.toLowerCase()}_${(poi.municipality || '').toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(poi);
      }
    }
    
    // Aggiungi solo le 3 montagne più alte
    const topMountains = this.getTopMountains(mountains, 3);
    this.log(`🏔️ Montagne selezionate (top 3):`);
    topMountains.forEach((mountain, index) => {
      const altitude = this.extractAltitude(mountain) || 'N/A';
      this.log(`  ${index + 1}. ${mountain.name} - Altitudine: ${altitude}m`);
    });
    filtered.push(...topMountains);
    
    this.log(`🧹 Filtri applicati: ${pois.length} → ${filtered.length} POI`);
    this.log(`   - POI non validi: ${skippedInvalid}`);
    this.log(`   - Nomi non validi: ${skippedInvalidName}`);
    this.log(`   - Fuori municipio: ${skippedMunicipality}`);
    this.log(`   - Montagne trovate/selezionate: ${mountains.length}/${topMountains.length}`);
    
    // Debug: mostra campione di POI scartati
    if (sampleSkipped.length > 0) {
      this.log(`   - Esempio POI scartati:`);
      sampleSkipped.forEach(poi => {
        this.log(`     * ${poi.name} (${poi.category}) - Motivo: ${poi.reason}`);
      });
    }
    
    return filtered;
  }

  /**
   * Verifica se POI è valido
   * STRATEGIA ESTREMAMENTE PERMISSIVA: accetta TUTTO tranne attività commerciali
   */
  isValidPOI(poi) {
    // Deve avere almeno un nome (anche generico come "water", "bare_rock", etc.)
    if (!poi.name || poi.name.trim().length < 1) {
      return false;
    }
    
    // Esclude SOLO attività commerciali esplicite (match esatto di parole complete)
    const commercialKeywords = [
      'ristorante', 'restaurant', 'café', 'cafe', 'shop', 'store', 
      'hotel', 'market', 'supermarket', 'mall', 'pharmacy', 'bank', 'atm', 
      'hairdresser', 'car rental', 'rental', 'agency', 'boutique', 'negozio', 
      'commerciale', 'pizzeria', 'trattoria', 'osteria', 'gelateria'
    ];
    
    const nameLower = poi.name.toLowerCase().trim();
    
    // Match completo di parole (con word boundaries)
    for (const keyword of commercialKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(nameLower)) {
        return false;
      }
    }
    
    // ✅ ACCETTA TUTTO IL RESTO
    // Monumenti, chiese, musei, spiagge, natura, porti, fari, etc.
    return true;
  }

  /**
   * Verifica se il nome del POI è valido (non solo numerico)
   */
  hasValidName(name) {
    if (!name) return false;
    
    // Rimuovi spazi e controlla se è solo numerico
    const cleanName = name.trim();
    
    // Controlla se è solo numeri arabi
    if (/^\d+$/.test(cleanName)) return false;
    
    // Controlla se è solo numeri romani
    if (/^[IVXLCDM]+$/i.test(cleanName)) return false;
    
    // Controlla se è solo numeri misti
    if (/^[IVXLCDM\d]+$/i.test(cleanName)) return false;
    
    // Deve contenere almeno una lettera
    if (!/[a-zA-Z]/.test(cleanName)) return false;
    
    return true;
  }

  /**
   * Verifica se il POI appartiene al municipio corretto
   * STRATEGIA PIÙ PERMISSIVA: accetta tutti i POI con coordinate valide
   */
  isPOIInMunicipality(poi, municipality) {
    // Se il POI ha coordinate valide, accettalo
    // Il bounding box OSM garantisce già che sia nella zona corretta
    if (poi.lat && poi.lng) {
      return true;
    }
    
    // Se non ha coordinate ma ha un nome specifico, accettalo
    if (poi.name && poi.name.trim().length > 5) {
      return true;
    }
    
    // Altrimenti escludilo
    return false;
  }

  /**
   * Calcola distanza tra due punti in metri
   * NOTA: Usata solo per le montagne (top 3 più alte)
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
   * Verifica se il POI è una montagna
   */
  isMountain(poi) {
    const name = poi.name.toLowerCase();
    const description = (poi.description || '').toLowerCase();
    const text = `${name} ${description}`;
    
    // Parole chiave per montagne (più specifiche)
    const mountainKeywords = [
      'monte', 'montagna', 'peak', 'summit', 'pizzo', 'cima', 'colle',
      'mountain', 'hill', 'altura', 'elevazione', 'altitudine'
    ];
    
    // Parole chiave che escludono montagne (colline, punti panoramici, etc.)
    const excludeKeywords = [
      'collina', 'poggio', 'poggiolo', 'colle basso', 'panorama', 'belvedere',
      'viewpoint', 'lookout', 'terrazza', 'balcone', 'osservatorio'
    ];
    
    // Controlla se contiene parole di esclusione
    if (excludeKeywords.some(keyword => text.includes(keyword))) {
      return false;
    }
    
    // Controlla se contiene parole di montagna
    const isMountain = mountainKeywords.some(keyword => text.includes(keyword));
    
    // Se è una montagna, verifica che abbia un'altitudine ragionevole
    if (isMountain) {
      const altitude = this.extractAltitude(poi);
      // Se non ha altitudine, controlla che il nome contenga almeno "monte" o "montagna"
      if (!altitude) {
        return name.includes('monte') || name.includes('montagna') || 
               name.includes('peak') || name.includes('summit');
      }
      return true;
    }
    
    return false;
  }

  /**
   * Ottiene le N montagne più alte
   */
  getTopMountains(mountains, limit = 3) {
    // Ordina per altitudine se disponibile, altrimenti per nome
    const sortedMountains = mountains.sort((a, b) => {
      // Prova a estrarre altitudine dal nome o descrizione
      const altitudeA = this.extractAltitude(a);
      const altitudeB = this.extractAltitude(b);
      
      if (altitudeA && altitudeB) {
        return altitudeB - altitudeA; // Ordine decrescente (più alte prima)
      }
      
      // Se non ci sono altitudini, ordina alfabeticamente
      return a.name.localeCompare(b.name);
    });
    
    return sortedMountains.slice(0, limit);
  }

  /**
   * Estrae altitudine dal nome o descrizione
   */
  extractAltitude(poi) {
    const text = `${poi.name} ${poi.description || ''}`.toLowerCase();
    
    // Cerca pattern più specifici per l'altitudine
    const patterns = [
      /(\d+)\s*(?:m|metri|metri\s*slm|slm)/i,           // 1234m, 1234 metri
      /altitudine[:\s]*(\d+)/i,                          // altitudine: 1234
      /altezza[:\s]*(\d+)/i,                             // altezza: 1234
      /elevazione[:\s]*(\d+)/i,                          // elevazione: 1234
      /(\d+)\s*(?:metri|m)\s*(?:di\s*)?(?:altezza|altitudine)/i, // 1234 metri di altezza
      /(\d+)\s*(?:m\.?|metri\.?)$/i,                     // 1234m alla fine
      /(\d+)\s*(?:m\.?|metri\.?)\s*(?:slm|s\.l\.m\.?)/i // 1234m slm
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const altitude = parseInt(match[1]);
        if (altitude > 0 && altitude < 10000) { // Filtro per altitudini ragionevoli
          return altitude;
        }
      }
    }
    
    return null;
  }

  /**
   * Arricchisce POI con immagini e descrizioni
   */
  async enrichPOIsWithImagesAndDescriptions(pois) {
    const enriched = [];
    
    for (const poi of pois) {
      try {
        const enrichedPOI = { ...poi };
        
        // Geocoding se necessario
        if (!enrichedPOI.lat || !enrichedPOI.lng) {
          const coords = await this.geocodePOI(enrichedPOI);
          if (coords) {
            enrichedPOI.lat = coords.lat;
            enrichedPOI.lng = coords.lng;
          }
        }
        
        // OPTIMIZED: Skip image search and description enrichment
        // Just assign placeholder image immediately
        if (!enrichedPOI.imageUrl) {
          enrichedPOI.imageUrl = this.getPlaceholderImage(enrichedPOI);
        }
        
        // Skip description enrichment for speed
        // Descriptions can be added manually later
        
        enriched.push(enrichedPOI);
        
      } catch (error) {
        this.log(`⚠️ Errore arricchimento POI ${poi.name}: ${error.message}`);
        enriched.push(poi); // Aggiungi comunque il POI originale
      }
    }
    
    return enriched;
  }

  /**
   * Geocoding POI
   */
  async geocodePOI(poi) {
    try {
      const query = `${poi.name}, ${poi.municipality}, Italia`;
      const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: {
          q: query,
          format: 'json',
          limit: 1
        },
        timeout: 5000
      });
      
      if (response.data && response.data.length > 0) {
        return {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon)
        };
      }
    } catch (error) {
      this.log(`⚠️ Errore geocoding ${poi.name}: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Trova immagine per POI
   */
  async findPOIImage(poi) {
    try {
      // OPTIMIZED: Skip image search to speed up POI discovery
      // Images can be added manually later via the edit form
      // Return placeholder immediately without any API calls
      const placeholderImage = this.getPlaceholderImage(poi);
      return placeholderImage || '';
    } catch (error) {
      // Silently return empty string on error
      return '';
    }
  }

  /**
   * Ottiene un'immagine placeholder basata sulla categoria del POI
   */
  getPlaceholderImage(poi) {
    // Usa Unsplash Source per immagini placeholder gratuite
    const category = poi.category || 'other';
    
    const placeholderUrls = {
      'Religion': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
      'Monument / Architecture': 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=400&h=300&fit=crop',
      'Museum / Culture': 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&h=300&fit=crop',
      'Nature / Landscape': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      'Marine / Nautical': 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=300&fit=crop',
      'Archaeological / Historical site': 'https://images.unsplash.com/photo-1539650116574-75c0c6d73c6e?w=400&h=300&fit=crop',
      'Cultural / Event place': 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=400&h=300&fit=crop',
      'Civic / Urban landmark': 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop',
      'Scientific / Educational': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=300&fit=crop',
      'Other': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop'
    };
    
    return placeholderUrls[category] || placeholderUrls['Other'];
  }

  /**
   * Cerca immagine su Wikipedia/Wikimedia Commons
   */
  async searchWikipediaImage(poi) {
    try {
      // Cerca con query specifiche per il POI
      const queries = [
        `${poi.name} ${poi.municipality}`,
        `${poi.name} Italia`,
        poi.name
      ];
      
      for (const query of queries) {
        try {
          this.log(`🔍 Cerca foto Wikipedia per: "${query}"`);
          const response = await axios.get(`${this.wikimediaUrl}/page/summary/${encodeURIComponent(query)}`, {
            timeout: 10000
          });
          
          if (response.data && response.data.thumbnail) {
            // Preferisci immagini più grandi
            const imageUrl = response.data.thumbnail.source;
            this.log(`📸 Foto trovata su Wikipedia: ${imageUrl}`);
            if (imageUrl.includes('commons') || imageUrl.includes('wikimedia')) {
              return imageUrl;
            }
          }
        } catch (error) {
          this.log(`⚠️ Errore ricerca Wikipedia per "${query}": ${error.message}`);
          continue;
        }
      }
      
      // Prova anche con Wikipedia API per immagini
      const wikiImage = await this.searchWikipediaAPI(poi);
      if (wikiImage) return wikiImage;
      
    } catch (error) {
      this.log(`⚠️ Errore generale ricerca Wikipedia: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Cerca immagine usando Wikipedia API
   */
  async searchWikipediaAPI(poi) {
    try {
      // Cerca prima il titolo della pagina
      const searchResponse = await axios.get('https://it.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(poi.name), {
        timeout: 5000
      });
      
      if (searchResponse.data && searchResponse.data.thumbnail) {
        const imageUrl = searchResponse.data.thumbnail.source;
        this.log(`📸 Foto trovata su Wikipedia API: ${imageUrl}`);
        return imageUrl;
      }
    } catch (error) {
      this.log(`⚠️ Errore Wikipedia API: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Cerca immagine su servizi gratuiti
   */
  async searchFreeImage(poi) {
    try {
      // Cerca su Pixabay (API gratuita)
      const pixabayImage = await this.searchPixabayImage(poi);
      if (pixabayImage) return pixabayImage;
      
      // Cerca su Pexels (API gratuita)
      const pexelsImage = await this.searchPexelsImage(poi);
      if (pexelsImage) return pexelsImage;
      
    } catch (error) {
      // Continua senza immagine
    }
    
    return null;
  }

  /**
   * Cerca immagine su Unsplash
   */
  async searchUnsplashImage(poi) {
    try {
      // Query specifiche per il tipo di POI
      let query = poi.name;
      
      if (poi.category === 'Religion') {
        query = `${poi.name} church cathedral basilica`;
      } else if (poi.category === 'Monument / Architecture') {
        query = `${poi.name} monument architecture building`;
      } else if (poi.category === 'Nature / Landscape') {
        query = `${poi.name} nature landscape mountain`;
      } else if (poi.category === 'Museum / Culture') {
        query = `${poi.name} museum culture art`;
      }
      
      // Nota: Unsplash richiede API key, per ora restituiamo null
      // In futuro si può implementare con API key
      return null;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Cerca immagine su Pixabay
   */
  async searchPixabayImage(poi) {
    try {
      // Pixabay API (richiede API key)
      // Per ora restituiamo null, in futuro si può implementare
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cerca immagine su Pexels
   */
  async searchPexelsImage(poi) {
    try {
      // Pexels API (richiede API key)
      // Per ora restituiamo null, in futuro si può implementare
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Arricchisce descrizione POI
   */
  async enrichPOIDescription(poi) {
    // Per ora restituisce una descrizione base
    // In futuro si può integrare con AI o altre fonti
    return `Luogo di interesse di ${poi.municipality}. ${poi.description || ''}`;
  }

  /**
   * Categorizza POI semanticamente
   */
  categorizePOIsSemantically(pois) {
    return pois.map(poi => {
      const category = this.determineSemanticCategory(poi);
      return {
        ...poi,
        category: category,
        icon: this.getCategoryIcon(category)
      };
    });
  }

  /**
   * Determina categoria semantica
   */
  determineSemanticCategory(poi) {
    const name = poi.name.toLowerCase();
    const description = (poi.description || '').toLowerCase();
    const text = `${name} ${description}`;
    
    // Regole semantiche
    if (this.matchesKeywords(text, ['chiesa', 'basilica', 'duomo', 'cattedrale', 'santuario', 'abbazia', 'convento'])) {
      return 'Religion';
    }
    if (this.matchesKeywords(text, ['monumento', 'statua', 'colonna', 'torre', 'porta', 'castello', 'forte', 'bastione'])) {
      return 'Monument / Architecture';
    }
    if (this.matchesKeywords(text, ['museo', 'galleria', 'mostra', 'biblioteca', 'archivio'])) {
      return 'Museum / Culture';
    }
    if (this.matchesKeywords(text, ['parco', 'spiaggia', 'baia', 'caletta', 'belvedere', 'cascata', 'scogliera', 'bosco', 'montagna'])) {
      return 'Nature / Landscape';
    }
    if (this.matchesKeywords(text, ['porto', 'marina', 'molo', 'faro', 'porto', 'relitto', 'immersione'])) {
      return 'Marine / Nautical';
    }
    if (this.matchesKeywords(text, ['rovine', 'scavi', 'necropoli', 'antico', 'romano', 'medievale'])) {
      return 'Archaeological / Historical site';
    }
    if (this.matchesKeywords(text, ['teatro', 'auditorium', 'cinema', 'festival', 'palcoscenico'])) {
      return 'Cultural / Event place';
    }
    if (this.matchesKeywords(text, ['municipio', 'piazza', 'fontana', 'porta', 'torre dell\'orologio'])) {
      return 'Civic / Urban landmark';
    }
    if (this.matchesKeywords(text, ['acquario', 'osservatorio', 'giardino botanico', 'centro ricerca'])) {
      return 'Scientific / Educational';
    }
    
    return 'Other';
  }

  /**
   * Verifica se il testo contiene le parole chiave
   */
  matchesKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Ottiene icona per categoria
   */
  getCategoryIcon(category) {
    const iconMap = {
      'Religion': '🕍',
      'Monument / Architecture': '🏰',
      'Museum / Culture': '🖼️',
      'Nature / Landscape': '🌿',
      'Marine / Nautical': '⚓',
      'Archaeological / Historical site': '🏺',
      'Cultural / Event place': '🎭',
      'Civic / Urban landmark': '🏛️',
      'Scientific / Educational': '🔬',
      'Other': '📍'
    };
    
    return iconMap[category] || '📍';
  }

  /**
   * Calcola bounding box
   */
  calculateBoundingBox(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;
    
    let minLat = coordinates[0][0];
    let maxLat = coordinates[0][0];
    let minLng = coordinates[0][1];
    let maxLng = coordinates[0][1];
    
    for (const coord of coordinates) {
      minLat = Math.min(minLat, coord[0]);
      maxLat = Math.max(maxLat, coord[0]);
      minLng = Math.min(minLng, coord[1]);
      maxLng = Math.max(maxLng, coord[1]);
    }
    
    return `${minLat},${minLng},${maxLat},${maxLng}`;
  }

  /**
   * Rate limiting
   */
  async rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
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
   * Logging
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [INTELLIGENT-POI] ${message}`;
    
    console.log(logMessage);
    
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Errore scrittura log:', error);
    }
  }
}

module.exports = IntelligentPOISearchEngine;
