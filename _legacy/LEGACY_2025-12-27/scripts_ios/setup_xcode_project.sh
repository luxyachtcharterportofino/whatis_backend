#!/bin/bash
# Script completo per setup progetto Xcode WhatisExplorer

set -e

PROJECT_NAME="WhatisExplorer"
BUNDLE_ID="com.andaly.WhatisExplorer"
PROJECT_DIR="$HOME/Desktop/WhatisExplorer"
SOURCE_DIR="$PROJECT_DIR/WhatisExplorer"

echo "🚀 Setup Progetto Xcode: $PROJECT_NAME"
echo "=========================================="

# Verifica directory
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Errore: Directory $SOURCE_DIR non trovata!"
    exit 1
fi

echo "✅ Directory sorgente trovata"

# Crea progetto Xcode usando xcodebuild
echo ""
echo "📝 ISTRUZIONI PER CREARE IL PROGETTO:"
echo "=========================================="
echo ""
echo "1. Apri Xcode"
echo "2. File → New → Project"
echo "3. Seleziona: iOS → App"
echo "4. Compila il form:"
echo "   - Product Name: $PROJECT_NAME"
echo "   - Team: Seleziona il tuo team"
echo "   - Organization Identifier: com.andaly"
echo "   - Bundle Identifier: $BUNDLE_ID"
echo "   - Interface: SwiftUI"
echo "   - Language: Swift"
echo "   - Minimum Deployment: iOS 15.0"
echo "   - ✅ Include Tests: Deseleziona"
echo ""
echo "5. Salva il progetto in: $PROJECT_DIR"
echo "   (Sovrascriverà eventuali file esistenti)"
echo ""
echo "6. DOPO aver creato il progetto:"
echo "   a) Elimina il file WhatisExplorerApp.swift generato"
echo "   b) Trascina la cartella WhatisExplorer/ nel progetto"
echo "   c) Assicurati che 'Copy items if needed' sia selezionato"
echo "   d) Seleziona 'Create groups'"
echo "   e) Seleziona il target WhatisExplorer"
echo ""
echo "7. Configura Info.plist:"
echo "   - Aggiungi Info.plist dalla cartella WhatisExplorer/"
echo "   - Oppure copia le chiavi nel Info.plist esistente"
echo ""
echo "8. Configura Capabilities:"
echo "   - Target → Signing & Capabilities"
echo "   - + Capability → Location Services"
echo "   - Seleziona 'When In Use'"
echo ""
echo "9. Configura URL Backend:"
echo "   - Apri Services/APIService.swift"
echo "   - Verifica che baseURL sia: http://localhost:3000/api"
echo ""
echo "10. Aggiungi Icona:"
echo "    - Assets.xcassets → AppIcon"
echo "    - Trascina iOS_AppIcon_1024.png nello slot 1024pt"
echo ""
echo "11. Build e Run:"
echo "    - Product → Build (⌘B)"
echo "    - Product → Run (⌘R)"
echo ""
echo "=========================================="
echo "✅ Setup completato!"
echo ""
echo "📚 Per istruzioni dettagliate, vedi BUILD_INSTRUCTIONS.md"

