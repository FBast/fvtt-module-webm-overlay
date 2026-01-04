export const MODULE_ID = "webm-overlay";
export const SETTING_VIDEO_DIR = "videoDirectory";
export const SETTING_ACTIVE = "activeOverlays";
export const SETTING_SAVED = "savedOverlays";
export const SETTING_INTENSITY = "overlayIntensity";
export const SETTING_PLAY_ONCE = "overlayPlayOnce";
export const SETTING_LAST_OPTIONS = "overlayLastOptions";

// Helpers to manage settings state
export function getActiveOverlays() {
    return game.settings.get(MODULE_ID, SETTING_ACTIVE) || [];
}

export function setActiveOverlays(overlays) {
    return game.settings.set(MODULE_ID, SETTING_ACTIVE, overlays);
}

export function getSavedOverlays() {
    return game.settings.get(MODULE_ID, SETTING_SAVED) || [];
}

export function setSavedOverlays(overlays) {
    return game.settings.set(MODULE_ID, SETTING_SAVED, overlays);
}

export function getLastOptions() {
    const key = `${MODULE_ID}.${SETTING_LAST_OPTIONS}`;
    if (!game.settings?.settings?.has?.(key)) {
        return { intensity: 100, playOnce: false };
    }
    return game.settings.get(MODULE_ID, SETTING_LAST_OPTIONS) || { intensity: 100, playOnce: false };
}

export function setLastOptions(opts) {
    const current = getLastOptions();
    const key = `${MODULE_ID}.${SETTING_LAST_OPTIONS}`;
    if (!game.settings?.settings?.has?.(key)) return current;
    return game.settings.set(MODULE_ID, SETTING_LAST_OPTIONS, {
        intensity: opts.intensity ?? current.intensity ?? 100,
        playOnce: opts.playOnce ?? current.playOnce ?? false
    });
}

export function getPlayOnce() {
    const key = `${MODULE_ID}.${SETTING_PLAY_ONCE}`;
    if (!game.settings?.settings?.has?.(key)) return false;
    return Boolean(game.settings.get(MODULE_ID, SETTING_PLAY_ONCE));
}

export function setPlayOnce(value) {
    const key = `${MODULE_ID}.${SETTING_PLAY_ONCE}`;
    if (!game.settings?.settings?.has?.(key)) return false;
    return game.settings.set(MODULE_ID, SETTING_PLAY_ONCE, Boolean(value));
}

export function getOverlayIntensity() {
    const val = game.settings.get(MODULE_ID, SETTING_INTENSITY);
    const num = Number(val);
    return Number.isFinite(num) ? num : 100;
}

export function setOverlayIntensity(value) {
    const clamped = Math.min(Math.max(Number(value) || 0, 0), 100);
    return game.settings.set(MODULE_ID, SETTING_INTENSITY, clamped);
}

export function applyOverlayIntensity(videoElement, intensity) {
    const clampedIntensity = Math.min(Math.max(Number(intensity) || 0, 0), 100);
    const isFullOverlay = clampedIntensity >= 100;
    const opacity = isFullOverlay ? 1 : clampedIntensity / 100;

    videoElement.muted = !isFullOverlay;
    videoElement.volume = isFullOverlay ? 1 : 0;
    videoElement.style.mixBlendMode = isFullOverlay ? "normal" : "screen";
    videoElement.style.opacity = `${opacity}`;
}

/**
 * Start playing a video overlay full screen.
 * @param {string} videoFileName - File name (not full path) of the WebM video.
 * @param {number} intensity - 0-100 overlay intensity (100 = opaque + audio).
 * @param {boolean} playOnce - If true, play only once (no loop, unmuted at 100%).
 */
export function startOverlay(videoFileName, intensity = 0, playOnce = false) {
    const src = `${game.settings.get(MODULE_ID, SETTING_VIDEO_DIR)}/${videoFileName}`;
    const videoElement = document.createElement('video');
    videoElement.src = src;
    videoElement.classList.add('webm-overlay', 'fade-in');
    videoElement.autoplay = true;
    videoElement.loop = !playOnce;
    applyOverlayIntensity(videoElement, intensity);

    if (playOnce) {
        videoElement.addEventListener('ended', async () => {
            stopOverlay(videoFileName);
            if (game.user?.isGM) {
                const updated = getActiveOverlays().filter(name => name !== videoFileName);
                await setActiveOverlays(updated);
                game.socket?.emit?.(`module.${MODULE_ID}`, { action: 'stopOverlay', videoFileName });
            }
        }, { once: true });
    }

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

export function stopSpecificOverlays(names = []) {
    if (!names.length) return;
    const videoDir = game.settings.get(MODULE_ID, SETTING_VIDEO_DIR);
    names.forEach(name => {
        const src = `${videoDir}/${name}`;
        const videoElement = document.querySelector(`video.webm-overlay[src="${src}"]`);
        if (videoElement) {
            videoElement.classList.add('fade-out');
            videoElement.addEventListener('animationend', () => videoElement.remove());
        }
    });
}

/**
 * Remove overlays by name from saved and active lists (GM only).
 */
export async function deleteOverlays(names = []) {
    if (!game.user.isGM || !names.length) return;
    const newSaved = getSavedOverlays().filter(name => !names.includes(name));
    const newActive = getActiveOverlays().filter(name => !names.includes(name));
    await setSavedOverlays(newSaved);
    await setActiveOverlays(newActive);
}

export function getCurrentOverlayNames() {
    const videoDir = game.settings.get(MODULE_ID, SETTING_VIDEO_DIR);
    return Array.from(document.querySelectorAll('video.webm-overlay')).map(v => v.src.replace(`${window.location.origin}/`, '')).map(src => {
        if (src.startsWith(videoDir)) {
            return src.substring(videoDir.length + 1);
        }
        // fallback: grab file name
        return src.split('/').pop();
    });
}
