# 🔐 Fix: Development Team Mancante

## ❌ Problema Attuale

```
error: Signing for "WhatisExplorer" requires a development team.
Select a development team in the Signing & Capabilities editor.
```

**Sintomi**:
- ❌ Pulsante Run grigio e non cliccabile
- ❌ Nessun messaggio nell'area di debug
- ❌ Build fallisce con errore "requires a development team"

## ✅ Soluzione: Configura il Team in Xcode

### Passo 1: Apri Signing & Capabilities

1. In Xcode, seleziona il progetto **"WhatisExplorer"** nel navigator (icona blu in alto)
2. Seleziona il target **"WhatisExplorer"** (sotto "TARGETS")
3. Vai alla tab **"Signing & Capabilities"**

### Passo 2: Configura Automatic Signing

1. **Seleziona** la checkbox **"Automatically manage signing"**
2. Nel menu a tendina **"Team"**, seleziona il tuo team:
   - Dovrebbe apparire qualcosa come: **"Andrea Stagnaro (Personal Team)"**
   - Se non vedi team disponibili, vai al Passo 3

### Passo 3: Se Non Vedi Team Disponibili

1. **Xcode → Preferences** (⌘,)
2. Vai alla tab **"Accounts"**
3. Se non c'è un account:
   - Clicca **"+"** in basso a sinistra
   - Aggiungi il tuo **Apple ID**
   - Inserisci password e verifica
4. Se c'è già un account:
   - Seleziona l'account
   - Clicca **"Download Manual Profiles"**
   - Attendi che finisca
5. Torna al progetto e riprova il Passo 2

### Passo 4: Attendi Generazione Profilo

1. Dopo aver selezionato il Team, **ATTENDI 10-30 secondi**
2. Vedrai un'icona di caricamento accanto a "Team"
3. Xcode genererà automaticamente il provisioning profile
4. Verifica che **NON ci siano errori rossi**

### Passo 5: Verifica

1. Il pulsante **Run** dovrebbe diventare **cliccabile** (non più grigio)
2. In alto a sinistra, seleziona **"iPhone di Andrea 11"** (non un simulatore)
3. Premi **Run** (⌘R) o clicca Play ▶️

## 🎯 Checklist

Prima di fare Run, verifica:

- [ ] "Automatically manage signing" è selezionato
- [ ] Team è selezionato (es: "Andrea Stagnaro (Personal Team)")
- [ ] Nessun errore rosso in Signing & Capabilities
- [ ] Atteso 10-30 secondi per generazione profilo
- [ ] Pulsante Run è cliccabile (non grigio)
- [ ] "iPhone di Andrea 11" è selezionato (non simulatore)

## ⚠️ Se il Team Non Appare

### Opzione A: Verifica Account Apple ID

1. Xcode → Preferences (⌘,) → Accounts
2. Verifica che il tuo Apple ID sia presente
3. Se non c'è, aggiungilo con il pulsante "+"

### Opzione B: Verifica Certificati

1. Xcode → Preferences (⌘,) → Accounts
2. Seleziona il tuo account
3. Clicca "Download Manual Profiles"
4. Attendi che finisca
5. Torna al progetto e riprova

### Opzione C: Crea Personal Team

Se non hai un account sviluppatore:

1. Xcode → Preferences (⌘,) → Accounts
2. Aggiungi il tuo Apple ID
3. Xcode creerà automaticamente un "Personal Team"
4. Usa questo team per lo sviluppo

## 🔍 Verifica Team ID (Opzionale)

Se vuoi verificare il Team ID:

1. Xcode → Preferences (⌘,) → Accounts
2. Seleziona il tuo account
3. Sotto "Personal Team" vedrai un Team ID (es: `ABC123DEF4`)

Questo Team ID viene usato automaticamente da Xcode quando selezioni "Automatically manage signing".

## 💡 Dopo la Configurazione

Una volta configurato il team:

1. **Chiudi e riapri Xcode** (⌘Q, poi riapri)
2. Verifica che il team sia ancora selezionato
3. **Product → Clean Build Folder** (⇧⌘K)
4. **Product → Run** (⌘R)

L'app dovrebbe installarsi sul telefono!

---

**Se dopo questi passi il problema persiste, dimmi cosa vedi in Signing & Capabilities!**

