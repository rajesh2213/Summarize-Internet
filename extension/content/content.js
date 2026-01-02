class SummarizeExtension {
  constructor() {
    this.summaryPopup = null;
    this.isProcessing = false;
    this.apiService = null;
    this.init();
  }

  init() {
    if (typeof ExtensionAPIService !== 'undefined' || typeof window.ExtensionAPIService !== 'undefined') {
      this.apiService = new (ExtensionAPIService || window.ExtensionAPIService)();
    }
    
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
        const data = result.data;
        
        if (data && data.id) {
          this.showProgressPopup(data.id);
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
          <div class="loading-spinner"></div>
          <p class="status-text">Starting...</p>
          <div class="loading-bar">
            <div class="loading-progress animated" id="progress-bar"></div>
          </div>
          <p class="stage-text">Initializing monitoring...</p>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.summaryPopup = popup;

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.removeExistingPopup();
    });

    console.log('[Extension] showProgressPopup called for docId:', docId);
    this.connectToProgressStream(docId, popup);
  }

  connectToProgressStream(docId, popup) {
    console.log('[Extension] Starting progress monitoring for docId:', docId);
    const config = window.ExtensionConfig || new ExtensionConfig();
    const progressUrl = `${config.getApiUrl()}/api/v1/progress/${docId}`;
    
    if (popup) {
      this.updateProgressUI(popup, 'Starting...', 'Initializing monitoring...', 5);
    }
    
    this.checkSummaryImmediately(docId, popup).then(hasSummary => {
      if (hasSummary) {
        console.log('[Extension] Summary found immediately, stopping monitoring');
        return; 
      }
      
      this.pollForCompletion(docId, popup);
      
      this.startEventSource(progressUrl, docId, popup);
    }).catch(err => {
      console.error('[Extension] Error in immediate check, starting polling anyway:', err);
      this.pollForCompletion(docId, popup);
      this.startEventSource(progressUrl, docId, popup);
    });
  }

  startEventSource(progressUrl, docId, popup) {
    try {
      const eventSource = new EventSource(progressUrl);
      let hasReceivedUpdate = false;
      
      eventSource.onopen = () => {
        console.log('[Extension] EventSource connected to progress stream');
      };

      eventSource.onmessage = async (event) => {
        try {
          hasReceivedUpdate = true;
          const data = JSON.parse(event.data);
          console.log('[Extension] EventSource progress update:', data);

          if (data.stage === 'CONNECTED' || data.stage === 'HEARTBEAT') {
            return;
          }

          const stageMap = {
            'QUEUED': { text: 'Preparing...', progress: 10 },
            'FETCHING_HTML': { text: 'Fetching content...', progress: 20 },
            'CLEANING': { text: 'Cleaning content...', progress: 40 },
            'INGESTING': { text: 'Analyzing content...', progress: 55 },
            'SUMMARIZING': { text: 'Generating summary...', progress: 80 },
            'FINALIZING': { text: 'Finalizing...', progress: 95 },
            'COMPLETED': { text: 'Complete!', progress: 100 },
            'ERROR': { text: 'Error occurred', progress: 0 }
          };

          const stageInfo = stageMap[data.stage] || { text: data.stage, progress: 50 };
          this.updateProgressUI(popup, stageInfo.text, `Stage: ${data.stage}`, stageInfo.progress);

          if (data.stage === 'COMPLETED') {
            eventSource.close();
            if (popup && popup._pollInterval) {
              clearInterval(popup._pollInterval);
            }
            setTimeout(() => {
              this.fetchAndShowSummary(docId);
            }, 500);
          } else if (data.stage === 'ERROR') {
            eventSource.close();
            if (popup && popup._pollInterval) {
              clearInterval(popup._pollInterval);
            }
            this.showErrorPopup('Summarization failed. Please try again.');
          }
        } catch (error) {
          console.error('[Extension] Error parsing progress:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.warn('[Extension] EventSource error (polling will continue):', error);
      };

      popup._eventSource = eventSource;
    } catch (error) {
      console.warn('[Extension] EventSource not available (polling will handle it):', error);
    }
  }

  async checkSummaryImmediately(docId, popup) {
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'getSummary',
        docId: docId
      });
      
      if (result && result.success && result.data) {
        const summaryData = result.data;
        if (summaryData && summaryData.summary) {
          console.log('[Extension] Immediate check: Summary found!');
          if (popup && popup._eventSource) {
            popup._eventSource.close();
          }
          if (popup && popup._pollInterval) {
            clearInterval(popup._pollInterval);
          }
          this.updateProgressUI(popup, 'Complete!', 'Loading summary...', 100);
          setTimeout(() => {
            this.showSummaryPopup(summaryData.summary);
          }, 500);
          return true; 
        }
      }
      console.log('[Extension] Immediate check: Summary not ready yet');
      return false; 
    } catch (error) {
      return false;
    }
  }

  updateProgressUI(popup, statusText, stageText, progress) {
    if (!popup || !popup.parentNode) return;
    
    const statusEl = popup.querySelector('.status-text');
    const stageEl = popup.querySelector('.stage-text');
    const progressBar = popup.querySelector('#progress-bar');
    
    if (statusEl) statusEl.textContent = statusText;
    if (stageEl) stageEl.textContent = stageText;
    if (progressBar) {
      progressBar.classList.remove('animated');
      progressBar.style.width = `${progress}%`;
      progressBar.style.transition = 'width 0.5s ease';
    }
  }

  pollForCompletion(docId, popup = null) {
    const maxAttempts = 120; 
    let attempts = 0;
    let lastStage = 'QUEUED';
    let pollInterval = null;
    let isStopped = false;

    const poll = async () => {
      if (isStopped || (popup && !popup.parentNode)) {
        if (pollInterval) clearInterval(pollInterval);
        return;
      }

      attempts++;
      console.log(`[Extension] Polling attempt ${attempts}/${maxAttempts} for docId: ${docId}`);

      try {
        let summaryData;
        const result = await chrome.runtime.sendMessage({
          action: 'getSummary',
          docId: docId
        });
        
        if (result && result.success && result.data) {
          summaryData = result.data;
        } else if (result && result.error) {
          const is404 = result.error.includes('404') || result.error.includes('not found') || result.error.includes('Summary not found');
          if (is404) {
            if (popup) {
              const stages = ['QUEUED', 'FETCHING_HTML', 'CLEANING', 'INGESTING', 'SUMMARIZING'];
              const currentStage = stages[Math.min(Math.floor(attempts / 8), stages.length - 1)];
              if (currentStage !== lastStage) {
                lastStage = currentStage;
                const progress = Math.min(10 + (attempts * 0.75), 90);
                this.updateProgressUI(popup, `Processing...`, `Stage: ${currentStage} (check ${attempts})`, progress);
              } else {
                const progress = Math.min(10 + (attempts * 0.75), 90);
                this.updateProgressUI(popup, `Processing...`, `Checking for summary (attempt ${attempts}/${maxAttempts})...`, progress);
              }
            }
            if (attempts >= maxAttempts) {
              isStopped = true;
              if (pollInterval) clearInterval(pollInterval);
              if (popup) this.removeExistingPopup();
              this.showErrorPopup('Summarization timed out. Please try again.');
            }
            return; 
          } else {
            if (attempts >= maxAttempts) {
              isStopped = true;
              if (pollInterval) clearInterval(pollInterval);
              if (popup) this.removeExistingPopup();
              this.showErrorPopup('Error fetching summary. Please try again.');
            }
            return; 
          }
        } else {
          if (attempts >= maxAttempts) {
            isStopped = true;
            if (pollInterval) clearInterval(pollInterval);
            if (popup) this.removeExistingPopup();
            this.showErrorPopup('Unexpected error. Please try again.');
          }
          return; 
        }
        
        if (summaryData && summaryData.summary) {
          isStopped = true;
          if (pollInterval) clearInterval(pollInterval);
          if (popup && popup._eventSource) {
            popup._eventSource.close();
          }
          if (popup) {
            this.updateProgressUI(popup, 'Complete!', 'Loading summary...', 100);
          }
          setTimeout(() => {
            this.showSummaryPopup(summaryData.summary);
          }, 500);
          return;
        } else {
          if (attempts >= maxAttempts) {
            isStopped = true;
            if (pollInterval) clearInterval(pollInterval);
            if (popup) this.removeExistingPopup();
            this.showErrorPopup('Summarization timed out. Please try again.');
          }
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          isStopped = true;
          if (pollInterval) clearInterval(pollInterval);
          if (popup) this.removeExistingPopup();
          this.showErrorPopup('Summarization timed out. Please try again.');
        }
      }
    };

    
    if (popup) {
      this.updateProgressUI(popup, 'Checking...', 'Polling for summary...', 10);
    }
    
    setTimeout(() => {
      poll();
    }, 500); 
    
    pollInterval = setInterval(() => {
      poll();
    }, 3000);
    
    if (popup) {
      popup._pollInterval = pollInterval;
      popup._pollingActive = true;
    }
    
    console.log('[Extension] Polling started, will check every 3 seconds');
  }

  async pollForCompletion(docId) {
    const maxAttempts = 60; 
    let attempts = 0;

    const poll = async () => {
      try {
        let summaryData;
        if (this.apiService) {
          try {
            summaryData = await this.apiService.getSummary(docId);
          } catch (apiError) {
            if (apiError.message && apiError.message.includes('404')) {
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(poll, 5000);
              } else {
                this.showErrorPopup('Summarization timed out. Please try again.');
              }
              return;
            }
            throw apiError;
          }
        } else {
          const result = await chrome.runtime.sendMessage({
            action: 'getSummary',
            docId: docId
          });
          if (result && result.success && result.data) {
            summaryData = result.data;
          } else if (result && result.error && result.error.includes('404')) {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000);
            } else {
              this.showErrorPopup('Summarization timed out. Please try again.');
            }
            return;
          } else {
            throw new Error(result?.error || 'Failed to fetch summary');
          }
        }
        
        if (summaryData && summaryData.summary) {
          this.showSummaryPopup(summaryData.summary);
          return;
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000);
          } else {
            this.showErrorPopup('Summarization timed out. Please try again.');
          }
        }
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

      if (summary.content_type) {
        const typeSpecificContent = this.getTypeSpecificContent(summary);
        if (typeSpecificContent) {
          formatted += `<div class="summary-section">
            <h4>📈 Analysis Details</h4>
            <div class="analysis-details">${typeSpecificContent}</div>
          </div>`;
        }
      }

      return formatted || '<div class="summary-text">No summary content available.</div>';
    }

    return '<div class="summary-text">No summary content available.</div>';
  }

  getTypeSpecificContent(summary) {
    const { content_type } = summary;
    
    switch (content_type) {
      case 'reddit':
        return [
          summary.topic && `<p><strong>Topic:</strong> ${summary.topic}</p>`,
          summary.sentiment && `<p><strong>Sentiment:</strong> ${summary.sentiment}</p>`,
          summary.notable_comments && `<p><strong>Notable Comments:</strong> ${Array.isArray(summary.notable_comments) ? summary.notable_comments.join(', ') : summary.notable_comments}</p>`
        ].filter(Boolean).join('');
        
      case 'youtube':
        let formattedTimestamps = '';
        if (summary.key_timestamps) {
          if (Array.isArray(summary.key_timestamps)) {
            formattedTimestamps = summary.key_timestamps.map(ts => {
              if (typeof ts === 'string') {
                return ts;
              }
              if (!ts) return '';
              if (typeof ts === 'object') {
                if (ts.timestamp || ts.time) {
                  const timeValue = ts.timestamp || ts.time;
                  const description = ts.event || ts.description || ts.title || ts.text || '';
                  return `${timeValue}${description ? ` - ${description}` : ''}`;
                }
                const keys = Object.keys(ts);
                if (keys.length > 0) {
                  const timestamp = keys[0];
                  const description = ts[timestamp];
                  if (typeof description === 'string') {
                    return `${timestamp} - ${description}`;
                  } else if (typeof description === 'object' && description !== null) {
                    const descText = description.text || description.description || description.event || JSON.stringify(description);
                    return `${timestamp} - ${descText}`;
                  }
                  return `${timestamp} - ${String(description)}`;
                }
                return JSON.stringify(ts);
              }
              return String(ts);
            }).filter(ts => ts && ts.trim() !== '').join('<br>');
          } else if (typeof summary.key_timestamps === 'object') {
            const keys = Object.keys(summary.key_timestamps);
            formattedTimestamps = keys.map(key => {
              const value = summary.key_timestamps[key];
              if (typeof value === 'string') {
                return `${key} - ${value}`;
              } else if (typeof value === 'object' && value !== null) {
                return `${key} - ${JSON.stringify(value)}`;
              }
              return `${key} - ${String(value)}`;
            }).join('<br>');
          } else {
            formattedTimestamps = String(summary.key_timestamps);
          }
        }
        
        return [
          summary.topic && `<p><strong>Topic:</strong> ${summary.topic}</p>`,
          summary.duration_estimate && `<p><strong>Duration:</strong> ${summary.duration_estimate}</p>`,
          formattedTimestamps && formattedTimestamps.trim() && `<p><strong>Key Timestamps:</strong><br>${formattedTimestamps}</p>`
        ].filter(Boolean).join('');
        
      case 'shopping':
        return [
          summary.product_name && `<p><strong>Product:</strong> ${summary.product_name}</p>`,
          summary.price_range && `<p><strong>Price Range:</strong> ${summary.price_range}</p>`,
          summary.key_features && `<p><strong>Features:</strong> ${summary.key_features}</p>`,
          summary.ratings && `<p><strong>Ratings:</strong> ${summary.ratings}</p>`
        ].filter(Boolean).join('');
        
      case 'twitch':
        return [
          summary.topic && `<p><strong>Topic:</strong> ${summary.topic}</p>`,
          summary.streamer && `<p><strong>Streamer:</strong> ${summary.streamer}</p>`,
          summary.chat_highlights && `<p><strong>Chat Highlights:</strong> ${summary.chat_highlights}</p>`
        ].filter(Boolean).join('');
        
      case 'webpage':
        return [
          summary.page_type && `<p><strong>Page Type:</strong> ${summary.page_type}</p>`,
          summary.topic && `<p><strong>Topic:</strong> ${summary.topic}</p>`,
          summary.author && `<p><strong>Author:</strong> ${summary.author}</p>`,
          summary.publication_date && `<p><strong>Published:</strong> ${summary.publication_date}</p>`
        ].filter(Boolean).join('');
        
      default:
        return null;
    }
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
      if (this.summaryPopup._eventSource) {
        this.summaryPopup._eventSource.close();
      }
      if (this.summaryPopup._pollInterval) {
        clearInterval(this.summaryPopup._pollInterval);
      }
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
