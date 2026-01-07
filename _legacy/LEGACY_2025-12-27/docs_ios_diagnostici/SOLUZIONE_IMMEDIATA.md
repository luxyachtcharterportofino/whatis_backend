# ✅ Soluzione Immediata: Team Non Configurato

## 🔍 Problema Identificato

Il progetto ha un Team ID configurato (`7Q6L79M4NU`), ma Xcode non lo sta riconoscendo. Questo causa:
- ❌ Pulsante Run grigio
- ❌ Errore "requires a development team"

## 🎯 Soluzione in 3 Passi

### Passo 1: Apri Signing & Capabilities

1. In Xcode, seleziona il progetto **"WhatisExplorer"** (icona blu in alto a sinistra nel navigator)
2. Seleziona il target **"WhatisExplorer"** (sotto "TARGETS")
3. Clicca sulla tab **"Signing & Capabilities"**

### Passo 2: Configura Automatic Signing

1. **Seleziona** la checkbox **"Automatically manage signing"**
2. Nel menu a tendina **"Team"**:
   - Se vedi team disponibili: seleziona **"Andrea Stagnaro (Personal Team)"** o il tuo team
   - Se NON vedi team: vai al Passo 3

### Passo 3: Se Non Vedi Team

1. **Xcode → Preferences** (⌘,)
2. Tab **"Accounts"**
3. Se non c'è un account:
   - Clicca **"+"** → Aggiungi Apple ID
   - Inserisci `andreastagnaro@libero.it` e password
4. Se c'è già l'account:
   - Seleziona l'account
   - Clicca **"Download Manual Profiles"**
   - Attendi che finisca
5. Torna al progetto → Signing & Capabilities
6. Seleziona il Team dal menu

### Passo 4: Attendi Generazione Profilo

1. Dopo aver selezionato il Team, **ATTENDI 10-30 secondi**
2. Vedrai un'icona di caricamento
3. Xcode genererà il provisioning profile
4. Verifica che **NON ci siano errori rossi**

### Passo 5: Verifica e Run

1. Il pulsante **Run** dovrebbe diventare **cliccabile** (non più grigio)
2. Seleziona **"iPhone di Andrea 11"** (non un simulatore)
3. Premi **Run** (⌘R)

## ✅ Checklist

- [ ] "Automatically manage signing" selezionato
- [ ] Team selezionato nel menu
- [ ] Atteso 10-30 secondi per generazione profilo
- [ ] Nessun errore rosso
- [ ] Pulsante Run cliccabile
- [ ] "iPhone di Andrea 11" selezionato

## 🔄 Se Ancora Non Funziona

Dopo aver configurato il team:

1. **Chiudi Xcode** (⌘Q)
2. **Riapri Xcode** e il progetto
3. Verifica che il team sia ancora selezionato
4. **Product → Clean Build Folder** (⇧⌘K)
5. **Product → Run** (⌘R)

---

**💡 Il problema è che Xcode non ha il team selezionato nella UI, anche se è nel file di progetto. Devi selezionarlo manualmente in Signing & Capabilities!**

