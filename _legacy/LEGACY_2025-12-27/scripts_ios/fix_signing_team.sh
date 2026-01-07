#!/bin/bash

# Risolve il problema del Development Team mancante

set -e

PROJECT_FILE="WhatisExplorer.xcodeproj/project.pbxproj"
INFO_PLIST="WhatisExplorer/Info.plist"

echo "🔐 Fix Development Team"
echo "======================"
echo ""

# 1. Trova il team disponibile
echo "1️⃣  Cerca team disponibile..."
TEAM_ID=$(security find-identity -v -p codesigning 2>/dev/null | grep "Apple Development" | head -1 | sed -n 's/.*"\([^"]*\)".*/\1/p' || echo "")

if [ -z "$TEAM_ID" ]; then
    echo "   ⚠️  Nessun certificato Apple Development trovato"
    echo "   💡 Verifica in Xcode: Preferences → Accounts"
    echo ""
    echo "   Procedura:"
    echo "   1. Xcode → Preferences (⌘,) → Accounts"
    echo "   2. Se non c'è un account Apple ID, aggiungilo"
    echo "   3. Seleziona l'account → Download Manual Profiles"
    echo "   4. Attendi che finisca"
    echo ""
    echo "   Poi esegui questo script di nuovo"
    exit 1
fi

echo "   ✅ Certificato trovato"
echo ""

# 2. Verifica team nel progetto
echo "2️⃣  Verifica configurazione progetto..."
CURRENT_TEAM=$(grep -A 5 "DEVELOPMENT_TEAM" "$PROJECT_FILE" | grep -v "^//" | head -1 | sed -n 's/.*DEVELOPMENT_TEAM = \([^;]*\);.*/\1/p' || echo "")

if [ -n "$CURRENT_TEAM" ] && [ "$CURRENT_TEAM" != "" ]; then
    echo "   ✅ Team già configurato: $CURRENT_TEAM"
    echo "   💡 Se il problema persiste, verifica in Xcode:"
    echo "      Progetto → Target → Signing & Capabilities"
    echo "      → 'Automatically manage signing' deve essere selezionato"
    echo "      → Team deve essere selezionato"
    exit 0
fi

echo "   ⚠️  Team non configurato nel progetto"
echo ""

# 3. Trova il Team ID dall'account Apple
echo "3️⃣  Cerca Team ID..."
echo "   💡 Per trovare il Team ID:"
echo "      1. Xcode → Preferences (⌘,) → Accounts"
echo "      2. Seleziona il tuo account Apple ID"
echo "      3. Sotto 'Personal Team' vedrai un Team ID (es: ABC123DEF4)"
echo ""
read -p "   Inserisci il Team ID (o premi Invio per configurare manualmente): " USER_TEAM_ID

if [ -z "$USER_TEAM_ID" ]; then
    echo ""
    echo "   📋 Configurazione manuale in Xcode:"
    echo ""
    echo "   1. Apri Xcode"
    echo "   2. Progetto → Target → Signing & Capabilities"
    echo "   3. Seleziona 'Automatically manage signing'"
    echo "   4. Nel menu 'Team', seleziona il tuo team"
    echo "   5. Attendi 10-30 secondi che Xcode generi il profilo"
    echo "   6. Verifica che non ci siano errori rossi"
    echo "   7. Il pulsante Run dovrebbe diventare cliccabile"
    echo ""
    exit 0
fi

# 4. Aggiorna progetto con Team ID
echo ""
echo "4️⃣  Aggiorna progetto con Team ID: $USER_TEAM_ID"

# Backup
cp "$PROJECT_FILE" "$PROJECT_FILE.backup_team_$(date +%Y%m%d_%H%M%S)"

# Aggiorna DEVELOPMENT_TEAM
if grep -q "DEVELOPMENT_TEAM = " "$PROJECT_FILE"; then
    # Sostituisce il valore esistente
    sed -i '' "s/DEVELOPMENT_TEAM = [^;]*/DEVELOPMENT_TEAM = $USER_TEAM_ID/g" "$PROJECT_FILE"
else
    # Aggiunge DEVELOPMENT_TEAM se non esiste
    # Trova la sezione di build settings e aggiunge il team
    sed -i '' "/buildSettings = {/a\\
				DEVELOPMENT_TEAM = $USER_TEAM_ID;
" "$PROJECT_FILE"
fi

echo "   ✅ Progetto aggiornato"
echo ""

# 5. Incrementa build number
CURRENT_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "12")
NEW_BUILD=$((CURRENT_BUILD + 1))

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$INFO_PLIST"
sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/g" "$PROJECT_FILE"

echo "5️⃣  Build number incrementato: $CURRENT_BUILD → $NEW_BUILD"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configurazione completata!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PROSSIMI PASSI IN XCODE:"
echo ""
echo "1. 🔄 RICARICA IL PROGETTO:"
echo "   - Chiudi e riapri Xcode (⌘Q, poi riapri)"
echo ""
echo "2. ✅ VERIFICA SIGNING:"
echo "   - Progetto → Target → Signing & Capabilities"
echo "   - 'Automatically manage signing' deve essere selezionato"
echo "   - Team deve essere selezionato (dovrebbe essere già selezionato)"
echo "   - ATTENDI 10-30 secondi che Xcode generi il profilo"
echo "   - Verifica che non ci siano errori rossi"
echo ""
echo "3. ▶️  PROVA RUN:"
echo "   - Il pulsante Run dovrebbe essere cliccabile (non grigio)"
echo "   - Seleziona 'iPhone di Andrea 11'"
echo "   - Premi Run (⌘R)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

