// UI-related constants and functions
const ICONS = {
    audio: '&#127925;', // musical note
    video: '&#127910;'  // movie camera
};

function getMediaTypeIcon(type) {
    return ICONS[type];
}

function createMediaElement(media) {
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

document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup opened');


    const mediaContainer = document.getElementById('media-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let currentMediaFiles = [];
    let currentFilter = 'all';

    // Function to display media files
    function displayMediaFiles(mediaFiles) {
        console.log('Displaying files:', mediaFiles.length, 'Current filter:', currentFilter);
        mediaContainer.innerHTML = ''; // Clear current content

        if (!mediaFiles || mediaFiles.length === 0) {
            mediaContainer.innerHTML = '<div class="no-media">No media files found on this page</div>';
            return;
        }

        // Filter files based on current filter
        const filesToDisplay = currentFilter === 'all' ? 
            mediaFiles : 
            mediaFiles.filter(media => media.type === currentFilter);

        console.log('Filtered files:', filesToDisplay.length);

        if (filesToDisplay.length === 0) {
            mediaContainer.innerHTML = `<div class="no-media">No ${currentFilter} files found</div>`;
            return;
        }

        // Group media files by type (only if showing all)
        if (currentFilter === 'all') {
            const mediaByType = {
                audio: mediaFiles.filter(m => m.type === 'audio'),
                video: mediaFiles.filter(m => m.type === 'video')
            };

            // Create sections for each type
            Object.entries(mediaByType).forEach(([type, files]) => {
                if (files.length > 0) {
                    // Add type header
                    const typeHeader = document.createElement('div');
                    typeHeader.className = 'type-header';
                    typeHeader.innerHTML = `${type.charAt(0).toUpperCase() + type.slice(1)} Files (${files.length})`;
                    mediaContainer.appendChild(typeHeader);

                    // Add media items
                    files.forEach(media => addMediaItem(media));
                }
            });
        } else {
            // Just add all files of the filtered type
            filesToDisplay.forEach(media => addMediaItem(media));
        }
    }

    // Helper function to add a media item to the container
    function addMediaItem(media) {
        const mediaElement = createMediaElement(media);
        mediaElement.addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'downloadFile',
                url: media.url,
                filename: media.name
            });
        });
        mediaElement.style.cursor = 'pointer';
        mediaContainer.appendChild(mediaElement);
    }

    // Set up filter button handlers
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Filter clicked:', button.dataset.type);
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update filter and redisplay
            currentFilter = button.dataset.type;
            console.log('Current media files:', currentMediaFiles.length);
            displayMediaFiles(currentMediaFiles);
        });
    });

    // Query the active tab to get media files
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        const activeTab = tabs[0];
        if (activeTab) {
            chrome.runtime.sendMessage({ action: 'getMediaFiles', tabId: activeTab.id }, response => {
                if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    mediaContainer.innerHTML = '<div class="no-media">Error scanning page. Please refresh and try again.</div>';
                    return;
                }

                if (response.error) {
                    console.error('Error:', response.error);
                    mediaContainer.innerHTML = `<div class="no-media">Error: ${response.error}</div>`;
                    return;
                }

                if (response && response.mediaFiles) {
                    currentMediaFiles = response.mediaFiles;
                    displayMediaFiles(currentMediaFiles);
                } else {
                    mediaContainer.innerHTML = '<div class="no-media">No media files found</div>';
                }
            });
        } else {
            mediaContainer.innerHTML = '<div class="no-media">No active tab found</div>';
        }
    });
});
