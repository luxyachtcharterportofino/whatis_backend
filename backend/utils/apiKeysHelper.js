// ===============================
// 🔧 API Keys JSON Helper
// Gestione sicura del file api_keys.json
// ===============================

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class ApiKeysHelper {
  /**
   * Ottiene il percorso del file api_keys.json
   */
  static getApiKeysPath() {
    return path.join(process.cwd(), 'config', 'api_keys.json');
  }

  /**
   * Legge il file api_keys.json
   */
  static readApiKeys() {
    const apiKeysPath = this.getApiKeysPath();
    
    if (!fs.existsSync(apiKeysPath)) {
      Logger.warn('File api_keys.json non trovato, verrà creato');
      return [];
    }

    try {
      const content = fs.readFileSync(apiKeysPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      Logger.error('Errore lettura api_keys.json:', error);
      throw new Error('Impossibile leggere il file api_keys.json');
    }
  }

  /**
   * Scrive il file api_keys.json
   */
  static writeApiKeys(apiKeys) {
    const apiKeysPath = this.getApiKeysPath();
    const configDir = path.dirname(apiKeysPath);
    
    // Crea directory se non esiste
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    try {
      const content = JSON.stringify(apiKeys, null, 2);
      fs.writeFileSync(apiKeysPath, content, 'utf8');
      Logger.info('File api_keys.json aggiornato con successo');
      return true;
    } catch (error) {
      Logger.error('Errore scrittura api_keys.json:', error);
      throw new Error('Impossibile scrivere il file api_keys.json');
    }
  }

  /**
   * Aggiunge una nuova API key
   */
  static addApiKey(apiKeyData) {
    const apiKeys = this.readApiKeys();
    
    // Verifica duplicati per env_var
    const exists = apiKeys.some(api => api.env_var === apiKeyData.env_var);
    if (exists) {
      throw new Error(`API key con variabile ${apiKeyData.env_var} già esistente`);
    }

    // Valida campi obbligatori
    if (!apiKeyData.name || !apiKeyData.env_var) {
      throw new Error('Nome API e variabile ENV sono obbligatori');
    }

    // Crea nuovo oggetto API
    const newApi = {
      id: apiKeyData.id || apiKeyData.env_var.toLowerCase().replace(/_/g, '_'),
      name: apiKeyData.name.trim(),
      env_var: apiKeyData.env_var.trim(),
      description: apiKeyData.description || '',
      icon: apiKeyData.icon || '🔑',
      tooltip: apiKeyData.tooltip || apiKeyData.description || ''
    };

    apiKeys.push(newApi);
    this.writeApiKeys(apiKeys);
    
    return newApi;
  }

  /**
   * Aggiorna una API key esistente
   */
  static updateApiKey(envVar, apiKeyData) {
    const apiKeys = this.readApiKeys();
    
    const index = apiKeys.findIndex(api => api.env_var === envVar);
    if (index === -1) {
      throw new Error(`API key con variabile ${envVar} non trovata`);
    }

    // Se env_var è cambiato, verifica che non ci siano duplicati
    if (apiKeyData.env_var && apiKeyData.env_var !== envVar) {
      const duplicate = apiKeys.find(api => api.env_var === apiKeyData.env_var && api.env_var !== envVar);
      if (duplicate) {
        throw new Error(`API key con variabile ${apiKeyData.env_var} già esistente`);
      }
    }

    // Aggiorna i campi
    apiKeys[index] = {
      ...apiKeys[index],
      name: apiKeyData.name || apiKeys[index].name,
      env_var: apiKeyData.env_var || apiKeys[index].env_var,
      description: apiKeyData.description !== undefined ? apiKeyData.description : apiKeys[index].description,
      icon: apiKeyData.icon !== undefined ? apiKeyData.icon : apiKeys[index].icon,
      tooltip: apiKeyData.tooltip !== undefined ? apiKeyData.tooltip : apiKeys[index].tooltip
    };

    this.writeApiKeys(apiKeys);
    
    return apiKeys[index];
  }

  /**
   * Rimuove una API key
   */
  static removeApiKey(envVar) {
    const apiKeys = this.readApiKeys();
    
    const filtered = apiKeys.filter(api => api.env_var !== envVar);
    
    if (filtered.length === apiKeys.length) {
      throw new Error(`API key con variabile ${envVar} non trovata`);
    }

    this.writeApiKeys(filtered);
    return true;
  }

  /**
   * Trova una API key per env_var
   */
  static findApiKey(envVar) {
    const apiKeys = this.readApiKeys();
    return apiKeys.find(api => api.env_var === envVar);
  }
}

module.exports = ApiKeysHelper;

