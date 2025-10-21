class SummarizeExtension {
  constructor() {
    this.summaryPopup = null;
    this.isProcessing = false;
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'summarize') {
        this.handleSummarize(request.url || window.location.href);
        sendResponse({ success: true });
      } else if (request.action === 'summarize-selection') {
        this.handleSummarizeSelection(request.text);
        sendResponse({ success: true });
      } else if (request.action === 'pingSummarizer') {
        sendResponse({ pong: true });
      } else if (request.action === 'authStatusChanged') {
        // Auth status changed
      }
    });
  }

  injectFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"]') || document.querySelector('link[href*="fontawesome"]')) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  async handleSummarize(url = window.location.href) {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      this.showLoadingPopup();

      const isAuthenticated = await this.checkAuthentication();
      
      if (!isAuthenticated) {
        this.showAuthReminder();
      }

      try {
        await chrome.runtime.sendMessage({ action: 'ping' });
      } catch (contextError) {
        if (contextError.message.includes('Extension context invalidated')) {
          throw new Error('Extension context invalidated.');
        }
      }
      
      const result = await chrome.runtime.sendMessage({
        action: 'summarizeUrl',
        url: url
      });
      
      if (result && result.success) {
        if (result.data && result.data.status === 'COMPLETED' && result.data.id) {
          await this.fetchAndShowSummary(result.data.id);
        } else if (result.data && result.data.status === 'PROCESSING') {
          this.showProgressPopup(result.data.id);
        } else {
          this.showSuccessPopup('Summary request submitted successfully!');
        }
      } else {
        throw new Error(result?.error || 'Unknown error from background script');
      }

    } catch (error) {
      console.error('Summarization error:', error);
      
      if (error.message === 'Extension context invalidated.') {
        this.showErrorPopup('Extension was reloaded. Please refresh the page and try again.');
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        this.showErrorPopup(error.message);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async handleSummarizeSelection(text) {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      this.showLoadingPopup();

      await this.handleSummarize();
    } catch (error) {
      console.error('Selection summarization error:', error);
      this.showErrorPopup(error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async checkAuthentication() {
    try {
      const result = await chrome.storage.local.get(['accessToken']);
      return !!result.accessToken;
    } catch (error) {
      return false;
    }
  }

  async fetchAndShowSummary(docId) {
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'getSummary',
        docId: docId
      });
      
      if (result && result.success && result.data) {
        this.showSummaryPopup(result.data.summary);
      } else {
        throw new Error(result?.error || 'Failed to fetch summary');
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
      this.showErrorPopup('Failed to fetch summary: ' + error.message);
    }
  }

  showProgressPopup(docId) {
    this.removeExistingPopup();
    
    const popup = document.createElement('div');
    popup.id = 'summarize-popup';
    popup.className = 'summarize-popup';
    popup.innerHTML = `
      <div class="popup-header">
        <h3>📄 Summarizing...</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="popup-content">
        <div class="loading-container">
          <div class="loading-bar">
            <div class="loading-progress"></div>
          </div>
          <p>Processing your request...</p>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.summaryPopup = popup;

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.removeExistingPopup();
    });

    this.pollForCompletion(docId);
  }

  async pollForCompletion(docId) {
    const maxAttempts = 60; 
    let attempts = 0;

    const poll = async () => {
      try {
        const summaryData = await this.apiService.getSummary(docId);
        this.showSummaryPopup(summaryData.summary);
        return;
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          this.showErrorPopup('Summarization timed out. Please try again.');
        }
      }
    };

    setTimeout(poll, 2000); 
  }

  showSummaryPopup(summary) {
    this.removeExistingPopup();
    
    const popup = document.createElement('div');
    popup.id = 'summarize-popup';
    popup.className = 'summarize-popup';
    
    const formattedSummary = this.formatSummary(summary);
    
    popup.innerHTML = `
      <div class="popup-header">
        <h3>📄 Summary</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="popup-content">
        <div class="summary-content">
          ${formattedSummary}
        </div>
        <div class="popup-actions">
          <button class="copy-btn">📋 Copy Summary</button>
          <button class="new-summary-btn">🔄 New Summary</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.summaryPopup = popup;

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.removeExistingPopup();
    });

    popup.querySelector('.copy-btn').addEventListener('click', () => {
      this.copyToClipboard(formattedSummary);
    });

    popup.querySelector('.new-summary-btn').addEventListener('click', () => {
      this.removeExistingPopup();
      this.handleSummarize();
    });
  }

  formatSummary(summary) {
    if (typeof summary === 'string') {
      return `<div class="summary-text">${summary}</div>`;
    }

    if (typeof summary === 'object' && summary !== null) {
      let formatted = '';

      if (summary.tldr) {
        formatted += `<div class="summary-section">
          <h4>📋 TL;DR</h4>
          <p>${summary.tldr}</p>
        </div>`;
      }

      if (summary.bullets && Array.isArray(summary.bullets)) {
        formatted += `<div class="summary-section">
          <h4>🔑 Key Points</h4>
          <ul>${summary.bullets.map(bullet => `<li>${bullet}</li>`).join('')}</ul>
        </div>`;
      }

      if (summary.key_sections && Array.isArray(summary.key_sections)) {
        formatted += `<div class="summary-section">
          <h4>📖 Key Sections</h4>
          <ul>${summary.key_sections.map(section => 
            `<li>${typeof section === 'string' ? section : 
              (section.heading && section.summary ? `${section.heading}: ${section.summary}` : section)}</li>`
          ).join('')}</ul>
        </div>`;
      }

      return formatted || '<div class="summary-text">No summary content available.</div>';
    }

    return '<div class="summary-text">No summary content available.</div>';
  }

  showLoadingPopup() {
    this.removeExistingPopup();
    
    const popup = document.createElement('div');
    popup.id = 'summarize-popup';
    popup.className = 'summarize-popup';
    popup.innerHTML = `
      <div class="popup-header">
        <h3>📄 Processing...</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="popup-content">
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Submitting your request...</p>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.summaryPopup = popup;

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.removeExistingPopup();
    });
  }

  showAuthReminder() {
    const notification = document.createElement('div');
    notification.className = 'auth-reminder-notification';
    notification.innerHTML = `
      <div class="reminder-content">
        <span>💡 <strong>Tip:</strong> Login for enhanced features and saved summaries</span>
        <button class="reminder-login-btn">Login</button>
        <button class="reminder-close-btn">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    notification.querySelector('.reminder-close-btn').addEventListener('click', () => {
      notification.remove();
    });

    notification.querySelector('.reminder-login-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'redirectToAuth', endpoint: '/login' })
        .catch(error => {
          console.error('redirectToAuth error:', error);
        });
      notification.remove();
    });
  }

  showSuccessPopup(message) {
    this.removeExistingPopup();
    
    const popup = document.createElement('div');
    popup.id = 'summarize-popup';
    popup.className = 'summarize-popup success';
    popup.innerHTML = `
      <div class="popup-header">
        <h3>✅ Success</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="popup-content">
        <div class="success-message">
          <p>${message}</p>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.summaryPopup = popup;

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.removeExistingPopup();
    });

    // Auto-close after 3 seconds
    setTimeout(() => {
      this.removeExistingPopup();
    }, 3000);
  }

  showErrorPopup(message) {
    this.removeExistingPopup();
    
    const popup = document.createElement('div');
    popup.id = 'summarize-popup';
    popup.className = 'summarize-popup error';
    popup.innerHTML = `
      <div class="popup-header">
        <h3>❌ Error</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="popup-content">
        <div class="error-message">
          <p>${message}</p>
          <button class="retry-btn">Try Again</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.summaryPopup = popup;

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.removeExistingPopup();
    });

    popup.querySelector('.retry-btn').addEventListener('click', () => {
      this.removeExistingPopup();
      this.handleSummarize();
    });
  }

  removeExistingPopup() {
    if (this.summaryPopup) {
      this.summaryPopup.remove();
      this.summaryPopup = null;
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      const notification = document.createElement('div');
      notification.className = 'copy-notification';
      notification.textContent = 'Copied to clipboard!';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

}

function initializeFallback() {
  window.summarizeExtension = {
    handleSummarize: (url) => {
      alert('Extension context invalidated. Please refresh the page and try again.\n\nURL: ' + url);
    }
  };
  
  window.summarizeExtensionInitialized = true;
}

async function handleSummarizeDirectly(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'summarizeUrl',
      url: url
    });

    if (response && response.success) {
      alert('Summary request submitted successfully!\n\nResponse: ' + JSON.stringify(response.data, null, 2));
    } else {
      throw new Error(response?.error || 'Unknown error from background script');
    }
    
  } catch (error) {
    console.error('Background script API call failed:', error);
    alert('Failed to submit summary request: ' + error.message + '\n\nURL: ' + url);
  }
}

window.testSummarizeExtension = function() {
  return 'Extension is working!';
};

const indicator = document.createElement('div');
indicator.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: #4CAF50;
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  z-index: 10000;
`;
indicator.textContent = 'Content Script Loaded';
document.body.appendChild(indicator);

setTimeout(() => {
  if (indicator.parentNode) {
    indicator.remove();
  }
}, 3000);

// Create a simple message listener immediately
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pingSummarizer') {
    sendResponse({ pong: true });
    return true;
  }
  
  if (request.action === 'summarize') {
    if (window.summarizeExtension && window.summarizeExtension.handleSummarize) {
      window.summarizeExtension.handleSummarize(request.url || window.location.href);
    } else {
      if ((typeof ExtensionAPIService !== 'undefined' || typeof window.ExtensionAPIService !== 'undefined') && typeof SummarizeExtension !== 'undefined') {
        window.summarizeExtension = new SummarizeExtension();
        if (window.summarizeExtension.handleSummarize) {
          window.summarizeExtension.handleSummarize(request.url || window.location.href);
        } else {
          handleSummarizeDirectly(request.url || window.location.href);
        }
      } else {
        handleSummarizeDirectly(request.url || window.location.href);
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

if (!document.getElementById('summarize-extension-indicator')) {
  const indicator = document.createElement('div');
  indicator.id = 'summarize-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    z-index: 10000;
    display: none;
  `;
  indicator.textContent = 'Summarize Extension Loaded';
  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.style.display = 'block';
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 2000);
  }, 100);
}

if (window.summarizeExtensionInitialized) {
  // Extension already initialized
} else {
  if (!chrome || !chrome.runtime) {
    console.error('Chrome runtime not available');
  } else {
    try {
      if (typeof ExtensionAPIService !== 'undefined' || typeof window.ExtensionAPIService !== 'undefined') {
        window.summarizeExtensionInitialized = true;
        window.summarizeExtension = new SummarizeExtension();
      } else {
        setTimeout(() => {
          if (typeof ExtensionAPIService !== 'undefined' || typeof window.ExtensionAPIService !== 'undefined') {
            window.summarizeExtensionInitialized = true;
            window.summarizeExtension = new SummarizeExtension();
          } else {
            initializeFallback();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }
}
