#!/bin/bash

# Script completo per risolvere problemi di deploy su dispositivo iOS
# Diagnostica e risolve i problemi più comuni

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
INFO_PLIST="WhatisExplorer/Info.plist"
SCHEME="WhatisExplorer"

echo "🔧 Diagnostica e Fix Deploy iOS"
echo "================================"
echo ""

# 1. Verifica configurazione
echo "1️⃣  Verifica configurazione progetto..."
if [ ! -f "$INFO_PLIST" ]; then
    echo "❌ Info.plist non trovato!"
    exit 1
fi

BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$INFO_PLIST" 2>/dev/null | sed 's/\$(PRODUCT_BUNDLE_IDENTIFIER)/com.andaly.WhatisExplorer/')
BUILD_NUMBER=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "1")
VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$INFO_PLIST" 2>/dev/null || echo "1.0")

echo "   📱 Bundle ID: $BUNDLE_ID"
echo "   🔢 Build: $BUILD_NUMBER"
echo "   📦 Versione: $VERSION"
echo ""

# 2. Incrementa build number
echo "2️⃣  Incremento build number..."
CURRENT_BUILD=$BUILD_NUMBER
NEW_BUILD=$((CURRENT_BUILD + 1))

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$INFO_PLIST"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PROJECT_DIR/project.pbxproj"

echo "   ✅ Build number incrementato: $CURRENT_BUILD → $NEW_BUILD"
echo ""

# 3. Pulisci DerivedData
echo "3️⃣  Pulizia DerivedData..."
DERIVED_DATA_PATH="$HOME/Library/Developer/Xcode/DerivedData"
if [ -d "$DERIVED_DATA_PATH" ]; then
    find "$DERIVED_DATA_PATH" -name "WhatisExplorer-*" -type d -exec rm -rf {} + 2>/dev/null || true
    echo "   ✅ DerivedData pulito"
else
    echo "   ⚪ DerivedData non trovato"
fi
echo ""

# 4. Pulisci build
echo "4️⃣  Pulizia build..."
if command -v xcodebuild &> /dev/null; then
    xcodebuild clean -project "$PROJECT_DIR" -scheme "$SCHEME" 2>&1 | grep -v "warning:" || true
    echo "   ✅ Build pulito"
else
    echo "   ⚠️  xcodebuild non trovato, esegui manualmente: Product → Clean Build Folder"
fi
echo ""

# 5. Verifica dispositivi connessi
echo "5️⃣  Verifica dispositivi iOS..."
if command -v xcrun &> /dev/null; then
    DEVICES=$(xcrun simctl list devices | grep -c "Booted" || echo "0")
    if [ "$DEVICES" -gt 0 ]; then
        echo "   ⚠️  Simulatori iOS attivi trovati"
        echo "   💡 Assicurati di selezionare il dispositivo fisico in Xcode, non il simulatore"
    fi
fi

if command -v idevice_id &> /dev/null; then
    PHYSICAL_DEVICES=$(idevice_id -l 2>/dev/null | wc -l || echo "0")
    if [ "$PHYSICAL_DEVICES" -gt 0 ]; then
        echo "   ✅ Dispositivo iOS fisico connesso"
    else
        echo "   ⚠️  Nessun dispositivo iOS fisico rilevato"
        echo "   💡 Connetti il telefono via USB e sbloccalo"
    fi
else
    echo "   ⚪ libimobiledevice non installato (opzionale)"
fi
echo ""

# 6. Istruzioni finali
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Preparazione completata!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI (IMPORTANTE!):"
echo ""
echo "1. 📱 DISINSTALLA APP VECCHIA DAL TELEFONO:"
echo "   ⚠️  QUESTO È IL PASSAGGIO PIÙ IMPORTANTE!"
echo "   - Sul telefono: tieni premuto l'icona 'Whatis Explorer'"
echo "   - Tocca 'Rimuovi App' → 'Elimina App'"
echo "   - Questo forza Xcode a reinstallare invece di aggiornare"
echo ""
echo "2. 🔌 VERIFICA CONNESSIONE:"
echo "   - Telefono connesso via USB"
echo "   - Telefono sbloccato"
echo "   - Se richiesto: 'Fidati di questo computer' → Sì"
echo ""
echo "3. 📱 IN XCODE:"
echo "   - Seleziona il dispositivo fisico dal menu in alto (non simulatore)"
echo "   - Vai a: Progetto → Target → Signing & Capabilities"
echo "   - Verifica:"
echo "     • 'Automatically manage signing' ✅"
echo "     • Team selezionato correttamente"
echo "     • Bundle ID: com.andaly.WhatisExplorer"
echo ""
echo "4. 🧹 PULIZIA IN XCODE:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo ""
echo "5. ▶️  DEPLOY:"
echo "   - Product → Run (⌘R)"
echo "   - Oppure clicca Play"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 SUGGERIMENTO:"
echo "   Se l'app non si installa, il problema è quasi sempre che"
echo "   l'app vecchia è ancora installata sul telefono."
echo "   DISINSTALLA SEMPRE l'app vecchia prima di fare il deploy!"
echo ""

