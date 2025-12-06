#!/bin/bash

# 🚀 Deploy Whatis Backend su Railway usando CLI (senza GitHub)

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Deploy Whatis Backend su Railway (CLI)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verifica Railway CLI
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}⚠️  Railway CLI non installato${NC}"
    echo ""
    echo "Installa Railway CLI:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Oppure con Homebrew:"
    echo "  brew install railway"
    echo ""
    read -p "Vuoi che installi Railway CLI ora? (s/N): " install
    if [[ "$install" =~ ^[sS]$ ]]; then
        if command -v npm &> /dev/null; then
            npm install -g @railway/cli
        elif command -v brew &> /dev/null; then
            brew install railway
        else
            echo -e "${RED}❌ npm o brew non trovati. Installa manualmente.${NC}"
            exit 1
        fi
    else
        exit 1
    fi
fi

echo -e "${GREEN}✅ Railway CLI trovato${NC}"
echo ""

# Verifica che siamo nella directory corretta
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Errore: server.js non trovato${NC}"
    echo "   Esegui questo script dalla directory whatis_backend"
    exit 1
fi

# Login Railway
echo -e "${BLUE}🔐 Login su Railway...${NC}"
railway login

# Crea nuovo progetto
echo ""
echo -e "${BLUE}📦 Creazione progetto Railway...${NC}"
railway init

# Aggiungi variabile d'ambiente MONGO_URI
echo ""
echo -e "${BLUE}🔧 Configurazione variabili d'ambiente...${NC}"
if [ -f ".env" ]; then
    MONGO_URI=$(grep "^MONGO_URI=" .env | cut -d '=' -f2-)
    if [ -n "$MONGO_URI" ]; then
        railway variables set MONGO_URI="$MONGO_URI"
        echo -e "${GREEN}✅ MONGO_URI configurato${NC}"
    else
        echo -e "${YELLOW}⚠️  MONGO_URI non trovato in .env${NC}"
        read -p "Inserisci MONGO_URI manualmente: " mongo_uri
        railway variables set MONGO_URI="$mongo_uri"
    fi
else
    echo -e "${YELLOW}⚠️  File .env non trovato${NC}"
    read -p "Inserisci MONGO_URI: " mongo_uri
    railway variables set MONGO_URI="$mongo_uri"
fi

# Deploy
echo ""
echo -e "${BLUE}🚀 Deploy in corso...${NC}"
railway up

# Ottieni URL
echo ""
echo -e "${BLUE}🌐 Ottenimento URL...${NC}"
RAILWAY_URL=$(railway domain 2>/dev/null || railway status | grep -o 'https://[^ ]*' | head -1)

if [ -n "$RAILWAY_URL" ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Deploy completato!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}🌐 URL del backend:${NC} $RAILWAY_URL"
    echo ""
    echo "📱 Prossimo passo: Aggiorna l'URL nell'app iOS"
    echo "   1. Apri: WhatisExplorer_Lite/WhatisExplorerLite/Services/APIService.swift"
    echo "   2. Sostituisci cloudURL con: $RAILWAY_URL"
    echo "   3. Compila l'app"
    echo ""
else
    echo ""
    echo -e "${YELLOW}⚠️  URL non ottenuto automaticamente${NC}"
    echo "   Controlla su https://railway.app per ottenere l'URL"
    echo ""
fi

