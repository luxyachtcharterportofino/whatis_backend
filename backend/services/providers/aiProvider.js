// ===============================
// 🤖 AI Provider
// Genera descrizioni emozionali e turistiche
// ===============================

class AIProvider {
  constructor() {
    this.templates = {
      'museum': {
        museum: 'Un museo che custodisce tesori d\'arte e cultura, offrendo ai visitatori un viaggio nel tempo attraverso collezioni uniche e mostre di grande valore artistico.',
        attraction: 'Un\'attrazione culturale che incanta i visitatori con la sua bellezza e il suo significato storico, rappresentando un pezzo importante del patrimonio locale.'
      },
      'monument': {
        monument: 'Un monumento che racconta le gesta del passato e onora coloro che hanno contribuito alla storia del territorio, offrendo un momento di riflessione e memoria.',
        castle: 'Un castello che domina il paesaggio con la sua imponente presenza, testimone di battaglie, intrighi e vicende storiche che hanno segnato il destino della regione.',
        ruins: 'Rovine che evocano l\'antica grandezza di un tempo passato, permettendo ai visitatori di immaginare la vita che un tempo animava questi luoghi suggestivi.'
      },
      'church': {
        church: 'Un luogo di culto che racchiude secoli di storia e spiritualità, con architettura suggestiva e opere d\'arte che testimoniano la devozione e l\'arte sacra.'
      },
      'beach': {
        beach: 'Una spiaggia incantevole dove il mare cristallino incontra la sabbia dorata, offrendo un paradiso naturale per relax e contemplazione del paesaggio costiero.',
        bay: 'Una baia protetta che offre un rifugio naturale per la fauna marina e un angolo di pace per chi cerca la tranquillità e la bellezza del mare.',
        cliff: 'Scogliere imponenti che si gettano nel mare, offrendo panorami mozzafiato e un\'esperienza di contatto diretto con la forza primitiva della natura.'
      },
      'marina': {
        marina: 'Un porto turistico che accoglie i navigatori con servizi di qualità, offrendo un punto di partenza ideale per esplorare le bellezze del mare e della costa.',
        harbour: 'Un porto che pulsa di vita marina, dove si mescolano tradizione e modernità, offrendo ai visitatori un assaggio dell\'autentica vita costiera.'
      },
      'lighthouse': {
        lighthouse: 'Un faro che guida i naviganti con la sua luce rassicurante, simbolo di sicurezza e punto di riferimento per chi solca i mari, con una storia affascinante da scoprire.'
      }
    };

    this.genericDescriptions = {
      'museum': 'Un museo che custodisce tesori artistici e storici, offrendo ai visitatori l\'opportunità di immergersi nella ricchezza del patrimonio locale.',
      'monument': 'Un monumento che racconta le vicende del passato e testimonia l\'evoluzione del territorio, permettendo di comprendere meglio la storia e le tradizioni della regione.',
      'church': 'Un luogo di culto che custodisce secoli di storia e spiritualità, offrendo ai visitatori un momento di pace e contemplazione.',
      'beach': 'Una spiaggia che offre pace e bellezza, dove i visitatori possono riconnettersi con l\'ambiente naturale e godere di panorami suggestivi.',
      'marina': 'Un porto che offre servizi e informazioni utili per esplorare le bellezze costiere e marine del territorio.',
      'lighthouse': 'Un faro che guida i naviganti e offre panorami mozzafiato sul mare, simbolo di sicurezza e punto di riferimento per la navigazione.',
      'other': 'Un luogo di interesse che merita una visita per scoprire le peculiarità e le bellezze nascoste del territorio, offrendo un\'esperienza autentica e memorabile.'
    };
  }

  generateDescription(poi) {
    // Se il POI ha già una descrizione da Wikipedia, la migliora
    if (poi.description && poi.description.length > 50) {
      return this.enhanceDescription(poi);
    }

    // Altrimenti genera una descrizione da zero
    return this.createNewDescription(poi);
  }

  enhanceDescription(poi) {
    const originalDescription = poi.description;
    
    // Aggiunge un tocco emozionale alla descrizione esistente
    const enhancements = [
      'Un luogo che incanta i visitatori con',
      'Un posto magico dove si respira',
      'Un angolo suggestivo che racconta',
      'Un luogo affascinante che custodisce',
      'Un posto unico che offre'
    ];

    const enhancement = enhancements[Math.floor(Math.random() * enhancements.length)];
    
    // Se la descrizione è troppo tecnica, la rende più turistica
    if (originalDescription.includes('è un') || originalDescription.includes('si trova')) {
      return `${enhancement} ${originalDescription.toLowerCase()}`;
    }
    
    return originalDescription;
  }

  createNewDescription(poi) {
    const category = poi.category;
    const name = poi.name.toLowerCase();
    
    // Cerca un template specifico basato sul nome
    if (this.templates[category]) {
      for (const [key, template] of Object.entries(this.templates[category])) {
        if (name.includes(key)) {
          return template;
        }
      }
    }
    
    // Usa un template generico per la categoria
    return this.genericDescriptions[category] || this.genericDescriptions['Altro'];
  }

  addEmotionalTouch(description) {
    const emotionalPrefixes = [
      'Immergiti nella bellezza di',
      'Scopri la magia di',
      'Vivi l\'emozione di',
      'Esplora l\'incanto di',
      'Goditi la suggestione di'
    ];

    const prefix = emotionalPrefixes[Math.floor(Math.random() * emotionalPrefixes.length)];
    
    // Aggiunge il prefisso solo se la descrizione non è già emozionale
    if (!description.includes('incanta') && !description.includes('magia') && !description.includes('suggestivo')) {
      return `${prefix} ${description.toLowerCase()}`;
    }
    
    return description;
  }

  generateCuriosities(poi) {
    const curiosities = {
      'museum': [
        'Questo museo custodisce opere d\'arte e reperti storici di grande valore, testimoni di epoche passate.',
        'L\'architettura di questo edificio riflette le influenze artistiche e culturali che hanno attraversato il territorio.',
        'Molti artisti e personaggi illustri hanno trovato ispirazione in questo luogo suggestivo.'
      ],
      'monument': [
        'Questo monumento custodisce segreti e leggende che si tramandano di generazione in generazione.',
        'La storia di questo luogo si intreccia con quella di personaggi famosi e avvenimenti epocali.',
        'Questo sito ha resistito alle intemperie del tempo, testimoniando la forza e la determinazione dei suoi costruttori.'
      ],
      'church': [
        'Questo luogo di culto custodisce opere d\'arte sacra e testimonianze di fede secolari.',
        'L\'architettura sacra di questo edificio riflette lo stile artistico dell\'epoca di costruzione.',
        'Molti fedeli e pellegrini hanno trovato conforto e spiritualità in questo luogo sacro.'
      ],
      'beach': [
        'Questa spiaggia offre rifugio a specie animali e vegetali rare e protette.',
        'I colori e i profumi di questo luogo cambiano con le stagioni, offrendo sempre nuove emozioni.',
        'Questo ambiente naturale è perfetto per chi cerca pace e riconnessione con la natura.'
      ],
      'marina': [
        'Questo porto ha ospitato generazioni di navigatori e marinai nel loro approdo sicuro.',
        'La vista da questo luogo offre panorami mozzafiato sul mare e sulla costa.',
        'Questo sito è il punto di partenza ideale per esplorare le bellezze marine della zona.'
      ],
      'lighthouse': [
        'Questo faro ha guidato generazioni di navigatori verso destinazioni sicure.',
        'La luce di questo faro è visibile a grande distanza, simbolo di sicurezza per i marinai.',
        'Questo punto di riferimento ha una storia affascinante legata alla navigazione e al mare.'
      ]
    };

    const categoryCuriosities = curiosities[poi.category] || curiosities['museum'];
    return categoryCuriosities[Math.floor(Math.random() * categoryCuriosities.length)];
  }

  generateHistoricalFacts(poi) {
    const facts = {
      'museum': 'Questo museo rappresenta un importante tassello del patrimonio artistico e storico della regione.',
      'monument': 'Le origini di questo monumento risalgono a epoche antiche, testimoniando l\'evoluzione del territorio nel corso dei secoli.',
      'church': 'Questo luogo di culto ha una storia secolare che si intreccia con quella della comunità locale.',
      'beach': 'Questa spiaggia ha mantenuto le sue caratteristiche naturali originali, offrendo un rifugio per la biodiversità locale.',
      'marina': 'Questo porto ha accompagnato la storia della navigazione e del commercio nella regione.',
      'lighthouse': 'Questo faro ha una storia affascinante legata alla sicurezza marittima e alla navigazione costiera.'
    };

    return facts[poi.category] || facts['museum'];
  }
}

module.exports = AIProvider;
