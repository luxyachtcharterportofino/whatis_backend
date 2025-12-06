#!/usr/bin/env python3
"""
Script per generare automaticamente il progetto Xcode WhatisExplorerLite
"""

import os
import json
import uuid
from pathlib import Path

PROJECT_NAME = "WhatisExplorerLite"
BUNDLE_ID = "com.andaly.WhatisExplorerLite"
BASE_DIR = Path.home() / "Desktop" / "WhatisExplorer_Lite"
SOURCE_DIR = BASE_DIR / "WhatisExplorerLite"

def generate_uuid():
    """Genera un UUID per Xcode"""
    return str(uuid.uuid4()).upper().replace('-', '')

def get_file_ref_uuid(file_path):
    """Genera UUID per file reference"""
    return generate_uuid()

print(f"🚀 Generazione progetto Xcode: {PROJECT_NAME}")
print(f"📁 Directory base: {BASE_DIR}")

# Verifica che la directory sorgente esista
if not SOURCE_DIR.exists():
    print(f"❌ Errore: Directory {SOURCE_DIR} non trovata!")
    exit(1)

# Crea struttura progetto
project_dir = BASE_DIR / f"{PROJECT_NAME}.xcodeproj"
project_dir.mkdir(exist_ok=True)

workspace_dir = project_dir / "project.xcworkspace"
workspace_dir.mkdir(exist_ok=True)

schemes_dir = project_dir / "xcshareddata" / "xcschemes"
schemes_dir.mkdir(parents=True, exist_ok=True)

print("✅ Struttura directory creata")

# Trova tutti i file Swift
swift_files = list(SOURCE_DIR.rglob("*.swift"))
print(f"📄 Trovati {len(swift_files)} file Swift")

# Crea workspace contents
workspace_contents = {
    "FileRef": {
        "location": "self:"
    },
    "Project": {
        "Name": PROJECT_NAME,
        "Path": f"{PROJECT_NAME}.xcodeproj",
        "SourceTree": "<group>"
    },
    "Product": {
        "Name": PROJECT_NAME,
        "Path": f"{PROJECT_NAME}.xcodeproj",
        "SourceTree": "BUILT_PRODUCTS_DIR"
    }
}

with open(workspace_dir / "contents.xcworkspacedata", "w") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write('<Workspace version="1.0">\n')
    f.write(f'   <FileRef location="self:{PROJECT_NAME}.xcodeproj"></FileRef>\n')
    f.write('</Workspace>\n')

print("✅ Workspace creato")

# Crea scheme
scheme_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "1500" version = "1.7">
   <BuildAction>
      <BuildActionEntries>
         <BuildActionEntry buildForTesting = "YES" buildForRunning = "YES" buildForProfiling = "YES" buildForArchiving = "YES" buildForAnalyzing = "YES">
            <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "PRIMARY" BuildableName = "{PROJECT_NAME}.app" BlueprintName = "{PROJECT_NAME}" ReferencedContainer = "container:{PROJECT_NAME}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction>
   </TestAction>
   <LaunchAction>
      <BuildableProductRunnable>
         <BuildableReference BuildableIdentifier = "primary" BlueprintIdentifier = "PRIMARY" BuildableName = "{PROJECT_NAME}.app" BlueprintName = "{PROJECT_NAME}" ReferencedContainer = "container:{PROJECT_NAME}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction>
   </ProfileAction>
   <AnalyzeAction>
   </AnalyzeAction>
   <ArchiveAction>
   </ArchiveAction>
</Scheme>
'''

with open(schemes_dir / f"{PROJECT_NAME}.xcscheme", "w") as f:
    f.write(scheme_content)

print("✅ Scheme creato")

print("\n⚠️  NOTA IMPORTANTE:")
print("Il file project.pbxproj è troppo complesso per essere generato automaticamente.")
print("Devi creare il progetto manualmente in Xcode seguendo questi passi:\n")
print("1. Apri Xcode")
print("2. File → New → Project")
print("3. iOS → App")
print(f"4. Product Name: {PROJECT_NAME}")
print(f"5. Bundle Identifier: {BUNDLE_ID}")
print("6. Interface: SwiftUI")
print("7. Language: Swift")
print("8. Minimum: iOS 15.0")
print(f"9. Salva in: {BASE_DIR}")
print("\n10. Poi importa tutti i file dalla cartella WhatisExplorerLite/")
print("\n✅ Struttura base creata! Procedi con Xcode.")

