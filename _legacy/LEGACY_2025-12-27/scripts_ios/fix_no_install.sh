#!/bin/bash

# Risolve il problema "compila ma non installa"

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
SCHEME="WhatisExplorer"

echo "🔧 Fix: Compila ma Non Installa"
echo "================================"
echo ""

# 1. Verifica che il dispositivo sia selezionato in Xcode
echo "⚠️  IMPORTANTE: Verifica in Xcode"
echo ""
echo "1. In Xcode, in alto a sinistra (accanto al pulsante Play):"
echo "   → Deve essere selezionato 'iPhone di Andrea 11'"
echo "   → NON deve essere selezionato un simulatore"
echo ""
read -p "   'iPhone di Andrea 11' è selezionato? (s/N): " DEVICE_SELECTED
if [[ ! "$DEVICE_SELECTED" =~ ^[sS]$ ]]; then
    echo "   ❌ Seleziona 'iPhone di Andrea 11' prima di continuare!"
    exit 1
fi
echo ""

# 2. Verifica Devices and Simulators
echo "2. Window → Devices and Simulators (⇧⌘2)"
echo "   → Seleziona 'iPhone di Andrea 11'"
echo "   → Verifica che appaia come 'Connected'"
echo "   → Se vedi 'Untrusted Developer':"
echo "     → Sul telefono: Impostazioni → Generale → Gestione VPN e dispositivi"
echo "     → Trova il profilo → Tocca 'Fidati'"
echo ""
read -p "   Dispositivo connesso e fidato? (s/N): " DEVICE_TRUSTED
if [[ ! "$DEVICE_TRUSTED" =~ ^[sS]$ ]]; then
    echo "   ❌ Risolvi il problema di fiducia prima di continuare!"
    exit 1
fi
echo ""

# 3. Verifica Signing
echo "3. Progetto → Target → Signing & Capabilities"
echo "   → 'Automatically manage signing' deve essere selezionato"
echo "   → Team deve essere selezionato"
echo "   → NON devono esserci errori rossi"
echo ""
read -p "   Signing configurato correttamente? (s/N): " SIGNING_OK
if [[ ! "$SIGNING_OK" =~ ^[sS]$ ]]; then
    echo "   🔄 Forza rigenerazione profilo..."
    echo "   → Deseleziona 'Automatically manage signing'"
    echo "   → Attendi 2 secondi"
    echo "   → Riseleziona 'Automatically manage signing'"
    echo "   → Seleziona Team"
    echo "   → Attendi 10-30 secondi"
    echo ""
    read -p "   Fatto? (s/N): " SIGNING_DONE
    if [[ ! "$SIGNING_DONE" =~ ^[sS]$ ]]; then
        echo "   ❌ Configura signing prima di continuare!"
        exit 1
    fi
fi
echo ""

# 4. Disinstalla app esistente
echo "4️⃣  Disinstalla app esistente (se presente)..."
BUNDLE_ID="com.andaly.WhatisExplorer"
DEVICE_ID="00008030-001A24E41AD0802E"

# Prova a disinstallare via devicectl
if command -v xcrun &> /dev/null; then
    if xcrun devicectl device install app --device "$DEVICE_ID" --list 2>/dev/null | grep -q "$BUNDLE_ID"; then
        echo "   ⚠️  App trovata, disinstallazione..."
        xcrun devicectl device uninstall app --device "$DEVICE_ID" --bundle-id "$BUNDLE_ID" 2>/dev/null || true
        echo "   ✅ App disinstallata"
    else
        echo "   ✅ App non presente"
    fi
else
    echo "   ⚠️  Verifica manuale: Window → Devices and Simulators"
    echo "   → Se 'Whatis Explorer' è presente, clicca destro → Uninstall"
fi
echo ""

# 5. Pulisci tutto
echo "5️⃣  Pulizia completa..."
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-* 2>/dev/null || true
echo "   ✅ DerivedData pulito"

if command -v xcodebuild &> /dev/null; then
    xcodebuild clean -project "$PROJECT_DIR" -scheme "$SCHEME" 2>&1 | grep -v "warning:" || true
    echo "   ✅ Build pulito"
fi
echo ""

# 6. Incrementa build number
INFO_PLIST="WhatisExplorer/Info.plist"
CURRENT_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "1")
NEW_BUILD=$((CURRENT_BUILD + 1))

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$INFO_PLIST"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PROJECT_DIR/project.pbxproj"

echo "6️⃣  Build number incrementato: $CURRENT_BUILD → $NEW_BUILD"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Preparazione completata!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI IN XCODE:"
echo ""
echo "1. 🔄 CHIUDI E RIAPRI XCODE:"
echo "   - Xcode → Quit Xcode (⌘Q)"
echo "   - Riapri il progetto"
echo ""
echo "2. ✅ VERIFICA DESTINAZIONE:"
echo "   - In alto a sinistra, accanto a Play:"
echo "   - Deve essere selezionato 'iPhone di Andrea 11'"
echo "   - NON un simulatore!"
echo ""
echo "3. 🧹 CLEAN BUILD FOLDER:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo "   - Attendi che finisca"
echo ""
echo "4. ▶️  RUN CON AREA DI DEBUG:"
echo "   - View → Debug Area → Show Debug Area (⇧⌘Y)"
echo "   - Premi Run (⌘R)"
echo "   - GUARDA L'AREA DI DEBUG in basso"
echo "   - Dovresti vedere:"
echo "     • 'Building...'"
echo "     • 'Installing...' ← QUESTO è importante!"
echo "     • 'Launching...'"
echo ""
echo "5. ⚠️  SE ANCORA NON INSTALLA:"
echo "   - Prova: Product → Destination → iPhone di Andrea 11"
echo "   - Poi: Product → Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 IL PROBLEMA PIÙ COMUNE:"
echo "   Xcode compila ma non installa se:"
echo "   • Il dispositivo non è selezionato correttamente"
echo "   • C'è un'app installata con lo stesso bundle ID ma profilo diverso"
echo "   • Il provisioning profile non è valido"
echo ""
echo "   Segui i passi sopra e verifica ogni punto!"
echo ""

