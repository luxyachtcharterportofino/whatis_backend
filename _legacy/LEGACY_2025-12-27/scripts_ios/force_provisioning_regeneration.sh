#!/bin/bash

# Forza rigenerazione provisioning profile e risolve Run grigio

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
SCHEME="WhatisExplorer"
DEVICE_ID="00008030-001A24E41AD0802E"
BUNDLE_ID="com.andaly.WhatisExplorer"

echo "🔧 Forza Rigenerazione Profilo e Fix Run"
echo "========================================="
echo ""

# 1. Verifica dispositivo
echo "1️⃣  Verifica dispositivo..."
DEVICE_INFO=$(xcrun xctrace list devices 2>/dev/null | grep "$DEVICE_ID" || echo "")
if [ -z "$DEVICE_INFO" ]; then
    echo "   ❌ Dispositivo non trovato!"
    exit 1
fi
echo "   ✅ Dispositivo trovato: $DEVICE_INFO"
echo ""

# 2. Rimuovi provisioning profiles esistenti
echo "2️⃣  Rimozione provisioning profiles esistenti..."
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/* 2>/dev/null || true
echo "   ✅ Profili rimossi"
echo ""

# 3. Pulisci DerivedData
echo "3️⃣  Pulizia DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-* 2>/dev/null || true
echo "   ✅ DerivedData pulito"
echo ""

# 4. Pulisci build
echo "4️⃣  Pulizia build..."
xcodebuild clean -project "$PROJECT_DIR" -scheme "$SCHEME" 2>&1 | grep -v "warning:" || true
echo "   ✅ Build pulito"
echo ""

# 5. Leggi Team ID
TEAM_ID=$(grep -A 5 "DEVELOPMENT_TEAM" "$PROJECT_DIR/project.pbxproj" | grep -v "^//" | head -1 | sed -n 's/.*DEVELOPMENT_TEAM = \([^;]*\);.*/\1/p' | tr -d ' ' || echo "")

if [ -z "$TEAM_ID" ]; then
    echo "   ❌ Team ID non trovato!"
    exit 1
fi

echo "5️⃣  Team ID: $TEAM_ID"
echo ""

# 6. Forza generazione profilo con xcodebuild
echo "6️⃣  Forza generazione provisioning profile..."
echo "   ⏳ Questo può richiedere alcuni minuti..."
echo ""

# Prova a generare il profilo facendo un build
xcodebuild \
    -project "$PROJECT_DIR" \
    -scheme "$SCHEME" \
    -destination "id=$DEVICE_ID" \
    -configuration Debug \
    CODE_SIGN_IDENTITY="Apple Development" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CODE_SIGN_STYLE="Automatic" \
    build 2>&1 | tee /tmp/xcode_provisioning.log | grep -E "error|warning|Provisioning|Profile|BUILD|SUCCEEDED|FAILED" | tail -20

BUILD_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ Build riuscito!"
    echo ""
    echo "📋 Verifica provisioning profile generato:"
    ls -la ~/Library/MobileDevice/Provisioning\ Profiles/ 2>/dev/null | grep -i "$BUNDLE_ID" || echo "   ⚠️  Profilo non trovato nella cartella standard"
    echo ""
else
    echo "❌ Build fallito!"
    echo ""
    echo "🔍 Cerca errori nei log:"
    grep -i "error\|provisioning\|signing\|certificate" /tmp/xcode_provisioning.log | head -10
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI IN XCODE:"
echo ""
echo "1. 🔄 CHIUDI E RIAPRI XCODE:"
echo "   - Xcode → Quit Xcode (⌘Q)"
echo "   - Riapri il progetto"
echo ""
echo "2. ✅ VERIFICA SIGNING:"
echo "   - Progetto → Target → Signing & Capabilities"
echo "   - 'Automatically manage signing' deve essere selezionato"
echo "   - Team deve essere selezionato"
echo "   - ATTENDI 10-30 secondi (vedrai un'icona di caricamento)"
echo "   - Verifica che 'Provisioning Profile' mostri un profilo valido"
echo ""
echo "3. 🔍 SE IL RUN È ANCORA GRIGIO:"
echo "   - Window → Devices and Simulators (⇧⌘2)"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Verifica che appaia come 'Connected'"
echo "   - Se vedi errori, clicca 'Use for Development'"
echo ""
echo "4. ▶️  PROVA RUN:"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Il Run dovrebbe essere cliccabile"
echo "   - Premi Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

