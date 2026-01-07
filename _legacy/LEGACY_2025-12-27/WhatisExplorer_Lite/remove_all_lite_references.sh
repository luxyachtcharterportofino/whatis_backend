#!/bin/bash

# Rimuove TUTTI i riferimenti a "Lite" dal codice dell'app
# (non dalla documentazione, solo dal codice)

set -e

echo "🧹 Rimozione Riferimenti 'Lite' dal Codice"
echo "============================================"
echo ""

APP_DIR="WhatisExplorer"

# Verifica che la directory esista
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Directory $APP_DIR non trovata!"
    exit 1
fi

echo "🔍 Cerca riferimenti 'Lite' nel codice..."
echo ""

# Cerca nei file Swift
SWIFT_FILES=$(find "$APP_DIR" -name "*.swift" -type f)
LITE_FOUND=0

for file in $SWIFT_FILES; do
    if grep -qi "lite" "$file"; then
        echo "   📝 Trovato in: $file"
        LITE_FOUND=$((LITE_FOUND + 1))
    fi
done

# Cerca in Info.plist
if [ -f "$APP_DIR/Info.plist" ]; then
    if grep -qi "lite" "$APP_DIR/Info.plist"; then
        echo "   📝 Trovato in: $APP_DIR/Info.plist"
        LITE_FOUND=$((LITE_FOUND + 1))
    fi
fi

if [ $LITE_FOUND -eq 0 ]; then
    echo "✅ Nessun riferimento 'Lite' trovato nel codice!"
    echo ""
    echo "💡 Nota: Il nome della cartella 'WhatisExplorer_Lite' è solo"
    echo "   per organizzazione. Il progetto interno è già 'WhatisExplorer'."
    echo "   Se vuoi, possiamo rinominare anche la cartella principale."
    exit 0
fi

echo ""
echo "⚠️  Trovati $LITE_FOUND file con riferimenti 'Lite'"
echo ""
read -p "Rimuovere tutti i riferimenti? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo "❌ Operazione annullata"
    exit 0
fi

echo ""
echo "🗑️  Rimozione riferimenti..."

# Rimuovi da file Swift
for file in $SWIFT_FILES; do
    if grep -qi "lite" "$file"; then
        # Rimuovi "Lite" dai commenti e stringhe
        sed -i '' 's/Whatis Explorer Lite/Whatis Explorer/g' "$file"
        sed -i '' 's/Whatis Explorer – Lite/Whatis Explorer/g' "$file"
        sed -i '' 's/WhatisExplorerLite/WhatisExplorer/g' "$file"
        echo "   ✅ Aggiornato: $file"
    fi
done

# Rimuovi da Info.plist
if [ -f "$APP_DIR/Info.plist" ]; then
    if grep -qi "lite" "$APP_DIR/Info.plist"; then
        sed -i '' 's/Lite//g' "$APP_DIR/Info.plist"
        echo "   ✅ Aggiornato: $APP_DIR/Info.plist"
    fi
done

echo ""
echo "✅ Riferimenti 'Lite' rimossi dal codice!"
echo ""
echo "📋 Verifica finale..."
FINAL_CHECK=$(find "$APP_DIR" -type f \( -name "*.swift" -o -name "*.plist" \) -exec grep -l -i "lite" {} \; 2>/dev/null | wc -l | tr -d ' ')
if [ "$FINAL_CHECK" -eq 0 ]; then
    echo "✅ Nessun riferimento 'Lite' rimasto nel codice!"
else
    echo "⚠️  Ancora $FINAL_CHECK file con riferimenti 'Lite'"
fi
echo ""

