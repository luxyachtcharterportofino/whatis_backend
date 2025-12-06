#!/usr/bin/env python3
"""
Semantic Engine Startup Script
===============================

Script di avvio semplificato per il microservizio Semantic Engine.
Verifica le dipendenze, configura l'ambiente e avvia il server FastAPI.

Uso:
    python start_semantic_engine.py

Oppure direttamente:
    python app.py

Autore: Semantic Engine Team
"""

import sys
import os
import subprocess
import time
from pathlib import Path

def print_banner():
    """Stampa banner di avvio"""
    banner = """
🧠═══════════════════════════════════════════════════════════════════
🌊                    SEMANTIC ENGINE                             🌊
🧠═══════════════════════════════════════════════════════════════════

🤖 Microservizio Python per ricerca semantica avanzata POI turistici
📍 Integrazione con whatis_backend Node.js
🌍 Wikipedia • Wikidata • OpenStreetMap • AI Enhancement

Porta: 5000
Endpoints: /semantic/search, /semantic/municipalities
Docs: http://localhost:5000/docs

🧠═══════════════════════════════════════════════════════════════════
"""
    print(banner)

def check_python_version():
    """Verifica versione Python"""
    if sys.version_info < (3, 8):
        print("❌ ERRORE: Python 3.8+ è richiesto")
        print(f"   Versione attuale: Python {sys.version}")
        sys.exit(1)
    
    print(f"✅ Python {sys.version.split()[0]} OK")

def check_requirements():
    """Verifica e installa dipendenze"""
    requirements_file = Path(__file__).parent / "requirements.txt"
    
    if not requirements_file.exists():
        print("❌ ERRORE: File requirements.txt non trovato")
        sys.exit(1)
    
    print("📦 Verifico dipendenze...")
    
    try:
        # Prova a importare le dipendenze principali
        import fastapi
        import uvicorn
        import requests
        import shapely
        import geopy
        import aiohttp
        print("✅ Dipendenze principali OK")
        return True
        
    except ImportError as e:
        print(f"⚠️  Dipendenza mancante: {e}")
        print("📦 Installazione automatica dipendenze...")
        
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
            ])
            print("✅ Dipendenze installate con successo")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"❌ ERRORE installazione dipendenze: {e}")
            print("\n💡 Prova manualmente:")
            print(f"   pip install -r {requirements_file}")
            return False

def check_directories():
    """Crea directory necessarie"""
    dirs_to_create = [
        "../logs",
        "../cache/semantic",
        "cache"
    ]
    
    for dir_path in dirs_to_create:
        full_path = Path(__file__).parent / dir_path
        full_path.mkdir(parents=True, exist_ok=True)
    
    print("✅ Directory configurate")

def check_backend_connection():
    """Verifica connessione al backend Node.js"""
    backend_urls = [
        "http://localhost:3000",
        "http://localhost:8080"
    ]
    
    print("🔗 Verifico connessione backend Node.js...")
    
    for url in backend_urls:
        try:
            import requests
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                print(f"✅ Backend Node.js trovato su {url}")
                return True
        except:
            continue
    
    print("⚠️  Backend Node.js non rilevato")
    print("   Il semantic engine funzionerà ugualmente")
    print("   Assicurati che il backend Node.js sia in esecuzione per l'integrazione completa")
    return False

def start_server():
    """Avvia il server FastAPI"""
    print("\n🚀 Avvio Semantic Engine...")
    print("📍 Porta: 5000")  # ✅ FIX MarineDeep: Porta uniformata a 5000
    print("📚 Documentazione: http://localhost:5000/docs")
    print("🔍 Health Check: http://localhost:5000/health")
    print("\n💡 Premi Ctrl+C per fermare il servizio\n")
    
    # Breve pausa per permettere di leggere i messaggi
    time.sleep(2)
    
    try:
        # Importa e avvia app
        from app import app
        import uvicorn
        
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=5000,  # ✅ FIX MarineDeep: Porta uniformata a 5000
            log_level="info",
            reload=False  # Disabilita reload in produzione
        )
        
    except KeyboardInterrupt:
        print("\n\n🛑 Semantic Engine fermato dall'utente")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ ERRORE durante avvio server: {e}")
        sys.exit(1)

def main():
    """Funzione principale"""
    
    print_banner()
    
    # Verifica ambiente
    check_python_version()
    
    # Configura environment
    check_directories()
    
    # Verifica dipendenze
    if not check_requirements():
        sys.exit(1)
    
    # Check backend (opzionale)
    check_backend_connection()
    
    # Avvia server
    start_server()

if __name__ == "__main__":
    main()
