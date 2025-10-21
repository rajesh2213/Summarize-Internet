class PopupController {
  constructor() {
    this.apiService = new ExtensionAPIService();
    this.currentTab = null;
    this.isProcessing = false;
    this.init();
    this.preventOutsideClicks();
  }

  async init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;

    await this.checkAuthStatus();

    this.bindEventListeners();
    this.setupAuthListener();
  }

  setupAuthListener() {
    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
      if (request.action === 'authStatusChanged') {
        await this.updateAuthUI(request.isAuthenticated);
      }
    });
  }

  bindEventListeners() {
    document.getElementById('summarize-current-page').addEventListener('click', () => {
      this.handleSummarizeCurrentPage();
    });

    document.getElementById('summarize-custom-url').addEventListener('click', () => {
      this.handleSummarizeCustomUrl();
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    document.getElementById('close-summary').addEventListener('click', () => {
      this.closeSummary();
    });

    document.getElementById('copy-summary').addEventListener('click', () => {
      this.copySummary();
    });

    document.getElementById('new-summary').addEventListener('click', () => {
      this.resetToMain();
    });

    document.getElementById('view-full-site').addEventListener('click', () => {
      this.openFullSite();
    });

    document.getElementById('retry-btn').addEventListener('click', () => {
      this.handleRetry();
    });

    document.getElementById('help-btn').addEventListener('click', () => {
      this.openHelp();
    });

    document.getElementById('custom-url').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSummarizeCustomUrl();
      }
    });
  }

  async checkAuthStatus() {
    try {
      const isAuthenticated = await this.apiService.checkAuthStatus();
      await this.updateAuthUI(isAuthenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
      await this.updateAuthUI(false);
    }
  }

  async updateAuthUI(isAuthenticated) {
    const authSection = document.getElementById('auth-section');
    const logoutSection = document.getElementById('logout-section');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (isAuthenticated) {
      const { username } = await chrome.storage.local.get(['username']);
      
      const welcomeSection = document.querySelector('.welcome-section');
      const userDiv = document.createElement('h3');
      userDiv.textContent = username ? `Hello, ${username}!` : 'Hello,';
      welcomeSection.prepend(userDiv);
      
      authSection.style.display = 'none';
      logoutSection.style.display = 'block';
      
      logoutBtn.onclick = () => this.handleLogout();
    } else {
      logoutSection.style.display = 'none';
      authSection.style.display = 'block';
      
      loginBtn.onclick = () => this.apiService.redirectToAuth('/login');
    }
  }

  async handleLogout() {
    try {
      await this.updateAuthUI(false);
      this.apiService.redirectToAuth('');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  showMainContent() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('status-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'none';
    document.getElementById('error-section').style.display = 'none';
    
    // Show main sections
    const welcomeSection = document.querySelector('.welcome-section');
    const actionSection = document.querySelector('.action-section');
    if (welcomeSection) welcomeSection.style.display = 'block';
    if (actionSection) actionSection.style.display = 'block';
  }

  showStatus(message, showProgress = false) {
    
    // Hide other sections within main-content, but keep main-content visible
    const welcomeSection = document.querySelector('.welcome-section');
    const actionSection = document.querySelector('.action-section');
    const authSection = document.getElementById('auth-section');
    const logoutSection = document.getElementById('logout-section');
    const resultSection = document.getElementById('result-section');
    const errorSection = document.getElementById('error-section');
    
    if (welcomeSection) welcomeSection.style.display = 'none';
    if (actionSection) actionSection.style.display = 'none';
    if (authSection) authSection.style.display = 'none';
    if (logoutSection) logoutSection.style.display = 'none';
    if (resultSection) resultSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'none';
    
    // Show status section
    document.getElementById('status-section').style.display = 'block';
    document.getElementById('status-message').textContent = message;
    
    const progressBar = document.getElementById('progress-bar');
    if (showProgress) {
      progressBar.style.display = 'block';
      progressBar.style.visibility = 'visible';
      progressBar.style.opacity = '1';
    } else {
      progressBar.style.display = 'none';
    }
  }

  showResult(summary) {
    
    // Show main content and hide status section
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('status-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'block';
    
    // Hide progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.display = 'none';
    }
    
    const summaryContent = document.getElementById('summary-content');
    const formattedSummary = this.formatSummary(summary);
    summaryContent.innerHTML = formattedSummary;
    
    // Smoothly expand the popup width
    this.expandPopup();
  }

  expandPopup() {
    const popupContainer = document.querySelector('.popup-container');
    const body = document.body;
    if (popupContainer && body) {
      popupContainer.classList.add('expanded');
      body.classList.add('expanded');
    } else {
      console.error('📄 Extension: Popup container or body not found');
    }
  }

  closeSummary() {
    
    // Hide result section and show main content
    document.getElementById('result-section').style.display = 'none';
    this.showMainContent();
    
    // Contract the popup width
    this.contractPopup();
  }

  contractPopup() {
    const popupContainer = document.querySelector('.popup-container');
    const body = document.body;
    if (popupContainer && body) {
      popupContainer.classList.remove('expanded');
      body.classList.remove('expanded');
    } else {
      console.error('📄 Extension: Popup container or body not found');
    }
  }

  preventOutsideClicks() {
    // Prevent the popup from closing when clicking outside
    document.addEventListener('click', (event) => {
      // Only prevent if the click is outside the popup container
      const popupContainer = document.getElementById('popup-container');
      if (popupContainer && !popupContainer.contains(event.target)) {
        event.stopPropagation();
        event.preventDefault();
      }
    });

    // Prevent the popup from closing when clicking on the popup itself
    document.getElementById('popup-container').addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  showError(message) {
    document.getElementById('status-section').style.display = 'none';
    document.getElementById('error-section').style.display = 'block';
    document.getElementById('error-message').textContent = message;
    
    // Hide progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.display = 'none';
    }
  }

  formatSummary(summary) {
    
    if (typeof summary === 'string') {
      return `<div class="summary-text">${summary}</div>`;
    }

    if (typeof summary === 'object' && summary !== null) {
      let formatted = '';

      if (summary.tldr) {
        formatted += `<div class="summary-section">
          <h5>📋 TL;DR</h5>
          <p>${summary.tldr}</p>
        </div>`;
      }

      if (summary.bullets && Array.isArray(summary.bullets)) {
        formatted += `<div class="summary-section">
          <h5>🔑 Key Points</h5>
          <ul>${summary.bullets.map(bullet => `<li>${bullet}</li>`).join('')}</ul>
        </div>`;
      }

      if (summary.key_sections && Array.isArray(summary.key_sections)) {
        formatted += `<div class="summary-section">
          <h5>📖 Key Sections</h5>
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

  async handleSummarizeCurrentPage() {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      this.showStatus('Submitting your request...');

      const result = await this.apiService.submitUrl(this.currentTab.url);
      
      if (result.existing) {
        await this.fetchAndShowSummary(result.id);
      } else {
        this.showStatus('Processing your request...', true);
        await this.pollForCompletion(result.id);
      }

    } catch (error) {
      console.error('❌ Extension: Summarization error:', error);
      this.showError(error.message || 'Failed to summarize the page');
    } finally {
      this.isProcessing = false;
    }
  }

  async handleSummarizeCustomUrl() {
    if (this.isProcessing) return;

    const urlInput = document.getElementById('custom-url');
    const url = urlInput.value.trim();

    if (!url) {
      urlInput.focus();
      return;
    }

    try {
      this.isProcessing = true;
      this.showStatus('Submitting your request...');

      const result = await this.apiService.submitUrl(url);
      
      if (result.existing) {
        await this.fetchAndShowSummary(result.id);
      } else {
        this.showStatus('Processing your request...', true);
        await this.pollForCompletion(result.id);
      }

    } catch (error) {
      console.error('Summarization error:', error);
      this.showError(error.message || 'Failed to summarize the URL');
    } finally {
      this.isProcessing = false;
    }
  }

  async fetchAndShowSummary(docId) {
    try {
      const summaryData = await this.apiService.getSummary(docId);
      this.showResult(summaryData.summary);
    } catch (error) {
      this.showError('Failed to fetch summary');
    }
  }

  async pollForCompletion(docId) {
    
    try {
      // Use Server-Sent Events for real-time progress updates
      await this.monitorProgress(docId);
    } catch (error) {
      console.error('Progress monitoring failed:', error);
      this.showError('Failed to monitor progress. Please try again.');
    }
  }

  async monitorProgress(docId) {
    const config = window.ExtensionConfig || new ExtensionConfig();
    const progressUrl = `${config.getApiUrl()}/api/v1/progress/${docId}`;
    
    console.log('📡 Extension: Connecting to progress stream:', progressUrl);
    console.log('📡 Extension: Config API URL:', config.getApiUrl());
    
    const eventSource = new EventSource(progressUrl);
    
    eventSource.onopen = () => {
      console.log('📡 Extension: Connected to progress stream');
    };

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 Extension: Received progress update:', data);

        if (data.stage === "CONNECTED") {
          console.log('📡 Extension: Connection confirmed');
          return;
        }

        if (data.stage === "HEARTBEAT") {
          console.log('📡 Extension: Heartbeat received');
        return;
        }

        // Update status message based on stage
        this.updateProgressStatus(data.stage);

        if (data.stage === "COMPLETED") {
          console.log('📡 Extension: Processing completed');
          eventSource.close();
          
          if (data.summary) {
            console.log('📡 Extension: Showing result with received summary');
            this.showResult(data.summary);
        } else {
            console.log('📡 Extension: Fetching summary from API');
            // Fetch the summary if not included in the event
            await this.fetchAndShowSummary(docId);
          }
        } else if (data.stage === "ERROR") {
          console.error('📡 Extension: Processing failed');
          eventSource.close();
          this.showError('Processing failed. Please try again.');
        }
      } catch (error) {
        console.error('📡 Extension: Error parsing progress message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('📡 Extension: EventSource error:', error);
      eventSource.close();
      this.showError('Connection lost. Please try again.');
    };

    // Set a timeout to close the connection if it takes too long
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        console.warn('📡 Extension: Progress monitoring timeout');
        eventSource.close();
        this.showError('Processing timed out. Please try again.');
      }
    }, 300000); // 5 minutes timeout
  }

  updateProgressStatus(stage) {
    console.log('📊 Extension: Updating progress status for stage:', stage);
    
    // Use the same status messages as the client
    const statusMap = {
      'QUEUED': { stage: "Preparing", step: 1, progress: 10 },
      'FETCHING_HTML': { stage: "Preparing", step: 1, progress: 20 },
      'CLEANING': { stage: "Analyzing", step: 2, progress: 40 },
      'INGESTING': { stage: "Analyzing", step: 2, progress: 55 },
      'SUMMARIZING': { stage: "Summarizing", step: 3, progress: 80 },
      'FINALIZING': { stage: "Finishing", step: 4, progress: 95 },
      'COMPLETED': { stage: "Done", step: 5, progress: 100 },
      'ERROR': { stage: "Something went wrong", step: 5, progress: 100 }
    };

    const status = statusMap[stage] || { stage: "Processing", step: 1, progress: 30 };
    console.log('📊 Extension: Status mapping result:', status);
    
    // Update status message
    this.showStatus(status.stage, true);
    
    // Update progress bar
    this.updateProgressBar(status.progress);
  }

  updateProgressBar(progress) {
    console.log('📊 Extension: Updating progress bar to:', progress + '%');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = progressBar?.querySelector('.progress-fill');
    
    if (progressBar && progressFill) {
      console.log('📊 Extension: Progress bar elements found, updating');
      
      // Ensure progress bar is visible
      progressBar.style.display = 'block';
      progressBar.style.visibility = 'visible';
      progressBar.style.opacity = '1';
      
      // Completely disable animation and set width
      progressFill.style.animation = 'none';
      progressFill.style.transition = 'none';
      progressFill.style.width = `${progress}%`;
      progressFill.style.minWidth = `${progress}%`;
      progressFill.style.maxWidth = `${progress}%`;
      
      // Force a reflow to ensure the changes take effect
      progressFill.offsetHeight;
      
      console.log('📊 Extension: Progress fill width set to:', progressFill.style.width);
      console.log('📊 Extension: Progress bar computed width:', window.getComputedStyle(progressFill).width);
      
      // Check the actual dimensions and visibility
      const progressBarRect = progressBar.getBoundingClientRect();
      const progressFillRect = progressFill.getBoundingClientRect();
      
      console.log('📊 Extension: Progress bar dimensions:', {
        width: progressBarRect.width,
        height: progressBarRect.height,
        top: progressBarRect.top,
        left: progressBarRect.left,
        visible: progressBarRect.width > 0 && progressBarRect.height > 0
      });
      
      console.log('📊 Extension: Progress fill dimensions:', {
        width: progressFillRect.width,
        height: progressFillRect.height,
        top: progressFillRect.top,
        left: progressFillRect.left,
        visible: progressFillRect.width > 0 && progressFillRect.height > 0
      });
      
      // Check if the progress bar is actually visible in the viewport
      const statusSection = document.getElementById('status-section');
      const statusSectionRect = statusSection.getBoundingClientRect();
      console.log('📊 Extension: Status section dimensions:', {
        width: statusSectionRect.width,
        height: statusSectionRect.height,
        top: statusSectionRect.top,
        left: statusSectionRect.left,
        visible: statusSectionRect.width > 0 && statusSectionRect.height > 0
      });
      
    } else {
      console.error('📊 Extension: Progress bar elements not found!', {
        progressBar: !!progressBar,
        progressFill: !!progressFill
      });
    }
  }

  async copySummary() {
    const summaryContent = document.getElementById('summary-content');
    const text = summaryContent.textContent || summaryContent.innerText;
    
    try {
      await navigator.clipboard.writeText(text);
      this.showCopyNotification();
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }

  showCopyNotification() {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = 'Copied to clipboard!';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  resetToMain() {
    this.showMainContent();
  }

  openFullSite() {
    const config = window.ExtensionConfig || new ExtensionConfig();
    chrome.tabs.create({
      url: config.getFrontendUrl()
    });
    window.close();
  }

  handleRetry() {
    this.showMainContent();
  }

  openHelp() {
    const config = window.ExtensionConfig || new ExtensionConfig();
    chrome.tabs.create({
      url: config.getFrontendUrl()
    });
    window.close();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
