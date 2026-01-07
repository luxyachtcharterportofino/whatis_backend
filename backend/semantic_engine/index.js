// ======================================
// 🧠 Local Semantic Engine (Mock Module)
// ======================================

/**
 * Simula una ricerca semantica restituendo alcuni POI fittizi.
 * Manteniamo l'API minimale per integrazione rapida lato Express.
 * @param {string} query - Testo di ricerca/contesto
 * @param {string} zoneId - ID della zona selezionata
 * @returns {Promise<Array<{name:string, score:number, type:string}>>}
 */
async function semanticSearch(query, zoneId) {
  console.log("🧠 semanticSearch called with:", { query, zoneId });

  // Mock latency per simulare lavoro
  await new Promise((r) => setTimeout(r, 150));

  const base = (query || "").trim() || "POI";
  const suffix = zoneId ? ` (zone ${String(zoneId).slice(0, 6)})` : "";

  // Mock POIs
  const matches = [
    { name: `${base} Panorama${suffix}`, score: 0.92, type: "land" },
    { name: `${base} Faro${suffix}`, score: 0.88, type: "marine" },
    { name: `${base} Sentiero${suffix}`, score: 0.81, type: "land" },
  ];

  return matches;
}

module.exports = { semanticSearch };


