#!/bin/bash
# 🧪 Test automatico per la modalità enhanced del motore semantico
# Utilizzo: ./scripts/test_enhanced_mode.sh "Nome Zona"

ZONE_NAME=${1:-"Tigullio nuova"}

curl -X POST http://localhost:3000/admin/semantic/search \
  -H "Content-Type: application/json" \
  -d "{\"zone\":\"$ZONE_NAME\",\"mode\":\"enhanced\"}"


