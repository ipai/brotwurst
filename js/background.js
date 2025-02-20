// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
});

// Store media files for each tab
const tabMediaFiles = new Map();

// Scan for media when page is loaded
chrome.webNavigation.onCompleted.addListener((details) => {
    // Only handle main frame navigation
    if (details.frameId === 0) {
        console.log('Page loaded, scanning for media:', details.tabId);
        scanForMedia(details.tabId);
    }
});

// Function to scan for media in a tab
function scanForMedia(tabId) {
    // Check if we can access the tab
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
            console.error('Tab access error:', chrome.runtime.lastError);
            return;
        }

        // Skip chrome:// and edge:// URLs
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
            console.log('Skipping browser page:', tab.url);
            return;
        }

        // Try to send message first, if it fails then inject scripts
        chrome.tabs.sendMessage(tabId, { action: 'scanForMedia' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Content script not ready, injecting...');
                // Inject both scripts in sequence
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['js/media-detector.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Media detector script injection error:', chrome.runtime.lastError);
                        return;
                    }
                    
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['js/content.js']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Content script injection error:', chrome.runtime.lastError);
                            return;
                        }

                        // Try scanning again after injection
                        chrome.tabs.sendMessage(tabId, { action: 'scanForMedia' }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error('Message error after injection:', chrome.runtime.lastError);
                                return;
                            }

                            if (response && response.mediaFiles) {
                                tabMediaFiles.set(tabId, response.mediaFiles);
                                updateBadge(tabId, response.mediaFiles.length);
                            }
                        });
                    });
                });
            } else if (response && response.mediaFiles) {
                tabMediaFiles.set(tabId, response.mediaFiles);
                updateBadge(tabId, response.mediaFiles.length);
            }
        });
    });
}

// Function to update badge
function updateBadge(tabId, count) {
    console.log('Updating badge with count:', count);
    try {
        chrome.action.setBadgeText({ 
            text: count > 0 ? count.toString() : '',
            tabId: tabId
        }).then(() => {
            console.log('Badge text set successfully');
            return chrome.action.setBadgeBackgroundColor({ 
                color: '#4285f4',
                tabId: tabId
            });
        }).then(() => {
            console.log('Badge color set successfully');
        }).catch(error => {
            console.error('Error setting badge:', error);
        });
    } catch (error) {
        console.error('Error in badge update:', error);
    }
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request.action);

    if (request.action === 'getMediaFiles') {
        // Ensure tab exists and is ready
        chrome.tabs.get(request.tabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('Tab error:', chrome.runtime.lastError);
                sendResponse({ error: 'Tab not found' });
                return;
            }

            // Inject content script if needed
            chrome.scripting.executeScript({
                target: { tabId: request.tabId },
                files: ['js/content.js']
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Script injection error:', chrome.runtime.lastError);
                    sendResponse({ error: 'Could not inject content script' });
                    return;
                }

                // Inject media-detector.js first
                chrome.scripting.executeScript({
                    target: { tabId: request.tabId },
                    files: ['js/media-detector.js']
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Media detector script injection error:', chrome.runtime.lastError);
                        sendResponse({ error: 'Could not inject media detector script' });
                        return;
                    }

                    // Now that we're sure both scripts are there, send the message
                    chrome.tabs.sendMessage(request.tabId, { action: 'scanForMedia' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Message error:', chrome.runtime.lastError);
                            sendResponse({ error: 'Could not scan for media' });
                            return;
                        }

                        if (response && response.mediaFiles) {
                            tabMediaFiles.set(request.tabId, response.mediaFiles);
                            // Update badge with number of media files
                            const count = response.mediaFiles.length;
                            console.log('Updating badge with count:', count);
                            try {
                                chrome.action.setBadgeText({ 
                                    text: count > 0 ? count.toString() : '',
                                    tabId: request.tabId
                                }).then(() => {
                                    console.log('Badge text set successfully');
                                    return chrome.action.setBadgeBackgroundColor({ 
                                        color: '#4285f4',
                                        tabId: request.tabId
                                    });
                                }).then(() => {
                                    console.log('Badge color set successfully');
                                    // Send the response with media files
                                    sendResponse({ mediaFiles: response.mediaFiles });
                                })
                                .catch(error => {
                                    console.error('Error setting badge:', error);
                                });
                            } catch (error) {
                                console.error('Error in badge update:', error);
                                sendResponse({ error: 'Error updating badge' });
                            }
                        }
                    });
                });
            });
        });

        return true; // Will respond asynchronously
    }

    if (request.action === 'downloadFile') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename
        });
        return true;
    }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener(tabId => {
    tabMediaFiles.delete(tabId);
    // Clear badge when tab is closed
    chrome.action.setBadgeText({ 
        text: '',
        tabId: tabId
    });
});
