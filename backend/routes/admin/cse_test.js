/**
 * ✅ Google Custom Search Engine (CSE) Test Route
 * Rotta di test per verificare l'integrazione con Google Custom Search API
 * 
 * Endpoint: GET /admin/cse/test?q=query
 * 
 * Abilitata solo se ENABLE_CSE_TEST=true in .env
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * GET /admin/cse/test
 * 
 * Esegue una ricerca su Google Custom Search Engine
 * 
 * Query parameters:
 *   - q: query di ricerca (obbligatorio)
 * 
 * Returns:
 *   - 400: Missing query parameter 'q'
 *   - 500: Missing GOOGLE_API_KEY or GOOGLE_CX in .env
 *   - 200: JSON con array di risultati { title, link, snippet }
 */
router.get('/cse/test', async (req, res) => {
    try {
        // Leggi variabili da .env
        const API_KEY = process.env.GOOGLE_API_KEY;
        const CX = process.env.GOOGLE_CX;
        
        // Verifica che le variabili siano presenti
        if (!API_KEY || !CX) {
            return res.status(500).json({ 
                error: "Missing GOOGLE_API_KEY or GOOGLE_CX in .env file",
                message: "Please configure GOOGLE_API_KEY and GOOGLE_CX in your .env file"
            });
        }
        
        // Verifica che il parametro query sia presente
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ 
                error: "Missing query parameter 'q'",
                message: "Usage: /admin/cse/test?q=your_search_query"
            });
        }
        
        // Costruisci URL per Google Custom Search API
        const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}`;
        
        // Esegui richiesta a Google Custom Search API
        const response = await axios.get(url);
        
        // Estrai risultati dalla risposta Google
        const items = response.data.items || [];
        
        // Formatta risultati in formato semplice { title, link, snippet }
        const results = items.map(item => ({
            title: item.title || '',
            link: item.link || '',
            snippet: item.snippet || ''
        }));
        
        // Restituisci JSON con risultati
        res.json({
            success: true,
            query: query,
            totalResults: response.data.searchInformation?.totalResults || 0,
            resultsCount: results.length,
            results: results
        });
        
    } catch (error) {
        console.error('❌ Google CSE Test Error:', error.message);
        
        // Gestisci errori specifici
        if (error.response) {
            // Errore dalla risposta Google API
            return res.status(error.response.status).json({
                error: "Google Custom Search API Error",
                message: error.response.data?.error?.message || error.message,
                status: error.response.status
            });
        } else if (error.request) {
            // Errore di rete
            return res.status(500).json({
                error: "Network Error",
                message: "Unable to reach Google Custom Search API"
            });
        } else {
            // Altro errore
            return res.status(500).json({
                error: "Internal Error",
                message: error.message
            });
        }
    }
});

module.exports = router;

