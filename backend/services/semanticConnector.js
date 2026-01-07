/**
 * Semantic Connector - Integrazione con Semantic Engine Python
 * 
 * Gestisce le comunicazioni tra il backend Node.js e il microservizio Python
 * per la ricerca semantica avanzata di POI turistici.
 * 
 * Endpoints Python:
 * - POST http://127.0.0.1:5000/semantic/search
 * - POST http://127.0.0.1:5000/semantic/municipalities
 * 
 * Autore: Semantic Integration Team
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class SemanticConnector {
    constructor() {
        // Porta 5000: il server.js avvia il servizio Python sulla porta 5000
        this.pythonServiceUrl = 'http://127.0.0.1:5000';
        this.timeout = 120000; // 120 secondi timeout (2 minuti) per ricerche semantiche complesse
        this.retryAttempts = 2; // Ridotto retry perché il timeout è più lungo
        this.retryDelay = 1000; // 1 secondo
        
        // ✅ FIX: Rate limiting per /health - max 1 volta al minuto
        this.lastHealthCheck = 0;
        this.healthCheckInterval = 60000; // 60 secondi (1 minuto)
        this.lastHealthStatus = null;
        
        // Cache per risultati semantici
        this.cacheDir = path.join(__dirname, '..', 'cache', 'semantic');
        this.ensureCacheDir();
        
        // Statistiche utilizzo
        this.stats = {
            requests: 0,
            successes: 0,
            failures: 0,
            cacheHits: 0,
            lastRequest: null
        };
        
        this.logger = logger;
    }
    
    /**
     * Crea directory cache se non esiste
     */
    async ensureCacheDir() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            this.logger.error('Error creating semantic cache directory:', error);
        }
    }
    
    /**
     * Verifica se il servizio Python è disponibile
     * ✅ FIX: Rate limiting - max 1 volta al minuto
     */
    async isSemanticEngineAvailable() {
        // ✅ FIX: Rate limiting per /health
        const now = Date.now();
        if (now - this.lastHealthCheck < this.healthCheckInterval) {
            // Usa risultato cache se disponibile
            return this.lastHealthStatus !== null ? this.lastHealthStatus : true; // Default true se non ancora fatto
        }
        
        this.lastHealthCheck = now;
        
        try {
            const response = await axios.get(`${this.pythonServiceUrl}/health`, {
                timeout: 10000 // 10 secondi per health check
            });
            
            const isHealthy = response.status === 200 && response.data && response.data.status === 'healthy';
            this.lastHealthStatus = isHealthy; // ✅ FIX: Cache risultato
            
            if (!isHealthy) {
                this.logger.warn('Semantic Engine health check failed:', {
                    status: response.status,
                    data: response.data
                });
            }
            
            return isHealthy;
        } catch (error) {
            this.lastHealthStatus = false; // ✅ FIX: Cache risultato negativo
            this.logger.warn('Semantic Engine not available:', {
                message: error.message,
                code: error.code,
                url: `${this.pythonServiceUrl}/health`
            });
            return false;
        }
    }
    
    /**
     * Ricerca semantica completa di POI
     * 
     * @param {string} zoneName - Nome della zona geografica
     * @param {Array<Array<number>>} polygon - Poligono coordinati [[lat,lng],...]
     * @param {boolean} extendMarine - Estende ricerca al mare
     * @param {boolean} enableAI - Abilita arricchimento AI
     * @param {boolean} marineOnly - Se true, cerca SOLO POI marini (no terrestri)
     * @returns {Promise<Object>} Risultati ricerca semantica
     */
    async semanticSearch(zoneName, polygon, extendMarine = false, enableAI = true, marineOnly = false, mode = "standard") {
        this.stats.requests++;
        this.stats.lastRequest = new Date().toISOString();
        
        try {
            // Validazione input
            this.validateSearchInput(zoneName, polygon);
            
            // Controllo cache (include marineOnly per distinguere ricerche marine da terrestri)
            const cacheKey = this.generateCacheKey(zoneName, polygon, extendMarine, marineOnly, mode);
            const cachedResult = await this.getCachedResult(cacheKey, marineOnly); // ✅ FIX MarinePOI: Passa marineOnly per validazione
            if (cachedResult) {
                this.stats.cacheHits++;
                this.logger.info(`Semantic search cache hit for zone: ${zoneName} (mode: ${mode})`);
                return cachedResult;
            }
            
            // Verifica disponibilità servizio
            const isAvailable = await this.isSemanticEngineAvailable();
            if (!isAvailable) {
                throw new Error('Semantic Engine service is not available');
            }
            
            if (String(mode).toLowerCase() === 'enhanced') {
                this.logger.info('🌊 Enhanced mode requested — sending to semantic engine');
            }

            const requestData = {
                zone_name: zoneName,
                polygon: polygon,
                extend_marine: extendMarine,
                enable_ai_enrichment: enableAI,
                marine_only: marineOnly, // Se true, cerca SOLO POI marini
                mode: mode
            };
            
            this.logger.info(`Starting semantic search for zone: ${zoneName}`);
            this.logger.debug('Request data:', { zoneName, polygonPoints: polygon.length, extendMarine, marineOnly, enableAI });
            
            // Esegui richiesta con retry
            const response = await this.makeRetryableRequest(
                'POST',
                '/semantic/search',
                requestData
            );
            
            const result = response.data;
            
            // Salva in cache
            await this.cacheResult(cacheKey, result);
            
            // ✅ FIX MarineDivingCenter: Verifica se i POI provengono da Wikipedia (non dovrebbero per ricerca marina!)
            if (marineOnly && result.pois && Array.isArray(result.pois)) {
                const sources = result.pois.map(poi => (poi.source || '').toLowerCase());
                const wikipediaCount = sources.filter(source => 
                    source.includes('wikipedia') || source.includes('wikidata') || source.includes('dbpedia')
                ).length;
                
                if (wikipediaCount >= 1) {
                    this.logger.warn(`[POI-MARINE] ⚠️ Risultato contiene ${wikipediaCount} POI da Wikipedia/Wikidata/DBpedia - NON dovrebbe accadere per ricerca marina!`);
                }
            }
            
            // Log statistiche
            this.stats.successes++;
            this.logger.info(`Semantic search completed for zone: ${zoneName}`, {
                totalPOIs: result.statistics.total_pois,
                municipalities: result.statistics.total_municipalities,
                sources: result.statistics?.sources || ['Unknown'], // ✅ FIX MarineDivingCenter: Log sources per debug
                processingTime: result.processing_time_ms + 'ms'
            });
            
            return result;
            
        } catch (error) {
            this.stats.failures++;
            this.logger.error(`Semantic search failed for zone: ${zoneName}`, error);
            
            // Fallback: ritorna struttura vuota ma valida
            return this.getEmptySearchResult(zoneName);
        }
    }
    
    /**
     * Scoperta comuni e frazioni in una zona
     * 
     * @param {Array<Array<number>>} polygon - Poligono coordinati
     * @param {string} zoneName - Nome zona (opzionale)
     * @returns {Promise<Array>} Lista comuni e frazioni
     */
    async discoverMunicipalities(polygon, zoneName = '') {
        try {
            // Validazione input
            if (!Array.isArray(polygon) || polygon.length < 3) {
                throw new Error('Polygon must be an array with at least 3 coordinate pairs');
            }
            
            // Verifica disponibilità servizio
            const isAvailable = await this.isSemanticEngineAvailable();
            if (!isAvailable) {
                this.logger.warn('Semantic Engine not available, using fallback municipality discovery');
                return this.fallbackMunicipalityDiscovery(polygon);
            }
            
            const requestData = {
                polygon: polygon,
                zone_name: zoneName
            };
            
            this.logger.info(`Discovering municipalities for zone: ${zoneName || 'Unnamed'}`);
            
            const response = await this.makeRetryableRequest(
                'POST',
                '/semantic/municipalities',
                requestData
            );
            
            const municipalities = response.data;
            
            this.logger.info(`Found ${municipalities.length} municipalities for zone: ${zoneName}`);
            
            return municipalities;
            
        } catch (error) {
            this.logger.error(`Municipality discovery failed for zone: ${zoneName}`, error);
            return this.fallbackMunicipalityDiscovery(polygon);
        }
    }
    
    /**
     * Analizza qualità dei risultati di ricerca
     * 
     * @param {Object} searchResults - Risultati ricerca semantica
     * @returns {Promise<Object>} Analisi qualità
     */
    async analyzeResults(searchResults) {
        try {
            const response = await this.makeRetryableRequest(
                'POST', 
                '/semantic/analyze',
                searchResults
            );
            
            return response.data;
            
        } catch (error) {
            this.logger.error('Results analysis failed:', error);
            return {
                quality_score: 0,
                recommendations: ['Analysis service unavailable']
            };
        }
    }
    
    /**
     * Esegue richiesta HTTP con retry automatico
     */
    async makeRetryableRequest(method, endpoint, data = null) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const config = {
                    method: method,
                    url: `${this.pythonServiceUrl}${endpoint}`,
                    timeout: this.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'WhatsIs-Backend-Semantic-Connector/1.0'
                    }
                };
                
                if (data) {
                    config.data = data;
                }
                
                const response = await axios(config);
                return response;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.retryAttempts) {
                    this.logger.warn(`Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`, {
                        endpoint,
                        error: error.message
                    });
                    
                    await this.sleep(this.retryDelay * attempt); // Backoff esponenziale
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Validazione input per ricerca semantica
     */
    validateSearchInput(zoneName, polygon) {
        if (!zoneName || typeof zoneName !== 'string' || zoneName.trim().length === 0) {
            throw new Error('Zone name is required and must be a non-empty string');
        }
        
        if (!Array.isArray(polygon) || polygon.length < 3) {
            throw new Error('Polygon must be an array with at least 3 coordinate pairs');
        }
        
        for (let i = 0; i < polygon.length; i++) {
            const point = polygon[i];
            if (!Array.isArray(point) || point.length !== 2) {
                throw new Error(`Point ${i} must be an array with exactly 2 coordinates [lat, lng]`);
            }
            
            const [lat, lng] = point;
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                throw new Error(`Point ${i} coordinates must be numbers`);
            }
            
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw new Error(`Point ${i} coordinates out of valid range: lat=${lat}, lng=${lng}`);
            }
        }
    }
    
    /**
     * Genera chiave cache per ricerca
     */
    generateCacheKey(zoneName, polygon, extendMarine, marineOnly = false, mode = "standard") {
        const crypto = require('crypto');
        const data = JSON.stringify({ zoneName, polygon, extendMarine, marineOnly, mode });
        return crypto.createHash('md5').update(data).digest('hex');
    }
    
    /**
     * Ottiene risultato dalla cache con validazione qualità
     */
    async getCachedResult(cacheKey, marineOnly = false) {
        try {
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
            
            // Controlla se file esiste e non è troppo vecchio (24 ore)
            const stats = await fs.stat(cacheFile);
            const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
            
            if (ageHours > 24) {
                // Cache scaduta, rimuovi file
                await fs.unlink(cacheFile);
                return null;
            }
            
            const cachedData = await fs.readFile(cacheFile, 'utf8');
            const result = JSON.parse(cachedData);
            
            // ✅ FIX MarinePOI: Se è una ricerca marina, verifica qualità cache PRIMA di restituirla
            if (marineOnly && result.pois && Array.isArray(result.pois)) {
                const pois = result.pois;
                const poisCount = pois.length;
                
                this.logger.info(`[POI-MARINE] 🔍 Verifica qualità cache Node.js: ${poisCount} POI trovati`);
                
                // ✅ FIX MarineDivingCenter: Invalida cache se contiene 0 POI (per permettere nuova ricerca con web search)
                if (poisCount === 0) {
                    this.logger.warn(`[POI-MARINE] ⚠️ Cache Node.js con 0 POI trovata per ricerca marina - Invalidando cache per permettere ricerca con web search`);
                    try {
                        await fs.unlink(cacheFile);
                        this.logger.info(`[POI-MARINE] ✅ Cache Node.js invalidata e rimossa: ${cacheFile}`);
                    } catch (error) {
                        this.logger.error('Error removing invalid cache file:', error);
                    }
                    return null;
                }
                
                // ✅ FIX MarineDivingCenter: Controlla se ci sono POI da Wikipedia (NON devono essere presenti per ricerca marina!)
                const sources = pois.map(poi => (poi.source || '').toLowerCase());
                const wikipediaCount = sources.filter(source => 
                    source.includes('wikipedia') || source.includes('wikidata') || source.includes('dbpedia')
                ).length;
                
                this.logger.info(`[POI-MARINE] 🔍 Verifica source: ${wikipediaCount} POI da Wikipedia/Wikidata/DBpedia trovati`);
                
                if (wikipediaCount >= 1) {
                    this.logger.warn(`[POI-MARINE] ⚠️ Cache Node.js con ${wikipediaCount} POI da Wikipedia/Wikidata/DBpedia trovata - Invalidando cache per rigenerare con ricerca SOLO diving center`);
                    try {
                        await fs.unlink(cacheFile);
                        this.logger.info(`[POI-MARINE] ✅ Cache Node.js invalidata e rimossa: ${cacheFile}`);
                    } catch (error) {
                        this.logger.error('Error removing invalid cache file:', error);
                    }
                    return null;
                }
                
                // ✅ FIX MarinePOI: Controlla se ci sono duplicati Moskva
                const names = pois.map(poi => (poi.name || '').toLowerCase());
                const moskvaCount = names.filter(name => 
                    name.includes('moskva') || name.includes('moscow') || name.includes('moscova')
                ).length;
                
                this.logger.info(`[POI-MARINE] 🔍 Verifica Moskva: ${moskvaCount} trovati nei nomi POI`);
                
                if (moskvaCount >= 1) {
                    this.logger.warn(`[POI-MARINE] ⚠️ Cache Node.js con ${moskvaCount} duplicati Moskva trovata - Invalidando cache per rigenerare con nuova logica`);
                    try {
                        await fs.unlink(cacheFile);
                        this.logger.info(`[POI-MARINE] ✅ Cache Node.js invalidata e rimossa: ${cacheFile}`);
                    } catch (error) {
                        this.logger.error('Error removing invalid cache file:', error);
                    }
                    return null;
                }
                
                // ✅ FIX MarinePOI: Controlla se ci sono descrizioni irrilevanti (es. "Canada", "Ontario")
                const descriptions = pois.map(poi => (poi.description || '').toLowerCase());
                const irrelevantCount = descriptions.filter(desc => 
                    desc.includes('canada') || desc.includes('ontario') || desc.includes('canadian')
                ).length;
                
                this.logger.info(`[POI-MARINE] 🔍 Verifica descrizioni irrilevanti: ${irrelevantCount} trovati`);
                
                if (irrelevantCount >= 1) {
                    this.logger.warn(`[POI-MARINE] ⚠️ Cache Node.js con ${irrelevantCount} descrizioni irrilevanti (Canada/Ontario) trovata - Invalidando cache per rigenerare con nuova logica`);
                    try {
                        await fs.unlink(cacheFile);
                        this.logger.info(`[POI-MARINE] ✅ Cache Node.js invalidata e rimossa: ${cacheFile}`);
                    } catch (error) {
                        this.logger.error('Error removing invalid cache file:', error);
                    }
                    return null;
                }
                
                this.logger.info(`[POI-MARINE] ✅ Cache Node.js valida: ${poisCount} POI, 0 Wikipedia, 0 Moskva, 0 descrizioni irrilevanti`);
            }
            
            return result;
            
        } catch (error) {
            // File non esiste o errore lettura
            return null;
        }
    }
    
    /**
     * Salva risultato in cache
     */
    async cacheResult(cacheKey, result) {
        try {
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
            
            // Aggiungi metadata cache
            const cacheData = {
                ...result,
                cached_at: new Date().toISOString(),
                cache_key: cacheKey
            };
            
            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
            
        } catch (error) {
            this.logger.warn('Failed to cache result:', error);
        }
    }
    
    /**
     * Fallback per discovery comuni quando Python non disponibile
     */
    async fallbackMunicipalityDiscovery(polygon) {
        try {
            // Implementazione fallback usando geocoding o database locale
            // Per ora ritorna lista vuota con log di warning
            
            this.logger.warn('Using fallback municipality discovery (limited functionality)');
            
            // In implementazione reale, qui si userebbe:
            // - Database locale comuni italiani
            // - Geocoding diretto con Nominatim
            // - File JSON con mappature predefinite
            
            return [];
            
        } catch (error) {
            this.logger.error('Fallback municipality discovery failed:', error);
            return [];
        }
    }
    
    /**
     * Risultato vuoto per fallback
     */
    getEmptySearchResult(zoneName) {
        return {
            zone_name: zoneName,
            municipalities: [],
            pois: [],
            statistics: {
                total_pois: 0,
                land_pois: 0,
                marine_pois: 0,
                total_municipalities: 0,
                sources_used: []
            },
            marine_analysis: {
                is_coastal: false
            },
            processing_time_ms: 0,
            fallback_used: true
        };
    }
    
    /**
     * Ottiene statistiche utilizzo
     */
    getUsageStats() {
        return {
            ...this.stats,
            cache_hit_rate: this.stats.requests > 0 ? 
                (this.stats.cacheHits / this.stats.requests * 100).toFixed(2) + '%' : '0%',
            success_rate: this.stats.requests > 0 ? 
                (this.stats.successes / this.stats.requests * 100).toFixed(2) + '%' : '0%'
        };
    }
    
    /**
     * Reset delle statistiche
     */
    resetStats() {
        this.stats = {
            requests: 0,
            successes: 0,
            failures: 0,
            cacheHits: 0,
            lastRequest: null
        };
    }
    
    /**
     * Pulisce cache scaduta
     */
    async cleanupCache() {
        try {
            const files = await fs.readdir(this.cacheDir);
            let cleaned = 0;
            
            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);
                const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
                
                if (ageHours > 24) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                this.logger.info(`Cleaned up ${cleaned} expired cache files`);
            }
            
        } catch (error) {
            this.logger.warn('Cache cleanup failed:', error);
        }
    }
    
    /**
     * Utility per sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
const semanticConnector = new SemanticConnector();

// Cleanup periodico cache (ogni 6 ore)
setInterval(() => {
    semanticConnector.cleanupCache();
}, 6 * 60 * 60 * 1000);

module.exports = semanticConnector;
