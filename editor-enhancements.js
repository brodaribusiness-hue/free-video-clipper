(function () {
    "use strict";

    /*
     * Free Video Clipper
     *
     * Editor enhancements:
     * - Multiple clip state
     * - 9:16 reframe
     * - Single layout export
     * - Speaker 1 + 2 split layout export
     * - Independent Speaker 1 / Speaker 2 crop positions
     * - Independent Speaker 1 / Speaker 2 zoom
     * - Real browser-side export using Canvas + MediaRecorder
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

        speaker1: {
            x: 0.25,
            y: 0.5,
            zoom: 100
        },

        speaker2: {
            x: 0.75,
            y: 0.5,
            zoom: 100
        },

        dragging: false,
        dragTarget: null,
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

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function getDuration() {
        return Number.isFinite(video.duration)
            ? video.duration
            : 0;
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) {
            return "00:00";
        }

        seconds = Math.max(0, seconds);

        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0")
        );
    }

    function getActiveClip() {
        return state.clips.find(function (clip) {
            return clip.id === state.activeClipId;
        }) || null;
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
                x: 0.25,
                y: 0.5,
                zoom: 100
            },

            speaker2: {
                x: 0.75,
                y: 0.5,
                zoom: 100
            }
        };
    }

    function initializeClips() {
        const duration = getDuration();

        if (!duration) {
            return;
        }

        if (state.clips.length === 0) {
            const clip = createClip(0, duration);

            state.clips.push(clip);
            state.activeClipId = clip.id;
        }

        loadClipState(getActiveClip());
    }

    function saveCurrentClipState() {
        const clip = getActiveClip();

        if (!clip) {
            return;
        }

        clip.crop.x = state.crop.x;
        clip.crop.y = state.crop.y;
        clip.crop.zoom = state.crop.zoom;

        clip.speaker1.x = state.speaker1.x;
        clip.speaker1.y = state.speaker1.y;
        clip.speaker1.zoom = state.speaker1.zoom;

        clip.speaker2.x = state.speaker2.x;
        clip.speaker2.y = state.speaker2.y;
        clip.speaker2.zoom = state.speaker2.zoom;
    }

    function loadClipState(clip) {
        if (!clip) {
            return;
        }

        state.crop.x = Number(clip.crop?.x) || 0;
        state.crop.y = Number(clip.crop?.y) || 0;
        state.crop.zoom =
            Number(clip.crop?.zoom) || 100;

        state.speaker1.x =
            Number(clip.speaker1?.x) || 0.25;

        state.speaker1.y =
            Number(clip.speaker1?.y) || 0.5;

        state.speaker1.zoom =
            Number(clip.speaker1?.zoom) || 100;

        state.speaker2.x =
            Number(clip.speaker2?.x) || 0.75;

        state.speaker2.y =
            Number(clip.speaker2?.y) || 0.5;

        state.speaker2.zoom =
            Number(clip.speaker2?.zoom) || 100;

        updateControls();
        updateCropPreview();
        updateSpeakerPreview();
    }

    function addClip() {
        const duration = getDuration();

        if (!duration) {
            return;
        }

        saveCurrentClipState();

        const active = getActiveClip();

        const start = active
            ? active.end
            : 0;

        const end = duration;

        if (start >= end) {
            return;
        }

        const clip = createClip(start, end);

        state.clips.push(clip);
        state.activeClipId = clip.id;

        loadClipState(clip);
        renderClipList();
    }

    function removeClip(id) {
        if (state.clips.length <= 1) {
            return;
        }

        const index = state.clips.findIndex(
            function (clip) {
                return clip.id === id;
            }
        );

        if (index === -1) {
            return;
        }

        state.clips.splice(index, 1);

        if (state.activeClipId === id) {
            const nextClip =
                state.clips[index] ||
                state.clips[index - 1] ||
                state.clips[0];

            state.activeClipId = nextClip.id;

            video.currentTime = nextClip.start;

            loadClipState(nextClip);
        }

        renderClipList();
    }

    function selectClip(id) {
        saveCurrentClipState();

        const clip = state.clips.find(
            function (item) {
                return item.id === id;
            }
        );

        if (!clip) {
            return;
        }

        state.activeClipId = id;

        video.currentTime = clip.start;

        loadClipState(clip);
        renderClipList();
    }

    function renderClipList() {
        const list =
            document.getElementById(
                "enhancedClipList"
            );

        if (!list) {
            return;
        }

        list.innerHTML = "";

        state.clips.forEach(
            function (clip, index) {
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

                if (
                    clip.id ===
                    state.activeClipId
                ) {
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
                remove.className =
                    "small-button";

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
            }
        );
    }

    function createClipControls() {
        if (
            document.getElementById(
                "enhancedClipPanel"
            )
        ) {
            return;
        }

        const panel =
            document.createElement("section");

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

        const addButton =
            document.getElementById(
                "enhancedAddClip"
            );

        if (addButton) {
            addButton.addEventListener(
                "click",
                addClip
            );
        }
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

        panel.id = "enhancedLayoutPanel";
        panel.className = "side-section";

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

            <div
                id="speakerControls"
                style="
                    display:none;
                    margin-top:12px;
                    gap:12px;
                "
            >
                <div>
                    <div
                        style="
                            font-size:10px;
                            color:var(--muted);
                            margin-bottom:6px;
                        "
                    >
                        Speaker 1
                    </div>

                    <label
                        style="
                            display:block;
                            font-size:9px;
                            color:var(--dim);
                        "
                    >
                        Position
                    </label>

                    <input
                        id="speaker1Position"
                        type="range"
                        min="0"
                        max="100"
                        value="25"
                        class="range-input"
                    >

                    <label
                        style="
                            display:block;
                            font-size:9px;
                            color:var(--dim);
                            margin-top:6px;
                        "
                    >
                        Zoom
                    </label>

                    <input
                        id="speaker1Zoom"
                        type="range"
                        min="100"
                        max="300"
                        value="100"
                        class="range-input"
                    >
                </div>

                <div>
                    <div
                        style="
                            font-size:10px;
                            color:var(--muted);
                            margin-bottom:6px;
                        "
                    >
                        Speaker 2
                    </div>

                    <label
                        style="
                            display:block;
                            font-size:9px;
                            color:var(--dim);
                        "
                    >
                        Position
                    </label>

                    <input
                        id="speaker2Position"
                        type="range"
                        min="0"
                        max="100"
                        value="75"
                        class="range-input"
                    >

                    <label
                        style="
                            display:block;
                            font-size:9px;
                            color:var(--dim);
                            margin-top:6px;
                        "
                    >
                        Zoom
                    </label>

                    <input
                        id="speaker2Zoom"
                        type="range"
                        min="100"
                        max="300"
                        value="100"
                        class="range-input"
                    >
                </div>
            </div>
        `;

        const sidePanel =
            document.querySelector(".side-panel");

        if (sidePanel) {
            sidePanel.appendChild(panel);
        }

        panel
            .querySelectorAll("[data-layout]")
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

        const speaker1Position =
            document.getElementById(
                "speaker1Position"
            );

        const speaker2Position =
            document.getElementById(
                "speaker2Position"
            );

        const speaker1Zoom =
            document.getElementById(
                "speaker1Zoom"
            );

        const speaker2Zoom =
            document.getElementById(
                "speaker2Zoom"
            );

        if (speaker1Position) {
            speaker1Position.addEventListener(
                "input",
                function () {
                    state.speaker1.x =
                        Number(
                            speaker1Position.value
                        ) / 100;

                    saveCurrentClipState();
                    updateSpeakerPreview();
                }
            );
        }

        if (speaker2Position) {
            speaker2Position.addEventListener(
                "input",
                function () {
                    state.speaker2.x =
                        Number(
                            speaker2Position.value
                        ) / 100;

                    saveCurrentClipState();
                    updateSpeakerPreview();
                }
            );
        }

        if (speaker1Zoom) {
            speaker1Zoom.addEventListener(
                "input",
                function () {
                    state.speaker1.zoom =
                        Number(
                            speaker1Zoom.value
                        );

                    saveCurrentClipState();
                    updateSpeakerPreview();
                }
            );
        }

        if (speaker2Zoom) {
            speaker2Zoom.addEventListener(
                "input",
                function () {
                    state.speaker2.zoom =
                        Number(
                            speaker2Zoom.value
                        );

                    saveCurrentClipState();
                    updateSpeakerPreview();
                }
            );
        }
    }

    function setLayout(layout) {
        state.layout =
            layout === "split"
                ? "split"
                : "single";

        container.classList.toggle(
            "split-layout",
            state.layout === "split"
        );

        const controls =
            document.getElementById(
                "speakerControls"
            );

        if (controls) {
            controls.style.display =
                state.layout === "split"
                    ? "grid"
                    : "none";
        }

        document
            .querySelectorAll(
                "[data-layout]"
            )
            .forEach(function (button) {
                const active =
                    button.dataset.layout ===
                    state.layout;

                button.style.borderColor =
                    active
                        ? "var(--accent)"
                        : "";

                button.style.background =
                    active
                        ? "#241914"
                        : "";
            });

        updateSpeakerPreview();
    }

    function updateSpeakerPreview() {
        let preview =
            document.getElementById(
                "enhancedSplitPreview"
            );

        if (state.layout !== "split") {
            if (preview) {
                preview.remove();
            }

            return;
        }

        if (!preview) {
            preview =
                document.createElement("div");

            preview.id =
                "enhancedSplitPreview";

            preview.style.position =
                "absolute";

            preview.style.inset = "0";
            preview.style.zIndex = "10";
            preview.style.pointerEvents =
                "none";

            preview.innerHTML = `
                <div
                    id="speaker1Preview"
                    style="
                        position:absolute;
                        left:8%;
                        right:8%;
                        top:5%;
                        height:44%;
                        border:2px solid var(--accent);
                        border-radius:6px;
                        box-shadow:
                            0 0 0 1px
                            rgba(255,255,255,.1);
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
                    id="speaker2Preview"
                    style="
                        position:absolute;
                        left:8%;
                        right:8%;
                        bottom:5%;
                        height:44%;
                        border:2px solid #fff;
                        border-radius:6px;
                        box-shadow:
                            0 0 0 1px
                            rgba(255,255,255,.1);
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

            container.appendChild(preview);
        }
    }

    function updateControls() {
        if (zoomRange) {
            zoomRange.value =
                String(
                    Math.round(
                        state.crop.zoom
                    )
                );
        }

        if (zoomValue) {
            zoomValue.textContent =
                Math.round(
                    state.crop.zoom
                ) + "%";
        }

        const speaker1Position =
            document.getElementById(
                "speaker1Position"
            );

        const speaker2Position =
            document.getElementById(
                "speaker2Position"
            );

        const speaker1Zoom =
            document.getElementById(
                "speaker1Zoom"
            );

        const speaker2Zoom =
            document.getElementById(
                "speaker2Zoom"
            );

        if (speaker1Position) {
            speaker1Position.value =
                String(
                    Math.round(
                        state.speaker1.x *
                        100
                    )
                );
        }

        if (speaker2Position) {
            speaker2Position.value =
                String(
                    Math.round(
                        state.speaker2.x *
                        100
                    )
                );
        }

        if (speaker1Zoom) {
            speaker1Zoom.value =
                String(
                    Math.round(
                        state.speaker1.zoom
                    )
                );
        }

        if (speaker2Zoom) {
            speaker2Zoom.value =
                String(
                    Math.round(
                        state.speaker2.zoom
                    )
                );
        }
    }

    function updateCropPreview() {
        if (
            !container ||
            !video
        ) {
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
                Number(
                    state.crop.zoom
                ) || 100
            );

        video.style.transform =
            "scale(" +
            zoom / 100 +
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

        return {
            maxX: Math.max(
                0,
                (
                    containerRect.width -
                    overlayRect.width
                ) / 2
            ),

            maxY: Math.max(
                0,
                (
                    containerRect.height -
                    overlayRect.height
                ) / 2
            )
        };
    }

    function updateOverlayPosition() {
        const limits =
            getOverlayLimits();

        state.crop.x =
            clamp(
                state.crop.x,
                -limits.maxX,
                limits.maxX
            );

        state.crop.y =
            clamp(
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
        state.dragTarget = "crop";

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
        if (
            !state.dragging ||
            state.dragTarget !== "crop"
        ) {
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
        state.dragTarget = null;

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

    function connectExistingTrimControls() {
        const startInput =
            document.getElementById(
                "startTimeInput"
            );

        const endInput =
            document.getElementById(
                "endTimeInput"
            );

        function parseTime(value) {
            const parts =
                String(value)
                    .split(":")
                    .map(Number);

            if (parts.length === 2) {
                return (
                    parts[0] * 60 +
                    parts[1]
                );
            }

            if (parts.length === 3) {
                return (
                    parts[0] * 3600 +
                    parts[1] * 60 +
                    parts[2]
                );
            }

            return 0;
        }

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
                        clamp(
                            parseTime(
                                startInput.value
                            ),
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
                        clamp(
                            parseTime(
                                endInput.value
                            ),
                            clip.start,
                            getDuration()
                        );

                    renderClipList();
                }
            );
        }
    }

    function getExportQuality() {
        const selected =
            document.querySelector(
                'input[name="quality"]:checked'
            );

        if (
            selected &&
            selected.value
        ) {
            return selected.value;
        }

        return "original";
    }

    function getExportAudioMode() {
        const selected =
            document.querySelector(
                'input[name="audio"]:checked'
            );

        if (
            selected &&
            selected.value
        ) {
            return selected.value;
        }

        return "original";
    }

    function getExportRatio() {
        const active =
            document.querySelector(
                ".ratio-button.active"
            );

        if (!active) {
            return "original";
        }

        return (
            active.dataset.ratio ||
            "original"
        );
    }

    function getMimeType() {
        const types = [
            "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
            "video/mp4;codecs=avc1.4D401F,mp4a.40.2",
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm"
        ];

        for (
            let i = 0;
            i < types.length;
            i++
        ) {
            if (
                window.MediaRecorder &&
                MediaRecorder.isTypeSupported(
                    types[i]
                )
            ) {
                return types[i];
            }
        }

        return "";
    }

    function getOutputSize() {
        const sourceWidth =
            video.videoWidth;

        const sourceHeight =
            video.videoHeight;

        if (
            !sourceWidth ||
            !sourceHeight
        ) {
            return {
                width: 720,
                height: 1280
            };
        }

        const ratio =
            getExportRatio();

        if (
            ratio === "9:16"
        ) {
            return {
                width: 720,
                height: 1280
            };
        }

        if (
            ratio === "1:1"
        ) {
            return {
                width: 1080,
                height: 1080
            };
        }

        if (
            ratio === "4:5"
        ) {
            return {
                width: 864,
                height: 1080
            };
        }

        if (
            ratio === "16:9"
        ) {
            return {
                width: 1280,
                height: 720
            };
        }

        let width =
            sourceWidth;

        let height =
            sourceHeight;

        const quality =
            getExportQuality();

        if (
            quality === "high"
        ) {
            const maxWidth = 1920;
            const maxHeight = 1080;

            const scale =
                Math.min(
                    maxWidth / width,
                    maxHeight / height,
                    1
                );

            width =
                Math.round(
                    width * scale
                );

            height =
                Math.round(
                    height * scale
                );
        }

        return {
            width,
            height
        };
    }

    function calculateCropSource(
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        centerX,
        centerY,
        zoom
    ) {
        const targetRatio =
            targetWidth /
            targetHeight;

        let cropWidth =
            sourceWidth /
            Math.max(
                1,
                zoom / 100
            );

        let cropHeight =
            cropWidth /
            targetRatio;

        if (
            cropHeight >
            sourceHeight
        ) {
            cropHeight =
                sourceHeight /
                Math.max(
                    1,
                    zoom / 100
                );

            cropWidth =
                cropHeight *
                targetRatio;
        }

        cropWidth =
            Math.min(
                cropWidth,
                sourceWidth
            );

        cropHeight =
            Math.min(
                cropHeight,
                sourceHeight
            );

        const maxX =
            sourceWidth -
            cropWidth;

        const maxY =
            sourceHeight -
            cropHeight;

        const x =
            clamp(
                centerX,
                0,
                1
            ) *
            maxX;

        const y =
            clamp(
                centerY,
                0,
                1
            ) *
            maxY;

        return {
            x,
            y,
            width: cropWidth,
            height: cropHeight
        };
    }

    function drawCover(
        ctx,
        source,
        sourceWidth,
        sourceHeight,
        targetX,
        targetY,
        targetWidth,
        targetHeight,
        centerX,
        centerY,
        zoom
    ) {
        const crop =
            calculateCropSource(
                sourceWidth,
                sourceHeight,
                targetWidth,
                targetHeight,
                centerX,
                centerY,
                zoom
            );

        ctx.drawImage(
            source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            targetX,
            targetY,
            targetWidth,
            targetHeight
        );
    }

    function drawSingleFrame(
        ctx,
        canvas,
        currentVideo
    ) {
        const width =
            canvas.width;

        const height =
            canvas.height;

        ctx.fillStyle = "#000";
        ctx.fillRect(
            0,
            0,
            width,
            height
        );

        const ratio =
            getExportRatio();

        if (
            ratio === "original"
        ) {
            const sourceRatio =
                currentVideo.videoWidth /
                currentVideo.videoHeight;

            const targetRatio =
                width / height;

            let drawWidth =
                width;

            let drawHeight =
                height;

            if (
                sourceRatio >
                targetRatio
            ) {
                drawHeight =
                    width /
                    sourceRatio;
            } else {
                drawWidth =
                    height *
                    sourceRatio;
            }

            const x =
                (width -
                    drawWidth) /
                2;

            const y =
                (height -
                    drawHeight) /
                2;

            ctx.drawImage(
                currentVideo,
                x,
                y,
                drawWidth,
                drawHeight
            );

            return;
        }

        drawCover(
            ctx,
            currentVideo,
            currentVideo.videoWidth,
            currentVideo.videoHeight,
            0,
            0,
            width,
            height,
            0.5,
            0.5,
            state.crop.zoom
        );
    }

    function drawSplitFrame(
        ctx,
        canvas,
        currentVideo
    ) {
        const width =
            canvas.width;

        const height =
            canvas.height;

        const half =
            Math.floor(
                height / 2
            );

        ctx.fillStyle = "#000";

        ctx.fillRect(
            0,
            0,
            width,
            height
        );

        drawCover(
            ctx,
            currentVideo,
            currentVideo.videoWidth,
            currentVideo.videoHeight,
            0,
            0,
            width,
            half,
            state.speaker1.x,
            state.speaker1.y,
            state.speaker1.zoom
        );

        drawCover(
            ctx,
            currentVideo,
            currentVideo.videoWidth,
            currentVideo.videoHeight,
            0,
            half,
            width,
            height - half,
            state.speaker2.x,
            state.speaker2.y,
            state.speaker2.zoom
        );

        ctx.fillStyle =
            "rgba(255,255,255,.12)";

        ctx.fillRect(
            0,
            half - 1,
            width,
            2
        );
    }

    function createExportVideo() {
        const source =
            document.createElement(
                "video"
            );

        source.muted = true;
        source.playsInline = true;
        source.preload = "auto";

        source.src =
            video.currentSrc ||
            video.src;

        return source;
    }

    async function waitForVideoReady(
        source
    ) {
        if (
            source.readyState >= 2
        ) {
            return;
        }

        await new Promise(
            function (
                resolve,
                reject
            ) {
                function done() {
                    cleanup();
                    resolve();
                }

                function fail() {
                    cleanup();
                    reject(
                        new Error(
                            "Video could not be prepared for export."
                        )
                    );
                }

                function cleanup() {
                    source.removeEventListener(
                        "loadeddata",
                        done
                    );

                    source.removeEventListener(
                        "error",
                        fail
                    );
                }

                source.addEventListener(
                    "loadeddata",
                    done,
                    {
                        once: true
                    }
                );

                source.addEventListener(
                    "error",
                    fail,
                    {
                        once: true
                    }
                );

                source.load();
            }
        );
    }

    function createAudioStream(
        source
    ) {
        const mode =
            getExportAudioMode();

        if (
            mode === "none" ||
            mode === "no-audio"
        ) {
            return null;
        }

        if (
            !window.AudioContext &&
            !window.webkitAudioContext
        ) {
            return null;
        }

        try {
            const AudioContextClass =
                window.AudioContext ||
                window.webkitAudioContext;

            const audioContext =
                new AudioContextClass();

            const mediaSource =
                audioContext.createMediaElementSource(
                    source
                );

            const destination =
                audioContext.createMediaStreamDestination();

            mediaSource.connect(
                destination
            );

            return {
                stream:
                    destination.stream,
                context:
                    audioContext,
                source:
                    mediaSource
            };
        } catch (error) {
            return null;
        }
    }

    function combineStreams(
        canvasStream,
        audioStream
    ) {
        const combined =
            new MediaStream();

        canvasStream
            .getVideoTracks()
            .forEach(function (track) {
                combined.addTrack(track);
            });

        if (audioStream) {
            audioStream
                .getAudioTracks()
                .forEach(function (track) {
                    combined.addTrack(track);
                });
        }

        return combined;
    }

    function showExportProgress(
        percent
    ) {
        let progress =
            document.getElementById(
                "enhancedExportProgress"
            );

        if (!progress) {
            progress =
                document.createElement(
                    "div"
                );

            progress.id =
                "enhancedExportProgress";

            progress.style.position =
                "fixed";

            progress.style.left = "50%";
            progress.style.top = "50%";
            progress.style.transform =
                "translate(-50%,-50%)";

            progress.style.zIndex =
                "99999";

            progress.style.width =
                "min(420px,90vw)";

            progress.style.padding =
                "24px";

            progress.style.border =
                "1px solid var(--border)";

            progress.style.borderRadius =
                "12px";

            progress.style.background =
                "var(--panel)";

            progress.style.boxShadow =
                "0 20px 60px rgba(0,0,0,.5)";

            progress.innerHTML = `
                <div
                    style="
                        font-weight:700;
                        margin-bottom:12px;
                    "
                >
                    Creating Video
                </div>

                <div
                    style="
                        height:8px;
                        border-radius:999px;
                        background:#303036;
                        overflow:hidden;
                    "
                >
                    <div
                        id="enhancedProgressBar"
                        style="
                            width:0%;
                            height:100%;
                            background:var(--accent);
                        "
                    ></div>
                </div>

                <div
                    id="enhancedProgressText"
                    style="
                        margin-top:8px;
                        color:var(--muted);
                        font-size:11px;
                    "
                >
                    0%
                </div>
            `;

            document.body.appendChild(
                progress
            );
        }

        const bar =
            document.getElementById(
                "enhancedProgressBar"
            );

        const text =
            document.getElementById(
                "enhancedProgressText"
            );

        if (bar) {
            bar.style.width =
                clamp(
                    percent,
                    0,
                    100
                ) + "%";
        }

        if (text) {
            text.textContent =
                Math.round(
                    clamp(
                        percent,
                        0,
                        100
                    )
                ) + "%";
        }
    }

    function hideExportProgress() {
        const progress =
            document.getElementById(
                "enhancedExportProgress"
            );

        if (progress) {
            progress.remove();
        }
    }

    function createDownload(
        blob
    ) {
        const url =
            URL.createObjectURL(
                blob
            );

        const extension =
            blob.type.includes(
                "mp4"
            )
                ? "mp4"
                : "webm";

        const link =
            document.createElement(
                "a"
            );

        link.href = url;

        link.download =
            "free-video-clip-" +
            Date.now() +
            "." +
            extension;

        link.textContent =
            "Download Video";

        link.className =
            "primary-button";

        link.style.display =
            "inline-flex";

        link.style.alignItems =
            "center";

        link.style.justifyContent =
            "center";

        link.style.textDecoration =
            "none";

        link.style.marginTop =
            "12px";

        document.body.appendChild(
            link
        );

        link.click();

        setTimeout(
            function () {
                link.remove();
                URL.revokeObjectURL(
                    url
                );
            },
            60000
        );
    }

    async function exportVideo() {
        const clip =
            getActiveClip();

        if (!clip) {
            throw new Error(
                "No clip is selected."
            );
        }

        if (
            !video.src &&
            !video.currentSrc
        ) {
            throw new Error(
                "No video is loaded."
            );
        }

        if (
            !window.MediaRecorder
        ) {
            throw new Error(
                "This browser does not support video export."
            );
        }

        const mimeType =
            getMimeType();

        if (!mimeType) {
            throw new Error(
                "This browser does not support a compatible video export format."
            );
        }

        saveCurrentClipState();

        const source =
            createExportVideo();

        await waitForVideoReady(
            source
        );

        const size =
            getOutputSize();

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            size.width;

        canvas.height =
            size.height;

        const ctx =
            canvas.getContext(
                "2d",
                {
                    alpha: false
                }
            );

        if (!ctx) {
            throw new Error(
                "Canvas export is not available."
            );
        }

        const canvasStream =
            canvas.captureStream(
                30
            );

        const audio =
            createAudioStream(
                source
            );

        const stream =
            combineStreams(
                canvasStream,
                audio
                    ? audio.stream
                    : null
            );

        const chunks = [];

        const recorder =
            new MediaRecorder(
                stream,
                {
                    mimeType,
                    videoBitsPerSecond:
                        getExportQuality() ===
                        "high"
                            ? 10_000_000
                            : 6_000_000
                }
            );

        let finished = false;

        const recording =
            new Promise(
                function (
                    resolve,
                    reject
                ) {
                    recorder.ondataavailable =
                        function (
                            event
                        ) {
                            if (
                                event.data &&
                                event.data.size
                            ) {
                                chunks.push(
                                    event.data
                                );
                            }
                        };

                    recorder.onerror =
                        function (
                            event
                        ) {
                            reject(
                                event.error ||
                                new Error(
                                    "Video recording failed."
                                )
                            );
                        };

                    recorder.onstop =
                        function () {
                            if (finished) {
                                return;
                            }

                            finished = true;

                            resolve(
                                new Blob(
                                    chunks,
                                    {
                                        type:
                                            mimeType
                                    }
                                )
                            );
                        };
                }
            );

        const start =
            clamp(
                Number(
                    clip.start
                ) || 0,
                0,
                source.duration
            );

        const end =
            clamp(
                Number(
                    clip.end
                ) || source.duration,
                start,
                source.duration
            );

        source.currentTime =
            start;

        await new Promise(
            function (resolve) {
                if (
                    Math.abs(
                        source.currentTime -
                        start
                    ) < 0.05
                ) {
                    resolve();
                    return;
                }

                source.addEventListener(
                    "seeked",
                    resolve,
                    {
                        once: true
                    }
                );
            }
        );

        showExportProgress(0);

        recorder.start(
            250
        );

        await source.play();

        const exportDuration =
            Math.max(
                0.1,
                end - start
            );

        await new Promise(
            function (
                resolve
            ) {
                let animationFrame;

                function draw() {
                    if (
                        source.paused ||
                        source.ended ||
                        source.currentTime >= end
                    ) {
                        resolve();
                        return;
                    }

                    if (
                        state.layout ===
                        "split"
                    ) {
                        drawSplitFrame(
                            ctx,
                            canvas,
                            source
                        );
                    } else {
                        drawSingleFrame(
                            ctx,
                            canvas,
                            source
                        );
                    }

                    const elapsed =
                        source.currentTime -
                        start;

                    showExportProgress(
                        (
                            elapsed /
                            exportDuration
                        ) *
                        100
                    );

                    animationFrame =
                        requestAnimationFrame(
                            draw
                        );
                }

                draw();

                source.addEventListener(
                    "ended",
                    function () {
                        if (
                            animationFrame
                        ) {
                            cancelAnimationFrame(
                                animationFrame
                            );
                        }

                        resolve();
                    },
                    {
                        once: true
                    }
                );
            }
        );

        source.pause();

        if (
            recorder.state !==
            "inactive"
        ) {
            recorder.stop();
        }

        const blob =
            await recording;

        if (audio) {
            try {
                await audio.context.close();
            } catch (error) {
                /* Ignore audio cleanup errors. */
            }
        }

        canvasStream
            .getTracks()
            .forEach(function (track) {
                track.stop();
            });

        stream
            .getTracks()
            .forEach(function (track) {
                track.stop();
            });

        showExportProgress(100);

        await new Promise(
            function (resolve) {
                setTimeout(
                    resolve,
                    300
                );
            }
        );

        hideExportProgress();

        if (!blob.size) {
            throw new Error(
                "The exported video is empty."
            );
        }

        createDownload(blob);

        return blob;
    }

    function connectExport() {
        const exportButton =
            document.getElementById(
                "exportButton"
            );

        if (!exportButton) {
            return;
        }

        exportButton.addEventListener(
            "click",
            function (event) {
                event.preventDefault();
                event.stopImmediatePropagation();

                saveCurrentClipState();

                const exportScreen =
                    document.getElementById(
                        "exportScreen"
                    );

                if (exportScreen) {
                    exportScreen.classList.add(
                        "active"
                    );
                }

                const editorScreen =
                    document.getElementById(
                        "editorScreen"
                    );

                if (editorScreen) {
                    editorScreen.classList.remove(
                        "active"
                    );
                }

                const exportPreview =
                    document.querySelector(
                        "#exportScreen video"
                    );

                if (exportPreview) {
                    exportPreview.src =
                        video.currentSrc ||
                        video.src;

                    exportPreview.load();
                }
            },
            true
        );

        const createClipButton =
            document.getElementById(
                "startExportButton"
            );

        if (createClipButton) {
            createClipButton.addEventListener(
                "click",
                async function (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    try {
                        await exportVideo();
                    } catch (error) {
                        hideExportProgress();

                        alert(
                            error &&
                            error.message
                                ? error.message
                                : "Video export failed."
                        );
                    }
                },
                true
            );
        }
    }

    function connectReset() {
        const resetButton =
            document.querySelector(
                ".reset-button"
            );

        if (!resetButton) {
            return;
        }

        resetButton.addEventListener(
            "click",
            function () {
                state.crop.x = 0;
                state.crop.y = 0;
                state.crop.zoom = 100;

                const clip =
                    getActiveClip();

                if (clip) {
                    clip.crop = {
                        x: 0,
                        y: 0,
                        zoom: 100
                    };
                }

                updateControls();
                updateCropPreview();
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
            document.createElement(
                "style"
            );

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

            #enhancedLayoutPanel
                .small-button {
                transition:
                    border-color .15s,
                    background .15s;
            }

            #enhancedSplitPreview {
                pointer-events:none;
            }

            #enhancedExportProgress {
                backdrop-filter:blur(8px);
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function initialize() {
        injectStyles();

        createClipControls();
        createLayoutControls();

        connectCropDrag();
        connectZoom();
        connectVideoEvents();
        connectExistingTrimControls();
        connectReset();
        connectExport();

        if (getDuration() > 0) {
            initializeClips();
            renderClipList();
        }
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

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
                        JSON.stringify(
                            clip
                        )
                    );
                }
            );
        },

        exportVideo
    };
})();
