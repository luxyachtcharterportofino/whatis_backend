# 🎨 Setup Icona App - Whatis Explorer Lite

## Metodo 1: Automatico (Consigliato)

1. Apri Xcode
2. Seleziona `Assets.xcassets` nel navigator
3. Seleziona `AppIcon`
4. Trascina l'immagine `iOS_AppIcon_1024.png` (1024x1024) nello slot:
   - **App Store iOS 1024pt** (nella sezione iOS)
5. Xcode genererà automaticamente tutte le dimensioni necessarie

## Metodo 2: Script di Generazione

Se preferisci generare manualmente tutte le dimensioni, usa questo script:

```bash
#!/bin/bash
# generate_icons.sh
# Genera tutte le dimensioni dell'icona dall'immagine 1024x1024

INPUT="iOS_AppIcon_1024.png"
OUTPUT_DIR="AppIcon.appiconset"

# Crea la directory di output
mkdir -p "$OUTPUT_DIR"

# Dimensioni richieste per iOS (in punti)
# Formato: dimensione@scale.png

# iPhone Notification
sips -z 20 20 "$INPUT" --out "$OUTPUT_DIR/icon-20.png"
sips -z 40 40 "$INPUT" --out "$OUTPUT_DIR/icon-20@2x.png"
sips -z 60 60 "$INPUT" --out "$OUTPUT_DIR/icon-20@3x.png"

# iPhone Settings
sips -z 29 29 "$INPUT" --out "$OUTPUT_DIR/icon-29.png"
sips -z 58 58 "$INPUT" --out "$OUTPUT_DIR/icon-29@2x.png"
sips -z 87 87 "$INPUT" --out "$OUTPUT_DIR/icon-29@3x.png"

# iPhone Spotlight
sips -z 40 40 "$INPUT" --out "$OUTPUT_DIR/icon-40.png"
sips -z 80 80 "$INPUT" --out "$OUTPUT_DIR/icon-40@2x.png"
sips -z 120 120 "$INPUT" --out "$OUTPUT_DIR/icon-40@3x.png"

# iPhone App
sips -z 60 60 "$INPUT" --out "$OUTPUT_DIR/icon-60.png"
sips -z 120 120 "$INPUT" --out "$OUTPUT_DIR/icon-60@2x.png"
sips -z 180 180 "$INPUT" --out "$OUTPUT_DIR/icon-60@3x.png"

# iPad Notification
sips -z 20 20 "$INPUT" --out "$OUTPUT_DIR/icon-20.png"
sips -z 40 40 "$INPUT" --out "$OUTPUT_DIR/icon-20@2x.png"

# iPad Settings
sips -z 29 29 "$INPUT" --out "$OUTPUT_DIR/icon-29.png"
sips -z 58 58 "$INPUT" --out "$OUTPUT_DIR/icon-29@2x.png"

# iPad Spotlight
sips -z 40 40 "$INPUT" --out "$OUTPUT_DIR/icon-40.png"
sips -z 80 80 "$INPUT" --out "$OUTPUT_DIR/icon-40@2x.png"

# iPad App
sips -z 76 76 "$INPUT" --out "$OUTPUT_DIR/icon-76.png"
sips -z 152 152 "$INPUT" --out "$OUTPUT_DIR/icon-76@2x.png"
sips -z 167 167 "$INPUT" --out "$OUTPUT_DIR/icon-83.5@2x.png"

# App Store
sips -z 1024 1024 "$INPUT" --out "$OUTPUT_DIR/icon-1024.png"

echo "✅ Icone generate in $OUTPUT_DIR"
```

**Uso dello script:**
1. Salva lo script come `generate_icons.sh`
2. Mettilo nella stessa cartella dell'immagine `iOS_AppIcon_1024.png`
3. Esegui: `chmod +x generate_icons.sh && ./generate_icons.sh`
4. Aggiungi manualmente le immagini generate in Xcode

## Metodo 3: Usa un Tool Online

Puoi usare tool online come:
- [AppIcon.co](https://www.appicon.co/)
- [IconKitchen](https://icon.kitchen/)

1. Carica l'immagine 1024x1024
2. Scarica il set completo
3. Aggiungi le immagini in Xcode

## Verifica

Dopo aver aggiunto l'icona:
1. Pulisci il build: **Product → Clean Build Folder** (⇧⌘K)
2. Ricostruisci: **Product → Build** (⌘B)
3. Esegui l'app sul simulatore o dispositivo
4. L'icona dovrebbe apparire sulla home screen

## Note

- L'immagine deve essere **1024x1024 pixel**
- Formato consigliato: **PNG** (senza trasparenza per l'icona principale)
- L'icona sarà arrotondata automaticamente da iOS
- Non aggiungere bordi o ombre, iOS li gestisce automaticamente

