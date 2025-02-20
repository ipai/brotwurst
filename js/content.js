// Function to extract filename from URL
function extractFileName(url) {
    try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/');
        let fileName = pathSegments[pathSegments.length - 1];
        
        // Remove query parameters if present
        fileName = fileName.split('?')[0];
        
        // If no filename found, generate one based on timestamp
        if (!fileName) {
            const timestamp = new Date().getTime();
            fileName = `media_${timestamp}`;
        }
        
        return fileName;
    } catch (e) {
        console.error('Error extracting filename:', e);
        return `media_${new Date().getTime()}`;
    }
}

// Function to format duration
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
        return '0:00';
    }

    const totalSeconds = Math.floor(parseFloat(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to parse duration string
function parseDurationString(durationStr) {
    if (!durationStr) return null;
    
    // Convert to string if it's a number
    const str = durationStr.toString();
    
    // Try parsing as seconds first
    const asSeconds = parseFloat(str);
    if (!isNaN(asSeconds)) {
        return asSeconds;
    }
    
    // Try MM:SS format
    const mmssMatch = str.match(/^(\d+):(\d{2})$/);
    if (mmssMatch) {
        return parseInt(mmssMatch[1]) * 60 + parseInt(mmssMatch[2]);
    }
    
    // Try HH:MM:SS format
    const hhmmssMatch = str.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hhmmssMatch) {
        return parseInt(hhmmssMatch[1]) * 3600 + 
               parseInt(hhmmssMatch[2]) * 60 + 
               parseInt(hhmmssMatch[3]);
    }
    
    return null;
}

// Function to find media sources
async function findMediaSources() {
    const newFiles = new Set();
    
    // Function to get favicon URL
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

    // Helper function to parse HLS manifest
    async function parseHLSManifest(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            
            const manifest = await response.text();
            const lines = manifest.split('\n');
            const streams = [];
            let currentStream = null;
            
            for (const line of lines) {
                if (line.startsWith('#EXT-X-STREAM-INF:')) {
                    // Parse stream info
                    currentStream = {};
                    const attributes = line.substring(18).split(',');
                    for (const attr of attributes) {
                        const [key, value] = attr.split('=');
                        if (key === 'BANDWIDTH') {
                            currentStream.bandwidth = parseInt(value);
                        } else if (key === 'RESOLUTION') {
                            currentStream.resolution = value;
                        }
                    }
                } else if (line.startsWith('#')) {
                    continue;
                } else if (line.trim() && currentStream) {
                    // This is a stream URL
                    currentStream.url = new URL(line.trim(), url).href;
                    streams.push(currentStream);
                    currentStream = null;
                }
            }
            
            return streams;
        } catch (e) {
            console.error('Error parsing HLS manifest:', e);
            return null;
        }
    }

    // Helper function to get file size
    async function getFileSize(url, type) {
        try {
            // Try HEAD request first
            let response = await fetch(url, { method: 'HEAD' });
            let contentLength = response.headers.get('content-length');
            
            // If HEAD request fails or doesn't return size, try GET for audio files
            if ((!response.ok || !contentLength) && type === 'audio') {
                console.log('HEAD request failed for audio, trying GET request');
                response = await fetch(url, { method: 'GET' });
                contentLength = response.headers.get('content-length');
            }
            
            if (!response.ok || !contentLength) return null;
            
            return { 
                formattedSize: formatFileSize(parseInt(contentLength, 10)),
                contentLength
            };
        } catch (e) {
            console.error('Error getting file size:', e);
            return null;
        }
    }

    // Helper function to add media file
    const addMediaFile = async (url, type, mimeType = null, thumbnail = null, duration = null, extraInfo = null) => {
        // Skip if URL is invalid or already processed
        if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
        
        try {
            new URL(url);
        } catch (e) {
            return;
        }

        // Format duration if present
        if (duration) {
            duration = formatDuration(duration);
        }

        // Get file size
        const sizeInfo = await getFileSize(url, type);

        // Check if this is an HLS manifest
        if (url.endsWith('.m3u8') || mimeType === 'application/x-mpegURL' || mimeType === 'application/vnd.apple.mpegurl') {
            const streams = await parseHLSManifest(url);
            if (streams && streams.length > 0) {
                // Add each quality variant
                streams.forEach((stream, index) => {
                    const quality = stream.resolution ? ` (${stream.resolution})` : '';
                    const bandwidth = stream.bandwidth ? ` [${Math.round(stream.bandwidth / 1000)} kbps]` : '';
                    newFiles.add({
                        type,
                        url: stream.url,
                        name: `${extractFileName(url)}_quality${index + 1}${quality}${bandwidth}`,
                        mimeType: 'video/mp4', // Most HLS streams are MP4
                        thumbnail: thumbnail || getFaviconUrl(),
                        duration,
                        formattedSize: 'Streaming',
                        size: stream.bandwidth || 0,
                        isHLS: true
                    });
                });
            }
        } else {
            newFiles.add({
                type,
                url,
                name: extractFileName(url),
                mimeType: mimeType,
                thumbnail: thumbnail || getFaviconUrl(),
                duration,
                formattedSize: sizeInfo ? sizeInfo.formattedSize : 'Unknown size',
                size: sizeInfo ? parseInt(sizeInfo.contentLength, 10) : 0,
                ...extraInfo
            });
        }
    };

    // Find video elements and collect promises
    const videoPromises = [];
    document.querySelectorAll('video').forEach(video => {
        let url = video.src;
        if (!url && video.querySelector('source')) {
            url = video.querySelector('source').src;
        }
        
        // Get video duration
        let duration = null;
        if (video.duration) {
            duration = video.duration;
        } else {
            const durationAttrs = [
                'data-duration',
                'duration',
                'data-length',
                'data-time',
                'data-video-duration'
            ];
            
            for (const attr of durationAttrs) {
                if (video.hasAttribute(attr)) {
                    duration = parseDurationString(video.getAttribute(attr));
                    if (duration) break;
                }
            }
        }
        
        // Get video thumbnail
        let thumbnail = null;
        if (video.poster) {
            thumbnail = video.poster;
        }
        
        if (url) {
            videoPromises.push(addMediaFile(url, 'video', video.type || null, thumbnail, duration));
        }
    });

    // Wait for video promises
    await Promise.all(videoPromises);

    // Find audio elements and collect promises
    const audioPromises = [];
    document.querySelectorAll('audio').forEach(audio => {
        let url = audio.src;
        if (!url && audio.querySelector('source')) {
            url = audio.querySelector('source').src;
        }
        
        // Get audio duration
        let duration = null;
        if (audio.duration) {
            duration = audio.duration;
        } else {
            const durationAttrs = [
                'data-duration',
                'duration',
                'data-length',
                'data-time',
                'data-audio-duration'
            ];
            
            for (const attr of durationAttrs) {
                if (audio.hasAttribute(attr)) {
                    duration = parseDurationString(audio.getAttribute(attr));
                    if (duration) break;
                }
            }
        }
        
        if (url) {
            audioPromises.push(addMediaFile(url, 'audio', audio.type || null, null, duration));
        }
    });

    // Wait for audio promises
    await Promise.all(audioPromises);

    // Find source elements and collect promises
    const sourcePromises = [];
    
    document.querySelectorAll('source').forEach(source => {
        const url = source.src;
        const type = source.type?.toLowerCase() || '';
        
        if (type.includes('video')) {
            sourcePromises.push(addMediaFile(url, 'video', type));
        } else if (type.includes('audio')) {
            sourcePromises.push(addMediaFile(url, 'audio', type));
        }
    });

    // Wait for all file sizes to be fetched
    await Promise.all(sourcePromises);
    return Array.from(newFiles);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanForMedia') {
        // Need to handle async operations
        findMediaSources().then(mediaFiles => {
            sendResponse({ mediaFiles });
        }).catch(error => {
            console.error('Error scanning media:', error);
            sendResponse({ error: 'Failed to scan media files' });
        });
        return true; // Will respond asynchronously
    }
    return true;
});
