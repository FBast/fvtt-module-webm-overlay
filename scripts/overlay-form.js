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

const HandlebarsMixin = foundry?.applications?.api?.HandlebarsApplicationMixin ?? null;
const ApplicationV2 =
    foundry?.applications?.api?.ApplicationV2 ??
    foundry?.applications?.forms?.ApplicationV2 ??
    null;

const useV2 = Boolean(HandlebarsMixin && ApplicationV2);
const BaseFormApplication = useV2 ? HandlebarsMixin(ApplicationV2) : FormApplication;

const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/overlay-form.hbs`;

export class OverlayForm extends BaseFormApplication {
    static _instance = null;

    constructor(object, options) {
        super(object, options);
    }

    static get defaultOptions() {
        const base =
            BaseFormApplication.DEFAULT_OPTIONS ??
            BaseFormApplication.defaultOptions ??
            super.defaultOptions ??
            {};
        const shared = {
            id: "webm-overlay-form",
            window: { title: "WebM Overlay Controls" },
            title: "WebM Overlay Controls",
            width: 300,
            height: "auto",
            closeOnSubmit: false,
            resizable: true
        };

        if (useV2) {
            return foundry.utils.mergeObject(base, {
                ...shared,
                tag: "form",
                form: { submitOnChange: false, closeOnSubmit: false },
                parts: {
                    body: { template: TEMPLATE_PATH }
                }
            });
        }

        return foundry.utils.mergeObject(base, {
            ...shared,
            template: TEMPLATE_PATH
        });
    }

    static PARTS = useV2
        ? {
            body: { template: TEMPLATE_PATH }
        }
        : undefined;

    async _gatherContext() {
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

    async getData() {
        if (useV2) return this._gatherContext();
        return this._gatherContext();
    }

    async _prepareContext() {
        return this._gatherContext();
    }

    activateListeners(html) {
        console.log("WebM Overlay | activateListeners", { html, useV2 });
        super.activateListeners?.(html);
        const $html = html instanceof jQuery ? html : $(html);
        $html.find('.add-overlay').on('click', this._onAddOverlay.bind(this));
        $html.find('.play-overlay').on('click', this._onPlayOverlay.bind(this));
        $html.find('.stop-overlay').on('click', this._onStopOverlay.bind(this));
        $html.find('.stop-all-overlays').on('click', this._onStopAllOverlays.bind(this));
        $html.find('.delete-overlays').on('click', this._onDeleteOverlays.bind(this));
        $html.find('.overlay-intensity').on('input change', this._onChangeIntensity.bind(this));
        $html.find('.play-once').on('change', this._onChangePlayOnce.bind(this));
    }

    _attachListeners(html) {
        this.activateListeners(html);
    }

    async _onRender(context, options) {
        // V2 does not auto-run activateListeners the same way; ensure we bind.
        await super._onRender?.(context, options);
        if (useV2) {
            const root = this.element ?? options?.element ?? null;
            if (root) {
                this.activateListeners(root);
            }
        }
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
        const videoFileName = this._root().find('.select-video').val();
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
        const root = this._root();
        const intensity = Number(root.find('.overlay-intensity').val()) || 0;
        const playOnce = Boolean(root.find('.play-once').prop('checked'));

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
        this._root().find('.overlay-intensity-value').text(`${value}%`);
        document.querySelectorAll('video.webm-overlay').forEach(video => applyOverlayIntensity(video, value));
    }

    async _onChangePlayOnce(event) {
        const value = Boolean(event.currentTarget.checked);
        await setPlayOnce(value);
    }

    _root() {
        const el = this.element ?? null;
        return el instanceof jQuery ? el : $(el);
    }
}
