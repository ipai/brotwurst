document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup opened');
    const mediaContainer = document.getElementById('media-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    let currentMediaFiles = [];
    let currentFilter = 'all';

    // Function to get icon based on media type
    const ICONS = {
        audio: '&#127925;', // musical note
        video: '&#127910;'  // movie camera
    };

    function getMediaTypeIcon(type) {
        return ICONS[type];
    }

    // Function to filter media files
    function filterMediaFiles(mediaFiles, filterType) {
        if (filterType === 'all') return mediaFiles;
        return mediaFiles.filter(media => media.type === filterType);
    }

    // Function to display media files
    function displayMediaFiles(mediaFiles) {
        mediaContainer.innerHTML = ''; // Clear current content

        if (!mediaFiles || mediaFiles.length === 0) {
            mediaContainer.innerHTML = '<div class="no-media">No media files found on this page</div>';
            return;
        }

        // Group media files by type
        const mediaByType = {
            audio: mediaFiles.filter(m => m.type === 'audio'),
            video: mediaFiles.filter(m => m.type === 'video')
        };

        // Create sections for each type
        Object.entries(mediaByType).forEach(([type, files]) => {
            if (files.length > 0 && (currentFilter === 'all' || currentFilter === type)) {
                // Add type header
                const typeHeader = document.createElement('div');
                typeHeader.className = 'type-header';
                typeHeader.innerHTML = `${type.charAt(0).toUpperCase() + type.slice(1)} Files (${files.length})`;
                mediaContainer.appendChild(typeHeader);

                // Add media items
                files.forEach(media => {
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

                    // Make the entire card clickable for download
                    mediaElement.addEventListener('click', () => {
                        chrome.runtime.sendMessage({
                            action: 'downloadFile',
                            url: media.url,
                            filename: media.name
                        });
                    });
                    mediaElement.style.cursor = 'pointer';

                    mediaContainer.appendChild(mediaElement);
                });
            }
        });

        // Show no results message if needed
        if (mediaContainer.children.length === 0) {
            mediaContainer.innerHTML = `<div class="no-media">No ${currentFilter} files found on this page</div>`;
        }
    }

    // Query the active tab to get media files
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
        const activeTab = tabs[0];
        if (activeTab) {
            // First get files from background script
            chrome.runtime.sendMessage({ 
                action: 'getMediaFiles',
                tabId: activeTab.id
            }, response => {
                if (response && response.mediaFiles) {
                    currentMediaFiles = response.mediaFiles;
                    displayMediaFiles(currentMediaFiles);
                }
            });

            // Then trigger a rescan in content script to catch any new files
            chrome.tabs.sendMessage(activeTab.id, { action: 'getMediaFiles' });
        }
    });

    // Handle filter button clicks
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active state of buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update filter and display
            currentFilter = button.dataset.type;
            displayMediaFiles(currentMediaFiles);
        });
    });

    // Listen for media files updates from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Received message in popup:', message);
        if (message.action === 'updateMediaFiles') {
            currentMediaFiles = message.mediaFiles;
            displayMediaFiles(currentMediaFiles);

            // Update filter counts
            const audioCount = currentMediaFiles.filter(m => m.type === 'audio').length;
            const videoCount = currentMediaFiles.filter(m => m.type === 'video').length;
            
            // Update button text with counts
            filterButtons.forEach(btn => {
                if (btn.dataset.type === 'audio') {
                    btn.innerHTML = `&#127925; Audio (${audioCount})`;
                } else if (btn.dataset.type === 'video') {
                    btn.innerHTML = `&#127909; Video (${videoCount})`;
                } else {
                    btn.textContent = `All (${currentMediaFiles.length})`;
                }
            });
        }
    });
});

