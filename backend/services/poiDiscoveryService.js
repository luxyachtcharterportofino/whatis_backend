// ===============================
// 🔍 POI Discovery Service
// Servizio per scoperta automatica POI con salvataggio provvisorio
// ===============================

const POIGenerationPipeline = require('./poiGenerationPipeline');
const ProposedPOI = require('../models/ProposedPOI');
const Poi = require('../models/Poi');
const Zone = require('../models/Zone');
const POIDeduplicator = require('./poiDeduplicator');
const Logger = require('../utils/logger');

class POIDiscoveryService {
  constructor() {
    this.pipeline = new POIGenerationPipeline();
    this.deduplicator = new POIDeduplicator();
  }

  /**
   * Scopre POI per una zona e li salva nel database provvisorio
   * @param {string} zoneId - ID della zona
   * @param {string} municipality - Comune (opzionale)
   * @param {string} type - 'terrestrial' | 'marine' | 'both'
   * @param {Function} progressCallback - Callback per aggiornamenti progresso (percent, message)
   * @returns {Object} Risultati della scoperta
   */
  async discoverPOIsForZone(zoneId, municipality = null, type = 'both', progressCallback = null) {
    try {
      Logger.info(`🔍 Avvio scoperta POI per zona: ${zoneId} (tipo: ${type}, comune: ${municipality || 'auto'})`);

      // Recupera zona
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        throw new Error(`Zona ${zoneId} non trovata`);
      }

      // Se municipality non specificato, usa il primo comune della zona o il nome zona
      const finalMunicipality = municipality || zone.name;

      // Wrapper per progressCallback che include anche il salvataggio
      let totalSteps = 0;
      let currentStep = 0;
      
      const wrappedProgressCallback = async (percent, message) => {
        if (progressCallback) {
          // Percentuale per la generazione (0-70%)
          const generationPercent = Math.floor(percent * 0.7);
          await progressCallback(generationPercent, message);
        }
      };

      // Genera POI con pipeline GPT
      const results = await this.pipeline.generatePOIsForZone(
        zone,
        type,
        null, // customPrompt
        finalMunicipality,
        wrappedProgressCallback
      );

      Logger.info(`✅ Pipeline generato ${results.validated?.length || 0} POI validati`);

      // Aggiorna progresso: inizio salvataggio (70%)
      if (progressCallback) {
        await progressCallback(70, 'Salvataggio POI nel database provvisorio...');
      }

      // Processa e salva POI provvisori
      const discoveryResults = {
        zoneId: zoneId,
        zoneName: zone.name,
        discovered: {
          marine: [],
          terrestrial: []
        },
        saved: {
          marine: 0,
          terrestrial: 0
        },
        duplicates: {
          marine: 0,
          terrestrial: 0
        },
        errors: []
      };

      const totalPOIs = results.validated?.length || 0;
      let processedCount = 0;

      // Processa POI validati
      if (results.validated && Array.isArray(results.validated)) {
        for (const poi of results.validated) {
          try {
            const saved = await this.processAndSaveProposedPOI(poi, zoneId, zone.name, finalMunicipality);
            
            if (saved) {
              if (poi.semanticCategory === 'marine' || poi.category === 'wreck') {
                discoveryResults.discovered.marine.push(saved);
                discoveryResults.saved.marine++;
              } else {
                discoveryResults.discovered.terrestrial.push(saved);
                discoveryResults.saved.terrestrial++;
              }
            } else {
              // Duplicato
              if (poi.semanticCategory === 'marine' || poi.category === 'wreck') {
                discoveryResults.duplicates.marine++;
              } else {
                discoveryResults.duplicates.terrestrial++;
              }
            }
            } catch (error) {
              Logger.error(`Errore processando POI ${poi.name}:`, error);
              discoveryResults.errors.push({
                poi: poi.name,
                error: error.message
              });
            }
            
            // Aggiorna progresso durante il salvataggio (70-95%)
            processedCount++;
            if (progressCallback && totalPOIs > 0) {
              const savePercent = 70 + Math.floor((processedCount / totalPOIs) * 25);
              await progressCallback(savePercent, `Salvati ${processedCount}/${totalPOIs} POI...`);
            }
          }
        }

      Logger.info(`✅ Scoperta completata: ${discoveryResults.saved.marine + discoveryResults.saved.terrestrial} POI salvati, ${discoveryResults.duplicates.marine + discoveryResults.duplicates.terrestrial} duplicati`);

      // Aggiorna progresso: completato (100%)
      if (progressCallback) {
        await progressCallback(100, 'Completato!');
      }

      return discoveryResults;

    } catch (error) {
      Logger.error('Errore scoperta POI:', error);
      throw error;
    }
  }

  /**
   * Processa un POI e lo salva nel database provvisorio se non duplicato
   */
  async processAndSaveProposedPOI(poi, zoneId, zoneName, municipality) {
    try {
      // Verifica se è marino (solo relitti)
      const isMarine = poi.semanticCategory === 'marine' || poi.category === 'wreck';
      
      // Per marini: accetta SOLO relitti (nessuna secca, scoglio, grotta, ecc.)
      if (isMarine && poi.category !== 'wreck') {
        Logger.debug(`POI marino scartato (non relitto): ${poi.name} (categoria: ${poi.category})`);
        return null;
      }
      
      // Filtra anche per nome: escludi secche, scogli, grotte, pareti
      const nameLower = (poi.name || '').toLowerCase();
      const excludeKeywords = ['secca', 'scoglio', 'grotta', 'parete', 'roccia', 'sommità', 'reef', 'rock', 'cave', 'wall', 'secche'];
      if (isMarine && excludeKeywords.some(kw => nameLower.includes(kw))) {
        Logger.debug(`POI marino scartato (parola chiave esclusa): ${poi.name}`);
        return null;
      }

      // Verifica duplicati nel DB definitivo
      const duplicateCheck = await this.checkDuplicateInDefinitiveDB(poi, zoneId);
      
      if (duplicateCheck.isDuplicate) {
        Logger.debug(`POI duplicato trovato nel DB definitivo: ${poi.name}`);
        return null; // Non salvare duplicati
      }

      // Verifica duplicati nel DB provvisorio
      const proposedDuplicate = await this.checkDuplicateInProposedDB(poi, zoneId);
      
      if (proposedDuplicate.isDuplicate) {
        Logger.debug(`POI già presente nel DB provvisorio: ${poi.name}`);
        return null; // Non salvare duplicati
      }

      // Prepara dati per ProposedPOI
      const proposedData = {
        name: poi.name || 'POI senza nome',
        category: poi.category || 'other',
        description: poi.description || '',
        municipality: municipality || zoneName,
        lat: poi.lat || null,
        lon: poi.lng || null, // Nota: nel modello usiamo 'lon' invece di 'lng'
        depth: isMarine && poi.extraInfo?.depth ? poi.extraInfo.depth : null,
        marine_type: isMarine ? 'relitto' : null,
        source_url: poi.extraInfo?.wikipediaUrl || poi.extraInfo?.url || '',
        missing_coords: !poi.lat || !poi.lng,
        needs_review: !poi.lat || !poi.lng || !poi.description, // Richiede revisione se mancano coordinate o descrizione
        duplicate_of: duplicateCheck.almostDuplicate ? duplicateCheck.existingPOIId : null,
        quality_score: poi.score || 50,
        zone_id: zoneId,
        status: 'pending',
        // Imposta coordStatus: missing se non ci sono coordinate, altrimenti unconfirmed
        coordStatus: (!poi.lat || !poi.lng) ? 'missing' : 'unconfirmed'
      };

      // Calcola quality_score basato su disponibilità dati
      if (proposedData.missing_coords) {
        proposedData.quality_score = Math.max(0, proposedData.quality_score - 30);
      }
      if (!proposedData.description) {
        proposedData.quality_score = Math.max(0, proposedData.quality_score - 10);
      }
      if (duplicateCheck.almostDuplicate) {
        proposedData.quality_score = Math.max(0, proposedData.quality_score - 20);
      }

      // Salva nel DB provvisorio
      const proposedPOI = new ProposedPOI(proposedData);
      await proposedPOI.save();

      Logger.info(`✅ POI proposto salvato: ${poi.name} (${isMarine ? 'marino' : 'terrestre'})`);

      return proposedPOI;

    } catch (error) {
      Logger.error(`Errore salvataggio POI proposto ${poi.name}:`, error);
      throw error;
    }
  }

  /**
   * Verifica duplicati nel DB definitivo
   */
  async checkDuplicateInDefinitiveDB(poi, zoneId) {
    try {
      // Cerca per nome simile nella stessa zona
      const existingPOIs = await Poi.find({ zone: zoneId }).lean();
      
      for (const existing of existingPOIs) {
        // Verifica similarità nome
        const nameSimilarity = this.deduplicator.calculateNameSimilarity(poi.name, existing.name);
        
        if (nameSimilarity > 0.8) {
          // Nome molto simile
          if (poi.lat && poi.lng && existing.lat && existing.lng) {
            // Verifica distanza
            const distance = this.deduplicator.calculateDistance(
              poi.lat, poi.lng,
              existing.lat, existing.lng
            );
            
            if (distance < 0.15) { // 150 metri
              // Duplicato confermato
              return {
                isDuplicate: true,
                existingPOIId: existing._id
              };
            } else if (distance < 0.5) { // 500 metri
              // Quasi duplicato
              return {
                isDuplicate: false,
                almostDuplicate: true,
                existingPOIId: existing._id
              };
            }
          } else {
            // Nome simile ma senza coordinate - quasi duplicato
            return {
              isDuplicate: false,
              almostDuplicate: true,
              existingPOIId: existing._id
            };
          }
        }
      }

      return {
        isDuplicate: false,
        almostDuplicate: false
      };

    } catch (error) {
      Logger.error('Errore verifica duplicati DB definitivo:', error);
      return {
        isDuplicate: false,
        almostDuplicate: false
      };
    }
  }

  /**
   * Verifica duplicati nel DB provvisorio
   */
  async checkDuplicateInProposedDB(poi, zoneId) {
    try {
      const existingProposed = await ProposedPOI.find({ 
        zone_id: zoneId,
        status: 'pending'
      }).lean();

      for (const existing of existingProposed) {
        const nameSimilarity = this.deduplicator.calculateNameSimilarity(poi.name, existing.name);
        
        if (nameSimilarity > 0.8) {
          if (poi.lat && poi.lng && existing.lat && existing.lon) {
            const distance = this.deduplicator.calculateDistance(
              poi.lat, poi.lng,
              existing.lat, existing.lon
            );
            
            if (distance < 0.15) {
              return {
                isDuplicate: true
              };
            }
          } else {
            // Nome simile senza coordinate - considera duplicato
            return {
              isDuplicate: true
            };
          }
        }
      }

      return {
        isDuplicate: false
      };

    } catch (error) {
      Logger.error('Errore verifica duplicati DB provvisorio:', error);
      return {
        isDuplicate: false
      };
    }
  }
}

module.exports = POIDiscoveryService;

