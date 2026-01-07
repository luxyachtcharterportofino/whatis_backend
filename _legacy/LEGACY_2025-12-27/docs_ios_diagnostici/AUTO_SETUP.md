# 🚀 Setup Automatico - Whatis Explorer Lite

## ⚡ Setup Veloce (10 minuti)

### Passo 1: Crea Progetto Xcode (2 min)

1. Apri **Xcode**
2. **File → New → Project** (⇧⌘N)
3. Seleziona **iOS → App**
4. Compila il form:
   ```
   Product Name: WhatisExplorerLite
   Team: [Seleziona il tuo team]
   Organization Identifier: com.andaly
   Bundle Identifier: com.andaly.WhatisExplorerLite
   Interface: SwiftUI
   Language: Swift
   Minimum Deployment: iOS 15.0
   ✅ Include Tests: DESELEZIONA
   ```
5. Click **Next**
6. Salva in: `~/Desktop/WhatisExplorer_Lite/`
7. Click **Create**

### Passo 2: Importa File (2 min)

1. Nel navigator Xcode (sinistra), fai click destro sulla cartella **WhatisExplorerLite** (quella blu)
2. Seleziona **Add Files to "WhatisExplorerLite"...**
3. Naviga fino a `~/Desktop/WhatisExplorer_Lite/WhatisExplorerLite/`
4. Seleziona le cartelle:
   - `Models`
   - `Services`
   - `Views`
5. **IMPORTANTE**: Assicurati che:
   - ✅ **Copy items if needed** sia selezionato
   - ✅ **Create groups** sia selezionato
   - ✅ Il target **WhatisExplorerLite** sia selezionato
6. Click **Add**

### Passo 3: Sostituisci App File (1 min)

1. Elimina il file `WhatisExplorerLiteApp.swift` generato automaticamente (click destro → Delete → Move to Trash)
2. Verifica che il file `WhatisExplorerLite/WhatisExplorerLiteApp.swift` sia presente nel progetto

### Passo 4: Configura Info.plist (1 min)

1. Se `Info.plist` non esiste nel progetto:
   - Click destro sul progetto → **New File**
   - **Property List** → `Info.plist`
2. Apri `Info.plist` e copia il contenuto da `WhatisExplorerLite/Info.plist`
3. Oppure aggiungi manualmente queste chiavi:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Whatis Explorer Lite ha bisogno della tua posizione per mostrarti i POI nelle vicinanze e calcolare le distanze.</string>
   <key>NSLocationAlwaysUsageDescription</key>
   <string>Whatis Explorer Lite ha bisogno della tua posizione per mostrarti i POI nelle vicinanze e calcolare le distanze.</string>
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsArbitraryLoads</key>
       <true/>
   </dict>
   ```

### Passo 5: Configura Capabilities (1 min)

1. Seleziona il target **WhatisExplorerLite** (icona blu in alto)
2. Vai su **Signing & Capabilities**
3. Click **+ Capability**
4. Cerca e aggiungi **Location Services**
5. Seleziona **When In Use**

### Passo 6: Verifica URL Backend (30 sec)

1. Apri `Services/APIService.swift`
2. Verifica che la riga 15 sia:
   ```swift
   UserDefaults.standard.string(forKey: "apiBaseURL") ?? "http://localhost:3000/api"
   ```
3. ✅ Già configurato correttamente!

### Passo 7: Aggiungi Icona (2 min)

1. Se hai il file `iOS_AppIcon_1024.png`:
   - Trascinalo nel progetto Xcode
   - Apri `Assets.xcassets`
   - Seleziona `AppIcon`
   - Trascina l'immagine 1024x1024 nello slot **App Store iOS 1024pt**
   - Xcode genererà automaticamente tutte le dimensioni

### Passo 8: Build e Test (1 min)

1. Seleziona un simulatore (es. iPhone 14)
2. **Product → Build** (⌘B)
3. Se ci sono errori, vedi sezione "Risoluzione Errori" sotto
4. **Product → Run** (⌘R)

### Passo 9: Test su iPhone 11 (2 min)

1. Collega iPhone 11 al Mac
2. In Xcode, seleziona il dispositivo dalla lista
3. Verifica che il **Team** sia configurato
4. Click **Run** (⌘R)
5. Se richiesto, autorizza sul dispositivo:
   - iPhone → Impostazioni → Generale → Gestione VPN e Device Management
   - Autorizza il certificato

## ✅ Verifica Funzionalità

Dopo il build, testa:

- [ ] App si avvia
- [ ] Mostra schermata selezione zona
- [ ] Seleziona "Tigullio nuova"
- [ ] Download zona funziona
- [ ] Mappa mostra POI
- [ ] Lista POI funziona
- [ ] Dettagli POI funzionano
- [ ] Navigazione funziona
- [ ] Disconnetti Wi-Fi → App funziona offline

## 🐛 Risoluzione Errori

### "Cannot find 'POI' in scope"
**Soluzione:**
1. Verifica che tutti i file siano nel target
2. **Product → Clean Build Folder** (⇧⌘K)
3. **Product → Build** (⌘B)

### "Missing Info.plist"
**Soluzione:**
1. Aggiungi `Info.plist` al progetto
2. Verifica che sia incluso nel target

### "Network request failed"
**Soluzione:**
1. Verifica che il backend sia in esecuzione: `http://localhost:3000`
2. Per iPhone: usa l'IP del Mac invece di localhost
   - Mac → Preferenze di Sistema → Condivisione → Internet
   - Abilita "Condivisione Internet"
   - Trova l'IP del Mac (es. 192.168.1.100)
   - In app → Impostazioni → URL Backend: `http://192.168.1.100:3000/api`

### Map non funziona
**Soluzione:**
- ✅ Già risolto: MapView usa UIViewRepresentable per iOS 15+

### Errore di compilazione
**Soluzione:**
1. **Product → Clean Build Folder** (⇧⌘K)
2. Chiudi e riapri Xcode
3. **Product → Build** (⌘B)

## 📱 Configurazione iPhone per Localhost

Per usare `localhost:3000` da iPhone:

1. **Mac**: Abilita Condivisione Internet
   - Preferenze di Sistema → Condivisione
   - Abilita "Condivisione Internet"
   - Seleziona la connessione (Wi-Fi/Ethernet)

2. **Trova IP Mac**:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Esempio: `192.168.1.100`

3. **iPhone**: Connetti alla stessa rete Wi-Fi del Mac

4. **App**: Impostazioni → URL Backend
   - Cambia in: `http://192.168.1.100:3000/api`

## 🎉 Completato!

L'app è pronta per essere usata su iPhone 11!

