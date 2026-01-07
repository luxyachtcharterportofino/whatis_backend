#!/bin/bash

# Script per riparare i riferimenti rotti nel progetto Xcode
# Risolve il problema del punto interrogativo accanto al progetto

set -e

PROJECT_FILE="WhatisExplorer.xcodeproj/project.pbxproj"
SOURCE_DIR="WhatisExplorer"

echo "🔧 Riparazione Riferimenti Progetto Xcode"
echo "=========================================="
echo ""

# Verifica che il progetto esista
if [ ! -f "$PROJECT_FILE" ]; then
    echo "❌ File progetto non trovato: $PROJECT_FILE"
    exit 1
fi

# Verifica che la directory sorgente esista
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Directory sorgente non trovata: $SOURCE_DIR"
    exit 1
fi

echo "✅ Progetto trovato"
echo "✅ Directory sorgente trovata"
echo ""

# Crea backup
BACKUP_FILE="${PROJECT_FILE}.backup_$(date +%Y%m%d_%H%M%S)"
cp "$PROJECT_FILE" "$BACKUP_FILE"
echo "📦 Backup creato: $BACKUP_FILE"
echo ""

# Verifica che tutti i file Swift esistano
echo "🔍 Verifica file Swift..."
MISSING_FILES=0

for file in "$SOURCE_DIR"/*.swift "$SOURCE_DIR"/Views/*.swift "$SOURCE_DIR"/Models/*.swift "$SOURCE_DIR"/Services/*.swift; do
    if [ -f "$file" ]; then
        echo "   ✅ $(basename $file)"
    else
        echo "   ⚠️  $(basename $file) - non trovato"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ $MISSING_FILES -gt 0 ]; then
    echo ""
    echo "⚠️  Trovati $MISSING_FILES file mancanti"
else
    echo ""
    echo "✅ Tutti i file trovati"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ISTRUZIONI PER RIPARARE IL PROGETTO IN XCODE:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Il punto interrogativo indica riferimenti rotti. Esegui questi passi:"
echo ""
echo "1. 🗑️  RIMUOVI FILE ROTTI:"
echo "   - In Xcode, clicca sul punto interrogativo (icona blu con ?)"
echo "   - Seleziona i file con icona rossa o punto interrogativo"
echo "   - Clicca destro → 'Delete' → 'Remove Reference' (NON 'Move to Trash')"
echo ""
echo "2. ➕ AGGIUNGI FILE CORRETTI:"
echo "   - Clicca destro sulla cartella 'WhatisExplorer' (icona gialla)"
echo "   - 'Add Files to \"WhatisExplorer\"...'"
echo "   - Naviga in: $(pwd)/$SOURCE_DIR"
echo "   - Seleziona TUTTI i file Swift:"
echo "     • WhatisExplorerApp.swift"
echo "     • Views/ (seleziona tutta la cartella)"
echo "     • Models/ (seleziona tutta la cartella)"
echo "     • Services/ (seleziona tutta la cartella)"
echo "   - IMPORTANTE:"
echo "     ✅ Spunta 'Copy items if needed' (se non già nella cartella)"
echo "     ✅ Seleziona target 'WhatisExplorer'"
echo "     ✅ Clicca 'Add'"
echo ""
echo "3. 🔄 VERIFICA:"
echo "   - Il punto interrogativo dovrebbe scomparire"
echo "   - Tutti i file dovrebbero avere icona normale (non rossa)"
echo ""
echo "4. 🧹 PULIZIA:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo ""
echo "5. ▶️  PROVA COMPILAZIONE:"
echo "   - Product → Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 ALTERNATIVA: Se preferisci, posso creare uno script automatico"
echo "   che ripara i riferimenti, ma il metodo manuale è più sicuro."
echo ""

