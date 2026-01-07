#!/bin/bash

# 🚀 Apertura Progetto Xcode - Whatis Explorer
# Script per aprire rapidamente il progetto in Xcode

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Whatis Explorer - Apertura Xcode${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Ottieni il percorso dello script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$SCRIPT_DIR"
PROJECT_FILE="$PROJECT_DIR/WhatisExplorer.xcodeproj"

echo -e "${BLUE}📁 Directory progetto:${NC} $PROJECT_DIR"
echo ""

# Verifica che la directory esista
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Errore: Directory progetto non trovata!${NC}"
    echo -e "${YELLOW}   Percorso cercato: $PROJECT_DIR${NC}"
    exit 1
fi

# Verifica che il file progetto esista
if [ ! -d "$PROJECT_FILE" ]; then
    echo -e "${RED}❌ Errore: File progetto Xcode non trovato!${NC}"
    echo -e "${YELLOW}   File cercato: $PROJECT_FILE${NC}"
    echo ""
    echo -e "${YELLOW}💡 Verifica che il progetto sia stato creato correttamente.${NC}"
    exit 1
fi

# Vai nella directory del progetto
cd "$PROJECT_DIR" || {
    echo -e "${RED}❌ Errore: Impossibile accedere alla directory progetto!${NC}"
    exit 1
}

echo -e "${GREEN}✅ Directory progetto trovata${NC}"
echo -e "${GREEN}✅ File progetto trovato${NC}"
echo ""

# Verifica che Xcode sia installato
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Errore: Xcode non trovato!${NC}"
    echo -e "${YELLOW}   Installa Xcode dal Mac App Store${NC}"
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1)
echo -e "${BLUE}📱 Xcode trovato:${NC} $XCODE_VERSION"
echo ""

# Apri il progetto in Xcode
echo -e "${BLUE}🚀 Apertura progetto in Xcode...${NC}"
open -a "Xcode" "$PROJECT_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Progetto aperto con successo in Xcode!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}💡 Prossimi passi:${NC}"
    echo "   1. Seleziona il tuo iPhone come destinazione"
    echo "   2. Build & Run (⌘R)"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Errore durante l'apertura del progetto${NC}"
    exit 1
fi

