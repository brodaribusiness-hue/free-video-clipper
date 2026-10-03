(function () {
    "use strict";

    /*
     * Free Video Clipper
     *
     * Features:
     * - Multiple clips
     * - Single video layout
     * - 9:16 reframe
     * - Speaker 1 + 2 split layout
     * - Speaker frames are movable
     * - Speaker frames are resizable
     * - Speaker 1 / Speaker 2 independent crop areas
     * - Top / Bottom split export
     * - Left / Right split export
     * - Canvas + MediaRecorder export
     * - Original / High quality
     * - Original / No audio
     */

    const state = {
        clips: [],
        activeClipId: null,
        nextClipId: 1,

        layout: "single",

        splitExportLayout: "vertical",

        crop: {
            x: 0.5,
            y: 0.5,
            zoom: 100
        },

        speaker1: {
            x: 0.05,
            y: 0.05,
            width: 0.90,
            height: 0.40
        },

        speaker2: {
            x: 0.05,
            y: 0.55,
            width: 0.90,
            height: 0.40
        },

        pointerAction: null,
        pointerSpeaker: null,
        pointerStartX: 0,
        pointerStartY: 0,
        pointerOrigin: null
    };

    const video = document.getElementById("videoPreview");
    const container = document.getElementById("videoContainer");
    const cropOverlay = document.getElementById("cropOverlay");
    const zoomRange = document.getElementById("zoomRange");
    const zoomValue = document.getElementById("zoomValue");

    if (!video || !container || !cropOverlay) {
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
        return (
            state.clips.find(function (clip) {
                return clip.id === state.activeClipId;
            }) || null
        );
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
                x: 0.5,
                y: 0.5,
                zoom: 100
            },

            speaker1: {
                x: 0.05,
                y: 0.05,
                width: 0.90,
                height: 0.40
            },

            speaker2: {
                x: 0.05,
                y: 0.55,
                width: 0.90,
                height: 0.40
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

    function parseTimeValue(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : 0;
        }

        const text = String(value || "").trim();

        if (!text) {
            return 0;
        }

        if (text.includes(":")) {
            const parts = text.split(":").map(Number);

            if (parts.some(function (part) {
                return !Number.isFinite(part);
            })) {
                return 0;
            }

            if (parts.length === 3) {
                return (
                    parts[0] * 3600 +
                    parts[1] * 60 +
                    parts[2]
                );
            }

            if (parts.length === 2) {
                return (
                    parts[0] * 60 +
                    parts[1]
                );
            }
        }

        const seconds = Number(text);

        return Number.isFinite(seconds)
            ? seconds
            : 0;
    }

    function saveCurrentClipState() {
        const clip = getActiveClip();

        if (!clip) {
            return;
        }

        const startInput =
            document.getElementById(
                "startTimeInput"
            );

        const endInput =
            document.getElementById(
                "endTimeInput"
            );

        const duration = getDuration();

        const uiStart = startInput
            ? parseTimeValue(startInput.value)
            : clip.start;

        const uiEnd = endInput
            ? parseTimeValue(endInput.value)
            : clip.end;

        clip.start = clamp(
            uiStart,
            0,
            duration
        );

        clip.end = clamp(
            uiEnd,
            clip.start,
            duration
        );

        clip.crop = {
            x: state.crop.x,
            y: state.crop.y,
            zoom: state.crop.zoom
        };

        clip.speaker1 = {
            x: state.speaker1.x,
            y: state.speaker1.y,
            width: state.speaker1.width,
            height: state.speaker1.height
        };

        clip.speaker2 = {
            x: state.speaker2.x,
            y: state.speaker2.y,
            width: state.speaker2.width,
            height: state.speaker2.height
        };
    }

    function loadClipState(clip) {
        if (!clip) {
            return;
        }

        state.crop = {
            x: Number(clip.crop?.x) || 0.5,
            y: Number(clip.crop?.y) || 0.5,
            zoom: Number(clip.crop?.zoom) || 100
        };

        state.speaker1 = normalizeSpeaker(
            clip.speaker1,
            1
        );

        state.speaker2 = normalizeSpeaker(
            clip.speaker2,
            2
        );

        updateControls();
        updateCropPreview();
        updateSpeakerPreview();
    }

    function normalizeSpeaker(value, speakerNumber) {
        const defaults =
            speakerNumber === 1
                ? {
                      x: 0.05,
                      y: 0.05,
                      width: 0.90,
                      height: 0.40
                  }
                : {
                      x: 0.05,
                      y: 0.55,
                      width: 0.90,
                      height: 0.40
                  };

        if (!value) {
            return { ...defaults };
        }

        const width = clamp(
            Number(value.width) || defaults.width,
            0.15,
            0.95
        );

        const height = clamp(
            Number(value.height) || defaults.height,
            0.10,
            0.90
        );

        return {
            x: clamp(
                Number(value.x) || defaults.x,
                0,
                1 - width
            ),

            y: clamp(
                Number(value.y) || defaults.y,
                0,
                1 - height
            ),

            width,
            height
        };
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

        if (start >= duration) {
            return;
        }

        const clip = createClip(start, duration);

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
            const next =
                state.clips[index] ||
                state.clips[index - 1] ||
                state.clips[0];

            state.activeClipId = next.id;

            video.currentTime = next.start;

            loadClipState(next);
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
        const list = document.getElementById(
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
                    "1fr 32px";
                row.style.gap = "5px";

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className = "small-button";

                button.textContent =
                    "Clip " +
                    (index + 1) +
                    "  " +
                    formatTime(clip.start) +
                    " – " +
                    formatTime(clip.end);

                button.style.textAlign = "left";

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
                remove.className = "small-button";
                remove.textContent = "×";

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

        const button =
            document.getElementById(
                "enhancedAddClip"
            );

        if (button) {
            button.addEventListener(
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
                id="speakerFrameInfo"
                style="
                    display:none;
                    margin-top:10px;
                    padding:8px;
                    border:1px solid var(--border);
                    border-radius:8px;
                    font-size:10px;
                    color:var(--muted);
                    line-height:1.5;
                "
            >
                Drag each speaker frame to move it.
                Drag the corner handle to resize it.
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
    }

    function setLayout(layout) {
        state.layout =
            layout === "split"
                ? "split"
                : "single";

        const info =
            document.getElementById(
                "speakerFrameInfo"
            );

        if (info) {
            info.style.display =
                state.layout === "split"
                    ? "block"
                    : "none";
        }

        document
            .querySelectorAll("[data-layout]")
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

    function getVideoRectInContainer() {
        const videoRect =
            video.getBoundingClientRect();

        const containerRect =
            container.getBoundingClientRect();

        return {
            left:
                videoRect.left -
                containerRect.left,

            top:
                videoRect.top -
                containerRect.top,

            width: videoRect.width,
            height: videoRect.height
        };
    }

    function createSpeakerFrame(
        speakerNumber
    ) {
        const frame =
            document.createElement("div");

        frame.className =
            "enhanced-speaker-frame";

        frame.dataset.speaker =
            String(speakerNumber);

        const label =
            document.createElement("div");

        label.className =
            "enhanced-speaker-label";

        label.textContent =
            "Speaker " +
            speakerNumber;

        const handle =
            document.createElement("div");

        handle.className =
            "enhanced-speaker-resize";

        frame.appendChild(label);
        frame.appendChild(handle);

        frame.addEventListener(
            "pointerdown",
            function (event) {
                if (
                    event.target === handle ||
                    handle.contains(event.target)
                ) {
                    startSpeakerResize(
                        event,
                        speakerNumber
                    );
                } else {
                    startSpeakerMove(
                        event,
                        speakerNumber
                    );
                }
            }
        );

        return frame;
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

            preview.style.zIndex = "50";

            preview.style.pointerEvents =
                "none";

            const frame1 =
                createSpeakerFrame(1);

            const frame2 =
                createSpeakerFrame(2);

            preview.appendChild(frame1);
            preview.appendChild(frame2);

            container.appendChild(preview);
        }

        const videoRect =
            getVideoRectInContainer();

        const frame1 =
            document.querySelector(
                '.enhanced-speaker-frame[data-speaker="1"]'
            );

        const frame2 =
            document.querySelector(
                '.enhanced-speaker-frame[data-speaker="2"]'
            );

        if (frame1) {
            applySpeakerFrameStyle(
                frame1,
                state.speaker1,
                videoRect
            );
        }

        if (frame2) {
            applySpeakerFrameStyle(
                frame2,
                state.speaker2,
                videoRect
            );
        }
    }

    function applySpeakerFrameStyle(
        element,
        speaker,
        videoRect
    ) {
        element.style.position =
            "absolute";

        element.style.left =
            videoRect.left +
            speaker.x *
                videoRect.width +
            "px";

        element.style.top =
            videoRect.top +
            speaker.y *
                videoRect.height +
            "px";

        element.style.width =
            speaker.width *
                videoRect.width +
            "px";

        element.style.height =
            speaker.height *
                videoRect.height +
            "px";

        element.style.boxSizing =
            "border-box";

        element.style.pointerEvents =
            "auto";
    }

    function startSpeakerMove(
        event,
        speakerNumber
    ) {
        event.preventDefault();

        const speaker =
            speakerNumber === 1
                ? state.speaker1
                : state.speaker2;

        state.pointerAction = "move";
        state.pointerSpeaker =
            speakerNumber;

        state.pointerStartX =
            event.clientX;

        state.pointerStartY =
            event.clientY;

        state.pointerOrigin = {
            x: speaker.x,
            y: speaker.y,
            width: speaker.width,
            height: speaker.height
        };

        event.currentTarget.setPointerCapture(
            event.pointerId
        );
    }

    function startSpeakerResize(
        event,
        speakerNumber
    ) {
        event.preventDefault();
        event.stopPropagation();

        const speaker =
            speakerNumber === 1
                ? state.speaker1
                : state.speaker2;

        state.pointerAction = "resize";
        state.pointerSpeaker =
            speakerNumber;

        state.pointerStartX =
            event.clientX;

        state.pointerStartY =
            event.clientY;

        state.pointerOrigin = {
            x: speaker.x,
            y: speaker.y,
            width: speaker.width,
            height: speaker.height
        };

        event.currentTarget.parentElement.setPointerCapture(
            event.pointerId
        );
    }

    function handleSpeakerPointerMove(event) {
        if (
            !state.pointerAction ||
            !state.pointerSpeaker
        ) {
            return;
        }

        const videoRect =
            getVideoRectInContainer();

        if (
            !videoRect.width ||
            !videoRect.height
        ) {
            return;
        }

        const dx =
            (event.clientX -
                state.pointerStartX) /
            videoRect.width;

        const dy =
            (event.clientY -
                state.pointerStartY) /
            videoRect.height;

        const speaker =
            state.pointerSpeaker === 1
                ? state.speaker1
                : state.speaker2;

        const origin =
            state.pointerOrigin;

        if (
            state.pointerAction ===
            "move"
        ) {
            speaker.x = clamp(
                origin.x + dx,
                0,
                1 - speaker.width
            );

            speaker.y = clamp(
                origin.y + dy,
                0,
                1 - speaker.height
            );
        }

        if (
            state.pointerAction ===
            "resize"
        ) {
            const sourceAspect =
                getSourceAspect();

            let newWidth =
                origin.width + dx;

            newWidth = clamp(
                newWidth,
                0.15,
                0.95
            );

            let newHeight =
                newWidth /
                sourceAspect;

            if (newHeight > 0.90) {
                newHeight = 0.90;
                newWidth =
                    newHeight *
                    sourceAspect;
            }

            if (
                origin.x +
                    newWidth >
                1
            ) {
                newWidth =
                    1 - origin.x;

                newHeight =
                    newWidth /
                    sourceAspect;
            }

            if (
                origin.y +
                    newHeight >
                1
            ) {
                newHeight =
                    1 - origin.y;

                newWidth =
                    newHeight *
                    sourceAspect;
            }

            speaker.width =
                clamp(
                    newWidth,
                    0.15,
                    0.95
                );

            speaker.height =
                clamp(
                    newHeight,
                    0.10,
                    0.90
                );
        }

        saveCurrentClipState();
        updateSpeakerPreview();
    }

    function stopSpeakerPointer() {
        state.pointerAction = null;
        state.pointerSpeaker = null;
        state.pointerOrigin = null;
    }

    document.addEventListener(
        "pointermove",
        handleSpeakerPointerMove
    );

    document.addEventListener(
        "pointerup",
        stopSpeakerPointer
    );

    document.addEventListener(
        "pointercancel",
        stopSpeakerPointer
    );

    function getSourceAspect() {
        if (
            video.videoWidth &&
            video.videoHeight
        ) {
            return (
                video.videoWidth /
                video.videoHeight
            );
        }

        return 16 / 9;
    }

    function updateControls() {
    if (zoomRange) {
        zoomRange.value =
            String(
                state.crop.zoom
            );
    }

    if (zoomValue) {
        zoomValue.textContent =
            Math.round(
                state.crop.zoom
            ) + "%";
    }

    const clip = getActiveClip();

    if (clip) {
        const startInput =
            document.getElementById(
                "startTimeInput"
            );

        const endInput =
            document.getElementById(
                "endTimeInput"
            );

        if (startInput) {
            startInput.value =
                formatTime(
                    clip.start
                );
        }

        if (endInput) {
            endInput.value =
                formatTime(
                    clip.end
                );
        }
    }
}

    function updateCropPreview() {
        const zoom =
            state.crop.zoom / 100;

        const offsetX =
            (state.crop.x - 0.5) *
            100;

        const offsetY =
            (state.crop.y - 0.5) *
            100;

        video.style.transform =
            "scale(" +
            zoom +
            ") translate(" +
            (-offsetX / zoom) +
            "%," +
            (-offsetY / zoom) +
            "%)";
    }

    function connectZoom() {
        if (!zoomRange) {
            return;
        }

        zoomRange.addEventListener(
            "input",
            function () {
                state.crop.zoom =
                    Number(
                        zoomRange.value
                    );

                if (zoomValue) {
                    zoomValue.textContent =
                        state.crop.zoom +
                        "%";
                }

                saveCurrentClipState();
                updateCropPreview();
            }
        );
    }

    function connectCropDrag() {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let originX = 0;
        let originY = 0;

        cropOverlay.addEventListener(
            "pointerdown",
            function (event) {
                if (
                    state.layout ===
                    "split"
                ) {
                    return;
                }

                dragging = true;

                startX =
                    event.clientX;

                startY =
                    event.clientY;

                originX =
                    state.crop.x;

                originY =
                    state.crop.y;

                cropOverlay.setPointerCapture(
                    event.pointerId
                );

                event.preventDefault();
            }
        );

        cropOverlay.addEventListener(
            "pointermove",
            function (event) {
                if (!dragging) {
                    return;
                }

                const rect =
                    video.getBoundingClientRect();

                if (
                    !rect.width ||
                    !rect.height
                ) {
                    return;
                }

                const dx =
                    (event.clientX -
                        startX) /
                    rect.width;

                const dy =
                    (event.clientY -
                        startY) /
                    rect.height;

                state.crop.x =
                    clamp(
                        originX - dx,
                        0,
                        1
                    );

                state.crop.y =
                    clamp(
                        originY - dy,
                        0,
                        1
                    );

                saveCurrentClipState();
                updateCropPreview();
            }
        );

        cropOverlay.addEventListener(
            "pointerup",
            function () {
                dragging = false;
            }
        );

        cropOverlay.addEventListener(
            "pointercancel",
            function () {
                dragging = false;
            }
        );
    }

    function connectVideoEvents() {
        video.addEventListener(
            "loadedmetadata",
            function () {
                initializeClips();
                renderClipList();
                updateSpeakerPreview();
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
                        clip.end &&
                    !video.paused
                ) {
                    video.currentTime =
                        clip.start;
                }
            }
        );

        window.addEventListener(
            "resize",
            updateSpeakerPreview
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

        if (startInput) {
            startInput.addEventListener(
                "change",
                function () {
                    const clip =
                        getActiveClip();

                    if (!clip) {
                        return;
                    }

                    const value =
                        parseTimeValue(
                            startInput.value
                        );

                    clip.start = clamp(
                        value,
                        0,
                        clip.end
                    );

                    startInput.value =
                        formatTime(
                            clip.start
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

                    const value =
                        parseTimeValue(
                            endInput.value
                        );

                    clip.end = clamp(
                        value,
                        clip.start,
                        getDuration()
                    );

                    endInput.value =
                        formatTime(
                            clip.end
                        );

                    renderClipList();
                }
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
                state.crop = {
                    x: 0.5,
                    y: 0.5,
                    zoom: 100
                };

                const clip =
                    getActiveClip();

                if (clip) {
                    clip.crop = {
                        x: 0.5,
                        y: 0.5,
                        zoom: 100
                    };
                }

                updateControls();
                updateCropPreview();
            }
        );
    }

    function createExportLayoutControls() {
        const exportScreen =
            document.getElementById(
                "exportScreen"
            );

        if (!exportScreen) {
            return;
        }

        if (
            document.getElementById(
                "enhancedExportLayout"
            )
        ) {
            return;
        }

        const wrapper =
            document.createElement("div");

        wrapper.id =
            "enhancedExportLayout";

        wrapper.style.marginTop =
            "14px";

        wrapper.style.padding =
            "12px";

        wrapper.style.border =
            "1px solid var(--border)";

        wrapper.style.borderRadius =
            "10px";

        wrapper.innerHTML = `
            <div
                style="
                    font-size:11px;
                    font-weight:700;
                    margin-bottom:8px;
                "
            >
                Split Export Layout
            </div>

            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:8px;
                "
            >
                <button
                    type="button"
                    class="small-button"
                    data-export-layout="vertical"
                >
                    Top / Bottom
                </button>

                <button
                    type="button"
                    class="small-button"
                    data-export-layout="horizontal"
                >
                    Left / Right
                </button>
            </div>

            <div
                id="enhancedExportLayoutHelp"
                style="
                    margin-top:7px;
                    font-size:9px;
                    color:var(--muted);
                "
            >
                Speaker 1 top, Speaker 2 bottom
            </div>
        `;

        const options =
            exportScreen.querySelector(
                ".export-options"
            );

        if (options) {
            options.appendChild(
                wrapper
            );
        } else {
            exportScreen.appendChild(
                wrapper
            );
        }

        wrapper
            .querySelectorAll(
                "[data-export-layout]"
            )
            .forEach(function (button) {
                button.addEventListener(
                    "click",
                    function () {
                        state.splitExportLayout =
                            button.dataset.exportLayout;

                        updateExportLayoutButtons();
                    }
                );
            });

        updateExportLayoutButtons();
    }

    function updateExportLayoutButtons() {
        document
            .querySelectorAll(
                "[data-export-layout]"
            )
            .forEach(function (button) {
                const active =
                    button.dataset.exportLayout ===
                    state.splitExportLayout;

                button.style.borderColor =
                    active
                        ? "var(--accent)"
                        : "";

                button.style.background =
                    active
                        ? "#241914"
                        : "";
            });

        const help =
            document.getElementById(
                "enhancedExportLayoutHelp"
            );

        if (help) {
            help.textContent =
                state.splitExportLayout ===
                "horizontal"
                    ? "Speaker 1 left, Speaker 2 right"
                    : "Speaker 1 top, Speaker 2 bottom";
        }
    }

    function getExportQuality() {
        const checked =
            document.querySelector(
                'input[name="quality"]:checked'
            );

        if (!checked) {
            return "original";
        }

        const value =
            String(
                checked.value || ""
            ).toLowerCase();

        return value.includes("high")
            ? "high"
            : "original";
    }

    function getExportAudio() {
        const checked =
            document.querySelector(
                'input[name="audio"]:checked'
            );

        if (!checked) {
            return "original";
        }

        const value =
            String(
                checked.value || ""
            ).toLowerCase();

        return value.includes("no")
            ? "none"
            : "original";
    }

    function getMimeType() {
        const types = [
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
                MediaRecorder.isTypeSupported(
                    types[i]
                )
            ) {
                return types[i];
            }
        }

        return "";
    }

    function createExportVideo() {
        const source =
            document.createElement("video");

        source.muted = false;
        source.defaultMuted = false;
        source.volume = 1;

        source.playsInline = true;
        source.preload = "auto";
        source.crossOrigin = "anonymous";

        source.src =
            video.currentSrc ||
            video.src;

        source.style.position =
            "fixed";

        source.style.left =
            "-10000px";

        source.style.top =
            "-10000px";

        source.style.width =
            "1px";

        source.style.height =
            "1px";

        document.body.appendChild(
            source
        );

        return source;
    }

    function waitForVideoReady(source) {
        return new Promise(
            function (resolve, reject) {
                if (
                    source.readyState >= 2 &&
                    source.duration
                ) {
                    resolve();
                    return;
                }

                const timeout =
                    setTimeout(
                        function () {
                            reject(
                                new Error(
                                    "Video could not be prepared for export."
                                )
                            );
                        },
                        15000
                    );

                source.addEventListener(
                    "loadedmetadata",
                    function () {
                        clearTimeout(
                            timeout
                        );

                        resolve();
                    },
                    {
                        once: true
                    }
                );

                source.addEventListener(
                    "error",
                    function () {
                        clearTimeout(
                            timeout
                        );

                        reject(
                            new Error(
                                "Video could not be loaded for export."
                            )
                        );
                    },
                    {
                        once: true
                    }
                );

                source.load();
            }
        );
    }

    function getSingleCropRect(source) {
        const zoom =
            Math.max(
                1,
                state.crop.zoom / 100
            );

        const cropWidth =
            source.videoWidth /
            zoom;

        const cropHeight =
            source.videoHeight /
            zoom;

        let sx =
            state.crop.x *
                source.videoWidth -
            cropWidth / 2;

        let sy =
            state.crop.y *
                source.videoHeight -
            cropHeight / 2;

        sx = clamp(
            sx,
            0,
            source.videoWidth -
                cropWidth
        );

        sy = clamp(
            sy,
            0,
            source.videoHeight -
                cropHeight
        );

        return {
            x: sx,
            y: sy,
            width: cropWidth,
            height: cropHeight
        };
    }

    function getSplitCropRect(
        source,
        speaker
    ) {
        return {
            x:
                speaker.x *
                source.videoWidth,

            y:
                speaker.y *
                source.videoHeight,

            width:
                speaker.width *
                source.videoWidth,

            height:
                speaker.height *
                source.videoHeight
        };
    }

    function getSingleOutputSize() {
        const sourceWidth =
            video.videoWidth || 1280;

        const sourceHeight =
            video.videoHeight || 720;

        const zoom =
            Math.max(
                1,
                state.crop.zoom / 100
            );

        return {
            width: Math.max(
                2,
                Math.round(
                    sourceWidth / zoom
                )
            ),

            height: Math.max(
                2,
                Math.round(
                    sourceHeight / zoom
                )
            )
        };
    }

    function getSplitOutputSize(
        source
    ) {
        const crop1 =
            getSplitCropRect(
                source,
                state.speaker1
            );

        const crop2 =
            getSplitCropRect(
                source,
                state.speaker2
            );

        const aspect1 =
            crop1.width /
            crop1.height;

        const aspect2 =
            crop2.width /
            crop2.height;

        const aspect =
            Math.max(
                0.1,
                (aspect1 + aspect2) / 2
            );

        if (
            state.splitExportLayout ===
            "horizontal"
        ) {
            const halfHeight =
                Math.max(
                    240,
                    Math.min(
                        1080,
                        Math.round(
                            Math.max(
                                crop1.height,
                                crop2.height
                            )
                        )
                    )
                );

            const halfWidth =
                Math.round(
                    halfHeight *
                    aspect
                );

            return {
                width:
                    halfWidth * 2,

                height:
                    halfHeight
            };
        }

        const halfWidth =
            Math.max(
                240,
                Math.min(
                    1920,
                    Math.round(
                        Math.max(
                            crop1.width,
                            crop2.width
                        )
                    )
                )
            );

        const halfHeight =
            Math.round(
                halfWidth / aspect
            );

        return {
            width:
                halfWidth,

            height:
                halfHeight * 2
        };
    }

    function drawSingleFrame(
        ctx,
        canvas,
        source
    ) {
        const crop =
            getSingleCropRect(
                source
            );

        ctx.fillStyle =
            "#000000";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.drawImage(
            source,

            crop.x,
            crop.y,
            crop.width,
            crop.height,

            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    function drawSplitFrame(
        ctx,
        canvas,
        source
    ) {
        const crop1 =
            getSplitCropRect(
                source,
                state.speaker1
            );

        const crop2 =
            getSplitCropRect(
                source,
                state.speaker2
            );

        ctx.fillStyle =
            "#000000";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        if (
            state.splitExportLayout ===
            "horizontal"
        ) {
            const halfWidth =
                canvas.width / 2;

            ctx.drawImage(
                source,

                crop1.x,
                crop1.y,
                crop1.width,
                crop1.height,

                0,
                0,
                halfWidth,
                canvas.height
            );

            ctx.drawImage(
                source,

                crop2.x,
                crop2.y,
                crop2.width,
                crop2.height,

                halfWidth,
                0,
                halfWidth,
                canvas.height
            );

            return;
        }

        const halfHeight =
            canvas.height / 2;

        ctx.drawImage(
            source,

            crop1.x,
            crop1.y,
            crop1.width,
            crop1.height,

            0,
            0,
            canvas.width,
            halfHeight
        );

        ctx.drawImage(
            source,

            crop2.x,
            crop2.y,
            crop2.width,
            crop2.height,

            0,
            halfHeight,
            canvas.width,
            halfHeight
        );
    }

    async function createAudioStream(source) {
        if (
            getExportAudio() ===
            "none"
        ) {
            return null;
        }

        try {
            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContext) {
                return null;
            }

            const context =
                new AudioContext();

            if (
                context.state ===
                "suspended"
            ) {
                await context.resume();
            }

            const sourceNode =
                context.createMediaElementSource(
                    source
                );

            const destination =
                context.createMediaStreamDestination();

            sourceNode.connect(
                destination
            );

            return {
                context,
                stream:
                    destination.stream
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

            progress.style.left =
                "50%";

            progress.style.top =
                "50%";

            progress.style.transform =
                "translate(-50%, -50%)";

            progress.style.zIndex =
                "99999";

            progress.style.width =
                "min(420px, 90vw)";

            progress.style.padding =
                "24px";

            progress.style.border =
                "1px solid var(--border)";

            progress.style.borderRadius =
                "12px";

            progress.style.background =
                "var(--panel)";

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

        const safe =
            clamp(
                percent,
                0,
                100
            );

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
                safe + "%";
        }

        if (text) {
            text.textContent =
                Math.round(safe) +
                "%";
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

    function createDownload(blob) {
        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href = url;

        link.download =
            "free-video-clip-" +
            Date.now() +
            ".webm";

        link.style.display =
            "none";

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        setTimeout(
            function () {
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

        try {
            await waitForVideoReady(
                source
            );

            const size =
                state.layout ===
                "split"
                    ? getSplitOutputSize(
                          source
                      )
                    : getSingleOutputSize();

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width =
                Math.max(
                    2,
                    size.width
                );

            canvas.height =
                Math.max(
                    2,
                    size.height
                );

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
                await createAudioStream(
                    source
                );

            const stream =
                combineStreams(
                    canvasStream,
                    audio
                        ? audio.stream
                        : null
                );

            const videoBitrate =
                getExportQuality() ===
                "high"
                    ? 10_000_000
                    : 6_000_000;

            const recorder =
                new MediaRecorder(
                    stream,
                    {
                        mimeType,
                        videoBitsPerSecond:
                            videoBitrate
                    }
                );

            const chunks = [];

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
                    parseTimeValue(
                        clip.start
                    ),
                    0,
                    source.duration
                );

            const end =
                clamp(
                    parseTimeValue(
                        clip.end
                    ),
                    start,
                    source.duration
                );

            source.currentTime =
                start;

            await new Promise(
                function (resolve) {
                    const done =
                        function () {
                            resolve();
                        };

                    source.addEventListener(
                        "seeked",
                        done,
                        {
                            once: true
                        }
                    );

                    setTimeout(
                        resolve,
                        1000
                    );
                }
            );

            showExportProgress(
                0
            );

            recorder.start(250);

            await source.play();

            const exportDuration =
                Math.max(
                    0.1,
                    end - start
                );

            await new Promise(
                function (resolve) {
                    let frameId = null;

                    function draw() {
                        if (
                            source.currentTime >=
                                end ||
                            source.ended
                        ) {
                            if (
                                frameId
                            ) {
                                cancelAnimationFrame(
                                    frameId
                                );
                            }

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

                        frameId =
                            requestAnimationFrame(
                                draw
                            );
                    }

                    draw();

                    source.addEventListener(
                        "ended",
                        function () {
                            if (
                                frameId
                            ) {
                                cancelAnimationFrame(
                                    frameId
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
                    // Ignore cleanup errors.
                }
            }

            canvasStream
                .getTracks()
                .forEach(
                    function (track) {
                        track.stop();
                    }
                );

            stream
                .getTracks()
                .forEach(
                    function (track) {
                        track.stop();
                    }
                );

            if (!blob.size) {
                throw new Error(
                    "The exported video is empty."
                );
            }

            showExportProgress(
                100
            );

            await new Promise(
                function (resolve) {
                    setTimeout(
                        resolve,
                        300
                    );
                }
            );

            hideExportProgress();

            createDownload(
                blob
            );

            return blob;
        } finally {
            source.pause();
            source.removeAttribute(
                "src"
            );
            source.load();

            if (source.parentNode) {
                source.parentNode.removeChild(
                    source
                );
            }
        }
    }

    function connectExport() {
        const exportButton =
            document.getElementById(
                "exportButton"
            );

        if (exportButton) {
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

                    const editorScreen =
                        document.getElementById(
                            "editorScreen"
                        );

                    if (exportScreen) {
                        exportScreen.classList.add(
                            "active"
                        );
                    }

                    if (editorScreen) {
                        editorScreen.classList.remove(
                            "active"
                        );
                    }

                    createExportLayoutControls();
                    updateExportLayoutButtons();

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
        }

        const createButton =
            document.getElementById(
                "startExportButton"
            );

        if (createButton) {
            createButton.addEventListener(
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
                will-change: transform;
            }

            #enhancedSplitPreview {
                pointer-events: none;
                overflow: hidden;
            }

            .enhanced-speaker-frame {
                pointer-events: auto;
                border: 2px solid var(--accent);
                background: rgba(255, 107, 44, 0.08);
                box-shadow:
                    0 0 0 1px rgba(0,0,0,.35),
                    0 8px 25px rgba(0,0,0,.25);
                cursor: move;
                touch-action: none;
                user-select: none;
                min-width: 70px;
                min-height: 50px;
            }

            .enhanced-speaker-frame:hover {
                background: rgba(255, 107, 44, 0.14);
            }

            .enhanced-speaker-label {
                position: absolute;
                left: 6px;
                top: 6px;
                padding: 3px 6px;
                border-radius: 4px;
                background: rgba(0,0,0,.72);
                color: #fff;
                font-size: 10px;
                font-weight: 700;
                pointer-events: none;
            }

            .enhanced-speaker-resize {
                position: absolute;
                right: -5px;
                bottom: -5px;
                width: 14px;
                height: 14px;
                border-radius: 3px;
                background: var(--accent);
                border: 2px solid #fff;
                cursor: nwse-resize;
                touch-action: none;
            }

            #enhancedExportProgress {
                backdrop-filter: blur(8px);
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
        exportVideo,

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
        }
    };
})();
