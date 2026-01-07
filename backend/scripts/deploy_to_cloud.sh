#!/bin/bash

# 🚀 Script di Deploy Whatis Backend su Cloud
# Supporta: Railway, Render, Heroku

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Deploy Whatis Backend su Cloud${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verifica che siamo nella directory corretta
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Errore: server.js non trovato${NC}"
    echo "   Esegui questo script dalla directory whatis_backend"
    exit 1
fi

# Verifica che .env esista
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  File .env non trovato${NC}"
    echo "   Assicurati di avere MONGO_URI configurato"
    read -p "   Continuare comunque? (s/N): " continue
    if [[ ! "$continue" =~ ^[sS]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ File di configurazione trovati${NC}"
echo ""

# Menu di selezione
echo "Scegli la piattaforma di deploy:"
echo "1) Railway (Consigliato - Gratuito)"
echo "2) Render (Gratuito)"
echo "3) Heroku (A pagamento dopo free tier)"
echo ""
read -p "Scelta (1-3): " choice

case $choice in
    1)
        echo ""
        echo -e "${BLUE}📦 Deploy su Railway...${NC}"
        echo ""
        echo "Passi da seguire:"
        echo "1. Vai su https://railway.app e crea un account"
        echo "2. Clicca 'New Project' → 'Deploy from GitHub repo'"
        echo "3. Seleziona il repository 'whatis_backend'"
        echo "4. Railway rileva automaticamente Node.js"
        echo "5. Aggiungi variabile d'ambiente:"
        echo "   - Nome: MONGO_URI"
        echo "   - Valore: (copia da .env)"
        echo ""
        echo "Railway ti darà un URL tipo:"
        echo "https://whatis-backend-production.up.railway.app"
        echo ""
        read -p "Premi Invio quando hai completato il deploy..."
        ;;
    2)
        echo ""
        echo -e "${BLUE}📦 Deploy su Render...${NC}"
        echo ""
        echo "Passi da seguire:"
        echo "1. Vai su https://render.com e crea un account"
        echo "2. Clicca 'New' → 'Web Service'"
        echo "3. Connetti il repository GitHub 'whatis_backend'"
        echo "4. Imposta:"
        echo "   - Build Command: npm install"
        echo "   - Start Command: node server.js"
        echo "5. Aggiungi Environment Variable:"
        echo "   - MONGO_URI: (copia da .env)"
        echo ""
        echo "Render ti darà un URL tipo:"
        echo "https://whatis-backend.onrender.com"
        echo ""
        read -p "Premi Invio quando hai completato il deploy..."
        ;;
    3)
        echo ""
        echo -e "${BLUE}📦 Deploy su Heroku...${NC}"
        echo ""
        if ! command -v heroku &> /dev/null; then
            echo -e "${YELLOW}⚠️  Heroku CLI non installato${NC}"
            echo "   Installa con: brew install heroku/brew/heroku"
            exit 1
        fi
        
        echo "Eseguendo deploy su Heroku..."
        heroku login
        heroku create whatis-backend || echo "App già esistente"
        heroku config:set MONGO_URI="$(grep MONGO_URI .env | cut -d '=' -f2-)" || echo "MONGO_URI già configurato"
        git push heroku main || git push heroku master
        heroku open
        ;;
    *)
        echo -e "${RED}❌ Scelta non valida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Deploy completato!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📱 Prossimo passo: Aggiorna l'URL nell'app iOS"
echo "   1. Apri: WhatisExplorer_Lite/WhatisExplorerLite/Services/APIService.swift"
echo "   2. Sostituisci cloudURL con il tuo URL"
echo "   3. Compila l'app"
echo ""

