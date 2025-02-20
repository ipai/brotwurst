// Store media files and their metadata per tab
const mediaFilesPerTab = new Map();

// Function to get media files for a tab
function getMediaFilesForTab(tabId) {
    return Array.from(mediaFilesPerTab.get(tabId)?.values() || []);
}

// Media file patterns and MIME types
const MEDIA_PATTERNS = {
    audio: /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)($|\?)/i,
    video: /\.(mp4|webm|mov|mkv|m4v|avi|wmv|flv|3gp)($|\?)/i,
    stream: /\/(manifest|playlist|stream|hls|\.m3u8|\.mpd)($|\?)/i
};

const MIME_TYPES = {
    audio: /^audio\//i,
    video: /^video\//i,
    stream: /^application\/(x-mpegURL|dash\+xml|vnd\.apple\.mpegurl|x-matroska|mp4|octet-stream)/i,
    // Additional MIME types that might indicate media content
    potential: /^(application\/(x-msvideo|x-ms-wmv|x-flv|x-mpg|quicktime)|video\/(?:x-)?[\w-]+)$/i
};

// Function to extract filename from Content-Disposition header or URL
function extractFileName(url, contentDisposition) {
    let fileName = '';
    
    // Try Content-Disposition header first
    if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
            fileName = matches[1].replace(/['"]*/g, '');
        }
    }
    
    // Fallback to URL
    if (!fileName) {
        const urlParts = url.split(/[#?]/);
        fileName = urlParts[0].split('/').pop() || 'unknown';
        // Decode URI components
        try {
            fileName = decodeURIComponent(fileName);
        } catch (e) {
            console.warn('Failed to decode filename:', e);
        }
    }
    
    return fileName;
}

// Initialize badge background color
chrome.action.setBadgeBackgroundColor({ color: '#4285f4' });

// Function to determine if a URL or type is a media file
function isMediaFile(url, contentType = '', contentDisposition = '') {
    // Check URL patterns
    const isMediaUrl = Object.values(MEDIA_PATTERNS).some(pattern => pattern.test(url));
    
    // Check MIME types
    const isMediaType = Object.values(MIME_TYPES).some(pattern => pattern.test(contentType));
    
    // Check Content-Disposition for file extensions
    const hasMediaExtension = contentDisposition && 
        /filename[^;=\n]*=[^;\n]*\.(mp3|wav|ogg|m4a|aac|flac|opus|wma|mp4|webm|mov|mkv|m4v|avi|wmv|flv|3gp)/i.test(contentDisposition);
    
    return isMediaUrl || isMediaType || hasMediaExtension;
}

// Function to get media type from URL, MIME type, and headers
function getMediaType(url, contentType = '', contentDisposition = '') {
    // Check MIME types first
    if (MIME_TYPES.audio.test(contentType)) return 'audio';
    if (MIME_TYPES.video.test(contentType)) return 'video';
    if (MIME_TYPES.stream.test(contentType)) return 'video';
    
    // Check URL patterns
    if (MEDIA_PATTERNS.audio.test(url)) return 'audio';
    if (MEDIA_PATTERNS.video.test(url)) return 'video';
    if (MEDIA_PATTERNS.stream.test(url)) return 'video';
    
    // Check Content-Disposition
    if (contentDisposition) {
        const audioMatch = /filename[^;=\n]*=[^;\n]*\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)/i.test(contentDisposition);
        if (audioMatch) return 'audio';
        
        const videoMatch = /filename[^;=\n]*=[^;\n]*\.(mp4|webm|mov|mkv|m4v|avi|wmv|flv|3gp)/i.test(contentDisposition);
        if (videoMatch) return 'video';
    }
    
    // Check potential media MIME types
    if (MIME_TYPES.potential.test(contentType)) return 'video';
    
    return 'unknown';
}

// Function to format file size
function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < sizes.length - 1) {
        bytes /= 1024;
        i++;
    }
    return `${bytes.toFixed(1)} ${sizes[i]}`;
}

// Function to get file size and type
async function getFileMetadata(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        const size = response.headers.get('content-length');
        return {
            size: size ? parseInt(size) : null,
            formattedSize: formatFileSize(size)
        };
    } catch (error) {
        console.error('Error fetching file metadata:', error);
        return { size: null, formattedSize: 'Unknown' };
    }
}

// Function to generate thumbnail URL
function generateThumbnailUrl(mediaFile) {
    if (mediaFile.type === 'video') {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.src = mediaFile.url;
            video.currentTime = 1; // Seek to 1 second
            
            video.addEventListener('loadeddata', () => {
                const canvas = document.createElement('canvas');
                canvas.width = 120; // Thumbnail width
                canvas.height = 68; // 16:9 aspect ratio
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                try {
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                } catch (e) {
                    console.error('Error generating thumbnail:', e);
                    resolve(null);
                }
            });
            
            video.addEventListener('error', () => {
                console.error('Error loading video for thumbnail');
                resolve(null);
            });
        });
    }
    return Promise.resolve(null);
}

// Function to update media files for a tab
async function updateMediaFiles(tabId, mediaFile) {
    if (!mediaFilesPerTab.has(tabId)) {
        mediaFilesPerTab.set(tabId, new Map());
    }
    
    const tabFiles = mediaFilesPerTab.get(tabId);
    const existingFile = tabFiles.get(mediaFile.url);
    
    if (!existingFile) {
        // This is a new file
        
        // Format the size if we have it
        if (mediaFile.size) {
            mediaFile.formattedSize = formatFileSize(mediaFile.size);
        }
        
        // Generate thumbnail for videos if we don't have one
        if (mediaFile.type === 'video' && !mediaFile.thumbnail) {
            mediaFile.thumbnail = await generateThumbnailUrl(mediaFile);
        }
        
        // Add metadata
        mediaFile.dateAdded = new Date().toISOString();
        mediaFile.lastChecked = new Date().toISOString();
        
        tabFiles.set(mediaFile.url, mediaFile);
        
        // Notify content script of new media file
        chrome.tabs.sendMessage(tabId, {
            action: 'newMediaFile',
            mediaFile: mediaFile
        });
    } else {
        // Update existing file with any new information
        const updatedFile = {
            ...existingFile,
            ...mediaFile,
            lastChecked: new Date().toISOString()
        };
        
        // Keep existing thumbnail if we have one
        if (existingFile.thumbnail) {
            updatedFile.thumbnail = existingFile.thumbnail;
        }
        
        // Update size formatting if needed
        if (updatedFile.size) {
            updatedFile.formattedSize = formatFileSize(updatedFile.size);
        }
        
        tabFiles.set(mediaFile.url, updatedFile);
    }
    
    // Update badge
    chrome.action.setBadgeText({
        text: tabFiles.size.toString(),
        tabId: tabId
    });
}

console.log('Background script loaded');

// Monitor network requests
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        // Skip if not a potential media request
        if (!['media', 'other', 'object'].includes(details.type)) return;
        
        // Get headers
        const headers = {};
        details.responseHeaders?.forEach(header => {
            headers[header.name.toLowerCase()] = header.value;
        });
        
        const contentType = headers['content-type'] || '';
        const contentDisposition = headers['content-disposition'] || '';
        const contentLength = headers['content-length'];
        
        // Check if this is a media file
        console.log('Checking request:', details.url, 'Content-Type:', contentType);
        if (isMediaFile(details.url, contentType, contentDisposition)) {
            console.log('Media file detected in network request:', details.url);
            const mediaType = getMediaType(details.url, contentType, contentDisposition);
            const fileName = extractFileName(details.url, contentDisposition);
            
            updateMediaFiles(details.tabId, {
                url: details.url,
                type: mediaType,
                name: fileName,
                contentType: contentType,
                size: contentLength ? parseInt(contentLength) : null,
                formattedSize: formatFileSize(contentLength),
                source: 'network',
                dateDetected: new Date().toISOString()
            });
        }
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
);

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'downloadFile') {
        chrome.downloads.download({
            url: message.url,
            filename: message.filename
        });
    } else if (message.action === 'updateMediaFiles') {
        const tabId = sender.tab?.id;
        if (tabId) {
            // Initialize map for this tab if it doesn't exist
            if (!mediaFilesPerTab.has(tabId)) {
                mediaFilesPerTab.set(tabId, new Map());
            }

            // Update media files from content script
            const tabFiles = mediaFilesPerTab.get(tabId);
            message.mediaFiles.forEach(file => {
                if (!tabFiles.has(file.url)) {
                    tabFiles.set(file.url, file);
                }
            });

            // Update badge
            const totalCount = tabFiles.size;
            chrome.action.setBadgeText({
                text: totalCount > 0 ? totalCount.toString() : '',
                tabId: tabId
            });
        }
    } else if (message.action === 'getMediaFiles') {
        const tabId = message.tabId;
        if (tabId && mediaFilesPerTab.has(tabId)) {
            sendResponse({
                mediaFiles: getMediaFilesForTab(tabId)
            });
        } else {
            sendResponse({ mediaFiles: [] });
        }
        return true; // Required for async response
    }
    if (message.action === 'downloadFile') {
        chrome.downloads.download({
            url: message.url,
            filename: message.filename
        });
    } else if (message.action === 'updateMediaFiles') {
        // Update badge with combined count of DOM and network media files
        const tabId = sender.tab?.id;
        if (tabId) {
            const networkFiles = mediaFilesPerTab.get(tabId)?.size || 0;
            const domFiles = message.count || 0;
            const totalCount = networkFiles + domFiles;
            
            chrome.action.setBadgeText({
                text: totalCount > 0 ? totalCount.toString() : '',
                tabId: tabId
            });
        }
    }
});

// Clear media files when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        mediaFilesPerTab.delete(tabId);
        chrome.action.setBadgeText({
            text: '',
            tabId: tabId
        });
    }
});

// Clear badge when tab is activated
chrome.tabs.onActivated.addListener((activeInfo) => {
    const count = mediaFilesPerTab.get(activeInfo.tabId)?.size || 0;
    chrome.action.setBadgeText({
        text: count > 0 ? count.toString() : '',
        tabId: activeInfo.tabId
    });
});

// Clean up media files when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    mediaFilesPerTab.delete(tabId);
});
