// Media file patterns and MIME types
const MEDIA_PATTERNS = {
    audio: /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)($|\?)/i,
    video: /\.(mp4|webm|mov|mkv|m4v|avi|wmv|flv|3gp)($|\?)/i,
    stream: /\/(manifest|playlist|stream|hls|\.m3u8|\.mpd)($|\?)/i
};

const MIME_TYPES = {
    audio: /^audio\//i,
    video: /^video\//i,
    stream: /^application\/(x-mpegURL|dash\+xml|vnd\.apple\.mpegurl)/i
};

// Store all detected media files
let mediaFiles = new Map();

// Function to extract filename from URL or content disposition
function extractFileName(url, contentDisposition) {
    let fileName = '';
    
    // Try to get filename from Content-Disposition header
    if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches && matches[1]) {
            fileName = matches[1].replace(/['"]*/g, '');
        }
    }
    
    // Fallback to URL if no filename found in Content-Disposition
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

// Function to format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown size';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Function to parse duration string in various formats
function parseDurationString(str) {
    if (!str) return null;
    str = str.toString().trim();
    
    // Try to parse as float first (assuming seconds)
    const asSeconds = parseFloat(str);
    if (!isNaN(asSeconds) && isFinite(asSeconds)) return asSeconds;
    
    // Try MM:SS format
    const mmss = str.match(/^(\d+):([0-5]\d)$/);
    if (mmss) {
        return parseInt(mmss[1]) * 60 + parseInt(mmss[2]);
    }
    
    // Try HH:MM:SS format
    const hhmmss = str.match(/^(\d+):([0-5]\d):([0-5]\d)$/);
    if (hhmmss) {
        return parseInt(hhmmss[1]) * 3600 + parseInt(hhmmss[2]) * 60 + parseInt(hhmmss[3]);
    }
    
    // Try natural language formats
    const timeRegex = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i;
    const match = str.match(timeRegex);
    if (match && (match[1] || match[2] || match[3])) {
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    return null;
}

// Function to format duration
function formatDuration(seconds) {
    // Convert to number if it's a string
    if (typeof seconds === 'string') {
        seconds = parseFloat(seconds);
    }
    
    // Basic validation
    if (seconds === null || seconds === undefined) return null;
    if (isNaN(seconds)) return '0:00';
    if (!isFinite(seconds)) return '0:00';
    
    // Ensure positive
    seconds = Math.abs(seconds);
    
    // Format duration
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Function to get duration from MP4 moov atom
async function getMp4Duration(url) {
    try {
        // Try to fetch the last 64KB which often contains the moov atom
        const response = await fetch(url, {
            headers: {
                Range: 'bytes=-65536' // Fetch last 64KB
            }
        });
        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);
        
        // Look for moov atom
        for (let i = 0; i < buffer.byteLength - 8; i++) {
            if (view.getUint32(i) === 0x6D6F6F76) { // 'moov' in hex
                // Parse duration from mvhd atom
                for (let j = i; j < buffer.byteLength - 8; j++) {
                    if (view.getUint32(j) === 0x6D766864) { // 'mvhd' in hex
                        const timescale = view.getUint32(j + 12);
                        const duration = view.getUint32(j + 16);
                        return duration / timescale;
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Failed to get MP4 duration:', error);
    }
    return null;
}

// Function to determine media type from URL and MIME type
function getMediaType(url, mimeType = '') {
    // Check MIME type first
    if (MIME_TYPES.audio.test(mimeType)) return 'audio';
    if (MIME_TYPES.video.test(mimeType)) return 'video';
    if (MIME_TYPES.stream.test(mimeType)) return 'video'; // Treat streams as video
    
    // Fallback to URL pattern matching
    if (MEDIA_PATTERNS.audio.test(url)) return 'audio';
    if (MEDIA_PATTERNS.video.test(url)) return 'video';
    if (MEDIA_PATTERNS.stream.test(url)) return 'video';
    
    return 'unknown';
}

// Function to find media elements and their sources
function findMediaSources() {
    console.log('Scanning for media files...');
    const newFiles = new Set();
    
    // Find <video> and <audio> elements and their sources
    document.querySelectorAll('video, audio').forEach(media => {
        const isVideo = media.tagName.toLowerCase() === 'video';
        const type = isVideo ? 'video' : 'audio';

        // Function to add media file with thumbnail and duration
        const addMediaFile = (url, mimeType = '') => {
            let thumbnail = null;
            let duration = null;
            
            // Try to get duration from various sources
            const getDurationFromMedia = () => {
                // Try direct duration property
                if (media.duration) {
                    return media.duration;
                }
                
                // Try data attributes
                const durationAttrs = [
                    'data-duration',
                    'duration',
                    'data-length',
                    'data-time',
                    'data-video-duration',
                    'data-audio-duration',
                    'aria-duration',
                    'data-clip-duration',
                    'data-media-duration',
                    'data-total-time',
                    'data-timestamp',
                    'data-runtime'
                ];
                
                for (const attr of durationAttrs) {
                    if (media.hasAttribute(attr)) {
                        const value = media.getAttribute(attr);
                        if (value) {
                            // Try direct number parsing first
                            const asNumber = parseFloat(value);
                            if (!isNaN(asNumber)) return asNumber;
                            
                            // Try parsing as duration string
                            const asSeconds = parseDurationString(value);
                            if (asSeconds) return asSeconds;
                        }
                    }
                }
                
                // Try metadata if available
                if (media.mediaElement?.duration) {
                    return media.mediaElement.duration;
                }
                
                // Default duration for media elements
                return 0;
            };
            
            const seconds = getDurationFromMedia();
            if (seconds) {
                duration = formatDuration(seconds);
            }
            
            if (isVideo) {
                // Try to get thumbnail from poster attribute
                if (media.hasAttribute('poster')) {
                    thumbnail = media.getAttribute('poster');
                }
                // Try to get thumbnail from preview/thumbnail elements
                if (!thumbnail) {
                    const previewImg = media.querySelector('img[class*="preview"], img[class*="thumbnail"]');
                    if (previewImg) {
                        thumbnail = previewImg.src;
                    }
                }
                // Try data attributes that might contain thumbnails
                if (!thumbnail) {
                    const dataAttrs = ['data-thumbnail', 'data-poster', 'data-preview'];
                    for (const attr of dataAttrs) {
                        if (media.hasAttribute(attr)) {
                            thumbnail = media.getAttribute(attr);
                            break;
                        }
                    }
                }
            }
            
            // Get favicon URL
            const getFaviconUrl = () => {
                // Try high-res favicon first
                const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
                if (appleTouchIcon) return appleTouchIcon.href;
                
                // Try standard favicon next
                const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
                if (favicon) return favicon.href;
                
                // Fallback to default favicon location
                return new URL('/favicon.ico', window.location.origin).href;
            };
            
            newFiles.add({
                type,
                url,
                name: extractFileName(url),
                source: 'dom',
                mimeType: mimeType,
                thumbnail: thumbnail || getFaviconUrl(),
                duration
            });
        };
        
        // Check main src attribute
        if (media.src) {
            addMediaFile(media.src, media.type || '');
        }
        
        // Check <source> elements
        media.querySelectorAll('source').forEach(source => {
            if (source.src) {
                addMediaFile(source.src, source.type || '');
            }
        });
    });

    // Find media links and download attributes
    document.querySelectorAll('a[href], a[download]').forEach(link => {
        const url = link.href;
        const mimeType = link.type || '';
        const type = getMediaType(url, mimeType);
        
        if (type !== 'unknown') {
            newFiles.add({
                type,
                url,
                name: link.download || extractFileName(url),
                source: 'dom',
                mimeType
            });
        }
    });

    // Find <source> elements outside of media elements
    document.querySelectorAll('source[src]').forEach(source => {
        const url = source.src;
        const mimeType = source.type || '';
        const type = getMediaType(url, mimeType);
        
        if (type !== 'unknown') {
            newFiles.add({
                type,
                url,
                name: extractFileName(url),
                source: 'dom',
                mimeType
            });
        }
    });

    // Find media in CSS backgrounds and custom attributes
    document.querySelectorAll('*').forEach(element => {
        // Check background images
        const style = window.getComputedStyle(element);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
            const matches = bgImage.match(/url\(['"]*([^'"]+\.(?:mp4|webm|mov|mkv|m4v|avi|mp3|wav|ogg))['"]*\)/ig);
            if (matches) {
                matches.forEach(match => {
                    const url = match.replace(/url\(['"]*([^'"]+)['"]*\)/i, '$1');
                    const type = getMediaType(url);
                    if (type !== 'unknown') {
                        newFiles.add({
                            type,
                            url,
                            name: extractFileName(url),
                            source: 'dom-background'
                        });
                    }
                });
            }
        }
        
        // Check data-* attributes that might contain media URLs
        Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-') && typeof attr.value === 'string')
            .forEach(attr => {
                const urlMatches = attr.value.match(/https?:\/\/[^\s<>"']+\.(?:mp4|webm|mov|mkv|m4v|avi|mp3|wav|ogg)/ig);
                if (urlMatches) {
                    urlMatches.forEach(url => {
                        const type = getMediaType(url);
                        if (type !== 'unknown') {
                            newFiles.add({
                                type,
                                url,
                                name: extractFileName(url),
                                source: 'dom-data'
                            });
                        }
                    });
                }
            });
    });

    // Add files to the map first
    newFiles.forEach(file => {
        if (!mediaFiles.has(file.url)) {
            console.log('Found new media file:', file);
            mediaFiles.set(file.url, file);
        }
    });

    // Convert newFiles Set to array and update mediaFiles Map
    Array.from(newFiles).forEach(file => {
        mediaFiles.set(file.url, file);
    });

    // Update popup with current files
    updatePopup();

    // Then fetch metadata asynchronously
    setTimeout(async () => {
        const BATCH_SIZE = 5;
        const filesToUpdate = Array.from(mediaFiles.values())
            .filter(file => !file.size); // Only fetch for files without size

        for (let i = 0; i < filesToUpdate.length; i += BATCH_SIZE) {
            const batch = filesToUpdate.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (file) => {
                try {
                    const response = await fetch(file.url, { 
                        method: 'HEAD',
                        mode: 'cors',
                        credentials: 'same-origin'
                    });
                    
                    const headers = {
                        contentType: response.headers.get('content-type'),
                        contentLength: response.headers.get('content-length'),
                        contentDisposition: response.headers.get('content-disposition')
                    };

                    if (headers.contentType) file.contentType = headers.contentType;
                    if (headers.contentLength) {
                        file.size = parseInt(headers.contentLength);
                        file.formattedSize = formatFileSize(file.size);
                    }
                    
                    if (headers.contentDisposition) {
                        const dispositionName = extractFileName(file.url, headers.contentDisposition);
                        if (dispositionName) file.name = dispositionName;
                    }

                    // Try to get duration from Content-Duration header
                    const contentDuration = response.headers.get('Content-Duration') || response.headers.get('X-Content-Duration');
                    if (contentDuration) {
                        file.duration = formatDuration(parseFloat(contentDuration));
                    }
                    
                    // If no duration yet and it's an MP4, try to get it from moov atom
                    if (!file.duration && file.contentType?.includes('mp4')) {
                        const mp4Duration = await getMp4Duration(file.url);
                        if (mp4Duration) {
                            file.duration = formatDuration(mp4Duration);
                        }
                    }

                    // Update the file in the map
                    mediaFiles.set(file.url, file);
                    
                    // Send update to background script
                    chrome.runtime.sendMessage({
                        action: 'updateMediaFiles',
                        mediaFiles: [file]
                    });
                } catch (error) {
                    console.warn('Failed to fetch headers for:', file.url, error);
                }
            }));
        }
        
        // Final update after all metadata is fetched
        updatePopup();
    }, 0);

    console.log('Total media files found:', mediaFiles.size);
    updatePopup();
}

// Function to update popup with all media files
function updatePopup() {
    const allFiles = Array.from(mediaFiles.values());
    console.log('Sending media files to popup:', allFiles);
    chrome.runtime.sendMessage({
        action: 'updateMediaFiles',
        mediaFiles: allFiles,
        count: allFiles.length
    });
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'newMediaFile' && message.mediaFile) {
        const file = message.mediaFile;
        if (!mediaFiles.has(file.url)) {
            file.source = 'network';
            mediaFiles.set(file.url, file);
            updatePopup();
        }
    } else if (message.action === 'getMediaFiles') {
        // First send current files immediately
        const currentFiles = Array.from(mediaFiles.values());
        sendResponse({ mediaFiles: currentFiles });
        
        // Then rescan for new files
        findMediaSources();
        return false; // We've already sent the response
    }
    return true;
});

// Run initial scan
console.log('Content script loaded, starting initial scan...');
findMediaSources();

// Listen for dynamic content changes
const observer = new MutationObserver(findMediaSources);
observer.observe(document.body, {
    childList: true,
    subtree: true
});
