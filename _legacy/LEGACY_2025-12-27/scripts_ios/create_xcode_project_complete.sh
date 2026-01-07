#!/bin/bash
# Script per creare progetto Xcode completo WhatisExplorer

set -e

PROJECT_NAME="WhatisExplorer"
BUNDLE_ID="com.andaly.WhatisExplorer"
PROJECT_DIR="$HOME/Desktop/WhatisExplorer"
SOURCE_DIR="$PROJECT_DIR/WhatisExplorer"
XCODE_PROJECT="$PROJECT_DIR/$PROJECT_NAME.xcodeproj"

echo "🚀 Creazione progetto Xcode completo: $PROJECT_NAME"

cd "$PROJECT_DIR"

# Rimuovi progetto esistente se presente
if [ -d "$XCODE_PROJECT" ]; then
    echo "⚠️  Rimozione progetto esistente..."
    rm -rf "$XCODE_PROJECT"
fi

# Crea struttura progetto
mkdir -p "$XCODE_PROJECT/project.xcworkspace"
mkdir -p "$XCODE_PROJECT/xcshareddata/xcschemes"
mkdir -p "$XCODE_PROJECT/xcuserdata"

# Crea workspace
cat > "$XCODE_PROJECT/project.xcworkspace/contents.xcworkspacedata" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
EOF

echo "✅ Struttura base creata"

# Crea Assets.xcassets se non esiste
if [ ! -d "$SOURCE_DIR/Assets.xcassets" ]; then
    mkdir -p "$SOURCE_DIR/Assets.xcassets/AppIcon.appiconset"
    cat > "$SOURCE_DIR/Assets.xcassets/Contents.json" << 'EOF'
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF
    cat > "$SOURCE_DIR/Assets.xcassets/AppIcon.appiconset/Contents.json" << 'EOF'
{
  "images" : [
    {
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF
    echo "✅ Assets.xcassets creato"
fi

echo ""
echo "⚠️  NOTA: Il file project.pbxproj deve essere creato manualmente in Xcode"
echo "   oppure usando xcodegen se disponibile."
echo ""
echo "📝 PROSSIMI PASSI:"
echo "1. Apri Xcode"
echo "2. File → New → Project"
echo "3. iOS → App"
echo "4. Configura come da istruzioni"
echo "5. Salva in: $PROJECT_DIR"
echo "6. Importa cartella WhatisExplorer/"
echo ""
echo "✅ Struttura preparata!"

