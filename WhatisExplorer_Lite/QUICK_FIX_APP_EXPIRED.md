# ⚡ Fix Rapido: App "Non Disponibile"

## 🚨 Problema

L'app Whatis Explorer sul tuo iPhone 11 dice **"Non disponibile"** o **"Untrusted Developer"**.

## ✅ Soluzione Rapida (5 minuti)

### Passo 1: Collega iPhone al Mac
- Usa cavo USB
- Sblocca iPhone e autorizza il computer

### Passo 2: Apri Xcode
```bash
cd ~/Desktop/whatis_backend/WhatisExplorer_Lite
open WhatisExplorerLite.xcodeproj
```

### Passo 3: Rinnova Certificati
1. **Xcode → Settings** (⌘,)
2. Tab **Accounts**
3. Seleziona il tuo Apple ID
4. Clicca **"Download Manual Profiles"**

### Passo 4: Reinstalla App
1. Seleziona il tuo **iPhone** come destinazione
2. Vai su **Signing & Capabilities**
3. Seleziona il tuo **Team**
4. **Build & Run** (⌘R)

### Passo 5: Autorizza Developer (su iPhone)
1. **Impostazioni → Generale → Gestione profili**
2. Tocca il profilo **"Apple Development"**
3. Tocca **"Fidati"**

## 🔄 Per Evitare il Problema in Futuro

### Opzione A: TestFlight (Raccomandato)
- Durata: **90 giorni** (rinnovabile)
- Aggiornamenti automatici
- Non richiede Xcode

### Opzione B: Profilo Ad Hoc
- Durata: **1 anno**
- Vedi [IOS_APP_STABILITY.md](IOS_APP_STABILITY.md) per dettagli

### Opzione C: Apple Developer Program
- Costo: $99/anno
- Profili durano **1 anno**
- Più stabile per sviluppo

## 📱 Verifica Scadenza

**iPhone → Impostazioni → Generale → Gestione profili**

Vedi la data di scadenza del profilo.

---

**Tempo richiesto**: 5 minuti  
**Frequenza**: Ogni 7 giorni (Apple ID gratuito) o 1 anno (Developer Program)

