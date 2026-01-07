# 🚀 Guida TestFlight - App Sempre Disponibile

## Il Problema
Le app installate via USB con Xcode **scadono dopo 7 giorni** e smettono di funzionare quando non sei collegato al Mac.

## La Soluzione: TestFlight
TestFlight permette di distribuire l'app sul tuo iPhone con:
- ✅ **Durata 90 giorni** (rinnovabile)
- ✅ **Funziona senza Mac connesso**
- ✅ **Aggiornamenti automatici**
- ✅ **Più stabile e professionale**

---

## 📋 Requisiti

1. **Account Apple Developer** (gratuito o a pagamento)
   - Gratuito: https://developer.apple.com/account
   - Include TestFlight per distribuzione interna

2. **Xcode installato** sul Mac

3. **iPhone connesso** (solo per la prima installazione)

---

## 🎯 Passo 1: Preparare l'App per TestFlight

### 1.1 Apri il Progetto in Xcode
```bash
cd whatis_backend/ios/WhatisExplorer
open WhatisExplorer.xcodeproj
```

### 1.2 Configura il Team
1. In Xcode, seleziona il progetto **WhatisExplorer** nel navigator
2. Vai su **Signing & Capabilities**
3. Seleziona il tuo **Team** (Apple Developer Account)
4. Assicurati che **Automatically manage signing** sia selezionato

### 1.3 Verifica Bundle ID
- **Bundle Identifier**: `com.andaly.WhatisExplorer`
- Deve essere unico e corrispondere al tuo account

---

## 🎯 Passo 2: Creare l'Archive (Build per Distribuzione)

### 2.1 Seleziona "Any iOS Device"
1. In alto a sinistra in Xcode, clicca sul dispositivo
2. Seleziona **"Any iOS Device"** (non il simulatore)

### 2.2 Crea l'Archive
1. Vai su **Product → Archive**
2. Attendi che Xcode compili l'app (può richiedere alcuni minuti)
3. Si aprirà automaticamente la finestra **Organizer**

---

## 🎯 Passo 3: Caricare su App Store Connect

### 3.1 Apri App Store Connect
1. Nella finestra **Organizer**, clicca su **Distribute App**
2. Seleziona **App Store Connect**
3. Clicca **Next**

### 3.2 Upload
1. Seleziona **Upload** (non Export)
2. Clicca **Next**
3. Seleziona le opzioni di distribuzione (lascia default)
4. Clicca **Upload**
5. Attendi il completamento (può richiedere 10-15 minuti)

---

## 🎯 Passo 4: Configurare TestFlight

### 4.1 Accedi ad App Store Connect
1. Vai su https://appstoreconnect.apple.com
2. Accedi con il tuo Apple ID Developer

### 4.2 Crea l'App (se non esiste)
1. Clicca su **"Le mie app"**
2. Clicca **"+"** → **"Nuova app"**
3. Compila:
   - **Nome**: Whatis Explorer
   - **Lingua primaria**: Italiano
   - **Bundle ID**: `com.andaly.WhatisExplorer`
   - **SKU**: `whatis-explorer-001` (qualsiasi ID unico)

### 4.3 Attendi l'Elaborazione
1. Vai su **TestFlight** nella barra laterale
2. Attendi che l'upload venga elaborato (10-30 minuti)
3. Quando vedi **"Pronto per il test"**, procedi

---

## 🎯 Passo 5: Aggiungere Tester Interni

### 5.1 Aggiungi Te Stesso come Tester
1. In **TestFlight**, vai su **Testers interni**
2. Clicca **"+"** per aggiungere tester
3. Aggiungi il tuo **Apple ID email**
4. Clicca **Invita**

### 5.2 Installa TestFlight sul Tuo iPhone
1. Scarica **TestFlight** dall'App Store sul tuo iPhone
2. Apri TestFlight
3. Accedi con il tuo Apple ID Developer

### 5.3 Installa l'App
1. In TestFlight, vedrai **"Whatis Explorer"** disponibile
2. Clicca **Installa**
3. L'app verrà installata sul tuo iPhone

---

## ✅ Fatto!

Ora l'app:
- ✅ **Funziona per 90 giorni** senza riconnessione
- ✅ **Funziona senza Mac connesso**
- ✅ **Si aggiorna automaticamente** quando carichi nuove versioni
- ✅ **È sempre disponibile** sul tuo iPhone

---

## 🔄 Rinnovare dopo 90 Giorni

Quando l'app sta per scadere (TestFlight ti avviserà):

1. **Crea una nuova versione** in Xcode
2. **Incrementa il numero di versione** (es. 1.0 → 1.1)
3. **Ripeti i passi 2-3** (Archive e Upload)
4. L'app si aggiornerà automaticamente sul tuo iPhone

---

## 🆘 Problemi Comuni

### "Nessun team disponibile"
- Verifica di aver accettato i termini su https://developer.apple.com/account
- Attendi qualche minuto dopo la registrazione

### "Bundle ID già in uso"
- Cambia il Bundle ID in Xcode (es. `com.andaly.WhatisExplorer2`)
- Aggiorna anche in App Store Connect

### "Upload fallito"
- Verifica la connessione internet
- Prova a fare un **Clean Build Folder** (⌘⇧K) e riprova

### "App non appare in TestFlight"
- Attendi 10-30 minuti per l'elaborazione
- Verifica che l'upload sia completato in Organizer

---

## 📱 Alternative: Ad Hoc Distribution

Se non vuoi usare TestFlight, puoi creare una distribuzione **Ad Hoc**:

1. In **Organizer**, seleziona **Distribute App**
2. Scegli **Ad Hoc**
3. Aggiungi l'**UDID del tuo iPhone** (trovalo in Xcode → Window → Devices)
4. Crea l'IPA e installalo manualmente

**Nota**: Ad Hoc funziona solo per dispositivi registrati e richiede reinstallazione manuale.

---

## 💡 Consiglio

**TestFlight è la soluzione migliore** perché:
- Più semplice da usare
- Aggiornamenti automatici
- Durata più lunga (90 giorni vs 7 giorni)
- Funziona su qualsiasi iPhone (non serve registrare UDID)

