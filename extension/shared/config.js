class ExtensionConfig {
  constructor() {
    this.config = {
      apiBaseUrl: 'http://localhost:4000',
      frontendUrl: 'http://localhost:5173',

      extensionName: 'Summarize-Internet Extension',
      extensionVersion: '1.0.0',
    };

    this.config.isDevelopment = this.detectEnvironment() === 'development';
    this.config.isProduction = this.detectEnvironment() === 'production';
  }

  detectEnvironment() {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
      return process.env.NODE_ENV;
    }
    
    if (this.config.apiBaseUrl.includes('localhost')) {
      return 'development';
    }
    
    return 'production';
  }

  getApiUrl() {
    return this.config.apiBaseUrl;
  }

  getFrontendUrl() {
    return this.config.frontendUrl;
  }

  getAll() {
    return {
      ...this.config,
      apiUrl: this.getApiUrl(),
      frontendUrl: this.getFrontendUrl(),
    };
  }

}

const extensionConfig = new ExtensionConfig();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = extensionConfig;
} else {
  window.ExtensionConfig = extensionConfig;
}
