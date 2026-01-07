// ===============================
// 📚 Wikidata POI Service
// Servizio per verifica POI tramite Wikidata SPARQL
// ===============================

const axios = require('axios');
const Logger = require('../utils/logger');

class WikidataPoiService {
  constructor() {
    this.sparqlUrl = 'https://query.wikidata.org/sparql';
    this.timeout = 15000;
  }

  /**
   * Verifica se il servizio è disponibile (sempre disponibile, è pubblico)
   */
  isAvailable() {
    return true;
  }

  /**
   * Cerca POI in un comune specifico
   * @param {string} municipality - Nome del comune
   * @param {number} lat - Latitudine approssimativa
   * @param {number} lng - Longitudine approssimativa
   * @returns {Array} - Array di POI trovati
   */
  async searchPOIs(municipality, lat, lng) {
    try {
      // Query SPARQL per trovare luoghi nel comune
      const sparqlQuery = `
        SELECT ?item ?itemLabel ?lat ?lon ?instanceOf ?instanceOfLabel ?description WHERE {
          ?item wdt:P131* wd:Q[COMUNE_ID] .
          ?item wdt:P625 ?coord .
          BIND(xsd:decimal(strbefore(str(?coord), " ")) AS ?lat)
          BIND(xsd:decimal(strafter(str(?coord), " ")) AS ?lon)
          OPTIONAL { ?item wdt:P31 ?instanceOf }
          OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "it") }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it" }
          FILTER(
            ?lat >= ${(lat - 0.1).toFixed(4)} && ?lat <= ${(lat + 0.1).toFixed(4)} &&
            ?lon >= ${(lng - 0.1).toFixed(4)} && ?lon <= ${(lng + 0.1).toFixed(4)}
          )
        }
        LIMIT 50
      `;

      // Per ora usiamo una query più semplice che cerca per nome comune
      const simpleQuery = `
        SELECT ?item ?itemLabel ?lat ?lon ?instanceOf ?instanceOfLabel ?description WHERE {
          ?item rdfs:label "${municipality}"@it .
          ?item wdt:P625 ?coord .
          BIND(xsd:decimal(strbefore(str(?coord), " ")) AS ?lat)
          BIND(xsd:decimal(strafter(str(?coord), " ")) AS ?lon)
          OPTIONAL { ?item wdt:P31 ?instanceOf }
          OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "it") }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it" }
        }
        LIMIT 20
      `;

      // Query più pratica: cerca luoghi storici/culturali nella zona
      // Cerca POI con nome che contiene il comune o che sono nel comune
      const practicalQuery = `
        SELECT ?item ?itemLabel ?lat ?lon ?instanceOf ?instanceOfLabel ?description WHERE {
          {
            # POI con nome che contiene il comune
            ?item rdfs:label ?itemLabel .
            FILTER(CONTAINS(LCASE(?itemLabel), "${municipality.toLowerCase()}"))
          } UNION {
            # POI che sono parte del comune (relazione amministrativa)
            ?item wdt:P131* ?comune .
            ?comune rdfs:label "${municipality}"@it .
          }
          ?item wdt:P625 ?coord .
          OPTIONAL { ?item wdt:P31 ?instanceOf }
          OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "it") }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it" }
          BIND(xsd:decimal(strbefore(str(?coord), " ")) AS ?lat)
          BIND(xsd:decimal(strafter(str(?coord), " ")) AS ?lon)
          FILTER(
            ?lat >= ${(lat - 0.2).toFixed(4)} && ?lat <= ${(lat + 0.2).toFixed(4)} &&
            ?lon >= ${(lng - 0.2).toFixed(4)} && ?lon <= ${(lng + 0.2).toFixed(4)}
          )
        }
        LIMIT 30
      `;

      const response = await axios.get(this.sparqlUrl, {
        params: {
          query: practicalQuery,
          format: 'json'
        },
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'WhatisBackend/1.0'
        },
        timeout: this.timeout
      });

      if (response.data && response.data.results && response.data.results.bindings) {
        const pois = this.normalizePOIs(response.data.results.bindings);
        Logger.info(`✅ Wikidata trovati ${pois.length} POI`);
        return pois;
      }

      return [];

    } catch (error) {
      Logger.warn('Errore ricerca Wikidata:', error.message);
      // Fallback silenzioso
      return [];
    }
  }

  /**
   * Verifica se un POI esiste in Wikidata
   * @param {string} poiName - Nome del POI
   * @param {number} lat - Latitudine
   * @param {number} lng - Longitudine
   * @returns {Object|null} - POI matchato o null
   */
  async verifyPOI(poiName, lat, lng) {
    try {
      const query = `
        SELECT ?item ?itemLabel ?lat ?lon ?instanceOf ?instanceOfLabel ?description WHERE {
          ?item rdfs:label "${poiName}"@it .
          ?item wdt:P625 ?coord .
          BIND(xsd:decimal(strbefore(str(?coord), " ")) AS ?lat)
          BIND(xsd:decimal(strafter(str(?coord), " ")) AS ?lon)
          OPTIONAL { ?item wdt:P31 ?instanceOf }
          OPTIONAL { ?item schema:description ?description FILTER(LANG(?description) = "it") }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it" }
          FILTER(
            ABS(?lat - ${lat}) < 0.01 && ABS(?lon - ${lng}) < 0.01
          )
        }
        LIMIT 1
      `;

      const response = await axios.get(this.sparqlUrl, {
        params: {
          query: query,
          format: 'json'
        },
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'WhatisBackend/1.0'
        },
        timeout: this.timeout
      });

      if (response.data && response.data.results && response.data.results.bindings.length > 0) {
        const binding = response.data.results.bindings[0];
        const poi = this.normalizePOI(binding);
        Logger.info(`✅ Wikidata verifica POI "${poiName}": trovato`);
        return poi;
      }

      return null;

    } catch (error) {
      Logger.warn('Errore verifica Wikidata:', error.message);
      return null;
    }
  }

  /**
   * Normalizza POI da Wikidata
   */
  normalizePOIs(bindings) {
    return bindings.map(binding => this.normalizePOI(binding)).filter(poi => poi.name);
  }

  /**
   * Normalizza singolo POI
   */
  normalizePOI(binding) {
    return {
      name: binding.itemLabel?.value || '',
      lat: parseFloat(binding.lat?.value || 0),
      lng: parseFloat(binding.lon?.value || 0),
      category: this.mapWikidataInstance(binding.instanceOfLabel?.value || ''),
      description: binding.description?.value || '',
      wikidataId: binding.item?.value?.replace('http://www.wikidata.org/entity/', '') || '',
      instanceOf: binding.instanceOfLabel?.value || '',
      source: 'wikidata',
      verified: true
    };
  }

  /**
   * Mappa istanze Wikidata alle categorie del sistema
   */
  mapWikidataInstance(instance) {
    if (!instance) return 'other';

    const instanceLower = instance.toLowerCase();
    
    const categoryMap = {
      'chiesa': 'church',
      'edificio religioso': 'church',
      'monumento': 'monument',
      'museo': 'museum',
      'villa': 'villa',
      'castello': 'monument',
      'fortezza': 'monument',
      'punto panoramico': 'viewpoint',
      'parco': 'park',
      'spiaggia': 'beach',
      'porto': 'harbor',
      'faro': 'lighthouse'
    };

    for (const [key, value] of Object.entries(categoryMap)) {
      if (instanceLower.includes(key)) {
        return value;
      }
    }

    return 'other';
  }
}

module.exports = WikidataPoiService;

