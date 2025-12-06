# 🚀 Deploy su Render.com - Guida Completa

## 📋 Prerequisiti

1. Account GitHub (gratuito)
2. Account Render.com (gratuito)

## 🔧 Passo 1: Creare Repository GitHub

1. Vai su https://github.com/new
2. Nome repository: `whatis_backend`
3. **NON** inizializzare con README (il progetto esiste già)
4. Clicca "Create repository"

## 📤 Passo 2: Push del Codice su GitHub

Esegui questi comandi nel terminale:

```bash
cd /Users/andreastagnaro/Desktop/whatis_backend

# Inizializza Git se non già fatto
git init

# Aggiungi tutti i file (esclusi quelli in .gitignore)
git add .

# Commit
git commit -m "Initial commit - Ready for Render deploy"

# Aggiungi remote GitHub (sostituisci TUO_USERNAME con il tuo username GitHub)
git remote add origin https://github.com/TUO_USERNAME/whatis_backend.git

# Push su GitHub
git branch -M main
git push -u origin main
```

## 🌐 Passo 3: Deploy su Render.com

1. **Vai su https://render.com** e crea un account (gratuito)

2. **Clicca "New +" → "Web Service"**

3. **Connetti GitHub:**
   - Clicca "Connect GitHub" se non già connesso
   - Autorizza Render ad accedere ai tuoi repository

4. **Seleziona Repository:**
   - Cerca e seleziona `whatis_backend`
   - Render rileverà automaticamente il file `render.yaml`

5. **Configurazione (se non usa render.yaml automaticamente):**
   - **Name:** `whatis-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** `Free` (gratuito)

6. **Variabili d'Ambiente:**
   Render dovrebbe rilevare le variabili da `render.yaml`, ma verifica che siano tutte presenti:
   - `MONGO_URI` (dal tuo .env)
   - `OPENAI_API_KEY` (dal tuo .env)
   - `GOOGLE_API_KEY` (dal tuo .env)
   - `GOOGLE_CX` (dal tuo .env)
   - `DEEPL_API_KEY` (dal tuo .env)
   - `PERPLEXITY_API_KEY` (dal tuo .env)
   - `PERPLEXITY_ENABLED` (dal tuo .env)
   - `CSE_MAX_RESULTS` (dal tuo .env)
   - `CSE_TIMEOUT_MS` (dal tuo .env)
   - `ENABLE_CSE_DIVE_WRECK` (dal tuo .env)
   - `ENABLE_UNIVERSAL_WRECK_SEARCH` (dal tuo .env)
   - `NODE_ENV` = `production`

7. **Clicca "Create Web Service"**

8. **Attendi il Deploy:**
   - Render inizierà automaticamente il build e il deploy
   - Puoi vedere i log in tempo reale
   - Il deploy richiede 5-10 minuti

9. **Ottieni l'URL:**
   - Una volta completato, Render ti darà un URL tipo: `https://whatis-backend.onrender.com`
   - Questo è l'URL del tuo backend!

## ✅ Verifica

1. Vai all'URL fornito da Render
2. Testa: `https://TUO_URL.onrender.com/health`
3. Dovresti vedere: `{"status":"ok","service":"whatis_backend",...}`

## 📱 Aggiorna l'App iOS

Dopo aver ottenuto l'URL da Render:

1. Apri: `WhatisExplorer_Lite/WhatisExplorerLite/Services/APIService.swift`
2. Sostituisci `cloudURL` con l'URL di Render
3. Ricompila l'app

## 🔄 Aggiornamenti Futuri

Ogni volta che fai push su GitHub, Render farà automaticamente un nuovo deploy!

```bash
git add .
git commit -m "Descrizione modifiche"
git push
```

## ⚠️ Note Importanti

- **Piano Gratuito:** Render mette in "sleep" i servizi gratuiti dopo 15 minuti di inattività. Il primo accesso dopo il sleep richiede ~30 secondi per riattivarsi.
- **Limiti Gratuiti:** 750 ore/mese (sufficiente per sviluppo/test)
- **Upgrade:** Se hai bisogno di più risorse, puoi fare upgrade al piano a pagamento

## 🆘 Troubleshooting

- **Build Fallisce:** Controlla i log su Render per vedere l'errore
- **Variabili Mancanti:** Verifica che tutte le variabili d'ambiente siano configurate
- **Timeout:** Il primo deploy può richiedere più tempo

