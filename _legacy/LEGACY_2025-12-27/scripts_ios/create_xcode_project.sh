#!/bin/bash
# Script per creare il progetto Xcode WhatisExplorer

set -e

PROJECT_NAME="WhatisExplorer"
BUNDLE_ID="com.andaly.WhatisExplorer"
PROJECT_DIR="$HOME/Desktop/WhatisExplorer"
XCODE_PROJECT_DIR="$PROJECT_DIR/$PROJECT_NAME.xcodeproj"

echo "🚀 Creazione progetto Xcode: $PROJECT_NAME"

# Verifica che siamo nella directory corretta
cd "$PROJECT_DIR"

# Crea la struttura del progetto Xcode
mkdir -p "$XCODE_PROJECT_DIR/project.xcworkspace"
mkdir -p "$XCODE_PROJECT_DIR/xcshareddata/xcschemes"

echo "✅ Struttura directory creata"

# Crea il file project.pbxproj
# Nota: Questo è un file complesso, useremo un template base
cat > "$XCODE_PROJECT_DIR/project.pbxproj" << 'PROJECT_EOF'
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {
/* Begin PBXBuildFile section */
/* End PBXBuildFile section */
/* Begin PBXFileReference section */
/* End PBXFileReference section */
/* Begin PBXGroup section */
/* End PBXGroup section */
/* Begin PBXNativeTarget section */
/* End PBXNativeTarget section */
/* Begin PBXProject section */
/* End PBXProject section */
/* Begin XCBuildConfiguration section */
/* End XCBuildConfiguration section */
/* Begin XCConfigurationList section */
/* End XCConfigurationList section */
	};
	rootObject = /* Project object */;
}
PROJECT_EOF

echo "⚠️  NOTA: Il file project.pbxproj è stato creato come template."
echo "📝 Devi aprire Xcode e creare il progetto manualmente, oppure"
echo "   usa questo script come guida per configurare Xcode."

echo ""
echo "✅ Script completato!"
echo ""
echo "📋 Prossimi passi:"
echo "1. Apri Xcode"
echo "2. File → New → Project"
echo "3. iOS → App"
echo "4. Configura:"
echo "   - Product Name: $PROJECT_NAME"
echo "   - Bundle Identifier: $BUNDLE_ID"
echo "   - Interface: SwiftUI"
echo "   - Language: Swift"
echo "   - Minimum: iOS 15.0"
echo "5. Salva nella cartella: $PROJECT_DIR"
echo "6. Poi importa tutti i file dalla cartella WhatisExplorer/"

PROJECT_EOF

