import {
    MODULE_ID,
    SETTING_VIDEO_DIR,
    getActiveOverlays,
    setActiveOverlays,
    startOverlay,
    stopOverlay,
    stopAllOverlays
} from "./helpers.js";

export class OverlayForm extends FormApplication {
    static _instance = null;

    constructor(object, options) {
        super(object, options);
        this.selectedActiveOverlays = new Set();
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
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
            const result = await FilePicker.browse("data", videoDirectory);
            videoFiles = result.files
                .filter(file => file.endsWith('.webm'))
                .map(file => file.split('/').pop());
        } catch (error) {
            console.error("WebM Overlay | Error fetching video files:", error);
        }

        return {
            videos: videoFiles,
            activeOverlays: getActiveOverlays()
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.start-overlay').click(this._onStartOverlay.bind(this));
        html.find('.select-overlay').click(this._onSelectActiveOverlay.bind(this));
        html.find('.stop-selected-overlay').click(this._onStopSelectedOverlay.bind(this));
        html.find('.stop-all-overlays').click(this._onStopAllOverlays.bind(this));
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

    async _onStartOverlay(event) {
        event.preventDefault();

        const videoFileName = this.element.find('.select-video').val();
        if (!videoFileName) return;

        const activeOverlays = getActiveOverlays();
        if (activeOverlays.includes(videoFileName)) {
            ui.notifications.warn(`Overlay is already active: ${videoFileName}`);
            return;
        }

        startOverlay(videoFileName);
        game.socket.emit(`module.${MODULE_ID}`, { action: 'startOverlay', videoFileName });

        activeOverlays.push(videoFileName);
        await setActiveOverlays(activeOverlays);
        this.render();
    }

    _onSelectActiveOverlay(event) {
        const overlayFileName = $(event.currentTarget).data('overlay');
        if (event.currentTarget.checked) {
            this.selectedActiveOverlays.add(overlayFileName);
        } else {
            this.selectedActiveOverlays.delete(overlayFileName);
        }
    }

    async _onStopSelectedOverlay(event) {
        event.preventDefault();

        const activeOverlays = getActiveOverlays().filter(
            overlay => !this.selectedActiveOverlays.has(overlay)
        );

        this.selectedActiveOverlays.forEach(fileName => {
            stopOverlay(fileName);
            game.socket.emit(`module.${MODULE_ID}`, { action: 'stopOverlay', videoFileName: fileName });
        });

        this.selectedActiveOverlays.clear();
        await setActiveOverlays(activeOverlays);
        this.render();
    }

    async _onStopAllOverlays(event) {
        event.preventDefault();

        stopAllOverlays();
        game.socket.emit(`module.${MODULE_ID}`, { action: 'stopAllOverlays' });

        await setActiveOverlays([]);
        this.render();
    }
}