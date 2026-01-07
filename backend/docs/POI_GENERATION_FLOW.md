# 🚀 Flusso di Generazione POI con GPT-4o

## 📋 Panoramica

Questo documento descrive il flusso completo e unificato per la generazione automatica di POI (terrestri e marini) utilizzando OpenAI GPT-4o, geocoding automatico e validazione geografica.

## ✅ Sistema Corretto (UNICO)

**Percorso:** `/admin/zones` → Pulsante "🚀 Genera POI" su una zona

### Flusso Completo

1. **Selezione Zona**
   - L'utente apre `/admin/zones`
   - Clicca "🚀 Genera POI" su una zona specifica
   - La zona è automaticamente preselezionata

2. **Configurazione Generazione**
   - Si apre una modale con:
     - **Zona**: Preselezionata (non modificabile)
     - **Comune**: Menu a tendina obbligatorio (17 comuni Riviera di Levante)
     - **Tipo POI**: Terrestri / Marini / Entrambi
     - **Prompt Personalizzato**: Opzionale (se vuoto, viene generato automaticamente)

3. **Pipeline Automatica**
   - **STEP 1 - GPT-4o**: Genera POI basandosi su Zona + Comune
     - Prompt automatico ottimizzato: "Trova POI nel Comune di [Comune], nella zona [Zona]"
     - Focus prioritario sul comune selezionato
     - Genera 10-25 POI con confidence score
     - Verifica e pulizia automatica con secondo prompt GPT
   - **STEP 2 - Deduplicazione Preliminare**: Rimuove duplicati
     - Basata su nome normalizzato, distanza < 150m, similarità categoria
   - **STEP 3 - Pulizia Nomi**: Rimuove nomi generici e duplicati esatti
   - **STEP 4 - Verifica Fonti Reali**: Controllo incrociato
     - OpenTripMap: verifica POI reali tramite API
     - Wikidata: verifica tramite SPARQL
     - Aggiunge badge "Verified" ai POI verificati
   - **STEP 5 - Geocoding**: Trova coordinate precise
     - Fallback multipli: Nominatim → Google → Wikidata → Database
     - Usa coordinate GPT se valide, altrimenti geocodifica
   - **STEP 6 - Validazione Geografica**: Verifica coordinate
     - Controllo bounding box zona
     - Verifica punto dentro poligono
     - Calcolo distanza dalla zona
   - **STEP 7 - Scoring Multi-Fonte**: Calcola score 0-100
     - GPT confidence (30%)
     - OpenTripMap match (25%)
     - Wikidata match (25%)
     - Geocoding precision (10%)
     - Distanza dal centro (10%)

4. **Revisione POI**
   - Pagina `/admin/zones/:id/review-pois`
   - Tabella con tutti i POI generati
   - Mappa Leaflet per ogni POI
   - Indicatori validità (verde/giallo/rosso)
   - **Badge di verifica**: "✓ Verified by OpenTripMap" / "✓ Verified by Wikidata"
   - **Score visibile**: Badge colorato con score 0-100 (verde ≥70, giallo ≥50, rosso <50)
   - **Score Breakdown**: Dettaglio per ogni fonte di scoring
   - Modifica coordinate manuale
   - Pulsante "🔍 Trova Coordinate" per ri-geocoding
   - Selezione multipla POI
   - Salvataggio POI selezionati

5. **Salvataggio Finale**
   - POI salvati nel database
   - Source: "gpt"
   - Score e metadati di verifica inclusi
   - Pronti per uso in AR

## ❌ Sistema Vecchio (DEPRECATO)

**Percorso:** `/admin/perplexity/ui` → **NON PIÙ DISPONIBILE**

- ⚠️ Questa interfaccia è stata completamente sostituita
- ⚠️ Accesso redirecta a `/admin/zones` con messaggio informativo
- ⚠️ Link nella dashboard sono stati aggiornati

## 🔧 Componenti Tecnici

### Servizi

1. **`services/gptPoiGenerator.js`**
   - Genera prompt intelligenti con Zona + Comune
   - Chiama OpenAI GPT-4o API
   - Normalizza risposte JSON
   - Prompt di verifica e pulizia automatica
   - Richiede OPENAI_API_KEY configurata

2. **`services/openTripMapService.js`**
   - Verifica POI reali tramite OpenTripMap API
   - Ricerca per coordinate e nome
   - Match score per verifica
   - Richiede OPENTRIPMAP_API_KEY (opzionale, fallback silenzioso)

3. **`services/wikidataPoiService.js`**
   - Verifica POI tramite Wikidata SPARQL
   - Query per luoghi storici/culturali
   - Verifica esistenza reale
   - Pubblico, nessuna API key richiesta

4. **`services/poiDeduplicator.js`**
   - Deduplicazione avanzata
   - Basata su nome, distanza, categoria
   - Similarità semantica
   - Rimuove duplicati prima della revisione

5. **`services/poiScoringService.js`**
   - Scoring multi-fonte combinato
   - Normalizzato 0-100
   - Breakdown dettagliato per ogni fonte
   - Calcola score finale per ogni POI

6. **`services/geocodingService.js`**
   - Geocoding con fallback multipli
   - Nominatim (default)
   - Google Geocoding (se disponibile)
   - Wikidata SPARQL
   - Database interno

7. **`services/geographicValidator.js`**
   - Validazione coordinate
   - Controllo bounding box
   - Verifica punto dentro poligono
   - Calcolo distanza

8. **`services/poiGenerationPipeline.js`**
   - Orchestratore principale
   - Integra tutti i servizi
   - Gestisce errori e fallback
   - Coordina l'intera pipeline

### Route

- `POST /admin/zones/:id/generate-pois` - Genera POI
- `POST /admin/zones/:id/save-pois` - Salva POI approvati
- `POST /admin/zones/:id/geocode-poi` - Ri-geocodifica singolo POI
- `GET /admin/zones/:id/review-pois` - Pagina revisione

### View

- `views/admin_zones.ejs` - Lista zone con pulsante "🚀 Genera POI"
- `views/admin_review_pois.ejs` - Pagina revisione con mappe

## 🔍 Sistema di Verifica e Scoring

### Verifica Multi-Fonte

Il sistema verifica ogni POI generato da GPT tramite:

1. **OpenTripMap** (se OPENTRIPMAP_API_KEY configurata)
   - Cerca POI reali nelle vicinanze
   - Match basato su nome e coordinate
   - Aggiunge badge "Verified by OpenTripMap" se trovato

2. **Wikidata** (sempre disponibile)
   - Query SPARQL per luoghi storici/culturali
   - Verifica esistenza reale
   - Aggiunge badge "Verified by Wikidata" se trovato

### Scoring Multi-Fonte

Ogni POI riceve un score 0-100 basato su:

- **GPT Confidence** (30%): Confidence score da GPT (0-1 → 0-100)
- **OpenTripMap Match** (25%): Score di match con OpenTripMap (0-100)
- **Wikidata Match** (25%): 90 se verificato, 0 altrimenti
- **Geocoding Precision** (10%): Precisione geocoding (0-100)
- **Distance from Center** (10%): Prossimità al centro zona (0-100)

Il score totale è visibile nella pagina di revisione con badge colorato:
- 🟢 Verde (≥70): Alta qualità, verificato
- 🟡 Giallo (≥50): Qualità media
- 🔴 Rosso (<50): Bassa qualità, da verificare

## 📝 Note Importanti

1. **Comune è obbligatorio**: Migliora drasticamente la qualità dei risultati
2. **Zona è preselezionata**: Non può essere modificata nella modale
3. **Geocoding automatico**: Non serve inserire coordinate manualmente
4. **Validazione automatica**: POI fuori zona vengono segnalati
5. **Verifica automatica**: POI verificati da OpenTripMap/Wikidata hanno badge dedicati
6. **Scoring trasparente**: Ogni POI ha score visibile con breakdown dettagliato
7. **Revisione obbligatoria**: I POI non vengono salvati automaticamente
8. **Deduplicazione automatica**: Duplicati rimossi prima della revisione

## 🚫 Cosa NON fare

- ❌ Non usare `/admin/perplexity/ui` (deprecato)
- ❌ Non salvare POI senza revisione
- ❌ Non modificare coordinate senza validazione
- ❌ Non generare POI senza selezionare comune

## ✅ Best Practices

- ✅ Seleziona sempre il comune corretto
- ✅ Usa prompt personalizzato solo se necessario
- ✅ Controlla sempre i POI nella pagina di revisione
- ✅ Verifica coordinate sulla mappa prima di salvare
- ✅ Usa "Trova Coordinate" se le coordinate sembrano errate

