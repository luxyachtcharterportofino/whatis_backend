#!/bin/bash

# Risolve il problema del Run grigio quando tutto è configurato correttamente

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
SCHEME="WhatisExplorer"
DEVICE_ID="00008030-001A24E41AD0802E"

echo "🔧 Fix Run Button Grigio"
echo "======================="
echo ""

# 1. Verifica destinazioni disponibili
echo "1️⃣  Verifica destinazioni disponibili..."
DESTINATIONS=$(xcodebuild -project "$PROJECT_DIR" -scheme "$SCHEME" -showdestinations 2>&1 | grep -i "iphone" || echo "")

if echo "$DESTINATIONS" | grep -q "$DEVICE_ID"; then
    echo "   ✅ Dispositivo trovato nelle destinazioni"
else
    echo "   ⚠️  Dispositivo NON trovato nelle destinazioni"
    echo "   💡 Questo potrebbe essere il problema!"
fi
echo ""

# 2. Verifica deployment target
echo "2️⃣  Verifica deployment target..."
DEPLOYMENT_TARGET=$(grep -A 2 "IPHONEOS_DEPLOYMENT_TARGET" "$PROJECT_DIR/project.pbxproj" | grep -v "^//" | head -1 | sed -n 's/.*IPHONEOS_DEPLOYMENT_TARGET = \([^;]*\);.*/\1/p' || echo "")

if [ -n "$DEPLOYMENT_TARGET" ]; then
    echo "   ✅ Deployment target: $DEPLOYMENT_TARGET"
else
    echo "   ⚠️  Deployment target non trovato"
fi
echo ""

# 3. Verifica device family
echo "3️⃣  Verifica device family..."
DEVICE_FAMILY=$(grep -A 2 "TARGETED_DEVICE_FAMILY" "$PROJECT_DIR/project.pbxproj" | grep -v "^//" | head -1 | sed -n 's/.*TARGETED_DEVICE_FAMILY = \([^;]*\);.*/\1/p' || echo "")

if [ -n "$DEVICE_FAMILY" ]; then
    echo "   ✅ Device family: $DEVICE_FAMILY"
else
    echo "   ⚠️  Device family non trovato"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SOLUZIONE SPECIFICA PER RUN GRIGIO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Quando tutto è configurato correttamente ma il Run è grigio,"
echo "il problema è spesso che Xcode non riconosce il dispositivo"
echo "come destinazione valida per il deploy."
echo ""
echo "🔧 SOLUZIONE PASSO PASSO:"
echo ""
echo "1. 🎯 SELEZIONA MANUALMENTE LA DESTINAZIONE:"
echo "   - In Xcode, in alto a sinistra (accanto al pulsante Play)"
echo "   - Clicca sul menu a tendina che mostra 'iPhone di Andrea 11'"
echo "   - Se vedi 'iPhone di Andrea 11' nella lista, selezionalo"
echo "   - Se NON vedi 'iPhone di Andrea 11' nella lista:"
echo "     → Clicca 'Add Additional Simulators...' o 'Manage Devices...'"
echo "     → Window → Devices and Simulators"
echo "     → Verifica che 'iPhone di Andrea 11' sia presente"
echo ""
echo "2. 🔄 FORZA RICONOSCIMENTO DISPOSITIVO:"
echo "   - Window → Devices and Simulators (⇧⌘2)"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Clicca destro sul dispositivo"
echo "   - Se vedi 'Use for Development', cliccalo"
echo "   - Se vedi 'Unpair Device', NON cliccare"
echo ""
echo "3. 🎯 SELEZIONA DESTINAZIONE DA PRODUCT MENU:"
echo "   - Product → Destination"
echo "   - Cerca 'iPhone di Andrea 11' nella lista"
echo "   - Selezionalo"
echo ""
echo "4. 🔄 FORZA RICARICA SCHEME:"
echo "   - Product → Scheme → Edit Scheme..."
echo "   - Vai alla tab 'Run'"
echo "   - In 'Executable', verifica che sia selezionato 'Whatis Explorer'"
echo "   - In 'Destination', verifica che sia selezionato 'iPhone di Andrea 11'"
echo "   - Clicca 'Close'"
echo ""
echo "5. 🧹 CLEAN E REBUILD:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo "   - Attendi che finisca"
echo "   - Product → Build (⌘B)"
echo "   - Verifica che compili senza errori"
echo ""
echo "6. ▶️  PROVA RUN:"
echo "   - Dopo il build, il Run dovrebbe diventare cliccabile"
echo "   - Se ancora grigio, prova:"
echo "     → Product → Run (⌘R) direttamente dal menu"
echo "     → Anche se grigio, potrebbe funzionare!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 TRUCCO: Anche se il Run è grigio, prova:"
echo "   - Product → Run (⌘R) dal menu"
echo "   - A volte funziona anche se il pulsante è grigio!"
echo ""

