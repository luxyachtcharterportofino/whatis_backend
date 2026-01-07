/**
 * ✅ Google Custom Search Engine (CSE) Integration
 * 
 * Modulo isolato e reversibile per interrogare Google Custom Search API
 * in supporto alle ricerche semantiche di POI marini (diving center e relitti).
 * 
 * Feature flag: ENABLE_CSE_DIVE_WRECK=true
 * 
 * Credenziali richieste:
 *   - GOOGLE_API_KEY: Chiave API Google Cloud (formato AIzaSy...)
 *   - GOOGLE_CX: ID Custom Search Engine (formato 012345678901234567890:abcdefghij)
 * 
 * Variabili opzionali:
 *   - CSE_MAX_RESULTS: Numero massimo risultati (default: 3)
 *   - CSE_TIMEOUT_MS: Timeout richiesta in ms (default: 6000)
 */

const axios = require('axios');
const Logger = require('../utils/logger');

// Cache delle credenziali per evitare controlli ripetuti
let credentialsChecked = false;
let credentialsValid = false;
let missingCredentials = [];

/**
 * Verifica disponibilità delle credenziali Google CSE
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function checkCredentials() {
    if (credentialsChecked) {
        return { valid: credentialsValid, missing: missingCredentials };
    }
    
    const API_KEY = process.env.GOOGLE_API_KEY;
    const CX = process.env.GOOGLE_CX;
    
    const missing = [];
    
    if (!API_KEY || API_KEY.trim() === '') {
        missing.push('GOOGLE_API_KEY');
    }
    
    if (!CX || CX.trim() === '') {
        missing.push('GOOGLE_CX');
    }
    
    credentialsChecked = true;
    credentialsValid = missing.length === 0;
    missingCredentials = missing;
    
    // Stampa messaggi informativi se mancano credenziali
    if (missing.length > 0) {
        if (missing.includes('GOOGLE_API_KEY')) {
            console.log('⚠️ GOOGLE_API_KEY mancante. Andrea, puoi fornirmela? (formato: AIzaSy...)');
        }
        if (missing.includes('GOOGLE_CX')) {
            console.log('⚠️ GOOGLE_CX mancante. Andrea, puoi fornirmelo? (formato: 012345678901234567890:abcdefghij)');
        }
    }
    
    return { valid: credentialsValid, missing: missingCredentials };
}

/**
 * Cerca diving center e immersioni su relitti per una zona specifica o query personalizzata
 * 
 * @param {string} zone - Nome della zona O query personalizzata (es. "Portofino" o "relitti Lerici Italy")
 * @param {Object} opts - Opzioni aggiuntive
 * @param {number} opts.maxResults - Numero massimo risultati (default: da CSE_MAX_RESULTS o 3)
 * @param {number} opts.timeout - Timeout in ms (default: da CSE_TIMEOUT_MS o 6000)
 * @param {boolean} opts.useCustomQuery - Se true, usa 'zone' come query diretta (default: false)
 * @returns {Promise<Array>} Array di risultati { title, link, snippet } o [] se disabilitato/errore
 */
async function searchDiveWreckForZone(zone, opts = {}) {
    // ✅ Feature flag check
    if (process.env.ENABLE_CSE_DIVE_WRECK !== 'true') {
        Logger.log('CSE integration disabled', Logger.LEVELS.INFO);
        return [];
    }
    
    // ✅ Verifica credenziali
    const { valid, missing } = checkCredentials();
    if (!valid) {
        Logger.log(`CSE disabled: missing credentials (${missing.join(', ')})`, Logger.LEVELS.WARNING);
        return [];
    }
    
    // ✅ Validazione input
    if (!zone || typeof zone !== 'string' || zone.trim() === '') {
        Logger.log('CSE search: invalid zone parameter', Logger.LEVELS.WARNING);
        return [];
    }
    
    // ✅ Configurazione parametri
    const maxResults = Math.min(
        parseInt(opts.maxResults) || parseInt(process.env.CSE_MAX_RESULTS) || 3,
        3
    );
    const timeout = parseInt(opts.timeout) || parseInt(process.env.CSE_TIMEOUT_MS) || 6000;
    
    // ✅ FIX MarineWeb: Costruisci query (usa query personalizzata se useCustomQuery=true)
    let query;
    if (opts.useCustomQuery === true) {
        // ✅ FIX MarineWeb: Usa query diretta (es. "relitti Lerici Italy")
        query = zone.trim();
    } else {
        // ✅ FIX MarineWeb: Costruisci query automatica (compatibilità backward)
        query = `${zone.trim()} diving center immersioni relitti`;
    }
    const encodedQuery = encodeURIComponent(query);
    
    // ✅ Leggi credenziali
    const API_KEY = process.env.GOOGLE_API_KEY;
    const CX = process.env.GOOGLE_CX;
    
    // ✅ Costruisci URL API
    const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodedQuery}&num=${maxResults}`;
    
    try {
        // ✅ Esegui richiesta con timeout
        const response = await axios.get(url, {
            timeout: timeout,
            validateStatus: (status) => status < 500 // Non throw per 4xx, solo per 5xx
        });
        
        // ✅ Gestione risposte vuote
        if (!response.data || !response.data.items || response.data.items.length === 0) {
            Logger.log(`CSE search for "${zone}": no results found`, Logger.LEVELS.INFO);
            return [];
        }
        
        // ✅ Estrai e formatta risultati
        const results = response.data.items.slice(0, maxResults).map(item => ({
            title: item.title || '',
            link: item.link || '',
            snippet: item.snippet || ''
        }));
        
        Logger.log(`CSE search for "${zone}": found ${results.length} results`, Logger.LEVELS.INFO);
        return results;
        
    } catch (error) {
        // ✅ Gestione errori specifici
        
        if (error.response) {
            // Errore dalla risposta API
            const status = error.response.status;
            const statusText = error.response.statusText;
            
            if (status === 403 || status === 429) {
                // Quota superata o accesso negato
                Logger.log(`CSE search quota/access error (${status}): ${statusText}`, Logger.LEVELS.WARNING);
                return [];
            }
            
            if (status === 400) {
                // Chiave API invalida o parametri errati
                Logger.log(`CSE search invalid request (${status}): ${statusText}`, Logger.LEVELS.WARNING);
                return [];
            }
            
            // Altri errori 4xx
            Logger.log(`CSE search API error (${status}): ${statusText}`, Logger.LEVELS.WARNING);
            return [];
        }
        
        if (error.request) {
            // Errore di rete (timeout, ECONNRESET, ecc.)
            // ✅ Retry singolo solo per errori di rete
            if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                Logger.log(`CSE search network error, retrying once: ${error.message}`, Logger.LEVELS.WARNING);
                
                try {
                    // Retry singolo
                    const retryResponse = await axios.get(url, {
                        timeout: timeout,
                        validateStatus: (status) => status < 500
                    });
                    
                    if (!retryResponse.data || !retryResponse.data.items || retryResponse.data.items.length === 0) {
                        return [];
                    }
                    
                    const results = retryResponse.data.items.slice(0, maxResults).map(item => ({
                        title: item.title || '',
                        link: item.link || '',
                        snippet: item.snippet || ''
                    }));
                    
                    Logger.log(`CSE search for "${zone}": found ${results.length} results (after retry)`, Logger.LEVELS.INFO);
                    return results;
                    
                } catch (retryError) {
                    Logger.log(`CSE search retry failed: ${retryError.message}`, Logger.LEVELS.WARNING);
                    return [];
                }
            }
            
            Logger.log(`CSE search network error: ${error.message}`, Logger.LEVELS.WARNING);
            return [];
        }
        
        // ✅ Altri errori
        Logger.log(`CSE search error: ${error.message}`, Logger.LEVELS.WARNING);
        return [];
    }
}

/**
 * Resetta il cache delle credenziali (utile per test)
 */
function resetCredentialsCache() {
    credentialsChecked = false;
    credentialsValid = false;
    missingCredentials = [];
}

module.exports = {
    // searchDiveWreckForZone rimossa - parte della ricerca marina automatica deprecata
    resetCredentialsCache,
    checkCredentials
};

