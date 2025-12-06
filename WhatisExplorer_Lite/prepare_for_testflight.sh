#!/bin/bash

# 🚀 Script Helper per Preparare App per TestFlight
# Questo script verifica la configurazione e prepara l'app per l'upload su TestFlight

set -e

echo "🚀 Preparazione Whatis Explorer Lite per TestFlight"
echo "=================================================="
echo ""

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verifica che siamo nella directory corretta
if [ ! -f "WhatisExplorerLite.xcodeproj/project.pbxproj" ]; then
    echo -e "${RED}❌ Errore: Esegui questo script dalla directory WhatisExplorer_Lite${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Directory corretta${NC}"
echo ""

# Verifica Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Xcode non trovato. Installa Xcode dal Mac App Store.${NC}"
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1)
echo -e "${GREEN}✅ Xcode trovato: $XCODE_VERSION${NC}"
echo ""

# Verifica progetto
echo "📋 Verifica configurazione progetto..."
echo ""

# Verifica Bundle ID
BUNDLE_ID=$(grep -A 1 "PRODUCT_BUNDLE_IDENTIFIER" WhatisExplorerLite.xcodeproj/project.pbxproj | grep -o 'com\.andaly\.WhatisExplorerLite' | head -n 1)

if [ -z "$BUNDLE_ID" ]; then
    echo -e "${YELLOW}⚠️  Bundle ID non trovato nel progetto${NC}"
else
    echo -e "${GREEN}✅ Bundle ID: $BUNDLE_ID${NC}"
fi

# Verifica versione
VERSION=$(grep -A 1 "CFBundleShortVersionString" WhatisExplorerLite/Info.plist | grep -o '[0-9]\+\.[0-9]\+' | head -n 1)
BUILD=$(grep -A 1 "CFBundleVersion" WhatisExplorerLite/Info.plist | grep -o '[0-9]\+' | head -n 1)

if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}⚠️  Versione non trovata${NC}"
else
    echo -e "${GREEN}✅ Versione: $VERSION${NC}"
fi

if [ -z "$BUILD" ]; then
    echo -e "${YELLOW}⚠️  Build number non trovato${NC}"
else
    echo -e "${GREEN}✅ Build: $BUILD${NC}"
fi

echo ""
echo "=================================================="
echo "📝 Checklist Pre-Upload:"
echo "=================================================="
echo ""
echo "Prima di creare l'Archive, verifica:"
echo ""
echo "1. ✅ Bundle ID: com.andaly.WhatisExplorerLite"
echo "2. ✅ Team selezionato in Xcode → Signing & Capabilities"
echo "3. ✅ Version: $VERSION"
echo "4. ✅ Build: $BUILD"
echo "5. ✅ App compila senza errori"
echo ""
echo "=================================================="
echo "🎯 Prossimi Passi:"
echo "=================================================="
echo ""
echo "1. Apri Xcode:"
echo "   open WhatisExplorerLite.xcodeproj"
echo ""
echo "2. Seleziona 'Any iOS Device' come destinazione"
echo ""
echo "3. Crea Archive:"
echo "   Product → Archive (⌘B poi Product → Archive)"
echo ""
echo "4. Distribuisci:"
echo "   Window → Organizer → Distribute App"
echo ""
echo "5. Segui la guida completa:"
echo "   Vedi TESTFLIGHT_SETUP.md"
echo ""
echo -e "${GREEN}✅ Preparazione completata!${NC}"
echo ""

# Chiedi se vuoi aprire Xcode
read -p "Vuoi aprire Xcode ora? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Apertura Xcode..."
    open WhatisExplorerLite.xcodeproj
fi

