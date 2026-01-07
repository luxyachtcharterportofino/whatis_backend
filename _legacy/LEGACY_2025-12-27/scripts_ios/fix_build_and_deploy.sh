#!/bin/bash

# Script per risolvere problemi di deploy su dispositivo iOS
# Incrementa il build number e fornisce istruzioni per il deploy

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
INFO_PLIST="WhatisExplorer/Info.plist"
PROJECT_FILE="$PROJECT_DIR/project.pbxproj"

echo "🔧 Fix Build Number e Deploy iOS"
echo "=================================="
echo ""

# Leggi il build number attuale da Info.plist
CURRENT_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "1")
echo "📱 Build number attuale: $CURRENT_BUILD"

# Incrementa il build number
NEW_BUILD=$((CURRENT_BUILD + 1))
echo "📈 Nuovo build number: $NEW_BUILD"

# Aggiorna Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$INFO_PLIST"
echo "✅ Info.plist aggiornato"

# Aggiorna project.pbxproj (CURRENT_PROJECT_VERSION)
if [ -f "$PROJECT_FILE" ]; then
    # Usa sed per aggiornare CURRENT_PROJECT_VERSION
    sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PROJECT_FILE"
    echo "✅ project.pbxproj aggiornato"
fi

echo ""
echo "✅ Build number incrementato a $NEW_BUILD"
echo ""
echo "📋 PROSSIMI PASSI PER IL DEPLOY:"
echo ""
echo "1. 🧹 PULIZIA BUILD:"
echo "   - In Xcode: Product → Clean Build Folder (⇧⌘K)"
echo "   - Oppure esegui: xcodebuild clean -project $PROJECT_DIR"
echo ""
echo "2. 📱 DISINSTALLA APP VECCHIA (IMPORTANTE!):"
echo "   - Sul telefono: tieni premuto l'icona dell'app"
echo "   - Tocca 'Rimuovi App' → 'Elimina App'"
echo "   - Questo forza Xcode a reinstallare l'app"
echo ""
echo "3. 🔌 VERIFICA CONNESSIONE:"
echo "   - Assicurati che il telefono sia connesso via USB"
echo "   - Sblocca il telefono e accetta 'Fidati di questo computer' se richiesto"
echo "   - In Xcode, seleziona il dispositivo dal menu in alto"
echo ""
echo "4. 🔐 VERIFICA SIGNING:"
echo "   - In Xcode: seleziona il progetto → Target → Signing & Capabilities"
echo "   - Assicurati che 'Automatically manage signing' sia selezionato"
echo "   - Verifica che il Team sia selezionato correttamente"
echo ""
echo "5. ▶️  DEPLOY:"
echo "   - In Xcode: Product → Run (⌘R)"
echo "   - Oppure clicca il pulsante Play"
echo ""
echo "6. ⚠️  SE ANCORA NON FUNZIONA:"
echo "   - Chiudi Xcode completamente"
echo " - Rimuovi la cartella ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-*"
echo "   - Riapri Xcode e riprova"
echo ""
echo "💡 SUGGERIMENTO: Se l'app non si aggiorna, disinstallare l'app vecchia è spesso la soluzione!"
echo ""

