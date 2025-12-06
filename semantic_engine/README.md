# Semantic Engine 🧠

Microservizio Python per ricerca semantica avanzata di POI turistici, integrato con il backend Node.js whatis_backend.

## 🎯 Funzionalità

- **Ricerca Semantica Avanzata**: Wikipedia, Wikidata, OpenStreetMap
- **Riconoscimento Automatico Comuni**: Identificazione municipi e frazioni
- **Estensione Marina**: Relitti, fari, boe, punti immersione
- **Arricchimento AI**: Descrizioni migliorate e metadati semantici
- **Semantic Enricher**: Arricchimento automatico POI con Wikipedia, siti turistici e AI
- **Cache Intelligente**: Risultati memorizzati per 24 ore
- **API REST**: Integrazione semplice con backend Node.js

## 🚀 Avvio Rapido

### Prerequisiti
- Python 3.8+
- Backend Node.js whatis_backend in esecuzione

### Installazione
```bash
cd semantic_engine
pip install -r requirements.txt
python start_semantic_engine.py
```

### Verifica Funzionamento
- **Servizio**: http://localhost:5001
- **Documentazione**: http://localhost:5001/docs  
- **Health Check**: http://localhost:5001/health

## 📡 API Endpoints

### POST /semantic/search
Ricerca semantica completa per una zona geografica.

**Request:**
```json
{
  "zone_name": "Golfo dei Poeti", 
  "polygon": [[44.032,9.912],[44.112,9.857],[44.022,9.849]],
  "extend_marine": true,
  "enable_ai_enrichment": true
}
```

**Response:**
```json
{
  "zone_name": "Golfo dei Poeti",
  "municipalities": [
    {
      "name": "Porto Venere",
      "subdivisions": ["Le Grazie","Fezzano","Marola"],
      "poi_count": 86
    }
  ],
  "pois": [
    {
      "name": "Castello Doria",
      "description": "Fortezza del XII secolo affacciata sul mare",
      "lat": 44.05, "lng": 9.83,
      "source": "Wikipedia", "type": "land",
      "relevance_score": 4.2
    }
  ],
  "statistics": {
    "total_pois": 178,
    "land_pois": 156, 
    "marine_pois": 22,
    "total_municipalities": 3,
    "sources_used": ["Wikipedia", "Wikidata", "OSM"]
  }
}
```

### POST /semantic/municipalities  
Scopre comuni e frazioni in un poligono geografico.

### POST /semantic/enrich_poi
Arricchisce un singolo POI con descrizione e immagine.

**Request:**
```json
{
  "name": "Relitto Mohawk Deer",
  "type": "wreck"
}
```

**Response:**
```json
{
  "name": "Relitto Mohawk Deer",
  "description": "Il Relitto Mohawk Deer è un relitto sommerso di grande interesse per immersioni nella Riviera Ligure...",
  "image_url": "https://example.com/image.jpg",
  "source": "Wikipedia",
  "confidence": 0.9,
  "metadata": {
    "wikipedia_url": "https://it.wikipedia.org/wiki/...",
    "wikipedia_title": "Relitto Mohawk Deer"
  }
}
```

## 🔧 Integrazione Backend Node.js

Il sistema è già integrato nel backend Node.js tramite:

### 1. Semantic Connector (`services/semanticConnector.js`)
```javascript
const semanticConnector = require('./services/semanticConnector');

// Ricerca semantica
const results = await semanticConnector.semanticSearch(
  zoneName, polygon, extendMarine, enableAI
);

// Scoperta comuni
const municipalities = await semanticConnector.discoverMunicipalities(
  polygon, zoneName  
);
```

### 2. Admin Routes (`routes/admin/semantic.js`)
- `GET /admin/semantic/status` - Stato servizio
- `POST /admin/semantic/search` - Ricerca semantica  
- `POST /admin/semantic/municipalities` - Scoperta comuni
- `POST /admin/semantic/approve-poi` - Approva POI
- `POST /admin/semantic/reject-poi` - Rifiuta POI

### 3. Interfaccia Web (`views/map.ejs`)
- Toggle "🧠 Ricerca Semantica AI" 
- Toggle "🌊 Estensione Marina"
- Modal risultati con approvazione POI
- Integrazione con sistema esistente

## 🎛️ Utilizzo Admin Interface

1. **Apri Admin Map**: http://localhost:3000/admin/map
2. **Attiva Ricerca Semantica**: Toggle "🧠 Ricerca Semantica AI" 
3. **Seleziona Zona**: Clicca su una zona nella mappa
4. **Avvia Ricerca**: Clicca "🧠 Ricerca Semantica AI" (invece di "Importa POI automatici")
5. **Rivedi Risultati**: Modal con POI trovati
6. **Approva/Modifica/Rifiuta**: Singolarmente o in batch

### Funzionalità Avanzate
- **Estensione Marina**: Attiva per includere relitti, fari, punti immersione
- **Cache Intelligente**: Risultati salvati per 24 ore
- **Fallback Automatico**: Se servizio Python non disponibile, usa metodo classico
- **Statistiche Tempo Reale**: Performance e utilizzo

## 🏗️ Architettura

```
whatis_backend/
├── semantic_engine/           # Microservizio Python
│   ├── app.py                # Server FastAPI  
│   ├── core/                 # Moduli core
│   │   ├── semantic_search.py    # Orchestratore ricerca
│   │   ├── osm_query.py          # Query OpenStreetMap
│   │   ├── wiki_extractor.py     # Wikipedia/Wikidata
│   │   ├── geo_municipal.py      # Riconoscimento comuni
│   │   ├── marine_explorer.py    # POI marittimi
│   │   ├── enrich_ai.py          # Arricchimento AI
│   │   ├── semantic_enricher.py  # Arricchimento automatico POI
│   │   └── utils.py              # Utilità comuni
│   └── requirements.txt      # Dipendenze Python
├── services/
│   └── semanticConnector.js  # Connector Node.js ↔ Python
├── routes/admin/  
│   └── semantic.js           # API routes admin
├── public/js/
│   └── semantic-manager.js   # Frontend JavaScript
└── views/map.ejs             # Interfaccia admin integrata
```

## 🔍 Fonti Dati

### Wikipedia/Wikidata
- Ricerca per termini turistici + nome zona
- Estrazione coordinate da pagine  
- Filtraggio rilevanza turistica
- Arricchimento descrizioni

### OpenStreetMap (Overpass API)
- Query specializzate per POI turistici
- Monumenti, chiese, castelli, musei
- POI marittimi: fari, relitti, diving sites
- Dati amministrativi comuni

### Database Locali
- Mappature frazioni → comuni
- POI marittimi noti (Golfo dei Poeti, Cinque Terre)
- Classificazione rilevanza turistica

## ⚙️ Configurazione

### Variabili Ambiente (opzionali)
```bash
SEMANTIC_ENGINE_PORT=5001
SEMANTIC_ENGINE_HOST=localhost  
CACHE_TTL_HOURS=24
LOG_LEVEL=INFO
```

### Personalizzazione Fonti
Modifica `core/` per aggiungere:
- Nuovi provider POI
- Database turistici specializzati  
- API esterne (TripAdvisor, Google Places)
- Sistemi di rating/recensioni

## 🐛 Troubleshooting

### Servizio Non Disponibile
```bash
# Verifica servizio Python
curl http://localhost:5001/health

# Verifica logs
tail -f ../logs/semantic_engine.log
```

### Dipendenze Mancanti
```bash  
cd semantic_engine
pip install -r requirements.txt --upgrade
```

### Cache Problemi
```bash
# Pulisci cache via API
curl -X POST http://localhost:5001/admin/semantic/cache/clear

# Oppure manualmente
rm -rf cache/semantic/*
```

### Integrazione Node.js
```bash
# Verifica connector
node -e "const c = require('./services/semanticConnector'); c.isSemanticEngineAvailable().then(console.log)"
```

## 📈 Monitoring

### Statistiche Utilizzo
```javascript  
// Via JavaScript admin
const stats = await semanticManager.serviceStatus;

// Via API
fetch('/admin/semantic/stats').then(r => r.json())
```

### Metriche Performance
- Tempo medio ricerca: ~15-30 secondi
- POI medi per zona: 50-200
- Cache hit rate: ~70%
- Fonti simultanee: 3-4

## 🔮 Roadmap Futuro

### Già Predisposto
- **Multilingua**: IT/EN/FR/DE per descrizioni
- **Relevance Score**: 1-5 per importanza POI
- **Itinerari Automatici**: Terra + mare
- **Analytics**: Tracking utilizzo e performance

### Possibili Estensioni
- Integration con Google Places API
- Sentiment analysis recensioni turistiche
- Previsioni stagionalità POI
- Raccomandazioni personalizzate
- Export dati per app mobile

## 📞 Supporto

Per problemi o domande:
1. Controlla logs in `../logs/semantic_engine.log`
2. Verifica health check: http://localhost:5001/health
3. Consulta documentazione API: http://localhost:5001/docs
4. Test connector Node.js da console admin

---

🧠 **Semantic Engine** - Intelligenza Artificiale per il Turismo Digitale
🌊 Progetto **Andaly Whatis** - Scoperta Avanzata POI Turistici
