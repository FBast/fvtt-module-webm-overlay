export const MODULE_ID = "webm-overlay";
export const SETTING_VIDEO_DIR = "videoDirectory";
export const SETTING_ACTIVE = "activeOverlays";

// Helpers to manage settings state
export function getActiveOverlays() {
    return game.settings.get(MODULE_ID, SETTING_ACTIVE) || [];
}

export function setActiveOverlays(overlays) {
    return game.settings.set(MODULE_ID, SETTING_ACTIVE, overlays);
}

/**
 * Start playing a video overlay full screen.
 * @param {string} videoFileName - File name (not full path) of the WebM video.
 */
export function startOverlay(videoFileName) {
    const src = `${game.settings.get(MODULE_ID, SETTING_VIDEO_DIR)}/${videoFileName}`;
    const videoElement = document.createElement('video');
    videoElement.src = src;
    videoElement.classList.add('webm-overlay', 'fade-in');
    videoElement.autoplay = true;
    videoElement.loop = true;
    videoElement.muted = true;

    document.body.appendChild(videoElement);
}

/**
 * Stop and fade out a specific overlay.
 * @param {string} videoFileName - File name of the overlay to stop.
 */
export function stopOverlay(videoFileName) {
    const src = `${game.settings.get(MODULE_ID, SETTING_VIDEO_DIR)}/${videoFileName}`;
    const videoElement = document.querySelector(`video.webm-overlay[src="${src}"]`);
    if (videoElement) {
        videoElement.classList.add('fade-out');
        videoElement.addEventListener('animationend', () => {
            videoElement.remove();
        });
    }
}

/**
 * Stop and fade out all currently active overlays.
 */
export function stopAllOverlays() {
    document.querySelectorAll('video.webm-overlay').forEach(videoElement => {
        videoElement.classList.add('fade-out');
        videoElement.addEventListener('animationend', () => {
            videoElement.remove();
        });
    });
}
