#!/bin/bash

# Script finale per risolvere problemi di deploy
# Verifica tutto e fornisce soluzione completa

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
INFO_PLIST="WhatisExplorer/Info.plist"

echo "🔧 Fix Finale Deploy iOS"
echo "========================"
echo ""

# 1. Incrementa build number
CURRENT_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "1")
NEW_BUILD=$((CURRENT_BUILD + 1))

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$INFO_PLIST"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PROJECT_DIR/project.pbxproj"

echo "✅ Build number incrementato: $CURRENT_BUILD → $NEW_BUILD"
echo ""

# 2. Verifica Bundle ID
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$INFO_PLIST" 2>/dev/null | sed 's/\$(PRODUCT_BUNDLE_IDENTIFIER)/com.andaly.WhatisExplorer/')
echo "📱 Bundle ID: $BUNDLE_ID"
echo ""

# 3. Pulisci tutto
echo "🧹 Pulizia completa..."
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-* 2>/dev/null || true
echo "✅ DerivedData pulito"

if command -v xcodebuild &> /dev/null; then
    xcodebuild clean -project "$PROJECT_DIR" -scheme WhatisExplorer 2>&1 | grep -v "warning:" || true
    echo "✅ Build pulito"
fi
echo ""

# 4. Verifica dispositivi
echo "📱 Verifica dispositivi..."
if command -v xcrun &> /dev/null; then
    xcrun xctrace list devices 2>/dev/null | grep "iPhone" || echo "⚠️  Nessun iPhone rilevato"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Preparazione completata!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 SOLUZIONE COMPLETA PER IL DEPLOY:"
echo ""
echo "⚠️  PROBLEMA PRINCIPALE: L'app vecchia è ancora installata!"
echo ""
echo "1. 📱 SUL TELEFONO (FONDAMENTALE!):"
echo "   - Sblocca il telefono"
echo "   - Cerca l'icona 'Whatis Explorer'"
echo "   - Tieni premuto l'icona → 'Rimuovi App' → 'Elimina App'"
echo "   - CONFERMA l'eliminazione"
echo "   - ⚠️  SENZA QUESTO PASSAGGIO L'APP NON SI INSTALLA!"
echo ""
echo "2. 🔌 VERIFICA CONNESSIONE:"
echo "   - Telefono collegato via USB"
echo "   - Telefono sbloccato"
echo "   - 'Fidati di questo computer' se richiesto"
echo ""
echo "3. 💻 IN XCODE:"
echo "   a) Seleziona 'iPhone di Andrea 11' come destinazione (NON simulatore)"
echo "   b) Vai a: Progetto → Target → Signing & Capabilities"
echo "   c) Verifica:"
echo "      • 'Automatically manage signing' ✅"
echo "      • Team: 'Andrea Stagnaro (Personal Team)' ✅"
echo "      • Bundle ID: com.andaly.WhatisExplorer ✅"
echo "   d) Se ci sono errori rossi in Signing:"
echo "      • Clicca su 'Team' e seleziona di nuovo"
echo "      • Attendi che Xcode generi il profilo"
echo ""
echo "4. 🧹 PULIZIA:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo "   - Attendi che finisca"
echo ""
echo "5. ▶️  DEPLOY:"
echo "   - Product → Run (⌘R)"
echo "   - Se vedi 'Build Succeeded' ma l'app non appare:"
echo "     → TORNA AL PASSO 1 (disinstalla l'app vecchia!)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 SE ANCORA NON FUNZIONA:"
echo ""
echo "   Opzione A - Reset completo:"
echo "   1. Disinstalla app dal telefono"
echo "   2. In Xcode: Window → Devices and Simulators"
echo "   3. Seleziona il tuo iPhone"
echo "   4. Clicca destro su 'Whatis Explorer' (se presente) → 'Uninstall'"
echo "   5. Chiudi Xcode"
echo "   6. Riapri Xcode e riprova"
echo ""
echo "   Opzione B - Verifica provisioning:"
echo "   1. In Xcode: Preferences → Accounts"
echo "   2. Seleziona il tuo account"
echo "   3. Clicca 'Download Manual Profiles'"
echo "   4. Torna a Signing & Capabilities"
echo "   5. Seleziona di nuovo il Team"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

