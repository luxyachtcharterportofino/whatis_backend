#!/bin/bash

# Script per pulire il build e preparare il deploy

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
SCHEME="WhatisExplorer"

echo "🧹 Pulizia Build e Preparazione Deploy"
echo "======================================="
echo ""

# 1. Pulisci DerivedData
echo "1️⃣  Pulizia DerivedData..."
DERIVED_DATA_PATH="$HOME/Library/Developer/Xcode/DerivedData"
if [ -d "$DERIVED_DATA_PATH" ]; then
    # Trova e rimuovi cartelle correlate al progetto
    find "$DERIVED_DATA_PATH" -name "WhatisExplorer-*" -type d -exec rm -rf {} + 2>/dev/null || true
    echo "✅ DerivedData pulito"
else
    echo "ℹ️  DerivedData non trovato"
fi

# 2. Pulisci build con xcodebuild
echo ""
echo "2️⃣  Pulizia build Xcode..."
if command -v xcodebuild &> /dev/null; then
    xcodebuild clean -project "$PROJECT_DIR" -scheme "$SCHEME" 2>&1 | grep -v "warning:" || true
    echo "✅ Build pulito"
else
    echo "⚠️  xcodebuild non trovato, esegui manualmente: Product → Clean Build Folder in Xcode"
fi

# 3. Verifica Info.plist
echo ""
echo "3️⃣  Verifica configurazione..."
INFO_PLIST="WhatisExplorer/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    BUILD_NUMBER=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "N/A")
    BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$INFO_PLIST" 2>/dev/null || echo "N/A")
    APP_NAME=$(/usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" "$INFO_PLIST" 2>/dev/null || echo "N/A")
    
    echo "   📱 Nome App: $APP_NAME"
    echo "   🆔 Bundle ID: $BUNDLE_ID"
    echo "   🔢 Build Number: $BUILD_NUMBER"
fi

echo ""
echo "✅ Pulizia completata!"
echo ""
echo "📋 ORA:"
echo "   1. Apri Xcode"
echo "   2. Assicurati che il telefono sia connesso e selezionato"
echo "   3. DISINSTALLA l'app vecchia dal telefono (tieni premuto l'icona → Elimina App)"
echo "   4. Premi ⌘R (o Play) per compilare e installare"
echo ""

