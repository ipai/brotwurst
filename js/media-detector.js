import { extractFileName, formatDuration, parseDurationString } from './utils.js';

export function findMediaSources() {
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

    // Helper function to add media file
    const addMediaFile = (url, type, mimeType = null, thumbnail = null, duration = null) => {
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

    // Find video elements
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
            addMediaFile(url, 'video', video.type || null, thumbnail, duration);
        }
    });

    // Find audio elements
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
            addMediaFile(url, 'audio', audio.type || null, null, duration);
        }
    });

    // Find source elements
    document.querySelectorAll('source').forEach(source => {
        const url = source.src;
        const type = source.type?.toLowerCase() || '';
        
        if (type.includes('video')) {
            addMediaFile(url, 'video', type);
        } else if (type.includes('audio')) {
            addMediaFile(url, 'audio', type);
        }
    });

    return Array.from(newFiles);
}
