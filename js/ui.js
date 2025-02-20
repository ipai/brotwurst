// UI-related constants and functions
export const ICONS = {
    audio: '&#127925;', // musical note
    video: '&#127910;'  // movie camera
};

export function getMediaTypeIcon(type) {
    return ICONS[type];
}

export function createMediaElement(media) {
    const mediaElement = document.createElement('div');
    mediaElement.className = 'media-item';
    const fileName = media.name.length > 40 ? media.name.substring(0, 37) + '...' : media.name;

    // Create thumbnail element
    let thumbnailHtml;
    if (media.thumbnail) {
        thumbnailHtml = `<img src="${media.thumbnail}" alt="${media.type === 'video' ? 'Video' : 'Audio'} thumbnail" class="media-thumb">`;
    } else {
        thumbnailHtml = getMediaTypeIcon(media.type);
    }

    // Get file extension
    const extension = media.name.split('.').pop().toUpperCase();
    
    const durationHtml = media.duration ? 
        `<div class="media-duration">${media.duration}</div>` : 
        '';
    
    mediaElement.innerHTML = `
        <div class="media-item-left">
            <div class="media-thumbnail ${media.type}">
                ${thumbnailHtml}
                ${durationHtml}
            </div>
        </div>
        <div class="media-item-right">
            <div class="media-name" title="${media.name}">${fileName}</div>
            <div class="media-details">
                <span class="file-extension">${extension}</span>
                <span class="file-size">${media.formattedSize || 'Unknown size'}</span>
                <span class="source-tag">${media.source === 'network' ? 'Network' : 'DOM'}</span>
            </div>
        </div>
    `;

    return mediaElement;
}
