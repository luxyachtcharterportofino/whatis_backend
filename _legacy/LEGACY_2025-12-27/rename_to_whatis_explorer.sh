#!/bin/bash

# Rinomina la cartella principale da WhatisExplorer_Lite a WhatisExplorer

set -e

DESKTOP="/Users/andreastagnaro/Desktop"
OLD_DIR="$DESKTOP/whatis_backend/WhatisExplorer_Lite"
NEW_DIR="$DESKTOP/whatis_backend/WhatisExplorer"

echo "🔄 Rinominazione Cartella Principale"
echo "====================================="
echo ""
echo "📍 Da: $OLD_DIR"
echo "📍 A:   $NEW_DIR"
echo ""

# Verifica che la cartella vecchia esista
if [ ! -d "$OLD_DIR" ]; then
    echo "❌ Cartella $OLD_DIR non trovata!"
    exit 1
fi

# Verifica che la cartella nuova non esista già
if [ -d "$NEW_DIR" ]; then
    echo "⚠️  La cartella $NEW_DIR esiste già!"
    echo "   Vuoi sovrascriverla? (s/N)"
    read -p "> " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
        echo "❌ Operazione annullata"
        exit 0
    fi
    rm -rf "$NEW_DIR"
fi

# Verifica che il progetto Xcode esista
if [ ! -d "$OLD_DIR/WhatisExplorer.xcodeproj" ]; then
    echo "❌ Progetto Xcode non trovato in $OLD_DIR!"
    exit 1
fi

echo "✅ Verifiche completate"
echo ""
read -p "Continuare con la rinominazione? (s/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[sS]$ ]]; then
    echo "❌ Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Rinominazione in corso..."

# Rinomina la cartella
mv "$OLD_DIR" "$NEW_DIR"

if [ $? -eq 0 ]; then
    echo "✅ Cartella rinominata con successo!"
    echo ""
    echo "📋 AGGIORNAMENTI NECESSARI:"
    echo ""
    echo "1. 🔗 Link simbolico sulla scrivania:"
    echo "   Il link 'Apri_Xcode_WhatisExplorer.command' punta ancora alla vecchia posizione"
    echo "   Deve essere aggiornato o ricreato"
    echo ""
    echo "2. 📝 Script:"
    echo "   Gli script nella cartella potrebbero avere percorsi hardcoded"
    echo "   Verranno aggiornati automaticamente"
    echo ""
    echo "3. ✅ Verifica:"
    echo "   Apri Xcode: open $NEW_DIR/WhatisExplorer.xcodeproj"
    echo ""
else
    echo "❌ Errore durante la rinominazione"
    exit 1
fi

