# 🚀 Istruzioni Setup - Whatis Explorer Lite

## Passo 1: Creare il Progetto Xcode

1. Apri **Xcode**
2. Vai su **File → New → Project**
3. Seleziona **iOS → App**
4. Compila il form:
   - **Product Name**: `WhatisExplorerLite`
   - **Team**: Seleziona il tuo team
   - **Organization Identifier**: `com.andaly` (o il tuo)
   - **Bundle Identifier**: `com.andaly.WhatisExplorerLite`
   - **Interface**: **SwiftUI**
   - **Language**: **Swift**
   - **Minimum Deployment**: **iOS 14.0**
   - ✅ **Include Tests**: Deseleziona (opzionale)

5. Scegli una cartella per salvare il progetto (es. `~/Desktop/WhatisExplorerLite_Xcode`)

## Passo 2: Importare i File

### Opzione A: Trascinamento Manuale

1. Apri Finder e vai alla cartella `WhatisExplorer_Lite/WhatisExplorerLite/`
2. In Xcode, nel navigator a sinistra, fai click destro sulla cartella del progetto
3. Seleziona **Add Files to "WhatisExplorerLite"...**
4. Naviga fino a `WhatisExplorer_Lite/WhatisExplorerLite/`
5. Seleziona tutte le cartelle:
   - `Models`
   - `Services`
   - `Views`
6. Assicurati che:
   - ✅ **Copy items if needed** sia selezionato
   - ✅ **Create groups** sia selezionato
   - ✅ Il target **WhatisExplorerLite** sia selezionato
7. Click **Add**

### Opzione B: Copia Manuale

1. Copia i file dalla cartella `WhatisExplorer_Lite/WhatisExplorerLite/` nella cartella del progetto Xcode
2. In Xcode, fai click destro sulla cartella del progetto → **Add Files to...**
3. Seleziona i file copiati

## Passo 3: Sostituire il File App

1. Elimina il file `WhatisExplorerLiteApp.swift` generato automaticamente
2. Aggiungi il file `WhatisExplorerLiteApp.swift` dalla cartella fornita

## Passo 4: Configurare Info.plist

1. Se `Info.plist` non esiste, crealo:
   - Click destro sul progetto → **New File**
   - **Property List** → `Info.plist`
2. Apri `Info.plist` e copia il contenuto dal file fornito
3. Oppure aggiungi manualmente le chiavi necessarie (vedi file fornito)

## Passo 5: Configurare le Capabilities

1. Seleziona il **target** "WhatisExplorerLite" in Xcode
2. Vai su **Signing & Capabilities**
3. Click **+ Capability**
4. Aggiungi **Location Services**
5. Seleziona **When In Use**

## Passo 6: Configurare l'Icona App

### Metodo 1: Automatico (Consigliato)

1. Apri `Assets.xcassets` in Xcode
2. Seleziona `AppIcon`
3. Trascina l'immagine `iOS_AppIcon_1024.png` (1024x1024) nello slot "App Store iOS 1024pt"
4. Xcode genererà automaticamente tutte le dimensioni

### Metodo 2: Manuale

Se hai bisogno di generare manualmente tutte le dimensioni, usa questo script:

```bash
# Crea uno script generate_icons.sh
#!/bin/bash
INPUT="iOS_AppIcon_1024.png"
OUTPUT_DIR="AppIcon.appiconset"

mkdir -p "$OUTPUT_DIR"

# Genera tutte le dimensioni necessarie usando sips (macOS)
sips -z 20 20 "$INPUT" --out "$OUTPUT_DIR/icon-20.png"
sips -z 40 40 "$INPUT" --out "$OUTPUT_DIR/icon-20@2x.png"
sips -z 60 60 "$INPUT" --out "$OUTPUT_DIR/icon-20@3x.png"
# ... continua per tutte le dimensioni
```

Poi aggiungi manualmente ogni immagine in `AppIcon` in Xcode.

## Passo 7: Configurare l'URL Backend

1. Apri `Services/APIService.swift`
2. Trova la riga:
   ```swift
   private let baseURL = "http://localhost:3000"
   ```
3. Sostituisci con l'URL del tuo backend:
   ```swift
   private let baseURL = "https://tuo-backend.com"
   ```

**Nota**: L'utente può anche cambiare l'URL dalle impostazioni dell'app dopo il primo avvio.

## Passo 8: Test su Simulatore

1. Seleziona un simulatore iOS (es. iPhone 14)
2. Click su **Run** (⌘R)
3. L'app dovrebbe avviarsi

**Nota**: Per testare la localizzazione, usa un simulatore con posizione configurata:
- Simulatore → Features → Location → Custom Location

## Passo 9: Test su Device Reale

1. Collega il tuo iPhone/iPad al Mac
2. In Xcode, seleziona il dispositivo dalla lista
3. Assicurati che il **Team** sia configurato correttamente
4. Click su **Run** (⌘R)
5. Se richiesto, autorizza l'app sul dispositivo:
   - Impostazioni → Generale → Gestione VPN e Device Management
   - Autorizza il tuo certificato

## Passo 10: Autorizzazioni

Al primo avvio, l'app richiederà:
- **Localizzazione**: Autorizza "Quando l'app è in uso"

## ✅ Verifica Finale

L'app dovrebbe:
- ✅ Avviarsi senza errori
- ✅ Mostrare la schermata di selezione zona
- ✅ Permettere il download di una zona
- ✅ Mostrare la mappa con i POI
- ✅ Mostrare la lista dei POI
- ✅ Permettere la navigazione verso un POI

## 🐛 Problemi Comuni

### Errore: "Cannot find 'POI' in scope"
- Verifica che tutti i file siano stati aggiunti al target
- Pulisci il build folder: **Product → Clean Build Folder** (⇧⌘K)
- Ricostruisci: **Product → Build** (⌘B)

### Errore: "Missing Info.plist"
- Aggiungi `Info.plist` al progetto
- Verifica che sia incluso nel target

### L'app non carica i dati
- Verifica la connessione di rete
- Controlla l'URL del backend
- Verifica i log in Xcode Console (View → Debug Area → Activate Console)

### La localizzazione non funziona
- Verifica che `NSLocationWhenInUseUsageDescription` sia in `Info.plist`
- Controlla le autorizzazioni: Impostazioni → Privacy → Localizzazione

## 📞 Supporto

Per problemi o domande, controlla:
1. I log in Xcode Console
2. Le impostazioni del dispositivo
3. La configurazione del backend

