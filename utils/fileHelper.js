/**
 * File System Helper Utility
 * Centralizes file operations (read, write, exists) to avoid duplication
 * 
 * @module utils/fileHelper
 */

const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

class FileHelper {

  /**
   * Read JSON file and parse content
   * @param {string} filepath - Path to JSON file
   * @returns {Object|null} Parsed JSON object or null if error
   */
  static readJSON(filepath) {
    try {
      if (!fs.existsSync(filepath)) {
        Logger.debug(`File does not exist: ${filepath}`);
        return null;
      }
      
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      Logger.error(`Error reading JSON file ${filepath}:`, error.message);
      return null;
    }
  }

  /**
   * Write JSON object to file
   * @param {string} filepath - Path to file (will be created if doesn't exist)
   * @param {Object} data - Data to write
   * @param {boolean} pretty - Pretty print JSON (default: true)
   * @returns {boolean} Success status
   */
  static writeJSON(filepath, data, pretty = true) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = pretty 
        ? JSON.stringify(data, null, 2) 
        : JSON.stringify(data);
      
      fs.writeFileSync(filepath, content, 'utf-8');
      Logger.debug(`File written successfully: ${filepath}`);
      return true;
    } catch (error) {
      Logger.error(`Error writing JSON file ${filepath}:`, error.message);
      return false;
    }
  }

  /**
   * Check if file exists
   * @param {string} filepath - Path to file
   * @returns {boolean} True if file exists
   */
  static exists(filepath) {
    try {
      return fs.existsSync(filepath);
    } catch (error) {
      Logger.error(`Error checking file existence ${filepath}:`, error.message);
      return false;
    }
  }

  /**
   * Delete file
   * @param {string} filepath - Path to file
   * @returns {boolean} Success status
   */
  static delete(filepath) {
    try {
      if (!fs.existsSync(filepath)) {
        Logger.debug(`File does not exist, skipping delete: ${filepath}`);
        return true;
      }
      
      fs.unlinkSync(filepath);
      Logger.debug(`File deleted: ${filepath}`);
      return true;
    } catch (error) {
      Logger.error(`Error deleting file ${filepath}:`, error.message);
      return false;
    }
  }

  /**
   * Ensure directory exists
   * @param {string} dirpath - Directory path
   * @returns {boolean} Success status
   */
  static ensureDir(dirpath) {
    try {
      if (!fs.existsSync(dirpath)) {
        fs.mkdirSync(dirpath, { recursive: true });
        Logger.debug(`Directory created: ${dirpath}`);
      }
      return true;
    } catch (error) {
      Logger.error(`Error creating directory ${dirpath}:`, error.message);
      return false;
    }
  }
}

module.exports = FileHelper;
