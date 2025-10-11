// ===============================
// 🌊 Andaly Whatis — Backend Server (v1.1)
// ===============================

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const methodOverride = require("method-override");

// === Rotte ===
const adminRoutes = require("./routes/adminRoutes");
const zonesRoutes = require("./routes/zones");
const poisRoutes = require("./routes/pois");

// === Inizializza Express ===
const app = express();

// === Configurazione dotenv ===
dotenv.config();

// === Connessione a MongoDB ===
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connessione a MongoDB riuscita"))
  .catch((err) => console.error("❌ Errore connessione MongoDB:", err));

// === Imposta EJS ===
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// === Middleware ===
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// === Rotte principali ===
// Tutto il backend amministrativo è sotto /admin
app.use("/admin", adminRoutes);

// Zone e POI passano sempre da /admin per coerenza con il frontend
app.use("/admin/zones", zonesRoutes);
app.use("/admin/pois", poisRoutes);

// === Rotta home ===
app.get("/", (req, res) => res.redirect("/admin/dashboard"));

// === Gestione errori 404 ===
app.use((req, res) => {
  res.status(404).send("❌ Pagina non trovata (404)");
});

// === Avvio server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server avviato su http://localhost:${PORT}`);
});