# 🔍 Perplexity Search Module

Modulo non invasivo per la ricerca di POI terrestri e marini tramite Perplexity API.

## 📋 Configurazione

Aggiungi queste variabili al tuo file `.env`:

```env
# Perplexity API Configuration
PERPLEXITY_API_KEY=your_api_key_here
PERPLEXITY_ENABLED=true
```

### Variabili d'ambiente

- **PERPLEXITY_API_KEY** (opzionale): La tua API key di Perplexity. Se non fornita, il modulo funziona in modalità MOCK.
- **PERPLEXITY_ENABLED** (opzionale, default: false): Abilita/disabilita il modulo. Se `false`, le route non sono registrate.

## 🚀 Utilizzo

### Route disponibili

#### 1. Test del modulo
```
GET /admin/perplexity/test
```
Verifica la configurazione e esegue un test sulla zona "Santa Margherita Ligure".

**Risposta:**
```json
{
  "success": true,
  "configuration": {
    "hasApiKey": true,
    "isEnabled": true,
    "serviceAvailable": true,
    "mode": "API"
  },
  "testZone": "Santa Margherita Ligure",
  "results": {
    "found": 5,
    "new": 3,
    "duplicates": 2
  }
}
```

#### 2. Ricerca POI terrestri
```
GET /admin/perplexity/pois/:zoneId
GET /admin/perplexity/pois/:zoneId?autoSave=true
```

Cerca POI terrestri (culturali, storici, panoramici) per una zona specifica.

**Query params:**
- `autoSave` (opzionale): Se `true`, salva automaticamente i POI nuovi nel database. **Default: false** (solo proposte).

**Risposta:**
```json
{
  "success": true,
  "zone": {
    "id": "...",
    "name": "Portofino"
  },
  "stats": {
    "totalFound": 8,
    "new": 5,
    "duplicates": 3,
    "suggestions": 3
  },
  "newPOIs": [...],
  "duplicates": [...],
  "suggestions": [
    {
      "existing": {...},
      "nuovo": {...},
      "matchScore": 0.85,
      "distance": 45,
      "possibili_miglioramenti": [
        "Descrizione più dettagliata disponibile",
        "Coordinate potenzialmente più precise"
      ],
      "raccomandazione": "Duplicato molto probabile - verifica manualmente"
    }
  ],
  "mode": "API"
}
```

#### 3. Ricerca POI marini
```
GET /admin/perplexity/wrecks/:zoneId
GET /admin/perplexity/wrecks/:zoneId?autoSave=true
```

Cerca POI marini (relitti, secche, grotte, siti di immersione) per una zona specifica.

**Query params:**
- `autoSave` (opzionale): Se `true`, salva automaticamente i POI nuovi nel database. **Default: false** (solo proposte).

#### 4. Merge manuale (futuro)
```
POST /admin/perplexity/merge/:poiId
```

Applica un merge suggestion manualmente, aggiornando solo i campi selezionati.

## 🔒 Sicurezza e Garanzie

Il modulo è progettato per essere **completamente non invasivo**:

✅ **Nessun POI esistente viene mai cancellato**
✅ **Nessun POI viene mai sovrascritto automaticamente**
✅ **Tutti i POI nuovi sono proposte da approvare manualmente**
✅ **Ogni duplicato viene segnalato con suggerimenti di merge**
✅ **Il salvataggio automatico richiede esplicita richiesta (`autoSave=true`)**

## 🧠 Deduplicazione Intelligente

Il modulo utilizza un algoritmo di deduplicazione che considera:

1. **Similarità nome** (40%): Confronto Levenshtein tra nomi
2. **Distanza geografica** (50%): POI entro 100m sono considerati potenziali duplicati
3. **Categoria** (10%): POI con stessa categoria hanno score maggiore

**Soglie:**
- Score ≥ 0.6: Possibile duplicato
- Score ≥ 0.8: Duplicato molto probabile

## 🎭 Modalità MOCK

Se `PERPLEXITY_API_KEY` non è configurata, il modulo funziona in modalità MOCK:

- Restituisce POI di esempio generici
- Utile per test e sviluppo
- Non richiede API key
- Logga avvisi ma non interrompe il flusso

## 📝 Note

- Il modulo è **completamente isolato** e non interferisce con il sistema esistente
- I POI trovati hanno `source: 'perplexity'` per tracciabilità
- Le route sono registrate solo se `PERPLEXITY_ENABLED=true`
- In caso di errore API, il modulo fallback automaticamente a MOCK

## 🔮 Futuro

Il modulo è progettato per poter sostituire in futuro il motore di ricerca attuale, ma:
- Non modifica nulla del sistema esistente
- È completamente reversibile
- Può essere disabilitato in qualsiasi momento

