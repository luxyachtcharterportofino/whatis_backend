// Carica variabili d'ambiente PRIMA di qualsiasi altro import
// Supporta sia sviluppo locale (.env) che produzione (variabili d'ambiente)
const path = require("path");

// ✅ RENDER: Su Render, le variabili d'ambiente sono già disponibili
// Carica .env solo se esiste (sviluppo locale)
const dotenvPath = path.join(__dirname, "..", ".env");
const fs = require("fs");
if (fs.existsSync(dotenvPath)) {
  require("dotenv").config({ path: dotenvPath });
  console.log("📁 Caricato .env da:", dotenvPath);
} else {
  console.log("ℹ️ File .env non trovato, uso variabili d'ambiente del sistema");
}

// Verifica che MONGO_URI sia caricato (supporta anche MONGODB_URI)
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error(`❌ ERRORE: MONGO_URI o MONGODB_URI non trovato`);
  if (fs.existsSync(dotenvPath)) {
    console.error(`   Percorso cercato: ${dotenvPath}`);
    console.error(`   Verifica che il file .env contenga MONGO_URI=... o MONGODB_URI=...`);
  } else {
    console.error(`   Su Render: Configura MONGO_URI nelle variabili d'ambiente del servizio`);
    console.error(`   Localmente: Crea un file .env con MONGO_URI=...`);
  }
  process.exit(1);
}

// ===============================
// 🌊 Andaly Whatis — Backend Server
// ===============================

const express = require("express");
const mongoose = require("mongoose");
// path già richiesto sopra per dotenv.config
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const cors = require("cors");
const { spawn } = require("child_process");

// Rotte
const adminRoutes = require("./routes/admin/main");  // Modular admin routes
const zonesRoutes = require("./routes/zones");
const poisRoutes = require("./routes/pois");
const translationsRoutes = require("./routes/translations");
const mobileRoutes = require("./routes/mobile");  // Mobile app routes

// Inizializza Express
const app = express();

// Connessione MongoDB con configurazione SSL robusta
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // 30 secondi timeout
    socketTimeoutMS: 45000, // 45 secondi socket timeout
    maxPoolSize: 10, // Limita pool connessioni
    retryWrites: true, // Riprova scritture fallite
    retryReads: true, // Riprova letture fallite
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false
  })
  .then(() => {
    console.log("✅ Connessione a MongoDB riuscita");
    
    // Imposta EJS
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    // Middleware
    // ✅ CORS per app mobile iOS
    app.use(cors({
      origin: '*', // Permetti tutte le origini per l'app mobile
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: false
    }));
    app.use(express.static(path.join(__dirname, "public")));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(methodOverride("_method"));

    // Rotta predefinita
    app.get("/", (req, res) => res.redirect("/admin/dashboard"));

    // Rotte principali
    app.use("/admin", adminRoutes);
    app.use("/zones", zonesRoutes);
    app.use("/pois", poisRoutes);
    app.use("/translations", translationsRoutes);
    // Alias admin namespace for diagnostics/APIs used by the translations page
    app.use("/admin/translations", translationsRoutes);
    app.use("/mobile", mobileRoutes);  // Mobile app API
    // API routes per app iOS (WhatisExplorer)
    app.use("/api/zones", zonesRoutes);  // GET /api/zones?format=json
    app.use("/api/pois", poisRoutes);    // GET /api/pois?zone={zoneId}&format=json

    // ✅ Google Custom Search Engine Test Route (solo se abilitato)
    if (process.env.ENABLE_CSE_TEST === "true") {
      const cseTestRoutes = require("./routes/admin/cse_test");
      app.use("/admin", cseTestRoutes);
      console.log("✅ Google CSE test route enabled at /admin/cse/test");
    }



    // ⚠️ Perplexity Search Module Routes - DEPRECATED
    // Mantenute solo per backward compatibility, tutte le route redirectano
    const perplexityRoutes = require("./routes/admin/perplexity");
    app.use("/admin/perplexity", perplexityRoutes);
    console.log("ℹ️  Perplexity routes deprecated - redirect to /admin/zones");

    // 🔍 POI Discovery Routes
    const poiDiscoveryRoutes = require("./routes/admin/poi_discovery");
    app.use("/admin/pois", poiDiscoveryRoutes);
    console.log("✅ POI Discovery routes enabled at /admin/pois/discover");

    // 🔍 Debug GPT Routes (solo se DEBUG_GPT=true o in sviluppo)
    if (process.env.DEBUG_GPT === 'true' || process.env.NODE_ENV !== 'production') {
      const debugGptRoutes = require("./routes/admin/debug-gpt");
      app.use("/admin/debug-gpt", debugGptRoutes);
      console.log("✅ Debug GPT routes enabled at /admin/debug-gpt/*");
    }

    // ===============================
    // 🧠 Python Semantic Engine Autostart (FastAPI)
    // ===============================
    // ✅ RENDER: Python engine è opzionale su Render (può essere un servizio separato)
    const pythonEngineEnabled = process.env.PYTHON_SEMANTIC_ENGINE_ENABLED !== "false" && 
                                 process.env.NODE_ENV !== "production";
    let pythonProc = null;
    
       if (false) {  // Python disabilitato su Railway
      try {
        const pyCwd = path.join(__dirname, "semantic_engine");
        // Avvia uvicorn direttamente per forzare la porta 5000
        pythonProc = spawn("python3", ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "5000"], {
          cwd: pyCwd,
          stdio: "inherit",
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });
        console.log("🧠 Avvio Semantic Engine Python su http://127.0.0.1:5000 ...");
        pythonProc.on("exit", (code, signal) => {
          console.log(`🧠 Semantic Engine Python terminato (code=${code}, signal=${signal})`);
        });
        process.on("exit", () => {
          if (pythonProc && !pythonProc.killed) {
            try { pythonProc.kill(); } catch (_) {}
          }
        });
        process.on("SIGINT", () => process.exit(0));
        process.on("SIGTERM", () => process.exit(0));
      } catch (e) {
        console.warn("⚠️ Impossibile avviare il Semantic Engine Python:", e.message);
        console.log("ℹ️ Il backend continuerà a funzionare senza il semantic engine Python");
      }
    } else {
      console.log("ℹ️ Python Semantic Engine disabilitato (configurato per produzione/Render)");
    }

    // ===============================
    // 🔁 Express Proxy → Python (port 5000)
    // ===============================
    
    // Helper function per health check con retry
    async function waitForPythonHealth(maxRetries = 6, delayMs = 500) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const r = await fetch("http://127.0.0.1:5000/health", { 
            cache: "no-store"
          });
          if (r.ok) {
            const data = await r.json();
            return { success: true, data };
          }
          throw new Error(`Python health ${r.status}`);
        } catch (err) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          throw err;
        }
      }
    }
    
    app.get("/ai-search", async (req, res) => {
      try {
        const result = await waitForPythonHealth();
        return res.json({ success: true, available: true, python: result.data });
      } catch (err) {
        // Solo log info, non warning, dopo retry completati
        console.log(`ℹ️ Python Semantic Engine non disponibile dopo retry: ${err.message}`);
        return res.status(503).json({ success: false, available: false, error: "Python service unavailable" });
      }
    });

    app.post("/ai-search", async (req, res) => {
      try {
        // Se riceviamo un payload compatibile con /semantic/search lo inoltriamo, altrimenti facciamo ping
        const body = req.body || {};
        const url = "http://127.0.0.1:5000/semantic/search";
        const pyRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!pyRes.ok) {
          const txt = await pyRes.text();
          throw new Error(`Python error ${pyRes.status}: ${txt}`);
        }
        const result = await pyRes.json();
        // Rispondi con un wrapper semplificato per retrocompatibilità fallback
        return res.json({ success: true, available: true, results: result });
      } catch (err) {
        console.error("❌ Proxy /ai-search error:", err.message);
        return res.status(502).json({ success: false, available: false, error: err.message });
      }
    });

    // ✅ FIX HealthCheck: Route /health per watchdog
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok", service: "whatis_backend", timestamp: new Date().toISOString() });
    });

    // Avvio server solo dopo la connessione a MongoDB
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🟢 Server avviato su http://localhost:${PORT}`);
      console.log(`🌐 Server raggiungibile dalla rete locale su http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Errore connessione MongoDB:", err);
    console.error("⚠️ Il server NON verrà avviato senza connessione al database");
    process.exit(1);
  });
