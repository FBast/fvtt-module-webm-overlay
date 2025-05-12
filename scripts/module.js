import { OverlayForm } from './overlay-form.js';
import {
    MODULE_ID,
    SETTING_ACTIVE,
    SETTING_VIDEO_DIR,
    getActiveOverlays,
    setActiveOverlays,
    startOverlay, stopAllOverlays, stopOverlay
} from "./helpers.js";

console.log("WebM Overlay | loaded");

// Init Hook
Hooks.once('init', async () => {
    game.settings.register(MODULE_ID, SETTING_VIDEO_DIR, {
        name: 'Video Directory',
        hint: 'Path to the directory containing overlay videos',
        scope: 'client',
        config: true,
        type: String,
        default: `modules/${MODULE_ID}/assets/overlays`
    });

    game.settings.register(MODULE_ID, SETTING_ACTIVE, {
        name: 'Active Overlays',
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    // Socket listeners
    const socketHandlers = {
        startOverlay: (data) => startOverlay(data.videoFileName),
        stopOverlay: (data) => stopOverlay(data.videoFileName),
        stopAllOverlays: () => stopAllOverlays()
    };

    game.socket.on(`module.${MODULE_ID}`, (data) => {
        const handler = socketHandlers[data.action];
        if (handler) handler(data);
        else console.warn(`WebM Overlay | Unknown socket action: ${data.action}`);
    });
});

// Ready Hook
Hooks.once('ready', async () => {
    await initializeActiveOverlays();
});

// Scene Control Button
Hooks.on("getSceneControlButtons", (controls) => addSceneControlButton(controls));

// Load the overlay stylesheet
function loadCSS(path) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = path;
        link.onload = resolve;
        link.onerror = () => reject(new Error(`Failed to load CSS from ${path}`));
        document.head.appendChild(link);
    });
}

// Add button to token controls
function addSceneControlButton(controls) {
    if (!game.user.isGM) return;

    const tokenCategory = controls.find(c => c.name === "token");
    if (tokenCategory) {
        tokenCategory.tools.push({
            name: "webmOverlay",
            title: "WebM Overlay Controls",
            icon: "fas fa-video",
            button: true,
            onClick: () => OverlayForm.show()
        });
    }
}

// Check if a video exists in the directory
async function videoExistsInDirectory(fileName, directory) {
    try {
        const result = await FilePicker.browse("data", directory);
        const filePath = `${directory}/${fileName}`;
        return result.files.includes(filePath);
    } catch (error) {
        console.error(`WebM Overlay | Failed to browse directory ${directory}`, error);
        return false;
    }
}

// Initialize and play saved overlays
async function initializeActiveOverlays() {
    const videoDirectory = game.settings.get(MODULE_ID, SETTING_VIDEO_DIR);
    const overlays = getActiveOverlays();

    const confirmed = [];

    for (const fileName of overlays) {
        const exists = await videoExistsInDirectory(fileName, videoDirectory);
        if (exists) {
            startOverlay(fileName);
            confirmed.push(fileName);
        } else {
            console.warn(`WebM Overlay | Overlay not found: ${fileName}`);
        }
    }

    await setActiveOverlays(confirmed);
}