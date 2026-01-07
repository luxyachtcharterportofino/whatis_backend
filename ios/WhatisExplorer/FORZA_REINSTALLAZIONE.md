# Forzare Reinstallazione App

Se l'app compila ma non si aggiorna sul telefono, segui questi passi:

## 1. In Xcode:
- **Product > Clean Build Folder** (⇧⌘K)
- Chiudi Xcode completamente

## 2. Sul telefono:
- Rimuovi manualmente l'app "Whatis Explorer" dal telefono (tieni premuto l'icona e seleziona "Rimuovi App")

## 3. Riapri Xcode e:
- Seleziona il dispositivo "iPhone di Andrea 11" come target
- **Product > Build** (⌘B) per verificare che compili
- **Product > Run** (⌘R) per reinstallare

## Alternativa - Da Terminale:
```bash
# Pulizia completa
cd /Users/andreastagnaro/Desktop/Whatis/whatis_backend/ios/WhatisExplorer
rm -rf ~/Library/Developer/Xcode/DerivedData/WhatisExplorer-*

# Poi riapri Xcode e ricompila
```

## Se ancora non funziona:
1. Verifica che il Bundle Identifier sia lo stesso (com.andaly.WhatisExplorer)
2. Controlla che il Team di firma sia corretto
3. Prova a cambiare il Bundle Version in Info.plist (es. da 12 a 13)

