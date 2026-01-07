#!/bin/bash
# 🚀 Backup automatico incrementale per Andaly Whatis Backend

cd ~/Desktop/Whatis/whatis_backend || exit

# Data odierna
DATA=$(date +"%Y-%m-%d_%H-%M")

# Nome del branch e del tag
BRANCH="main"
TAG="backup_$DATA"

# Aggiunge, salva e tagga automaticamente
git add .
git commit -m "🧭 Backup automatico $DATA"
git tag -a "$TAG" -m "Backup giornaliero del $DATA"

# Mostra messaggio di conferma
echo "✅ Backup creato con tag: $TAG"
