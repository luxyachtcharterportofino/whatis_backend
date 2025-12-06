// ===============================
// 🔧 Environment Variables Helper
// Gestione sicura del file .env
// ===============================

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class EnvHelper {
  /**
   * Ottiene il percorso del file .env
   */
  static getEnvPath() {
    return path.join(process.cwd(), '.env');
  }

  /**
   * Legge il file .env e restituisce le righe
   */
  static readEnvFile() {
    const envPath = this.getEnvPath();
    
    if (!fs.existsSync(envPath)) {
      Logger.warn('File .env non trovato, verrà creato');
      return [];
    }

    try {
      const content = fs.readFileSync(envPath, 'utf8');
      return content.split('\n');
    } catch (error) {
      Logger.error('Errore lettura .env:', error);
      throw new Error('Impossibile leggere il file .env');
    }
  }

  /**
   * Scrive le righe nel file .env
   */
  static writeEnvFile(lines) {
    const envPath = this.getEnvPath();
    
    try {
      const content = lines.join('\n');
      fs.writeFileSync(envPath, content, 'utf8');
      Logger.info('File .env aggiornato con successo');
      return true;
    } catch (error) {
      Logger.error('Errore scrittura .env:', error);
      throw new Error('Impossibile scrivere il file .env');
    }
  }

  /**
   * Aggiunge o aggiorna una variabile d'ambiente nel file .env
   * @param {string} key - Nome della variabile (es: "OPENAI_API_KEY")
   * @param {string} value - Valore della variabile
   * @returns {boolean} - true se aggiunta, false se aggiornata
   */
  static setEnvVariable(key, value) {
    const lines = this.readEnvFile();
    let found = false;
    let added = false;

    // Cerca la variabile esistente
    const updatedLines = lines.map(line => {
      const trimmed = line.trim();
      
      // Ignora commenti e righe vuote
      if (trimmed.startsWith('#') || trimmed === '') {
        return line;
      }

      // Cerca la variabile (formato: KEY=value o KEY="value")
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (match && match[1] === key) {
        found = true;
        // Mantieni spaziatura originale se possibile
        const indent = line.match(/^(\s*)/)[0];
        return `${indent}${key}=${value}`;
      }

      return line;
    });

    // Se non trovata, aggiungi alla fine
    if (!found) {
      // Rimuovi riga vuota finale se presente
      while (updatedLines.length > 0 && updatedLines[updatedLines.length - 1].trim() === '') {
        updatedLines.pop();
      }
      
      updatedLines.push(`${key}=${value}`);
      added = true;
    }

    this.writeEnvFile(updatedLines);
    return added;
  }

  /**
   * Rimuove una variabile d'ambiente dal file .env
   */
  static removeEnvVariable(key) {
    const lines = this.readEnvFile();
    
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      
      // Ignora commenti e righe vuote
      if (trimmed.startsWith('#') || trimmed === '') {
        return true;
      }

      // Rimuovi la riga se corrisponde alla variabile
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/i);
      if (match && match[1] === key) {
        return false;
      }

      return true;
    });

    this.writeEnvFile(filteredLines);
  }

  /**
   * Verifica se una variabile esiste nel file .env
   */
  static hasEnvVariable(key) {
    const lines = this.readEnvFile();
    
    return lines.some(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') {
        return false;
      }
      
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/i);
      return match && match[1] === key;
    });
  }
}

module.exports = EnvHelper;

