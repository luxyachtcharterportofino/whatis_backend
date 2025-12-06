#!/bin/bash

# 🔧 Script per configurare variabili d'ambiente su Railway

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 Configurazione variabili d'ambiente su Railway${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verifica che Railway CLI sia installato
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI non installato${NC}"
    exit 1
fi

# Verifica che il file .env esista
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ File .env non trovato${NC}"
    exit 1
fi

# Verifica che ci sia un servizio collegato
SERVICE_STATUS=$(railway status 2>&1 | grep "Service:" || echo "")
if [[ "$SERVICE_STATUS" == *"None"* ]]; then
    echo -e "${YELLOW}⚠️  Nessun servizio collegato${NC}"
    echo "   Collega un servizio con: railway service link [SERVICE_ID]"
    exit 1
fi

echo -e "${GREEN}✅ Servizio collegato${NC}"
echo ""

# Variabili essenziali da configurare
ESSENTIAL_VARS=(
    "MONGO_URI"
    "OPENAI_API_KEY"
)

# Variabili opzionali
OPTIONAL_VARS=(
    "GOOGLE_API_KEY"
    "GOOGLE_CX"
    "OPENAI_MODEL"
    "DEEPL_API_KEY"
    "PERPLEXITY_API_KEY"
    "PERPLEXITY_ENABLED"
    "CSE_MAX_RESULTS"
    "CSE_TIMEOUT_MS"
    "ENABLE_CSE_DIVE_WRECK"
    "ENABLE_UNIVERSAL_WRECK_SEARCH"
    "NODE_ENV"
)

echo -e "${BLUE}📝 Configurazione variabili essenziali...${NC}"
for var in "${ESSENTIAL_VARS[@]}"; do
    value=$(grep "^${var}=" .env | cut -d'=' -f2- | sed 's/^"//;s/"$//')
    if [ -n "$value" ]; then
        echo -e "   ${BLUE}→${NC} Configurando ${var}..."
        railway variables --set "${var}=${value}" 2>&1 | grep -v "Setting" || true
        echo -e "   ${GREEN}✅${NC} ${var} configurato"
    else
        echo -e "   ${YELLOW}⚠️${NC} ${var} non trovato in .env"
    fi
done

echo ""
echo -e "${BLUE}📝 Configurazione variabili opzionali...${NC}"
for var in "${OPTIONAL_VARS[@]}"; do
    value=$(grep "^${var}=" .env | cut -d'=' -f2- | sed 's/^"//;s/"$//')
    if [ -n "$value" ]; then
        echo -e "   ${BLUE}→${NC} Configurando ${var}..."
        railway variables --set "${var}=${value}" 2>&1 | grep -v "Setting" || true
        echo -e "   ${GREEN}✅${NC} ${var} configurato"
    fi
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Variabili d'ambiente configurate!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Prossimi passi:${NC}"
echo "   1. Verifica le variabili: railway variables"
echo "   2. Fai il deploy: railway up"
echo "   3. Ottieni l'URL: railway domain"
echo ""

