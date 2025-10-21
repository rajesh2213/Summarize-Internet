class ExtensionAPIService {
  constructor() {
    this.config = window.ExtensionConfig || new ExtensionConfig();
    this.baseURL = this.config.getApiUrl();
    this.accessToken = null;
    this.refreshToken = null;
    this.username = null;
  }

  async getTokens() {
    const result = await chrome.storage.local.get(['accessToken', 'refreshToken', 'username']);
    this.accessToken = result.accessToken;
    this.refreshToken = result.refreshToken;
    this.username = result.username;
    return result;
  }

  async setTokens(accessToken, refreshToken, username) {
    const data = { accessToken, username };
    if (refreshToken) data.refreshToken = refreshToken;
    
    await chrome.storage.local.set(data);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.username = username;
  }

  async clearTokens() {
    await chrome.storage.local.remove(['accessToken', 'refreshToken', 'username']);
    this.accessToken = null;
    this.refreshToken = null;
    this.username = null;
  }

  async makeRequest(endpoint, options = {}) {
    const { accessToken } = await this.getTokens();
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      defaultHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    let response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include'
    });

    if (response.status === 401 && accessToken) {
      try {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const { accessToken: newToken } = await this.getTokens();
          response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers: {
              ...defaultHeaders,
              ...options.headers,
              'Authorization': `Bearer ${newToken}`,
            },
            credentials: 'include'
          });
        }
      } catch (error) {
        console.warn('Token refresh failed:', error);
        await this.clearTokens();
        throw new Error('Authentication required');
      }
    }

    return response;
  }

  async submitUrl(url) {
    try {
      const response = await this.makeRequest('/api/v1/summarize', {
        method: 'POST',
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Service: Error response:', errorData);
        throw new Error(errorData.message || 'Failed to submit URL');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('API Service: API Error:', error);
      throw error;
    }
  }

  async getSummary(docId) {
    try {
      const response = await this.makeRequest(`/api/v1/summary/${docId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch summary');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        await this.setTokens(data.accessToken, null, data.user.username);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Refresh token failed:', error);
      return false;
    }
  }

  async checkAuthStatus() {
    const { accessToken } = await this.getTokens();
    return !!accessToken;
  }

  async logout() {
    try {
      await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      await this.clearTokens();
    }
  }

  redirectToAuth(endpoint) {
    const url = `${this.config.getFrontendUrl()}${endpoint || ''}`;
    chrome.tabs.create({ url });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionAPIService;
} else {
  window.ExtensionAPIService = ExtensionAPIService;
}
