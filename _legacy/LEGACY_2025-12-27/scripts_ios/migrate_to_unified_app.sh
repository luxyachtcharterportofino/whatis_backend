#!/bin/bash

# Script di migrazione: WhatisExplorer -> WhatisExplorer
# Rimuove tutti i riferimenti "Lite" e unifica in "Whatis Explorer"

set -e

echo "🔄 Migrazione: WhatisExplorer → Whatis Explorer"
echo "=================================================="
echo ""
echo "⚠️  ATTENZIONE: Questa operazione modificherà:"
echo "   - Nome progetto"
echo "   - Bundle ID"
echo "   - Nomi file e cartelle"
echo "   - Riferimenti nel codice"
echo ""
read -p "Continuare? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo "❌ Operazione annullata"
    exit 1
fi

# Backup
echo ""
echo "📦 Creazione backup..."
BACKUP_DIR="backup_before_migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -R WhatisExplorer "$BACKUP_DIR/" 2>/dev/null || true
cp -R WhatisExplorer.xcodeproj "$BACKUP_DIR/" 2>/dev/null || true
echo "✅ Backup creato in: $BACKUP_DIR"
echo ""

# 1. Rinomina cartella principale
echo "1️⃣  Rinominazione cartelle..."
if [ -d "WhatisExplorer" ]; then
    mv "WhatisExplorer" "WhatisExplorer"
    echo "✅ Cartella rinominata: WhatisExplorer → WhatisExplorer"
fi

# 2. Rinomina progetto Xcode
echo ""
echo "2️⃣  Rinominazione progetto Xcode..."
if [ -d "WhatisExplorer.xcodeproj" ]; then
    mv "WhatisExplorer.xcodeproj" "WhatisExplorer.xcodeproj"
    echo "✅ Progetto rinominato: WhatisExplorer.xcodeproj → WhatisExplorer.xcodeproj"
fi

# 3. Rinomina file principale app
echo ""
echo "3️⃣  Rinominazione file app..."
if [ -f "WhatisExplorer/WhatisExplorerApp.swift" ]; then
    mv "WhatisExplorer/WhatisExplorerApp.swift" "WhatisExplorer/WhatisExplorerApp.swift"
    echo "✅ File rinominato: WhatisExplorerApp.swift → WhatisExplorerApp.swift"
fi

# 4. Aggiorna Bundle ID nel project.pbxproj
echo ""
echo "4️⃣  Aggiornamento Bundle ID..."
if [ -f "WhatisExplorer.xcodeproj/project.pbxproj" ]; then
    sed -i '' 's/com\.andaly\.WhatisExplorer/com.andaly.WhatisExplorer/g' "WhatisExplorer.xcodeproj/project.pbxproj"
    echo "✅ Bundle ID aggiornato: com.andaly.WhatisExplorer → com.andaly.WhatisExplorer"
fi

# 5. Aggiorna nomi nel project.pbxproj
echo ""
echo "5️⃣  Aggiornamento riferimenti nel progetto..."
if [ -f "WhatisExplorer.xcodeproj/project.pbxproj" ]; then
    # Aggiorna PRODUCT_NAME
    sed -i '' 's/PRODUCT_NAME = "Whatis Explorer";/PRODUCT_NAME = "Whatis Explorer";/g' "WhatisExplorer.xcodeproj/project.pbxproj"
    
    # Aggiorna riferimenti a WhatisExplorer
    sed -i '' 's/WhatisExplorer/WhatisExplorer/g' "WhatisExplorer.xcodeproj/project.pbxproj"
    
    # Aggiorna riferimenti a WhatisExplorerApp
    sed -i '' 's/WhatisExplorerApp/WhatisExplorerApp/g' "WhatisExplorer.xcodeproj/project.pbxproj"
    
    echo "✅ Riferimenti nel progetto aggiornati"
fi

# 6. Aggiorna scheme
echo ""
echo "6️⃣  Aggiornamento scheme..."
if [ -f "WhatisExplorer.xcodeproj/xcshareddata/xcschemes/WhatisExplorer.xcscheme" ]; then
    mv "WhatisExplorer.xcodeproj/xcshareddata/xcschemes/WhatisExplorer.xcscheme" \
       "WhatisExplorer.xcodeproj/xcshareddata/xcschemes/WhatisExplorer.xcscheme"
    
    # Aggiorna riferimenti nello scheme
    sed -i '' 's/WhatisExplorer/WhatisExplorer/g' "WhatisExplorer.xcodeproj/xcshareddata/xcschemes/WhatisExplorer.xcscheme"
    
    echo "✅ Scheme aggiornato"
fi

# 7. Aggiorna file Swift
echo ""
echo "7️⃣  Aggiornamento file Swift..."
find WhatisExplorer -name "*.swift" -type f | while read file; do
    # Aggiorna struct WhatisExplorerApp
    sed -i '' 's/struct WhatisExplorerApp/struct WhatisExplorerApp/g' "$file"
    sed -i '' 's/WhatisExplorerApp/WhatisExplorerApp/g' "$file"
    
    # Aggiorna commenti
    sed -i '' 's/Whatis Explorer – Lite/Whatis Explorer/g' "$file"
    sed -i '' 's/Whatis Explorer Lite/Whatis Explorer/g' "$file"
done
echo "✅ File Swift aggiornati"

# 8. Aggiorna script
echo ""
echo "8️⃣  Aggiornamento script..."
find . -maxdepth 1 -name "*.sh" -type f | while read file; do
    sed -i '' 's/WhatisExplorer/WhatisExplorer/g' "$file"
    sed -i '' 's/com\.andaly\.WhatisExplorer/com.andaly.WhatisExplorer/g' "$file"
done
echo "✅ Script aggiornati"

# 9. Aggiorna generate_app_icon.py
echo ""
echo "9️⃣  Aggiornamento script icone..."
if [ -f "generate_app_icon.py" ]; then
    sed -i '' 's/WhatisExplorer/WhatisExplorer/g' "generate_app_icon.py"
    echo "✅ Script icone aggiornato"
fi

echo ""
echo "✅ Migrazione completata!"
echo ""
echo "📋 PROSSIMI PASSI:"
echo "   1. Apri Xcode: open WhatisExplorer.xcodeproj"
echo "   2. Verifica che il Bundle ID sia: com.andaly.WhatisExplorer"
echo "   3. Verifica che il Product Name sia: Whatis Explorer"
echo "   4. Pulisci build: Product → Clean Build Folder (⇧⌘K)"
echo "   5. Compila e testa: Product → Run (⌘R)"
echo ""
echo "💡 Backup salvato in: $BACKUP_DIR"
echo ""

