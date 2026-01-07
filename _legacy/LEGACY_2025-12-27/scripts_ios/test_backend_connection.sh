#!/bin/bash

# Test connessione backend

BACKEND_URL="http://192.168.1.8:3000"

echo "🔍 Test Connessione Backend"
echo "==========================="
echo ""
echo "URL: $BACKEND_URL"
echo ""

# Test 1: Verifica che il server risponda
echo "1️⃣  Test connessione base..."
if curl -s --connect-timeout 5 "$BACKEND_URL" > /dev/null 2>&1; then
    echo "   ✅ Server raggiungibile"
else
    echo "   ❌ Server NON raggiungibile"
    echo "   💡 Verifica che:"
    echo "      - Il backend sia in esecuzione"
    echo "      - L'IP sia corretto (192.168.1.8)"
    echo "      - La porta sia corretta (3000)"
    exit 1
fi
echo ""

# Test 2: Verifica endpoint zone
echo "2️⃣  Test endpoint zone..."
ZONES_RESPONSE=$(curl -s --connect-timeout 5 "$BACKEND_URL/api/zones?format=json" 2>&1)

if echo "$ZONES_RESPONSE" | grep -q "\[" || echo "$ZONES_RESPONSE" | grep -q "\{"; then
    echo "   ✅ Endpoint zone funzionante"
    echo "   📋 Risposta (prime 200 caratteri):"
    echo "$ZONES_RESPONSE" | head -c 200
    echo "..."
else
    echo "   ❌ Endpoint zone NON funzionante"
    echo "   📋 Risposta:"
    echo "$ZONES_RESPONSE"
    exit 1
fi
echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend raggiungibile!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI:"
echo ""
echo "1. 🔧 CONFIGURA URL NELL'APP:"
echo "   - Apri l'app sul telefono"
echo "   - Vai su Impostazioni (ultima tab)"
echo "   - Inserisci l'URL: $BACKEND_URL"
echo "   - Salva"
echo ""
echo "2. 📱 VERIFICA SUL TELEFONO:"
echo "   - Assicurati che il telefono sia sulla stessa rete WiFi"
echo "   - Apri Safari sul telefono"
echo "   - Vai a: $BACKEND_URL/api/zones?format=json"
echo "   - Se vedi JSON, la connessione funziona"
echo ""
echo "3. 🔄 RICARICA ZONE NELL'APP:"
echo "   - Torna all'app"
echo "   - Vai alla tab Mappa o Lista"
echo "   - Le zone dovrebbero caricarsi"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

