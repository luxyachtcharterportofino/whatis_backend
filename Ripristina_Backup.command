#!/bin/bash
# ⚓ Ripristina una versione precedente — Andaly Whatis Backend
# Versione 1.0 — Sicura e interattiva

cd ~/Desktop/whatis_backend || exit

LOG_DIR="./logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/ripristino.log"

echo ""
echo "🧭 === Sistema di Ripristino Andaly Whatis ==="
echo "---------------------------------------------"
echo "Puoi scegliere se ripristinare da:"
echo "1️⃣  Repository Git locale (commit/tag salvati)"
echo "2️⃣  Copia fisica su HD esterno"
echo "---------------------------------------------"
read -p "➡️  Digita 1 o 2 e premi Invio: " SCELTA

# Funzione notifica
notify() {
  osascript -e "display notification \"$2\" with title \"$1\""
}

if [ "$SCELTA" == "1" ]; then
  echo ""
  echo "🔍 Elenco versioni Git disponibili:"
  echo "---------------------------------------------"
  git tag --sort=-creatordate | nl -w2 -s'. '
  echo ""
  read -p "➡️  Digita il numero della versione da ripristinare: " NUM

  TAG=$(git tag --sort=-creatordate | sed -n "${NUM}p")
  if [ -z "$TAG" ]; then
    echo "❌ Nessuna versione corrispondente."
    exit 1
  fi

  echo ""
  echo "⚠️ ATTENZIONE: verranno sovrascritti i file locali con la versione $TAG."
  read -p "Confermi (s/N)? " CONF
  if [[ "$CONF" =~ ^[sS]$ ]]; then
    git checkout "$TAG"
    echo "✅ Ripristino completato da Git ($TAG)." | tee -a "$LOG_FILE"
    notify "✅ Ripristino completato" "Versione $TAG caricata con successo"
  else
    echo "❌ Operazione annullata."
  fi

elif [ "$SCELTA" == "2" ]; then
  HD_PATH="/Volumes/HD di Andrea/Backup_Whatis"
  if [ ! -d "$HD_PATH" ]; then
    echo "❌ HD non collegato. Collega il disco e riprova."
    notify "⚠️ Ripristino fallito" "HD non collegato"
    exit 1
  fi

  echo ""
  echo "🔍 Elenco copie su HD:"
  echo "---------------------------------------------"
  ls -1t "$HD_PATH" | nl -w2 -s'. '
  echo ""
  read -p "➡️  Digita il numero della copia da ripristinare: " NUM

  CARTELLA=$(ls -1t "$HD_PATH" | sed -n "${NUM}p")
  if [ -z "$CARTELLA" ]; then
    echo "❌ Nessuna copia trovata."
    exit 1
  fi

  echo ""
  echo "⚠️ ATTENZIONE: verranno sovrascritti i file attuali con quelli del backup."
  read -p "Confermi (s/N)? " CONF
  if [[ "$CONF" =~ ^[sS]$ ]]; then
    rsync -av --exclude '.git' --exclude 'node_modules' "$HD_PATH/$CARTELLA/" ./ >> "$LOG_FILE" 2>&1
    echo "✅ Ripristino completato da HD ($CARTELLA)." | tee -a "$LOG_FILE"
    notify "✅ Ripristino completato" "Copia $CARTELLA ripristinata"
  else
    echo "❌ Operazione annullata."
  fi
else
  echo "❌ Scelta non valida."
fi

echo ""
echo "📘 Log salvato in: $LOG_FILE"
