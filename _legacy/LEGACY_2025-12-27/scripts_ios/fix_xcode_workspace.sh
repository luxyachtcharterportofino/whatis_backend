#!/bin/bash

# Risolve il problema del workspace Xcode dopo la rinominazione

set -e

PROJECT_DIR="WhatisExplorer.xcodeproj"
WORKSPACE_DIR="$PROJECT_DIR/project.xcworkspace"

echo "🔧 Fix Workspace Xcode"
echo "======================"
echo ""

# 1. Chiudi Xcode se aperto
echo "1️⃣  Verifica Xcode..."
if pgrep -x "Xcode" > /dev/null; then
    echo "   ⚠️  Xcode è aperto"
    echo "   💡 Chiudi Xcode completamente (⌘Q) prima di continuare"
    echo ""
    read -p "   Xcode è chiuso? (s/N): " XCODE_CLOSED
    if [[ ! "$XCODE_CLOSED" =~ ^[sS]$ ]]; then
        echo "   ❌ Chiudi Xcode e riprova"
        exit 1
    fi
else
    echo "   ✅ Xcode non è aperto"
fi
echo ""

# 2. Verifica workspace
echo "2️⃣  Verifica workspace..."
if [ -d "$WORKSPACE_DIR" ]; then
    echo "   ✅ Workspace trovato: $WORKSPACE_DIR"
    
    # Verifica contents.xcworkspacedata
    if [ -f "$WORKSPACE_DIR/contents.xcworkspacedata" ]; then
        echo "   ✅ File workspace trovato"
        
        # Verifica che il percorso sia corretto
        if grep -q "WhatisExplorer_Lite" "$WORKSPACE_DIR/contents.xcworkspacedata"; then
            echo "   ⚠️  Workspace contiene ancora riferimenti alla vecchia posizione"
            echo "   🔄 Aggiornamento in corso..."
            
            # Backup
            cp "$WORKSPACE_DIR/contents.xcworkspacedata" "$WORKSPACE_DIR/contents.xcworkspacedata.backup"
            
            # Aggiorna percorso
            sed -i '' 's|WhatisExplorer_Lite|WhatisExplorer|g' "$WORKSPACE_DIR/contents.xcworkspacedata"
            echo "   ✅ Workspace aggiornato"
        else
            echo "   ✅ Workspace già corretto"
        fi
    else
        echo "   ⚠️  File workspace non trovato, creazione..."
        mkdir -p "$WORKSPACE_DIR"
        cat > "$WORKSPACE_DIR/contents.xcworkspacedata" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
EOF
        echo "   ✅ Workspace creato"
    fi
else
    echo "   ⚠️  Workspace non trovato, creazione..."
    mkdir -p "$WORKSPACE_DIR"
    cat > "$WORKSPACE_DIR/contents.xcworkspacedata" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
EOF
    echo "   ✅ Workspace creato"
fi
echo ""

# 3. Pulisci DerivedData
echo "3️⃣  Pulizia DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-* 2>/dev/null || true
echo "   ✅ DerivedData pulito"
echo ""

# 4. Verifica progetto
echo "4️⃣  Verifica progetto..."
if [ -f "$PROJECT_DIR/project.pbxproj" ]; then
    echo "   ✅ File progetto trovato"
    
    # Verifica riferimenti alla vecchia posizione
    if grep -q "WhatisExplorer_Lite" "$PROJECT_DIR/project.pbxproj"; then
        echo "   ⚠️  Progetto contiene ancora riferimenti alla vecchia posizione"
        echo "   🔄 Aggiornamento in corso..."
        
        # Backup
        cp "$PROJECT_DIR/project.pbxproj" "$PROJECT_DIR/project.pbxproj.backup_workspace_fix"
        
        # Aggiorna percorsi
        sed -i '' 's|WhatisExplorer_Lite|WhatisExplorer|g' "$PROJECT_DIR/project.pbxproj"
        echo "   ✅ Progetto aggiornato"
    else
        echo "   ✅ Progetto già corretto"
    fi
else
    echo "   ❌ File progetto non trovato!"
    exit 1
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Fix completato!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI:"
echo ""
echo "1. 🔄 APRI XCODE DALLA NUOVA POSIZIONE:"
echo "   - Doppio click su: Apri_Xcode_WhatisExplorer.command (sulla scrivania)"
echo "   - Oppure: open WhatisExplorer.xcodeproj"
echo ""
echo "2. ✅ VERIFICA:"
echo "   - Il progetto dovrebbe aprirsi senza errori"
echo "   - Il punto interrogativo dovrebbe scomparire"
echo ""
echo "3. 🧹 SE NECESSARIO:"
echo "   - Product → Clean Build Folder (⇧⌘K)"
echo "   - Product → Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

