// ===============================
// 📚 Wikipedia/Wikidata Provider
// Arricchisce POI con descrizioni e contesto storico
// ===============================

const axios = require('axios');

class WikiProvider {
  constructor() {
    this.wikipediaApiUrl = 'https://it.wikipedia.org/api/rest_v1/page/summary';
    this.wikidataApiUrl = 'https://www.wikidata.org/w/api.php';
    this.requestDelay = 1000; // 1 secondo tra richieste
    this.lastRequest = 0;
    this.userAgent = 'WhatisBackend/1.0 (Educational Research)';
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();
  }

  async enrichPOI(poi) {
    try {
      await this.waitForRateLimit();
      
      // Cerca su Wikipedia
      const wikiData = await this.searchWikipedia(poi.name);
      if (wikiData) {
        poi.description = this.createDescription(wikiData, poi);
        poi.wikiUrl = wikiData.content_urls?.desktop?.page;
        poi.source = poi.source.replace('osm', 'wikipedia');
        return poi;
      }
      
      // Fallback: cerca per categoria e località
      const categorySearch = await this.searchByCategory(poi);
      if (categorySearch) {
        poi.description = this.createGenericDescription(poi);
        poi.source = poi.source.replace('osm', 'wikipedia');
        return poi;
      }
      
      return poi;
    } catch (error) {
      console.log(`❌ Wiki enrichment failed for ${poi.name}: ${error.message}`);
      return poi;
    }
  }

  async searchWikipedia(name) {
    try {
      const searchName = this.cleanNameForSearch(name);
      const response = await axios.get(`${this.wikipediaApiUrl}/${encodeURIComponent(searchName)}`, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000
      });
      
      if (response.data && response.data.extract) {
        return response.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async searchByCategory(poi) {
    try {
      // Cerca per categoria generica
      const categoryTerms = this.getCategorySearchTerms(poi.category);
      for (const term of categoryTerms) {
        const response = await axios.get(`${this.wikipediaApiUrl}/${encodeURIComponent(term)}`, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 10000
        });
        
        if (response.data && response.data.extract) {
          return response.data;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  cleanNameForSearch(name) {
    return name
      .replace(/[^\w\s]/g, '') // Rimuove caratteri speciali
      .replace(/\s+/g, ' ') // Normalizza spazi
      .trim();
  }

  getCategorySearchTerms(category) {
    const terms = {
      'Cultura': ['Museo', 'Arte', 'Cultura italiana'],
      'Storia': ['Monumento storico', 'Castello', 'Storia italiana'],
      'Natura': ['Spiaggia', 'Natura', 'Parco naturale'],
      'Turismo Nautico': ['Porto', 'Marina', 'Faro'],
      'Altro': ['Punto di interesse', 'Turismo']
    };
    return terms[category] || ['Punto di interesse'];
  }

  createDescription(wikiData, poi) {
    if (!wikiData.extract) {
      return this.createGenericDescription(poi);
    }

    const extract = wikiData.extract;
    
    // Se l'estratto è troppo lungo, lo accorcia
    if (extract.length > 300) {
      const sentences = extract.split('. ');
      let description = sentences[0];
      if (sentences.length > 1) {
        description += '. ' + sentences[1];
      }
      description = description.substring(0, 250) + '...';
      return description;
    }
    
    return extract;
  }

  createGenericDescription(poi) {
    const templates = {
      'Cultura': `Un luogo di interesse culturale che offre ai visitatori la possibilità di scoprire arte, tradizioni e storia locale.`,
      'Storia': `Un sito storico che racconta le vicende del passato e testimonia l'evoluzione del territorio nel corso dei secoli.`,
      'Natura': `Un luogo naturale che permette di immergersi nella bellezza del paesaggio e godere della tranquillità dell'ambiente.`,
      'Turismo Nautico': `Un punto di riferimento per i naviganti e gli amanti del mare, che offre servizi e informazioni utili per la navigazione.`,
      'Altro': `Un punto di interesse che merita una visita per scoprire le peculiarità e le bellezze del territorio.`
    };
    
    return templates[poi.category] || templates['Altro'];
  }
}

module.exports = WikiProvider;
