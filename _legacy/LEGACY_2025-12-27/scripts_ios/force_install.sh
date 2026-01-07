#!/bin/bash

# Forza installazione dell'app sul dispositivo

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
SCHEME="WhatisExplorer"
DEVICE_ID="00008030-001A24E41AD0802E"  # iPhone di Andrea 11

echo "🔧 Forza Installazione App"
echo "========================="
echo ""

# 1. Verifica dispositivo
echo "1️⃣  Verifica dispositivo..."
DEVICE_INFO=$(xcrun xctrace list devices 2>/dev/null | grep "$DEVICE_ID" || echo "")
if [ -z "$DEVICE_INFO" ]; then
    echo "   ❌ Dispositivo non trovato!"
    echo "   💡 Verifica che il telefono sia:"
    echo "      - Collegato via USB"
    echo "      - Sbloccato"
    echo "      - Fidato (Impostazioni → Generale → Gestione VPN e dispositivi)"
    exit 1
fi
echo "   ✅ Dispositivo trovato: $DEVICE_INFO"
echo ""

# 2. Disinstalla app esistente (se presente)
echo "2️⃣  Verifica app esistente..."
BUNDLE_ID="com.andaly.WhatisExplorer"
if xcrun devicectl device install app --device "$DEVICE_ID" --list 2>/dev/null | grep -q "$BUNDLE_ID"; then
    echo "   ⚠️  App già installata, disinstallazione..."
    xcrun devicectl device uninstall app --device "$DEVICE_ID" --bundle-id "$BUNDLE_ID" 2>/dev/null || true
    echo "   ✅ App disinstallata"
else
    echo "   ✅ App non presente sul dispositivo"
fi
echo ""

# 3. Pulisci build
echo "3️⃣  Pulizia build..."
xcodebuild clean -project "$PROJECT_DIR" -scheme "$SCHEME" -destination "id=$DEVICE_ID" 2>&1 | grep -v "warning:" || true
echo "   ✅ Build pulito"
echo ""

# 4. Build e install
echo "4️⃣  Build e installazione..."
echo "   ⏳ Questo può richiedere alcuni minuti..."
echo ""

# Leggi il Team ID dal progetto
TEAM_ID=$(grep -A 5 "DEVELOPMENT_TEAM" "$PROJECT_DIR/project.pbxproj" | grep -v "^//" | head -1 | sed -n 's/.*DEVELOPMENT_TEAM = \([^;]*\);.*/\1/p' | tr -d ' ' || echo "")

if [ -z "$TEAM_ID" ]; then
    echo "   ❌ Team ID non trovato nel progetto!"
    echo "   💡 Configura il team in Xcode:"
    echo "      Progetto → Target → Signing & Capabilities"
    echo "      → Seleziona 'Automatically manage signing'"
    echo "      → Seleziona il Team"
    exit 1
fi

echo "   ✅ Team ID trovato: $TEAM_ID"
echo ""

xcodebuild \
    -project "$PROJECT_DIR" \
    -scheme "$SCHEME" \
    -destination "id=$DEVICE_ID" \
    -configuration Debug \
    CODE_SIGN_IDENTITY="Apple Development" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    build \
    install 2>&1 | tee /tmp/xcode_install.log

BUILD_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ Build completato!"
    echo ""
    echo "📋 Verifica installazione:"
    echo "   1. Controlla il telefono - l'app dovrebbe essere installata"
    echo "   2. Se non vedi l'app, cerca 'Whatis Explorer' nella ricerca"
    echo "   3. Se l'app è presente ma non si apre:"
    echo "      → Impostazioni → Generale → Gestione VPN e dispositivi"
    echo "      → Fidati del profilo sviluppatore"
    echo ""
else
    echo "❌ Errore durante build/installazione"
    echo ""
    echo "📋 Log completo salvato in: /tmp/xcode_install.log"
    echo ""
    echo "🔍 Cerca errori comuni:"
    grep -i "error\|failed\|signing\|provisioning\|certificate" /tmp/xcode_install.log | head -20 || echo "   Nessun errore evidente nei log"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

