# 🚀 Guida Completa: Deploy Backend su Render.com

## 📋 Panoramica

Questa guida ti permetterà di deployare il backend Whatis su Render.com in modo che sia accessibile da internet 24/7, anche quando il tuo computer è spento.

**Cosa otterrai:**
- ✅ URL pubblico HTTPS (es: `https://whatis-backend.onrender.com`)
- ✅ Backend sempre disponibile (anche con computer spento)
- ✅ Deploy automatico da GitHub
- ✅ Piano gratuito disponibile

---

## 🎯 Prerequisiti

1. **Account GitHub** (gratuito) - https://github.com
2. **Account Render.com** (gratuito) - https://render.com
3. **MongoDB Atlas** (già configurato) - https://www.mongodb.com/cloud/atlas

---

## 📝 Passo 1: Preparare il Codice

### 1.1 Verifica che tutto sia pronto

Il progetto è già configurato con:
- ✅ `render.yaml` - Configurazione Render
- ✅ `.env.example` - Template variabili d'ambiente
- ✅ `Procfile` - Comando di avvio
- ✅ Supporto per porta dinamica (process.env.PORT)

### 1.2 Assicurati che il codice sia aggiornato

Tutti i file necessari sono già stati creati/modificati:
- `backend/render.yaml` - Configurazione servizio
- `backend/server.js` - Supporta Render (porta dinamica, Python opzionale)
- `backend/.env.example` - Template variabili

---

## 📤 Passo 2: Caricare Codice su GitHub

### 2.1 Crea Repository GitHub

1. Vai su **https://github.com/new**
2. **Repository name:** `whatis_backend`
3. **Visibility:** Private (raccomandato) o Public
4. **NON** selezionare "Add a README file"
5. Clicca **"Create repository"**

### 2.2 Carica il Codice

Apri il terminale e esegui:

```bash
# Vai nella directory del progetto
cd /Users/andreastagnaro/Desktop/Whatis/whatis_backend

# Inizializza Git (se non già fatto)
git init

# Aggiungi tutti i file (esclusi quelli in .gitignore)
git add .

# Crea il primo commit
git commit -m "Initial commit - Ready for Render deploy"

# Aggiungi il repository GitHub come remote
# SOSTITUISCI TUO_USERNAME con il tuo username GitHub
git remote add origin https://github.com/TUO_USERNAME/whatis_backend.git

# Rinomina branch principale
git branch -M main

# Carica il codice su GitHub
git push -u origin main
```

**Nota:** Se ti chiede username/password, usa un **Personal Access Token** invece della password:
- Vai su GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Genera un nuovo token con permessi `repo`
- Usa il token come password

---

## 🌐 Passo 3: Deploy su Render.com

### 3.1 Crea Account Render

1. Vai su **https://render.com**
2. Clicca **"Get Started for Free"**
3. Scegli **"Sign up with GitHub"** (più semplice)
4. Autorizza Render ad accedere ai tuoi repository

### 3.2 Crea Nuovo Web Service

1. Nel dashboard Render, clicca **"New +"** → **"Web Service"**

2. **Connetti Repository:**
   - Se non già connesso, clicca **"Connect GitHub"**
   - Autorizza Render
   - Seleziona il repository **`whatis_backend`**

3. **Configurazione Automatica:**
   - Render dovrebbe rilevare automaticamente `render.yaml`
   - Se non lo rileva, configura manualmente:
     - **Name:** `whatis-backend`
     - **Environment:** `Node`
     - **Root Directory:** `backend`
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`
     - **Plan:** `Free`

4. **Variabili d'Ambiente:**
   
   Clicca su **"Advanced"** → **"Add Environment Variable"** e aggiungi:

   **OBBLIGATORIE:**
   ```
   MONGO_URI = (la tua URI MongoDB dal file .env)
   NODE_ENV = production
   ```
   
   **OPZIONALI (aggiungi se le usi):**
   ```
   OPENAI_API_KEY = (dal tuo .env)
   GOOGLE_API_KEY = (dal tuo .env)
   GOOGLE_CX = (dal tuo .env)
   DEEPL_API_KEY = (dal tuo .env)
   PERPLEXITY_API_KEY = (dal tuo .env)
   PERPLEXITY_ENABLED = false
   CSE_MAX_RESULTS = 3
   CSE_TIMEOUT_MS = 6000
   ENABLE_CSE_DIVE_WRECK = false
   ENABLE_UNIVERSAL_WRECK_SEARCH = false
   ENABLE_CSE_TEST = false
   DEBUG_GPT = false
   PYTHON_SEMANTIC_ENGINE_ENABLED = false
   ```

   **Come copiare MONGO_URI:**
   ```bash
   # Nel terminale, esegui:
   cd /Users/andreastagnaro/Desktop/Whatis/whatis_backend
   grep "^MONGO_URI=" .env
   # Copia il valore (senza MONGO_URI=)
   ```

5. **Clicca "Create Web Service"**

### 3.3 Attendi il Deploy

- Render inizierà automaticamente il build
- Puoi vedere i log in tempo reale
- Il primo deploy richiede **5-10 minuti**
- Successivi deploy richiedono **2-3 minuti**

### 3.4 Ottieni l'URL

Una volta completato il deploy:
- Render ti darà un URL tipo: `https://whatis-backend.onrender.com`
- **Questo è l'URL del tuo backend pubblico!** 🎉

---

## ✅ Passo 4: Verifica che Funzioni

### 4.1 Test Health Check

Apri nel browser:
```
https://TUO_URL.onrender.com/health
```

Dovresti vedere:
```json
{"status":"ok","service":"whatis_backend","timestamp":"..."}
```

### 4.2 Test Endpoint Zone

Apri nel browser:
```
https://TUO_URL.onrender.com/mobile/zones
```

Dovresti vedere un array JSON con le zone.

---

## 📱 Passo 5: Aggiorna l'App iOS

### 5.1 Aggiorna URL nell'App

1. Apri Xcode → Progetto `WhatisExplorer`
2. Vai su `Services/APIService.swift`
3. Trova la sezione `baseURL` (circa riga 73)
4. Aggiorna il `defaultURL` con l'URL di Render:

```swift
let defaultURL = "https://whatis-backend.onrender.com"
```

Oppure, ancora meglio, configura l'URL nell'app:
1. Apri l'app sul telefono
2. Vai in **Impostazioni**
3. Inserisci l'URL di Render: `https://whatis-backend.onrender.com`

### 5.2 Ricompila l'App

1. In Xcode: **⌘B** (Build)
2. **⌘R** (Run) sul telefono

---

## 🔄 Aggiornamenti Futuri

Ogni volta che modifichi il codice:

```bash
cd /Users/andreastagnaro/Desktop/Whatis/whatis_backend

# Aggiungi modifiche
git add .

# Commit
git commit -m "Descrizione delle modifiche"

# Push su GitHub
git push
```

**Render farà automaticamente un nuovo deploy!** 🚀

---

## ⚠️ Note Importanti

### Piano Gratuito Render

- **Sleep Mode:** Dopo 15 minuti di inattività, il servizio va in "sleep"
- **Wake Time:** Il primo accesso dopo il sleep richiede ~30 secondi per riattivarsi
- **Limiti:** 750 ore/mese (sufficiente per sviluppo/test)
- **Upgrade:** Se serve più stabilità, puoi fare upgrade al piano a pagamento ($7/mese)

### Python Semantic Engine

- **Su Render:** Il Python engine è disabilitato di default (`PYTHON_SEMANTIC_ENGINE_ENABLED=false`)
- **Funzionalità:** Il backend funziona comunque senza Python
- **Se necessario:** Puoi creare un servizio Python separato su Render (più complesso)

### MongoDB Atlas

- **Whitelist IP:** Aggiungi `0.0.0.0/0` nella whitelist di MongoDB Atlas per permettere connessioni da Render
- **Connection String:** Usa la stessa URI che usi localmente

---

## 🆘 Troubleshooting

### Build Fallisce

1. Controlla i **Log** su Render
2. Verifica che tutte le variabili d'ambiente siano configurate
3. Assicurati che `MONGO_URI` sia corretto

### Errore "Cannot connect to MongoDB"

1. Verifica che MongoDB Atlas permetta connessioni da qualsiasi IP (`0.0.0.0/0`)
2. Controlla che `MONGO_URI` sia corretto in Render
3. Verifica che la password non abbia caratteri speciali non codificati

### App iOS non si connette

1. Verifica che l'URL in `APIService.swift` sia corretto
2. Controlla che l'URL inizi con `https://` (non `http://`)
3. Testa l'URL nel browser prima

### Servizio va in Sleep

- **Normale** sul piano gratuito
- Il primo accesso dopo il sleep richiede ~30 secondi
- Per evitare sleep, fai upgrade al piano a pagamento

---

## 🎉 Fatto!

Ora il tuo backend è:
- ✅ Accessibile da internet 24/7
- ✅ Funziona anche con computer spento
- ✅ Si aggiorna automaticamente da GitHub
- ✅ Pronto per l'app iOS

**URL del tuo backend:** `https://whatis-backend.onrender.com` (o il nome che hai scelto)

---

## 📞 Supporto

Se hai problemi:
1. Controlla i log su Render (dashboard → Logs)
2. Verifica le variabili d'ambiente
3. Testa l'endpoint `/health` nel browser

