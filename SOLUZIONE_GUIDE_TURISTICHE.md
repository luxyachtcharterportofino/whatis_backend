# Guida: Come far funzionare le Guide Turistiche nell'App

## Problema Attuale
L'app iOS non mostra le guide turistiche perché l'array `tourGuides` nel database è vuoto per le zone.

## Soluzione Passo-Passo

### 1. Verificare che il Backend Funzioni
✅ Il backend è già in esecuzione e funziona correttamente.

### 2. Aggiungere Guide Turistiche per una Zona

1. **Apri il browser** e vai a: `http://localhost:3000/admin/tour-guides` (o `http://192.168.1.6:3000/admin/tour-guides`)

2. **Seleziona una zona** dalla lista (es. "Tigullio nuova")

3. **Clicca su "Modifica"** o "+ Aggiungi Guide"

4. **Compila i campi** per ogni guida turistica:
   - **Nome** (obbligatorio): Es. "GABILATOUR"
   - **Sito Web** (obbligatorio): Es. "https://www.gabilatour.com/"
   - **Telefono** (opzionale): Es. "+39 123 456 7890"
   - **Email** (opzionale): Es. "info@example.com"
   - **Descrizione** (opzionale): Breve descrizione

5. **Clicca su "💾 Salva Guide"**

6. **Verifica nei log del backend** che vedi:
   ```
   📥 [Tour Guides] Ricevute X guide per zona...
   ✅ Guide turistiche aggiornate per zona...: X guide salvate
   ```

### 3. Verificare che le Guide siano State Salvate

Nel terminale del backend, dovresti vedere log come:
```
📥 [Tour Guides] Ricevute 1 guide per zona Tigullio nuova (ID: 68ef1e3f9a0026b0cd5e39fe)
✅ Guide turistiche aggiornate per zona Tigullio nuova: 1 guide salvate
✅ [Tour Guides] Guide salvate nel DB: [{"name":"GABILATOUR","website":"https://www.gabilatour.com/",...}]
```

### 4. Testare nell'App iOS

1. **Riavvia l'app iOS** (se già aperta)

2. **Vai su "Scopri le Guide Turistiche"**

3. **Seleziona la zona** per cui hai aggiunto le guide

4. **Dovresti vedere** la lista delle guide turistiche con:
   - Nome
   - Descrizione (se presente)
   - Telefono (se presente)
   - Email (se presente)
   - Pulsante "Visita il sito web"

### 5. Debug se Non Funziona

Se ancora non vedi le guide nell'app:

1. **Controlla i log del backend** quando l'app fa la richiesta:
   ```
   📱 GET /mobile/zones/XXXX/tour-guides richiesto
   📱 [Tour Guides API] Zona trovata: Nome Zona (ID: XXXX)
   📱 [Tour Guides API] Tour guides nel DB: X
   📱 [Tour Guides API] Guide: [...]
   ```

2. **Controlla i log dell'app iOS** nella console di Xcode:
   ```
   📍 [TourGuidesView] onAppear chiamato...
   🌍 [TourGuidesView] URL: http://...
   📡 [TourGuidesView] Status code: 200
   🔥 [TourGuidesView] Risposta backend completa: {...}
   ✅ [TourGuidesView] Guide trovate nel JSON: X
   ✅ [TourGuidesView] Guide caricate nell'array: X
   ```

3. **Se vedi "Guide trovate nel JSON: 0"**, significa che:
   - Le guide non sono state salvate correttamente nel database
   - Riprova a salvarle dall'interfaccia admin

## Note Importanti

- **Ogni zona** deve avere le proprie guide turistiche salvate separatamente
- **I campi obbligatori** sono: Nome e Sito Web
- **Telefono, Email e Descrizione** sono opzionali
- Le guide vengono salvate **immediatamente** quando clicchi "Salva Guide"

## Verifica Rapida

Per verificare rapidamente se una zona ha guide turistiche:

1. Vai su `http://localhost:3000/admin/tour-guides`
2. Controlla la colonna "Guide Turistiche" nella lista
3. Se vedi "Nessuna guida", clicca su "+ Aggiungi Guide"
4. Se vedi "X guide", clicca su "Modifica" per vedere/modificare le guide esistenti

