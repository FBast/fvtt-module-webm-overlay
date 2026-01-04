import { OverlayForm } from './overlay-form.js';
import {
    MODULE_ID,
    SETTING_ACTIVE,
    SETTING_INTENSITY,
    SETTING_PLAY_ONCE,
    SETTING_LAST_OPTIONS,
    SETTING_SAVED,
    SETTING_VIDEO_DIR,
    getActiveOverlays,
    getSavedOverlays,
    getOverlayIntensity,
    getPlayOnce,
    getLastOptions,
    setActiveOverlays,
    setSavedOverlays,
    setOverlayIntensity,
    setPlayOnce,
    setLastOptions,
    startOverlay, stopAllOverlays, stopOverlay, stopSpecificOverlays, getCurrentOverlayNames, deleteOverlays
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

    game.settings.register(MODULE_ID, SETTING_SAVED, {
        name: 'Saved Overlays',
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, SETTING_INTENSITY, {
        name: 'Overlay Intensity',
        hint: '0 = transparent (no audio), 100 = opaque with audio',
        scope: 'client',
        config: false,
        type: Number,
        default: 100
    });
    game.settings.register(MODULE_ID, SETTING_LAST_OPTIONS, {
        name: 'Overlay Last Options',
        scope: 'world',
        config: false,
        type: Object,
        default: { intensity: 100, playOnce: false }
    });
    game.settings.register(MODULE_ID, SETTING_PLAY_ONCE, {
        name: 'Overlay Play Once',
        hint: 'If enabled, overlays will play once instead of looping',
        scope: 'client',
        config: false,
        type: Boolean,
        default: false
    });

    // Socket listeners
    game.socket.on(`module.${MODULE_ID}`, handleSocket);
});

// Ready Hook
Hooks.once('ready', async () => {
    await initializeActiveOverlays();
    // Expose handler for local dispatch from UI without duplication.
    window.webmOverlayHandleSocket = handleSocket;
    // Export intensity applier for sync.
    import("./helpers.js").then(mod => {
        window.webmOverlayApplyIntensity = mod.applyOverlayIntensity;
    }).catch(() => {});

    Hooks.on('updateSetting', async (setting) => {
        if (setting.key !== `${MODULE_ID}.${SETTING_ACTIVE}` && setting.key !== `${MODULE_ID}.${SETTING_LAST_OPTIONS}`) return;
        await syncOverlaysFromSettings();
    });
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
    if (!window._webmOverlayLoggedControlsArg) {
        console.log("WebM Overlay | getSceneControlButtons controls arg:", controls);
        window._webmOverlayLoggedControlsArg = true;
    }

    if (!game.user.isGM) {
        console.log("WebM Overlay | not GM, skipping control injection");
        return;
    }

    // Foundry v13 passes a Collection; earlier versions passed an Array.
    const tokenCategory =
        // v13 ControlCollection
        controls?.get?.("tokens") ||
        controls?.controls?.get?.("tokens") ||
        // v13 plain object maps (current logged shape shows tokens property)
        controls?.tokens ||
        controls?.token ||
        // v12/v11 array shapes
        (Array.isArray(controls) ? controls.find(c => c.name === "tokens" || c.name === "token") : null) ||
        (Array.isArray(controls?.controls) ? controls.controls.find(c => c.name === "tokens" || c.name === "token") : null) ||
        null;
    if (!tokenCategory) {
        console.log("WebM Overlay | token control not found; controls arg shape:", controls);
        return;
    }

    const tool = {
        name: "webmOverlay",
        title: "WebM Overlay Controls",
        icon: "fas fa-video",
        button: true,
        onChange: () => OverlayForm.show()
    };

    const tools = tokenCategory.tools;
    console.log("WebM Overlay | token tools container:", tools);

    // ControlToolCollection (v13) supports get/set
    if (tools?.get && tools?.set) {
        if (!tools.get(tool.name)) tools.set(tool.name, tool);
        return;
    }
    if (tools?.contents && Array.isArray(tools.contents)) {
        if (!tools.contents.some(t => t.name === tool.name)) tools.contents.push(tool);
        return;
    }
    // v13 plain object map (tools keyed by name)
    if (tools && typeof tools === "object" && !Array.isArray(tools) && !tools.get) {
        if (!tools[tool.name]) {
            const orders = Object.values(tools).map(t => t?.order ?? 0);
            tool.order = (orders.length ? Math.max(...orders) : 0) + 1;
            tools[tool.name] = tool;
        }
        return;
    }

    // Array fallback (v11/v12)
    if (Array.isArray(tools)) {
        if (!tools.some(t => t.name === tool.name)) tools.push(tool);
        return;
    }

    // If tools is undefined/null, initialize as array for legacy cases.
    if (!tools) {
        tokenCategory.tools = [tool];
    }
}

// Check if a video exists in the directory
async function videoExistsInDirectory(fileName, directory) {
    if (!game.user.isGM) return true;
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
    const { intensity, playOnce } = getLastOptions();
    // Ensure saved overlays contain anything currently active so the UI shows them.
    const saved = new Set(getSavedOverlays());

    // Players cannot browse the host file system; just start overlays they know about.
    if (!game.user.isGM) {
        overlays.forEach(fileName => startOverlay(fileName, intensity, playOnce));
        return;
    }

    const confirmed = [];

    for (const fileName of overlays) {
        const exists = await videoExistsInDirectory(fileName, videoDirectory);
        if (exists) {
            startOverlay(fileName, intensity, playOnce);
            confirmed.push(fileName);
            saved.add(fileName);
        } else {
            console.warn(`WebM Overlay | Overlay not found: ${fileName}`);
        }
    }

    await setActiveOverlays(confirmed);
    await setSavedOverlays([...saved]);
}

/**
 * Broadcast an action to all clients and run it locally.
 */
function broadcast(action, payload = {}) {
    const data = { action, ...payload };
    handleSocket(data); // run locally
    game.socket.emit(`module.${MODULE_ID}`, data);
}

function handleSocket(data) {
    switch (data.action) {
        case "startOverlay": {
            const intensity = Number.isFinite(data.intensity) ? data.intensity : 100;
            const playOnce = Boolean(data.playOnce);
            startOverlay(data.videoFileName, intensity, playOnce);
            if (game.user.isGM) {
                // Persist options first so updateSetting sees correct values.
                setLastOptions({ intensity, playOnce });

                const active = getActiveOverlays();
                if (!active.includes(data.videoFileName)) {
                    active.push(data.videoFileName);
                    setActiveOverlays(active);
                }
                const saved = getSavedOverlays();
                if (!saved.includes(data.videoFileName)) {
                    saved.push(data.videoFileName);
                    setSavedOverlays(saved);
                }
            }
            break;
        }
        case "stopOverlay": {
            stopSpecificOverlays([data.videoFileName]);
            if (game.user.isGM) {
                const active = getActiveOverlays().filter(name => name !== data.videoFileName);
                setActiveOverlays(active);
            }
            break;
        }
        case "stopAllOverlays": {
            stopAllOverlays();
            if (game.user.isGM) {
                setActiveOverlays([]);
            }
            break;
        }
        case "deleteOverlays": {
            stopSpecificOverlays(data.names || []);
            if (game.user.isGM) {
                deleteOverlays(data.names || []);
            }
            break;
        }
        default:
            console.warn(`WebM Overlay | Unknown socket action: ${data.action}`);
    }
}

async function syncOverlaysFromSettings() {
    const active = getActiveOverlays();
    const { intensity, playOnce } = getLastOptions();
    const current = getCurrentOverlayNames();
    const toStart = active.filter(name => !current.includes(name));
    const toStop = current.filter(name => !active.includes(name));
    toStart.forEach(name => startOverlay(name, intensity, playOnce));
    stopSpecificOverlays(toStop);

    // Re-apply intensity to running overlays if options changed.
    document.querySelectorAll('video.webm-overlay').forEach(video => {
        const apply = window.webmOverlayApplyIntensity || window.webmOverlayApplyIntensityFallback;
        if (apply) apply(video, intensity);
    });
}
