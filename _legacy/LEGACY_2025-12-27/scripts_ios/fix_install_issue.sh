#!/bin/bash

# Script per diagnosticare e risolvere problemi di installazione su dispositivo iOS

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
INFO_PLIST="WhatisExplorer/Info.plist"

echo "🔍 Diagnostica Problema Installazione"
echo "====================================="
echo ""

# 1. Incrementa build number
CURRENT_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "1")
NEW_BUILD=$((CURRENT_BUILD + 1))

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$INFO_PLIST"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PROJECT_DIR/project.pbxproj"

echo "✅ Build number incrementato: $CURRENT_BUILD → $NEW_BUILD"
echo ""

# 2. Verifica dispositivo
echo "📱 Verifica dispositivo..."
if command -v xcrun &> /dev/null; then
    DEVICE=$(xcrun xctrace list devices 2>/dev/null | grep "iPhone di Andrea" || echo "")
    if [ -n "$DEVICE" ]; then
        echo "   ✅ Dispositivo trovato:"
        echo "   $DEVICE"
    else
        echo "   ❌ Dispositivo NON trovato!"
        echo "   💡 Verifica:"
        echo "      - Telefono collegato via USB"
        echo "      - Telefono sbloccato"
        echo "      - 'Fidati di questo computer' accettato"
    fi
fi
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

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Preparazione completata!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 SOLUZIONE PASSO PASSO:"
echo ""
echo "⚠️  PROBLEMA: Xcode compila ma non installa"
echo ""
echo "1. 📱 VERIFICA DISPOSITIVO IN XCODE:"
echo "   - Window → Devices and Simulators (⇧⌘2)"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Verifica che appaia come 'Connected'"
echo "   - Se vedi 'Untrusted Developer':"
echo "     → Sul telefono: Impostazioni → Generale → Gestione VPN e dispositivi"
echo "     → Trova il profilo → Tocca 'Fidati'"
echo ""
echo "2. 🔐 FORZA RIGENERAZIONE PROFILO:"
echo "   - Progetto → Target → Signing & Capabilities"
echo "   - DESELEZIONA 'Automatically manage signing'"
echo "   - Attendi 2 secondi"
echo "   - RISELEZIONA 'Automatically manage signing'"
echo "   - Seleziona di nuovo il Team"
echo "   - ATTENDI 10-30 secondi che Xcode generi il profilo"
echo "   - Verifica che non ci siano errori rossi"
echo ""
echo "3. 👀 GUARDA L'AREA DI DEBUG DURANTE IL DEPLOY:"
echo "   - In Xcode: View → Debug Area → Show Debug Area (⇧⌘Y)"
echo "   - Premi Run (⌘R)"
echo "   - GUARDA I MESSAGGI in basso durante il deploy"
echo "   - Cerca messaggi come:"
echo "     • 'Installing...' → Se non appare, Xcode non sta installando"
echo "     • 'Failed to install...' → Indica il problema specifico"
echo "     • 'Device not trusted' → Problema fiducia dispositivo"
echo "     • 'No provisioning profile' → Problema profilo"
echo ""
echo "4. 🔄 PROVA INSTALLAZIONE MANUALE:"
echo "   - In Xcode: Window → Devices and Simulators"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Nella sezione 'Installed Apps', verifica se 'Whatis Explorer' è presente"
echo "   - Se è presente ma non funziona, clicca destro → 'Uninstall'"
echo "   - Poi riprova Product → Run (⌘R)"
echo ""
echo "5. ⚠️  SE VEDI ERRORI NEI LOG:"
echo "   - Copia il messaggio di errore completo"
echo "   - Errori comuni:"
echo "     • 'No signing certificate' → Vai su Preferences → Accounts"
echo "     • 'Device not trusted' → Fidati del dispositivo sul telefono"
echo "     • 'Failed to install' → Disinstalla app vecchia e riprova"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 IL PASSAGGIO PIÙ IMPORTANTE:"
echo "   Guarda l'area di debug (⇧⌘Y) quando premi Run!"
echo "   I messaggi lì ti diranno ESATTAMENTE perché non si installa."
echo ""

