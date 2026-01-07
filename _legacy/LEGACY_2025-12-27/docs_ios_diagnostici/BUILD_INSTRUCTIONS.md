# 🔧 Istruzioni Build - Whatis Explorer Lite

## Metodo 1: Usando Xcode (Consigliato)

### Passo 1: Crea il Progetto
1. Apri **Xcode**
2. **File → New → Project**
3. Seleziona **iOS → App**
4. Configura:
   - **Product Name**: `WhatisExplorerLite`
   - **Team**: Seleziona il tuo team
   - **Organization Identifier**: `com.andaly`
   - **Bundle Identifier**: `com.andaly.WhatisExplorerLite`
   - **Interface**: **SwiftUI**
   - **Language**: **Swift**
   - **Minimum Deployment**: **iOS 15.0**
   - ✅ **Include Tests**: Deseleziona
5. Salva in: `~/Desktop/WhatisExplorer_Lite/`

### Passo 2: Importa i File
1. Nel navigator Xcode, fai click destro sulla cartella del progetto
2. **Add Files to "WhatisExplorerLite"...**
3. Naviga e seleziona la cartella `WhatisExplorerLite/` (quella con Models, Services, Views)
4. Assicurati che:
   - ✅ **Copy items if needed** sia selezionato
   - ✅ **Create groups** sia selezionato
   - ✅ Il target **WhatisExplorerLite** sia selezionato
5. Click **Add**

### Passo 3: Sostituisci App File
1. Elimina il file `WhatisExplorerLiteApp.swift` generato automaticamente
2. Aggiungi il file `WhatisExplorerLite/WhatisExplorerLiteApp.swift` dalla cartella

### Passo 4: Configura Info.plist
1. Se `Info.plist` non esiste, crealo:
   - Click destro → **New File** → **Property List** → `Info.plist`
2. Copia il contenuto da `WhatisExplorerLite/Info.plist`
3. Oppure aggiungi manualmente le chiavi necessarie

### Passo 5: Configura Capabilities
1. Seleziona il target **WhatisExplorerLite**
2. Vai su **Signing & Capabilities**
3. Click **+ Capability**
4. Aggiungi **Location Services**
5. Seleziona **When In Use**

### Passo 6: Configura URL Backend
1. Apri `Services/APIService.swift`
2. Verifica che `baseURL` sia configurato correttamente
3. Default: `http://localhost:3000/api`

### Passo 7: Aggiungi Icona App
1. Aggiungi l'immagine `iOS_AppIcon_1024.png` al progetto
2. In `Assets.xcassets`, seleziona `AppIcon`
3. Trascina l'immagine 1024x1024 nello slot appropriato

### Passo 8: Build e Run
1. Seleziona un simulatore o il tuo iPhone
2. **Product → Build** (⌘B) per verificare errori
3. **Product → Run** (⌘R) per avviare

## Metodo 2: Usando xcodegen (Se disponibile)

Se hai installato `xcodegen`:

```bash
cd ~/Desktop/WhatisExplorer_Lite
xcodegen generate
open WhatisExplorerLite.xcodeproj
```

Poi segui i passi 2-8 del Metodo 1.

## ⚠️ Risoluzione Errori Comuni

### Errore: "Cannot find 'POI' in scope"
- Verifica che tutti i file siano nel target
- **Product → Clean Build Folder** (⇧⌘K)
- **Product → Build** (⌘B)

### Errore: "Missing Info.plist"
- Aggiungi `Info.plist` al progetto
- Verifica che sia incluso nel target

### Errore: Map non disponibile
- ✅ Già risolto: MapView usa UIViewRepresentable per iOS 15+

### Errore: Network request failed
- Verifica che il backend sia in esecuzione
- Controlla l'URL in `APIService.swift`
- Per localhost, assicurati che iPhone e Mac siano sulla stessa rete Wi-Fi

## 📱 Installazione su iPhone 11

1. Collega iPhone al Mac
2. In Xcode, seleziona il dispositivo dalla lista
3. Verifica che il **Team** sia configurato
4. Click **Run** (⌘R)
5. Se richiesto, autorizza l'app sul dispositivo:
   - iPhone → Impostazioni → Generale → Gestione VPN e Device Management
   - Autorizza il certificato

## ✅ Verifica Funzionalità

Dopo il build:
- [ ] App si avvia senza errori
- [ ] Mostra schermata selezione zona
- [ ] Download zona funziona
- [ ] Mappa mostra POI
- [ ] Lista POI funziona
- [ ] Dettagli POI funzionano
- [ ] Navigazione funziona
- [ ] Modalità offline funziona

