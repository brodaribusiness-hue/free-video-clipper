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

        /*
         * Keep the original timeline controls in index.html
         * synchronized with the currently selected clip.
         *
         * The main timeline uses its own trimStart / trimEnd
         * variables. Dispatching the existing change events
         * updates those variables without changing the original
         * timeline implementation.
         */
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
                formatTime(clip.start);

            startInput.dispatchEvent(
                new Event("change", {
                    bubbles: true
                })
            );
        }

        if (endInput) {
            endInput.value =
                formatTime(clip.end);

            endInput.dispatchEvent(
                new Event("change", {
                    bubbles: true
                })
            );
        }

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

        const previousDuration = active
            ? Math.max(
                  0.1,
                  active.end - active.start
              )
            : 10;

        const end = Math.min(
            duration,
            start + previousDuration
        );

        if (end <= start) {
            return;
        }

        const clip = createClip(
            start,
            end
        );

        state.clips.push(clip);
        state.activeClipId = clip.id;

        loadClipState(clip);
        renderClipList();
    }

    async function exportAllClips() {
        saveCurrentClipState();

        if (!state.clips.length) {
            throw new Error(
                "No clips are available."
            );
        }

        const originalActiveClipId =
            state.activeClipId;

        const clips = state.clips.map(
            function (clip) {
                return {
                    id: clip.id,
                    start: clip.start,
                    end: clip.end
                };
            }
        );

        try {
            for (
                let index = 0;
                index < clips.length;
                index++
            ) {
                const clip = clips[index];

                selectClip(clip.id);

                await new Promise(
                    function (resolve) {
                        setTimeout(
                            resolve,
                            100
                        );
                    }
                );

                await exportVideo();

                await new Promise(
                    function (resolve) {
                        setTimeout(
                            resolve,
                            250
                        );
                    }
                );
            }
        } finally {
            if (originalActiveClipId !== null) {
                selectClip(
                    originalActiveClipId
                );
            }

            hideExportProgress();
        }
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
            document.querySelector(
                ".side-panel"
            );

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
            const halfHeight =
            sourceHeight / 2;

        const halfWidth =
            sourceWidth;

        return {
            width:
                halfWidth,

            height:
                halfHeight * 2
        };
    }

    function drawSpeakerLayout(
        ctx,
        source,
        width,
        height
    ) {
        const layout =
            state.layout;

        if (
            layout !== "top-bottom" &&
            layout !== "left-right"
        ) {
            return false;
        }

        const speaker1 =
            normalizeSpeaker(
                state.speaker1,
                1
            );

        const speaker2 =
            normalizeSpeaker(
                state.speaker2,
                2
            );

        const sourceWidth =
            source.videoWidth;

        const sourceHeight =
            source.videoHeight;

        if (
            !sourceWidth ||
            !sourceHeight
        ) {
            return false;
        }

        ctx.clearRect(
            0,
            0,
            width,
            height
        );

        if (
            layout === "top-bottom"
        ) {
            const halfHeight =
                height / 2;

            drawSpeakerFrame(
                ctx,
                source,
                speaker1,
                0,
                0,
                width,
                halfHeight
            );

            drawSpeakerFrame(
                ctx,
                source,
                speaker2,
                0,
                halfHeight,
                width,
                halfHeight
            );

            return true;
        }

        const halfWidth =
            width / 2;

        drawSpeakerFrame(
            ctx,
            source,
            speaker1,
            0,
            0,
            halfWidth,
            height
        );

        drawSpeakerFrame(
            ctx,
            source,
            speaker2,
            halfWidth,
            0,
            halfWidth,
            height
        );

        return true;
    }

    function drawSpeakerFrame(
        ctx,
        source,
        speaker,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight
    ) {
        const sourceWidth =
            source.videoWidth;

        const sourceHeight =
            source.videoHeight;

        if (
            !sourceWidth ||
            !sourceHeight
        ) {
            return;
        }

        const frameWidth =
            Math.max(
                0.05,
                Math.min(
                    1,
                    Number(speaker.width) ||
                        0.5
                )
            );

        const frameHeight =
            Math.max(
                0.05,
                Math.min(
                    1,
                    Number(speaker.height) ||
                        0.5
                )
            );

        const centerX =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(speaker.x) ||
                        0.5
                )
            );

        const centerY =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(speaker.y) ||
                        0.5
                )
            );

        const cropWidth =
            sourceWidth *
            frameWidth;

        const cropHeight =
            sourceHeight *
            frameHeight;

        const cropX =
            sourceWidth *
                centerX -
            cropWidth / 2;

        const cropY =
            sourceHeight *
                centerY -
            cropHeight / 2;

        const safeCropX =
            Math.max(
                0,
                Math.min(
                    sourceWidth -
                        cropWidth,
                    cropX
                )
            );

        const safeCropY =
            Math.max(
                0,
                Math.min(
                    sourceHeight -
                        cropHeight,
                    cropY
                )
            );

        drawCoverCrop(
            ctx,
            source,
            safeCropX,
            safeCropY,
            cropWidth,
            cropHeight,
            destinationX,
            destinationY,
            destinationWidth,
            destinationHeight
        );
    }

    function drawCoverCrop(
        ctx,
        source,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destinationX,
        destinationY,
        destinationWidth,
        destinationHeight
    ) {
        if (
            sourceWidth <= 0 ||
            sourceHeight <= 0 ||
            destinationWidth <= 0 ||
            destinationHeight <= 0
        ) {
            return;
        }

        const sourceRatio =
            sourceWidth /
            sourceHeight;

        const destinationRatio =
            destinationWidth /
            destinationHeight;

        let drawWidth =
            destinationWidth;

        let drawHeight =
            destinationHeight;

        let drawX =
            destinationX;

        let drawY =
            destinationY;

        if (
            sourceRatio >
            destinationRatio
        ) {
            drawHeight =
                destinationHeight;

            drawWidth =
                destinationHeight *
                sourceRatio;

            drawX =
                destinationX +
                (
                    destinationWidth -
                    drawWidth
                ) /
                    2;
        } else {
            drawWidth =
                destinationWidth;

            drawHeight =
                destinationWidth /
                sourceRatio;

            drawY =
                destinationY +
                (
                    destinationHeight -
                    drawHeight
                ) /
                    2;
        }

        ctx.drawImage(
            source,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );
    }

    function createExportCanvas(
        source
    ) {
        const crop =
            state.crop;

        const sourceWidth =
            source.videoWidth;

        const sourceHeight =
            source.videoHeight;

        if (
            !sourceWidth ||
            !sourceHeight
        ) {
            throw new Error(
                "Video dimensions are not available."
            );
        }

        const zoom =
            Math.max(
                100,
                Number(crop.zoom) ||
                    100
            ) / 100;

        const cropWidth =
            sourceWidth /
            zoom;

        const cropHeight =
            sourceHeight /
            zoom;

        const centerX =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(crop.x) ||
                        0.5
                )
            );

        const centerY =
            Math.max(
                0,
                Math.min(
                    1,
                    Number(crop.y) ||
                        0.5
                )
            );

        const cropX =
            Math.max(
                0,
                Math.min(
                    sourceWidth -
                        cropWidth,
                    sourceWidth *
                        centerX -
                        cropWidth / 2
                )
            );

        const cropY =
            Math.max(
                0,
                Math.min(
                    sourceHeight -
                        cropHeight,
                    sourceHeight *
                        centerY -
                        cropHeight / 2
                )
            );

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            Math.max(
                1,
                Math.round(
                    cropWidth
                )
            );

        canvas.height =
            Math.max(
                1,
                Math.round(
                    cropHeight
                )
            );

        return {
            canvas,
            cropX,
            cropY,
            cropWidth,
            cropHeight
        };
    }

    function drawExportFrame(
        ctx,
        source,
        canvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight
    ) {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        if (
            state.layout ===
                "top-bottom" ||
            state.layout ===
                "left-right"
        ) {
            drawSpeakerLayout(
                ctx,
                source,
                canvas.width,
                canvas.height
            );

            return;
        }

        drawCoverCrop(
            ctx,
            source,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    function getSelectedQuality() {
        const input =
            document.querySelector(
                'input[name="quality"]:checked'
            );

        if (!input) {
            return "original";
        }

        return (
            input.value ||
            "original"
        );
    }

    function getSelectedAudioMode() {
        const input =
            document.querySelector(
                'input[name="audio"]:checked'
            );

        if (!input) {
            return "original";
        }

        return (
            input.value ||
            "original"
        );
    }

    function getMimeType() {
        const types = [
            "video/webm;codecs=vp9,opus",
            "video/webm;codecs=vp8,opus",
            "video/webm"
        ];

        for (
            let index = 0;
            index < types.length;
            index++
        ) {
            if (
                MediaRecorder.isTypeSupported(
                    types[index]
                )
            ) {
                return types[index];
            }
        }

        throw new Error(
            "This browser does not support video recording."
        );
    }

    function getVideoBitrate() {
        const quality =
            getSelectedQuality();

        if (
            quality === "high"
        ) {
            return 10000000;
        }

        return 6000000;
    }

    function getExportDimensions(
        source
    ) {
        const sourceWidth =
            source.videoWidth;

        const sourceHeight =
            source.videoHeight;

        if (
            state.layout ===
            "top-bottom"
        ) {
            return {
                width:
                    sourceWidth,
                height:
                    sourceHeight
            };
        }

        if (
            state.layout ===
            "left-right"
        ) {
            return {
                width:
                    sourceWidth,
                height:
                    sourceHeight
            };
        }

        const zoom =
            Math.max(
                100,
                Number(
                    state.crop.zoom
                ) || 100
            ) / 100;

        return {
            width:
                Math.max(
                    1,
                    Math.round(
                        sourceWidth /
                            zoom
                    )
                ),
            height:
                Math.max(
                    1,
                    Math.round(
                        sourceHeight /
                            zoom
                    )
                )
        };
    }

    function updateExportProgress(
        value,
        label
    ) {
        const progress =
            document.getElementById(
                "exportProgress"
            );

        const progressBar =
            document.getElementById(
                "exportProgressBar"
            );

        const progressText =
            document.getElementById(
                "exportProgressText"
            );

        if (progress) {
            progress.classList.add(
                "active"
            );
        }

        if (progressBar) {
            progressBar.style.width =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(value) ||
                            0
                    )
                ) + "%";
        }

        if (progressText) {
            progressText.textContent =
                label ||
                "Exporting...";
        }
    }

    function hideExportProgress() {
        const progress =
            document.getElementById(
                "exportProgress"
            );

        if (progress) {
            progress.classList.remove(
                "active"
            );
        }
    }

    async function waitForVideoMetadata(
        media
    ) {
        if (
            media.readyState >= 1 &&
            media.videoWidth &&
            media.videoHeight
        ) {
            return;
        }

        await new Promise(
            function (
                resolve,
                reject
            ) {
                let settled =
                    false;

                function cleanup() {
                    media.removeEventListener(
                        "loadedmetadata",
                        onLoaded
                    );

                    media.removeEventListener(
                        "error",
                        onError
                    );
                }

                function onLoaded() {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();
                    resolve();
                }

                function onError() {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();

                    reject(
                        new Error(
                            "Unable to load video metadata."
                        )
                    );
                }

                media.addEventListener(
                    "loadedmetadata",
                    onLoaded
                );

                media.addEventListener(
                    "error",
                    onError
                );
            }
        );
    }

    async function waitForVideoTime(
        media,
        time
    ) {
        const target =
            Math.max(
                0,
                Math.min(
                    media.duration || time,
                    time
                )
            );

        if (
            Math.abs(
                media.currentTime -
                    target
            ) < 0.01
        ) {
            return;
        }

        await new Promise(
            function (
                resolve,
                reject
            ) {
                let settled =
                    false;

                function cleanup() {
                    media.removeEventListener(
                        "seeked",
                        onSeeked
                    );

                    media.removeEventListener(
                        "error",
                        onError
                    );
                }

                function onSeeked() {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();
                    resolve();
                }

                function onError() {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    cleanup();

                    reject(
                        new Error(
                            "Unable to seek video."
                        )
                    );
                }

                media.addEventListener(
                    "seeked",
                    onSeeked
                );

                media.addEventListener(
                    "error",
                    onError
                );

                try {
                    media.currentTime =
                        target;
                } catch (error) {
                    onError();
                }
            }
        );
    }

    function createSourceVideo(
        src
    ) {
        const source =
            document.createElement(
                "video"
            );

        source.muted = true;
        source.playsInline = true;
        source.preload =
            "auto";

        source.src = src;

        document.body.appendChild(
            source
        );

        return source;
    }

    function downloadBlob(
        blob,
        filename
    ) {
        if (!blob) {
            throw new Error(
                "Export produced no file."
            );
        }

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
            filename;

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
            1000
        );
    }

    function getClipFilename(
        clip,
        index
    ) {
        const number =
            String(
                index + 1
            ).padStart(
                2,
                "0"
            );

        return (
            "clip-" +
            number +
            ".webm"
        );
    }

    async function exportVideo() {
        saveCurrentClipState();

        const clip =
            getActiveClip();

        if (!clip) {
            throw new Error(
                "No clip is selected."
            );
        }

        const sourceUrl =
            video.currentSrc ||
            video.src;

        if (!sourceUrl) {
            throw new Error(
                "No source video is loaded."
            );
        }

        const start =
            Math.max(
                0,
                Number(clip.start) ||
                    0
            );

        const end =
            Math.max(
                start,
                Number(clip.end) ||
                    0
            );

        if (
            end <= start
        ) {
            throw new Error(
                "Clip duration must be greater than zero."
            );
        }

        updateExportProgress(
            0,
            "Preparing export..."
        );

        const source =
            createSourceVideo(
                sourceUrl
            );

        try {
            await waitForVideoMetadata(
                source
            );

            const dimensions =
                getExportDimensions(
                    source
                );

            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width =
                dimensions.width;

            canvas.height =
                dimensions.height;

            const ctx =
                canvas.getContext(
                    "2d"
                );

            if (!ctx) {
                throw new Error(
                    "Unable to create export canvas."
                );
            }

            const stream =
                canvas.captureStream(
                    30
                );

            const audioMode =
                getSelectedAudioMode();

            let combinedStream =
                stream;

            if (
                audioMode !==
                "none"
            ) {
                try {
                    const audioContext =
                        new (
                            window.AudioContext ||
                            window.webkitAudioContext
                        )();

                    const destination =
                        audioContext.createMediaStreamDestination();

                    const audioSource =
                        audioContext.createMediaElementSource(
                            source
                        );

                    audioSource.connect(
                        destination
                    );

                    audioSource.connect(
                        audioContext.destination
                    );

                    const audioTracks =
                        destination
                            .stream
                            .getAudioTracks();

                    combinedStream =
                        new MediaStream(
                            [
                                ...stream.getVideoTracks(),
                                ...audioTracks
                            ]
                        );
                } catch (
                    audioError
                ) {
                    console.warn(
                        "Audio capture unavailable:",
                        audioError
                    );
                }
            }

            const mimeType =
                getMimeType();

            const recorder =
                new MediaRecorder(
                    combinedStream,
                    {
                        mimeType,
                        videoBitsPerSecond:
                            getVideoBitrate()
                    }
                );

            const chunks =
                [];

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

            const recordingFinished =
                new Promise(
                    function (
                        resolve,
                        reject
                    ) {
                        recorder.onstop =
                            function () {
                                resolve();
                            };

                        recorder.onerror =
                            function (
                                event
                            ) {
                                reject(
                                    event.error ||
                                        new Error(
                                            "MediaRecorder failed."
                                        )
                                );
                            };
                    }
                );

            await waitForVideoTime(
                source,
                start
            );

            recorder.start(
                250
            );

            await new Promise(
                async function (
                    resolve,
                    reject
                ) {
                    let animationFrame =
                        null;

                    let finished =
                        false;

                    function cleanup() {
                        if (
                            animationFrame !==
                            null
                        ) {
                            cancelAnimationFrame(
                                animationFrame
                            );
                        }

                        source.removeEventListener(
                            "ended",
                            onEnded
                        );

                        source.removeEventListener(
                            "error",
                            onError
                        );
                    }

                    function onEnded() {
                        finish();
                    }

                    function onError() {
                        fail(
                            new Error(
                                "Video playback failed during export."
                            )
                        );
                    }

                    function finish() {
                        if (finished) {
                            return;
                        }

                        finished =
                            true;

                        cleanup();

                        try {
                            if (
                                recorder.state !==
                                "inactive"
                            ) {
                                recorder.stop();
                            }
                        } catch (
                            error
                        ) {
                            reject(
                                error
                            );
                        }

                        resolve();
                    }

                    function fail(
                        error
                    ) {
                        if (finished) {
                            return;
                        }

                        finished =
                            true;

                        cleanup();

                        try {
                            if (
                                recorder.state !==
                                "inactive"
                            ) {
                                recorder.stop();
                            }
                        } catch (
                            stopError
                        ) {
                            console.warn(
                                stopError
                            );
                        }

                        reject(
                            error
                        );
                    }

                    function draw() {
                        if (
                            finished
                        ) {
                            return;
                        }

                        drawExportFrame(
                            ctx,
                            source,
                            canvas,
                            0,
                            0,
                            source.videoWidth,
                            source.videoHeight
                        );

                        const elapsed =
                            Math.max(
                                0,
                                source.currentTime -
                                    start
                            );

                        const total =
                            end -
                            start;

                        const percent =
                            total >
                            0
                                ? (
                                      elapsed /
                                      total
                                  ) *
                                  100
                                : 0;

                        updateExportProgress(
                            percent,
                            "Exporting " +
                                Math.min(
                                    100,
                                    Math.round(
                                        percent
                                    )
                                ) +
                                "%"
                        );

                        if (
                            source.currentTime >=
                            end
                        ) {
                            finish();
                            return;
                        }

                        animationFrame =
                            requestAnimationFrame(
                                draw
                            );
                    }

                    source.addEventListener(
                        "ended",
                        onEnded
                    );

                    source.addEventListener(
                        "error",
                        onError
                    );

                    try {
                        await source.play();
                    } catch (
                        error
                    ) {
                        fail(
                            error
                        );
                        return;
                    }

                    draw();
                }
            );

            await recordingFinished;

            const blob =
                new Blob(
                    chunks,
                    {
                        type: mimeType
                    }
                );

            const clipIndex =
                state.clips.findIndex(
                    function (
                        item
                    ) {
                        return (
                            item.id ===
                            clip.id
                        );
                    }
                );

            downloadBlob(
                blob,
                getClipFilename(
                    clip,
                    clipIndex >= 0
                        ? clipIndex
                        : 0
                )
            );

            updateExportProgress(
                100,
                "Export complete"
            );

            await new Promise(
                function (
                    resolve
                ) {
                    setTimeout(
                        resolve,
                        500
                    );
                }
            );
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

    async function exportAllClips() {
        saveCurrentClipState();

        if (!state.clips.length) {
            throw new Error(
                "No clips are available."
            );
        }

        const originalActiveClipId =
            state.activeClipId;

        const clips =
            state.clips.map(
                function (
                    clip
                ) {
                    return {
                        id:
                            clip.id,
                        start:
                            clip.start,
                        end:
                            clip.end
                    };
                }
            );

        try {
            for (
                let index = 0;
                index <
                clips.length;
                index++
            ) {
                const clip =
                    clips[index];

                selectClip(
                    clip.id
                );

                await new Promise(
                    function (
                        resolve
                    ) {
                        setTimeout(
                            resolve,
                            100
                        );
                    }
                );

                await exportVideo();

                await new Promise(
                    function (
                        resolve
                    ) {
                        setTimeout(
                            resolve,
                            250
                        );
                    }
                );
            }
        } finally {
            if (
                originalActiveClipId !==
                null
            ) {
                selectClip(
                    originalActiveClipId
                );
            }

            hideExportProgress();
        }
                    }
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

        const exportModeInputs =
            document.querySelectorAll(
                'input[name="exportMode"]'
            );

        const createButton =
            document.getElementById(
                "startExportButton"
            );

        exportModeInputs.forEach(
            function (input) {
                input.addEventListener(
                    "change",
                    function () {
                        if (!createButton) {
                            return;
                        }

                        if (
                            input.value ===
                                "all" &&
                            input.checked
                        ) {
                            createButton.textContent =
                                "Export All Clips";
                        }

                        if (
                            input.value ===
                                "current" &&
                            input.checked
                        ) {
                            createButton.textContent =
                                "Create Clip";
                        }
                    }
                );
            }
        );

        if (createButton) {
            createButton.addEventListener(
                "click",
                async function (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    const selectedMode =
                        document.querySelector(
                            'input[name="exportMode"]:checked'
                        );

                    const exportAll =
                        selectedMode &&
                        selectedMode.value ===
                            "all";

                    createButton.disabled = true;

                    try {
                        if (exportAll) {
                            await exportAllClips();
                        } else {
                            await exportVideo();
                        }
                    } catch (error) {
                        hideExportProgress();

                        alert(
                            error &&
                            error.message
                                ? error.message
                                : "Video export failed."
                        );
                    } finally {
                        createButton.disabled = false;
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

        syncTrimFromTimeline: function (
            start,
            end
        ) {
            const clip =
                getActiveClip();

            if (!clip) {
                return;
            }

            const duration =
                getDuration();

            clip.start =
                clamp(
                    Number(start) || 0,
                    0,
                    duration
                );

            clip.end =
                clamp(
                    Number(end) || duration,
                    clip.start,
                    duration
                );

            renderClipList();
        },

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
