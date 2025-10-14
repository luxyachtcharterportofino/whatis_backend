// ===============================
// 🌊 Andaly Whatis — Backend Server
// ===============================

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const methodOverride = require("method-override");

// Rotte
const adminRoutes = require("./routes/adminRoutes");
const zonesRoutes = require("./routes/zones");
const poisRoutes = require("./routes/pois");
const translationsRoutes = require("./routes/translations");

// Inizializza Express
const app = express();

// Configurazione dotenv
dotenv.config();

// Connessione MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connessione a MongoDB riuscita"))
  .catch((err) => console.error("❌ Errore connessione MongoDB:", err));

// Imposta EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
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

// Avvio server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server avviato su http://localhost:${PORT}`);
});