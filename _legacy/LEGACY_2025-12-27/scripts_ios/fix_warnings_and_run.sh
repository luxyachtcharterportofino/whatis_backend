#!/bin/bash

# Risolve i warning e forza il Run

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
SCHEME="WhatisExplorer"

echo "🔧 Fix Warning e Abilita Run"
echo "============================"
echo ""

# 1. Verifica dialog Xcode
echo "⚠️  IMPORTANTE: Dialog Xcode"
echo ""
echo "Vedo che c'è un dialog che chiede di aggiornare le impostazioni raccomandate."
echo "Questo potrebbe impedire il Run!"
echo ""
echo "1. Nel dialog che vedi in Xcode:"
echo "   → Clicca 'Perform Changes' (non 'Cancel')"
echo "   → Questo aggiornerà le impostazioni del progetto"
echo ""
read -p "Hai cliccato 'Perform Changes' nel dialog? (s/N): " DIALOG_DONE
if [[ ! "$DIALOG_DONE" =~ ^[sS]$ ]]; then
    echo ""
    echo "   ⚠️  Devi accettare le modifiche nel dialog!"
    echo "   → Clicca 'Perform Changes' nel dialog Xcode"
    echo "   → Poi riprova questo script"
    exit 1
fi
echo ""

# 2. Pulisci build
echo "2️⃣  Pulizia build..."
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-* 2>/dev/null || true
echo "   ✅ DerivedData pulito"

if command -v xcodebuild &> /dev/null; then
    xcodebuild clean -project "$PROJECT_DIR" -scheme "$SCHEME" 2>&1 | grep -v "warning:" || true
    echo "   ✅ Build pulito"
fi
echo ""

# 3. Verifica signing
echo "3️⃣  Verifica signing..."
TEAM_ID=$(grep -A 5 "DEVELOPMENT_TEAM" "$PROJECT_DIR/project.pbxproj" | grep -v "^//" | head -1 | sed -n 's/.*DEVELOPMENT_TEAM = \([^;]*\);.*/\1/p' | tr -d ' ' || echo "")

if [ -z "$TEAM_ID" ]; then
    echo "   ❌ Team ID non trovato!"
    echo "   💡 Configura il team in Xcode:"
    echo "      Progetto → Target → Signing & Capabilities"
    exit 1
fi

echo "   ✅ Team ID: $TEAM_ID"
echo ""

# 4. Build di test
echo "4️⃣  Build di test..."
xcodebuild \
    -project "$PROJECT_DIR" \
    -scheme "$SCHEME" \
    -destination "generic/platform=iOS" \
    -configuration Debug \
    CODE_SIGN_IDENTITY="Apple Development" \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    build 2>&1 | tee /tmp/xcode_build_test.log | grep -E "error|warning|BUILD|SUCCEEDED|FAILED" | tail -10

BUILD_EXIT_CODE=${PIPESTATUS[0]}

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "   ✅ Build riuscito!"
else
    echo "   ❌ Build fallito!"
    echo "   📋 Controlla i log in /tmp/xcode_build_test.log"
    exit 1
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Preparazione completata!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI IN XCODE:"
echo ""
echo "1. 🔄 RICARICA IL PROGETTO:"
echo "   - Chiudi e riapri Xcode (⌘Q, poi riapri)"
echo ""
echo "2. ✅ VERIFICA:"
echo "   - Il pulsante Run dovrebbe essere cliccabile"
echo "   - Se ancora grigio:"
echo "     → Progetto → Target → Signing & Capabilities"
echo "     → Verifica che 'Automatically manage signing' sia selezionato"
echo "     → Verifica che il Team sia selezionato"
echo "     → ATTENDI 10-30 secondi"
echo ""
echo "3. ▶️  PROVA RUN:"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Premi Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

