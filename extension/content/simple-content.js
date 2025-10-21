// MINIMAL CONTENT SCRIPT
console.log('🔍 SIMPLE: Content script loaded');

// Add test function
window.testSummarizeExtension = function() {
  console.log('🧪 SIMPLE: Test function called');
  return 'Extension is working!';
};

console.log('🔍 SIMPLE: Test function added');

// Add message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🔍 SIMPLE: Received message:', request);
  
  if (request.action === 'pingSummarizer') {
    console.log('🏓 SIMPLE: Responding to ping');
    sendResponse({ pong: true });
    return true;
  }
  
  // Don't handle summarize action - let the full content script handle it
  if (request.action === 'summarize') {
    console.log('📄 SIMPLE: Ignoring summarize request - letting full content script handle it');
    return false; // Don't handle this message
  }
});

console.log('🔍 SIMPLE: Message listener added');
