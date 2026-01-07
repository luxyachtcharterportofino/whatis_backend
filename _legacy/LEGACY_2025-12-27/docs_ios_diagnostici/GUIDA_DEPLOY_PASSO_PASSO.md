# 📱 Guida Completa: Deploy App su iPhone - Passo Passo

## 🎯 Obiettivo
Installare l'app "Whatis Explorer" sul tuo iPhone quando Xcode dice "compilazione riuscita" ma l'app non appare sul telefono.

---

## 📋 PREPARAZIONE INIZIALE

### Passo 1: Apri il Terminale
1. Premi `⌘ + Spazio` (Command + Barra spaziatrice)
2. Digita "Terminale" o "Terminal"
3. Premi Invio

### Passo 2: Vai nella cartella del progetto
Copia e incolla questo comando nel terminale, poi premi Invio:

```bash
cd /Users/andreastagnaro/Desktop/whatis_backend/WhatisExplorer_Lite
```

Dovresti vedere qualcosa come:
```
andreastagnaro@MacBook WhatisExplorer_Lite %
```

### Passo 3: Esegui lo script di fix
Copia e incolla questo comando, poi premi Invio:

```bash
./fix_deploy_issue.sh
```

Vedrai un output con informazioni sul progetto. **È normale**, significa che sta funzionando.

---

## 📱 SUL TUO IPHONE

### Passo 4: Disinstalla l'app vecchia (IMPORTANTE!)

⚠️ **QUESTO È IL PASSAGGIO PIÙ IMPORTANTE!**

1. **Sblocca il telefono**
2. **Cerca l'icona "Whatis Explorer"** sulla home screen
3. **Tieni premuto** l'icona (non un tap veloce, ma una pressione lunga)
4. Aspetta che appaiano delle opzioni
5. Tocca **"Rimuovi App"** o **"Modifica App"**
6. Tocca **"Elimina App"**
7. Conferma con **"Elimina"**

✅ **Perché è importante?** Se l'app vecchia è ancora installata, Xcode non la sovrascrive. Deve essere eliminata prima.

---

## 🔌 CONNESSIONE TELEFONE

### Passo 5: Collega il telefono al Mac

1. **Prendi il cavo USB** del tuo iPhone
2. **Collega il telefono al Mac** via USB
3. **Sblocca il telefono** (inserisci il codice o usa Face ID/Touch ID)
4. Se appare un messaggio **"Fidati di questo computer?"**:
   - Tocca **"Fidati"** o **"Trust"**
   - Inserisci il codice del telefono se richiesto

✅ **Verifica**: Il telefono dovrebbe apparire nella barra laterale di Finder o in Xcode.

---

## 💻 IN XCODE

### Passo 6: Apri Xcode

**Opzione A - Usa il file .command:**
1. Vai sulla **Scrivania**
2. Doppio click su **"Apri_Xcode_WhatisExplorer.command"**
3. Xcode si aprirà automaticamente

**Opzione B - Apri manualmente:**
1. Apri Xcode
2. File → Open
3. Vai in: `/Users/andreastagnaro/Desktop/whatis_backend/WhatisExplorer_Lite/`
4. Seleziona **"WhatisExplorer.xcodeproj"**
5. Clicca "Open"

### Passo 7: Seleziona il tuo iPhone come destinazione

1. In alto a sinistra in Xcode, vedrai un menu a tendina
2. Clicca sul menu (dovrebbe dire "Any iOS Device" o un simulatore)
3. **Seleziona il tuo iPhone** (dovrebbe dire "iPhone di Andrea 11" o simile)
   - ⚠️ **NON selezionare un simulatore!**
   - ✅ **Seleziona il dispositivo fisico**

### Passo 8: Verifica Signing & Capabilities

1. Nella barra laterale sinistra di Xcode, clicca sul **nome del progetto** (in alto, icona blu)
2. Seleziona il **target "WhatisExplorer"** (sotto "TARGETS")
3. Clicca sulla tab **"Signing & Capabilities"**
4. Verifica che:
   - ✅ **"Automatically manage signing"** sia selezionato (spunta presente)
   - ✅ **"Team"** sia selezionato (dovrebbe mostrare il tuo nome o team)
   - ✅ **Bundle Identifier** sia: `com.andaly.WhatisExplorer`

**Se ci sono errori (frecce rosse):**
- Clicca su "Team" e seleziona il tuo team
- Se non vedi team, devi aggiungere il tuo account Apple in Xcode → Preferences → Accounts

### Passo 9: Pulisci il build

1. In Xcode, vai su **Product** (menu in alto)
2. Clicca su **"Clean Build Folder"**
   - Oppure premi: `⇧⌘K` (Shift + Command + K)
3. Aspetta che finisca (vedrai "Clean Succeeded" in basso)

### Passo 10: Compila e installa

1. Clicca sul **pulsante Play** (▶️) in alto a sinistra
   - Oppure premi: `⌘R` (Command + R)
2. **Aspetta** che compili (vedrai una barra di progresso)
3. Se tutto va bene, vedrai **"Build Succeeded"**
4. L'app dovrebbe **installarsi automaticamente** sul telefono

---

## ✅ VERIFICA FINALE

### Passo 11: Controlla sul telefono

1. **Sblocca il telefono**
2. **Cerca l'icona "Whatis Explorer"** sulla home screen
3. Se la vedi, **toccala per aprire**
4. Se si apre correttamente, **✅ SUCCESSO!**

---

## ❌ SE NON FUNZIONA ANCORA

### Problema: L'app non appare sul telefono

**Soluzione 1: Verifica che il telefono sia selezionato**
- In Xcode, assicurati di aver selezionato il dispositivo fisico, non un simulatore

**Soluzione 2: Disinstalla di nuovo l'app**
- Ripeti il Passo 4 (disinstalla l'app dal telefono)
- Poi riprova il Passo 10 (compila e installa)

**Soluzione 3: Riavvia tutto**
1. Chiudi Xcode completamente
2. Scollega e riconnetta il telefono
3. Riapri Xcode
4. Ripeti dal Passo 7

**Soluzione 4: Esegui di nuovo lo script**
1. Apri il Terminale
2. Esegui:
   ```bash
   cd /Users/andreastagnaro/Desktop/whatis_backend/WhatisExplorer_Lite
   ./fix_deploy_issue.sh
   ```
3. Poi riprova dal Passo 4

### Problema: Errori di signing in Xcode

**Soluzione:**
1. In Xcode, vai su **Xcode → Preferences → Accounts**
2. Aggiungi il tuo account Apple se non c'è
3. Torna a Signing & Capabilities
4. Seleziona il team corretto

### Problema: "Untrusted Developer" sul telefono

**Soluzione:**
1. Sul telefono, vai su **Impostazioni → Generale → Gestione VPN e dispositivi**
2. Trova il tuo profilo sviluppatore
3. Tocca e seleziona **"Fidati"**

---

## 📞 Riepilogo Rapido

1. ✅ Terminale → `cd /Users/andreastagnaro/Desktop/whatis_backend/WhatisExplorer_Lite`
2. ✅ Terminale → `./fix_deploy_issue.sh`
3. ✅ Telefono → Disinstalla app vecchia
4. ✅ Telefono → Collega via USB e sblocca
5. ✅ Xcode → Seleziona iPhone come destinazione
6. ✅ Xcode → Verifica Signing & Capabilities
7. ✅ Xcode → Clean Build Folder (⇧⌘K)
8. ✅ Xcode → Run (⌘R)
9. ✅ Telefono → Verifica che l'app sia installata

---

**💡 Ricorda**: Il passaggio più importante è **disinstallare l'app vecchia dal telefono** prima di fare il deploy!

