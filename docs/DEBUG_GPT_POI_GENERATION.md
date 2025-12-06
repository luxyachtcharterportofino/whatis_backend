# 🔍 Guida Debug: Generazione POI con GPT-4o

## ⚠️ IMPORTANTE: Il Sistema NON Usa Più Perplexity

Il backend **Whatis_Backend** **NON usa più Perplexity API**. Il sistema è stato completamente sostituito con **OpenAI GPT-4o**.

## 🎯 Sistema Attuale

### Motore di Generazione
- **Servizio**: `services/gptPoiGenerator.js`
- **API**: OpenAI GPT-4o (`https://api.openai.com/v1/chat/completions`)
- **Modello**: `gpt-4o` (configurabile via `OPENAI_MODEL`)
- **API Key**: `OPENAI_API_KEY` (OBBLIGATORIA)

### Perché GPT invece di Perplexity?

1. **Migliore controllo**: GPT-4o offre controllo più preciso sul formato output
2. **JSON strutturato**: Supporto nativo per `response_format: { type: "json_object" }`
3. **Affidabilità**: Risultati più coerenti e verificabili
4. **Verifica multi-fonte**: Integrazione con OpenTripMap e Wikidata

## 🔍 Come Verificare che GPT Funzioni

### 1. Verifica API Key

```bash
# Controlla che OPENAI_API_KEY sia presente
echo $OPENAI_API_KEY

# Oppure nel file .env
cat .env | grep OPENAI_API_KEY
```

### 2. Test Diretto API

Crea un file di test `test_gpt.js`:

```javascript
const axios = require('axios');

async function testGPT() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY non configurata');
    return;
  }

  const prompt = `Trova 3 POI turistici nel Comune di Santa Margherita Ligure, zona "Portofino". 
Rispondi SOLO con JSON: { "pois": [{"name": "...", "category": "...", "lat": 44.3, "lng": 9.2, "description": "...", "confidence_score": 0.9}] }`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Sei un esperto di turismo italiano. Rispondi SOLO in JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Risposta GPT:');
    console.log(JSON.stringify(response.data.choices[0].message.content, null, 2));
  } catch (error) {
    console.error('❌ Errore:', error.response?.data || error.message);
  }
}

testGPT();
```

Esegui:
```bash
node test_gpt.js
```

### 3. Log del Backend

I log mostrano:
- `🚀 Generazione POI con GPT...`
- `✅ Generati X POI da GPT`
- Eventuali errori API

## 📊 Debug Dettagliato

### Abilita Log Dettagliati

Il sistema usa `Logger` per tutti i log. Verifica:

1. **Log generazione GPT**:
   - Cerca `Generazione POI con GPT`
   - Cerca `Generati X POI da GPT`

2. **Log prompt inviati**:
   - Il prompt completo viene loggato (se abilitato debug)

3. **Log risposte GPT**:
   - Risposta raw viene loggata in caso di errore parsing

### Aggiungi Log Dettagliati

Modifica `services/gptPoiGenerator.js` per aggiungere log:

```javascript
async callOpenAIAPI(prompt) {
  // Aggiungi questo per debug
  Logger.debug('📤 Prompt inviato a GPT:', prompt.substring(0, 200) + '...');
  
  const response = await axios.post(...);
  
  // Aggiungi questo per debug
  Logger.debug('📥 Risposta GPT ricevuta:', response.data.choices[0].message.content.substring(0, 200) + '...');
  
  return response.data.choices[0].message.content;
}
```

## 🔧 Parametri GPT Configurabili

### Modello
- **Default**: `gpt-4o`
- **Configurazione**: `OPENAI_MODEL` in `.env`
- **Alternative**: `gpt-4-turbo`, `gpt-4`

### Temperature
- **Valore**: `0.3` (bassa per risposte precise)
- **Range**: 0.0 - 2.0
- **Effetto**: Più bassa = più deterministica

### Max Tokens
- **Valore**: `3000`
- **Effetto**: Limita lunghezza risposta

### Response Format
- **Valore**: `{ type: "json_object" }`
- **Effetto**: Forza formato JSON (solo GPT-4o/gpt-4-turbo)

## 🐛 Problemi Comuni e Soluzioni

### 1. "OpenAI API non disponibile"
**Causa**: `OPENAI_API_KEY` mancante o vuota
**Soluzione**: 
```bash
# Aggiungi al .env
OPENAI_API_KEY=sk-...
```

### 2. "Risposta GPT vuota"
**Causa**: API key invalida o rate limit
**Soluzione**: 
- Verifica API key su https://platform.openai.com/api-keys
- Controlla crediti account
- Verifica rate limits

### 3. "Errore parsing risposta GPT"
**Causa**: GPT non ha restituito JSON valido
**Soluzione**: 
- Controlla log per risposta raw
- Verifica che modello supporti `json_object`
- Aumenta `max_tokens` se risposta troncata

### 4. "POI non corrispondono a ricerca manuale"
**Causa**: Prompt diverso o contesto diverso
**Soluzione**: 
- Prompt include Zona + Comune specifici
- GPT genera POI basandosi su conoscenza, non ricerca web
- Usa verifica OpenTripMap/Wikidata per validare

## 📝 Confronto: GPT vs Perplexity

| Aspetto | Perplexity (Vecchio) | GPT-4o (Attuale) |
|---------|---------------------|------------------|
| **API** | `api.perplexity.ai` | `api.openai.com` |
| **Modello** | `llama-3.1-sonar-large-128k-online` | `gpt-4o` |
| **Ricerca Web** | ✅ Sì (sonar) | ❌ No (solo conoscenza) |
| **JSON Forzato** | ❌ No | ✅ Sì (`json_object`) |
| **Controllo Output** | ⚠️ Limitato | ✅ Alto |
| **Verifica Fonti** | ❌ No | ✅ Sì (OpenTripMap/Wikidata) |

## 🎯 Perché i Risultati Potrebbero Differire

### 1. GPT Non Fa Ricerca Web
- GPT-4o usa **solo conoscenza** (training data)
- Perplexity fa **ricerca web in tempo reale**
- **Implicazione**: GPT potrebbe non avere info aggiornate

### 2. Prompt Strutturato
- Il prompt backend è **molto specifico** (Zona + Comune + formato JSON)
- Ricerca manuale Perplexity è **più libera**
- **Implicazione**: Risultati più focalizzati ma potenzialmente diversi

### 3. Filtri Automatici
- Backend applica **deduplicazione**, **validazione geografica**, **scoring**
- Ricerca manuale mostra **tutti i risultati**
- **Implicazione**: Backend mostra solo POI validati

## 🔍 Come Tracciare Richieste API

### 1. Abilita Log Dettagliati

Aggiungi in `services/gptPoiGenerator.js`:

```javascript
async callOpenAIAPI(prompt) {
  const requestData = {
    model: this.model,
    messages: [...],
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: "json_object" }
  };

  // LOG REQUEST
  Logger.info('📤 GPT Request:', {
    model: requestData.model,
    promptLength: prompt.length,
    temperature: requestData.temperature
  });

  const response = await axios.post(this.apiUrl, requestData, {...});

  // LOG RESPONSE
  Logger.info('📥 GPT Response:', {
    status: response.status,
    responseLength: response.data.choices[0].message.content.length,
    tokensUsed: response.data.usage?.total_tokens
  });

  return response.data.choices[0].message.content;
}
```

### 2. Salva Prompt e Risposte

Aggiungi salvataggio su file:

```javascript
const fs = require('fs');
const path = require('path');

// Salva prompt
const promptFile = path.join(__dirname, '../logs/gpt_prompts.log');
fs.appendFileSync(promptFile, `\n=== ${new Date().toISOString()} ===\n${prompt}\n\n`);

// Salva risposta
const responseFile = path.join(__dirname, '../logs/gpt_responses.log');
fs.appendFileSync(responseFile, `\n=== ${new Date().toISOString()} ===\n${response}\n\n`);
```

## ✅ Checklist Debug

- [ ] `OPENAI_API_KEY` configurata e valida
- [ ] Account OpenAI ha crediti disponibili
- [ ] Modello `gpt-4o` accessibile (verifica su platform.openai.com)
- [ ] Log backend mostrano chiamate GPT
- [ ] Risposta GPT contiene JSON valido
- [ ] Prompt include Zona + Comune corretti
- [ ] Verifica OpenTripMap/Wikidata funziona (opzionale)

## 🚀 Best Practices

1. **Usa prompt specifici**: Includi sempre Zona + Comune
2. **Verifica risultati**: Usa OpenTripMap/Wikidata per validare
3. **Controlla score**: POI con score < 50 da verificare manualmente
4. **Monitora costi**: GPT-4o ha costi per token
5. **Usa confidence score**: POI con confidence < 0.6 da rivedere

## 📞 Supporto

Se i risultati non corrispondono:
1. Verifica log backend per prompt esatto inviato
2. Confronta prompt backend con ricerca manuale Perplexity
3. Considera che GPT non fa ricerca web (solo conoscenza)
4. Usa verifica OpenTripMap/Wikidata per validare POI
5. Controlla score nella pagina revisione

