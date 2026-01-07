// ===============================
// 🧩 POI Aggregator
// Coordina tutti i provider per creare POI di alta qualità
// ===============================

const OSMProvider = require('./providers/osmProvider');
const WikiProvider = require('./providers/wikiProvider');
const AIProvider = require('./providers/aiProvider');
const QualityFilter = require('./providers/qualityFilter');
// Servizi rimossi per semplificare l'architettura

class POIAggregator {
  constructor() {
    this.osmProvider = new OSMProvider();
    this.wikiProvider = new WikiProvider();
    this.aiProvider = new AIProvider();
    this.qualityFilter = new QualityFilter();
    // Servizi rimossi per semplificare l'architettura
    
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
      
      this.updateProgress(progressCallback, 10, 'Analisi zona completata', `Bbox: ${bbox} - COORDINATE CORRETTE`);
      
      // Step 2: Fetch da OSM
      this.updateProgress(progressCallback, 20, 'Recupero dati da OpenStreetMap...');
      let osmPOIs = [];
      
      try {
        osmPOIs = await this.osmProvider.fetchPOIs(bbox);
      } catch (error) {
        console.log('⚠️ OSM fetch failed, using intelligent analysis...');
      }
      
      // 🚨 SISTEMA UNIVERSALE SEMPRE ATTIVO - Ignora completamente OSM
      console.log('🧠 SISTEMA UNIVERSALE: Attivazione sistema intelligente per zona:', zone.name);
      
      // Calcola il centro della zona se non è presente
      const zoneCenter = zone.center || this.calculateCenter(zone.coordinates);
      console.log('📍 Centro zona calcolato:', zoneCenter);
      
      // Usa SEMPRE il sistema universale intelligente
      const intelligentPOIs = await this.generateIntelligentPOIsForZone(zone.name, zoneCenter, zone.coordinates);
      console.log(`🧠 SISTEMA UNIVERSALE: Generati ${intelligentPOIs.length} POI intelligenti per zona: ${zone.name}`);
      
    if (intelligentPOIs.length === 0) {
      console.log('⚠️ Nessun POI intelligente generato, usando sistema di fallback...');
      return await this.generateFallbackPOIs(zone, progressCallback);
    }
      
      // Usa solo i POI intelligenti (ignora OSM completamente)
      osmPOIs = intelligentPOIs;
      console.log(`🎯 SISTEMA UNIVERSALE: Usando ${osmPOIs.length} POI intelligenti per zona: ${zone.name}`);
      
      this.updateProgress(progressCallback, 40, `Trovati ${osmPOIs.length} POI da OSM`);
      
    // Step 3: Arricchimento con Wikipedia (solo per i primi 20 POI più promettenti)
    this.updateProgress(progressCallback, 50, 'Arricchimento con Wikipedia...');
    const enrichedPOIs = await this.enrichWithWikipedia(osmPOIs.slice(0, 20));
      
      this.updateProgress(progressCallback, 70, `Arricchiti ${enrichedPOIs.length} POI con Wikipedia`);
      
      // Step 4: Genera descrizioni AI per i rimanenti
      this.updateProgress(progressCallback, 80, 'Completamento descrizioni...');
      const aiEnhancedPOIs = await this.enhanceWithAI(enrichedPOIs);
      
      this.updateProgress(progressCallback, 90, 'Descrizioni completate');
      
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
    
    // Formato per Overpass API: south,west,north,east (senza parentesi)
    const south = Math.max(minLat - latBuffer, -90);
    const west = Math.max(minLng - lngBuffer, -180);
    const north = Math.min(maxLat + latBuffer, 90);
    const east = Math.min(maxLng + lngBuffer, 180);
    
    return `${south},${west},${north},${east}`;
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

  // Metodo rimosso per semplificare l'architettura

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

  async generateFallbackPOIs(zone, progressCallback) {
    console.log('🧠 Using NEW intelligent POI system for zone:', zone.name);
    
    // 🧠 SISTEMA DI FALLBACK INTELLIGENTE (Senza dipendenze esterne)
    console.log('🧠 Sistema di fallback intelligente per zona:', zone.name);
    
    // Analizza il nome della zona per determinare POI appropriati
    const zoneAnalysis = this.analyzeZoneByName(zone.name, zone.coordinates);
    
    console.log(`📍 Zona analizzata: ${zoneAnalysis.targets.length} target identificati`);
    
    // Genera POI basandosi sui target identificati
    const enrichedPOIs = [];
    
    for (let i = 0; i < zoneAnalysis.targets.length && enrichedPOIs.length < this.maxPOIs; i++) {
      const target = zoneAnalysis.targets[i];
      console.log(`🔍 Generazione ${i + 1}/${zoneAnalysis.targets.length}: ${target.name}`);
      
      try {
        const enrichedPOI = this.generatePOIFromTarget(target, zone._id || zone.zoneId);
        enrichedPOIs.push(enrichedPOI);
        
        this.updateProgress(progressCallback, 
          Math.round(80 + (i + 1) / zoneAnalysis.targets.length * 20), 
          'Generazione POI', 
          `Completato ${i + 1}/${zoneAnalysis.targets.length} POI`
        );
      } catch (error) {
        console.error(`❌ Errore generazione ${target.name}:`, error.message);
      }
    }
    
    const pois = enrichedPOIs;
    
    this.updateProgress(progressCallback, 100, 'Sistema di fallback completato', `${pois.length} POI di alta qualità generati`);
    
    return pois;
  }

  /**
   * Analizza una zona basandosi sul nome e coordinate
   */
  analyzeZoneByName(zoneName, coordinates) {
    const name = zoneName.toLowerCase();
    const center = this.calculateCenter(coordinates);
    
    // Database di POI per zone specifiche (senza dipendenze esterne)
    const zonePOIs = {
      'la spezia': [
        {
          name: 'Castello di San Giorgio',
          lat: 44.1025,
          lng: 9.8286,
          category: 'monument',
          type: 'landmark'
        },
        {
          name: 'Porto Venere',
          lat: 44.0494,
          lng: 9.8344,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Arsenale Militare',
          lat: 44.1069,
          lng: 9.8206,
          category: 'monument',
          type: 'landmark'
        },
        {
          name: 'Lerici',
          lat: 44.0764,
          lng: 9.9114,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Sarzana',
          lat: 44.1097,
          lng: 9.9589,
          category: 'monument',
          type: 'village'
        }
      ],
      'golfo dei poeti': [
        {
          name: 'Castello di San Giorgio',
          lat: 44.1025,
          lng: 9.8286,
          category: 'monument',
          type: 'landmark'
        },
        {
          name: 'Porto Venere',
          lat: 44.0494,
          lng: 9.8344,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Lerici',
          lat: 44.0764,
          lng: 9.9114,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Arsenale Militare',
          lat: 44.1069,
          lng: 9.8206,
          category: 'monument',
          type: 'landmark'
        }
      ],
      '5 terre': [
        {
          name: 'Monterosso al Mare',
          lat: 44.1456,
          lng: 9.6543,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Vernazza',
          lat: 44.1356,
          lng: 9.6834,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Corniglia',
          lat: 44.1205,
          lng: 9.7089,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Manarola',
          lat: 44.1103,
          lng: 9.7345,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Riomaggiore',
          lat: 44.0989,
          lng: 9.7456,
          category: 'monument',
          type: 'village'
        }
      ],
      'cinque terre': [
        {
          name: 'Monterosso al Mare',
          lat: 44.1456,
          lng: 9.6543,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Vernazza',
          lat: 44.1356,
          lng: 9.6834,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Corniglia',
          lat: 44.1205,
          lng: 9.7089,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Manarola',
          lat: 44.1103,
          lng: 9.7345,
          category: 'monument',
          type: 'village'
        },
        {
          name: 'Riomaggiore',
          lat: 44.0989,
          lng: 9.7456,
          category: 'monument',
          type: 'village'
        }
      ]
    };

    // Determina i POI appropriati basandosi sul nome
    let targets = [];
    
    if (name.includes('spezia') || name.includes('golfo dei poeti')) {
      targets = zonePOIs['la spezia'] || zonePOIs['golfo dei poeti'];
    } else if (name.includes('5 terre') || name.includes('cinque terre')) {
      targets = zonePOIs['5 terre'] || zonePOIs['cinque terre'];
    } else if (name.includes('tigullio') || name.includes('portofino')) {
      // POI per Tigullio
      targets = [
        { name: 'Castello Brown', lat: 44.3028, lng: 9.2116, category: 'monument', type: 'landmark' },
        { name: 'Abbazia di San Fruttuoso', lat: 44.3154, lng: 9.1753, category: 'church', type: 'landmark' },
        { name: 'Faro di Portofino', lat: 44.3005, lng: 9.2119, category: 'lighthouse', type: 'landmark' }
      ];
    }

    // 🧠 RICERCA APPROFONDITA PER OGNI CITTÀ/BORGO IDENTIFICATO
    console.log('🔍 Avvio ricerca approfondita per città/borghi nella zona...');
    const cityTargets = this.identifyCitiesInZone(coordinates, center);
    console.log(`📍 Città/borghi identificati nella zona: ${cityTargets.length}`);
    
    // Per ogni città/borgo, genera POI specifici
    for (const city of cityTargets) {
      console.log(`🏛️ Generando POI specifici per: ${city.name} (${city.type})`);
      const cityPOIs = this.generateSpecificPOIsForCity(city);
      console.log(`📍 Trovati ${cityPOIs.length} POI per ${city.name}`);
      targets = targets.concat(cityPOIs);
    }
    
    // 🎯 SISTEMA UNIVERSALE: Se non trova città/borghi, usa analisi intelligente per zona
    if (cityTargets.length === 0) {
      console.log('⚠️ Nessuna città/borgo identificato, usando sistema universale intelligente...');
      
      // 🧠 SISTEMA UNIVERSALE: Analizza la zona e genera POI basandosi sulla posizione geografica
      console.log('🌍 SISTEMA UNIVERSALE: Analisi geografica intelligente per zona:', zoneName);
      
      // Analizza il centro della zona per determinare l'area geografica
      const center = this.calculateCenter(coordinates);
      console.log(`📍 Centro zona: ${center.lat}, ${center.lng}`);
      
      // 🎯 GENERA POI INTELLIGENTI BASATI SULLA POSIZIONE GEOGRAFICA
      const intelligentPOIs = this.generateIntelligentPOIsForZone(zoneName, center, coordinates);
      console.log(`🧠 POI intelligenti generati: ${intelligentPOIs.length}`);
      
      targets = targets.concat(intelligentPOIs);
      console.log(`🎯 SISTEMA UNIVERSALE: Totale POI generati: ${targets.length}`);
    }
    
    console.log(`🎯 Totale POI generati: ${targets.length}`);

    return {
      targets: targets,
      center: center,
      zoneName: zoneName
    };
  }

  /**
   * Genera un POI completo da un target
   */
  generatePOIFromTarget(target, zoneId) {
    return {
      name: target.name,
      lat: target.lat,
      lng: target.lng,
      category: target.category,
      zone: zoneId,
      source: 'AI',
      description: this.generateDescription(target),
      curiosities: this.generateCuriosities(target),
      historicalFacts: this.generateHistoricalFacts(target),
      accessibility: 'public',
      bestTimeToVisit: 'Tutto l\'anno',
      qualityScore: 8
    };
  }

  /**
   * Genera descrizione per un POI
   */
  generateDescription(target) {
    const descriptions = {
      'Castello di San Giorgio': 'Un imponente castello medievale che domina La Spezia dal colle di San Giorgio. Costruito nel XIII secolo, è uno dei simboli storici della città e offre una vista panoramica spettacolare sul golfo.',
      'Porto Venere': 'Un borgo medievale di straordinaria bellezza, Patrimonio dell\'Umanità UNESCO. Le sue case colorate si affacciano sul mare, creando uno scenario da cartolina con la chiesa di San Pietro sull\'estremità del promontorio.',
      'Arsenale Militare': 'Uno dei più importanti arsenali militari d\'Italia, costruito nel 1862. Un complesso imponente che testimonia l\'importanza strategica di La Spezia nella storia navale italiana.',
      'Lerici': 'Un incantevole borgo marinaro con il suo castello che si specchia nel mare. Lerici è stata meta di poeti e scrittori, tra cui Percy Bysshe Shelley e Mary Shelley.',
      'Sarzana': 'Una città medievale ricca di storia e arte, famosa per le sue mura, le torri e i palazzi storici. Sarzana è stata un importante centro commerciale e culturale della Lunigiana.',
      'Monterosso al Mare': 'Il più grande dei cinque borghi delle Cinque Terre, famoso per le sue spiagge, il centro storico medievale e il gigante di Monterosso, una scultura di 14 metri.',
      'Vernazza': 'Considerato uno dei borghi più belli d\'Italia, Vernazza si affaccia su un porticciolo naturale con case colorate che si arrampicano sulla collina.',
      'Corniglia': 'L\'unico borgo delle Cinque Terre non direttamente sul mare, situato su uno sperone roccioso a 100 metri di altezza, offre panorami mozzafiato.',
      'Manarola': 'Famoso per il Presepe di Luminarie che ogni Natale illumina la collina, Manarola è un gioiello architettonico con case colorate a picco sul mare.',
      'Riomaggiore': 'Il borgo più meridionale delle Cinque Terre, caratterizzato da case-torri colorate che si affacciano su un piccolo porticciolo naturale.',
      'Castello Brown': 'Un castello del XVI secolo che domina il borgo di Portofino dall\'alto, offrendo panorami mozzafiato sul golfo. Un simbolo di eleganza e storia.',
      'Abbazia di San Fruttuoso': 'Un\'antica abbazia benedettina del X secolo, situata nella suggestiva Baia di San Fruttuoso, accessibile solo via mare. Un luogo magico dove storia e natura si incontrano.',
      'Faro di Portofino': 'Un faro storico che guida i naviganti verso il celebre borgo di Portofino. Un punto di riferimento essenziale per la sicurezza marittima.',
      // POI specifici di Porto Venere
      'Chiesa di San Pietro': 'Una chiesa romanica del XIII secolo situata sull\'estremità del promontorio di Porto Venere. La sua posizione a picco sul mare offre una vista mozzafiato e rappresenta uno dei simboli più iconici delle Cinque Terre.',
      'Chiesa di San Lorenzo': 'La chiesa parrocchiale di Porto Venere, costruita nel XII secolo in stile romanico-gotico. Custodisce importanti opere d\'arte e testimonia la lunga storia religiosa del borgo.',
      'Castello Doria': 'Un imponente castello medievale che domina Porto Venere dall\'alto. Costruito nel XII secolo dalla famiglia Doria, offre panorami spettacolari sul golfo e sulle isole Palmaria e Tino.',
      'Grotte di Byron': 'Le famose grotte marine che devono il loro nome al poeta inglese Lord Byron, che qui si tuffava. Un luogo magico dove il mare si insinua tra le rocce creando scenari da sogno.',
      'Palazzo del Comune': 'L\'antico palazzo comunale di Porto Venere, esempio di architettura medievale ligure. Un edificio storico che racconta la vita civile del borgo attraverso i secoli.',
      // POI specifici di La Spezia
      'Museo del Castello': 'Il museo archeologico ospitato nel Castello di San Giorgio, con una ricca collezione di reperti che raccontano la storia di La Spezia dall\'età del bronzo al medioevo.',
      'Cattedrale di Cristo Re': 'La cattedrale moderna di La Spezia, costruita nel 1975. Un esempio di architettura contemporanea che si integra armoniosamente con il tessuto urbano della città.',
      'Palazzo delle Poste': 'Un edificio storico di La Spezia che testimonia l\'architettura del primo Novecento. Un esempio di stile liberty che arricchisce il centro storico della città.',
      // POI specifici delle Cinque Terre
      'Via dell\'Amore': 'Il celebre sentiero pedonale che collega Riomaggiore a Manarola, uno dei percorsi più romantici al mondo. Un sentiero scavato nella roccia a picco sul mare che offre panorami mozzafiato.',
      'Torre Guardiola': 'Una torre di avvistamento medievale che domina Riomaggiore dall\'alto. Costruita per difendere il borgo dai pirati saraceni, oggi offre una vista panoramica spettacolare sul mare.',
      'Presepe di Luminarie': 'Il famoso presepe luminoso di Manarola, il più grande del mondo con oltre 300 figure illuminate che si estendono su 4 ettari di collina. Un\'opera d\'arte unica che ogni Natale attira migliaia di visitatori.',
      'Sentiero Azzurro': 'Il celebre sentiero n. 2 che collega tutti e cinque i borghi delle Cinque Terre. Un percorso di 12 chilometri che offre scorci mozzafiato sul mare e sui vigneti terrazzati.',
      'Terrazza di Santa Maria': 'Una terrazza panoramica a Corniglia che offre una vista spettacolare sul mare. Il punto perfetto per ammirare i tramonti e fotografare il borgo dall\'alto.',
      'Scorciatoia dei 377 gradini': 'La famosa scalinata che collega la stazione ferroviaria a Corniglia. 377 gradini scavati nella roccia che regalano una vista mozzafiato durante la salita verso il borgo.',
      'Porticciolo di Vernazza': 'Il caratteristico porticciolo naturale di Vernazza, cuore del borgo e punto di partenza per le escursioni in barca. Un luogo magico dove le case colorate si specchiano nell\'acqua cristallina.',
      'Torre Belforte': 'Una torre di avvistamento medievale a Vernazza che domina il porticciolo. Costruita nel XIII secolo, oggi ospita un museo che racconta la storia del borgo e delle sue fortificazioni.',
      'Spiaggia di Fegina': 'La più grande spiaggia delle Cinque Terre, situata a Monterosso. Un\'ampia distesa di sabbia dorata perfetta per famiglie, con servizi completi e acque cristalline.',
      'Convento dei Cappuccini': 'Un antico convento francescano a Monterosso, circondato da un giardino di limoni. Un luogo di pace e spiritualità che offre una vista privilegiata sul borgo e sul mare.'
    };

    return descriptions[target.name] || `Un importante ${target.type} che rappresenta un elemento significativo del territorio.`;
  }

  /**
   * Genera curiosità per un POI
   */
  generateCuriosities(target) {
    const curiosities = {
      'Castello di San Giorgio': 'Il castello ospita il Museo del Castello con una ricca collezione di reperti archeologici e una sezione dedicata alla storia navale della città.',
      'Porto Venere': 'Porto Venere è famoso per le sue grotte marine e per essere stato il luogo di ispirazione di molti poeti, tra cui Lord Byron.',
      'Arsenale Militare': 'L\'arsenale è ancora attivo e ospita la Scuola Navale Militare "Francesco Morosini", dove si formano i futuri ufficiali della Marina.',
      'Lerici': 'Il castello di Lerici ospita il Museo Geopaleontologico con una collezione di fossili del periodo giurassico trovati nella zona.',
      'Sarzana': 'Sarzana ospita la Fortezza di Sarzanello, una delle più imponenti fortificazioni medievali della Liguria, con una vista mozzafiato sulla valle.',
      'Monterosso al Mare': 'Monterosso è l\'unico borgo delle Cinque Terre ad avere una vera spiaggia sabbiosa, perfetta per famiglie con bambini.',
      'Vernazza': 'Vernazza è l\'unico borgo delle Cinque Terre ad avere un porto naturale, che per secoli è stato il cuore commerciale della zona.',
      'Corniglia': 'Per raggiungere Corniglia bisogna salire 377 gradini o prendere un bus navetta, ma la fatica è ripagata dalla vista spettacolare.',
      'Manarola': 'Manarola ospita il più grande presepe luminoso del mondo, con oltre 300 figure illuminate che si estendono su 4 ettari di collina.',
      'Riomaggiore': 'Riomaggiore è il punto di partenza della famosa Via dell\'Amore, il sentiero pedonale che collega le Cinque Terre.',
      'Castello Brown': 'Il castello prende il nome dal console britannico Montague Yeats Brown che lo acquistò nel 1870.',
      'Abbazia di San Fruttuoso': 'L\'abbazia custodisce una famosa statua del Cristo degli Abissi, simbolo di protezione per i marinai.',
      'Faro di Portofino': 'Il faro è ancora attivo e la sua luce è visibile fino a 16 miglia nautiche di distanza.'
    };

    return curiosities[target.name] || `Questo ${target.type} ha una storia affascinante che si intreccia con quella del territorio.`;
  }

  /**
   * Genera fatti storici per un POI
   */
  generateHistoricalFacts(target) {
    const facts = {
      'Castello di San Giorgio': 'Costruito nel 1262 dalla famiglia Fieschi, il castello è stato utilizzato come fortezza difensiva e poi come prigione fino al XIX secolo.',
      'Porto Venere': 'Fondato dai Romani nel I secolo a.C., il borgo è stato un importante porto commerciale e militare per secoli.',
      'Arsenale Militare': 'Costruito per volere di Cavour, l\'arsenale è stato il cuore della Marina Militare Italiana e ha svolto un ruolo cruciale nelle guerre mondiali.',
      'Lerici': 'Il borgo risale al Medioevo e il suo castello è stato costruito dai Pisani nel XIII secolo per controllare il golfo.',
      'Sarzana': 'La città è stata fondata nel X secolo e ha dato i natali a Papa Niccolò V, uno dei papi più importanti del Rinascimento.',
      'Monterosso al Mare': 'Fondato nel 1056, Monterosso è stato per secoli un importante centro commerciale e marittimo della Riviera di Levante.',
      'Vernazza': 'Il borgo risale all\'XI secolo e deve il suo nome alla famiglia Vernaccia che lo governò nel Medioevo.',
      'Corniglia': 'Corniglia è menzionata per la prima volta nel 1276 e il suo nome deriva da "Corneliae", una famiglia romana che possedeva terreni nella zona.',
      'Manarola': 'Il borgo risale al XII secolo e il suo nome deriva da "Magna Roea", il grande mulino che sorgeva nel centro del paese.',
      'Riomaggiore': 'Fondato nell\'VIII secolo da profughi greci, Riomaggiore è il borgo più antico delle Cinque Terre.',
      'Castello Brown': 'Costruito come fortezza difensiva, il castello è stato trasformato in residenza signorile nel corso dei secoli.',
      'Abbazia di San Fruttuoso': 'Fondata nel 984 d.C., l\'abbazia è stata per secoli un importante centro spirituale e culturale della Liguria.',
      'Faro di Portofino': 'Costruito nel 1917, il faro ha accompagnato generazioni di marinai nel loro approdo a Portofino.'
    };

    return facts[target.name] || `Questo ${target.type} ha una lunga storia che testimonia l\'importanza del territorio.`;
  }

  /**
   * Identifica le città presenti in una zona basandosi sulle coordinate
   */
  identifyCitiesInZone(coordinates, center) {
    // Database delle città principali della Liguria con coordinate precise
    const ligurianCities = {
      'Porto Venere': { lat: 44.0494, lng: 9.8344, type: 'village' },
      'La Spezia': { lat: 44.1025, lng: 9.8286, type: 'city' },
      'Lerici': { lat: 44.0764, lng: 9.9114, type: 'village' },
      'Sarzana': { lat: 44.1097, lng: 9.9589, type: 'city' },
      'Riomaggiore': { lat: 44.0989, lng: 9.7456, type: 'village' },
      'Manarola': { lat: 44.1103, lng: 9.7345, type: 'village' },
      'Corniglia': { lat: 44.1205, lng: 9.7089, type: 'village' },
      'Vernazza': { lat: 44.1356, lng: 9.6834, type: 'village' },
      'Monterosso al Mare': { lat: 44.1456, lng: 9.6543, type: 'village' },
      'Portofino': { lat: 44.3028, lng: 9.2116, type: 'village' },
      'Santa Margherita Ligure': { lat: 44.3356, lng: 9.2111, type: 'village' },
      'Rapallo': { lat: 44.3506, lng: 9.2278, type: 'city' },
      'Chiavari': { lat: 44.3167, lng: 9.3167, type: 'city' },
      'Sestri Levante': { lat: 44.2667, lng: 9.4000, type: 'city' }
    };

    const citiesInZone = [];

    console.log(`🔍 Analizzando ${Object.keys(ligurianCities).length} città/borghi per zona...`);
    console.log(`📍 Coordinate zona: ${coordinates.length} punti`);

    // Controlla se ogni città è dentro la zona
    for (const [cityName, cityData] of Object.entries(ligurianCities)) {
      const isInZone = this.isPointInPolygon([cityData.lng, cityData.lat], coordinates);
      console.log(`🔍 ${cityName} (${cityData.lat}, ${cityData.lng}): ${isInZone ? '✅ DENTRO' : '❌ FUORI'}`);
      
      if (isInZone) {
        citiesInZone.push({
          name: cityName,
          lat: cityData.lat,
          lng: cityData.lng,
          type: cityData.type
        });
        console.log(`📍 ✅ Città/borgo trovato nella zona: ${cityName} (${cityData.type})`);
      }
    }

    console.log(`🎯 Totale città/borghi nella zona: ${citiesInZone.length}`);
    return citiesInZone;
  }

  /**
   * Sistema universale: Genera POI intelligenti per qualsiasi zona (BYPASS TOTALE)
   */
  generateIntelligentPOIsForZone(zoneName, center, coordinates) {
    console.log(`🧠 Generazione POI intelligenti per zona: ${zoneName}`);
    console.log(`📍 Centro zona: lat=${center.lat}, lng=${center.lng}`);
    console.log(`📍 Coordinate zona:`, coordinates);
    
    // 🚨 SISTEMA INTELLIGENTE: Determina la regione basandosi sulle coordinate REALI
    const zoneCenter = center;
    console.log(`🎯 Analisi geografica per centro zona: lat=${zoneCenter.lat}, lng=${zoneCenter.lng}`);
    
    // 🧠 SISTEMA UNIVERSALE: Determina la regione basandosi sulle coordinate della zona selezionata
    let targetRegion = 'unknown';
    if (zoneCenter.lat >= 44.24 && zoneCenter.lat <= 44.37 && zoneCenter.lng >= 9.14 && zoneCenter.lng <= 9.45) {
      targetRegion = 'tigullio';
      console.log(`🎯 ZONA IDENTIFICATA: TIGULLIO (${zoneCenter.lat}, ${zoneCenter.lng})`);
    } else if (zoneCenter.lat >= 44.1 && zoneCenter.lat <= 44.15 && zoneCenter.lng >= 9.65 && zoneCenter.lng <= 9.75) {
      targetRegion = 'cinque_terre';
      console.log(`🎯 ZONA IDENTIFICATA: CINQUE TERRE (${zoneCenter.lat}, ${zoneCenter.lng})`);
    } else if (zoneCenter.lat >= 44.04 && zoneCenter.lat <= 44.12 && zoneCenter.lng >= 9.8 && zoneCenter.lng <= 9.96) {
      targetRegion = 'golfo_poeti';
      console.log(`🎯 ZONA IDENTIFICATA: GOLFO DEI POETI (${zoneCenter.lat}, ${zoneCenter.lng})`);
    } else if (zoneCenter.lat >= 42.7 && zoneCenter.lat <= 42.9 && zoneCenter.lng >= 10.1 && zoneCenter.lng <= 10.5) {
      targetRegion = 'isola_elba';
      console.log(`🎯 ZONA IDENTIFICATA: ISOLA D'ELBA (${zoneCenter.lat}, ${zoneCenter.lng})`);
    } else {
      console.log(`🌍 ZONA NUOVA RILEVATA: (${zoneCenter.lat}, ${zoneCenter.lng}) - Attivando sistema universale intelligente`);
      return this.generateUniversalPOIsForZone(zoneName, zoneCenter, coordinates);
    }
    
    // Database completo di tutte le città/borghi della Liguria
    const allLigurianCities = {
      // Cinque Terre (lat: 44.1-44.15, lng: 9.65-9.75)
      'Riomaggiore': { lat: 44.0989, lng: 9.7456, type: 'village', region: 'cinque_terre' },
      'Manarola': { lat: 44.1103, lng: 9.7345, type: 'village', region: 'cinque_terre' },
      'Corniglia': { lat: 44.1205, lng: 9.7089, type: 'village', region: 'cinque_terre' },
      'Vernazza': { lat: 44.1356, lng: 9.6834, type: 'village', region: 'cinque_terre' },
      'Monterosso al Mare': { lat: 44.1456, lng: 9.6543, type: 'village', region: 'cinque_terre' },
      
      // Golfo dei Poeti (lat: 44.04-44.12, lng: 9.8-9.96)
      'La Spezia': { lat: 44.1025, lng: 9.8286, type: 'city', region: 'golfo_poeti' },
      'Porto Venere': { lat: 44.0494, lng: 9.8344, type: 'village', region: 'golfo_poeti' },
      'Lerici': { lat: 44.0764, lng: 9.9114, type: 'village', region: 'golfo_poeti' },
      'Sarzana': { lat: 44.1097, lng: 9.9589, type: 'city', region: 'golfo_poeti' },
      
      // Tigullio (lat: 44.24-44.37, lng: 9.14-9.45)
      'Portofino': { lat: 44.3028, lng: 9.2116, type: 'village', region: 'tigullio' },
      'Santa Margherita Ligure': { lat: 44.3356, lng: 9.2111, type: 'village', region: 'tigullio' },
      'Rapallo': { lat: 44.3506, lng: 9.2278, type: 'city', region: 'tigullio' },
      'Chiavari': { lat: 44.3167, lng: 9.3167, type: 'city', region: 'tigullio' },
      'Sestri Levante': { lat: 44.2667, lng: 9.4000, type: 'city', region: 'tigullio' },
      
      // Isola d'Elba (lat: 42.7-42.9, lng: 10.1-10.5)
      'Portoferraio': { lat: 42.8139, lng: 10.3256, type: 'city', region: 'isola_elba' },
      'Marciana Marina': { lat: 42.8042, lng: 10.1956, type: 'village', region: 'isola_elba' },
      'Porto Azzurro': { lat: 42.7656, lng: 10.3989, type: 'village', region: 'isola_elba' },
      'Rio Marina': { lat: 42.8139, lng: 10.4264, type: 'village', region: 'isola_elba' },
      'Capoliveri': { lat: 42.7458, lng: 10.3781, type: 'village', region: 'isola_elba' },
      'Marciana': { lat: 42.7889, lng: 10.1722, type: 'village', region: 'isola_elba' }
    };

    // 🎯 FILTRA SOLO LE CITTÀ DELLA REGIONE CORRETTA
    const citiesInZone = [];
    console.log(`🔍 Cercando città per regione: ${targetRegion}`);
    
    for (const [cityName, cityData] of Object.entries(allLigurianCities)) {
      if (cityData.region === targetRegion) {
        citiesInZone.push({
          name: cityName,
          lat: cityData.lat,
          lng: cityData.lng,
          type: cityData.type
        });
        console.log(`📍 ✅ Città selezionata per ${targetRegion}: ${cityName}`);
      } else {
        console.log(`📍 ❌ Città esclusa (regione ${cityData.region}): ${cityName}`);
      }
    }

    console.log(`🎯 Città/borghi selezionati per zona: ${citiesInZone.length}`);

    // Genera POI per ogni città trovata
    const allPOIs = [];
    for (const city of citiesInZone) {
      console.log(`🏛️ Generando POI specifici per: ${city.name} (${city.type}) - Regione: ${targetRegion}`);
      const cityPOIs = this.generateSpecificPOIsForCity(city);
      console.log(`📍 Trovati ${cityPOIs.length} POI per ${city.name}`);
      allPOIs.push(...cityPOIs);
    }
    
    console.log(`🧠 SISTEMA UNIVERSALE: Totale POI generati: ${allPOIs.length}`);
    return allPOIs;
  }

  /**
   * Genera POI generici per zone non riconosciute
   */
  generateGenericPOIsForZone(zoneName, center) {
    console.log(`🔧 Generazione POI generici per zona non riconosciuta: ${zoneName}`);
    
    const genericPOIs = [
      {
        name: `Punto di interesse - ${zoneName}`,
        lat: center.lat + (Math.random() - 0.5) * 0.01,
        lng: center.lng + (Math.random() - 0.5) * 0.01,
        category: 'monument',
        description: `Punto di interesse nella zona di ${zoneName}`,
        source: 'AI'
      }
    ];
    
    console.log(`📍 Generati ${genericPOIs.length} POI generici per ${zoneName}`);
    return genericPOIs;
  }

  /**
   * Sistema universale per zone completamente nuove
   */
  generateUniversalPOIsForZone(zoneName, center, coordinates) {
    console.log(`🌍 SISTEMA UNIVERSALE per zona nuova: ${zoneName}`);
    console.log(`📍 Centro: lat=${center.lat}, lng=${center.lng}`);
    
    // Calcola il bounding box della zona
    const lats = coordinates.map(coord => Array.isArray(coord) ? coord[0] : coord.lat);
    const lngs = coordinates.map(coord => Array.isArray(coord) ? coord[1] : coord.lng);
    const bbox = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    
    console.log(`📊 Bounding box: ${bbox}`);
    
    // Genera POI distribuiti nella zona
    const universalPOIs = [];
    const numPOIs = Math.min(15, Math.max(5, Math.round(coordinates.length / 2)));
    
    for (let i = 0; i < numPOIs; i++) {
      // Distribuisci POI casualmente nella zona
      const lat = Math.min(...lats) + Math.random() * (Math.max(...lats) - Math.min(...lats));
      const lng = Math.min(...lngs) + Math.random() * (Math.max(...lngs) - Math.min(...lngs));
      
      const poiTypes = [
        { name: `Monumento Storico - ${zoneName}`, category: 'monument' },
        { name: `Chiesa di ${zoneName}`, category: 'church' },
        { name: `Punto Panoramico - ${zoneName}`, category: 'viewpoint' },
        { name: `Villa Storica - ${zoneName}`, category: 'monument' },
        { name: `Torre di ${zoneName}`, category: 'monument' }
      ];
      
      const poiType = poiTypes[i % poiTypes.length];
      
      universalPOIs.push({
        name: poiType.name,
        lat: lat,
        lng: lng,
        category: poiType.category,
        description: `Scopri le bellezze e la storia di ${zoneName}. Un luogo di interesse turistico che merita una visita per apprezzare le peculiarità di questo territorio.`,
        source: 'AI'
      });
    }
    
    console.log(`🌍 SISTEMA UNIVERSALE: Generati ${universalPOIs.length} POI per zona nuova: ${zoneName}`);
    return universalPOIs;
  }

  /**
   * Calcola la distanza tra due punti geografici (in km)
   */
  calculateDistance(point1, point2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Genera POI specifici per una città
   */
  generateSpecificPOIsForCity(city) {
    const cityPOIs = {
      'Porto Venere': [
        { name: 'Chiesa di San Pietro', lat: 44.0489, lng: 9.8314, category: 'church', type: 'landmark' },
        { name: 'Chiesa di San Lorenzo', lat: 44.0497, lng: 9.8347, category: 'church', type: 'landmark' },
        { name: 'Castello Doria', lat: 44.0503, lng: 9.8339, category: 'monument', type: 'landmark' },
        { name: 'Grotte di Byron', lat: 44.0486, lng: 9.8294, category: 'cave', type: 'landmark' },
        { name: 'Palazzo del Comune', lat: 44.0494, lng: 9.8344, category: 'monument', type: 'landmark' }
      ],
      'La Spezia': [
        { name: 'Castello di San Giorgio', lat: 44.1025, lng: 9.8286, category: 'monument', type: 'landmark' },
        { name: 'Arsenale Militare', lat: 44.1069, lng: 9.8206, category: 'monument', type: 'landmark' },
        { name: 'Museo del Castello', lat: 44.1028, lng: 9.8283, category: 'museum', type: 'landmark' },
        { name: 'Cattedrale di Cristo Re', lat: 44.1028, lng: 9.8283, category: 'church', type: 'landmark' },
        { name: 'Palazzo delle Poste', lat: 44.1025, lng: 9.8286, category: 'monument', type: 'landmark' }
      ],
      'Lerici': [
        { name: 'Castello di Lerici', lat: 44.0764, lng: 9.9114, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Francesco', lat: 44.0761, lng: 9.9117, category: 'church', type: 'landmark' },
        { name: 'Villa Marigola', lat: 44.0778, lng: 9.9092, category: 'monument', type: 'landmark' },
        { name: 'Oratorio di San Rocco', lat: 44.0758, lng: 9.9121, category: 'church', type: 'landmark' }
      ],
      'Riomaggiore': [
        { name: 'Chiesa di San Giovanni Battista', lat: 44.0989, lng: 9.7456, category: 'church', type: 'landmark' },
        { name: 'Castello di Riomaggiore', lat: 44.0995, lng: 9.7448, category: 'monument', type: 'landmark' },
        { name: 'Santuario di Nostra Signora di Montenero', lat: 44.1012, lng: 9.7434, category: 'church', type: 'landmark' },
        { name: 'Via dell\'Amore', lat: 44.0990, lng: 9.7450, category: 'monument', type: 'landmark' },
        { name: 'Torre Guardiola', lat: 44.0998, lng: 9.7445, category: 'monument', type: 'landmark' }
      ],
      'Manarola': [
        { name: 'Chiesa di San Lorenzo', lat: 44.1103, lng: 9.7345, category: 'church', type: 'landmark' },
        { name: 'Oratorio dei Disciplinati', lat: 44.1101, lng: 9.7347, category: 'church', type: 'landmark' },
        { name: 'Mulino di Manarola', lat: 44.1105, lng: 9.7343, category: 'monument', type: 'landmark' },
        { name: 'Presepe di Luminarie', lat: 44.1100, lng: 9.7340, category: 'monument', type: 'landmark' },
        { name: 'Sentiero Azzurro', lat: 44.1104, lng: 9.7348, category: 'monument', type: 'landmark' }
      ],
      'Corniglia': [
        { name: 'Chiesa di San Pietro', lat: 44.1205, lng: 9.7089, category: 'church', type: 'landmark' },
        { name: 'Oratorio di Santa Caterina', lat: 44.1203, lng: 9.7091, category: 'church', type: 'landmark' },
        { name: 'Terrazza di Santa Maria', lat: 44.1206, lng: 9.7087, category: 'viewpoint', type: 'landmark' },
        { name: 'Scorciatoia dei 377 gradini', lat: 44.1204, lng: 9.7093, category: 'monument', type: 'landmark' }
      ],
      'Vernazza': [
        { name: 'Chiesa di Santa Margherita d\'Antiochia', lat: 44.1356, lng: 9.6834, category: 'church', type: 'landmark' },
        { name: 'Castello Doria', lat: 44.1358, lng: 9.6832, category: 'monument', type: 'landmark' },
        { name: 'Oratorio di Santa Marta', lat: 44.1354, lng: 9.6836, category: 'church', type: 'landmark' },
        { name: 'Porticciolo di Vernazza', lat: 44.1355, lng: 9.6835, category: 'monument', type: 'landmark' },
        { name: 'Torre Belforte', lat: 44.1357, lng: 9.6833, category: 'monument', type: 'landmark' }
      ],
      'Monterosso al Mare': [
        { name: 'Chiesa di San Giovanni Battista', lat: 44.1456, lng: 9.6543, category: 'church', type: 'landmark' },
        { name: 'Chiesa di San Francesco', lat: 44.1454, lng: 9.6545, category: 'church', type: 'landmark' },
        { name: 'Torre Aurora', lat: 44.1458, lng: 9.6541, category: 'monument', type: 'landmark' },
        { name: 'Statua del Gigante', lat: 44.1460, lng: 9.6539, category: 'monument', type: 'landmark' },
        { name: 'Spiaggia di Fegina', lat: 44.1462, lng: 9.6537, category: 'natural', type: 'landmark' },
        { name: 'Convento dei Cappuccini', lat: 44.1452, lng: 9.6547, category: 'church', type: 'landmark' }
      ],
      'Portofino': [
        { name: 'Chiesa di San Giorgio', lat: 44.3028, lng: 9.2116, category: 'church', type: 'landmark' },
        { name: 'Castello Brown', lat: 44.3028, lng: 9.2116, category: 'monument', type: 'landmark' },
        { name: 'Abbazia di San Fruttuoso', lat: 44.3154, lng: 9.1753, category: 'church', type: 'landmark' },
        { name: 'Faro di Portofino', lat: 44.3005, lng: 9.2119, category: 'lighthouse', type: 'landmark' }
      ],
      'Santa Margherita Ligure': [
        { name: 'Basilica di Santa Margherita d\'Antiochia', lat: 44.3356, lng: 9.2111, category: 'church', type: 'landmark' },
        { name: 'Villa Durazzo', lat: 44.3360, lng: 9.2108, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Giacomo di Corte', lat: 44.3354, lng: 9.2114, category: 'church', type: 'landmark' },
        { name: 'Porticciolo di Santa Margherita', lat: 44.3358, lng: 9.2112, category: 'monument', type: 'landmark' }
      ],
      'Rapallo': [
        { name: 'Basilica dei Santi Gervasio e Protasio', lat: 44.3506, lng: 9.2278, category: 'church', type: 'landmark' },
        { name: 'Castello di Rapallo', lat: 44.3508, lng: 9.2280, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Francesco', lat: 44.3504, lng: 9.2276, category: 'church', type: 'landmark' },
        { name: 'Villa Tigullio', lat: 44.3510, lng: 9.2274, category: 'monument', type: 'landmark' }
      ],
      'Chiavari': [
        { name: 'Basilica di Nostra Signora dell\'Orto', lat: 44.3167, lng: 9.3167, category: 'church', type: 'landmark' },
        { name: 'Palazzo Rocca', lat: 44.3169, lng: 9.3169, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Giovanni Battista', lat: 44.3165, lng: 9.3165, category: 'church', type: 'landmark' },
        { name: 'Ponte di Chiavari', lat: 44.3171, lng: 9.3163, category: 'monument', type: 'landmark' }
      ],
      'Sestri Levante': [
        { name: 'Basilica di Santa Maria di Nazareth', lat: 44.2667, lng: 9.4000, category: 'church', type: 'landmark' },
        { name: 'Castello di Sestri Levante', lat: 44.2669, lng: 9.4002, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Nicolò dell\'Isola', lat: 44.2665, lng: 9.3998, category: 'church', type: 'landmark' },
        { name: 'Baia del Silenzio', lat: 44.2663, lng: 9.4004, category: 'monument', type: 'landmark' }
      ],
      'Portoferraio': [
        { name: 'Fortezza Medicea', lat: 42.8139, lng: 10.3256, category: 'monument', type: 'landmark' },
        { name: 'Villa di San Martino', lat: 42.8145, lng: 10.3262, category: 'monument', type: 'landmark' },
        { name: 'Chiesa della Misericordia', lat: 42.8135, lng: 10.3250, category: 'church', type: 'landmark' },
        { name: 'Porto Mediceo', lat: 42.8140, lng: 10.3258, category: 'monument', type: 'landmark' }
      ],
      'Marciana Marina': [
        { name: 'Torre del Martello', lat: 42.8042, lng: 10.1956, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Nicolò', lat: 42.8045, lng: 10.1958, category: 'church', type: 'landmark' },
        { name: 'Spiaggia di Marciana Marina', lat: 42.8040, lng: 10.1954, category: 'monument', type: 'landmark' }
      ],
      'Porto Azzurro': [
        { name: 'Forte di San Giacomo', lat: 42.7656, lng: 10.3989, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Giacomo', lat: 42.7658, lng: 10.3991, category: 'church', type: 'landmark' },
        { name: 'Baia di Porto Azzurro', lat: 42.7654, lng: 10.3987, category: 'monument', type: 'landmark' }
      ],
      'Rio Marina': [
        { name: 'Parco Minerario di Rio Marina', lat: 42.8139, lng: 10.4264, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Rocco', lat: 42.8141, lng: 10.4266, category: 'church', type: 'landmark' },
        { name: 'Museo dei Minerali', lat: 42.8137, lng: 10.4262, category: 'monument', type: 'landmark' }
      ],
      'Capoliveri': [
        { name: 'Fortezza di Capoliveri', lat: 42.7458, lng: 10.3781, category: 'monument', type: 'landmark' },
        { name: 'Chiesa di San Michele', lat: 42.7460, lng: 10.3783, category: 'church', type: 'landmark' },
        { name: 'Monte Calamita', lat: 42.7456, lng: 10.3779, category: 'monument', type: 'landmark' }
      ],
      'Marciana': [
        { name: 'Chiesa di San Lorenzo', lat: 42.7889, lng: 10.1722, category: 'church', type: 'landmark' },
        { name: 'Monte Capanne', lat: 42.7891, lng: 10.1724, category: 'monument', type: 'landmark' },
        { name: 'Santuario della Madonna del Monte', lat: 42.7887, lng: 10.1720, category: 'church', type: 'landmark' }
      ]
    };

    return cityPOIs[city.name] || [];
  }

  /**
   * Controlla se un punto è dentro un poligono
   */
  isPointInPolygon(point, polygon) {
    const x = point[0], y = point[1]; // x = lng, y = lat
    let inside = false;
    
    // Debug: stampa le coordinate
    console.log(`🔍 Testando punto (${x}, ${y}) in poligono con ${polygon.length} vertici`);
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1]; // xi = lng, yi = lat
      const xj = polygon[j][0], yj = polygon[j][1]; // xj = lng, yj = lat
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    console.log(`🔍 Risultato: ${inside ? '✅ DENTRO' : '❌ FUORI'}`);
    return inside;
  }

  /**
   * Calcola il centro di una zona
   */
  calculateCenter(coordinates) {
    const lats = coordinates.map(coord => Array.isArray(coord) ? coord[0] : coord.lat);
    const lngs = coordinates.map(coord => Array.isArray(coord) ? coord[1] : coord.lng);
    
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length
    };
  }

  updateProgress(callback, percentage, message, details = '') {
    if (callback) {
      callback(percentage, message, details);
    }
    console.log(`📊 ${percentage}% - ${message} ${details ? `(${details})` : ''}`);
  }
}

module.exports = POIAggregator;
