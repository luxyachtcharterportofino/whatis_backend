# 🔧 Risoluzione Problema App iOS "Non Disponibile"

## ❌ Problema

L'app Whatis Explorer installata sul tuo iPhone 11 smette di funzionare dopo un po' di tempo e mostra il messaggio **"App non disponibile"** o **"Untrusted Developer"**.

### Perché Succede?

Questo accade perché l'app è stata installata in **modalità sviluppo/test** e:

1. **Certificati di sviluppo scaduti** - I certificati Apple Developer hanno una scadenza
2. **Profili di provisioning scaduti** - I profili di provisioning hanno una durata limitata:
   - **Profili gratuiti (Apple ID personale)**: Scadono dopo **7 giorni**
   - **Profili Developer Program ($99/anno)**: Scadono dopo **1 anno**
3. **App installata tramite Xcode**: Le app installate direttamente da Xcode hanno la stessa durata del profilo

## ✅ Soluzioni

### Soluzione 1: Rinnovo Automatico (Raccomandato)

**Per Developer Program ($99/anno):**

1. Apri Xcode
2. Vai su **Xcode → Settings → Accounts**
3. Seleziona il tuo Apple ID
4. Clicca **"Download Manual Profiles"** per aggiornare i profili
5. Nel progetto, vai su **Signing & Capabilities**
6. Seleziona il tuo **Team**
7. Xcode rinnoverà automaticamente i certificati

**Per Apple ID gratuito:**

I profili gratuiti scadono dopo 7 giorni. Devi:
- Riconnettere l'iPhone ogni 7 giorni
- Ricompilare e reinstallare l'app da Xcode

### Soluzione 2: Profilo Ad Hoc (Più Stabile)

I profili **Ad Hoc** durano più a lungo e sono ideali per test su dispositivi specifici.

#### Passo 1: Registra il tuo iPhone

1. Vai su [Apple Developer Portal](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles**
3. **Devices → Register a New Device**
4. Inserisci:
   - **Name**: "iPhone 11 - Andrea"
   - **UDID**: Trovalo in Xcode → Window → Devices and Simulators

#### Passo 2: Crea Profilo Ad Hoc

1. **Profiles → Create a New Profile**
2. Seleziona **Ad Hoc**
3. Seleziona:
   - **App ID**: `com.andaly.WhatisExplorerLite`
   - **Certificates**: Il tuo certificato di sviluppo
   - **Devices**: Il tuo iPhone 11
4. **Generate** e scarica il profilo

#### Passo 3: Installa Profilo Ad Hoc

1. In Xcode, vai su **Signing & Capabilities**
2. **Automatically manage signing**: **DISABILITA**
3. **Provisioning Profile**: Seleziona il profilo Ad Hoc appena creato
4. **Build & Run** (⌘R)

**Vantaggi:**
- ✅ Durata più lunga (fino a 1 anno)
- ✅ Non richiede riconnessione ogni 7 giorni
- ✅ Più stabile per test prolungati

### Soluzione 3: Distribuzione Enterprise (Se disponibile)

Se hai un account **Apple Developer Enterprise Program** ($299/anno):

1. Crea un profilo di distribuzione Enterprise
2. L'app può essere distribuita internamente senza App Store
3. Durata illimitata (fino a revoca certificato)

### Soluzione 4: TestFlight (Raccomandato per Test Prolungati)

**TestFlight** è il modo migliore per distribuire app in test:

1. **Upload su App Store Connect**
   - Xcode → Product → Archive
   - Window → Organizer → Distribute App
   - Seleziona **App Store Connect**

2. **Configura TestFlight**
   - Vai su [App Store Connect](https://appstoreconnect.apple.com)
   - Seleziona la tua app
   - **TestFlight → Internal Testing** o **External Testing**
   - Aggiungi tester (il tuo Apple ID)

3. **Installa da TestFlight**
   - Installa app **TestFlight** dall'App Store
   - Riceverai un invito via email
   - L'app rimane disponibile per **90 giorni** (rinnovabile)

**Vantaggi:**
- ✅ Durata 90 giorni (rinnovabile)
- ✅ Aggiornamenti OTA (Over-The-Air)
- ✅ Non richiede Xcode
- ✅ Funziona su qualsiasi iPhone

## 🔄 Procedura Rapida di Rinnovo

Quando l'app smette di funzionare:

### Per Apple ID Gratuito:

```bash
# 1. Apri Xcode
open WhatisExplorerLite.xcodeproj

# 2. Collega iPhone
# 3. Vai su Signing & Capabilities
# 4. Seleziona Team (se non selezionato)
# 5. Build & Run (⌘R)
```

### Per Developer Program:

```bash
# 1. Rinnova profili
# Xcode → Settings → Accounts → Download Manual Profiles

# 2. Apri progetto
open WhatisExplorerLite.xcodeproj

# 3. Build & Run (⌘R)
```

## 📱 Come Verificare Scadenza Profilo

1. **iPhone → Impostazioni → Generale → Gestione profili**
2. Cerca **"Apple Development"** o **"Apple Distribution"**
3. Tocca per vedere la **data di scadenza**

## 🎯 Raccomandazione Finale

**Per uso personale/test prolungati:**

1. **Opzione A (Gratuita)**: Usa **TestFlight** se possibile
2. **Opzione B**: Crea profilo **Ad Hoc** (durata 1 anno)
3. **Opzione C**: Rinnova ogni 7 giorni con Apple ID gratuito

**Per distribuzione a più utenti:**

- Usa **TestFlight** per beta testing
- Usa **App Store** per distribuzione pubblica

## 🔧 Script Automatico di Rinnovo

Puoi creare uno script per automatizzare il rinnovo:

```bash
#!/bin/bash
# renew_provisioning.sh

echo "🔄 Rinnovo profili di provisioning..."

# Apri Xcode e rinnova profili
osascript <<EOF
tell application "Xcode"
    activate
    tell application "System Events"
        keystroke "," using {command down}
        delay 2
        click button "Accounts" of toolbar 1 of window 1
        delay 1
        # Seleziona account e scarica profili
    end tell
end tell
EOF

echo "✅ Profili rinnovati!"
```

## 📝 Note Importanti

- ⚠️ **Backup**: Prima di reinstallare, fai backup dei dati dell'app
- ⚠️ **Dati**: Reinstallare l'app potrebbe cancellare i dati offline salvati
- ✅ **TestFlight**: I dati vengono preservati tra aggiornamenti
- ✅ **Ad Hoc**: I dati vengono preservati se usi lo stesso Bundle ID

## 🆘 Supporto

Se il problema persiste:

1. Verifica che il tuo **Apple ID** sia valido
2. Controlla che il **certificato** non sia revocato
3. Verifica che l'**iPhone** sia ancora registrato nel Developer Portal
4. Prova a **rimuovere e reinstallare** l'app completamente

---

**Ultimo aggiornamento**: Dicembre 2024  
**Compatibilità**: iOS 15+, Xcode 15+

