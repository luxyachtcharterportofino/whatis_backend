# 🚀 Deploy Backend Whatis su Cloud

## Obiettivo
Deployare il backend Express su un servizio cloud (Heroku, Railway, Render) così che l'app iOS possa accedere ai dati anche quando il computer locale è spento.

## Opzioni di Deploy

### 1. Railway (Consigliato - Gratuito)
1. Vai su https://railway.app
2. Crea un account
3. "New Project" → "Deploy from GitHub repo"
4. Seleziona il repository `whatis_backend`
5. Railway rileva automaticamente Node.js e avvia il server
6. Aggiungi variabili d'ambiente:
   - `MONGO_URI` (già nel tuo .env)
   - `PORT` (Railway lo imposta automaticamente)
7. Railway ti darà un URL tipo: `https://whatis-backend-production.up.railway.app`

### 2. Render (Gratuito)
1. Vai su https://render.com
2. Crea un account
3. "New" → "Web Service"
4. Connetti il repository GitHub
5. Imposta:
   - Build Command: `npm install`
   - Start Command: `node server.js`
6. Aggiungi variabili d'ambiente (Environment Variables)
7. Render ti darà un URL tipo: `https://whatis-backend.onrender.com`

### 3. Heroku (A pagamento dopo free tier)
1. Vai su https://heroku.com
2. Installa Heroku CLI
3. `heroku login`
4. `heroku create whatis-backend`
5. `git push heroku main`
6. `heroku config:set MONGO_URI=...`
7. URL: `https://whatis-backend.herokuapp.com`

## Dopo il Deploy

1. Aggiorna l'URL cloud in `APIService.swift`:
   ```swift
   let cloudURL = "https://TUO-URL-QUI" // Sostituisci con il tuo URL
   ```

2. L'app userà automaticamente il cloud come default
3. Se il cloud non è disponibile, l'app può fallback al locale (se connesso)

## Note Importanti

- MongoDB Atlas è già configurato, quindi i dati sono già su cloud
- Il backend Express deve solo essere deployato per essere accessibile pubblicamente
- Assicurati che le route `/api/zones` e `/mobile/zones/:zoneId/pois` siano accessibili pubblicamente

