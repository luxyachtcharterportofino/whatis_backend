# 🔧 Risoluzione Problema Deploy su Dispositivo iOS

## ❌ Problema
La compilazione va a buon fine ma l'app non si aggiorna sul telefono.

## ✅ Soluzione Rapida

### 1. **DISINSTALLA L'APP VECCHIA** (SOLUZIONE PIÙ COMUNE)
   - Sul telefono: tieni premuto l'icona dell'app "Whatis Explorer"
   - Tocca "Rimuovi App" → "Elimina App"
   - Questo forza Xcode a reinstallare l'app invece di aggiornarla

### 2. **Pulisci il Build**
   - In Xcode: **Product → Clean Build Folder** (⇧⌘K)
   - Oppure esegui: `./clean_and_deploy.sh`

### 3. **Incrementa il Build Number** (già fatto)
   - Il build number è stato incrementato da 5 a 6
   - Esegui: `./fix_build_and_deploy.sh` per incrementarlo di nuovo se necessario

### 4. **Verifica la Connessione**
   - Assicurati che il telefono sia connesso via USB
   - Sblocca il telefono
   - Se richiesto, accetta "Fidati di questo computer"
   - In Xcode, seleziona il dispositivo dal menu in alto (accanto al pulsante Play)

### 5. **Verifica Signing**
   - In Xcode: seleziona il progetto → Target → **Signing & Capabilities**
   - Assicurati che **"Automatically manage signing"** sia selezionato
   - Verifica che il **Team** sia selezionato correttamente
   - Se ci sono errori di provisioning, risolvili prima di procedere

### 6. **Deploy**
   - In Xcode: **Product → Run** (⌘R)
   - Oppure clicca il pulsante **Play**

## 🔍 Se Ancora Non Funziona

### Opzione A: Pulizia Completa
```bash
# 1. Chiudi Xcode completamente
# 2. Esegui questo comando:
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorerLite-*

# 3. Riapri Xcode e riprova
```

### Opzione B: Verifica Bundle Identifier
- In Xcode: Progetto → Target → General
- Verifica che il **Bundle Identifier** sia: `com.andaly.WhatisExplorerLite`
- Se è diverso, potrebbe esserci un conflitto con un'altra app

### Opzione C: Reinstalla Provisioning Profile
- In Xcode: Preferences → Accounts
- Seleziona il tuo account Apple
- Clicca "Download Manual Profiles"
- Poi vai in Signing & Capabilities e seleziona il team

### Opzione D: Verifica Versione iOS
- Assicurati che il telefono supporti la versione minima richiesta
- In Xcode: Progetto → Target → General → Deployment Info
- Verifica "iOS Deployment Target"

## 📱 Verifica Installazione

Dopo il deploy, verifica che:
1. L'app appare sulla home screen del telefono
2. L'icona è quella nuova (con logo e testo)
3. L'app si apre correttamente
4. Il build number è 6 (nelle impostazioni dell'app, se visibile)

## 🆘 Ancora Problemi?

Se nessuna delle soluzioni funziona:
1. Controlla i log di Xcode (View → Debug Area → Show Debug Area)
2. Verifica che non ci siano errori di provisioning
3. Prova a compilare per un simulatore iOS per verificare che il codice funzioni
4. Verifica che il certificato di sviluppo non sia scaduto

## 💡 Suggerimenti

- **Sempre disinstallare l'app vecchia** quando cambi il build number
- **Usa sempre Clean Build Folder** dopo modifiche significative
- **Verifica sempre la connessione USB** prima di compilare
- **Mantieni Xcode aggiornato** alla versione più recente

