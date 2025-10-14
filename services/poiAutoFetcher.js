// ===============================
// 🧩 Andaly Whatis - Multi-Source POI Auto Fetcher
// Nuovo sistema modulare con provider multipli
// ===============================

const POIAggregator = require('./poiAggregator');

class POIAutoFetcher {
  constructor() {
    this.aggregator = new POIAggregator();
  }

  /**
   * Fetch POIs for a zone using the new multi-source system
   * @param {Object} zone - Zone object with coordinates
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Array} Array of enriched POI objects
   */
  async fetchPOIsForZone(zone, progressCallback = null) {
    try {
      console.log(`🧩 Using multi-source POI fetcher for zone: ${zone.name}`);
      
      // Usa il nuovo aggregatore multi-fonte
      const pois = await this.aggregator.fetchPOIsForZone(zone, progressCallback);
      
      console.log(`✅ Multi-source fetch completed: ${pois.length} POIs`);
      return pois;
      
    } catch (error) {
      console.error('❌ Error in multi-source POI fetcher:', error);
      throw error;
    }
  }
}

module.exports = POIAutoFetcher;