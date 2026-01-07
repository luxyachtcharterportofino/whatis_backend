#!/bin/bash

# Diagnostica completa problemi di deploy iOS

set -e

echo "🔍 Diagnostica Problema Deploy iOS"
echo "=================================="
echo ""

# 1. Verifica dispositivo connesso
echo "1️⃣  Verifica dispositivo iOS..."
if command -v xcrun &> /dev/null; then
    DEVICES=$(xcrun xctrace list devices 2>/dev/null | grep "iPhone di Andrea" || echo "")
    if [ -n "$DEVICES" ]; then
        echo "   ✅ Dispositivo trovato:"
        echo "   $DEVICES"
    else
        echo "   ❌ Dispositivo 'iPhone di Andrea 11' NON trovato!"
        echo "   💡 Verifica:"
        echo "      - Telefono collegato via USB"
        echo "      - Telefono sbloccato"
        echo "      - 'Fidati di questo computer' accettato"
    fi
else
    echo "   ⚠️  xcrun non disponibile"
fi
echo ""

# 2. Verifica provisioning
echo "2️⃣  Verifica provisioning..."
PROJECT_FILE="WhatisExplorer.xcodeproj/project.pbxproj"
if [ -f "$PROJECT_FILE" ]; then
    TEAM_ID=$(grep -A 5 "DEVELOPMENT_TEAM" "$PROJECT_FILE" | grep -o '[A-Z0-9]\{10\}' | head -1 || echo "")
    if [ -n "$TEAM_ID" ]; then
        echo "   ✅ Team ID trovato: $TEAM_ID"
    else
        echo "   ⚠️  Team ID non trovato nel progetto"
    fi
fi
echo ""

# 3. Verifica bundle ID
echo "3️⃣  Verifica Bundle ID..."
INFO_PLIST="WhatisExplorer/Info.plist"
if [ -f "$INFO_PLIST" ]; then
    BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$INFO_PLIST" 2>/dev/null | sed 's/\$(PRODUCT_BUNDLE_IDENTIFIER)/com.andaly.WhatisExplorer/')
    echo "   📱 Bundle ID: $BUNDLE_ID"
    
    # Verifica nel project.pbxproj
    PROJECT_BUNDLE_ID=$(grep "PRODUCT_BUNDLE_IDENTIFIER" "$PROJECT_FILE" | grep -o 'com\.andaly\.[^;]*' | head -1 || echo "")
    if [ -n "$PROJECT_BUNDLE_ID" ]; then
        echo "   📱 Bundle ID nel progetto: $PROJECT_BUNDLE_ID"
        if [ "$PROJECT_BUNDLE_ID" != "com.andaly.WhatisExplorer" ]; then
            echo "   ⚠️  DISCREPANZA tra Info.plist e project.pbxproj!"
        fi
    fi
fi
echo ""

# 4. Verifica certificati
echo "4️⃣  Verifica certificati di sviluppo..."
if command -v security &> /dev/null; then
    CERT_COUNT=$(security find-identity -v -p codesigning | grep "Apple Development" | wc -l | tr -d ' ')
    if [ "$CERT_COUNT" -gt 0 ]; then
        echo "   ✅ Trovati $CERT_COUNT certificati Apple Development"
        security find-identity -v -p codesigning | grep "Apple Development" | head -1
    else
        echo "   ❌ Nessun certificato Apple Development trovato!"
        echo "   💡 Vai su: Xcode → Preferences → Accounts"
        echo "      Aggiungi il tuo account Apple e genera un certificato"
    fi
else
    echo "   ⚠️  Comando 'security' non disponibile"
fi
echo ""

# 5. Verifica profili provisioning
echo "5️⃣  Verifica profili provisioning..."
PROFILES_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
if [ -d "$PROFILES_DIR" ]; then
    PROFILE_COUNT=$(ls -1 "$PROFILES_DIR"/*.mobileprovision 2>/dev/null | wc -l | tr -d ' ')
    echo "   📋 Trovati $PROFILE_COUNT profili provisioning"
    
    # Cerca profili per questo bundle ID
    MATCHING_PROFILES=0
    if [ -d "$PROFILES_DIR" ]; then
        for profile in "$PROFILES_DIR"/*.mobileprovision; do
            if [ -f "$profile" ]; then
                # Estrai bundle ID dal profilo (semplificato)
                if command -v strings &> /dev/null; then
                    if strings "$profile" 2>/dev/null | grep -q "com.andaly.WhatisExplorer"; then
                        MATCHING_PROFILES=$((MATCHING_PROFILES + 1))
                    fi
                fi
            fi
        done
    fi
    
    if [ "$MATCHING_PROFILES" -gt 0 ]; then
        echo "   ✅ Trovati $MATCHING_PROFILES profili per com.andaly.WhatisExplorer"
    else
        echo "   ⚠️  Nessun profilo trovato per com.andaly.WhatisExplorer"
        echo "   💡 Xcode dovrebbe generarlo automaticamente"
    fi
else
    echo "   ⚠️  Directory profili non trovata"
fi
echo ""

# 6. Verifica build number
echo "6️⃣  Verifica build number..."
if [ -f "$INFO_PLIST" ]; then
    BUILD_NUMBER=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "N/A")
    echo "   🔢 Build number: $BUILD_NUMBER"
fi
echo ""

# 7. Verifica configurazione progetto
echo "7️⃣  Verifica configurazione progetto..."
if [ -f "$PROJECT_FILE" ]; then
    # Verifica che il progetto sia configurato per iOS
    IOS_DEPLOYMENT=$(grep "IPHONEOS_DEPLOYMENT_TARGET" "$PROJECT_FILE" | head -1 | grep -o '[0-9.]*' | head -1 || echo "")
    if [ -n "$IOS_DEPLOYMENT" ]; then
        echo "   📱 iOS Deployment Target: $IOS_DEPLOYMENT"
    fi
    
    # Verifica che CODE_SIGN sia abilitato
    CODE_SIGN=$(grep "CODE_SIGN" "$PROJECT_FILE" | grep -v "//" | head -1 || echo "")
    if echo "$CODE_SIGN" | grep -q "YES"; then
        echo "   ✅ Code Signing abilitato"
    else
        echo "   ⚠️  Code Signing potrebbe non essere configurato correttamente"
    fi
fi
echo ""

# 8. Suggerimenti
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 SOLUZIONI POSSIBILI:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Se l'app non si installa nonostante 'Build Succeeded':"
echo ""
echo "1. 🔐 VERIFICA SIGNING IN XCODE:"
echo "   - Progetto → Target → Signing & Capabilities"
echo "   - Se vedi errori rossi:"
echo "     • Clicca su 'Team' e seleziona di nuovo"
echo "     • Attendi che Xcode generi il profilo (può richiedere 10-30 secondi)"
echo "     • Se appare 'No accounts with Apple ID':"
echo "       → Xcode → Preferences → Accounts → Aggiungi account"
echo ""
echo "2. 📱 VERIFICA DISPOSITIVO:"
echo "   - In Xcode: Window → Devices and Simulators"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Verifica che non ci siano errori"
echo "   - Se vedi 'Untrusted Developer':"
echo "     → Sul telefono: Impostazioni → Generale → Gestione VPN e dispositivi"
echo "     → Trova il tuo profilo → Tocca 'Fidati'"
echo ""
echo "3. 🔄 RESET PROVISIONING:"
echo "   - In Xcode: Preferences → Accounts"
echo "   - Seleziona il tuo account"
echo "   - Clicca 'Download Manual Profiles'"
echo "   - Torna a Signing & Capabilities"
echo "   - Deseleziona e riseleziona 'Automatically manage signing'"
echo ""
echo "4. 🧹 PULIZIA COMPLETA:"
echo "   - Chiudi Xcode"
echo "   - Esegui: rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-*"
echo "   - Riapri Xcode"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo "   - Product → Run (⌘R)"
echo ""
echo "5. ⚠️  VERIFICA LOG XCODE:"
echo "   - In Xcode: View → Debug Area → Show Debug Area"
echo "   - Cerca errori rossi durante il deploy"
echo "   - Errori comuni:"
echo "     • 'No signing certificate' → Problema certificati"
echo "     • 'No provisioning profile' → Problema profili"
echo "     • 'Device not trusted' → Problema fiducia dispositivo"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

