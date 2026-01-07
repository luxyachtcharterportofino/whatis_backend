// ===============================
// 🔍 POI Discovery Routes
// Route per scoperta automatica POI
// ===============================

const express = require('express');
const router = express.Router();
const POIDiscoveryService = require('../../services/poiDiscoveryService');
const ProposedPOI = require('../../models/ProposedPOI');
const Poi = require('../../models/Poi');
const Zone = require('../../models/Zone');
const Logger = require('../../utils/logger');

const discoveryService = new POIDiscoveryService();

/**
 * GET /admin/pois/discover
 * Pagina di configurazione per la scoperta automatica di POI
 * Permette di selezionare una zona e avviare la discovery
 */
router.get('/discover', async (req, res) => {
  try {
    // Carica tutte le zone disponibili
    const zones = await Zone.find().select('name _id').lean();
    
    // Se c'è un zone_id nei query params, renderizza direttamente i POI proposti
    if (req.query.zone_id) {
      return res.redirect(`/admin/pois/proposed?zone_id=${req.query.zone_id}`);
    }
    
    // Altrimenti renderizza la pagina di selezione zona
    // Usa la stessa vista dei POI proposti ma senza zone_id
    const proposedPOIs = await ProposedPOI.find({ status: 'pending' })
      .populate('zone_id', 'name')
      .sort({ created_at: -1 })
      .limit(10)
      .lean();
    
    res.render('admin_proposed_pois', {
      pois: proposedPOIs,
      zones: zones,
      zone_id: null,
      zone_name: null,
      status: 'pending',
      showZoneSelector: true, // Flag per mostrare il selettore zona
      selectedZoneId: null,
      selectedMunicipality: null,
      municipalities: []
    });
    
  } catch (error) {
    Logger.error('Errore caricamento pagina discovery:', error);
    res.status(500).send('Errore nel caricamento della pagina di discovery');
  }
});

/**
 * POST /admin/pois/discover
 * Scopre POI automaticamente per una zona
 * Supporta progresso tramite query parameter ?progress=true (usa SSE)
 */
router.post('/discover', async (req, res) => {
  try {
    const { zone_id, municipality, type = 'both' } = req.body;
    const useProgress = req.query.progress === 'true';

    if (!zone_id) {
      return res.status(400).json({
        success: false,
        error: 'zone_id è obbligatorio'
      });
    }

    // Valida tipo
    const validTypes = ['terrestrial', 'marine', 'both'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `type deve essere uno di: ${validTypes.join(', ')}`
      });
    }

    Logger.info(`🔍 Richiesta scoperta POI per zona: ${zone_id} (tipo: ${type}, progress: ${useProgress})`);

    // Se richiesto progresso tramite SSE
    if (useProgress) {
      // Imposta header per Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disabilita buffering nginx

      // Progress callback per inviare aggiornamenti SSE
      const progressCallback = (percent, message) => {
        try {
          res.write(`data: ${JSON.stringify({ percent, message })}\n\n`);
        } catch (err) {
          Logger.error('Errore invio progresso SSE:', err);
        }
      };

      // Avvia scoperta in modo asincrono
      discoveryService.discoverPOIsForZone(
        zone_id,
        municipality,
        type,
        progressCallback
      ).then(results => {
        // Invia risultato finale
        res.write(`data: ${JSON.stringify({ 
          success: true, 
          complete: true,
          results: results,
          message: `Scoperti ${results.saved.marine + results.saved.terrestrial} POI`
        })}\n\n`);
        res.end();
      }).catch(error => {
        Logger.error('Errore scoperta POI:', error);
        res.write(`data: ${JSON.stringify({ 
          success: false, 
          complete: true,
          error: error.message || 'Errore durante la scoperta POI'
        })}\n\n`);
        res.end();
      });

      return; // Non inviare risposta normale, SSE gestisce tutto
    }

    // Modalità normale (senza progresso)
    const results = await discoveryService.discoverPOIsForZone(
      zone_id,
      municipality,
      type
    );

    res.json({
      success: true,
      message: `Scoperti ${results.saved.marine + results.saved.terrestrial} POI`,
      results: results
    });

  } catch (error) {
    Logger.error('Errore scoperta POI:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Errore durante la scoperta POI'
    });
  }
});

/**
 * GET /admin/pois/proposed
 * Lista tutti i POI proposti per una zona (o tutte le zone)
 * Supporta sia JSON che render HTML
 */
router.get('/proposed', async (req, res) => {
  try {
    const { zone_id, status = 'pending', format, municipality } = req.query;

    const query = {};
    if (zone_id) {
      query.zone_id = zone_id;
    }
    if (status) {
      query.status = status;
    }
    if (municipality && municipality !== '') {
      query.municipality = municipality;
    }

    const proposedPOIs = await ProposedPOI.find(query)
      .populate('zone_id', 'name')
      .populate('duplicate_of', 'name')
      .sort({ created_at: -1 })
      .lean();
    
    // Carica tutte le zone per il filtro
    const zones = await Zone.find().select('name _id').sort({ name: 1 }).lean();
    
    // Ottieni i comuni unici dai POI proposti per il filtro
    const municipalities = await ProposedPOI.distinct('municipality', query.zone_id ? { zone_id: query.zone_id } : {}).then(munis => 
      munis.filter(m => m && m.trim() !== '').sort()
    );

    // Se richiesto JSON
    if (format === 'json' || req.headers.accept?.includes('application/json')) {
      // Raggruppa per zona
      const grouped = {};
      for (const poi of proposedPOIs) {
        const zoneName = poi.zone_id?.name || 'Unknown';
        if (!grouped[zoneName]) {
          grouped[zoneName] = [];
        }
        grouped[zoneName].push(poi);
      }

      return res.json({
        success: true,
        count: proposedPOIs.length,
        by_zone: grouped,
        pois: proposedPOIs
      });
    }

    // Render HTML
    const zone = zone_id ? await Zone.findById(zone_id) : null;
    res.render('admin_proposed_pois', {
      pois: proposedPOIs,
      zone_id: zone_id || null,
      zone_name: zone?.name || null,
      status: status,
      zones: zones,
      municipalities: municipalities,
      selectedZoneId: zone_id || null,
      selectedMunicipality: municipality || null
    });

  } catch (error) {
    Logger.error('Errore recupero POI proposti:', error);
    if (req.headers.accept?.includes('application/json')) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).send('Errore nel caricamento dei POI proposti');
    }
  }
});

/**
 * GET /admin/pois/proposed/:id
 * Dettaglio di un POI proposto
 */
router.get('/proposed/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const proposedPOI = await ProposedPOI.findById(id)
      .populate('zone_id', 'name')
      .populate('duplicate_of', 'name lat lng');

    if (!proposedPOI) {
      return res.status(404).json({
        success: false,
        error: 'POI proposto non trovato'
      });
    }

    res.json({
      success: true,
      poi: proposedPOI
    });

  } catch (error) {
    Logger.error('Errore recupero POI proposto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /admin/pois/proposed/:id
 * Aggiorna un POI proposto (coordinate, descrizione, ecc.)
 */
router.put('/proposed/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Rimuovi campi non modificabili
    delete updates._id;
    delete updates.zone_id;
    delete updates.created_at;
    delete updates.status; // Status si cambia con endpoint dedicato

    // Aggiorna missing_coords se coordinate sono state aggiunte
    if (updates.lat && updates.lon) {
      updates.missing_coords = false;
    }

    const proposedPOI = await ProposedPOI.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!proposedPOI) {
      return res.status(404).json({
        success: false,
        error: 'POI proposto non trovato'
      });
    }

    Logger.info(`✅ POI proposto aggiornato: ${proposedPOI.name}`);

    res.json({
      success: true,
      message: 'POI proposto aggiornato',
      poi: proposedPOI
    });

  } catch (error) {
    Logger.error('Errore aggiornamento POI proposto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /admin/pois/proposed/:id/approve
 * Approva e inserisce un POI proposto nel DB definitivo
 */
router.post('/proposed/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { merge_with } = req.body; // Opzionale: ID POI esistente per merge

    const proposedPOI = await ProposedPOI.findById(id);
    if (!proposedPOI) {
      return res.status(404).json({
        success: false,
        error: 'POI proposto non trovato'
      });
    }

    // Verifica coordinate
    if (!proposedPOI.lat || !proposedPOI.lon) {
      return res.status(400).json({
        success: false,
        error: 'Coordinate mancanti. Aggiungi coordinate prima di approvare.'
      });
    }

    // Se merge_with, aggiorna POI esistente
    if (merge_with) {
      const existingPOI = await Poi.findById(merge_with);
      if (!existingPOI) {
        return res.status(404).json({
          success: false,
          error: 'POI esistente non trovato per merge'
        });
      }

      // Aggiorna POI esistente con dati del proposto
      existingPOI.description = proposedPOI.description || existingPOI.description;
      existingPOI.lat = proposedPOI.lat;
      existingPOI.lng = proposedPOI.lon;
      if (proposedPOI.depth) {
        existingPOI.extraInfo = existingPOI.extraInfo || {};
        existingPOI.extraInfo.depth = proposedPOI.depth;
      }
      await existingPOI.save();

      // Marca proposto come merged
      proposedPOI.status = 'merged';
      proposedPOI.duplicate_of = merge_with;
      await proposedPOI.save();

      Logger.info(`✅ POI proposto unito con esistente: ${proposedPOI.name}`);

      return res.json({
        success: true,
        message: 'POI unito con esistente',
        poi: existingPOI,
        merged: true
      });
    }

    // Crea nuovo POI nel DB definitivo
    const newPOI = new Poi({
      name: proposedPOI.name,
      description: proposedPOI.description || '',
      lat: proposedPOI.lat,
      lng: proposedPOI.lon,
      zone: proposedPOI.zone_id,
      category: proposedPOI.category,
      semanticCategory: proposedPOI.marine_type ? 'marine' : 'terrestrial',
      source: 'gpt',
      extraInfo: {
        aiSummary: proposedPOI.description || '',
        depth: proposedPOI.depth || null,
        tags: proposedPOI.marine_type ? ['relitto', 'marino'] : []
      },
      arVisible: true,
      arPriority: 1
    });

    await newPOI.save();

    // Marca proposto come approved
    proposedPOI.status = 'approved';
    await proposedPOI.save();

    Logger.info(`✅ POI approvato e salvato nel DB definitivo: ${proposedPOI.name}`);

    res.json({
      success: true,
      message: 'POI approvato e salvato',
      poi: newPOI
    });

  } catch (error) {
    Logger.error('Errore approvazione POI:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /admin/pois/proposed/:id/create-or-get-definitive
 * Crea un POI definitivo da un POI proposto (se non esiste già) e restituisce l'ID per la modifica
 */
router.post('/proposed/:id/create-or-get-definitive', async (req, res) => {
  try {
    const { id } = req.params;
    const proposedPOI = await ProposedPOI.findById(id);
    
    if (!proposedPOI) {
      return res.status(404).json({
        success: false,
        error: 'POI proposto non trovato'
      });
    }

    // Verifica se esiste già un POI definitivo con le stesse coordinate e nome (per evitare duplicati)
    let definitivePOI = null;
    if (proposedPOI.lat && proposedPOI.lon) {
      definitivePOI = await Poi.findOne({
        zone: proposedPOI.zone_id,
        lat: proposedPOI.lat,
        lng: proposedPOI.lon,
        name: proposedPOI.name
      });
    }

    // Se esiste già, usa quello
    if (definitivePOI) {
      Logger.info(`✅ POI definitivo già esistente trovato: ${definitivePOI.name} (${definitivePOI._id})`);
      return res.json({
        success: true,
        poiId: definitivePOI._id,
        message: 'POI definitivo già esistente'
      });
    }

    // Verifica coordinate prima di creare
    if (!proposedPOI.lat || !proposedPOI.lon) {
      return res.status(400).json({
        success: false,
        error: 'Coordinate mancanti. Aggiungi coordinate prima di creare il POI definitivo.'
      });
    }

    // Crea nuovo POI nel DB definitivo
    const newPOI = new Poi({
      name: proposedPOI.name,
      description: proposedPOI.description || '',
      lat: proposedPOI.lat,
      lng: proposedPOI.lon,
      zone: proposedPOI.zone_id,
      category: proposedPOI.category,
      semanticCategory: proposedPOI.marine_type ? 'marine' : 'terrestrial',
      source: 'gpt',
      coordStatus: 'unconfirmed', // Sarà confermato quando l'admin lo renderà definitivo
      isDefinitive: false, // Non ancora definitivo, l'admin lo renderà definitivo dalla pagina di modifica
      extraInfo: {
        aiSummary: proposedPOI.description || '',
        depth: proposedPOI.depth || null,
        tags: proposedPOI.marine_type ? ['relitto', 'marino'] : []
      },
      arVisible: true,
      arPriority: 1
    });

    await newPOI.save();

    // Marca proposto come approved (ma non eliminato, rimane nel DB provvisorio)
    proposedPOI.status = 'approved';
    await proposedPOI.save();

    Logger.info(`✅ POI creato nel DB definitivo per modifica: ${newPOI.name} (${newPOI._id})`);

    res.json({
      success: true,
      poiId: newPOI._id,
      message: 'POI creato nel database definitivo'
    });

  } catch (error) {
    Logger.error('Errore creazione POI definitivo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /admin/pois/proposed/:id/reject
 * Rifiuta un POI proposto
 */
router.post('/proposed/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const proposedPOI = await ProposedPOI.findByIdAndUpdate(
      id,
      { status: 'rejected' },
      { new: true }
    );

    if (!proposedPOI) {
      return res.status(404).json({
        success: false,
        error: 'POI proposto non trovato'
      });
    }

    Logger.info(`❌ POI proposto rifiutato: ${proposedPOI.name}`);

    res.json({
      success: true,
      message: 'POI rifiutato',
      poi: proposedPOI
    });

  } catch (error) {
    Logger.error('Errore rifiuto POI:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /admin/pois/proposed/batch-approve
 * Approva multipli POI proposti
 */
router.post('/proposed/batch-approve', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ids deve essere un array non vuoto'
      });
    }

    const approved = [];
    const errors = [];

    for (const id of ids) {
      try {
        const proposedPOI = await ProposedPOI.findById(id);
        if (!proposedPOI) {
          errors.push({ id, error: 'Non trovato' });
          continue;
        }

        if (!proposedPOI.lat || !proposedPOI.lon) {
          errors.push({ id, error: 'Coordinate mancanti' });
          continue;
        }

        // Crea POI definitivo
        const newPOI = new Poi({
          name: proposedPOI.name,
          description: proposedPOI.description || '',
          lat: proposedPOI.lat,
          lng: proposedPOI.lon,
          zone: proposedPOI.zone_id,
          category: proposedPOI.category,
          semanticCategory: proposedPOI.marine_type ? 'marine' : 'terrestrial',
          source: 'gpt',
          extraInfo: {
            aiSummary: proposedPOI.description || '',
            depth: proposedPOI.depth || null
          },
          arVisible: true
        });

        await newPOI.save();
        proposedPOI.status = 'approved';
        await proposedPOI.save();

        approved.push(newPOI._id);

      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    res.json({
      success: true,
      approved: approved.length,
      errors: errors.length,
      approved_ids: approved,
      errors_details: errors
    });

  } catch (error) {
    Logger.error('Errore approvazione batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

