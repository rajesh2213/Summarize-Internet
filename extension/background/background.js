chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarize-page',
    title: 'Summarize this page',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'summarize-selection',
    title: 'Summarize this page',
    contexts: ['selection']
  });
});

async function ensureInjected(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'pingSummarizer'}).catch(() => null)

    if(res && res.pong) {
      return true;
    }

    await new Promise(r => setTimeout(r, 2000))
    
    const res2 = await chrome.tabs.sendMessage(tabId, { action: 'pingSummarizer'}).catch(() => null)
    if(res2 && res2.pong) {
      return true;
    }

    try {
      await chrome.scripting.executeScript({
        target: {tabId},
        files: ['content/simple-content.js']
      });
      
      await new Promise(r => setTimeout(r, 1000));
      
      const testResult = await chrome.scripting.executeScript({
        target: {tabId},
        func: () => {
          if (window.testSummarizeExtension) {
            return window.testSummarizeExtension();
          }
          return 'Simple content script not loaded';
        }
      });
      
      if (testResult && testResult[0] && testResult[0].result === 'Extension is working!') {
        await chrome.scripting.executeScript({
          target: {tabId},
          files: ['content/content.js']
        });
        
        await new Promise(r => setTimeout(r, 1000));
        
        const fullTestResult = await chrome.scripting.executeScript({
          target: {tabId},
          func: () => {
            if (window.testSummarizeExtension) {
              return window.testSummarizeExtension();
            }
            return 'Full content script not loaded';
          }
        });
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      try {
        const testResult = await chrome.scripting.executeScript({
          target: {tabId},
          func: () => {
            if (window.testSummarizeExtension) {
              return window.testSummarizeExtension();
            }
            return 'Extension not loaded';
          }
        });
      } catch (testError) {
        // Test execution failed
      }
      
      try {
        await chrome.scripting.executeScript({
          target: {tabId},
          func: () => {
            return 'Test execution successful';
          }
        });
      } catch (testError) {
        // Basic test execution failed
      }
      
      const res3 = await chrome.tabs.sendMessage(tabId, { action: 'pingSummarizer'}).catch(() => null)
      if(res3 && res3.pong) {
        return true;
      }
    } catch (injectError) {
      // Manual injection failed
    }

    return false
  } catch (err) {
    return false
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if(!tab || !tab.id) {
    return;
  }
  
  const injected = await ensureInjected(tab.id)
  if(!injected) {
    return;
  }

  if (info.menuItemId === 'summarize-page') {
    chrome.tabs.sendMessage(tab.id, { 
      action: 'summarize', 
      url: tab.url 
    }).catch(error => {
      console.error('Failed to send message:', error);
    });
  } else if (info.menuItemId === 'summarize-selection') {
    chrome.tabs.sendMessage(tab.id, { 
        action: 'summarize', 
        url: tab.url 
    }).catch(error => {
      console.error('Failed to send message:', error);
    });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'summarize-page' && tab && tab.id) {
    const injected = await ensureInjected(tab.id)
    if(!injected) return;

    chrome.tabs.sendMessage(tab.id, { 
      action: 'summarize', 
      url: tab.url 
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    chrome.storage.local.get(['accessToken'], (result) => {
      sendResponse({ isAuthenticated: !!result.accessToken });
    });
    return true; 
  }
  
  if (request.action === 'redirectToAuth') {
    const frontendUrl = 'http://localhost:5173';
    const endpoint = request.endpoint || '';
    const url = endpoint.startsWith('/') 
      ? `${frontendUrl}${endpoint}`
      : `${frontendUrl}/${endpoint}`;
    
    chrome.tabs.create({ url });
    sendResponse({ success: true });
  }

  if (request.action === 'summarizeUrl') {
    handleSummarizeUrl(request.url, sendResponse);
    return true;
  }

  if (request.action === 'getSummary') {
    handleGetSummary(request.docId, sendResponse);
    return true;
  }

  if (request.action === 'authUpdate') {
    if (request.authData) {
      chrome.storage.local.set({
        accessToken: request.authData.accessToken,
        username: request.authData.username
      });
      
      chrome.runtime.sendMessage({
        action: 'authStatusChanged',
        isAuthenticated: true,
        username: request.authData.username
      }).catch((error) => {
        if (!error.message.includes('Could not establish connection')) {
          console.error('Error sending auth status:', error);
        }
      });
    } else {
      chrome.storage.local.remove(['accessToken', 'refreshToken', 'username']);
      
      chrome.runtime.sendMessage({
        action: 'authStatusChanged',
        isAuthenticated: false
      }).catch((error) => {
        if (!error.message.includes('Could not establish connection')) {
          console.error('Error sending auth status:', error);
        }
      });
    }
    sendResponse({ success: true });
  }
});

async function handleSummarizeUrl(url, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['accessToken']);
    const accessToken = result.accessToken;
    
    const response = await fetch('http://localhost:4000/api/v1/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, data: data });
    
  } catch (error) {
    console.error('API call failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetSummary(docId, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['accessToken']);
    const accessToken = result.accessToken;
    
    const response = await fetch(`http://localhost:4000/api/v1/summary/${docId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    sendResponse({ success: true, data: data });
    
  } catch (error) {
    console.error('Summary API call failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

