# 🔍 Diagnostica Problemi App

## ✅ Problemi Risolti

1. ✅ **Run grigio** - Risolto selezionando "Whatis Explorer" in Edit Scheme
2. ✅ **App installata** - L'app si installa correttamente sul telefono

## ❌ Problemi Attuali

### 1. Icona "Strana"
**Problema**: L'icona dell'app appare strana sul telefono.

**Causa**: Mancano alcune icone necessarie per iOS.

**Soluzione**: Ho rigenerato le icone mancanti. Dopo il prossimo build, l'icona dovrebbe essere corretta.

### 2. Zone Non Si Caricano
**Problema**: L'app non carica le zone dal backend.

**Possibili cause**:
1. URL del backend non configurato correttamente
2. Problema di connessione di rete
3. Backend non raggiungibile

**Verifica**:
1. Vai su **Impostazioni** nell'app
2. Controlla l'**URL del backend**
3. Verifica che sia corretto (es: `https://whatis-backend.onrender.com` o il tuo IP locale)

**Soluzione**:
- Se l'URL è vuoto o errato, inserisci l'URL corretto
- Se usi un IP locale (es: `192.168.1.4:3000`), assicurati che:
  - Il telefono sia sulla stessa rete WiFi del Mac
  - Il backend sia in esecuzione
  - Il firewall non blocchi le connessioni

### 3. Pagina Iniziale con Guide Autorizzate
**Problema**: Non appare la pagina iniziale con le guide autorizzate.

**Nota**: Non ho trovato una pagina iniziale con "guide autorizzate" nel codice attuale. Potrebbe essere stata:
- Rimossa durante la migrazione da Lite
- Non ancora implementata
- Parte di una versione precedente

**Cosa fare**:
- Dimmi cosa dovrebbe mostrare questa pagina iniziale
- Posso ricrearla se mi descrivi il contenuto

## 🔧 Verifica Rapida

### Passo 1: Verifica URL Backend
1. Apri l'app
2. Vai su **Impostazioni** (ultima tab)
3. Controlla l'**URL del backend**
4. Se è vuoto o errato, inserisci l'URL corretto

### Passo 2: Verifica Connessione
1. Sul telefono, apri Safari
2. Vai all'URL del backend (es: `https://whatis-backend.onrender.com/api/zones?format=json`)
3. Se vedi JSON, il backend è raggiungibile
4. Se vedi errore, c'è un problema di connessione

### Passo 3: Rebuild App
1. In Xcode: **Product → Clean Build Folder** (⇧⌘K)
2. **Product → Build** (⌘B)
3. **Product → Run** (⌘R)
4. Verifica che l'icona sia corretta

## 📋 Checklist

- [ ] Icone rigenerate (dopo rebuild)
- [ ] URL backend configurato in Impostazioni
- [ ] Backend raggiungibile dal telefono
- [ ] Zone si caricano correttamente
- [ ] Pagina iniziale (se necessaria) implementata

---

**💡 Per la pagina iniziale con guide autorizzate, dimmi cosa dovrebbe contenere e la ricreo!**

