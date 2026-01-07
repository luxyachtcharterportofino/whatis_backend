# 🔧 Configurazione Backend

## ✅ URL Backend Configurato

L'URL del backend è: **`http://192.168.1.8:3000`**

## 📋 Verifica Connessione

### 1. Verifica che il Backend sia in Esecuzione

Sul Mac, verifica che il backend sia in esecuzione:

```bash
# Verifica se il backend risponde
curl http://192.168.1.8:3000/api/zones?format=json
```

Se vedi JSON, il backend è in esecuzione.

### 2. Verifica Connessione dal Telefono

1. **Sul telefono**, apri **Safari**
2. Vai a: `http://192.168.1.8:3000/api/zones?format=json`
3. Se vedi JSON, la connessione funziona
4. Se vedi errore, verifica:
   - Il telefono è sulla stessa rete WiFi del Mac?
   - Il backend è in esecuzione?
   - Il firewall non blocca le connessioni?

### 3. Configura URL nell'App

1. Apri l'app sul telefono
2. Vai su **Impostazioni** (ultima tab)
3. Nella sezione **"Impostazioni API"**, verifica che l'**URL Backend** sia: `http://192.168.1.8:3000`
4. Se è vuoto o diverso, inserisci: `http://192.168.1.8:3000`
5. Premi **Invio** o tocca fuori dal campo per salvare

### 4. Ricarica Zone

1. Torna alla tab **Mappa** o **Lista**
2. Se non vedi zone, vai su **Impostazioni**
3. Tocca **"Cambia Zona"**
4. Dovresti vedere la lista delle zone disponibili
5. Seleziona una zona e tocca **"Scarica"**

## ⚠️ Problemi Comuni

### Problema: "Server NON raggiungibile"

**Cause possibili**:
1. Backend non in esecuzione
2. IP cambiato (192.168.1.8 potrebbe non essere più corretto)
3. Porta diversa (3000 potrebbe non essere corretta)
4. Firewall blocca le connessioni

**Soluzione**:
1. Verifica che il backend sia in esecuzione sul Mac
2. Verifica l'IP del Mac:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
3. Se l'IP è diverso, aggiorna l'URL nell'app

### Problema: Zone non si caricano

**Cause possibili**:
1. URL non salvato correttamente
2. Problema di connessione di rete
3. Backend non raggiungibile

**Soluzione**:
1. Verifica URL in Impostazioni
2. Verifica connessione da Safari sul telefono
3. Riavvia l'app
4. Prova a cambiare zona (Impostazioni → Cambia Zona)

## 🔄 Modifiche Applicate

Ho aggiornato il codice per:
1. ✅ Usare `http://192.168.1.8:3000` come default locale
2. ✅ Permettere l'uso di URL locali (non solo cloud)
3. ✅ Salvare correttamente l'URL nelle Impostazioni

## 📱 Prossimi Passi

1. **Verifica URL nell'app**: Impostazioni → URL Backend
2. **Testa connessione**: Safari sul telefono → `http://192.168.1.8:3000/api/zones?format=json`
3. **Ricarica zone**: Impostazioni → Cambia Zona

---

**💡 Se l'IP del Mac è cambiato, aggiorna l'URL nell'app!**

