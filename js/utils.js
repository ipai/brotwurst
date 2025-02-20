// Common utility functions

export function extractFileName(url) {
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

export function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
        return '0:00';
    }

    const totalSeconds = Math.floor(parseFloat(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function parseDurationString(durationStr) {
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

export function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return 'Unknown size';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
}
