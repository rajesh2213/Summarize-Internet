
(function() {
  'use strict';

  function sendAuthUpdate(authData, retryCount = 0) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({
        action: 'authUpdate',
        authData: authData
      }).catch((error) => {
        if (error.message.includes('Could not establish connection')) {
          if (retryCount < 3) {
            setTimeout(() => {
              sendAuthUpdate(authData, retryCount + 1);
            }, 1000 * (retryCount + 1));
          }
        } else {
          console.error('Website Auth Sync: Extension error:', error);
        }
      });
    }
  }

  function detectLogin() {
    const authIndicators = [
      localStorage.getItem('accessToken'),
      localStorage.getItem('authToken'),
      localStorage.getItem('username'),

      document.cookie.includes('refreshToken'),
    ];

    const isLoggedIn = authIndicators.some(indicator => indicator !== null);

    if (isLoggedIn) {
      const username = localStorage.getItem('username');
      const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken');
      
      if (accessToken && username) {
        sendAuthUpdate({
          accessToken: accessToken,
          username: username
        });
      }
    }
  }

  function detectLogout() {
    const authIndicators = [
      localStorage.getItem('accessToken'),
      localStorage.getItem('authToken'),
      localStorage.getItem('username')
    ];

    const isLoggedOut = authIndicators.every(indicator => indicator === null);

    if (isLoggedOut) {
      sendAuthUpdate(null);
    }
  }


  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      setTimeout(() => {
        detectLogin();
        detectLogout();
      }, 1000); 
    }
  });

  if (document.body) {
    urlObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        urlObserver.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;

  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key === 'accessToken' || key === 'authToken' || key === 'username') {
      setTimeout(detectLogin, 100); 
    }
  };

  localStorage.removeItem = function(key) {
    originalRemoveItem.apply(this, arguments);
    if (key === 'accessToken' || key === 'authToken' || key === 'username') {
      setTimeout(detectLogout, 100);
    }
  };

  setTimeout(() => {
    detectLogin();
    detectLogout();
  }, 2000);

  let authUpdateTimeout;
  
  window.addEventListener('auth:login', (event) => {
    if (event.detail) {
      clearTimeout(authUpdateTimeout);
      authUpdateTimeout = setTimeout(() => {
        sendAuthUpdate(event.detail);
      }, 100); 
    }
  });

  window.addEventListener('auth:logout', () => {
    clearTimeout(authUpdateTimeout);
    authUpdateTimeout = setTimeout(() => {
      sendAuthUpdate(null);
    }, 100); 
  });

})();
