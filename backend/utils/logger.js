/**
 * Centralized Logger Utility
 * Replaces console.log/error/warn throughout the application
 * 
 * @module utils/logger
 */

class Logger {
  
  /**
   * Log levels
   */
  static LEVELS = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warn',
    ERROR: 'error',
    DEBUG: 'debug'
  };

  /**
   * Log a message with specified level
   * @param {string} message - Message to log
   * @param {string} level - Log level (info, success, warn, error, debug)
   * @param {Object} meta - Additional metadata (optional)
   */
  static log(message, level = this.LEVELS.INFO, meta = null) {
    const timestamp = new Date().toISOString();
    const emoji = this._getEmoji(level);
    
    const logMessage = meta 
      ? `[${timestamp}] ${emoji} ${message}` 
      : `[${timestamp}] ${emoji} ${message}`;
    
    // Use appropriate console method based on level
    switch(level) {
      case this.LEVELS.ERROR:
        console.error(logMessage, meta || '');
        break;
      case this.LEVELS.WARNING:
        console.warn(logMessage, meta || '');
        break;
      case this.LEVELS.SUCCESS:
      case this.LEVELS.INFO:
      default:
        console.log(logMessage, meta || '');
        break;
    }
  }

  /**
   * Log info message
   * @param {string} message 
   * @param {Object} meta 
   */
  static info(message, meta = null) {
    this.log(message, this.LEVELS.INFO, meta);
  }

  /**
   * Log success message
   * @param {string} message 
   * @param {Object} meta 
   */
  static success(message, meta = null) {
    this.log(message, this.LEVELS.SUCCESS, meta);
  }

  /**
   * Log warning message
   * @param {string} message 
   * @param {Object} meta 
   */
  static warn(message, meta = null) {
    this.log(message, this.LEVELS.WARNING, meta);
  }

  /**
   * Log error message
   * @param {string} message 
   * @param {Error|Object} error 
   */
  static error(message, error = null) {
    this.log(message, this.LEVELS.ERROR, error);
  }

  /**
   * Log debug message (only in development)
   * @param {string} message 
   * @param {Object} meta 
   */
  static debug(message, meta = null) {
    if (process.env.NODE_ENV === 'development') {
      this.log(message, this.LEVELS.DEBUG, meta);
    }
  }

  /**
   * Get emoji for log level
   * @private
   */
  static _getEmoji(level) {
    const emojis = {
      [this.LEVELS.INFO]: '📝',
      [this.LEVELS.SUCCESS]: '✅',
      [this.LEVELS.WARNING]: '⚠️',
      [this.LEVELS.ERROR]: '❌',
      [this.LEVELS.DEBUG]: '🐛'
    };
    return emojis[level] || '📝';
  }
}

module.exports = Logger;
