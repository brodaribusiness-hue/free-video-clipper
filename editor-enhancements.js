(function () {
    "use strict";

    /*
     * Free Video Clipper
     * Non-destructive editor enhancements.
     *
     * This file does not replace the existing:
     * - video import
     * - video playback
     * - timeline
     * - trim controls
     * - metadata handling
     *
     * It adds:
     * - movable 9:16 crop frame
     * - real visual zoom for the crop preview
     * - multiple clip state management
     * - per-clip reframe state
     * - speaker split layout preview
     *
     * Export and real face-detection processing are intentionally
     * not faked here.
     */

    const state = {
        clips: [],
        activeClipId: null,
        nextClipId: 1,

        layout: "single",

        crop: {
            x: 0,
            y: 0,
            zoom: 100
        },

        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragOriginX: 0,
        dragOriginY: 0
    };

    const video = document.getElementById("videoPreview");
    const container = document.getElementById("videoContainer");
    const overlay = document.getElementById("cropOverlay");
    const zoomRange = document.getElementById("zoomRange");
    const zoomValue = document.getElementById("zoomValue");

    if (!video || !container || !overlay) {
        return;
    }

    function getDuration() {
        return Number.isFinite(video.duration)
            ? video.duration
            : 0;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function createClip(start, end) {
        const duration = getDuration();

        const safeStart = clamp(
            Number(start) || 0,
            0,
            duration
        );

        const safeEnd = clamp(
            Number(end) || duration,
            safeStart,
            duration
        );

        return {
            id: state.nextClipId++,
            start: safeStart,
            end: safeEnd,

            crop: {
                x: 0,
                y: 0,
                zoom: 100
            },

            speaker1: {
                x: 0,
                y: 0,
                zoom: 100
            },

            speaker2: {
                x: 0,
                y: 0,
                zoom: 100
            }
        };
    }

    function saveCurrentClipState() {
        const clip = getActiveClip();

        if (!clip) {
            return;
        }

        clip.crop.x = state.crop.x;
        clip.crop.y = state.crop.y;
        clip.crop.zoom = state.crop.zoom;
    }

    function loadClipState(clip) {
        if (!clip) {
            return;
        }

        state.crop.x = clip.crop.x;
        state.crop.y = clip.crop.y;
        state.crop.zoom = clip.crop.zoom;

        if (zoomRange) {
            zoomRange.value = String(state.crop.zoom);
        }

        if (zoomValue) {
            zoomValue.textContent =
                Math.round(state.crop.zoom) + "%";
        }

        updateCropPreview();
    }

    function getActiveClip() {
        return state.clips.find(function (clip) {
            return clip.id === state.activeClipId;
        }) || null;
    }

    function initializeClips() {
        if (state.clips.length > 0) {
            return;
        }

        const duration = getDuration();

        if (duration <= 0) {
            return;
        }

        const clip = createClip(0, duration);

        state.clips.push(clip);
        state.activeClipId = clip.id;

        loadClipState(clip);
    }

    function addClip() {
        const duration = getDuration();

        if (duration <= 0) {
            return null;
        }

        saveCurrentClipState();

        const currentTime =
            Number.isFinite(video.currentTime)
                ? video.currentTime
                : 0;

        const minimumDuration =
            Math.min(1, duration);

        let start = currentTime;
        let end = Math.min(
            duration,
            start + Math.max(minimumDuration, 5)
        );

        if (end <= start) {
            start = 0;
            end = duration;
        }

        const clip = createClip(start, end);

        state.clips.push(clip);
        state.activeClipId = clip.id;

        loadClipState(clip);
        renderClipList();

        return clip;
    }

    function removeClip(id) {
        if (state.clips.length <= 1) {
            return;
        }

        const index = state.clips.findIndex(function (clip) {
            return clip.id === id;
        });

        if (index === -1) {
            return;
        }

        state.clips.splice(index, 1);

        if (state.activeClipId === id) {
            const nextClip =
                state.clips[Math.max(0, index - 1)];

            state.activeClipId = nextClip.id;

            loadClipState(nextClip);
        }

        renderClipList();
    }

    function selectClip(id) {
        saveCurrentClipState();

        const clip = state.clips.find(function (item) {
            return item.id === id;
        });

        if (!clip) {
            return;
        }

        state.activeClipId = id;

        video.currentTime = clip.start;

        loadClipState(clip);
        renderClipList();
    }

    function updateActiveClipTiming(start, end) {
        const clip = getActiveClip();

        if (!clip) {
            return;
        }

        const duration = getDuration();

        clip.start = clamp(
            Number(start) || 0,
            0,
            duration
        );

        clip.end = clamp(
            Number(end) || duration,
            clip.start,
            duration
        );

        renderClipList();
    }

    function createClipControls() {
        if (document.getElementById("enhancedClipPanel")) {
            return;
        }

        const panel = document.createElement("section");

        panel.id = "enhancedClipPanel";
        panel.className = "side-section";

        panel.innerHTML = `
            <div class="side-title">Clips</div>

            <div
                id="enhancedClipList"
                style="
                    display:grid;
                    gap:6px;
                    margin-bottom:8px;
                "
            ></div>

            <button
                id="enhancedAddClip"
                class="small-button"
                type="button"
                style="width:100%;"
            >
                + Add Clip
            </button>
        `;

        const sidePanel =
            document.querySelector(".side-panel");

        if (sidePanel) {
            sidePanel.insertBefore(
                panel,
                sidePanel.firstElementChild
            );
        }

        document
            .getElementById("enhancedAddClip")
            .addEventListener("click", function () {
                addClip();
            });
    }

    function renderClipList() {
        const list =
            document.getElementById("enhancedClipList");

        if (!list) {
            return;
        }

        list.innerHTML = "";

        state.clips.forEach(function (clip, index) {
            const row =
                document.createElement("div");

            row.style.display = "grid";
            row.style.gridTemplateColumns =
                "1fr auto";
            row.style.gap = "5px";

            const button =
                document.createElement("button");

            button.type = "button";
            button.className = "small-button";
            button.style.textAlign = "left";

            button.textContent =
                "Clip " +
                (index + 1) +
                "  " +
                formatTime(clip.start) +
                " – " +
                formatTime(clip.end);

            if (clip.id === state.activeClipId) {
                button.style.borderColor =
                    "var(--accent)";
                button.style.background =
                    "#241914";
            }

            button.addEventListener(
                "click",
                function () {
                    selectClip(clip.id);
                }
            );

            const remove =
                document.createElement("button");

            remove.type = "button";
            remove.className = "small-button";
            remove.textContent = "×";
            remove.style.width = "32px";

            remove.addEventListener(
                "click",
                function (event) {
                    event.stopPropagation();
                    removeClip(clip.id);
                }
            );

            row.appendChild(button);
            row.appendChild(remove);

            list.appendChild(row);
        });
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) {
            return "00:00";
        }

        seconds = Math.max(0, seconds);

        const minutes =
            Math.floor(seconds / 60);

        const secs =
            Math.floor(seconds % 60);

        return String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0");
    }

    function updateCropPreview() {
        if (!container || !video) {
            return;
        }

        if (
            !container.classList.contains(
                "reframing"
            )
        ) {
            video.style.transform = "";
            video.style.transformOrigin = "";
            return;
        }

        const zoom =
            Math.max(
                100,
                Number(state.crop.zoom) || 100
            );

        /*
         * The video itself remains inside the original
         * preview container. Zoom is applied visually,
         * while the 9:16 frame remains the crop reference.
         */
        video.style.transform =
            "scale(" +
            (zoom / 100) +
            ")";

        video.style.transformOrigin =
            "center center";

        updateOverlayPosition();
    }

    function getOverlayLimits() {
        const containerRect =
            container.getBoundingClientRect();

        const overlayRect =
            overlay.getBoundingClientRect();

        const maxX =
            Math.max(
                0,
                (containerRect.width -
                    overlayRect.width) / 2
            );

        const maxY =
            Math.max(
                0,
                (containerRect.height -
                    overlayRect.height) / 2
            );

        return {
            maxX,
            maxY
        };
    }

    function updateOverlayPosition() {
        const limits =
            getOverlayLimits();

        state.crop.x = clamp(
            state.crop.x,
            -limits.maxX,
            limits.maxX
        );

        state.crop.y = clamp(
            state.crop.y,
            -limits.maxY,
            limits.maxY
        );

        overlay.style.transform =
            "translate(" +
            state.crop.x +
            "px," +
            state.crop.y +
            "px)";
    }

    function startDrag(event) {
        if (
            !container.classList.contains(
                "reframing"
            )
        ) {
            return;
        }

        event.preventDefault();

        state.dragging = true;

        state.dragStartX =
            event.clientX;

        state.dragStartY =
            event.clientY;

        state.dragOriginX =
            state.crop.x;

        state.dragOriginY =
            state.crop.y;

        overlay.setPointerCapture(
            event.pointerId
        );
    }

    function moveDrag(event) {
        if (!state.dragging) {
            return;
        }

        event.preventDefault();

        state.crop.x =
            state.dragOriginX +
            event.clientX -
            state.dragStartX;

        state.crop.y =
            state.dragOriginY +
            event.clientY -
            state.dragStartY;

        updateOverlayPosition();

        saveCurrentClipState();
    }

    function stopDrag(event) {
        if (!state.dragging) {
            return;
        }

        state.dragging = false;

        if (
            event &&
            overlay.hasPointerCapture(
                event.pointerId
            )
        ) {
            overlay.releasePointerCapture(
                event.pointerId
            );
        }

        saveCurrentClipState();
    }

    function createLayoutControls() {
        if (
            document.getElementById(
                "enhancedLayoutPanel"
            )
        ) {
            return;
        }

        const panel =
            document.createElement("section");

        panel.id =
            "enhancedLayoutPanel";

        panel.className =
            "side-section";

        panel.innerHTML = `
            <div class="side-title">
                Layout
            </div>

            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:6px;
                "
            >
                <button
                    type="button"
                    class="small-button"
                    data-layout="single"
                >
                    Single
                </button>

                <button
                    type="button"
                    class="small-button"
                    data-layout="split"
                >
                    Speaker 1 + 2
                </button>
            </div>
        `;

        const sidePanel =
            document.querySelector(".side-panel");

        if (sidePanel) {
            sidePanel.appendChild(panel);
        }

        panel
            .querySelectorAll(
                "[data-layout]"
            )
            .forEach(function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        setLayout(
                            button.dataset.layout
                        );
                    }
                );
            });
    }

    function setLayout(layout) {
        state.layout = layout;

        container.classList.toggle(
            "split-layout",
            layout === "split"
        );

        updateSplitPreview();

        document
            .querySelectorAll(
                "[data-layout]"
            )
            .forEach(function (button) {
                button.style.borderColor =
                    button.dataset.layout === layout
                        ? "var(--accent)"
                        : "";
            });
    }

    function updateSplitPreview() {
        let splitOverlay =
            document.getElementById(
                "enhancedSplitPreview"
            );

        if (state.layout !== "split") {
            if (splitOverlay) {
                splitOverlay.remove();
            }

            return;
        }

        if (!splitOverlay) {
            splitOverlay =
                document.createElement("div");

            splitOverlay.id =
                "enhancedSplitPreview";

            splitOverlay.style.position =
                "absolute";

            splitOverlay.style.inset =
                "0";

            splitOverlay.style.zIndex =
                "10";

            splitOverlay.style.pointerEvents =
                "none";

            splitOverlay.innerHTML = `
                <div
                    style="
                        position:absolute;
                        left:8%;
                        right:8%;
                        top:5%;
                        height:44%;
                        border:2px solid var(--accent);
                        border-radius:6px;
                        box-shadow:0 0 0 1px rgba(255,255,255,.1);
                    "
                >
                    <span
                        style="
                            position:absolute;
                            top:6px;
                            left:6px;
                            padding:3px 6px;
                            border-radius:4px;
                            background:rgba(0,0,0,.7);
                            font-size:10px;
                        "
                    >
                        Speaker 1
                    </span>
                </div>

                <div
                    style="
                        position:absolute;
                        left:8%;
                        right:8%;
                        bottom:5%;
                        height:44%;
                        border:2px solid #fff;
                        border-radius:6px;
                        box-shadow:0 0 0 1px rgba(255,255,255,.1);
                    "
                >
                    <span
                        style="
                            position:absolute;
                            top:6px;
                            left:6px;
                            padding:3px 6px;
                            border-radius:4px;
                            background:rgba(0,0,0,.7);
                            font-size:10px;
                        "
                    >
                        Speaker 2
                    </span>
                </div>
            `;

            container.appendChild(
                splitOverlay
            );
        }
    }

    function connectExistingTrimControls() {
        const startInput =
            document.getElementById(
                "startTimeInput"
            );

        const endInput =
            document.getElementById(
                "endTimeInput"
            );

        if (startInput) {
            startInput.addEventListener(
                "change",
                function () {
                    const clip =
                        getActiveClip();

                    if (!clip) {
                        return;
                    }

                    clip.start =
                        Number(
                            startInput.value
                                .split(":")
                                .reduce(
                                    function (
                                        total,
                                        part
                                    ) {
                                        return (
                                            total *
                                                60 +
                                            Number(part)
                                        );
                                    },
                                    0
                                )
                        );

                    clip.start =
                        clamp(
                            clip.start,
                            0,
                            clip.end
                        );

                    renderClipList();
                }
            );
        }

        if (endInput) {
            endInput.addEventListener(
                "change",
                function () {
                    const clip =
                        getActiveClip();

                    if (!clip) {
                        return;
                    }

                    clip.end =
                        Number(
                            endInput.value
                                .split(":")
                                .reduce(
                                    function (
                                        total,
                                        part
                                    ) {
                                        return (
                                            total *
                                                60 +
                                            Number(part)
                                        );
                                    },
                                    0
                                )
                        );

                    clip.end =
                        clamp(
                            clip.end,
                            clip.start,
                            getDuration()
                        );

                    renderClipList();
                }
            );
        }
    }

    function connectZoom() {
        if (!zoomRange) {
            return;
        }

        zoomRange.addEventListener(
            "input",
            function () {
                state.crop.zoom =
                    clamp(
                        Number(
                            zoomRange.value
                        ),
                        100,
                        300
                    );

                if (zoomValue) {
                    zoomValue.textContent =
                        Math.round(
                            state.crop.zoom
                        ) + "%";
                }

                updateCropPreview();
                saveCurrentClipState();
            }
        );
    }

    function connectCropDrag() {
        overlay.addEventListener(
            "pointerdown",
            startDrag
        );

        overlay.addEventListener(
            "pointermove",
            moveDrag
        );

        overlay.addEventListener(
            "pointerup",
            stopDrag
        );

        overlay.addEventListener(
            "pointercancel",
            stopDrag
        );
    }

    function connectVideoEvents() {
        video.addEventListener(
            "loadedmetadata",
            function () {
                initializeClips();
                renderClipList();
                updateCropPreview();
            }
        );

        video.addEventListener(
            "timeupdate",
            function () {
                const clip =
                    getActiveClip();

                if (!clip) {
                    return;
                }

                if (
                    video.currentTime >=
                    clip.end
                ) {
                    video.pause();
                    video.currentTime =
                        clip.end;
                }
            }
        );
    }

    function injectStyles() {
        if (
            document.getElementById(
                "enhancedEditorStyles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "enhancedEditorStyles";

        style.textContent = `
            #videoPreview {
                transition:
                    transform 80ms linear;
                will-change: transform;
            }

            #cropOverlay {
                will-change: transform;
            }

            .split-layout
                #cropOverlay {
                opacity: .35;
            }

            #enhancedClipPanel
                .small-button,
            #enhancedLayoutPanel
                .small-button {
                transition:
                    border-color .15s,
                    background .15s;
            }
        `;

        document.head.appendChild(style);
    }

    function initialize() {
        injectStyles();

        createClipControls();
        createLayoutControls();

        connectCropDrag();
        connectZoom();
        connectVideoEvents();
        connectExistingTrimControls();

        if (getDuration() > 0) {
            initializeClips();
            renderClipList();
        }
    }

    /*
     * Delay initialization until the existing
     * application's DOM and handlers are ready.
     */
    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            { once: true }
        );
    } else {
        initialize();
    }

    /*
     * Expose only the safe editor API.
     * No existing global functions are overwritten.
     */
    window.FreeVideoClipperEnhancements = {
        addClip,
        removeClip,
        selectClip,
        setLayout,
        getClips: function () {
            saveCurrentClipState();

            return state.clips.map(
                function (clip) {
                    return JSON.parse(
                        JSON.stringify(clip)
                    );
                }
            );
        }
    };
})();
