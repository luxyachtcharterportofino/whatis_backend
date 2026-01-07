#!/bin/bash

# Verifica e risolve problemi di trust del dispositivo

set -e

DEVICE_ID="00008030-001A24E41AD0802E"

echo "🔍 Verifica Trust Dispositivo"
echo "============================="
echo ""

# 1. Verifica dispositivo
echo "1️⃣  Verifica dispositivo..."
DEVICE_INFO=$(xcrun xctrace list devices 2>/dev/null | grep "$DEVICE_ID" || echo "")
if [ -z "$DEVICE_INFO" ]; then
    echo "   ❌ Dispositivo non trovato!"
    echo "   💡 Verifica:"
    echo "      - Telefono collegato via USB"
    echo "      - Telefono sbloccato"
    echo "      - 'Fidati di questo computer' accettato"
    exit 1
fi
echo "   ✅ Dispositivo trovato: $DEVICE_INFO"
echo ""

# 2. Verifica trust
echo "2️⃣  Verifica trust dispositivo..."
if xcrun devicectl device list devices 2>/dev/null | grep -q "$DEVICE_ID"; then
    echo "   ✅ Dispositivo riconosciuto da devicectl"
else
    echo "   ⚠️  Dispositivo non riconosciuto da devicectl"
    echo "   💡 Potrebbe essere necessario:"
    echo "      - Window → Devices and Simulators in Xcode"
    echo "      - Seleziona 'iPhone di Andrea 11'"
    echo "      - Clicca 'Use for Development' se presente"
fi
echo ""

# 3. Verifica provisioning profile
echo "3️⃣  Verifica provisioning profile..."
PROFILE_PATH=$(ls ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*.mobileprovision 2>/dev/null | head -1 || echo "")

if [ -n "$PROFILE_PATH" ]; then
    echo "   ✅ Profilo trovato: $PROFILE_PATH"
    # Verifica contenuto
    if security cms -D -i "$PROFILE_PATH" 2>/dev/null | grep -q "com.andaly.WhatisExplorer"; then
        echo "   ✅ Profilo contiene bundle ID corretto"
    fi
else
    echo "   ⚠️  Nessun profilo trovato nella cartella standard"
    echo "   💡 Xcode potrebbe usare profili gestiti automaticamente"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 DIAGNOSI:"
echo ""
echo "Se il Run è ancora grigio, prova questi passi IN ORDINE:"
echo ""
echo "1. 🔄 WINDOW → DEVICES AND SIMULATORS:"
echo "   - Window → Devices and Simulators (⇧⌘2)"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Se vedi un pulsante 'Use for Development', CLICCALO"
echo "   - Attendi che finisca"
echo ""
echo "2. ✅ VERIFICA SIGNING IN XCODE:"
echo "   - Progetto → Target → Signing & Capabilities"
echo "   - 'Automatically manage signing' deve essere selezionato"
echo "   - Team deve essere selezionato"
echo "   - Se 'Provisioning Profile' dice 'None' o ha errori:"
echo "     → Deseleziona e riseleziona 'Automatically manage signing'"
echo "     → ATTENDI 10-30 secondi"
echo ""
echo "3. 🔄 FORZA RICARICA DISPOSITIVO:"
echo "   - Scollega il telefono"
echo "   - Attendi 5 secondi"
echo "   - Riconnettici il telefono"
echo "   - Sblocca il telefono"
echo "   - In Xcode: Window → Devices and Simulators"
echo "   - Verifica che appaia come 'Connected'"
echo ""
echo "4. 🧹 CLEAN E REBUILD:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo "   - Attendi che finisca"
echo "   - Product → Build (⌘B)"
echo "   - Verifica che compili senza errori"
echo ""
echo "5. ▶️  PROVA RUN:"
echo "   - Seleziona 'iPhone di Andrea 11' (NON un simulatore)"
echo "   - Il Run dovrebbe essere cliccabile"
echo "   - Premi Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

