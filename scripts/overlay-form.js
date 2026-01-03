import {
    MODULE_ID,
    SETTING_VIDEO_DIR,
    getActiveOverlays,
    getSavedOverlays,
    getOverlayIntensity,
    getPlayOnce,
    setActiveOverlays,
    setSavedOverlays,
    setOverlayIntensity,
    setPlayOnce,
    applyOverlayIntensity,
    startOverlay,
    stopOverlay,
    stopAllOverlays
} from "./helpers.js";

const BaseFormApplication =
    foundry?.applications?.forms?.FormApplicationV2 ??
    foundry?.applications?.api?.FormApplicationV2 ??
    FormApplication;

export class OverlayForm extends BaseFormApplication {
    static _instance = null;

    constructor(object, options) {
        super(object, options);
    }

    static get defaultOptions() {
        const base = BaseFormApplication.defaultOptions ?? super.defaultOptions ?? {};
        return foundry.utils.mergeObject(base, {
            id: "webm-overlay-form",
            title: "WebM Overlay Controls",
            template: `modules/${MODULE_ID}/templates/overlay-form.hbs`,
            width: 300,
            height: 'auto',
            closeOnSubmit: false,
            resizable: true
        });
    }

    async getData() {
        const videoDirectory = game.settings.get(MODULE_ID, SETTING_VIDEO_DIR);
        let videoFiles = [];

        try {
            const picker = foundry.applications?.apps?.FilePicker?.implementation || FilePicker;
            const result = await picker.browse("data", videoDirectory);
            videoFiles = result.files
                .filter(file => file.endsWith('.webm'))
                .map(file => file.split('/').pop());
        } catch (error) {
            console.error("WebM Overlay | Error fetching video files:", error);
        }

        const active = getActiveOverlays();
        const saved = new Set(getSavedOverlays());
        active.forEach(a => saved.add(a));

        return {
            videos: videoFiles,
            overlays: Array.from(saved).map(name => ({
                name,
                active: active.includes(name)
            })),
            intensity: getOverlayIntensity(),
            playOnce: getPlayOnce()
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.add-overlay').click(this._onAddOverlay.bind(this));
        html.find('.play-overlay').click(this._onPlayOverlay.bind(this));
        html.find('.stop-overlay').click(this._onStopOverlay.bind(this));
        html.find('.stop-all-overlays').click(this._onStopAllOverlays.bind(this));
        html.find('.delete-overlays').click(this._onDeleteOverlays.bind(this));
        html.find('.overlay-intensity').on('input change', this._onChangeIntensity.bind(this));
        html.find('.play-once').on('change', this._onChangePlayOnce.bind(this));
    }

    static show() {
        if (!this._instance) {
            this._instance = new OverlayForm();
        }
        this._instance.render(true);
    }

    close(options) {
        OverlayForm._instance = null;
        return super.close(options);
    }

    async _onAddOverlay(event) {
        event.preventDefault();
        const videoFileName = this.element.find('.select-video').val();
        if (!videoFileName) return;

        const saved = getSavedOverlays();
        if (!saved.includes(videoFileName)) {
            saved.push(videoFileName);
            await setSavedOverlays(saved);
            this.render();
        } else {
            ui.notifications.info(`Overlay already in list: ${videoFileName}`);
        }
    }

    async _onPlayOverlay(event) {
        event.preventDefault();
        const videoFileName = $(event.currentTarget).data('overlay');
        const intensity = Number(this.element.find('.overlay-intensity').val()) || 0;
        const playOnce = Boolean(this.element.find('.play-once').prop('checked'));

        const payload = { action: 'startOverlay', videoFileName, intensity, playOnce };
        if (window.webmOverlayHandleSocket) window.webmOverlayHandleSocket(payload);
        // Always emit so other clients receive it (no GM check; non-GM can initiate too)
        game.socket.emit(`module.${MODULE_ID}`, payload);
        this.render();
    }

    async _onStopOverlay(event) {
        event.preventDefault();
        const videoFileName = $(event.currentTarget).data('overlay');
        const payload = { action: 'stopOverlay', videoFileName };
        if (window.webmOverlayHandleSocket) window.webmOverlayHandleSocket(payload);
        game.socket.emit(`module.${MODULE_ID}`, payload);
        this.render();
    }

    async _onStopAllOverlays(event) {
        event.preventDefault();

        const payload = { action: 'stopAllOverlays' };
        if (window.webmOverlayHandleSocket) window.webmOverlayHandleSocket(payload);
        game.socket.emit(`module.${MODULE_ID}`, payload);
        this.render();
    }

    async _onDeleteOverlays(event) {
        event.preventDefault();
        const payload = { action: 'deleteOverlays', names: getSavedOverlays() };
        if (window.webmOverlayHandleSocket) window.webmOverlayHandleSocket(payload);
        game.socket.emit(`module.${MODULE_ID}`, payload);
        this.render();
    }

    async _onChangeIntensity(event) {
        const value = Number(event.currentTarget.value) || 0;
        await setOverlayIntensity(value);
        this.element.find('.overlay-intensity-value').text(`${value}%`);
        document.querySelectorAll('video.webm-overlay').forEach(video => applyOverlayIntensity(video, value));
    }

    async _onChangePlayOnce(event) {
        const value = Boolean(event.currentTarget.checked);
        await setPlayOnce(value);
    }
}
