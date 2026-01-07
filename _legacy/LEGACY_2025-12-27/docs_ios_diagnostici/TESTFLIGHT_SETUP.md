# 🚀 Guida Completa: Setup TestFlight per Whatis Explorer Lite

## 📋 Prerequisiti

- ✅ Account **Apple Developer Program** ($99/anno)
  - Se non ce l'hai: [Registrati qui](https://developer.apple.com/programs/)
- ✅ Xcode 15+ installato
- ✅ iPhone 11 collegato (opzionale, per test)
- ✅ App Store Connect accesso

## 🎯 Panoramica Processo

1. **Preparazione App** (5 min)
2. **Creazione Archive** (2 min)
3. **Upload su App Store Connect** (5-10 min)
4. **Configurazione TestFlight** (5 min)
5. **Installazione su iPhone** (2 min)

**Tempo totale**: ~20-30 minuti

---

## 📝 Passo 1: Preparazione App

### 1.1 Verifica Bundle ID

1. Apri Xcode
2. Apri progetto: `WhatisExplorerLite.xcodeproj`
3. Seleziona target **WhatisExplorerLite**
4. Tab **Signing & Capabilities**
5. Verifica **Bundle Identifier**: `com.andaly.WhatisExplorerLite`

### 1.2 Configura Signing

1. In **Signing & Capabilities**:
   - ✅ **Automatically manage signing**: **ATTIVATO**
   - **Team**: Seleziona il tuo team Apple Developer
   - Se non vedi il team:
     - Xcode → Settings → Accounts
     - Aggiungi Apple ID
     - Seleziona team

### 1.3 Verifica Version e Build

1. Tab **General**
2. **Version**: `1.0` (o incrementa se già esiste)
3. **Build**: `1` (o incrementa: `2`, `3`, etc.)

### 1.4 Verifica Info.plist

Assicurati che `Info.plist` contenga:
- ✅ Bundle identifier
- ✅ Permessi localizzazione
- ✅ Privacy descriptions

---

## 📦 Passo 2: Creazione Archive

### 2.1 Seleziona Destinazione

1. In Xcode, seleziona **Any iOS Device** (non simulatore)
   - Top bar: `WhatisExplorerLite > Any iOS Device`

### 2.2 Crea Archive

1. Menu: **Product → Archive**
   - Oppure: **⌘B** (Build) poi **Product → Archive**
2. Attendi completamento (2-5 minuti)
3. Si aprirà automaticamente **Organizer**

### 2.3 Verifica Archive

1. **Window → Organizer** (se non si è aperto)
2. Tab **Archives**
3. Verifica che ci sia l'archive appena creato
4. Data e versione devono essere corrette

---

## ☁️ Passo 3: Upload su App Store Connect

### 3.1 Distribuisci Archive

1. In **Organizer**, seleziona l'archive
2. Clicca **Distribute App**
3. Seleziona **App Store Connect**
4. Clicca **Next**

### 3.2 Opzioni Distribuzione

1. **Upload**: Seleziona questa opzione
2. Clicca **Next**

### 3.3 Opzioni Upload

1. ✅ **Include bitcode**: (opzionale, lascia default)
2. ✅ **Upload symbols**: (raccomandato per crash reports)
3. Clicca **Next**

### 3.4 Verifica Signing

1. Xcode dovrebbe gestire automaticamente
2. Se chiede certificati, seleziona **Automatically manage signing**
3. Clicca **Next**

### 3.5 Riepilogo e Upload

1. Verifica informazioni:
   - App: WhatisExplorerLite
   - Version: 1.0
   - Build: 1
2. Clicca **Upload**
3. Attendi completamento (5-10 minuti)
4. ✅ **"Upload Successful"** quando completato

### 3.6 Verifica su App Store Connect

1. Vai su [App Store Connect](https://appstoreconnect.apple.com)
2. **My Apps**
3. Cerca **Whatis Explorer Lite** (o crea nuova app se prima volta)
4. Tab **TestFlight**
5. Attendi che il build appaia (può richiedere 10-30 minuti)
   - Status: **Processing** → **Ready to Test**

---

## 🎮 Passo 4: Configurazione TestFlight

### 4.1 Crea App (Solo Prima Volta)

Se è la prima volta:

1. **App Store Connect → My Apps → +**
2. Compila:
   - **Platform**: iOS
   - **Name**: Whatis Explorer Lite
   - **Primary Language**: Italian
   - **Bundle ID**: `com.andaly.WhatisExplorerLite`
   - **SKU**: `whatis-explorer-lite` (qualsiasi ID univoco)
3. Clicca **Create**

### 4.2 Configura Informazioni App

1. Tab **App Information**
2. Compila:
   - **Category**: Travel (o Navigation)
   - **Privacy Policy URL**: (opzionale, ma raccomandato)
3. Salva

### 4.3 Aggiungi Build a TestFlight

1. Tab **TestFlight**
2. Sezione **iOS Builds**
3. Se il build è pronto, clicca **+** accanto a **Build**
4. Seleziona il build (Version 1.0, Build 1)
5. Clicca **Next**

### 4.4 Configura Testing

#### Internal Testing (Solo per Team)

1. Sezione **Internal Testing**
2. Clicca **+** per creare gruppo (es. "Team")
3. Aggiungi il tuo Apple ID come tester
4. Seleziona build
5. **Start Testing**

#### External Testing (Per Te Stesso)

1. Sezione **External Testing**
2. Clicca **+** per creare gruppo (es. "Beta Testers")
3. **Add Testers**:
   - Inserisci il tuo **Apple ID email**
   - Riceverai invito via email
4. Compila informazioni richieste:
   - **What to Test**: Descrizione cosa testare
   - **Feedback Email**: Il tuo email
5. Seleziona build
6. **Submit for Review** (Apple deve approvare, 24-48h)

**Nota**: Per test immediato, usa **Internal Testing** (non richiede review)

---

## 📱 Passo 5: Installazione su iPhone

### 5.1 Installa TestFlight

1. Su iPhone, vai su **App Store**
2. Cerca **TestFlight**
3. **Installa** (se non già installato)

### 5.2 Accetta Invito

#### Per Internal Testing:

1. Riceverai email da Apple
2. Apri email su iPhone
3. Tocca link **"Start Testing"**
4. Si aprirà TestFlight
5. Tocca **Accept**

#### Per External Testing:

1. Riceverai email invito
2. Apri email su iPhone
3. Tocca link invito
4. Si aprirà TestFlight
5. Tocca **Accept**

### 5.3 Installa App

1. Apri app **TestFlight** su iPhone
2. Vedi **Whatis Explorer Lite**
3. Tocca **Install**
4. Attendi download e installazione
5. ✅ App pronta!

---

## 🔄 Aggiornamenti Futuri

Quando vuoi aggiornare l'app:

1. **Incrementa Build Number**:
   - Xcode → General → Build: `2`, `3`, `4`, etc.
2. **Crea nuovo Archive**: Product → Archive
3. **Upload**: Distribute App → App Store Connect
4. **TestFlight**: Il nuovo build apparirà automaticamente
5. **Su iPhone**: TestFlight notificherà aggiornamento disponibile

**Durata Build**: 90 giorni (rinnovabile)

---

## ✅ Checklist Finale

Prima di iniziare, verifica:

- [ ] Account Apple Developer Program attivo
- [ ] Xcode 15+ installato
- [ ] Team selezionato in Signing & Capabilities
- [ ] Bundle ID: `com.andaly.WhatisExplorerLite`
- [ ] Version e Build impostati
- [ ] App compila senza errori
- [ ] Accesso App Store Connect

---

## 🐛 Risoluzione Problemi

### "No accounts with App Store Connect access"

**Soluzione**:
1. Xcode → Settings → Accounts
2. Aggiungi Apple ID con Developer Program
3. Seleziona team

### "Bundle ID already exists"

**Soluzione**:
- Il Bundle ID è già registrato
- Vai su App Store Connect e usa app esistente
- Oppure cambia Bundle ID in Xcode

### "Upload failed: Invalid Bundle"

**Soluzione**:
- Verifica che tutti i file siano nel target
- Product → Clean Build Folder (⇧⌘K)
- Ricrea Archive

### "Build in Processing" per molto tempo

**Soluzione**:
- Normale, può richiedere 30-60 minuti
- Controlla email per notifiche
- Se dopo 2 ore ancora in processing, contatta support

### "TestFlight app non si installa"

**Soluzione**:
1. Verifica che invito sia accettato
2. Riavvia iPhone
3. Reinstalla TestFlight
4. Controlla spazio disponibile su iPhone

---

## 📞 Supporto

- **Apple Developer Support**: [developer.apple.com/support](https://developer.apple.com/support)
- **App Store Connect Help**: [help.apple.com/app-store-connect](https://help.apple.com/app-store-connect)

---

## 🎉 Completato!

Una volta installata, l'app rimarrà disponibile per **90 giorni** e riceverai notifiche per aggiornamenti.

**Prossimi passi**:
- Testa tutte le funzionalità
- Raccogli feedback
- Prepara aggiornamenti futuri

---

**Ultimo aggiornamento**: Dicembre 2024  
**Compatibilità**: iOS 15+, Xcode 15+

