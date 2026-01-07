#!/bin/bash

# Script per eliminare le versioni vecchie dell'app dalla scrivania
# Mantiene solo la versione corrente in whatis_backend/WhatisExplorer/WhatisExplorer/

set -e

DESKTOP="/Users/andreastagnaro/Desktop"
CURRENT_APP="$DESKTOP/whatis_backend/WhatisExplorer/WhatisExplorer"

echo "🧹 Pulizia Versioni Vecchie App"
echo "================================"
echo ""
echo "📍 Versione CORRETTA (da mantenere):"
echo "   $CURRENT_APP"
echo ""

# Verifica che la versione corrente esista
if [ ! -d "$CURRENT_APP" ]; then
    echo "❌ ERRORE: Versione corrente non trovata!"
    echo "   Cartella attesa: $CURRENT_APP"
    exit 1
fi

# Verifica file critici nella versione corrente
echo "✅ Verifica file critici nella versione corrente..."
CRITICAL_FILES=(
    "$CURRENT_APP/WhatisExplorerApp.swift"
    "$CURRENT_APP/Views/ARView.swift"
    "$CURRENT_APP/Views/ContentView.swift"
    "$CURRENT_APP/Views/MapView.swift"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $(basename $file)"
    else
        echo "   ❌ MANCANTE: $(basename $file)"
        echo "   ⚠️  Interruzione per sicurezza!"
        exit 1
    fi
done

echo ""
echo "📋 Cartelle VECCHIE da eliminare:"
echo ""

# Lista cartelle da eliminare
OLD_FOLDERS=(
    "$DESKTOP/WhatisExplorer"
    "$DESKTOP/AndalyExplorer"
    "$DESKTOP/AndalyExplorer_Backup_20251124_195138"
    "$DESKTOP/AndalyExplorer_NEW"
)

# Verifica esistenza e mostra dimensione
FOLDERS_TO_DELETE=()
for folder in "${OLD_FOLDERS[@]}"; do
    if [ -d "$folder" ]; then
        size=$(du -sh "$folder" 2>/dev/null | cut -f1)
        echo "   📁 $folder ($size)"
        FOLDERS_TO_DELETE+=("$folder")
    else
        echo "   ⚪ $folder (non trovata, già eliminata)"
    fi
done

# Verifica anche "Progetto Whatis" se contiene codice vecchio
if [ -d "$DESKTOP/Progetto Whatis" ]; then
    echo ""
    echo "⚠️  Trovata cartella 'Progetto Whatis'"
    echo "   Verifica se contiene codice app..."
    if find "$DESKTOP/Progetto Whatis" -name "*.xcodeproj" -o -name "*.swift" 2>/dev/null | grep -q .; then
        size=$(du -sh "$DESKTOP/Progetto Whatis" 2>/dev/null | cut -f1)
        echo "   📁 $DESKTOP/Progetto Whatis ($size) - contiene codice, aggiunta alla lista"
        FOLDERS_TO_DELETE+=("$DESKTOP/Progetto Whatis")
    else
        echo "   ✅ Non contiene codice app, mantenuta"
    fi
fi

if [ ${#FOLDERS_TO_DELETE[@]} -eq 0 ]; then
    echo ""
    echo "✅ Nessuna cartella vecchia da eliminare!"
    exit 0
fi

echo ""
echo "⚠️  ATTENZIONE: Verranno eliminate ${#FOLDERS_TO_DELETE[@]} cartelle"
echo ""
read -p "Continuare? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo "❌ Operazione annullata"
    exit 0
fi

echo ""
echo "🗑️  Eliminazione in corso..."

for folder in "${FOLDERS_TO_DELETE[@]}"; do
    echo "   🗑️  Eliminando: $(basename $folder)..."
    rm -rf "$folder"
    if [ $? -eq 0 ]; then
        echo "   ✅ Eliminata: $(basename $folder)"
    else
        echo "   ❌ Errore eliminando: $(basename $folder)"
    fi
done

echo ""
echo "✅ Pulizia completata!"
echo ""
echo "📋 Verifica finale..."
echo "   ✅ Versione corrente: $CURRENT_APP"
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $(basename $file) presente"
    fi
done

echo ""
echo "🎉 Tutte le versioni vecchie sono state eliminate!"
echo "   La versione corrente 'Whatis Explorer' è intatta con tutte le funzionalità."

