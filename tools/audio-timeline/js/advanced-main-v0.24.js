/**
 * ORGANON STUDIO: MOTORICLIP ADVANCED CONTROLLER
 * v0.24 — direct basin iframe file-drop route, robust preview resize, preview zoom, delete and duplicate selection.
 * Basic Mode is untouched.
 */

import { AdvancedTimeline } from './advanced-timeline-v0.24.js';
import { AdvancedMediaEngine } from './advanced-media-engine-v0.24.js?build=20261120-orgavox-lofi';
import { snapshotProject, snapshotClip, applyClipData, restoreFileEntries, prepareHistoryTracks, referencedFileIds, matchesHistoricalSource, historicalMediaIdsForFile } from './project-history.mjs?build=20261123-reset-ui';
import { AdvancedLiveExporter } from './advanced-live-export.mjs';
import { AdvancedOfflineExporter, OFFLINE_EXPORT_LIMIT_SECONDS } from './advanced-offline-export.mjs?build=20261120-wav-only';
import { normalizeVisualTransitions, splitVisualTransitions, fadeDuration } from './visual-transitions.mjs';
import { TRANSITION_CATALOG } from './transition-catalog.mjs';
import { planPairedTransition, isPairedFadeActive, PAIR_VISUAL_TYPES } from './clip-pair-transitions.mjs';
import { paintPairedEffect } from './paired-visual-effects.mjs';
import { normaliseSpiralBlockOptions } from './gl-transitions/SpiralBlockWipe.mjs';
import { normaliseHologramOptions } from './gl-transitions/Hologram.mjs';
import { normaliseCellDissolveOptions } from './gl-transitions/CellDissolve.mjs';
import { normaliseVortexOptions } from './gl-transitions/Vortex.mjs';
import { normaliseCrumpleOptions } from './gl-transitions/Crumple.mjs';
import { normaliseLiquidFillOptions } from './gl-transitions/LiquidFill.mjs';
import { normaliseHeatHazeOptions } from './gl-transitions/HeatHaze.mjs';
import { normaliseSphereOptions } from './gl-transitions/Sphere.mjs';
import { normaliseRingsWipeOptions } from './gl-transitions/RingsWipe.mjs';
import { normaliseSnapshotOptions } from './gl-transitions/Snapshot.mjs';
import { normaliseColorPanelWipeOptions } from './gl-transitions/ColorPanelWipe.mjs';
import { normaliseGalleryOptions } from './gl-transitions/Gallery.mjs';
import { normaliseVhsTrackingOptions } from './gl-transitions/VhsTracking.mjs';
import { normaliseCardSwipeOptions } from './gl-transitions/CardSwipe.mjs';
import { normaliseCameraShakeOptions } from './gl-transitions/CameraShake.mjs';
import { normaliseSmokeDissolveOptions } from './gl-transitions/SmokeDissolve.mjs';
import { normaliseSplatterWipeOptions } from './gl-transitions/SplatterWipe.mjs';
import { normaliseInkBleedOptions } from './gl-transitions/InkBleed.mjs';
import { normaliseRefractionOptions } from './gl-transitions/Refraction.mjs';
import { normaliseWhipSpinOptions } from './gl-transitions/WhipSpin.mjs';
import { normalisePaperTearOptions } from './gl-transitions/PaperTear.mjs';
import { normaliseApertureWipeOptions } from './gl-transitions/ApertureWipe.mjs';
import { normaliseSpiralWipeOptions } from './gl-transitions/SpiralWipe.mjs';
import { normalisePrismsOptions } from './gl-transitions/Prisms.mjs';
import { normaliseCubeOptions } from './gl-transitions/Cube.mjs';
import { normaliseCrosshatchOptions } from './gl-transitions/Crosshatch.mjs';
import { normaliseGlitchFlickerOptions } from './gl-transitions/GlitchFlicker.mjs';
import { normalisePixelizeOptions } from './gl-transitions/Pixelize.mjs';
import { normaliseRandomSquaresOptions } from './gl-transitions/RandomSquares.mjs';
import { normaliseRippleOptions } from './gl-transitions/Ripple.mjs';
import { normaliseTvTurnOffOptions } from './gl-transitions/TvTurnOff.mjs';
import { normaliseBloomDissolveOptions } from './gl-transitions/BloomDissolve.mjs';
import { normaliseBokehDissolveOptions } from './gl-transitions/BokehDissolve.mjs';
import { normaliseLightRaysOptions } from './gl-transitions/LightRays.mjs';
import { normaliseBlockCoverOptions } from './gl-transitions/BlockCover.mjs';
import { normaliseDisintegrateOptions } from './gl-transitions/Disintegrate.mjs';
import { normaliseAsciiOptions } from './gl-transitions/Ascii.mjs';
import { normaliseFilmStripOptions } from './gl-transitions/FilmStrip.mjs';
import { planClipSnap } from './clip-snap.mjs';
import { normalizeOrgavoxFx, ORGAVOX_FX_PRESETS } from './orgavox-audio-chain.mjs';
import { TEXT_PRESETS, LEGACY_TEXT_PRESETS, EFFECT_OVERLAYS, renderOverlayPreset, createOverlayFile } from './overlay-preset-library.mjs';
import { TIMELINE_EFFECTS, normaliseTimelineEffect, paintTimelineEffect, requiresCompositeSource, paintEffectPreviewScene } from './timeline-effects.mjs';
import { TEXT_ANIMATIONS, TEXT_OUT_ANIMATIONS, TEXT_LOOP_ANIMATIONS, normaliseTextOverlay, paintTimelineText } from './text-template-renderer.mjs';
import { normaliseTimelineColour, resolvedClipColour, resolvedLaneColour } from './timeline-appearance.mjs';
import { DEFAULT_TRANSFORM, DEFAULT_ADJUSTMENTS, VISIBLE_VISUAL_TYPES, visualParameterAt, upsertVisualKeyframe, getBaseVisualValue } from './visual-clip-adjustments.mjs';
import { getMediaHandle, saveMediaHandle, getPermittedMediaFile, isPersistentFileHandle, matchesSavedMediaReference } from './media-handle-store.mjs';
import { PROJECT_RECOVERY_KEY, MAX_RECOVERY_JSON_BYTES, createRecoveryRecord, parseRecoveryRecord, serializeRecoveryRecord, writeRecoveryRecordWithQuota } from './project-recovery.mjs?build=20261123-reset-ui';

(() => {
    const FILE_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv|mp3|wav|m4a|aac|ogg|opus|flac|gif|webp|png|jpe?g)$/i;
    const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;
    const AUDIO_PATTERN = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
    const STICKER_PATTERN = /\.(gif|webp|png)$/i;
    const BACKGROUND_PATTERN = /\.(jpe?g)$/i;
    const state = {
        files: [], tracks: [], selectedTrackId: null, selectedTrackIds: new Set(), selectedFileId: null,
        contextTrackId: null, contextClickTime: 0, contextClipboard: null, timelineMarkers: [], dragDepth: 0, isSeeking: false, serial: 0, liveRenderRequest: null,
        toastTimer: null, selectionMode: false, previewZoom: 100,
        history: { undo: [], redo: [], limit: 60 }, historyRestoring: false, sourceFiles: new Map(), savedFileHandles: new Map(), recoveryLoading:true, editorDisposing:false, lastRecoveryText:'', lastRecoveryFailedText:'', recoveryQuotaWarningShown:false
    };

    const elements = {
        editorHeader: document.getElementById('motori-header'), btnToggleHeader: document.getElementById('btn-toggle-header'),
        btnProjectSettings: document.getElementById('btn-project-settings'), btnProjectExport: document.getElementById('btn-project-export'),
        btnSaveProject: document.getElementById('btn-save-project'), btnOpenProject: document.getElementById('btn-open-project'), projectOpenInput: document.getElementById('project-open-input'),
        projectSettingsModal: document.getElementById('project-settings-modal'), projectExportModal: document.getElementById('project-export-modal'),
        btnResetTimeline:document.getElementById('btn-reset-timeline'), btnResetMenu:document.getElementById('btn-reset-menu'), resetMenu:document.getElementById('reset-menu'), btnResetMediaList:document.getElementById('btn-reset-media-list'),
        laneMenu:document.getElementById('timeline-lane-context-menu'),laneMenuTitle:document.getElementById('lane-menu-title'),
        laneRename:document.getElementById('lane-rename'),laneChangeColour:document.getElementById('lane-change-colour'),laneResetColour:document.getElementById('lane-reset-colour'),laneDelete:document.getElementById('lane-delete'),
        clipChangeColour:document.getElementById('context-change-colour'),clipResetColour:document.getElementById('context-reset-colour'),
        actionModal:document.getElementById('timeline-action-modal'),actionTitle:document.getElementById('timeline-action-title'),actionDescription:document.getElementById('timeline-action-description'),actionField:document.getElementById('timeline-action-field'),actionFieldLabel:document.getElementById('timeline-action-field-label'),actionInput:document.getElementById('timeline-action-input'),actionColours:document.getElementById('timeline-colour-presets'),actionError:document.getElementById('timeline-action-error'),actionApply:document.getElementById('timeline-action-apply'),actionCancel:document.getElementById('timeline-action-cancel'),actionClose:document.getElementById('timeline-action-close'),
        btnAddTrack: document.getElementById('btn-add-track'), trackTypeMenu: document.getElementById('track-type-menu'),
        btnSnapSelected: document.getElementById('btn-snap-selection'), btnSnapOptions: document.getElementById('btn-snap-options'), snapOptionsMenu: document.getElementById('snap-options-menu'),
        btnOpenTransitions: document.getElementById('btn-open-transitions'), transitionModal: document.getElementById('transition-modal'),
        transitionModalFrom: document.getElementById('transition-modal-from'), transitionModalTo: document.getElementById('transition-modal-to'),
        transitionModalEffect: document.getElementById('transition-modal-effect'), transitionModalDuration: document.getElementById('transition-modal-duration'),
        btnApplyTransitionModal: document.getElementById('btn-apply-transition-modal'), transitionModalStatus: document.getElementById('transition-modal-status'),
        timelineRuler: document.getElementById('timeline-ruler'),
        transitionPreviewCanvas: document.getElementById('transition-preview-canvas'), transitionPreviewProgress: document.getElementById('transition-preview-progress'), btnTransitionPlayPreview: document.getElementById('btn-transition-play-preview'),
        canvas: document.getElementById('advanced-canvas'), mediaBin: document.getElementById('media-bin'),
        previewStage: document.getElementById('preview-stage'), previewResizeHandle: document.getElementById('preview-resize-handle'), previewZoom: document.getElementById('preview-zoom'), previewZoomValue: document.getElementById('preview-zoom-value'), btnResetPreviewZoom: document.getElementById('btn-reset-preview-zoom'), previewEmpty: document.getElementById('preview-empty'), previewState: document.getElementById('preview-state'),
        previewSeek: document.getElementById('preview-seek'), previewVolume: document.getElementById('preview-volume'), timeReadout: document.getElementById('time-readout'),
        btnPlay: document.getElementById('btn-play'), btnPreviewMute: document.getElementById('btn-preview-mute'), btnStepBack: document.getElementById('btn-step-back'), btnStepForward: document.getElementById('btn-step-forward'), btnSnapshot: document.getElementById('btn-snapshot'), btnSnapshotJpeg: document.getElementById('btn-snapshot-jpeg'),
        fileInput: document.getElementById('file-input'), btnImport: document.getElementById('btn-import'), btnBrowse: document.getElementById('btn-browse'), btnHeaderBrowse: document.getElementById('btn-header-browse'), btnClear: document.getElementById('btn-clear'), btnRelink: document.getElementById('btn-relink'), mediaRememberNote: document.getElementById('media-remember-note'), btnBasicMode: document.getElementById('btn-basic-mode'),
        libraryTabs: [...document.querySelectorAll('[data-library-tab]')],
        effectsLibraryPanel: document.getElementById('effects-library-panel'), textLibraryPanel: document.getElementById('text-library-panel'),
        effectsLibraryGrid: document.getElementById('effects-library-grid'), effectCategory:document.getElementById('effect-category'), textLibraryGrid: document.getElementById('text-library-grid'),
        effectInspector:document.getElementById('inspector-timeline-effect'),
        effectDuration:document.getElementById('effect-duration'),
        effectInspectorInputs:Object.fromEntries(['intensity','speed','density','scale','direction','originX','originY','distortion','glow','blur','color','secondaryColor','rayCount','rayThickness','spinDirection','hudScale','frameRate','timecodeOffset','batteryLevel','jitter','recColor','showRec','showTimecode','showBattery','showCorners','showReticle','windSpeed','bankHeight','seed','staticMode','staticBrightness','staticVariance','staticSeed','signalLoss','colorBleed','rollRate','signalSeed','linePitch','lineOpacity','gridStrength','flickerStrength','crtRollRate','scanSeed','burstSize','burstLife','burstCluster','burstChroma','burstSeed','tearHeight','tearFragment','tearLife','tearSeed','rgbBlockWidth','rgbBlockHeight','rgbSeparation','rgbBlockLife','rgbBlockSeed','lineLength','lineThickness','lineFragments','lineStatic','lineAccent','lineLife','lineSeed','sparkForks','sparkLife','sparkSeed','debrisGravity','debrisTumble','debrisSpread','debrisLife','debrisSeed','explosionShock','explosionSmoke','explosionEjecta','explosionLife','explosionSeed','cassetteTracking','cassetteDropouts','cassetteChroma','cassetteRoll','cassetteSeed','rippleRings','rippleWidth','rippleFalloff','rippleHighlights','rippleSeed','electricBranches','electricWidth','electricChroma','electricFlicker','electricSeed','shockWidth','shockCompression','shockTurbulence','shockDecay','shockSeed'].map(name=>[name,document.getElementById(({originX:'effect-origin-x',originY:'effect-origin-y',secondaryColor:'effect-secondary-color',rayCount:'effect-ray-count',rayThickness:'effect-ray-thickness',spinDirection:'effect-spin-direction',hudScale:'effect-hud-scale',frameRate:'effect-frame-rate',timecodeOffset:'effect-timecode-offset',batteryLevel:'effect-battery-level',recColor:'effect-rec-color',showRec:'effect-show-rec',showTimecode:'effect-show-timecode',showBattery:'effect-show-battery',showCorners:'effect-show-corners',showReticle:'effect-show-reticle',windSpeed:'effect-wind-speed',bankHeight:'effect-bank-height',seed:'effect-seed',staticMode:'effect-static-mode',staticBrightness:'effect-static-brightness',staticVariance:'effect-static-variance',staticSeed:'effect-static-seed',signalLoss:'effect-signal-loss',colorBleed:'effect-color-bleed',rollRate:'effect-roll-rate',signalSeed:'effect-signal-seed',linePitch:'effect-line-pitch',lineOpacity:'effect-line-opacity',gridStrength:'effect-grid-strength',flickerStrength:'effect-flicker-strength',crtRollRate:'effect-crt-roll-rate',scanSeed:'effect-scan-seed',burstSize:'effect-burst-size',burstLife:'effect-burst-life',burstCluster:'effect-burst-cluster',burstChroma:'effect-burst-chroma',burstSeed:'effect-burst-seed',tearHeight:'effect-tear-height',tearFragment:'effect-tear-fragment',tearLife:'effect-tear-life',tearSeed:'effect-tear-seed',rgbBlockWidth:'effect-rgb-block-width',rgbBlockHeight:'effect-rgb-block-height',rgbSeparation:'effect-rgb-separation',rgbBlockLife:'effect-rgb-block-life',rgbBlockSeed:'effect-rgb-block-seed',lineLength:'effect-line-length',lineThickness:'effect-line-thickness',lineFragments:'effect-line-fragments',lineStatic:'effect-line-static',lineAccent:'effect-line-accent',lineLife:'effect-line-life',lineSeed:'effect-line-seed',sparkForks:'effect-spark-forks',sparkLife:'effect-spark-life',sparkSeed:'effect-spark-seed',debrisGravity:'effect-debris-gravity',debrisTumble:'effect-debris-tumble',debrisSpread:'effect-debris-spread',debrisLife:'effect-debris-life',debrisSeed:'effect-debris-seed',explosionShock:'effect-explosion-shock',explosionSmoke:'effect-explosion-smoke',explosionEjecta:'effect-explosion-ejecta',explosionLife:'effect-explosion-life',explosionSeed:'effect-explosion-seed',cassetteTracking:'effect-cassette-tracking',cassetteDropouts:'effect-cassette-dropouts',cassetteChroma:'effect-cassette-chroma',cassetteRoll:'effect-cassette-roll',cassetteSeed:'effect-cassette-seed',rippleRings:'effect-ripple-rings',rippleWidth:'effect-ripple-width',rippleFalloff:'effect-ripple-falloff',rippleHighlights:'effect-ripple-highlights',rippleSeed:'effect-ripple-seed',electricBranches:'effect-electric-branches',electricWidth:'effect-electric-width',electricChroma:'effect-electric-chroma',electricFlicker:'effect-electric-flicker',electricSeed:'effect-electric-seed',shockWidth:'effect-shock-width',shockCompression:'effect-shock-compression',shockTurbulence:'effect-shock-turbulence',shockDecay:'effect-shock-decay',shockSeed:'effect-shock-seed'})[name]||'effect-'+name)])),
        textOverlayValue: document.getElementById('text-overlay-value'),
        textInspector:document.getElementById('inspector-text-template'),
        textSelectedDesign:document.getElementById('text-selected-design'),
        textInspectorInputs:{
            value:document.getElementById('text-inspector-value'),
            fontSize:document.getElementById('text-font-size'),
            fontFamily:document.getElementById('text-font-family'),
            fontWeight:document.getElementById('text-font-weight'),
            fontStyle:document.getElementById('text-font-style'),
            textAlign:document.getElementById('text-text-align'),
            textCase:document.getElementById('text-text-case'),
            letterSpacing:document.getElementById('text-letter-spacing'),
            lineSpacing:document.getElementById('text-line-spacing'),
            textOpacity:document.getElementById('text-text-opacity'),
            glowColor:document.getElementById('text-glow-color'),
            glowStrength:document.getElementById('text-glow-strength'),
            shadowOffsetX:document.getElementById('text-shadow-offset-x'),
            shadowOffsetY:document.getElementById('text-shadow-offset-y'),
            backdropEnabled:document.getElementById('text-backdrop-enabled'),
            backdropColor:document.getElementById('text-backdrop-color'),
            backdropOpacity:document.getElementById('text-backdrop-opacity'),
            shapePadding:document.getElementById('text-shape-padding'),
            shapeRadius:document.getElementById('text-shape-radius'),
            shapeBorderColor:document.getElementById('text-shape-border-color'),
            shapeBorderWidth:document.getElementById('text-shape-border-width'),
            bannerWidth:document.getElementById('text-banner-width'),
            bannerHeight:document.getElementById('text-banner-height'),
            fill:document.getElementById('text-fill'),
            outline:document.getElementById('text-outline'),
            shadow:document.getElementById('text-shadow'),
            outlineWidth:document.getElementById('text-outline-width'),
            shadowBlur:document.getElementById('text-shadow-blur'),
            animation:document.getElementById('text-animation'),
            phasedAnimation:document.getElementById('text-phased-animation'),
            inAnimation:document.getElementById('text-in-animation'),
            inDuration:document.getElementById('text-in-duration'),
            outAnimation:document.getElementById('text-out-animation'),
            outDuration:document.getElementById('text-out-duration'),
            loopAnimation:document.getElementById('text-loop-animation'),
            loopDuration:document.getElementById('text-loop-duration'),
            animationDuration:document.getElementById('text-animation-duration'),
            animationDelay:document.getElementById('text-animation-delay'),
            animationSpeed:document.getElementById('text-animation-speed'),
            animationDirection:document.getElementById('text-animation-direction'),
            animationEasing:document.getElementById('text-animation-easing'),
            animationIntensity:document.getElementById('text-animation-intensity'),
            animationLoop:document.getElementById('text-animation-loop'),
            subtitle:document.getElementById('text-subtitle')
        },
        textPreviewModal:document.getElementById('text-preview-modal'),
        textPreviewTitle:document.getElementById('text-preview-title'),
        textPreviewCanvas:document.getElementById('text-preview-canvas'),
        textPreviewClose:document.getElementById('text-preview-close'),
        textPreviewPlay:document.getElementById('text-preview-play'),
        textPreviewRestart:document.getElementById('text-preview-restart'),
        textPreviewLoop:document.getElementById('text-preview-loop'),
        textPreviewProgress:document.getElementById('text-preview-progress'),
        fileList: document.getElementById('file-list'), fileCount: document.getElementById('file-count'), projectDropZone: document.getElementById('project-drop-zone'), dropOverlay: document.getElementById('project-drop-overlay'),
        canvasWidth: document.getElementById('canvas-width'), canvasHeight: document.getElementById('canvas-height'), canvasAspectLabel: document.getElementById('canvas-aspect-label'), btnApplyCanvas: document.getElementById('btn-apply-canvas'), projectFps: document.getElementById('project-fps'),
        exportFormat: document.getElementById('export-format'), exportBitrate: document.getElementById('export-bitrate'), btnExportVideo: document.getElementById('btn-export-video'), exportStatus: document.getElementById('export-status'),
        exportOfflineFormat: document.getElementById('export-offline-format'), btnExportOffline: document.getElementById('btn-export-offline'), exportOverlayNote: document.getElementById('export-overlay-note'),
        exportOverlay: document.getElementById('export-overlay'), exportOverlayStatus: document.getElementById('export-overlay-status'), exportProgress: document.getElementById('export-progress'), exportProgressText: document.getElementById('export-progress-text'), btnExportCancel: document.getElementById('btn-export-cancel'),
        toast: document.getElementById('app-toast'), timelineZoom: document.getElementById('timeline-zoom'), timelineZoomValue: document.getElementById('timeline-zoom-value'), btnResetTimelineZoom: document.getElementById('btn-reset-timeline-zoom'), btnUndo: document.getElementById('btn-undo'), btnRedo: document.getElementById('btn-redo'), btnSplitAll: document.getElementById('btn-split-all'),
        btnAddMarker: document.getElementById('btn-add-marker'), btnPreviousMarker: document.getElementById('btn-previous-marker'), btnNextMarker: document.getElementById('btn-next-marker'),
        btnNudgeLeft: document.getElementById('btn-nudge-left'), btnNudgeRight: document.getElementById('btn-nudge-right'),
        btnSelectionMode: document.getElementById('btn-selection-mode'), btnGroupSelection: document.getElementById('btn-group-selection'),
        visualTools: document.getElementById('inspector-visual-tools'), visualInputs: [...document.querySelectorAll('[data-visual-param]')], visualKeyframes: [...document.querySelectorAll('[data-keyframe]')], visualBlendMode: document.getElementById('visual-blend-mode'), visualSpeedPanel: document.getElementById('visual-speed-panel'), visualSpeed: document.getElementById('visual-speed'), visualSpeedValue: document.getElementById('visual-speed-value'), visualSpeedDuration: document.getElementById('visual-speed-duration'),
        orgavoxControls: [...document.querySelectorAll('.orgavox-fx-field select')],
        inspectorKind: document.getElementById('inspector-kind'), inspectorProject: document.getElementById('inspector-project'), pairTransitionPanel: document.getElementById('pair-transition-panel'), pairTransitionDescription: document.getElementById('pair-transition-description'), pairTransitionEffect: document.getElementById('pair-transition-effect'), pairTransitionDuration: document.getElementById('pair-transition-duration'), btnApplyPairTransition: document.getElementById('btn-apply-pair-transition'), transitionLibraryGrid: document.getElementById('transition-library-grid'), transitionLibraryStatus: document.getElementById('transition-library-status'), inspectorVideo: document.getElementById('inspector-video'), inspectorBackground: document.getElementById('inspector-background'), inspectorAudio: document.getElementById('inspector-audio'), inspectorSticker: document.getElementById('inspector-sticker'),
        selectedVideoName: document.getElementById('selected-video-name'), videoVisibleSwitch: document.getElementById('video-visible-switch'), videoAudioSwitch: document.getElementById('video-audio-switch'), videoAudioVolume: document.getElementById('video-audio-volume'), videoAudioVolumeValue: document.getElementById('video-audio-volume-value'), videoAudioGain: document.getElementById('video-audio-gain'), videoAudioGainValue: document.getElementById('video-audio-gain-value'), videoOpacity: document.getElementById('video-opacity'), videoOpacityValue: document.getElementById('video-opacity-value'), videoBlendMode: document.getElementById('video-blend-mode'), videoTransitionEnter: document.getElementById('video-transition-enter'), videoTransitionEnterValue: document.getElementById('video-transition-enter-value'), videoTransitionEnterCurve: document.getElementById('video-transition-enter-curve'), videoTransitionExit: document.getElementById('video-transition-exit'), videoTransitionExitValue: document.getElementById('video-transition-exit-value'), videoTransitionExitCurve: document.getElementById('video-transition-exit-curve'), videoTransitionSummary: document.getElementById('video-transition-summary'), videoTransitionPairNote: document.getElementById('video-transition-pair-note'), btnUnpairTransition: document.getElementById('btn-unpair-transition'), btnExtractAudio: document.getElementById('btn-extract-audio'),
        selectedBackgroundName: document.getElementById('selected-background-name'), backgroundVisibleSwitch: document.getElementById('background-visible-switch'), backgroundOpacity: document.getElementById('background-opacity'), backgroundOpacityValue: document.getElementById('background-opacity-value'), backgroundBlendMode: document.getElementById('background-blend-mode'),
        selectedAudioName: document.getElementById('selected-audio-name'), audioAuditionSwitch: document.getElementById('audio-audition-switch'), audioTrackVolume: document.getElementById('audio-track-volume'), audioTrackVolumeValue: document.getElementById('audio-track-volume-value'), audioTrackGain: document.getElementById('audio-track-gain'), audioTrackGainValue: document.getElementById('audio-track-gain-value'), audioFadeIn: document.getElementById('audio-fade-in'), audioFadeInValue: document.getElementById('audio-fade-in-value'), audioFadeOut: document.getElementById('audio-fade-out'), audioFadeOutValue: document.getElementById('audio-fade-out-value'),
        selectedStickerName: document.getElementById('selected-sticker-name'), stickerVisibleSwitch: document.getElementById('sticker-visible-switch'), stickerOpacity: document.getElementById('sticker-opacity'), stickerOpacityValue: document.getElementById('sticker-opacity-value'), stickerBlendMode: document.getElementById('sticker-blend-mode'), stickerTransparencyMode: document.getElementById('sticker-transparency-mode'), stickerKeyColour: document.getElementById('sticker-key-colour'), stickerKeyColourText: document.getElementById('sticker-key-colour-text'), stickerKeyTolerance: document.getElementById('sticker-key-tolerance'), stickerKeyToleranceValue: document.getElementById('sticker-key-tolerance-value'), stickerEdgeFeather: document.getElementById('sticker-edge-feather'), stickerEdgeFeatherValue: document.getElementById('sticker-edge-feather-value'),
        contextMenu: document.getElementById('timeline-context-menu'), contextMenuTitle: document.getElementById('context-menu-title'), contextSplitNow: document.getElementById('context-split-now'), contextAddLayer: document.getElementById('context-add-layer'), ContextClipActions: ['cut','copy','paste','slice-click','toggle-visible','download-source'].reduce((acc,action)=>{acc[action]=document.getElementById('context-'+action);return acc;},{}), contextDownloadSection: document.getElementById('context-download-section'), contextDownloadWav: document.getElementById('context-download-wav'), contextExtractAudio: document.getElementById('context-extract-audio'), contextDuplicate: document.getElementById('context-duplicate'), contextRemoveLayer: document.getElementById('context-remove-layer')
    };

    const engine = new AdvancedMediaEngine({
        canvas: elements.canvas,
        mediaBin: elements.mediaBin,
        onTimeChange: updateTimeDisplay,
        onDurationChange: (duration) => { timeline.setDuration(duration); updateTimeDisplay({ currentTime: engine.currentTime, duration }); updateExportAvailability(); },
        onPlaybackChange: setPlayButton,
        onRenderError: (error) => { elements.previewState.textContent = `Preview error: ${error.message}`; }
    });

    const timeline = new AdvancedTimeline({
        lanesElement: document.getElementById('timeline-lanes'),
        rulerElement: document.getElementById('timeline-ruler'),
        emptyElement: document.getElementById('timeline-empty'),
        onSelect: selectTrack,
        onContextMenu: openContextMenu,
        onLaneContextMenu: openLaneContextMenu,
        onDropProjectFile: placeProjectFile,
        onTrackChange: onTimelineTrackChanged,
        onTrackInteractionStart: (track, detail) => recordHistory(`${detail.mode === 'resize' ? 'Trim' : 'Move'} ${track.sourceName || track.laneLabel}`),
        onSeek: (time) => { void engine.seek(time).catch((error) => { elements.previewState.textContent = error.message; }); },
        onSplitAtPlayhead: splitTrackAtNow
    });

    const exporter = new AdvancedLiveExporter({
        engine, canvas:elements.canvas,
        onProgress: ({current,duration,percent}) => {
            elements.exportProgress.value = percent;
            elements.exportProgressText.textContent = `${Math.round(percent)}% · ${formatTime(current)} / ${formatTime(duration)}`;
        },
        onState: ({phase,message}) => {
            elements.exportStatus.textContent = message;
            elements.exportOverlayStatus.textContent = message;
            elements.exportOverlay.hidden = !['preparing','recording','finalizing'].includes(phase);
            elements.exportOverlayNote.textContent = 'This is a real-time recording. Keep MotoriClip visible until it finishes.';
            updateExportAvailability();
            if (phase === 'error') {
                elements.previewState.textContent = `Export error: ${message}`;
                showToast('Video export failed');
            }
            if (phase === 'complete') showToast(message);
            if (phase === 'cancelled') showToast('Export cancelled');
        },
        onDownload: ({blob,extension}) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `motoriclip-project.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    });

    const offlineExporter = new AdvancedOfflineExporter({
        engine,
        onProgress: ({current,duration,percent}) => {
            elements.exportProgress.value = percent;
            elements.exportProgressText.textContent = `${Math.round(percent)}% · ${formatTime(current)} / ${formatTime(duration)}`;
        },
        onState: ({phase,message}) => {
            elements.exportStatus.textContent = message;
            elements.exportOverlayStatus.textContent = message;
            elements.exportOverlay.hidden = !['preparing','recording','finalizing'].includes(phase);
            elements.exportOverlayNote.textContent = 'Fixed-timestamp offline encoding (beta). Your project stays on this device; cancellation discards incomplete output.';
            updateExportAvailability();
            if (phase === 'error') {
                elements.previewState.textContent = `Export error: ${message}`;
                showToast('Fixed-frame export failed');
            }
            if (phase === 'complete') showToast(message);
            if (phase === 'cancelled') showToast('Fixed-frame export cancelled');
        },
        onDownload: ({blob,extension,filename}) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `motoriclip-fixedframe-beta.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
    });

    function updateExportAvailability() {
        const supported = exporter.getFormats();
        const duration = engine.getTimelineDuration();
        const busy = exporter.busy || offlineExporter.busy;
        const mediaMissing=state.tracks.some(track=>track.sourceName&&!track.file);
        const captureReady = typeof elements.canvas.captureStream === 'function' && typeof window.MediaStream === 'function';
        elements.btnExportVideo.disabled = busy || mediaMissing || !captureReady || supported.length === 0 || duration <= 0;
        elements.btnExportOffline.disabled = busy || mediaMissing || !offlineExporter.getAvailable()
            || duration <= 0 || duration > OFFLINE_EXPORT_LIMIT_SECONDS;
        elements.btnExportOffline.title = mediaMissing ? 'Reconnect offline clips before exporting this project' : duration > OFFLINE_EXPORT_LIMIT_SECONDS
            ? 'Fixed-frame beta currently supports projects up to 2 minutes'
            : (offlineExporter.getAvailable() ? 'Render with fixed timestamps (experimental)' : 'Requires WebCodecs and OfflineAudioContext');
    }
    function initVideoExportUi() {
        const formats = exporter.getFormats();
        elements.exportFormat.textContent = '';
        for (const format of formats) {
            const option = document.createElement('option');
            option.value = format.format;
            option.textContent = format.format === 'mp4' ? 'MP4 · browser-native' : 'WebM · browser-native';
            elements.exportFormat.appendChild(option);
        }
        const captureReady = typeof elements.canvas.captureStream === 'function' && typeof window.MediaStream === 'function';
        if (!formats.length || !captureReady) {
            const unavailable = document.createElement('option');
            unavailable.value = '';
            unavailable.textContent = 'No recording format';
            elements.exportFormat.appendChild(unavailable);
            elements.exportStatus.textContent = !captureReady
                ? 'This browser cannot capture the canvas and audio as a recording.'
                : 'This browser has no supported video-recording format.';
        } else {
            elements.exportStatus.textContent = 'Ready · full-timeline, real-time export';
        }
        updateExportAvailability();
    }

    elements.btnExportVideo.addEventListener('click', () => {
        elements.exportProgress.value = 0;
        elements.exportProgressText.textContent = '0%';
        void exporter.start({
            format:elements.exportFormat.value,
            fps:engine.projectFps,
            bitrateKbps:Number(elements.exportBitrate.value)
        }).catch((error) => {
            elements.exportStatus.textContent = `Export failed: ${error.message}`;
            elements.previewState.textContent = `Export error: ${error.message}`;
        });
    });
    elements.btnExportOffline.addEventListener('click', () => {
        elements.exportProgress.value = 0;
        elements.exportProgressText.textContent = '0%';
        void offlineExporter.start({
            format:elements.exportOfflineFormat.value,
            fps:engine.projectFps,
            bitrateKbps:Number(elements.exportBitrate.value)
        }).catch((error) => {
            elements.exportStatus.textContent = `Fixed-frame export failed: ${error.message}`;
            elements.previewState.textContent = `Export error: ${error.message}`;
            updateExportAvailability();
        }).finally(() => updateExportAvailability());
    });
    elements.btnExportCancel.addEventListener('click', () => {
        if (offlineExporter.busy) void offlineExporter.cancel();
        else void exporter.cancel();
    });
    document.addEventListener('keydown', (event) => {
        if (!exporter.busy && !offlineExporter.busy) return;
        if (event.key === 'Escape') {
            if (offlineExporter.busy) void offlineExporter.cancel();
            else void exporter.cancel();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function formatTime(seconds) {
        const safe = Math.max(0, Number(seconds) || 0);
        return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
    }
    function formatSeconds(seconds) { return `${(Math.round((Number(seconds) || 0) * 10) / 10).toFixed(1)}s`; }
    function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
    function formatFileSize(size) { return !Number.isFinite(size) ? 'unknown size' : (size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`); }
    function getKind(file) {
        const name = file.name || '';
        if (file.type?.startsWith('video/') || VIDEO_PATTERN.test(name)) return 'video';
        if (file.type?.startsWith('audio/') || AUDIO_PATTERN.test(name)) return 'audio';
        if (file.type === 'image/jpeg' || BACKGROUND_PATTERN.test(name)) return 'background';
        if (file.type === 'image/gif' || file.type === 'image/webp' || file.type === 'image/png' || STICKER_PATTERN.test(name)) return 'sticker';
        return null;
    }
    function kindLabel(kind) { return ({ video: '🎬', audio: '🎵', sticker: '✨', background: '🖼️' })[kind] || '📄'; }
    function kindName(kind) { return ({ video: 'video', audio: 'audio', sticker: 'image / sticker', background: 'jpeg background' })[kind] || 'file'; }
    function getTrack(trackId = state.selectedTrackId) { return state.tracks.find((track) => track.id === trackId) || null; }
    function getFile(fileId) { return state.files.find((entry) => entry.id === fileId) || null; }
    function laneName(type, order) { return `${type === 'sticker' ? 'Sticker' : type === 'video' ? 'Video' : type === 'background' ? 'Background' : 'Audio'} ${order}`; }
    function nextLaneOrder(type) { return new Set(state.tracks.filter((track) => track.type === type).map((track) => track.laneId || track.id)).size + 1; }

    function createTrack(type, extras = {}) {
        const order = extras.order ?? nextLaneOrder(type);
        const laneId = extras.laneId || `${type}-lane-${Date.now()}-${++state.serial}`;
        const base = {
            id: `${type}-${Date.now()}-${++state.serial}`,
            type,
            order,
            laneId,
            laneLabel: extras.laneLabel || laneName(type, order),
            label: extras.label || laneName(type, order),
            laneColor:normaliseTimelineColour(extras.laneColor),
            clipColor:normaliseTimelineColour(extras.clipColor),
            start: 0,
            sourceOffset: 0,
            sourceDuration: 0,
            clipDuration: 0,
            sourceName: '',
            file: null,
            visible: true,
            opacity: 1,
            blendMode: 'source-over',
            transform: { ...DEFAULT_TRANSFORM },
            adjustments: { ...DEFAULT_ADJUSTMENTS },
            keyframes: {},
            speed:1,
            groupId: null,
            transitionFromId: null, transitionEffectId: null,
            audio: { volume: 1, gain: 0, muted: false, fadeIn: 0, fadeOut: 0 },
            visualTransitions: normalizeVisualTransitions(),
            transparency: { mode: 'native', keyColour: '#00ff00', tolerance: 30, feather: 8 }
        };
        return { ...base, ...extras, audio: { ...base.audio, ...(extras.audio || {}) }, transparency: { ...base.transparency, ...(extras.transparency || {}) }, visualTransitions: normalizeVisualTransitions(extras.visualTransitions), transform:{...base.transform,...(extras.transform||{})}, adjustments:{...base.adjustments,...(extras.adjustments||{})}, keyframes:Object.fromEntries(Object.entries(extras.keyframes||{}).map(([key,frames])=>[key,Array.isArray(frames)?frames.map(frame=>({...frame})):[]])) };
    }

    function greatestCommonDivisor(a, b) { let x = Math.abs(a), y = Math.abs(b); while (y) [x, y] = [y, x % y]; return x || 1; }
    function updateCanvasAspectLabel(width, height) { const divisor = greatestCommonDivisor(width, height); elements.canvasAspectLabel.textContent = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`; }
    function applyCanvasResolution({ announce = false, remember = false } = {}) {
        const width = clamp(Math.round(Number(elements.canvasWidth.value) || 1280), 64, 7680);
        const height = clamp(Math.round(Number(elements.canvasHeight.value) || 720), 64, 7680);
        if(remember && (elements.canvas.width!==width || elements.canvas.height!==height))
            recordHistory('Change canvas resolution');
        elements.canvasWidth.value = String(width); elements.canvasHeight.value = String(height);
        engine.setCanvasResolution(width, height);
        elements.previewStage.style.aspectRatio = `${width} / ${height}`;
        updateCanvasAspectLabel(width, height);
        if (announce) { elements.previewState.textContent = `Canvas set to ${width} × ${height}`; showToast(`Canvas set to ${width} × ${height}`); }
    }
    function showToast(message, duration = 3200) {
        clearTimeout(state.toastTimer);
        elements.toast.textContent = message;
        elements.toast.classList.add('visible');
        state.toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), duration);
    }


    // One branded, accessible action dialog replaces native browser prompt,
    // confirm and alert UI. Resolve only on a direct user interaction.
    let actionDialogResolve=null;
    function closeEditorAction(value=null) {
        elements.actionModal.hidden=true;
        if(actionDialogResolve){
            const resolve=actionDialogResolve;
            actionDialogResolve=null;
            resolve(value);
        }
    }
    function requestEditorAction({kind='confirm',title='Confirm',description='',value='',apply='Apply',danger=false}={}) {
        if(actionDialogResolve)closeEditorAction(null);
        hideContextMenu();
        hideLaneContextMenu();
        elements.actionTitle.textContent=title;
        elements.actionDescription.textContent=description;
        elements.actionField.hidden=!['rename','colour'].includes(kind);
        elements.actionColours.hidden=kind!=='colour';
        elements.actionFieldLabel.textContent=kind==='colour'?'Hex colour':'Track name';
        elements.actionInput.value=String(value);
        elements.actionInput.maxLength=kind==='rename'?80:7;
        elements.actionInput.placeholder=kind==='colour'?'#4b84bf':'Track name';
        elements.actionError.hidden=true;
        elements.actionApply.textContent=apply;
        elements.actionCancel.hidden=kind==='info';
        elements.actionApply.classList.toggle('btn-danger',danger);
        elements.actionApply.classList.toggle('btn-primary',!danger);
        for(const button of elements.actionColours.querySelectorAll('[data-timeline-colour]')){
            button.style.setProperty('--swatch',button.dataset.timelineColour);
            button.setAttribute('aria-pressed',String(button.dataset.timelineColour===value));
        }
        elements.actionModal.hidden=false;
        (elements.actionField.hidden?elements.actionApply:elements.actionInput).focus();
        return new Promise(resolve=>{actionDialogResolve=resolve;});
    }
    function submitEditorAction() {
        const kind=!elements.actionField.hidden
            ? elements.actionColours.hidden?'rename':'colour' : 'confirm';
        const value=elements.actionInput.value.trim();
        if(kind==='rename' && (!value || value.length>80)){
            elements.actionError.textContent='Enter a track name of 1–80 characters.';
            elements.actionError.hidden=false;return;
        }
        if(kind==='colour' && !normaliseTimelineColour(value)){
            elements.actionError.textContent='Use a valid six-digit hex colour, such as #4b84bf.';
            elements.actionError.hidden=false;return;
        }
        closeEditorAction(kind==='rename'?value:kind==='colour'?normaliseTimelineColour(value):true);
    }
    elements.actionCancel.addEventListener('click',()=>closeEditorAction(null));
    elements.actionClose.addEventListener('click',()=>closeEditorAction(null));
    elements.actionApply.addEventListener('click',submitEditorAction);
    elements.actionModal.addEventListener('pointerdown',e=>{if(e.target===elements.actionModal)closeEditorAction(null);});
    elements.actionInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitEditorAction();}});
    for(const button of elements.actionColours.querySelectorAll('[data-timeline-colour]')){
        button.addEventListener('click',()=>{
            elements.actionInput.value=button.dataset.timelineColour;
            for(const other of elements.actionColours.querySelectorAll('[data-timeline-colour]'))
                other.setAttribute('aria-pressed',String(other===button));
            elements.actionError.hidden=true;
        });
    }

    function captureHistorySnapshot() {
        return snapshotProject({
            files: state.files, tracks: state.tracks, selectedTrackIds: state.selectedTrackIds,
            selectedTrackId: state.selectedTrackId, selectedFileId: state.selectedFileId,
            currentTime: engine.currentTime,
            markers:state.timelineMarkers,
            // Source of truth is the applied canvas, not an input the user has
            // typed into but has not yet applied.
            settings:{
                canvasWidth:elements.canvas.width,canvasHeight:elements.canvas.height,
                fps:engine.projectFps,previewZoom:state.previewZoom
            }
        });
    }

    function makeCurrentProjectRecord() {
        return createRecoveryRecord({
            files:state.files, tracks:state.tracks,
            selectedTrackId:state.selectedTrackId,
            selectedTrackIds:state.selectedTrackIds,
            selectedFileId:state.selectedFileId,
            currentTime:engine.currentTime,
            // Persist the settings actually applied to the render engine.
            // A user may still be typing a new width/height into the dialog:
            // saving those uncommitted inputs corrupts recovery on refresh.
            canvasWidth:elements.canvas.width,
            canvasHeight:elements.canvas.height,
            fps:engine.projectFps,
            previewZoom:state.previewZoom,
            markers:state.timelineMarkers,
            history:state.history
        });
    }
    function saveProjectRecovery() {
        if(state.recoveryLoading || state.historyRestoring || state.editorDisposing) return false;
        let signature='';
        try {
            const record=makeCurrentProjectRecord();
            // savedAt is deliberately excluded from change detection, so an
            // unchanged project cannot cause continuous localStorage writes.
            const content=serializeRecoveryRecord(record);
            const compare=JSON.parse(content);
            compare.savedAt=0;
            signature=JSON.stringify(compare);
            if(signature===state.lastRecoveryText
                ||signature===state.lastRecoveryFailedText)return false;
            const saved=writeRecoveryRecordWithQuota(localStorage,PROJECT_RECOVERY_KEY,record);
            state.lastRecoveryText=signature;
            state.lastRecoveryFailedText='';
            if(saved.truncated&&!state.recoveryQuotaWarningShown){
                state.recoveryQuotaWarningShown=true;
                showToast('Browser storage is low: older Undo steps were excluded from auto-recovery. Use Save Project for a portable backup.',6500);
            }
            return true;
        } catch(error) {
            console.warn('MotoriClip recovery could not be saved:',error);
            // Avoid quota-error/recovery loops when the project is unchanged.
            state.lastRecoveryFailedText=signature;
            if(!state.recoveryQuotaWarningShown){
                state.recoveryQuotaWarningShown=true;
                showToast('Automatic project recovery is unavailable. Use Save Project to download a backup.',6500);
            }
            return false;
        }
    }
    /**
     * A portable project is JSON metadata only. It intentionally never
     * includes File/Blob data or device-specific file paths; generated
     * Text/Effects clips carry small preset recipes instead.
     */
    function downloadPortableProject() {
        if(state.recoveryLoading || state.historyRestoring || state.editorDisposing){
            showToast('Finish restoring the current project before saving');return;
        }
        try {
            const json=serializeRecoveryRecord(makeCurrentProjectRecord());
            const now=new Date();
            const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),
                String(now.getDate()).padStart(2,'0')].join('')
                +'-'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');
            const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
            const anchor=document.createElement('a');
            anchor.download=`motoriclip-project-${stamp}.motoriclip.json`;
            anchor.href=url;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(()=>URL.revokeObjectURL(url),30000);
            showToast(`Saved project backup: ${state.tracks.length} clips, ${state.files.length} media references (no source files)`);
        }catch(error){
            console.warn('Could not save MotoriClip project backup:',error);
            showToast('Project backup failed: '+error.message);
        }
    }
    async function loadPortableProjectFile(file) {
        if(!file)return;
        if(state.recoveryLoading||state.historyRestoring||state.editorDisposing||exporter.busy||offlineExporter.busy){
            showToast('Finish the current project restore/export before opening another');return;
        }
        let record;
        try {
            if(file.size>MAX_RECOVERY_JSON_BYTES)
                throw Error('Project JSON is larger than the 3 MB safety limit.');
            const parsed=parseRecoveryRecord(await file.text());
            if(!parsed)throw Error('The selected file is empty.');
            // Rebuild the record using explicitly whitelisted fields, never
            // trusting incidental objects or unknown properties from JSON.
            record=createRecoveryRecord({
                files:parsed.files,tracks:parsed.tracks,
                selectedTrackId:parsed.selectedTrackId,
                selectedTrackIds:parsed.selectedTrackIds,
                selectedFileId:parsed.selectedFileId,
                currentTime:parsed.currentTime,
                canvasWidth:parsed.settings.canvasWidth,
                canvasHeight:parsed.settings.canvasHeight,
                fps:parsed.settings.fps,
                previewZoom:parsed.settings.previewZoom,
                markers:parsed.markers,
                history:parsed.history || {undo:[],redo:[]}
            });
        }catch(error){
            console.warn('Invalid portable MotoriClip project:',error);
            showToast('Cannot open project: '+error.message);
            return;
        }
        if(!await requestEditorAction({kind:'confirm',title:'Open saved project?',
            description:`Open ${file.name}? This replaces the current timeline and Undo/Redo history. Save a backup first if you need it; original source media may need relinking.`,
            apply:'Open project'}))return;
        state.recoveryLoading=true;
        try {
            // A current-session File can be reused only when its stable
            // reference ID and identifying metadata agree. Never match only
            // by filename or borrow the contents of an unrelated project.
            const previousFiles=new Map(state.files.filter(entry=>entry.file)
                .map(entry=>[entry.id,entry]));
            const files=record.files.map(item=>{
                const old=previousFiles.get(item.id);
                const compatible=old?.file && old.name===item.name && old.kind===item.kind
                    && (!item.size||old.file.size===item.size);
                return {...item,file:compatible?old.file:null,
                    needsRelink:!compatible};
            });
            engine.pause();
            engine.clearAll();
            state.files=files;
            state.tracks=record.tracks.map(snapshotClip);
            state.sourceFiles=new Map(files.filter(item=>item.file).map(item=>[item.id,item.file]));
            state.savedFileHandles.clear();
            state.history.undo=record.history?.undo || [];
            state.history.redo=record.history?.redo || [];
            state.selectedTrackIds=new Set(record.selectedTrackIds.filter(id=>
                state.tracks.some(track=>track.id===id)));
            state.selectedTrackId=state.tracks.some(track=>track.id===record.selectedTrackId)
                ? record.selectedTrackId : [...state.selectedTrackIds][0] || null;
            state.selectedFileId=files.some(item=>item.id===record.selectedFileId)
                ? record.selectedFileId : null;
            state.contextClipboard=null;
            state.timelineMarkers=[...record.markers];
            elements.canvasWidth.value=String(record.settings.canvasWidth);
            elements.canvasHeight.value=String(record.settings.canvasHeight);
            elements.projectFps.value=String(record.settings.fps);
            engine.setProjectFrameRate(record.settings.fps);
            state.previewZoom=record.settings.previewZoom;
            elements.previewZoom.value=String(record.settings.previewZoom);
            timeline.setMarkers(state.timelineMarkers);
            const regenerated=recreateGeneratedProjectOverlays();
            applyCanvasResolution();
            renderFiles();
            refreshAll();
            syncPreviewZoom();
            updateHistoryButtons();
            await restoreRememberedMediaHandles();
            await loadRecoveredMediaTracks();
            await engine.seek(Math.min(record.currentTime,engine.getTimelineDuration()),{resume:false});
            updateExportAvailability();
            const missing=state.tracks.filter(track=>track.sourceName&&!track.media).length;
            showToast(`Opened ${state.tracks.length} clips, ${regenerated} generated overlays`
                +(missing?`; ${missing} clip${missing===1?'':'s'} need media relinking`:'; all sources ready'));
        }catch(error){
            console.error('Cannot finish opening project:',error);
            showToast('Project opened partially; relink media if needed: '+error.message);
        }finally{
            state.recoveryLoading=false;
            state.lastRecoveryText='';
            updateHistoryButtons();
            saveProjectRecovery();
        }
    }

    function restoreSavedProjectMetadata() {
        let data;
        try {
            data=parseRecoveryRecord(localStorage.getItem(PROJECT_RECOVERY_KEY));
        } catch(error) {
            console.warn('Saved MotoriClip project metadata was invalid; old file index is preserved.',error);
            showToast('Project recovery data invalid; original media list was kept');
            return null;
        }
        if(!data)return null;
        // A valid project recovery record is the authoritative media-bin list.
        // The older filename index is only a fallback when recovery is missing
        // or corrupt; merging it here resurrects files from previous projects.
        const indexedById=new Map(state.files.map(entry=>[entry.id,entry]));
        state.files=data.files.map(file=>{
            const indexed=indexedById.get(file.id);
            const compatible=indexed && indexed.name===file.name
                && indexed.kind===file.kind
                && (!file.size || indexed.size===file.size);
            return {...file,file:null,needsRelink:true,
                ...(compatible && indexed.relativePath
                    ? {relativePath:indexed.relativePath}:{})};
        });
        state.tracks=data.tracks.map(record=>snapshotClip(record));
        state.history.undo=data.history?.undo || [];
        state.history.redo=data.history?.redo || [];
        state.selectedTrackIds=new Set(data.selectedTrackIds.filter(clipId=>
            state.tracks.some(track=>track.id===clipId)));
        state.selectedTrackId=state.tracks.some(track=>track.id===data.selectedTrackId)
            ? data.selectedTrackId : [...state.selectedTrackIds][0]||null;
        state.selectedFileId=state.files.some(file=>file.id===data.selectedFileId)
            ? data.selectedFileId : null;
        state.timelineMarkers=[...data.markers];
        const {canvasWidth,canvasHeight,fps,previewZoom}=data.settings;
        elements.canvasWidth.value=String(canvasWidth);
        elements.canvasHeight.value=String(canvasHeight);
        elements.projectFps.value=String(fps);
        engine.setProjectFrameRate(fps);
        state.previewZoom=previewZoom;
        elements.previewZoom.value=String(previewZoom);
        timeline.setMarkers(state.timelineMarkers);
        // Preserve the timestamp until media and player restoration finish.
        return data;
    }
    function recreateGeneratedProjectOverlays(files=state.files) {
        const presets=[...TEXT_PRESETS,...LEGACY_TEXT_PRESETS,...EFFECT_OVERLAYS,...TIMELINE_EFFECTS];
        let regenerated=0;
        for(const entry of files){
            if(entry.file||!entry.generated)continue;
            const recipe=entry.generated;
            const preset=presets.find(item=>item.group===recipe.group&&item.id===recipe.presetId);
            if(!preset) {
                console.warn('Unknown saved overlay template:',recipe.presetId);
                continue;
            }
            try {
                // Regenerate local artwork from a tiny recipe, not stored PNG
                // bytes. Keep the original filename/source ID so saved clips,
                // transitions and keyframes still reference the same media.
                const generated=createOverlayFile(preset,recipe.value);
                const file=new File([generated],entry.name,{type:'image/png',
                    lastModified:entry.lastModified||Date.now()});
                entry.file=file;
                entry.needsRelink=false;
                entry.size=file.size;
                state.sourceFiles.set(entry.id,file);
                regenerated++;
            } catch(error) {
                console.warn('Saved overlay could not be recreated:',entry.name,error);
            }
        }
        return regenerated;
    }
    async function loadRecoveredMediaTracks() {
        if(state.historyRestoring)return 0;
        let linked=0;
        const missing=state.tracks.filter(track=>track.sourceName&&!track.media
            && track.sourceFileId&&state.files.some(file=>file.id===track.sourceFileId&&file.file));
        for(const track of missing){
            if(!state.tracks.includes(track)||track.media)continue;
            const file=getFile(track.sourceFileId)?.file;
            if(!file)continue;
            try {
                // loadTrack creates fresh browser decoders but retains the
                // timeline's source in-point, duration, transforms/keyframes,
                // fades, speed, blend and Orgavox preset settings.
                const preserved=snapshotClip(track);
                await engine.loadTrack(track,file);
                if(!state.tracks.includes(track)){engine.detachTrack(track,false);continue;}
                // The engine discards old media metadata while creating new
                // decoders. Reapply the saved edit after the source is loaded,
                // otherwise trims/clip lengths/speed can silently reset.
                applyClipData(track,preserved);
                state.sourceFiles.set(track.sourceFileId,file);
                linked++;
            } catch(error) {
                console.warn('Saved clip could not reopen:',track.sourceName,error);
                elements.previewState.textContent=`Could not reopen ${track.sourceName}: ${error.message}`;
            }
        }
        if(linked) {
            refreshAll();
            void engine.seek(Math.min(engine.currentTime,engine.getTimelineDuration()),{resume:false})
                .catch(console.warn);
        }
        return linked;
    }

    function pruneSourceRegistry() {
        const keep = referencedFileIds(state.files, state.tracks, state.history.undo, state.history.redo);
        for (const id of state.sourceFiles.keys()) if (!keep.has(id)) state.sourceFiles.delete(id);
    }

    function updateHistoryButtons() {
        const ready=!state.recoveryLoading && !state.historyRestoring && !state.editorDisposing;
        const undo = ready && state.history.undo.length > 0;
        const redo = ready && state.history.redo.length > 0;
        elements.btnUndo.disabled = !undo;
        elements.btnRedo.disabled = !redo;
        elements.btnUndo.title = undo ? `Undo ${state.history.undo.at(-1).label}` : 'Nothing to undo';
        elements.btnRedo.title = redo ? `Redo ${state.history.redo.at(-1).label}` : 'Nothing to redo';
    }

    function recordHistory(label = 'timeline edit') {
        if (state.historyRestoring) return;
        state.history.undo.push({ label, snapshot: captureHistorySnapshot() });
        if (state.history.undo.length > state.history.limit) state.history.undo.shift();
        state.history.redo = [];
        pruneSourceRegistry();
        updateHistoryButtons();
    }

    async function restoreHistorySnapshot(snapshot) {
        if (!snapshot || state.historyRestoring) return;
        state.historyRestoring = true;
        updateHistoryButtons();
        try {
            // Media can be present in the current bin under a newer ID, or
            // remembered by a history-only file handle. Recover only when
            // identifying metadata agree; never borrow similarly named media.
            for(const record of snapshot.files||[]){
                if(record.generated || state.sourceFiles.has(record.id))continue;
                const current=state.files.find(entry=>entry.file
                    && matchesHistoricalSource(record,entry.file,entry.kind));
                if(current){
                    state.sourceFiles.set(record.id,current.file);
                    continue;
                }
                const handle=state.savedFileHandles.get(record.id)
                    || await getMediaHandle(record.id);
                if(!handle)continue;
                state.savedFileHandles.set(record.id,handle);
                const file=await getPermittedMediaFile(handle);
                // A persisted handle is associated with this exact stable
                // file ID. Accept matching name/kind/size even if a copied
                // file has a different timestamp (e.g. OPFS restoration).
                // Cross-ID guesses from the current bin remain stricter.
                if(file && matchesSavedMediaReference(record,file,getKind(file)))
                    state.sourceFiles.set(record.id,file);
            }
            // Keep offline placeholders when source media remains unavailable.
            // Export stays disabled until matching media is relinked.
            const files = restoreFileEntries(snapshot.files, state.sourceFiles, {includeMissing:true});
            recreateGeneratedProjectOverlays(files);
            engine.pause();
            // Prepare missing players before removing the current ones; reuse
            // unchanged players for a trim, move, group or inspector undo.
            const prepared = await prepareHistoryTracks({
                records: snapshot.tracks, existingTracks: state.tracks, sourceFiles: state.sourceFiles,
                loadTrack: (track, file) => engine.loadTrack(track, file),
                disposeTrack: (track) => engine.detachTrack(track, false),
                allowMissingSources:true
            });
            prepared.commit();
            state.files = files;
            state.tracks = prepared.tracks;
            state.selectedTrackIds = new Set(snapshot.selectedTrackIds || []);
            state.selectedTrackId = snapshot.selectedTrackId || [...state.selectedTrackIds][0] || null;
            state.selectedFileId = snapshot.selectedFileId || null;
            if(Array.isArray(snapshot.markers)){
                state.timelineMarkers=[...snapshot.markers];
                timeline.setMarkers(state.timelineMarkers);
            }
            if(snapshot.settings){
                const settings=snapshot.settings;
                elements.canvasWidth.value=String(settings.canvasWidth);
                elements.canvasHeight.value=String(settings.canvasHeight);
                elements.projectFps.value=String(settings.fps);
                engine.setProjectFrameRate(settings.fps);
                state.previewZoom=settings.previewZoom??state.previewZoom;
                applyCanvasResolution();
                syncPreviewZoom();
            }
            renderFiles();
            refreshAll(); // setTracks disposes discarded media objects.
            await Promise.all(state.tracks.map(track=>engine.refreshOrgavoxAudioEffects(track)));
            await engine.seek(Number(snapshot.currentTime) || 0, { resume: false });
        } finally {
            state.historyRestoring = false;
            updateHistoryButtons();
        }
    }

    async function runHistoryStep(from, to, pastTense) {
        if (state.recoveryLoading || state.editorDisposing || state.historyRestoring || !from.length) return;
        const entry = from[from.length - 1];
        const previous = captureHistorySnapshot();
        try {
            await restoreHistorySnapshot(entry.snapshot);
            from.pop();
            to.push({ label: entry.label, snapshot: previous });
            if (to.length > state.history.limit) to.shift();
            pruneSourceRegistry();
            showToast(`${pastTense} ${entry.label}`);
        } catch (error) {
            console.error('MotoriClip history restore failed:', error);
            elements.previewState.textContent = `History restore failed: ${error.message}`;
            showToast('Undo/redo unavailable for this media');
        } finally {
            updateHistoryButtons();
        }
    }
    async function undoTimelineEdit() { await runHistoryStep(state.history.undo, state.history.redo, 'Undid'); }
    async function redoTimelineEdit() { await runHistoryStep(state.history.redo, state.history.undo, 'Redid'); }

    function registerInspectorHistory(control, label) {
        if (!control) return;
        control.addEventListener('pointerdown', () => recordHistory(label));
        control.addEventListener('keydown', (event) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' '].includes(event.key)) recordHistory(label);
        });
    }

    function makeProjectFileDragGhost(entry) {
        const ghost = document.createElement('div');
        ghost.className = `project-file-drag-ghost kind-${entry.kind}`;
        ghost.innerHTML = `<span>${kindLabel(entry.kind)}</span><strong>${escapeHtml(entry.name)}</strong>`;
        document.body.appendChild(ghost);
        return ghost;
    }

    const MEDIA_INDEX_KEY = 'motori-advanced-media-index-v1';
    function persistMediaIndex() {
        // Disk paths cannot be silently restored from browser drag-and-drop.
        // Store only small identifying metadata, never the actual media bytes.
        try {
            const records=state.files.slice(0,400).map(entry=>({
                id:entry.id,name:entry.name,kind:entry.kind,
                size:entry.file?.size ?? entry.size ?? 0,
                lastModified:entry.file?.lastModified ?? entry.lastModified ?? 0,
                relativePath:entry.file?.webkitRelativePath || entry.relativePath || '',
                hiddenFromBin:Boolean(entry.hiddenFromBin)
            }));
            localStorage.setItem(MEDIA_INDEX_KEY,JSON.stringify(records));
        } catch(error) { console.warn('Media index cannot be persisted:',error); }
    }
    function restoreMediaIndex() {
        try {
            const saved=JSON.parse(localStorage.getItem(MEDIA_INDEX_KEY)||'[]');
            if (!Array.isArray(saved)) return;
            state.files=saved.slice(0,400).filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'
                &&['video','audio','sticker','background'].includes(e.kind))
                .map(e=>({id:e.id,name:e.name,kind:e.kind,file:null,
                    size:Number(e.size)||0,lastModified:Number(e.lastModified)||0,
                    relativePath:String(e.relativePath||''),hiddenFromBin:Boolean(e.hiddenFromBin),needsRelink:true}));
        } catch(error) { console.warn('Could not restore media index:',error); }
    }
    function renderFiles() {
        elements.fileList.innerHTML = '';
        const visibleFiles=state.files.filter(entry=>!entry.hiddenFromBin);
        elements.fileCount.textContent = `${visibleFiles.length} media`;
        const unlinked=visibleFiles.filter(entry=>!entry.file).length;
        elements.mediaRememberNote.textContent = unlinked
            ? `${unlinked} remembered · reconnect or reimport` : state.savedFileHandles.size
                ? `${state.savedFileHandles.size} local file handle${state.savedFileHandles.size===1?'':'s'} saved` : 'File names saved · use Import/Browse to remember access';
        persistMediaIndex();
        if (!visibleFiles.length) {
            elements.fileList.innerHTML = state.tracks.length
                ? '<div class="empty-file-list">Media list empty.<br>Timeline sources remain available; import to add files to the bin.</div>'
                : '<div class="empty-file-list">No project files yet.<br>Import or drop media here first.</div>';
            return;
        }
        for (const entry of visibleFiles) {
            const row = document.createElement('div');
            row.className = `file-row kind-${entry.kind}${entry.id === state.selectedFileId ? ' active' : ''}${!entry.file ? ' is-unlinked' : ''}`;
            // Native HTML drag was unreliable after the v0.17 lane update in some Chromium builds.
            // The pointer drag below deliberately owns Project File placement instead.
            row.draggable = false;
            row.tabIndex = 0;
            row.dataset.fileId = entry.id;
            row.title = entry.file ? 'Drag this file to the timeline.' : state.savedFileHandles.has(entry.id)
                ? 'Click to reconnect this saved file handle (browser permission may be required).'
                : 'Only the filename was saved; reimport the original media file.';
            row.innerHTML = `<span class="file-kind">${kindLabel(entry.kind)}</span><span><span class="file-name">${escapeHtml(entry.name)}</span><span class="file-meta">${kindName(entry.kind)} · ${formatFileSize(entry.file?.size ?? entry.size)} · ${entry.file ? 'drag to timeline' : state.savedFileHandles.has(entry.id) ? 'click to reconnect file access' : 'reimport to relink'}</span></span>`;

            let pointerDrag = null;
            let suppressClick = false;

            const clearPointerDrag = () => {
                if (!pointerDrag) return;
                try { row.releasePointerCapture?.(pointerDrag.pointerId); } catch (_) { /* no-op */ }
                pointerDrag.ghost?.remove();
                row.classList.remove('is-dragging');
                timeline.clearProjectFileDropHighlights?.();
                timeline.endProjectFileDrag();
                pointerDrag = null;
            };

            const movePointerDrag = (event) => {
                if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
                const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
                if (!pointerDrag.started && distance < 6) return;
                if (!pointerDrag.started) {
                    pointerDrag.started = true;
                    suppressClick = true;
                    state.selectedFileId = entry.id;
                    timeline.beginProjectFileDrag(entry.id);
                    pointerDrag.ghost = makeProjectFileDragGhost(entry);
                    row.classList.add('is-dragging');
                }
                event.preventDefault();
                pointerDrag.ghost.style.transform = `translate(${Math.round(event.clientX + 14)}px, ${Math.round(event.clientY + 14)}px)`;
                const validTarget = timeline.updateProjectFilePointerDropHover?.(event.clientX, event.clientY);
                pointerDrag.ghost.classList.toggle('can-drop', Boolean(validTarget));
            };

            const finishPointerDrag = (event) => {
                if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
                const wasDragging = pointerDrag.started;
                if (wasDragging) {
                    event.preventDefault();
                    const placed = timeline.dropProjectFileAtPoint?.(entry.id, event.clientX, event.clientY);
                    if (!placed) showToast('Drop Project Files onto the timeline area');
                }
                clearPointerDrag();
                if (wasDragging) setTimeout(() => { suppressClick = false; }, 0);
            };

            row.addEventListener('pointerdown', (event) => {
                if (event.button !== 0 || !entry.file) return;
                pointerDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false, ghost: null };
                row.setPointerCapture?.(event.pointerId);
            });
            row.addEventListener('pointermove', movePointerDrag);
            row.addEventListener('pointerup', finishPointerDrag);
            row.addEventListener('pointercancel', clearPointerDrag);
            row.addEventListener('lostpointercapture', () => {
                if (pointerDrag?.started) clearPointerDrag();
            });
            row.addEventListener('click', () => {
                if (suppressClick) return;
                if (!entry.file) { void reconnectOneRememberedFile(entry); return; }
                state.selectedFileId = entry.id;
                renderFiles();
            });
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (!entry.file) { void reconnectOneRememberedFile(entry); return; }
                    state.selectedFileId = entry.id;
                    renderFiles();
                }
            });
            elements.fileList.appendChild(row);
        }
    }


    function restoreRememberedFileEntry(entry,file) {
        if(!entry || !state.files.includes(entry) || !matchesSavedMediaReference(entry,file,getKind(file)))
            return false;
        entry.file=file;
        entry.needsRelink=false;
        entry.size=file.size;
        entry.lastModified=file.lastModified;
        state.sourceFiles.set(entry.id,file);
        return true;
    }
    async function reconnectOneRememberedFile(entry) {
        const handle=state.savedFileHandles.get(entry.id) || await getMediaHandle(entry.id);
        if(!handle) {
            showToast('This file has no saved handle. Reimport it to restore access.');
            return false;
        }
        state.savedFileHandles.set(entry.id,handle);
        const file=await getPermittedMediaFile(handle,{requestPermission:true});
        if(!file || !restoreRememberedFileEntry(entry,file)) {
            showToast('File permission unavailable or source moved. Reimport the original.');
            return false;
        }
        renderFiles();
        await loadRecoveredMediaTracks();
        showToast(`Reconnected ${entry.name} without copying its contents`);
        return true;
    }
    async function restoreRememberedMediaHandles() {
        // No permission dialogs on page load. A browser may remember read
        // permission from the original picker, otherwise leave it unlinked.
        let linked=0;
        for(const entry of [...state.files].filter(item=>!item.file)){
            const handle=await getMediaHandle(entry.id);
            if(!handle)continue;
            state.savedFileHandles.set(entry.id,handle);
            const file=await getPermittedMediaFile(handle);
            if(file && restoreRememberedFileEntry(entry,file))linked++;
        }
        renderFiles();
        if(linked)await loadRecoveredMediaTracks();
        if(linked)showToast(`Restored ${linked} locally permitted media file${linked===1?'':'s'}`);
        return linked;
    }
    async function reconnectRememberedMedia() {
        const entries=state.files.filter(entry=>!entry.file);
        if(!entries.length){showToast('All imported media files are already accessible');return;}
        let restored=0,requested=false,availableHandles=0;
        for(const entry of entries) {
            const handle=state.savedFileHandles.get(entry.id) || await getMediaHandle(entry.id);
            if(!handle)continue;
            availableHandles++;
            state.savedFileHandles.set(entry.id,handle);
            const permission=typeof handle.queryPermission==='function'
                ? await handle.queryPermission({mode:'read'}).catch(()=> 'prompt') : 'granted';
            const shouldRequest=permission!=='granted' && !requested;
            if(shouldRequest)requested=true;
            const file=await getPermittedMediaFile(handle,{requestPermission:shouldRequest});
            if(file && restoreRememberedFileEntry(entry,file))restored++;
        }
        renderFiles();
        if(restored)await loadRecoveredMediaTracks();
        if(restored)showToast(`Reconnected ${restored} media file${restored===1?'':'s'}`);
        else showToast(availableHandles?'Permission needed: click a remembered file to reconnect, or use Import':'No saved file handles. Choose Import to relink your files.');
    }
    async function importWithFileHandles() {
        if(typeof window.showOpenFilePicker!=='function'){elements.fileInput.click();return;}
        try {
            const handles=await window.showOpenFilePicker({multiple:true});
            const pairs=[];
            for(const handle of handles) {
                if(!isPersistentFileHandle(handle))continue;
                const file=await handle.getFile();
                pairs.push({file,handle});
            }
            await addFiles(pairs.map(pair=>pair.file),pairs.map(pair=>pair.handle));
        } catch(error) {
            if(error?.name==='AbortError')return;
            console.warn('Handle-aware file picker unavailable. Falling back to standard import.',error);
            elements.fileInput.click();
        }
    }

    async function addFiles(files,handles=[]) {
        const usable=[],relinked=[],handleUpdates=[],historicalLinks=[],revealed=[];
        const claimedHistoricalIds=new Set();
        for(const [index,file] of Array.from(files||[]).entries()){
            const kind=getKind(file);
            if(!kind || !FILE_PATTERN.test(file.name))continue;
            const fileHandle=isPersistentFileHandle(handles[index])?handles[index]:null;
            const historicalIds=historicalMediaIdsForFile(
                file,kind,state.history,state.files,state.sourceFiles
            ).filter(id=>!claimedHistoricalIds.has(id));
            if(historicalIds.length){
                historicalIds.forEach(id=>claimedHistoricalIds.add(id));
                historicalLinks.push({file,ids:historicalIds,handle:fileHandle});
            }
            const duplicate=state.files.find(entry=>entry.file && entry.file.name===file.name
                && entry.file.size===file.size && entry.file.lastModified===file.lastModified);
            if(duplicate){
                if(duplicate.hiddenFromBin)revealed.push(duplicate);
                if(fileHandle)handleUpdates.push({entry:duplicate,handle:fileHandle});
                continue;
            }
            const missing=state.files.find(entry=>!entry.file && entry.name===file.name
                && entry.kind===kind && (!entry.size || entry.size===file.size));
            if(missing){ if(missing.hiddenFromBin)revealed.push(missing); relinked.push({entry:missing,file,handle:fileHandle}); }
            else if(!historicalIds.length) usable.push({entry:{
                id:`file-${Date.now()}-${++state.serial}`,file,
                name:file.name,kind,size:file.size,lastModified:file.lastModified
            },handle:fileHandle});
            // A history-only media import is not a new project-bin edit:
            // retain existing Undo and Redo stacks and their stable IDs.
        }
        if(!usable.length&&!relinked.length&&!handleUpdates.length&&!historicalLinks.length&&!revealed.length){
            elements.previewState.textContent='No new or matching media files found.';
            return;
        }
        if(usable.length||relinked.length||revealed.length)recordHistory(`Import/relink ${usable.length+relinked.length+revealed.length} project media file(s)`);
        for(const entry of revealed)entry.hiddenFromBin=false;
        for(const {entry,file,handle} of relinked){
            restoreRememberedFileEntry(entry,file);
            if(handle)handleUpdates.push({entry,handle});
        }
        for(const {entry,handle} of usable){
            state.files.push(entry);
            state.sourceFiles.set(entry.id,entry.file);
            if(handle)handleUpdates.push({entry,handle});
        }
        let historicalCount=0;
        for(const {file,ids,handle} of historicalLinks){
            for(const id of ids){
                state.sourceFiles.set(id,file);
                historicalCount++;
                if(handle)handleUpdates.push({entry:{id},handle});
            }
        }
        let savedHandles=0;
        for(const {entry,handle} of handleUpdates){
            if(await saveMediaHandle(entry.id,handle)){
                state.savedFileHandles.set(entry.id,handle);
                savedHandles++;
            }
        }
        renderFiles();
        await loadRecoveredMediaTracks();
        elements.previewState.textContent=`Media ready: ${usable.length} new, ${relinked.length} relinked, ${historicalCount} history references reconnected`;
        showToast(`${usable.length} imported · ${relinked.length} relinked · ${revealed.length} restored to bin · ${historicalCount} history references${savedHandles?' · '+savedHandles+' remembered handles':''}`);
    }

    function setLibraryView(view) {
        if(!['media','effects','text'].includes(view))return;
        elements.projectDropZone.hidden=view!=='media';
        elements.effectsLibraryPanel.hidden=view!=='effects';
        elements.textLibraryPanel.hidden=view!=='text';
        for(const tab of elements.libraryTabs){
            const current=tab.dataset.libraryTab===view;
            tab.classList.toggle('active',current);
            tab.setAttribute('aria-selected',String(current));
            tab.tabIndex=current?0:-1;
        }
    }
    function registerGeneratedOverlay(preset) {
        const textValue=elements.textOverlayValue.value.trim()||'YOUR TEXT';
        const file=createOverlayFile(preset,textValue);
        const entry={id:`file-${Date.now()}-${++state.serial}`,file,name:file.name,
            kind:'sticker',size:file.size,lastModified:file.lastModified,
            generated:{
                group:preset.group,
                presetId:preset.id,
                value:preset.group==='text'?textValue.slice(0,100):''
            }};
        state.files.push(entry);
        state.sourceFiles.set(entry.id,file);
        renderFiles();
        return entry;
    }
    function buildLibraryPresetCard(preset) {
        const button=document.createElement('button');
        button.type='button';button.className='asset-preset-card';
        if((preset.group==='text'&&preset.animation!=='none')||preset.animated)button.classList.add('is-animated');
        button.draggable=true;
        button.title=`${preset.label}: drag to timeline or click to add at playhead`;
        button.dataset.presetId=preset.id;
        if(preset.group==='text'||preset.animated){
            button.title=preset.animated
                ? `${preset.label}: right-click for animated preview, click or drag to insert; adjust intensity, speed and appearance in Inspector.`
                : `${preset.label}: right-click for animated preview, click or drag to insert. Text and colours are editable in Inspector.`;
            button.addEventListener('contextmenu',event=>{
                event.preventDefault();event.stopPropagation();
                openTextPresetPreview(preset);
            });
        }
        const canvas=document.createElement('canvas');
        canvas.width=288;canvas.height=162;
        if(preset.animated){
            const ctx=canvas.getContext('2d');
            if(requiresCompositeSource(preset.id))paintEffectPreviewScene(ctx,canvas.width,canvas.height);
            paintTimelineEffect(ctx,canvas.width,canvas.height,{presetId:preset.id},1,3);
        }
        else renderOverlayPreset(canvas,preset,elements.textOverlayValue.value.trim()||'MotoriClip');
        const label=document.createElement('span');label.textContent=preset.label;
        button.append(canvas,label);
        let wasDragged=false;
        button.addEventListener('click',()=>{
            if(wasDragged)return;
            const entry=registerGeneratedOverlay(preset);
            void placeProjectFile({fileId:entry.id,laneId:null,laneType:'sticker',start:engine.currentTime})
                .then(()=>showToast(`Added ${preset.label} overlay clip`))
                .catch(error=>showToast(`Overlay unavailable: ${error.message}`));
        });
        button.addEventListener('dragstart',(event)=>{
            if(!event.dataTransfer)return;
            wasDragged=true;
            const entry=registerGeneratedOverlay(preset);
            timeline.beginProjectFileDrag(entry.id);
            event.dataTransfer.setData('application/x-organon-project-file',entry.id);
            event.dataTransfer.setData('text/x-organon-project-file',entry.id);
            event.dataTransfer.effectAllowed='copy';
        });
        button.addEventListener('dragend',()=>{
            timeline.endProjectFileDrag();
            setTimeout(()=>{wasDragged=false;},0);
        });
        return button;
    }
    // The preview is independent of the active editor playhead. Use exact
    // seconds to draw the same title renderer as preview and exported video.
    let textPreviewPreset=null,textPreviewTime=0,textPreviewPlaying=false;
    let textPreviewFrame=0,textPreviewTimestamp=0;
    function stopTextPreview(){
        textPreviewPlaying=false;
        if(textPreviewFrame)cancelAnimationFrame(textPreviewFrame);
        textPreviewFrame=0;
        elements.textPreviewPlay.textContent='▶ Play';
    }
    function drawTextPresetPreview(){
        if(!textPreviewPreset)return;
        const canvas=elements.textPreviewCanvas,ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#0c1722';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle='rgba(117,178,222,.08)';
        for(let x=0;x<640;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,360);ctx.stroke();}
        const input=elements.textOverlayValue.value.trim()||'MotoriClip';
        if(textPreviewPreset.animated){
            if(requiresCompositeSource(textPreviewPreset.id))
                paintEffectPreviewScene(ctx,canvas.width,canvas.height);
            paintTimelineEffect(ctx,640,360,{presetId:textPreviewPreset.id},textPreviewTime,3);
        }
        else paintTimelineText(ctx,640,360,{presetId:textPreviewPreset.id,value:input,
            phasedAnimation:true},textPreviewTime,3);
        elements.textPreviewProgress.value=String(Math.round(textPreviewTime*100));
    }
    function advanceTextPreview(now){
        if(!textPreviewPlaying)return;
        const delta=Math.min(.1,Math.max(0,(now-textPreviewTimestamp)/1000));
        textPreviewTimestamp=now;textPreviewTime+=delta;
        if(textPreviewTime>=3){
            if(elements.textPreviewLoop.checked)textPreviewTime=textPreviewTime%3;
            else {textPreviewTime=3;stopTextPreview();}
        }
        drawTextPresetPreview();
        if(textPreviewPlaying)textPreviewFrame=requestAnimationFrame(advanceTextPreview);
    }
    function openTextPresetPreview(preset){
        stopTextPreview();
        textPreviewPreset=preset;textPreviewTime=0;textPreviewTimestamp=0;
        elements.textPreviewTitle.textContent='Preview · '+preset.label;
        elements.textPreviewModal.hidden=false;
        drawTextPresetPreview();
        elements.textPreviewPlay.focus();
    }
    function closeTextPresetPreview(){
        stopTextPreview();elements.textPreviewModal.hidden=true;
        textPreviewPreset=null;
    }
    elements.textPreviewPlay.addEventListener('click',()=>{
        if(!textPreviewPreset)return;
        if(textPreviewPlaying){stopTextPreview();return;}
        if(textPreviewTime>=3)textPreviewTime=0;
        textPreviewPlaying=true;textPreviewTimestamp=performance.now();
        elements.textPreviewPlay.textContent='⏸ Pause';
        textPreviewFrame=requestAnimationFrame(advanceTextPreview);
    });
    elements.textPreviewRestart.addEventListener('click',()=>{
        textPreviewTime=0;textPreviewTimestamp=performance.now();drawTextPresetPreview();
    });
    elements.textPreviewProgress.addEventListener('input',()=>{
        textPreviewTime=Math.max(0,Math.min(3,Number(elements.textPreviewProgress.value)/100));
        textPreviewTimestamp=performance.now();drawTextPresetPreview();
    });
    elements.textPreviewClose.addEventListener('click',closeTextPresetPreview);
    elements.textPreviewModal.addEventListener('pointerdown',event=>{
        if(event.target===elements.textPreviewModal)closeTextPresetPreview();
    });
    document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&!elements.textPreviewModal.hidden)closeTextPresetPreview();
    });

    for(const [field,catalog] of [
        ['animation',TEXT_ANIMATIONS],['inAnimation',TEXT_ANIMATIONS],
        ['outAnimation',TEXT_OUT_ANIMATIONS],['loopAnimation',TEXT_LOOP_ANIMATIONS]
    ]){
        const select=elements.textInspectorInputs[field];
        for(const [id,label] of catalog){
            const option=document.createElement('option');
            option.value=id;option.textContent=label;select.appendChild(option);
        }
    }
    function showTitleAnimationMode(enabled){
        document.getElementById('text-phased-controls').hidden=!enabled;
        document.getElementById('text-legacy-animation-controls').hidden=enabled;
    }
    const textNumericUnits={
        fontSize:'%',letterSpacing:'px',lineSpacing:'%',textOpacity:'%',outlineWidth:'px',
        shadowBlur:'px',shadowOffsetX:'px',shadowOffsetY:'px',glowStrength:'px',
        backdropOpacity:'%',shapePadding:'px',shapeRadius:'px',shapeBorderWidth:'px',
        bannerWidth:'%',bannerHeight:'px',animationDuration:'s',animationDelay:'s',
        inDuration:'s',outDuration:'s',loopDuration:'s',
        animationSpeed:'×',animationIntensity:'%'
    };
    function refreshTitleNumericLabels(config){
        for(const [key,unit] of Object.entries(textNumericUnits)){
            const kebab=key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
            const label=document.getElementById('text-'+kebab+'-value');
            if(label)label.textContent=String(config[key])+unit;
        }
    }
    for(const [name,input] of Object.entries(elements.textInspectorInputs)){
        const label='Edit title '+name.replace(/([A-Z])/g,' $1');
        registerInspectorHistory(input,label);
        if(name==='value')input.addEventListener('focus',()=>recordHistory('Edit title text'));
        input.addEventListener('input',()=>{
            const track=getTrack();
            if(!track?.textOverlay || state.selectedTrackIds.size!==1)return;
            const updated={...track.textOverlay,[name]:input.type==='checkbox'?input.checked:input.value};
            track.textOverlay=normaliseTextOverlay(updated);
            if(name==='phasedAnimation')showTitleAnimationMode(track.textOverlay.phasedAnimation);
            refreshTitleNumericLabels(track.textOverlay);
            engine.renderFrame();
        });
    }

    function filterEffectCards(){
        const category=elements.effectCategory?.value||'all';
        for(const card of elements.effectsLibraryGrid.children)
            card.hidden=category!=='all'&&card.dataset.effectCategory!==category;
    }
    elements.effectDuration.addEventListener('focus',()=>{
        if(getTrack()?.effectOverlay)recordHistory('Change effect clip duration');
    });
    elements.effectDuration.addEventListener('change',()=>{
        const track=getTrack();
        if(!track?.effectOverlay||state.selectedTrackIds.size!==1)return;
        const value=Number(elements.effectDuration.value);
        if(!Number.isFinite(value)||value<.1){syncInspector();return;}
        track.clipDuration=Math.min(120,Math.max(.1,value));
        refreshAll();
    });
    for(const [name,input] of Object.entries(elements.effectInspectorInputs)){
        input.addEventListener('focus',()=>{
            if(getTrack()?.effectOverlay)recordHistory('Edit timeline effect '+name);
        });
        input.addEventListener('input',()=>{
            const track=getTrack();
            if(!track?.effectOverlay||state.selectedTrackIds.size!==1)return;
            track.effectOverlay=normaliseTimelineEffect({...track.effectOverlay,[name]:input.type==='checkbox'?input.checked:input.value});
            engine.renderFrame();
        });
    }
    function renderLibraryPresets() {
        elements.effectsLibraryGrid.replaceChildren(...[...EFFECT_OVERLAYS,...TIMELINE_EFFECTS].map(buildLibraryPresetCard));
        for(const card of elements.effectsLibraryGrid.children){
            const effect=[...EFFECT_OVERLAYS,...TIMELINE_EFFECTS].find(item=>item.id===card.dataset.presetId);
            card.dataset.effectCategory=effect?.category||'Classic';
        }
        filterEffectCards();
        elements.textLibraryGrid.replaceChildren(...TEXT_PRESETS.map(buildLibraryPresetCard));
    }
    function initAssetLibrary() {
        elements.effectCategory?.addEventListener('change',filterEffectCards);
        for(const button of elements.libraryTabs){
            button.addEventListener('click',()=>setLibraryView(button.dataset.libraryTab));
        }
        elements.textOverlayValue.addEventListener('input',()=>{
            for(const button of elements.textLibraryGrid.querySelectorAll('.asset-preset-card')){
                const preset=TEXT_PRESETS.find(item=>item.id===button.dataset.presetId);
                const canvas=button.querySelector('canvas');
                if(preset&&canvas)renderOverlayPreset(canvas,preset,elements.textOverlayValue.value.trim()||'MotoriClip');
            }
        });
        renderLibraryPresets();
        setLibraryView('media');
    }

    function updateTimeDisplay({ currentTime, duration }) {
        const safeDuration = Math.max(0, Number(duration) || 0);
        const safeCurrent = clamp(Number(currentTime) || 0, 0, safeDuration || Infinity);
        elements.timeReadout.textContent = `${formatTime(safeCurrent)} / ${formatTime(safeDuration)}`;
        if (!state.isSeeking) { elements.previewSeek.max = String(safeDuration); elements.previewSeek.value = String(Math.min(safeCurrent, safeDuration)); }
        elements.previewSeek.disabled = safeDuration <= 0;
        timeline.setCurrentTime(safeCurrent);
        syncVisualInspectorValues();
        elements.previewEmpty.hidden = state.tracks.some((track) => track.type === 'video' && track.sourceName);
    }
    function setPlayButton(isPlaying) { elements.btnPlay.textContent = isPlaying ? '⏸️' : '▶️'; elements.btnPlay.title = isPlaying ? 'Pause preview' : 'Play preview'; }
    function syncPreviewMuteButton() { const muted = engine.previewMuted || engine.previewVolume <= 0; elements.btnPreviewMute.textContent = muted ? '🔇' : '🔊'; }
    function setSwitch(button, on) { button.classList.toggle('on', Boolean(on)); button.setAttribute('aria-pressed', String(Boolean(on))); }

    function selectTrack(trackId, { toggle = false } = {}) {
        if (!trackId) return;
        if (toggle) {
            if (state.selectedTrackIds.has(trackId)) state.selectedTrackIds.delete(trackId);
            else state.selectedTrackIds.add(trackId);
        } else {
            state.selectedTrackIds = new Set([trackId]);
        }
        state.selectedTrackId = state.selectedTrackIds.has(trackId) ? trackId : [...state.selectedTrackIds][0] || null;
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        syncSelectionTools();
        syncInspector();
    }

    function syncSelectionTools() {
        const count = state.selectedTrackIds.size;
        elements.btnSelectionMode.classList.toggle('active', state.selectionMode);
        elements.btnSelectionMode.setAttribute('aria-pressed', String(state.selectionMode));
        elements.btnGroupSelection.disabled = count < 2;
        elements.btnGroupSelection.title = count < 2 ? 'Select two or more clips first' : `Group ${count} selected clips`;
        const snapEligible = count >= 1 && count <= 2 && [...state.selectedTrackIds].every(id => {
            const track = getTrack(id);
            return Boolean(track?.sourceName && Number(track.clipDuration) > 0);
        });
        elements.btnSnapSelected.disabled = !snapEligible;
        elements.btnSnapOptions.disabled = !snapEligible;
        elements.btnSnapSelected.title = count === 2
            ? 'Snap the later selected clip start to the earlier clip end, keeping both on their tracks'
            : 'Snap selected clip START to the playhead; arrow opens alternate snap options';
    }

    function getPairSelection() {
        if (state.selectedTrackIds.size !== 2) return [];
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        return selected.length === 2 && selected.every((track) => track.type === 'video' && track.sourceName && track.file)
            ? selected.sort((a,b) => (Number(a.start)||0)-(Number(b.start)||0) || state.tracks.indexOf(a)-state.tracks.indexOf(b))
            : [];
    }
    function updatePairInspector() {
        const selected = getPairSelection();
        elements.pairTransitionPanel.hidden = selected.length !== 2;
        if(selected.length !== 2)return;
        const [a,b] = selected;
        elements.pairTransitionDescription.textContent = `Video A: ${a.sourceName} → Video B: ${b.sourceName}`;
        const max=Math.min(30,Number(a.clipDuration)||0,Number(b.clipDuration)||0);
        elements.pairTransitionDuration.max=String(Math.max(.1,max));
        const original=Number(elements.pairTransitionDuration.value)||1;
        elements.pairTransitionDuration.value=String(Math.min(Math.max(.1,original),Math.max(.1,max)));
        elements.btnApplyPairTransition.disabled=max<.1;
    }
    const visualPropertyFactor = property => ['transform.scale','transform.opacity'].includes(property)?100:1;
    function syncVisualInspectorValues() {
        const track=getTrack();
        if(!track || state.selectedTrackIds.size!==1 || !VISIBLE_VISUAL_TYPES.has(track.type))return;
        for(const input of elements.visualInputs){
            const property=input.dataset.visualParam;
            const value=visualParameterAt(track,property,engine.currentTime)*visualPropertyFactor(property);
            if(document.activeElement!==input) input.value=String(Number(value.toFixed(2)));
            const output=document.querySelector('[data-visual-output="'+property+'"]');
            const unit=property==='transform.scale'||property==='transform.opacity'?'%'
                :property==='transform.rotation'?'°':property==='transform.x'||property==='transform.y'?'px':'';
            if(output)output.textContent=Number(value.toFixed(1))+unit;
        }
        for(const button of elements.visualKeyframes){
            const property=button.dataset.keyframe;
            const local=clamp(engine.currentTime-(Number(track.start)||0),0,Math.max(0,Number(track.clipDuration)||0));
            const active=(track.keyframes?.[property]||[]).some(frame=>Math.abs(frame.time-local)<.03);
            button.classList.toggle('active',active);
            button.textContent=active?'◆':'◇';
            button.setAttribute('aria-pressed',String(active));
        }
        elements.visualBlendMode.value=track.blendMode||'source-over';
        const speed=clamp(Number(track.speed)||1,.25,4);
        elements.visualSpeed.value=String(Math.round(speed*100));
        elements.visualSpeedValue.textContent=speed.toFixed(2)+'×';
        elements.visualSpeedDuration.textContent=formatSeconds(track.clipDuration);
    }
    function updateVisualProperty(input) {
        const track=getTrack(),property=input.dataset.visualParam;
        if(!track || !VISIBLE_VISUAL_TYPES.has(track.type) || !property)return;
        let raw=Number(input.value);
        if(!Number.isFinite(raw))return;
        const group=property.split('.')[0],key=property.split('.')[1];
        const value=raw/visualPropertyFactor(property);
        if((track.keyframes?.[property]||[]).length){
            upsertVisualKeyframe(track,property,engine.currentTime,value);
        } else {
            track[group] ||= {};
            track[group][key]=value;
        }
        engine.renderFrame();
        syncVisualInspectorValues();
    }
    function toggleVisualKeyframe(button) {
        const track=getTrack(),property=button.dataset.keyframe;
        if(!track || !VISIBLE_VISUAL_TYPES.has(track.type))return;
        const local=clamp(engine.currentTime-(Number(track.start)||0),0,Math.max(0,Number(track.clipDuration)||0));
        const existing=(track.keyframes?.[property]||[]).some(frame=>Math.abs(frame.time-local)<.03);
        const value=visualParameterAt(track,property,engine.currentTime);
        recordHistory(`${existing?'Remove':'Add'} ${property} keyframe`);
        upsertVisualKeyframe(track,property,engine.currentTime,value,{remove:existing});
        syncVisualInspectorValues();
        engine.renderFrame();
    }
    function updateVisualSpeed() {
        const track=getTrack();
        if(track?.type!=='video'||!track.file)return;
        const requested=clamp(Number(elements.visualSpeed.value)/100,.25,4);
        const previous=clamp(Number(track.speed)||1,.25,4);
        if(Math.abs(requested-previous)<.001)return;
        const nextDuration=Math.max(.15,Math.min(
            (Number(track.clipDuration)||1)*previous/requested,
            Math.max(.15,(Number(track.sourceDuration)||1)-(Number(track.sourceOffset)||0))/requested));
        const nextEnd=(Number(track.start)||0)+nextDuration;
        const blocked=state.tracks.some(other=>other.id!==track.id && other.sourceName
            && other.laneId===track.laneId
            && (Number(track.start)||0)<(Number(other.start)||0)+(Number(other.clipDuration)||0)-.001
            && nextEnd>(Number(other.start)||0)+.001);
        if(blocked){
            elements.visualSpeed.value=String(previous*100);
            showToast('Speed change blocked: clip would overlap a neighbour');
            return;
        }
        track.speed=requested;
        track.clipDuration=nextDuration;
        if(track.media && 'playbackRate' in track.media)track.media.playbackRate=requested;
        refreshAll();
        syncVisualInspectorValues();
        showToast(`Clip playback speed ${requested.toFixed(2)}× · ${formatSeconds(nextDuration)}`);
    }

    function syncOrgavoxAudioInspector(track) {
        if (!track || !['video','audio'].includes(track.type)) return;
        const prefix=track.type==='video'?'video':'audio';
        const fx=normalizeOrgavoxFx(track.audio?.fx);
        for(const [kind,preset] of Object.entries(fx)) {
            const input=document.getElementById(prefix+'-orgavox-'+kind);
            if(input)input.value=preset;
        }
        const active=Object.values(fx).filter(value=>value!=='off').length;
        const count=document.getElementById(prefix+'-orgavox-fx-count');
        if(count)count.textContent=active ? active+' active' : 'Off';
    }

    function syncInspector() {
        const track = getTrack();
        const multiple = state.selectedTrackIds.size > 1;
        elements.inspectorKind.textContent = multiple ? `${state.selectedTrackIds.size} selected` : (track ? track.laneLabel || track.label : 'Project');
        elements.inspectorProject.hidden = Boolean(track) && !multiple;
        elements.inspectorVideo.hidden = multiple || track?.type !== 'video';
        elements.inspectorBackground.hidden = multiple || track?.type !== 'background';
        elements.inspectorAudio.hidden = multiple || track?.type !== 'audio';
        elements.inspectorSticker.hidden = multiple || track?.type !== 'sticker';
        elements.textInspector.hidden=multiple||!track?.textOverlay;
        elements.effectInspector.hidden=multiple||!track?.effectOverlay;
        const isStarburst=track?.effectOverlay?.presetId==='starburst';
        const isLightSweep=track?.effectOverlay?.presetId==='light-sweep';
        const isCameraFrame=track?.effectOverlay?.presetId==='camera-frame';
        const isMistFog=track?.effectOverlay?.presetId==='mist-fog-bank';
        const isTVStatic=track?.effectOverlay?.presetId==='tv-static';
        const isSignalInterference=track?.effectOverlay?.presetId==='signal-interference';
        const isCRTScanlines=track?.effectOverlay?.presetId==='crt-scanlines';
        const isDataBurst=track?.effectOverlay?.presetId==='data-burst';
        const isSignalTear=track?.effectOverlay?.presetId==='signal-tear';
        const isRGBBlockGlitch=track?.effectOverlay?.presetId==='rgb-block-glitch';
        const isLineCorruption=track?.effectOverlay?.presetId==='line-corruption';
        const isElectricSparks=track?.effectOverlay?.presetId==='particle-sparks';
        const isFlyingDebris=track?.effectOverlay?.presetId==='particle-debris';
        const isFireExplosion=track?.effectOverlay?.presetId==='fire-explosion';
        const isFaultCassette=track?.effectOverlay?.presetId==='fault-cassette';
        const isRippleDistortion=track?.effectOverlay?.presetId==='ripple-distortion';
        const isElectricRipple=track?.effectOverlay?.presetId==='electric-ripple';
        const isShockwave=track?.effectOverlay?.presetId==='shockwave';
        document.getElementById('effect-tv-static-controls').hidden=!isTVStatic;
        document.getElementById('effect-signal-interference-controls').hidden=!isSignalInterference;
        document.getElementById('effect-crt-scanlines-controls').hidden=!isCRTScanlines;
        document.getElementById('effect-data-burst-controls').hidden=!isDataBurst;
        document.getElementById('effect-signal-tear-controls').hidden=!isSignalTear;
        document.getElementById('effect-rgb-block-glitch-controls').hidden=!isRGBBlockGlitch;
        document.getElementById('effect-line-corruption-controls').hidden=!isLineCorruption;
        document.getElementById('effect-electric-sparks-controls').hidden=!isElectricSparks;
        document.getElementById('effect-flying-debris-controls').hidden=!isFlyingDebris;
        document.getElementById('effect-fire-explosion-controls').hidden=!isFireExplosion;
        document.getElementById('effect-fault-cassette-controls').hidden=!isFaultCassette;
        document.getElementById('effect-ripple-distortion-controls').hidden=!isRippleDistortion;
        document.getElementById('effect-electric-ripple-controls').hidden=!isElectricRipple;
        document.getElementById('effect-shockwave-controls').hidden=!isShockwave;
        document.getElementById('effect-color-control').hidden=isTVStatic||isSignalInterference||isCRTScanlines||isDataBurst||isSignalTear||isRGBBlockGlitch;
        document.getElementById('effect-mist-fog-controls').hidden=!isMistFog;
        document.getElementById('effect-starburst-controls').hidden=!isStarburst;
        document.getElementById('effect-camera-frame-controls').hidden=!isCameraFrame;
        document.getElementById('effect-density-control').hidden=isStarburst||isCameraFrame||isCRTScanlines;
        document.getElementById('effect-scale-control').hidden=isStarburst||isCameraFrame||isTVStatic||isSignalInterference||isCRTScanlines||isDataBurst||isSignalTear||isRGBBlockGlitch||isLineCorruption;
        document.getElementById('effect-direction-control').hidden=isCameraFrame||isTVStatic||isSignalInterference||isCRTScanlines||isDataBurst||isSignalTear||isRGBBlockGlitch||isLineCorruption;
        document.getElementById('effect-intensity-label').textContent=isCameraFrame?'HUD opacity (%)':isStarburst?'Opacity (%)':isMistFog?'Fog opacity (%)':isTVStatic?'Snow opacity (%)':isSignalInterference?'Signal strength (%)':isCRTScanlines?'Raster strength (%)':isDataBurst?'Packet corruption (%)':isFaultCassette?'Tape tracking intensity (%)':isLineCorruption?'Line damage strength (%)':isRGBBlockGlitch?'RGB block strength (%)':isSignalTear?'Tear intensity (%)':'Intensity (%)';
        document.getElementById('effect-direction-label').textContent=isShockwave?'Shock front drift (°)':isElectricRipple?'Electrical wave drift (°)':isRippleDistortion?'Water ripple drift direction (°)':isFaultCassette?'Tracking drift direction (°)':isFireExplosion?'Blast wind direction (°)':isFlyingDebris?'Wind direction (°)':isElectricSparks?'Arc direction (°)':isStarburst?'Starting angle (°)':isMistFog?'Wind direction (°)':'Direction (°)';
        document.getElementById('effect-color-label').textContent=isShockwave?'Compression front tint':isElectricRipple?'Electrical discharge colour':isRippleDistortion?'Water crest highlight colour':isFaultCassette?'Tape dropout tint':isFireExplosion?'Hot core colour':isFlyingDebris?'Debris material colour':isElectricSparks?'Arc glow colour':isCameraFrame?'HUD line colour':isStarburst?'Primary ray colour':isLineCorruption?'Primary streak colour':isMistFog?'Mist colour':'Colour';
        document.getElementById('effect-density-label').textContent=isShockwave?'Aftershock density':isElectricRipple?'Electrical pulse frequency':isRippleDistortion?'Ripple impact density':isFaultCassette?'Tracking fault frequency':isFireExplosion?'Plume lobe count':isFlyingDebris?'Fragment count':isElectricSparks?'Active spark density':isLightSweep?'Highlight detail':isMistFog?'Fog density':isTVStatic?'Static coverage':isSignalInterference?'Interference frequency':isDataBurst?'Packet density':isLineCorruption?'Corruption frequency':isRGBBlockGlitch?'Block burst frequency':isSignalTear?'Tear frequency':'Density';
        document.getElementById('effect-scale-label').textContent=isShockwave?'Shockwave reach (%)':isElectricRipple?'Electrical front reach (%)':isRippleDistortion?'Ripple expansion scale (%)':isFaultCassette?'Tracking band size (%)':isFireExplosion?'Blast size (%)':isFlyingDebris?'Shard size (%)':isElectricSparks?'Spark reach (%)':isLightSweep?'Beam width (%)':isMistFog?'Bank spread (%)':'Scale (%)';
        document.getElementById('effect-distortion-label').textContent=isShockwave?'Source refraction (%)':isElectricRipple?'Electrical displacement (%)':isRippleDistortion?'Water refraction (%)':isFaultCassette?'Tape displacement (%)':isFireExplosion?'Fireball turbulence (%)':isFlyingDebris?'Air turbulence (%)':isElectricSparks?'Arc jaggedness (%)':isMistFog?'Rolling turbulence (%)':isSignalInterference?'Horizontal displacement (%)':isLineCorruption?'Source line displacement (%)':isRGBBlockGlitch?'Block displacement (%)':isSignalTear?'Horizontal tear shift (%)':'Distortion (%)';
        document.getElementById('effect-blur-label').textContent=isLightSweep?'Beam softness (px)':isMistFog?'Edge feathering (%)':'Blur (px)';
        document.getElementById('effect-origin-controls').hidden=
            !['god-rays','ripple-distortion','electric-ripple','pendulum-swing','rebound-swing','shockwave','halo-blur','fire-explosion','particle-sparks','particle-debris','hazy-atmosphere','sci-fi-scan','fire-flames','engine-heat','retro-glitch','light-leaks','starburst','particle-sparks','fire-explosion','electric-ripple'].includes(track?.effectOverlay?.presetId);
        document.getElementById('effect-distortion-control').hidden=
            isTVStatic||isCRTScanlines||isDataBurst||!(['pendulum-swing','rebound-swing','vibration-flash','fault-cassette',
              'ripple-distortion','electric-ripple','shockwave','chromatic-quirk','hazy-atmosphere','mist-fog-bank','sci-fi-scan','fire-flames','engine-heat','light-leaks','god-rays','particle-sparks','particle-debris','fire-explosion'].includes(track?.effectOverlay?.presetId)
              || TIMELINE_EFFECTS.some(item=>item.id===track?.effectOverlay?.presetId&&item.category==='Glitch'));
        document.getElementById('effect-glow-control').hidden=
            !['glow','edge-glow','halo-blur','light-sweep','hazy-atmosphere','sci-fi-scan','fire-flames','engine-heat','retro-glitch','light-leaks','starburst','particle-sparks','fire-explosion','electric-ripple'].includes(track?.effectOverlay?.presetId);
        document.getElementById('effect-blur-control').hidden=
            !['glow','edge-glow','halo-blur','light-sweep','mist-fog-bank','fire-flames','engine-heat','light-leaks','god-rays'].includes(track?.effectOverlay?.presetId);
        if(!multiple&&track?.effectOverlay){
            elements.effectDuration.value=String(track.clipDuration||3);
            const effect=normaliseTimelineEffect(track.effectOverlay);
            for(const [name,input] of Object.entries(elements.effectInspectorInputs)){
                if(effect[name]!==undefined)input.value=String(effect[name]);
            }
        }
        if(!multiple&&track?.textOverlay){
            const config=normaliseTextOverlay(track.textOverlay);
            const design=TEXT_PRESETS.find(item=>item.id===config.presetId);
            elements.textSelectedDesign.textContent=(design?.label||'Title')+' · edit this clip without replacing its template';
            // The four layout-specific animations must not be selectable on
            // unrelated title types: a dormant effect is worse than an
            // intentionally disabled option.
            const requiredLayouts={
                'handwriting-reveal':'handwriting',
                'location-drop':'location',
                'countdown-roll':'countdown',
                'split-enter':'split'
            };
            for(const field of ['animation','inAnimation','outAnimation','loopAnimation']){
                for(const option of elements.textInspectorInputs[field].options){
                    const required=requiredLayouts[option.value];
                    option.disabled=Boolean(required&&required!==design?.layout);
                    option.title=option.disabled?'Available on the matching title template only':'';
                }
            }
            for(const [name,input] of Object.entries(elements.textInspectorInputs)){
                if(input.type==='checkbox')input.checked=Boolean(config[name]);
                else input.value=String(config[name]);
            }
            showTitleAnimationMode(config.phasedAnimation);
            document.getElementById('text-subtitle-row').hidden=config.presetId!=='news-lower-third';
            refreshTitleNumericLabels(config);
        }
        updatePairInspector();
        elements.visualTools.hidden = !track || multiple || !VISIBLE_VISUAL_TYPES.has(track.type);
        elements.visualSpeedPanel.hidden = track?.type !== 'video';
        if (!track || multiple) return;
        syncOrgavoxAudioInspector(track);
        if (track.type === 'video') {
            const opacity = Math.round((track.opacity ?? 1) * 100);
            elements.selectedVideoName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.videoVisibleSwitch, track.visible !== false);
            setSwitch(elements.videoAudioSwitch, !track.audio.muted);
            elements.videoAudioVolume.value = String(Math.round(track.audio.volume * 100));
            elements.videoAudioVolumeValue.textContent = `${Math.round(track.audio.volume * 100)}%`;
            elements.videoAudioGain.value = String(Math.round(track.audio.gain || 0));
            elements.videoAudioGainValue.textContent = `+${Math.round(track.audio.gain || 0)}% · ${Math.round(track.audio.volume * 100 + (track.audio.gain || 0))}% total`;
            elements.videoOpacity.value = String(opacity); elements.videoOpacityValue.textContent = `${opacity}%`;
            elements.videoBlendMode.value = track.blendMode || 'source-over'; elements.btnExtractAudio.disabled = !track.file;
            const transitions=normalizeVisualTransitions(track.visualTransitions);
            const maxFade=Math.min(30,Math.max(0,Number(track.clipDuration)||0));
            for(const [edge,slider,label,curve] of [
                ['enter',elements.videoTransitionEnter,elements.videoTransitionEnterValue,elements.videoTransitionEnterCurve],
                ['exit',elements.videoTransitionExit,elements.videoTransitionExitValue,elements.videoTransitionExitCurve]
            ]){
                slider.max=String(maxFade);
                slider.value=String(Math.min(maxFade,fadeDuration(track,edge)));
                label.textContent=formatSeconds(fadeDuration(track,edge));
                curve.value=transitions[edge].curve;
            }
            elements.videoTransitionSummary.textContent=`Entrance ${formatSeconds(fadeDuration(track,'enter'))} · Exit ${formatSeconds(fadeDuration(track,'exit'))}`;
            const from = state.tracks.find((other)=>other.id===track.transitionFromId);
            const paired=Boolean(from&&isPairedFadeActive(track,state.tracks));
            elements.videoTransitionPairNote.hidden=!paired;
            elements.btnUnpairTransition.hidden=!paired;
            const spiralInspector=document.getElementById('video-spiral-settings');
            spiralInspector.hidden=!(paired&&track.transitionEffectId==='spiralblockwipe');
            if(!spiralInspector.hidden)
                displaySpiralBlockSettings(spiralInspector,track.transitionParameters?.spiralblockwipe);
            const hologramInspector=document.getElementById('video-hologram-settings');
            hologramInspector.hidden=!(paired&&track.transitionEffectId==='hologram');
            if(!hologramInspector.hidden)
                displayHologramSettings(hologramInspector,track.transitionParameters?.hologram);
            const cellInspector=document.getElementById('video-cell-dissolve-settings');
            cellInspector.hidden=!(paired&&track.transitionEffectId==='cell-dissolve');
            if(!cellInspector.hidden)
                displayCellDissolveSettings(cellInspector,track.transitionParameters?.['cell-dissolve']);
            const vortexInspector=document.getElementById('video-vortex-settings');
            vortexInspector.hidden=!(paired&&track.transitionEffectId==='vortex');
            if(!vortexInspector.hidden)
                displayVortexSettings(vortexInspector,track.transitionParameters?.vortex);
            const crumpleInspector=document.getElementById('video-crumple-settings');
            crumpleInspector.hidden=!(paired&&track.transitionEffectId==='crumple');
            if(!crumpleInspector.hidden)
                displayCrumpleSettings(crumpleInspector,track.transitionParameters?.crumple);
            const liquidFillInspector=document.getElementById('video-liquid-fill-settings');
            liquidFillInspector.hidden=!(paired&&track.transitionEffectId==='liquid-fill');
            if(!liquidFillInspector.hidden)
                displayLiquidFillSettings(liquidFillInspector,track.transitionParameters?.['liquid-fill']);
            const heatHazeInspector=document.getElementById('video-heat-haze-settings');
            heatHazeInspector.hidden=!(paired&&track.transitionEffectId==='heat-haze');
            if(!heatHazeInspector.hidden)
                displayHeatHazeSettings(heatHazeInspector,track.transitionParameters?.['heat-haze']);
            const sphereInspector=document.getElementById('video-sphere-settings');
            sphereInspector.hidden=!(paired&&track.transitionEffectId==='sphere');
            if(!sphereInspector.hidden)
                displaySphereSettings(sphereInspector,track.transitionParameters?.sphere);
            const ringsWipeInspector=document.getElementById('video-rings-wipe-settings');
            ringsWipeInspector.hidden=!(paired&&track.transitionEffectId==='rings-wipe');
            if(!ringsWipeInspector.hidden)
                displayRingsWipeSettings(ringsWipeInspector,track.transitionParameters?.['rings-wipe']);
            const snapshotInspector=document.getElementById('video-snapshot-settings');
            snapshotInspector.hidden=!(paired&&track.transitionEffectId==='snapshot');
            if(!snapshotInspector.hidden)
                displaySnapshotSettings(snapshotInspector,track.transitionParameters?.snapshot);
            const colorPanelWipeInspector=document.getElementById('video-color-panel-wipe-settings');
            colorPanelWipeInspector.hidden=!(paired&&track.transitionEffectId==='color-panel-wipe');
            if(!colorPanelWipeInspector.hidden)
                displayColorPanelWipeSettings(colorPanelWipeInspector,track.transitionParameters?.['color-panel-wipe']);
            const galleryInspector=document.getElementById('video-gallery-settings');
            galleryInspector.hidden=!(paired&&track.transitionEffectId==='gallery');
            if(!galleryInspector.hidden)
                displayGallerySettings(galleryInspector,track.transitionParameters?.gallery);
            const vhsTrackingInspector=document.getElementById('video-vhs-tracking-settings');
            vhsTrackingInspector.hidden=!(paired&&track.transitionEffectId==='vhs-tracking');
            if(!vhsTrackingInspector.hidden)
                displayVhsTrackingSettings(vhsTrackingInspector,track.transitionParameters?.['vhs-tracking']);
            const cardSwipeInspector=document.getElementById('video-card-swipe-settings');
            cardSwipeInspector.hidden=!(paired&&track.transitionEffectId==='card-swipe');
            if(!cardSwipeInspector.hidden)
                displayCardSwipeSettings(cardSwipeInspector,track.transitionParameters?.['card-swipe']);
            const cameraShakeInspector=document.getElementById('video-camera-shake-settings');
            cameraShakeInspector.hidden=!(paired&&track.transitionEffectId==='camera-shake');
            if(!cameraShakeInspector.hidden)
                displayCameraShakeSettings(cameraShakeInspector,track.transitionParameters?.['camera-shake']);
            const smokeDissolveInspector=document.getElementById('video-smoke-dissolve-settings');
            smokeDissolveInspector.hidden=!(paired&&track.transitionEffectId==='smoke-dissolve');
            if(!smokeDissolveInspector.hidden)
                displaySmokeDissolveSettings(smokeDissolveInspector,track.transitionParameters?.['smoke-dissolve']);
            const splatterWipeInspector=document.getElementById('video-splatter-wipe-settings');
            splatterWipeInspector.hidden=!(paired&&track.transitionEffectId==='splatter-wipe');
            if(!splatterWipeInspector.hidden)
                displaySplatterWipeSettings(splatterWipeInspector,track.transitionParameters?.['splatter-wipe']);
            const inkBleedInspector=document.getElementById('video-ink-bleed-settings');
            inkBleedInspector.hidden=!(paired&&track.transitionEffectId==='ink-bleed');
            if(!inkBleedInspector.hidden)
                displayInkBleedSettings(inkBleedInspector,track.transitionParameters?.['ink-bleed']);
            const refractionInspector=document.getElementById('video-refraction-settings');
            refractionInspector.hidden=!(paired&&track.transitionEffectId==='refraction');
            if(!refractionInspector.hidden)
                displayRefractionSettings(refractionInspector,track.transitionParameters?.['refraction']);
            const whipspinInspector=document.getElementById('video-whipspin-settings');
            whipspinInspector.hidden=!(paired&&track.transitionEffectId==='whipspin');
            if(!whipspinInspector.hidden)
                displayWhipSpinSettings(whipspinInspector,track.transitionParameters?.['whipspin']);
            const paperTearInspector=document.getElementById('video-paper-tear-settings');
            paperTearInspector.hidden=!(paired&&track.transitionEffectId==='paper-tear');
            if(!paperTearInspector.hidden)
                displayPaperTearSettings(paperTearInspector,track.transitionParameters?.['paper-tear']);
            const apertureWipeInspector=document.getElementById('video-aperture-wipe-settings');
            apertureWipeInspector.hidden=!(paired&&track.transitionEffectId==='aperture-wipe');
            if(!apertureWipeInspector.hidden)
                displayApertureWipeSettings(apertureWipeInspector,track.transitionParameters?.['aperture-wipe']);
            const spiralWipeInspector=document.getElementById('video-spiral-wipe-settings');
            spiralWipeInspector.hidden=!(paired&&track.transitionEffectId==='spiral-wipe');
            if(!spiralWipeInspector.hidden)
                displaySpiralWipeSettings(spiralWipeInspector,track.transitionParameters?.['spiral-wipe']);
            const prismsInspector=document.getElementById('video-prisms-settings');
            prismsInspector.hidden=!(paired&&track.transitionEffectId==='prisms');
            if(!prismsInspector.hidden)
                displayPrismsSettings(prismsInspector,track.transitionParameters?.['prisms']);
            const cubeInspector=document.getElementById('video-cube-settings');
            cubeInspector.hidden=!(paired&&track.transitionEffectId==='cube');
            if(!cubeInspector.hidden)
                displayCubeSettings(cubeInspector,track.transitionParameters?.['cube']);
            const crosshatchInspector=document.getElementById('video-cross-hatch-settings');
            crosshatchInspector.hidden=!(paired&&track.transitionEffectId==='cross-hatch');
            if(!crosshatchInspector.hidden)
                displayCrosshatchSettings(crosshatchInspector,track.transitionParameters?.['cross-hatch']);
            const glitchFlickerInspector=document.getElementById('video-glitch-flicker-settings');
            glitchFlickerInspector.hidden=!(paired&&track.transitionEffectId==='glitch-flicker');
            if(!glitchFlickerInspector.hidden)
                displayGlitchFlickerSettings(glitchFlickerInspector,track.transitionParameters?.['glitch-flicker']);
            const pixelizeInspector=document.getElementById('video-pixelize-settings');
            pixelizeInspector.hidden=!(paired&&track.transitionEffectId==='pixelize');
            if(!pixelizeInspector.hidden)
                displayPixelizeSettings(pixelizeInspector,track.transitionParameters?.pixelize);
            const randomSquaresInspector=document.getElementById('video-random-squares-settings');
            randomSquaresInspector.hidden=!(paired&&track.transitionEffectId==='random-squares');
            if(!randomSquaresInspector.hidden)
                displayRandomSquaresSettings(randomSquaresInspector,track.transitionParameters?.['random-squares']);
            const rippleInspector=document.getElementById('video-ripple-settings');
            rippleInspector.hidden=!(paired&&track.transitionEffectId==='ripple');
            if(!rippleInspector.hidden)
                displayRippleSettings(rippleInspector,track.transitionParameters?.ripple);
            const tvTurnOffInspector=document.getElementById('video-tv-turn-off-settings');
            tvTurnOffInspector.hidden=!(paired&&track.transitionEffectId==='tv-turn-off');
            if(!tvTurnOffInspector.hidden)
                displayTvTurnOffSettings(tvTurnOffInspector,track.transitionParameters?.['tv-turn-off']);
            const bloomDissolveInspector=document.getElementById('video-bloom-dissolve-settings');
            bloomDissolveInspector.hidden=!(paired&&track.transitionEffectId==='bloom-dissolve');
            if(!bloomDissolveInspector.hidden)
                displayBloomDissolveSettings(bloomDissolveInspector,track.transitionParameters?.['bloom-dissolve']);
            const bokehDissolveInspector=document.getElementById('video-bokeh-dissolve-settings');
            bokehDissolveInspector.hidden=!(paired&&track.transitionEffectId==='bokeh-dissolve');
            if(!bokehDissolveInspector.hidden)
                displayBokehDissolveSettings(bokehDissolveInspector,track.transitionParameters?.['bokeh-dissolve']);
            const lightRaysInspector=document.getElementById('video-light-rays-settings');
            lightRaysInspector.hidden=!(paired&&track.transitionEffectId==='light-rays');
            if(!lightRaysInspector.hidden)
                displayLightRaysSettings(lightRaysInspector,track.transitionParameters?.['light-rays']);
            const blockCoverInspector=document.getElementById('video-block-cover-settings');
            blockCoverInspector.hidden=!(paired&&track.transitionEffectId==='block-cover');
            if(!blockCoverInspector.hidden)
                displayBlockCoverSettings(blockCoverInspector,track.transitionParameters?.['block-cover']);
            const disintegrateInspector=document.getElementById('video-disintegrate-settings');
            disintegrateInspector.hidden=!(paired&&track.transitionEffectId==='disintegrate');
            if(!disintegrateInspector.hidden)
                displayDisintegrateSettings(disintegrateInspector,track.transitionParameters?.disintegrate);
            const asciiInspector=document.getElementById('video-ascii-settings');
            asciiInspector.hidden=!(paired&&track.transitionEffectId==='ascii');
            if(!asciiInspector.hidden)
                displayAsciiSettings(asciiInspector,track.transitionParameters?.ascii);
            const filmStripInspector=document.getElementById('video-film-strip-settings');
            filmStripInspector.hidden=!(paired&&track.transitionEffectId==='film-strip');
            if(!filmStripInspector.hidden)
                displayFilmStripSettings(filmStripInspector,track.transitionParameters?.['film-strip']);
            if(paired){
                const effect=TRANSITION_CATALOG.find(item=>item.id===track.transitionEffectId);
                elements.videoTransitionPairNote.textContent=`✦ Paired ${effect?.label||'transition'} from ${from.sourceName} · ${formatSeconds(fadeDuration(track,'enter'))} overlap`;
            }
        }
        if (track.type === 'background') {
            const opacity = Math.round((track.opacity ?? 1) * 100);
            elements.selectedBackgroundName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.backgroundVisibleSwitch, track.visible !== false);
            elements.backgroundOpacity.value = String(opacity); elements.backgroundOpacityValue.textContent = `${opacity}%`;
            elements.backgroundBlendMode.value = track.blendMode || 'source-over';
        }
        if (track.type === 'audio') {
            const duration = Math.max(.1, Number(track.clipDuration) || 0);
            const fadeIn = clamp(Number(track.audio.fadeIn) || 0, 0, duration);
            const fadeOut = clamp(Number(track.audio.fadeOut) || 0, 0, duration);
            elements.selectedAudioName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.audioAuditionSwitch, !track.audio.muted);
            elements.audioTrackVolume.value = String(Math.round(track.audio.volume * 100)); elements.audioTrackVolumeValue.textContent = `${Math.round(track.audio.volume * 100)}%`;
            elements.audioTrackGain.value = String(Math.round(track.audio.gain || 0));
            elements.audioTrackGainValue.textContent = `+${Math.round(track.audio.gain || 0)}% · ${Math.round(track.audio.volume * 100 + (track.audio.gain || 0))}% total`;
            elements.audioFadeIn.max = String(duration); elements.audioFadeIn.value = String(fadeIn); elements.audioFadeInValue.textContent = formatSeconds(fadeIn);
            elements.audioFadeOut.max = String(duration); elements.audioFadeOut.value = String(fadeOut); elements.audioFadeOutValue.textContent = formatSeconds(fadeOut);
        }
        if (track.type === 'sticker') {
            const settings = track.transparency;
            const opacity = Math.round((track.opacity ?? 1) * 100);
            elements.selectedStickerName.textContent = track.sourceName || track.laneLabel;
            setSwitch(elements.stickerVisibleSwitch, track.visible !== false);
            elements.stickerOpacity.value = String(opacity); elements.stickerOpacityValue.textContent = `${opacity}%`;
            elements.stickerBlendMode.value = track.blendMode || 'source-over';
            elements.stickerTransparencyMode.value = settings.mode || 'native';
            elements.stickerKeyColour.value = settings.keyColour || '#00ff00'; elements.stickerKeyColourText.value = settings.keyColour || '#00ff00';
            elements.stickerKeyTolerance.value = String(settings.tolerance ?? 30); elements.stickerKeyToleranceValue.textContent = `${settings.tolerance ?? 30}%`;
            elements.stickerEdgeFeather.value = String(settings.feather ?? 8); elements.stickerEdgeFeatherValue.textContent = `${settings.feather ?? 8}%`;
        }
        syncVisualInspectorValues();
    }

    function refreshAll() {
        // Moving/trimming or deleting a paired clip must never leave an orphan
        // "linked" label. Independent visual fade settings remain intact.
        for(const track of state.tracks){
            if(track.transitionFromId && state.tracks.some(other=>
                    (other.id===track.transitionFromId||other.id===track.id)&&other.sourceName&&!other.file)) continue;
            if(track.transitionFromId&&!isPairedFadeActive(track,state.tracks)){
                track.transitionFromId=null;
                track.transitionEffectId=null;
            }
        }
        state.selectedTrackIds = new Set([...state.selectedTrackIds].filter((id) => state.tracks.some((track) => track.id === id)));
        if (!state.selectedTrackIds.has(state.selectedTrackId)) state.selectedTrackId = [...state.selectedTrackIds][0] || null;
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        syncSelectionTools();
        syncInspector();
    }

    async function loadTrackFromFile(track, entry, start = 0, { removeOnFailure = false } = {}) {
        track.start = Math.max(0, Number(start) || 0);
        track.sourceFileId = entry.id || track.sourceFileId || state.files.find((item) => item.file === entry.file)?.id;
        if (track.sourceFileId && entry.file) state.sourceFiles.set(track.sourceFileId, entry.file);
        try {
            await engine.loadTrack(track, entry.file);
            if(entry.generated?.group==='text' && TEXT_PRESETS.some(p=>p.id===entry.generated.presetId)
                && !track.textOverlay){
                // Generated PNG is a portable fallback; actual text stays
                // editable and animates at playhead time in renderFrame().
                track.textOverlay=normaliseTextOverlay({
                    presetId:entry.generated.presetId,value:entry.generated.value||'MotoriClip',
                    phasedAnimation:true
                });
            }
            if(entry.generated?.group==='effect' && TIMELINE_EFFECTS.some(p=>p.id===entry.generated.presetId)
                && !track.effectOverlay){
                track.effectOverlay=normaliseTimelineEffect({presetId:entry.generated.presetId});
            }
            if (!state.tracks.includes(track)) {
                engine.detachTrack(track, false);
                return;
            }
            if (!track.clipDuration) track.clipDuration = (track.type === 'sticker' || track.type === 'background') ? 3 : track.sourceDuration || 1;
            fitInsertedClipToLane(track);
            refreshAll(); selectTrack(track.id);
            elements.previewState.textContent = `Loaded ${entry.name}`;
            if (track.type === 'audio' || track.type === 'video') {
                engine.analyzeTrackAudio(track, entry.file).then((result) => {
                    if (!result || !state.tracks.includes(track) || track.file !== entry.file) return;
                    timeline.setTracks(state.tracks);
                    elements.previewState.textContent = `Analysed ${entry.name}`;
                });
            }
            return true;
        } catch (error) {
            if (removeOnFailure && state.tracks.includes(track)) {
                state.tracks = state.tracks.filter((item) => item !== track);
                state.selectedTrackIds.delete(track.id);
                refreshAll();
            }
            if (!state.tracks.includes(track) && /cancelled/i.test(error.message)) return false;
            elements.previewState.textContent = `Could not load ${entry.name}: ${error.message}`;
            showToast(`Could not import ${entry.name}`);
            void requestEditorAction({kind:'info',title:'Could not load media',
                description:`Could not load ${entry.name}: ${error.message}`,apply:'Close'});
            return false;
        }
    }

    function clipsOverlap(first, second, epsilon = 0.001) {
        const firstStart = Number(first.start) || 0;
        const firstEnd = firstStart + Math.max(0, Number(first.clipDuration) || 0);
        const secondStart = Number(second.start) || 0;
        const secondEnd = secondStart + Math.max(0, Number(second.clipDuration) || 0);
        return firstStart < secondEnd - epsilon && firstEnd > secondStart + epsilon;
    }

    function getVideoLaneModels() {
        const lanes = new Map();
        for (const track of state.tracks.filter((item) => item.type === 'video')) {
            const laneId = track.laneId || track.id;
            if (!lanes.has(laneId)) lanes.set(laneId, { laneId, laneLabel: track.laneLabel, order: Number(track.order) || 0 });
        }
        return [...lanes.values()].sort((a, b) => a.order - b.order);
    }

    function setTrackToNewVideoLane(track) {
        const order = nextLaneOrder('video');
        track.laneId = `video-lane-${Date.now()}-${++state.serial}`;
        track.laneLabel = laneName('video', order);
        track.label = laneName('video', order);
        track.order = order;
        track.laneColor=null;
        return track;
    }

    function resolveVideoOverlap(track) {
        if (!track || track.type !== 'video' || !track.sourceName) return false;
        const conflicts = state.tracks.filter((candidate) => candidate.type === 'video' && candidate.id !== track.id && candidate.laneId === track.laneId && candidate.sourceName && clipsOverlap(track, candidate));
        if (!conflicts.length) return false;
        const freeLane = getVideoLaneModels().find((lane) => !state.tracks.some((candidate) => candidate.type === 'video' && candidate.id !== track.id && candidate.laneId === lane.laneId && candidate.sourceName && clipsOverlap(track, candidate)));
        if (freeLane) {
            track.laneId = freeLane.laneId;
            track.laneLabel = freeLane.laneLabel;
            track.label = freeLane.laneLabel;
            track.order = freeLane.order;
            track.laneColor = state.tracks.find(t=>t.laneId===freeLane.laneId)?.laneColor || null;
        } else {
            setTrackToNewVideoLane(track);
        }
        return true;
    }

    function fitInsertedClipToLane(track) {
        if (!track?.sourceName || !track.clipDuration) return;
        const existing = state.tracks.filter((other) => other.id !== track.id
            && other.laneId === track.laneId && other.sourceName)
            .sort((a,b) => (Number(a.start)||0)-(Number(b.start)||0));
        let candidate = Math.max(0, Number(track.start)||0);
        const duration = Math.max(.15, Number(track.clipDuration)||0);
        for (const other of existing) {
            const start = Number(other.start)||0, end = start + Math.max(.15,Number(other.clipDuration)||0);
            if (candidate + duration <= start + .001) break;
            if (candidate >= end - .001) continue;
            candidate = end;
        }
        track.start = candidate;
    }

    async function placeProjectFile({ fileId, laneId, laneType, start }) {
        const entry = getFile(fileId);
        if (!entry) return;
        if (!entry.file) { showToast('Relink this remembered file before placing it on the timeline'); return; }
        recordHistory(`Place ${entry.name}`);
        const laneTracks = laneId ? state.tracks.filter((track) => track.laneId === laneId) : [];
        let track = null;
        let created = false;
        track = laneTracks.find((candidate) => !candidate.sourceName && candidate.type === entry.kind) || null;
        if (!track && laneTracks.length && laneType === entry.kind) {
            // Adding media onto an existing lane should reuse it rather than
            // silently multiplying tracks. The new clip is placed after any
            // occupied region when necessary.
            const lane = laneTracks[0];
            track = createTrack(entry.kind, { laneId: lane.laneId, laneLabel: lane.laneLabel, label:lane.label, order: lane.order, laneColor:lane.laneColor });
            state.tracks.push(track);
            created = true;
        }
        if (!track) { track = createTrack(entry.kind); state.tracks.push(track); created = true; }
        await loadTrackFromFile(track, entry, start, { removeOnFailure: created });
    }

    function onTimelineTrackChanged(track, detail = {}) {
        if (detail.live) {
            if (state.liveRenderRequest !== null) return;
            state.liveRenderRequest = requestAnimationFrame(() => { state.liveRenderRequest = null; engine.renderFrame(); });
            return;
        }
        if (state.liveRenderRequest !== null) { cancelAnimationFrame(state.liveRenderRequest); state.liveRenderRequest = null; }
        const relocated = resolveVideoOverlap(track);
        // Drag/trim edits that break a paired overlap must not leave stale link
        // metadata or keep a spatial effect active at the wrong timestamps.
        for(const clip of state.tracks){
            if(clip.transitionFromId&&!isPairedFadeActive(clip,state.tracks)){
                clip.transitionFromId=null;
                clip.transitionEffectId=null;
            }
        }
        engine.setTracks(state.tracks);
        timeline.setTracks(state.tracks);
        timeline.setDuration(engine.getTimelineDuration());
        syncInspector();
        if (relocated) showToast(`${track.sourceName || 'Video'} moved to ${track.laneLabel} so video clips do not overlap`);
    }

    function applySelectedVideoPair(preserveOrder = false) {
        let plan;
        const effectId=elements.pairTransitionEffect.value;
        const effect=TRANSITION_CATALOG.find(item=>item.id===effectId);
        try{
            if(effect?.status!=='available')throw Error('This effect is selected for later development, not implemented yet.');
            plan=planPairedTransition(state.tracks,[...state.selectedTrackIds],elements.pairTransitionDuration.value,effectId,{preserveOrder:preserveOrder===true});
        }catch(error){
            showToast(error.message);
            if (!elements.transitionModal.hidden) elements.transitionModalStatus.textContent = error.message;
            return false;
        }
        const a=getTrack(plan.fromId),b=getTrack(plan.toId);
        recordHistory(`Pair ${a.sourceName} → ${b.sourceName} (${plan.duration.toFixed(2)}s ${effect.label})`);
        a.visualTransitions=plan.outgoingTransitions;
        b.visualTransitions=plan.incomingTransitions;
        b.start=plan.start;
        if(plan.needsNewLane){
            b.laneId=`${b.type}-transition-${Date.now()}-${++state.serial}`;
            b.laneLabel=`${laneName(b.type,nextLaneOrder(b.type))} · Transition`;
            b.label=b.laneLabel;
            b.order=plan.incomingOrder;
        }
        b.transitionFromId=plan.fromId;
        b.transitionEffectId=plan.effectId;
        if(effectId==='spiralblockwipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-spiral')
                :document.getElementById('video-spiral-settings');
            b.transitionParameters={...b.transitionParameters,
                spiralblockwipe:readSpiralBlockSettings(panel)};
        }
        if(effectId==='hologram'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-hologram')
                :document.getElementById('video-hologram-settings');
            b.transitionParameters={...b.transitionParameters,
                hologram:readHologramSettings(panel)};
        }
        if(effectId==='cell-dissolve'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-cell-dissolve')
                :document.getElementById('video-cell-dissolve-settings');
            b.transitionParameters={...b.transitionParameters,
                'cell-dissolve':readCellDissolveSettings(panel)};
        }
        if(effectId==='vortex'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-vortex')
                :document.getElementById('video-vortex-settings');
            b.transitionParameters={...b.transitionParameters,
                vortex:readVortexSettings(panel)};
        }
        if(effectId==='crumple'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-crumple')
                :document.getElementById('video-crumple-settings');
            b.transitionParameters={...b.transitionParameters,
                crumple:readCrumpleSettings(panel)};
        }
        if(effectId==='liquid-fill'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-liquid-fill')
                :document.getElementById('video-liquid-fill-settings');
            b.transitionParameters={...b.transitionParameters,
                'liquid-fill':readLiquidFillSettings(panel)};
        }
        if(effectId==='heat-haze'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-heat-haze')
                :document.getElementById('video-heat-haze-settings');
            b.transitionParameters={...b.transitionParameters,
                'heat-haze':readHeatHazeSettings(panel)};
        }
        if(effectId==='sphere'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-sphere')
                :document.getElementById('video-sphere-settings');
            b.transitionParameters={...b.transitionParameters,sphere:readSphereSettings(panel)};
        }
        if(effectId==='rings-wipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-rings-wipe')
                :document.getElementById('video-rings-wipe-settings');
            b.transitionParameters={...b.transitionParameters,
                'rings-wipe':readRingsWipeSettings(panel)};
        }
        if(effectId==='snapshot'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-snapshot')
                :document.getElementById('video-snapshot-settings');
            b.transitionParameters={...b.transitionParameters,snapshot:readSnapshotSettings(panel)};
        }
        if(effectId==='color-panel-wipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-color-panel-wipe')
                :document.getElementById('video-color-panel-wipe-settings');
            b.transitionParameters={...b.transitionParameters,
                'color-panel-wipe':readColorPanelWipeSettings(panel)};
        }
        if(effectId==='gallery'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-gallery')
                :document.getElementById('video-gallery-settings');
            b.transitionParameters={...b.transitionParameters,
                gallery:readGallerySettings(panel)};
        }
        if(effectId==='vhs-tracking'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-vhs-tracking')
                :document.getElementById('video-vhs-tracking-settings');
            b.transitionParameters={...b.transitionParameters,
                'vhs-tracking':readVhsTrackingSettings(panel)};
        }
        if(effectId==='card-swipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-card-swipe')
                :document.getElementById('video-card-swipe-settings');
            b.transitionParameters={...b.transitionParameters,
                'card-swipe':readCardSwipeSettings(panel)};
        }
        if(effectId==='camera-shake'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-camera-shake')
                :document.getElementById('video-camera-shake-settings');
            b.transitionParameters={...b.transitionParameters,
                'camera-shake':readCameraShakeSettings(panel)};
        }
        if(effectId==='smoke-dissolve'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-smoke-dissolve')
                :document.getElementById('video-smoke-dissolve-settings');
            b.transitionParameters={...b.transitionParameters,
                'smoke-dissolve':readSmokeDissolveSettings(panel)};
        }
        if(effectId==='splatter-wipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-splatter-wipe')
                :document.getElementById('video-splatter-wipe-settings');
            b.transitionParameters={...b.transitionParameters,
                'splatter-wipe':readSplatterWipeSettings(panel)};
        }
        if(effectId==='ink-bleed'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-ink-bleed')
                :document.getElementById('video-ink-bleed-settings');
            b.transitionParameters={...b.transitionParameters,
                'ink-bleed':readInkBleedSettings(panel)};
        }
        if(effectId==='refraction'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-refraction')
                :document.getElementById('video-refraction-settings');
            b.transitionParameters={...b.transitionParameters,
                'refraction':readRefractionSettings(panel)};
        }
        if(effectId==='whipspin'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-whipspin')
                :document.getElementById('video-whipspin-settings');
            b.transitionParameters={...b.transitionParameters,
                'whipspin':readWhipSpinSettings(panel)};
        }
        if(effectId==='paper-tear'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-paper-tear')
                :document.getElementById('video-paper-tear-settings');
            b.transitionParameters={...b.transitionParameters,
                'paper-tear':readPaperTearSettings(panel)};
        }
        if(effectId==='aperture-wipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-aperture-wipe')
                :document.getElementById('video-aperture-wipe-settings');
            b.transitionParameters={...b.transitionParameters,
                'aperture-wipe':readApertureWipeSettings(panel)};
        }
        if(effectId==='spiral-wipe'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-spiral-wipe')
                :document.getElementById('video-spiral-wipe-settings');
            b.transitionParameters={...b.transitionParameters,
                'spiral-wipe':readSpiralWipeSettings(panel)};
        }
        if(effectId==='prisms'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-prisms')
                :document.getElementById('video-prisms-settings');
            b.transitionParameters={...b.transitionParameters,
                'prisms':readPrismsSettings(panel)};
        }        if(effectId==='cube'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-cube')
                :document.getElementById('video-cube-settings');
            b.transitionParameters={...b.transitionParameters,
                'cube':readCubeSettings(panel)};
        }
        if(effectId==='cross-hatch'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-cross-hatch')
                :document.getElementById('video-cross-hatch-settings');
            b.transitionParameters={...b.transitionParameters,
                'cross-hatch':readCrosshatchSettings(panel)};
        }
        if(effectId==='glitch-flicker'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-glitch-flicker')
                :document.getElementById('video-glitch-flicker-settings');
            b.transitionParameters={...b.transitionParameters,
                'glitch-flicker':readGlitchFlickerSettings(panel)};
        }
        if(effectId==='pixelize'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-pixelize')
                :document.getElementById('video-pixelize-settings');
            b.transitionParameters={...b.transitionParameters,
                pixelize:readPixelizeSettings(panel)};
        }
        if(effectId==='random-squares'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-random-squares')
                :document.getElementById('video-random-squares-settings');
            b.transitionParameters={...b.transitionParameters,
                'random-squares':readRandomSquaresSettings(panel)};
        }
        if(effectId==='ripple'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-ripple')
                :document.getElementById('video-ripple-settings');
            b.transitionParameters={...b.transitionParameters,
                ripple:readRippleSettings(panel)};
        }
        if(effectId==='tv-turn-off'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-tv-turn-off')
                :document.getElementById('video-tv-turn-off-settings');
            b.transitionParameters={...b.transitionParameters,
                'tv-turn-off':readTvTurnOffSettings(panel)};
        }
        if(effectId==='bloom-dissolve'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-bloom-dissolve')
                :document.getElementById('video-bloom-dissolve-settings');
            b.transitionParameters={...b.transitionParameters,
                'bloom-dissolve':readBloomDissolveSettings(panel)};
        }
        if(effectId==='bokeh-dissolve'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-bokeh-dissolve')
                :document.getElementById('video-bokeh-dissolve-settings');
            b.transitionParameters={...b.transitionParameters,
                'bokeh-dissolve':readBokehDissolveSettings(panel)};
        }
        if(effectId==='light-rays'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-light-rays')
                :document.getElementById('video-light-rays-settings');
            b.transitionParameters={...b.transitionParameters,
                'light-rays':readLightRaysSettings(panel)};
        }
        if(effectId==='block-cover'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-block-cover')
                :document.getElementById('video-block-cover-settings');
            b.transitionParameters={...b.transitionParameters,
                'block-cover':readBlockCoverSettings(panel)};
        }
        if(effectId==='disintegrate'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-disintegrate')
                :document.getElementById('video-disintegrate-settings');
            b.transitionParameters={...b.transitionParameters,
                disintegrate:readDisintegrateSettings(panel)};
        }
        if(effectId==='ascii'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-ascii')
                :document.getElementById('video-ascii-settings');
            b.transitionParameters={...b.transitionParameters,
                ascii:readAsciiSettings(panel)};
        }
        if(effectId==='film-strip'){
            const panel=preserveOrder===true
                ?document.getElementById('transition-modal-film-strip')
                :document.getElementById('video-film-strip-settings');
            b.transitionParameters={...b.transitionParameters,
                'film-strip':readFilmStripSettings(panel)};
        }
        refreshAll();
        selectTrack(b.id);
        void engine.seek(plan.start+plan.duration/2,{resume:false}).catch((error)=>{
            elements.previewState.textContent=`Transition preview unavailable: ${error.message}`;
        });
        showToast(`Paired ${effect.label} ${plan.duration.toFixed(2)}s: ${a.sourceName} → ${b.sourceName}`);
        return true;
    }

    function unlinkSelectedVideoPair(){
        const track=getTrack();
        if(!track||!isPairedFadeActive(track,state.tracks))return;
        recordHistory(`Unlink transition to ${track.sourceName}`);
        track.transitionFromId=null;
        track.transitionEffectId=null;
        syncInspector();
        showToast('Transition unlinked; clip timing and visual fade retained');
    }

    function renderTransitionCatalog(){
        elements.pairTransitionEffect.replaceChildren();
        elements.transitionLibraryGrid.replaceChildren();
        for(const effect of TRANSITION_CATALOG){
            const option=document.createElement('option');
            option.value=effect.id;
            option.textContent=effect.status==='available'?effect.label:`${effect.label} (selected, coming later)`;
            option.disabled=effect.status!=='available';
            elements.pairTransitionEffect.appendChild(option);
            const item=document.createElement('div');
            item.className='transition-library-item'+(effect.status==='available'?' ready':'');
            const name=document.createElement('strong');
            name.textContent=effect.label;
            const status=document.createElement('span');
            status.textContent=effect.status==='available'?'Ready':'Selected';
            item.append(name,status);
            elements.transitionLibraryGrid.appendChild(item);
        }
        elements.pairTransitionEffect.value='fade';
        const available=TRANSITION_CATALOG.filter(item=>item.status==='available');
        const queued=TRANSITION_CATALOG.length-available.length;
        elements.transitionLibraryStatus.textContent=
            `Available now (${available.length}): ${available.map(item=>item.label).join(', ')}. ${queued} more selected for later development.`;
    }

    async function extractAudioFromSelectedVideo() {
        const video = getTrack();
        if (!video || video.type !== 'video' || !video.file) return;
        const audio = createTrack('audio', { extractedFrom: video.id, sourceFileId: video.sourceFileId, start: video.start, sourceOffset: video.sourceOffset, clipDuration: video.clipDuration, label: `Extracted Audio ${nextLaneOrder('audio')}` });
        try {
            await engine.loadTrack(audio, video.file);
            if (!state.tracks.includes(video)) { engine.detachTrack(audio, false); return; }
        } catch (error) {
            engine.detachTrack(audio, false);
            elements.previewState.textContent = `Could not extract audio: ${error.message}`;
            return;
        }
        recordHistory(`Extract audio from ${video.sourceName || video.laneLabel}`);
        audio.clipDuration = Math.min(video.clipDuration, Math.max(.15, (audio.sourceDuration || video.clipDuration) - audio.sourceOffset));
        state.tracks.push(audio);
        video.audio.muted = true;
        refreshAll(); selectTrack(audio.id);
    }

    function canSplitTrack(track, time = engine.currentTime) {
        const start = Number(track?.start) || 0;
        const end = start + (Number(track?.clipDuration) || 0);
        return Boolean(track?.file && time > start + .04 && time < end - .04);
    }

    function splitClipKeyframes(track,cutOffset) {
        const left={},right={};
        for(const [property,frames] of Object.entries(track.keyframes||{})){
            if(!Array.isArray(frames)||!frames.length)continue;
            const value=visualParameterAt(track,property,(Number(track.start)||0)+cutOffset);
            left[property]=[...frames.filter(frame=>frame.time<cutOffset-.001).map(frame=>({...frame})),
                {time:Number(cutOffset.toFixed(3)),value}];
            right[property]=[{time:0,value},
                ...frames.filter(frame=>frame.time>cutOffset+.001).map(frame=>({
                    time:Number((frame.time-cutOffset).toFixed(3)),value:frame.value
                }))];
        }
        return {left,right};
    }
    async function splitTrackAtNow(trackId, { record = true } = {}) {
        const track = getTrack(trackId);
        if (!canSplitTrack(track)) { showToast('Move the now line inside a clip before splitting'); return false; }
        const cutTime = engine.currentTime;
        const leftDuration = cutTime - track.start;
        const rightDuration = track.clipDuration - leftDuration;
        const transitionParts=splitVisualTransitions(track.visualTransitions);
        const keyframeParts=splitClipKeyframes(track,leftDuration);
        const split = createTrack(track.type, {
            laneId: track.laneId,
            laneLabel: track.laneLabel,
            order: track.order,
            label: track.label,
            start: cutTime,
            sourceOffset: (Number(track.sourceOffset) || 0) + leftDuration,
            clipDuration: rightDuration,
            visible: track.visible,
            opacity: track.opacity,
            blendMode: track.blendMode,
            audio: { ...track.audio },
            transform: {...(track.transform||{})}, adjustments:{...(track.adjustments||{})},
            keyframes:keyframeParts.right,speed:track.speed||1,
            visualTransitions: transitionParts.right,
            transparency: { ...track.transparency },
            // Splitting must not silently turn a generated text/effect recipe into its PNG fallback.
            textOverlay: track.textOverlay?normaliseTextOverlay(track.textOverlay):null,
            effectOverlay: track.effectOverlay?normaliseTimelineEffect(track.effectOverlay):null,
            groupId: track.groupId,
            extractedFrom: track.extractedFrom,
            analysis: track.analysis,
            sourceFileId: track.sourceFileId
        });
        try {
            await engine.loadTrack(split, track.file);
            if (!state.tracks.includes(track)) { engine.detachTrack(split, false); return false; }
        } catch (error) {
            engine.detachTrack(split, false);
            elements.previewState.textContent = `Could not split clip: ${error.message}`;
            showToast('Split failed; original clip has not changed');
            return false;
        }
        if (record) recordHistory(`Split ${track.sourceName || track.laneLabel}`);
        track.clipDuration = leftDuration;
        if(VISIBLE_VISUAL_TYPES.has(track.type))track.visualTransitions=transitionParts.left;
        track.keyframes=keyframeParts.left;
        split.clipDuration = rightDuration;
        state.tracks.push(split);
        refreshAll(); selectTrack(split.id);
        showToast('Clip split at now line');
        return true;
    }

    async function splitAllAtNow() {
        const targetIds = state.tracks.filter((track) => canSplitTrack(track)).map((track) => track.id);
        if (!targetIds.length) { showToast('No clips cross the now line'); return; }
        recordHistory(`Split all at ${formatTime(engine.currentTime)}`);
        let completed = 0;
        for (const id of targetIds) if (await splitTrackAtNow(id, { record: false })) completed += 1;
        showToast(`Split ${completed} of ${targetIds.length} clip${targetIds.length === 1 ? '' : 's'} at ${formatTime(engine.currentTime)}`);
    }

    async function deleteSelectedTracks() {
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        if (!selected.length) { showToast('Select one or more clips to delete'); return; }
        recordHistory(`Delete ${selected.length} clip${selected.length === 1 ? '' : 's'}`);
        state.tracks = state.tracks.filter((track) => !state.selectedTrackIds.has(track.id));
        state.selectedTrackIds.clear();
        state.selectedTrackId = null;
        refreshAll();
        showToast(`Deleted ${selected.length} clip${selected.length === 1 ? '' : 's'}`);
    }

    async function duplicateSelectedTracks() {
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        if (!selected.length) { showToast('Select one or more clips to duplicate'); return; }
        const duplicates = [];
        try {
        for (const original of selected) {
            if (!original.file) continue;
            const isVideo = original.type === 'video';
            const originalDuration = Math.max(.15, Number(original.clipDuration) || 0);
            const clone = createTrack(original.type, {
                // Videos cannot overlap in a lane, so a duplicate gets a fresh video lane.
                laneId: isVideo ? undefined : original.laneId,
                laneLabel: isVideo ? undefined : original.laneLabel,
                label:isVideo ? undefined : original.label,
                laneColor:original.laneColor,
                clipColor:original.clipColor,
                order: isVideo ? undefined : original.order,
                start: Math.max(0, (Number(original.start) || 0) + originalDuration),
                sourceOffset: Number(original.sourceOffset) || 0,
                sourceFileId: original.sourceFileId,
                clipDuration: originalDuration,
                visible: original.visible,
                opacity: original.opacity,
                blendMode: original.blendMode,
                audio: { ...original.audio },
                transform:{...(original.transform||{})}, adjustments:{...(original.adjustments||{})},
                keyframes:original.keyframes,speed:original.speed||1,
                visualTransitions: normalizeVisualTransitions(original.visualTransitions),
                transparency: { ...original.transparency },
                groupId: null,
                extractedFrom: original.extractedFrom || null,
                analysis: original.analysis ? { ...original.analysis, levels: Array.isArray(original.analysis.levels) ? [...original.analysis.levels] : original.analysis.levels } : null
            });
            await engine.loadTrack(clone, original.file);
            clone.sourceName = original.sourceName;
            clone.start = Math.max(0, (Number(original.start) || 0) + originalDuration);
            clone.sourceOffset = Number(original.sourceOffset) || 0;
            clone.clipDuration = originalDuration;
            clone.visible = original.visible;
            clone.opacity = original.opacity;
            clone.blendMode = original.blendMode;
            clone.audio = { ...original.audio };
            clone.transform={...(original.transform||{})};clone.adjustments={...(original.adjustments||{})};
            clone.keyframes=Object.fromEntries(Object.entries(original.keyframes||{}).map(([key,frames])=>[key,frames.map(frame=>({...frame}))]));
            clone.speed=original.speed||1;
            clone.visualTransitions = normalizeVisualTransitions(original.visualTransitions);
            clone.transparency = { ...original.transparency };
            clone.analysis = original.analysis ? { ...original.analysis, levels: Array.isArray(original.analysis.levels) ? [...original.analysis.levels] : original.analysis.levels } : null;
            duplicates.push(clone);
        }
        } catch (error) {
            for (const clone of duplicates) engine.detachTrack(clone, false);
            elements.previewState.textContent = `Could not duplicate clips: ${error.message}`;
            showToast('Duplicate failed; no new clips were added');
            return;
        }
        if (!duplicates.length) { showToast('The selected clips do not have source files to duplicate'); return; }
        recordHistory(`Duplicate ${selected.length} clip${selected.length === 1 ? '' : 's'}`);
        state.tracks.push(...duplicates);
        state.selectedTrackIds = new Set(duplicates.map((track) => track.id));
        state.selectedTrackId = duplicates[0].id;
        refreshAll();
        showToast(`Duplicated ${duplicates.length} clip${duplicates.length === 1 ? '' : 's'}`);
    }

    function groupSelectedTracks() {
        const selected = state.tracks.filter((track) => state.selectedTrackIds.has(track.id));
        if (selected.length < 2) { showToast('Select two or more clips before grouping'); return; }
        recordHistory(`Group ${selected.length} clips`);
        const groupId = `group-${Date.now()}-${++state.serial}`;
        selected.forEach((track) => { track.groupId = groupId; });
        timeline.setTracks(state.tracks);
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        showToast(`${selected.length} clips grouped — dragging one moves the group`);
    }

    function openContextMenu(trackId, x, y) {
        hideLaneContextMenu();
        selectTrack(trackId);
        state.contextTrackId = trackId;
        const track = getTrack(trackId);
        if (!track) return;
        elements.contextMenuTitle.textContent = track.sourceName || track.laneLabel;
        elements.contextAddLayer.textContent = `➕ Add ${track.type === 'sticker' ? 'Sticker' : track.type === 'video' ? 'Video' : track.type === 'background' ? 'Background' : 'Audio'} layer`;
        elements.contextExtractAudio.hidden = track.type !== 'video' || !track.file;
        elements.contextDuplicate.disabled = !track.file;
        elements.contextDuplicate.title = track.file ? 'Duplicate this clip immediately after the original' : 'Reconnect this clip’s source before duplicating it';
        const clipNode=[...document.querySelectorAll('.timeline-clip')].find(node=>node.dataset.trackId===trackId);
        const workspace=clipNode?.closest('.lane-workspace');
        state.contextClickTime=workspace
            ? clamp((x-workspace.getBoundingClientRect().left)/timeline.pixelsPerSecond,0,timeline.getViewDuration())
            : engine.currentTime;
        elements.contextSplitNow.disabled = !canSplitTrack(track);
        elements.ContextClipActions['slice-click'].disabled=!canSplitTrack(track,state.contextClickTime);
        elements.ContextClipActions.paste.disabled=!state.contextClipboard?.file;
        elements.ContextClipActions['download-source'].disabled=!track.file;
        elements.contextDownloadSection.disabled=!track.file || !offlineExporter.getAvailable() || offlineExporter.busy || exporter.busy || !(track.clipDuration>0) || track.clipDuration>OFFLINE_EXPORT_LIMIT_SECONDS;
        elements.contextDownloadSection.title=track.clipDuration>OFFLINE_EXPORT_LIMIT_SECONDS ? 'Split the clip into sections of 120 seconds or less first' : 'Export this trimmed section only, with its effects and audio, to MP4/WebM';
        elements.contextDownloadWav.disabled=!track.file || !['audio','video'].includes(track.type) || typeof OfflineAudioContext === 'undefined' || offlineExporter.busy || exporter.busy || !(track.clipDuration>0) || track.clipDuration>OFFLINE_EXPORT_LIMIT_SECONDS;
        elements.contextDownloadWav.title=track.clipDuration>OFFLINE_EXPORT_LIMIT_SECONDS ? 'Split into sections shorter than 120 seconds first' : 'Export only the trimmed clip audio as uncompressed 16-bit 48 kHz WAV with Orgavox effects';
        elements.ContextClipActions['toggle-visible'].textContent=track.visible===false?'◉ Show clip':'◉ Hide clip';
        elements.clipResetColour.disabled=!normaliseTimelineColour(track.clipColor);
        elements.contextMenu.hidden = false;
        const maxX = window.innerWidth - elements.contextMenu.offsetWidth - 8;
        const maxY = window.innerHeight - elements.contextMenu.offsetHeight - 8;
        elements.contextMenu.style.left = `${clamp(x, 8, maxX)}px`; elements.contextMenu.style.top = `${clamp(y, 8, maxY)}px`;
    }
    function hideLaneContextMenu() {
        elements.laneMenu.hidden=true;
        state.laneContextId=null;
    }
    function laneClips(laneId) {
        return state.tracks.filter(track=>(track.laneId||track.id)===laneId);
    }
    function openLaneContextMenu(laneId,x,y) {
        hideContextMenu();
        const clips=laneClips(laneId);
        if(!clips.length)return;
        state.laneContextId=laneId;
        elements.laneMenuTitle.textContent=clips[0].laneLabel||'Track';
        elements.laneResetColour.disabled=!normaliseTimelineColour(clips[0].laneColor);
        elements.laneMenu.hidden=false;
        elements.laneMenu.style.left=`${clamp(x,8,Math.max(8,window.innerWidth-elements.laneMenu.offsetWidth-8))}px`;
        elements.laneMenu.style.top=`${clamp(y,8,Math.max(8,window.innerHeight-elements.laneMenu.offsetHeight-8))}px`;
    }
    async function renameLane() {
        const id=state.laneContextId,clips=laneClips(id);
        hideLaneContextMenu();
        if(!clips.length)return;
        const next=await requestEditorAction({kind:'rename',title:'Rename track',
            description:'Change the lane label. Source filenames remain unchanged.',value:clips[0].laneLabel||'Track',apply:'Rename'});
        if(next===null || next===clips[0].laneLabel || !laneClips(id).length)return;
        recordHistory('Rename track');
        for(const clip of laneClips(id)){clip.laneLabel=next;clip.label=next;}
        refreshAll();
        showToast('Renamed track to '+next);
    }
    async function recolourLane() {
        const id=state.laneContextId,clips=laneClips(id);
        hideLaneContextMenu();
        if(!clips.length)return;
        const colour=await requestEditorAction({kind:'colour',title:'Change track colour',
            description:'Changes the timeline lane and its clips, except clips with their own colour override.',value:resolvedLaneColour(clips[0]),apply:'Set colour'});
        if(!colour || !laneClips(id).length)return;
        recordHistory('Change track colour');
        for(const clip of laneClips(id))clip.laneColor=colour;
        refreshAll();
    }
    function resetLaneColour() {
        const id=state.laneContextId,clips=laneClips(id);
        hideLaneContextMenu();
        if(!clips.length || !clips.some(c=>c.laneColor))return;
        recordHistory('Reset track colour');
        for(const clip of clips)clip.laneColor=null;
        refreshAll();
    }
    async function deleteLane() {
        const id=state.laneContextId,clips=laneClips(id);
        hideLaneContextMenu();
        if(!clips.length)return;
        const agreed=await requestEditorAction({kind:'confirm',title:'Delete entire track?',
            description:`Delete "${clips[0].laneLabel||'Track'}" and all ${clips.length} clip(s) on it? The media bin is untouched. Undo can restore the track.`,apply:'Delete track',danger:true});
        if(!agreed || !laneClips(id).length)return;
        recordHistory('Delete entire track');
        const removed=new Set(laneClips(id).map(t=>t.id));
        state.tracks=state.tracks.filter(t=>!removed.has(t.id));
        for(const rid of removed)state.selectedTrackIds.delete(rid);
        if(removed.has(state.selectedTrackId))state.selectedTrackId=[...state.selectedTrackIds][0]||null;
        refreshAll();
        showToast('Track removed · Undo to restore');
    }
    async function recolourClip() {
        const id=state.contextTrackId,track=getTrack(id);
        hideContextMenu();
        if(!track)return;
        const colour=await requestEditorAction({kind:'colour',title:'Change clip colour',
            description:'Only the timeline clip changes colour. Your source media and rendered video remain unchanged.',value:resolvedClipColour(track),apply:'Set colour'});
        if(!colour || !getTrack(id))return;
        recordHistory('Change clip colour');
        getTrack(id).clipColor=colour;
        refreshAll();
    }
    function resetClipColour() {
        const id=state.contextTrackId,track=getTrack(id);
        hideContextMenu();
        if(!track?.clipColor)return;
        recordHistory('Reset clip colour');
        track.clipColor=null;
        refreshAll();
    }
        function hideContextMenu() { elements.contextMenu.hidden = true; state.contextTrackId = null; }
    function addLayerFromContext() {
        const track = getTrack(state.contextTrackId); if (!track) return;
        recordHistory(`Add ${track.type} layer`);
        const newTrack = createTrack(track.type); state.tracks.push(newTrack); refreshAll(); selectTrack(newTrack.id); hideContextMenu();
    }
    function removeLayerFromContext() {
        const track = getTrack(state.contextTrackId); if (!track) return;
        recordHistory(`Remove ${track.sourceName || track.laneLabel}`);
        state.tracks = state.tracks.filter((item) => item.id !== track.id);
        state.selectedTrackIds.delete(track.id); state.selectedTrackId = [...state.selectedTrackIds][0] || null;
        refreshAll(); hideContextMenu();
    }

    function saveContextClip({cut=false}={}) {
        const clip=getTrack(state.contextTrackId);
        if(!clip?.file){hideContextMenu();showToast('Select a loaded media clip first');return;}
        state.contextClipboard={data:snapshotClip(clip),file:clip.file,sourceId:clip.sourceFileId};
        if(cut) {
            recordHistory(`Cut ${clip.sourceName}`);
            state.tracks=state.tracks.filter(t=>t.id!==clip.id);
            state.selectedTrackIds.delete(clip.id);
            state.selectedTrackId=[...state.selectedTrackIds][0]||null;
            refreshAll();
        }
        hideContextMenu();
        showToast(cut?'Clip cut — right-click and Paste to place it':'Clip copied — right-click and Paste to place it');
    }
    async function pasteContextClip() {
        const target=getTrack(state.contextTrackId);
        const clipData=state.contextClipboard?.data;
        const file=state.contextClipboard?.file;
        const suggestedTime=state.contextClickTime;
        hideContextMenu();
        if(!clipData||!file){showToast('Copy or cut a clip first');return;}
        const sameLane=target?.type===clipData.type;
        const clone=createTrack(clipData.type,{
            ...clipData,
            id:`${clipData.type}-${Date.now()}-${++state.serial}`,
            laneId:sameLane?target.laneId:undefined,
            laneLabel:sameLane?target.laneLabel:undefined,
            label:sameLane?target.label:undefined,
            laneColor:sameLane?target.laneColor:clipData.laneColor,
            order:sameLane?target.order:undefined,
            start:Math.max(0,suggestedTime),
            transitionFromId:null,transitionEffectId:null,groupId:null,
            sourceFileId:state.contextClipboard.sourceId
        });
        if(!sameLane){
            clone.laneId=`${clone.type}-lane-${Date.now()}-${++state.serial}`;
            clone.order=nextLaneOrder(clone.type);
            clone.laneLabel=laneName(clone.type,clone.order);
            clone.label=clone.laneLabel;
        }
        try {
            await engine.loadTrack(clone,file);
            clone.start=Math.max(0,suggestedTime);
            clone.sourceOffset=clipData.sourceOffset||0;
            clone.clipDuration=clipData.clipDuration;
            clone.visible=clipData.visible;
            clone.opacity=clipData.opacity;
            clone.blendMode=clipData.blendMode;
            clone.audio={...clipData.audio};
            clone.visualTransitions=normalizeVisualTransitions(clipData.visualTransitions);
            clone.transparency={...clipData.transparency};
            fitInsertedClipToLane(clone);
            recordHistory(`Paste ${clone.sourceName}`);
            state.tracks.push(clone);
            refreshAll();selectTrack(clone.id);
            showToast(`Pasted ${clone.sourceName} at ${formatTime(clone.start)}`);
        }catch(error) {
            engine.detachTrack(clone,false);
            showToast(`Paste failed: ${error.message}`);
        }
    }
    async function sliceContextClip() {
        const id=state.contextTrackId,time=state.contextClickTime;
        hideContextMenu();
        const clip=getTrack(id);
        if(!canSplitTrack(clip,time)){showToast('Right-click inside a clip to slice it at that position');return;}
        try { await engine.seek(time);await splitTrackAtNow(id); }
        catch(error){showToast(`Slice unavailable: ${error.message}`);}
    }
    function toggleContextClipVisible() {
        const clip=getTrack(state.contextTrackId);
        if(!clip){hideContextMenu();return;}
        recordHistory(`${clip.visible===false?'Show':'Hide'} ${clip.sourceName||clip.label}`);
        clip.visible=clip.visible===false;
        refreshAll();hideContextMenu();
        showToast(clip.visible?'Clip visible again':'Clip temporarily hidden (not deleted)');
    }
    function downloadContextSource() {
        const clip=getTrack(state.contextTrackId);
        hideContextMenu();
        if(!clip?.file){showToast('Source file unavailable — relink the original');return;}
        const url=URL.createObjectURL(clip.file);
        const link=document.createElement('a');
        link.download=clip.sourceName||clip.file.name;link.href=url;
        document.body.appendChild(link);link.click();link.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),15000);
        showToast('Downloading original source; trimmed-section export is a separate action');
    }

    function downloadContextSection() {
        const clip=getTrack(state.contextTrackId);
        hideContextMenu();
        if(!clip?.file){showToast('Relink the original clip before exporting its section');return;}
        if(!offlineExporter.getAvailable()){
            showToast('Trimmed section export requires WebCodecs and OfflineAudioContext. Try Chrome or Firefox.');return;
        }
        if(exporter.busy || offlineExporter.busy){showToast('Finish or cancel the current export first');return;}
        if(clip.clipDuration>OFFLINE_EXPORT_LIMIT_SECONDS){
            showToast('Split the clip into sections shorter than 120 seconds first');return;
        }
        if(engine.isPlaying)engine.pause();
        const format=elements.exportOfflineFormat.value || 'mp4';
        elements.exportProgress.value=0;
        elements.exportProgressText.textContent='0%';
        showToast(`Rendering only ${clip.sourceName} · ${formatSeconds(clip.clipDuration)}`);
        void offlineExporter.start({
            format,fps:engine.projectFps,bitrateKbps:Number(elements.exportBitrate.value),
            segmentTrackId:clip.id
        }).catch(error=>{
            elements.exportStatus.textContent=`Trimmed section export failed: ${error.message}`;
            elements.previewState.textContent=`Export error: ${error.message}`;
            showToast('Trimmed section export failed');
        }).finally(updateExportAvailability);
    }

    function downloadContextWav() {
        const clip=getTrack(state.contextTrackId);
        hideContextMenu();
        if(!clip?.file || !['audio','video'].includes(clip.type)){
            showToast('Choose a loaded audio or video clip first');return;
        }
        if(typeof OfflineAudioContext==='undefined'){
            showToast('Your browser does not support OfflineAudioContext WAV export');return;
        }
        if(exporter.busy || offlineExporter.busy){
            showToast('Finish or cancel the current export first');return;
        }
        if(!(clip.clipDuration>0) || clip.clipDuration>OFFLINE_EXPORT_LIMIT_SECONDS){
            showToast('WAV clips must be 0–120 seconds long; split longer clips first');return;
        }
        if(engine.isPlaying) engine.pause();
        elements.exportProgress.value=0;
        elements.exportProgressText.textContent='0%';
        showToast(`Exporting processed WAV audio from ${clip.sourceName}…`);
        void offlineExporter.startWavSection({segmentTrackId:clip.id}).catch(error=>{
            elements.exportStatus.textContent=`Audio WAV export failed: ${error.message}`;
            elements.previewState.textContent=`WAV export error: ${error.message}`;
            showToast('WAV export failed: '+error.message);
        }).finally(updateExportAvailability);
    }

    function syncPreviewZoom() {
        const percent = clamp(Number(state.previewZoom) || 100, 50, 200);
        state.previewZoom = percent;
        elements.previewZoom.value = String(percent);
        elements.previewZoomValue.textContent = `${percent}%`;
        elements.previewStage.style.setProperty('--preview-zoom', String(percent / 100));
    }

    function installPreviewResize() {
        let active = null;
        const move = (event) => {
            if (!active || active.pointerId !== event.pointerId) return;
            event.preventDefault();
            const parentWidth = elements.previewStage.parentElement?.clientWidth || window.innerWidth;
            const width = clamp(active.width + (event.clientX - active.x), 300, Math.max(300, parentWidth));
            elements.previewStage.style.width = `${Math.round(width)}px`;
        };
        const stop = (event) => {
            if (!active || (event && active.pointerId !== event.pointerId)) return;
            active = null;
            elements.previewStage.classList.remove('is-resizing');
            document.body.style.cursor = '';
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', stop, true);
            window.removeEventListener('pointercancel', stop, true);
        };
        elements.previewResizeHandle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault(); event.stopPropagation();
            active = { pointerId: event.pointerId, x: event.clientX, width: elements.previewStage.getBoundingClientRect().width };
            elements.previewStage.classList.add('is-resizing');
            document.body.style.cursor = 'nwse-resize';
            try { elements.previewResizeHandle.setPointerCapture(event.pointerId); } catch (_) { /* capture optional */ }
            window.addEventListener('pointermove', move, true);
            window.addEventListener('pointerup', stop, true);
            window.addEventListener('pointercancel', stop, true);
        });
    }

    function getDroppedFiles(event) {
        const transfer = event?.dataTransfer;
        if (!transfer) return [];

        const directFiles = Array.from(transfer.files || []);
        if (directFiles.length) return directFiles;

        return Array.from(transfer.items || [])
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile?.())
            .filter(Boolean);
    }

    function hasExternalFiles(event) {
        const transfer = event?.dataTransfer;
        if (!transfer) return false;
        if (Array.from(transfer.files || []).length) return true;
        if (Array.from(transfer.items || []).some((item) => item.kind === 'file')) return true;
        return Array.from(transfer.types || []).some((type) => type === 'Files' || type === 'application/x-moz-file');
    }

    async function browseDirectory() {
        if (!window.showDirectoryPicker) { elements.fileInput.click(); return; }
        try {
            const directory = await window.showDirectoryPicker({ mode: 'read' });
            const pairs=[];
            for await (const handle of directory.values()) {
                if(handle.kind!=='file'||!FILE_PATTERN.test(handle.name))continue;
                pairs.push({file:await handle.getFile(),handle});
            }
            await addFiles(pairs.map(pair=>pair.file),pairs.map(pair=>pair.handle));
        } catch(error) {
            if(error.name!=='AbortError'){
                console.warn(error);
                elements.previewState.textContent='Folder browse unavailable; use Import instead.';
            }
        }
    }
    function installGlobalFileDrop() {
        const localOverlay = elements.dropOverlay;
        const localZone = elements.projectDropZone;
        let dragDepth = 0;
        let importing = false;
        let hideTimer = null;

        const importExternalFiles = async (files, source = 'File Explorer', handles = []) => {
            const safeFiles = Array.from(files || []).filter(Boolean);
            if (!safeFiles.length || importing) return false;
            importing = true;
            try {
                const before = state.files.length;
                await addFiles(safeFiles,handles);
                const added = state.files.length - before;
                if (added > 0) {
                    showToast(`Imported ${added} file${added === 1 ? '' : 's'} from ${source}`);
                    return true;
                }
                showToast('Those files are already in Project Files or are not supported');
                return false;
            } catch (error) {
                console.error('External file import failed:', error);
                elements.previewState.textContent = 'Could not import the dropped files.';
                showToast('File import failed');
                return false;
            } finally {
                window.setTimeout(() => { importing = false; }, 0);
            }
        };

        const showDrop = () => {
            window.clearTimeout(hideTimer);
            localOverlay?.classList.add('visible');
            localZone?.classList.add('drop-target-active');
        };
        const hideDrop = () => {
            dragDepth = 0;
            window.clearTimeout(hideTimer);
            localOverlay?.classList.remove('visible');
            localZone?.classList.remove('drop-target-active');
        };
        const isFileDrag = (event) => hasExternalFiles(event) || getDroppedFiles(event).length > 0;
        const intercept = (event, source) => {
            const files = getDroppedFiles(event);
            if (!files.length && !hasExternalFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            hideDrop();
            if(files.length){
                // Capture handle promises synchronously during the drop event:
                // Chromium invalidates DataTransferItem after the event ends.
                const items=Array.from(event.dataTransfer?.items||[]).filter(item=>item.kind==='file');
                const handlePromises=items.map(item=>typeof item.getAsFileSystemHandle==='function'
                    ? item.getAsFileSystemHandle().catch(()=>null) : Promise.resolve(null));
                void Promise.all(handlePromises).then(handles=>importExternalFiles(files,source,handles));
            }
        };
        const enter = (event) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            dragDepth += 1;
            showDrop();
        };
        const over = (event) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            showDrop();
        };
        const leave = (event) => {
            if (!isFileDrag(event)) return;
            dragDepth = Math.max(0, dragDepth - 1);
            if (!event.relatedTarget || dragDepth === 0) {
                window.clearTimeout(hideTimer);
                hideTimer = window.setTimeout(hideDrop, 90);
            }
        };

        // Direct-open Advanced Mode and ordinary iframe targets.
        window.addEventListener('dragenter', enter, true);
        window.addEventListener('dragover', over, true);
        window.addEventListener('dragleave', leave, true);
        window.addEventListener('drop', (event) => intercept(event, 'File Explorer'), true);
        document.addEventListener('dragenter', enter, true);
        document.addEventListener('dragover', over, true);
        document.addEventListener('dragleave', leave, true);
        document.addEventListener('drop', (event) => intercept(event, 'File Explorer'), true);
        window.addEventListener('dragend', hideDrop, true);
        window.addEventListener('blur', hideDrop);

        // Organon loads tools inside #basin-frame. Browsers dispatch Explorer drops to
        // the iframe element in the parent document, not reliably to the child document.
        // Bind directly to that iframe element rather than relying on parent-window bubbling.
        try {
            const parentDocument = window.parent && window.parent !== window ? window.parent.document : null;
            const basinFrame = parentDocument?.getElementById('basin-frame');
            if (basinFrame) {
                const parentEnter = (event) => { if (!isFileDrag(event)) return; event.preventDefault(); event.stopImmediatePropagation?.(); showDrop(); };
                const parentOver = (event) => { if (!isFileDrag(event)) return; event.preventDefault(); event.stopImmediatePropagation?.(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; showDrop(); };
                const parentDrop = (event) => intercept(event, 'Organon window');
                basinFrame.addEventListener('dragenter', parentEnter, true);
                basinFrame.addEventListener('dragover', parentOver, true);
                basinFrame.addEventListener('drop', parentDrop, true);
                basinFrame.addEventListener('dragleave', leave, true);
                window.addEventListener('beforeunload', () => {
                    basinFrame.removeEventListener('dragenter', parentEnter, true);
                    basinFrame.removeEventListener('dragover', parentOver, true);
                    basinFrame.removeEventListener('drop', parentDrop, true);
                    basinFrame.removeEventListener('dragleave', leave, true);
                }, { once: true });
            }
        } catch (error) {
            console.debug('Parent iframe file-drop hook unavailable:', error);
        }

        // Optional parent-router protocol: File objects are structured-cloneable.
        window.addEventListener('message', (event) => {
            const data = event.data;
            if (data?.type !== 'organon-advanced-files-drop') return;
            const files = Array.from(data.files || []).filter((file) => file instanceof File);
            if (files.length) void importExternalFiles(files, 'Organon window');
        });

        if (localZone) {
            localZone.addEventListener('click', (event) => {
                if (!event.target.closest('.file-row,.file-list-footer')) elements.fileInput.click();
            });
            localZone.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); elements.fileInput.click();
                }
            });
        }
    }

    function syncTimelineZoom() { const percent = timeline.getZoomPercent(); elements.timelineZoom.value = String(percent); elements.timelineZoomValue.textContent = `${percent}%`; }
    function updateAudioFade(setting, input, label) {
        const track = getTrack(); if (!track || track.type !== 'audio') return;
        track.audio[setting] = clamp(Number(input.value) || 0, 0, Number(track.clipDuration) || 0);
        label.textContent = formatSeconds(track.audio[setting]);
        engine.updateAudioFades(engine.currentTime);
    }

    function openEditorModal(dialog) {
        hideContextMenu();
        elements.trackTypeMenu.hidden = true;
        elements.btnAddTrack.setAttribute('aria-expanded', 'false');
        elements.snapOptionsMenu.hidden = true;
        elements.btnSnapOptions.setAttribute('aria-expanded', 'false');
        for (const item of [elements.projectSettingsModal, elements.projectExportModal, elements.transitionModal]) item.hidden = item !== dialog;
        dialog.hidden = false;
        dialog.querySelector('[data-close-modal]')?.focus();
    }
    function closeEditorModals() {
        for (const item of [elements.projectSettingsModal, elements.projectExportModal, elements.transitionModal]) item.hidden = true;
    }

    // Shared options for the exact original SpiralBlockWipe GLSL shader.
    function readSpiralBlockSettings(root) {
        const field=name=>root?.querySelector('[data-spiral-param="'+name+'"]')?.value;
        return normaliseSpiralBlockOptions({
            columns:field('columns'),rows:field('rows'),
            inward:field('inward')!=='false',clockwise:field('clockwise')!=='false',
            smoothness:field('smoothness')
        });
    }
    function displaySpiralBlockSettings(root,options={}) {
        const params=normaliseSpiralBlockOptions(options);
        for(const [name,value] of Object.entries(params)) {
            const input=root?.querySelector('[data-spiral-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshSpiralModalSettings({restoreValues=false}={}) {
        const root=document.getElementById('transition-modal-spiral');
        root.hidden=elements.transitionModalEffect.value!=='spiralblockwipe';
        if(!root.hidden&&restoreValues) {
            const target=getTrack(elements.transitionModalTo.value);
            displaySpiralBlockSettings(root,target?.transitionParameters?.spiralblockwipe);
        }
    }
    // Native controls of the unmodified MIT Hologram GLSL, used by both
    // transition preview and applied clip inspector.
    function readHologramSettings(root) {
        const value=name=>root?.querySelector('[data-hologram-param="'+name+'"]')?.value;
        return normaliseHologramOptions({
            tint:value('tint'),background:value('background'),
            backgroundAlpha:value('backgroundAlpha'),
            scanlines:value('scanlines'),jitter:value('jitter'),flicker:value('flicker')
        });
    }
    function displayHologramSettings(root,options={}) {
        const params=normaliseHologramOptions(options);
        for(const [name,value] of Object.entries(params)){
            const input=root?.querySelector('[data-hologram-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshHologramModalSettings({restoreValues=false}={}) {
        const root=document.getElementById('transition-modal-hologram');
        root.hidden=elements.transitionModalEffect.value!=='hologram';
        if(!root.hidden&&restoreValues) {
            const target=getTrack(elements.transitionModalTo.value);
            displayHologramSettings(root,target?.transitionParameters?.hologram);
        }
    }
    function readCellDissolveSettings(root){
        const value=name=>root?.querySelector('[data-cell-dissolve-param="'+name+'"]')?.value;
        return normaliseCellDissolveOptions({
            cells:value('cells'),smoothness:value('smoothness'),
            border:value('border'),borderColor:value('borderColor'),
            borderAlpha:value('borderAlpha'),seed:value('seed')
        });
    }
    function displayCellDissolveSettings(root,options={}){
        const params=normaliseCellDissolveOptions(options);
        for(const [name,value] of Object.entries(params)){
            const input=root?.querySelector('[data-cell-dissolve-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshCellDissolveModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-cell-dissolve');
        root.hidden=elements.transitionModalEffect.value!=='cell-dissolve';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayCellDissolveSettings(root,target?.transitionParameters?.['cell-dissolve']);
        }
    }
    function readVortexSettings(root){
        const value=name=>root?.querySelector('[data-vortex-param="'+name+'"]')?.value;
        return normaliseVortexOptions({
            grid:value('grid'),centerX:value('centerX'),centerY:value('centerY'),
            spin:value('spin'),randomness:value('randomness')
        });
    }
    function displayVortexSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseVortexOptions(options))){
            const input=root?.querySelector('[data-vortex-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshVortexModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-vortex');
        root.hidden=elements.transitionModalEffect.value!=='vortex';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayVortexSettings(root,target?.transitionParameters?.vortex);
        }
    }
    function readCrumpleSettings(root){
        const value=name=>root?.querySelector('[data-crumple-param="'+name+'"]')?.value;
        return normaliseCrumpleOptions({
            creases:value('creases'),size:value('size'),
            directionX:value('directionX'),directionY:value('directionY'),
            paperColor:value('paperColor'),paperAlpha:value('paperAlpha'),
            shadowColor:value('shadowColor'),shadowAlpha:value('shadowAlpha')
        });
    }
    function displayCrumpleSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseCrumpleOptions(options))){
            const input=root?.querySelector('[data-crumple-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshCrumpleModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-crumple');
        root.hidden=elements.transitionModalEffect.value!=='crumple';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayCrumpleSettings(root,target?.transitionParameters?.crumple);
        }
    }
    function readLiquidFillSettings(root){
        const value=name=>root?.querySelector('[data-liquid-fill-param="'+name+'"]')?.value;
        return normaliseLiquidFillOptions({
            directionX:value('directionX'),directionY:value('directionY'),
            amplitude:value('amplitude'),waves:value('waves'),
            highlightColor:value('highlightColor'),highlightAlpha:value('highlightAlpha'),
            refraction:value('refraction'),bubbles:value('bubbles')
        });
    }
    function displayLiquidFillSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseLiquidFillOptions(options))){
            const input=root?.querySelector('[data-liquid-fill-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshLiquidFillModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-liquid-fill');
        root.hidden=elements.transitionModalEffect.value!=='liquid-fill';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayLiquidFillSettings(root,target?.transitionParameters?.['liquid-fill']);
        }
    }
    function readHeatHazeSettings(root){
        const value=name=>root?.querySelector('[data-heat-haze-param="'+name+'"]')?.value;
        return normaliseHeatHazeOptions({
            strength:value('strength'),scale:value('scale'),speed:value('speed')
        });
    }
    function displayHeatHazeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseHeatHazeOptions(options))){
            const input=root?.querySelector('[data-heat-haze-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshHeatHazeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-heat-haze');
        root.hidden=elements.transitionModalEffect.value!=='heat-haze';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayHeatHazeSettings(root,target?.transitionParameters?.['heat-haze']);
        }
    }
    function readSphereSettings(root){
        const value=name=>root?.querySelector('[data-sphere-param="'+name+'"]')?.value;
        return normaliseSphereOptions({
            directionX:value('directionX'),directionY:value('directionY'),
            size:value('size'),shading:value('shading'),shadow:value('shadow')
        });
    }
    function displaySphereSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseSphereOptions(options))){
            const input=root?.querySelector('[data-sphere-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshSphereModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-sphere');
        root.hidden=elements.transitionModalEffect.value!=='sphere';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displaySphereSettings(root,target?.transitionParameters?.sphere);
        }
    }
    function readRingsWipeSettings(root){
        const value=name=>root?.querySelector('[data-rings-wipe-param="'+name+'"]')?.value;
        const radial=root?.querySelector('[data-rings-wipe-param="radial"]')?.checked===true;
        return normaliseRingsWipeOptions({
            count:value('count'),centerX:value('centerX'),centerY:value('centerY'),
            stagger:value('stagger'),radial,
            borderWidth:value('borderWidth'),borderColor:value('borderColor'),
            borderAlpha:value('borderAlpha'),smoothness:value('smoothness')
        });
    }
    function displayRingsWipeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseRingsWipeOptions(options))){
            const input=root?.querySelector('[data-rings-wipe-param="'+name+'"]');
            if(input){
                if(name==='radial')input.checked=value;
                else input.value=String(value);
            }
        }
    }
    function refreshRingsWipeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-rings-wipe');
        root.hidden=elements.transitionModalEffect.value!=='rings-wipe';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayRingsWipeSettings(root,target?.transitionParameters?.['rings-wipe']);
        }
    }
    function readSnapshotSettings(root){
        const value=name=>root?.querySelector('[data-snapshot-param="'+name+'"]')?.value;
        return normaliseSnapshotOptions({
            tilt:value('tilt'),border:value('border'),flash:value('flash'),
            shadow:value('shadow'),borderColor:value('borderColor'),
            borderAlpha:value('borderAlpha')
        });
    }
    function displaySnapshotSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseSnapshotOptions(options))){
            const input=root?.querySelector('[data-snapshot-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshSnapshotModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-snapshot');
        root.hidden=elements.transitionModalEffect.value!=='snapshot';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displaySnapshotSettings(root,target?.transitionParameters?.snapshot);
        }
    }
    function readColorPanelWipeSettings(root){
        const value=name=>root?.querySelector('[data-color-panel-wipe-param="'+name+'"]')?.value;
        return normaliseColorPanelWipeOptions({
            directionX:value('directionX'),directionY:value('directionY'),
            panels:value('panels'),stagger:value('stagger'),skew:value('skew'),
            color1:value('color1'),alpha1:value('alpha1'),
            color2:value('color2'),alpha2:value('alpha2'),
            color3:value('color3'),alpha3:value('alpha3')
        });
    }
    function displayColorPanelWipeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseColorPanelWipeOptions(options))){
            const input=root?.querySelector('[data-color-panel-wipe-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshColorPanelWipeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-color-panel-wipe');
        root.hidden=elements.transitionModalEffect.value!=='color-panel-wipe';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayColorPanelWipeSettings(root,target?.transitionParameters?.['color-panel-wipe']);
        }
    }
    function readGallerySettings(root){
        const value=name=>root?.querySelector('[data-gallery-param="'+name+'"]')?.value;
        return normaliseGalleryOptions({
            direction:value('direction'),tilt:value('tilt'),gap:value('gap'),
            zoom:value('zoom'),reflection:value('reflection'),
            backgroundColor:value('backgroundColor'),backgroundAlpha:value('backgroundAlpha')
        });
    }
    function displayGallerySettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseGalleryOptions(options))){
            const input=root?.querySelector('[data-gallery-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshGalleryModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-gallery');
        root.hidden=elements.transitionModalEffect.value!=='gallery';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayGallerySettings(root,target?.transitionParameters?.gallery);
        }
    }
    function readVhsTrackingSettings(root){
        const value=name=>root?.querySelector('[data-vhs-tracking-param="'+name+'"]')?.value;
        return normaliseVhsTrackingOptions({
            bands:value('bands'),noise:value('noise'),
            bleed:value('bleed'),wobble:value('wobble')
        });
    }
    function displayVhsTrackingSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseVhsTrackingOptions(options))){
            const input=root?.querySelector('[data-vhs-tracking-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshVhsTrackingModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-vhs-tracking');
        root.hidden=elements.transitionModalEffect.value!=='vhs-tracking';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayVhsTrackingSettings(root,target?.transitionParameters?.['vhs-tracking']);
        }
    }
    function readCardSwipeSettings(root){
        const value=name=>root?.querySelector('[data-card-swipe-param="'+name+'"]')?.value;
        return normaliseCardSwipeOptions({
            directionX:value('directionX'),directionY:value('directionY'),
            rotation:value('rotation'),depth:value('depth'),
            backColor:value('backColor'),backAlpha:value('backAlpha')
        });
    }
    function displayCardSwipeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseCardSwipeOptions(options))){
            const input=root?.querySelector('[data-card-swipe-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshCardSwipeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-card-swipe');
        root.hidden=elements.transitionModalEffect.value!=='card-swipe';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayCardSwipeSettings(root,target?.transitionParameters?.['card-swipe']);
        }
    }
    function readCameraShakeSettings(root){
        const value=name=>root?.querySelector('[data-camera-shake-param="'+name+'"]')?.value;
        return normaliseCameraShakeOptions({
            strength:value('strength'),jolts:value('jolts'),
            blur:value('blur'),split:value('split')
        });
    }
    function displayCameraShakeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseCameraShakeOptions(options))){
            const input=root?.querySelector('[data-camera-shake-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshCameraShakeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-camera-shake');
        root.hidden=elements.transitionModalEffect.value!=='camera-shake';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayCameraShakeSettings(root,target?.transitionParameters?.['camera-shake']);
        }
    }
    function readSmokeDissolveSettings(root){
        const value=name=>root?.querySelector('[data-smoke-dissolve-param="'+name+'"]')?.value;
        return normaliseSmokeDissolveOptions({
            directionX:value('directionX'),directionY:value('directionY'),
            scale:value('scale'),spread:value('spread'),softness:value('softness'),
            color:value('color'),colorAlpha:value('colorAlpha')
        });
    }
    function displaySmokeDissolveSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseSmokeDissolveOptions(options))){
            const input=root?.querySelector('[data-smoke-dissolve-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshSmokeDissolveModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-smoke-dissolve');
        root.hidden=elements.transitionModalEffect.value!=='smoke-dissolve';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displaySmokeDissolveSettings(root,target?.transitionParameters?.['smoke-dissolve']);
        }
    }
    function readSplatterWipeSettings(root){
        const value=name=>root?.querySelector('[data-splatter-wipe-param="'+name+'"]')?.value;
        return normaliseSplatterWipeOptions({
            splats:value('splats'),spikiness:value('spikiness'),
            droplets:value('droplets'),drips:value('drips'),
            rim:value('rim'),seed:value('seed')
        });
    }
    function displaySplatterWipeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseSplatterWipeOptions(options))){
            const input=root?.querySelector('[data-splatter-wipe-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshSplatterWipeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-splatter-wipe');
        root.hidden=elements.transitionModalEffect.value!=='splatter-wipe';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displaySplatterWipeSettings(root,target?.transitionParameters?.['splatter-wipe']);
        }
    }
    function readInkBleedSettings(root){
        const value=name=>root?.querySelector('[data-ink-bleed-param="'+name+'"]')?.value;
        return normaliseInkBleedOptions({
            drops:value('drops'),tendrils:value('tendrils'),
            rim:value('rim'),seed:value('seed')
        });
    }
    function displayInkBleedSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseInkBleedOptions(options))){
            const input=root?.querySelector('[data-ink-bleed-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshInkBleedModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-ink-bleed');
        root.hidden=elements.transitionModalEffect.value!=='ink-bleed';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayInkBleedSettings(root,target?.transitionParameters?.['ink-bleed']);
        }
    }
    function readRefractionSettings(root){
        const value=name=>root?.querySelector('[data-refraction-param="'+name+'"]')?.value;
        return normaliseRefractionOptions({
            strength:value('strength'),scale:value('scale'),
            dispersion:value('dispersion'),brightness:value('brightness')
        });
    }
    function displayRefractionSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseRefractionOptions(options))){
            const input=root?.querySelector('[data-refraction-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshRefractionModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-refraction');
        root.hidden=elements.transitionModalEffect.value!=='refraction';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayRefractionSettings(root,target?.transitionParameters?.['refraction']);
        }
    }
    function readWhipSpinSettings(root){
        const value=name=>root?.querySelector('[data-whipspin-param="'+name+'"]')?.value;
        return normaliseWhipSpinOptions({
            turns:value('turns'),blur:value('blur'),
            chroma:value('chroma'),zoom:value('zoom')
        });
    }
    function displayWhipSpinSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseWhipSpinOptions(options))){
            const input=root?.querySelector('[data-whipspin-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshWhipSpinModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-whipspin');
        root.hidden=elements.transitionModalEffect.value!=='whipspin';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayWhipSpinSettings(root,target?.transitionParameters?.['whipspin']);
        }
    }
    function readPaperTearSettings(root){
        const value=name=>root?.querySelector('[data-paper-tear-param="'+name+'"]')?.value;
        return normalisePaperTearOptions({
            roughness:value('roughness'),tilt:value('tilt'),rim:value('rim'),
            paperColor:value('paperColor'),paperAlpha:value('paperAlpha'),
            shadowColor:value('shadowColor'),shadowAlpha:value('shadowAlpha')
        });
    }
    function displayPaperTearSettings(root,options={}){
        for(const [name,value] of Object.entries(normalisePaperTearOptions(options))){
            const input=root?.querySelector('[data-paper-tear-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshPaperTearModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-paper-tear');
        root.hidden=elements.transitionModalEffect.value!=='paper-tear';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayPaperTearSettings(root,target?.transitionParameters?.['paper-tear']);
        }
    }
    function readApertureWipeSettings(root){
        const value=name=>root?.querySelector('[data-aperture-wipe-param="'+name+'"]')?.value;
        return normaliseApertureWipeOptions({
            blades:value('blades'),rotation:value('rotation'),shadow:value('shadow')
        });
    }
    function displayApertureWipeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseApertureWipeOptions(options))){
            const input=root?.querySelector('[data-aperture-wipe-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshApertureWipeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-aperture-wipe');
        root.hidden=elements.transitionModalEffect.value!=='aperture-wipe';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayApertureWipeSettings(root,target?.transitionParameters?.['aperture-wipe']);
        }
    }
    function readSpiralWipeSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-spiral-wipe-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseSpiralWipeOptions({
            turns:value('turns'),smoothness:value('smoothness'),clockwise:value('clockwise')
        });
    }
    function displaySpiralWipeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseSpiralWipeOptions(options))){
            const input=root?.querySelector('[data-spiral-wipe-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshSpiralWipeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-spiral-wipe');
        root.hidden=elements.transitionModalEffect.value!=='spiral-wipe';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displaySpiralWipeSettings(root,target?.transitionParameters?.['spiral-wipe']);
        }
    }
    function readPrismsSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-prisms-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normalisePrismsOptions({
            slats:value('slats'),stagger:value('stagger'),perspective:value('perspective'),
            shading:value('shading'),horizontal:value('horizontal'),
            backColor:value('backColor'),backAlpha:value('backAlpha')
        });
    }
    function displayPrismsSettings(root,options={}){
        for(const [name,value] of Object.entries(normalisePrismsOptions(options))){
            const input=root?.querySelector('[data-prisms-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshPrismsModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-prisms');
        root.hidden=elements.transitionModalEffect.value!=='prisms';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayPrismsSettings(root,target?.transitionParameters?.['prisms']);
        }
    }
    function readCubeSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-cube-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseCubeOptions({
            persp:value('persp'),unzoom:value('unzoom'),reflection:value('reflection'),
            floating:value('floating'),shading:value('shading')
        });
    }
    function displayCubeSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseCubeOptions(options))){
            const input=root?.querySelector('[data-cube-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshCubeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-cube');
        root.hidden=elements.transitionModalEffect.value!=='cube';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayCubeSettings(root,target?.transitionParameters?.['cube']);
        }
    }
    function readCrosshatchSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-cross-hatch-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseCrosshatchOptions({
            centerX:value('centerX'),centerY:value('centerY'),
            threshold:value('threshold'),fadeEdge:value('fadeEdge')
        });
    }
    function displayCrosshatchSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseCrosshatchOptions(options))){
            const input=root?.querySelector('[data-cross-hatch-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshCrosshatchModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-cross-hatch');
        root.hidden=elements.transitionModalEffect.value!=='cross-hatch';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayCrosshatchSettings(root,target?.transitionParameters?.['cross-hatch']);
        }
    }
    function readGlitchFlickerSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-glitch-flicker-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseGlitchFlickerOptions({
            frameRate:value('frameRate'),rgbOffset:value('rgbOffset'),
            blockAmount:value('blockAmount'),ghostAmount:value('ghostAmount'),
            redCyan:value('redCyan'),scanline:value('scanline')
        });
    }
    function displayGlitchFlickerSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseGlitchFlickerOptions(options))){
            const input=root?.querySelector('[data-glitch-flicker-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshGlitchFlickerModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-glitch-flicker');
        root.hidden=elements.transitionModalEffect.value!=='glitch-flicker';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayGlitchFlickerSettings(root,target?.transitionParameters?.['glitch-flicker']);
        }
    }
    function readPixelizeSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-pixelize-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normalisePixelizeOptions({
            squaresX:value('squaresX'),squaresY:value('squaresY'),
            steps:value('steps')
        });
    }
    function displayPixelizeSettings(root,options={}){
        for(const [name,value] of Object.entries(normalisePixelizeOptions(options))){
            const input=root?.querySelector('[data-pixelize-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshPixelizeModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-pixelize');
        root.hidden=elements.transitionModalEffect.value!=='pixelize';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayPixelizeSettings(root,target?.transitionParameters?.['pixelize']);
        }
    }
    function readRandomSquaresSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-random-squares-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseRandomSquaresOptions({
            sizeX:value('sizeX'),sizeY:value('sizeY'),smoothness:value('smoothness')
        });
    }
    function displayRandomSquaresSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseRandomSquaresOptions(options))){
            const input=root?.querySelector('[data-random-squares-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshRandomSquaresModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-random-squares');
        root.hidden=elements.transitionModalEffect.value!=='random-squares';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayRandomSquaresSettings(root,target?.transitionParameters?.['random-squares']);
        }
    }
    function readRippleSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-ripple-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseRippleOptions({
            amplitude:value('amplitude'),speed:value('speed')
        });
    }
    function displayRippleSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseRippleOptions(options))){
            const input=root?.querySelector('[data-ripple-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshRippleModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-ripple');
        root.hidden=elements.transitionModalEffect.value!=='ripple';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayRippleSettings(root,target?.transitionParameters?.['ripple']);
        }
    }
    function readTvTurnOffSettings(root){
        const value=name=>{
            const input=root?.querySelector('[data-tv-turn-off-param="'+name+'"]');
            return input?.type==='checkbox'?input.checked:input?.value;
        };
        return normaliseTvTurnOffOptions({
            color:value('color'),colorAlpha:value('colorAlpha'),glow:value('glow')
        });
    }
    function displayTvTurnOffSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseTvTurnOffOptions(options))){
            const input=root?.querySelector('[data-tv-turn-off-param="'+name+'"]');
            if(input){
                if(input.type==='checkbox')input.checked=Boolean(value);
                else input.value=String(value);
            }
        }
    }
    function refreshTvTurnOffModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-tv-turn-off');
        root.hidden=elements.transitionModalEffect.value!=='tv-turn-off';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayTvTurnOffSettings(root,target?.transitionParameters?.['tv-turn-off']);
        }
    }
    function readBloomDissolveSettings(root){
        const value=name=>root?.querySelector('[data-bloom-dissolve-param="'+name+'"]')?.value;
        return normaliseBloomDissolveOptions({
            spread:value('spread'),threshold:value('threshold'),
            intensity:value('intensity'),tint:value('tint')
        });
    }
    function displayBloomDissolveSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseBloomDissolveOptions(options))){
            const input=root?.querySelector('[data-bloom-dissolve-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshBloomDissolveModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-bloom-dissolve');
        root.hidden=elements.transitionModalEffect.value!=='bloom-dissolve';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayBloomDissolveSettings(root,target?.transitionParameters?.['bloom-dissolve']);
        }
    }
    function readBokehDissolveSettings(root){
        const value=name=>root?.querySelector('[data-bokeh-dissolve-param="'+name+'"]')?.value;
        return normaliseBokehDissolveOptions({
            radius:value('radius'),blades:value('blades'),
            threshold:value('threshold'),intensity:value('intensity')
        });
    }
    function displayBokehDissolveSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseBokehDissolveOptions(options))){
            const input=root?.querySelector('[data-bokeh-dissolve-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshBokehDissolveModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-bokeh-dissolve');
        root.hidden=elements.transitionModalEffect.value!=='bokeh-dissolve';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayBokehDissolveSettings(root,target?.transitionParameters?.['bokeh-dissolve']);
        }
    }
    function readLightRaysSettings(root){
        const value=name=>root?.querySelector('[data-light-rays-param="'+name+'"]')?.value;
        return normaliseLightRaysOptions({
            centerX:value('centerX'),centerY:value('centerY'),
            drift:value('drift'),reach:value('reach'),threshold:value('threshold'),
            intensity:value('intensity'),tint:value('tint')
        });
    }
    function displayLightRaysSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseLightRaysOptions(options))){
            const input=root?.querySelector('[data-light-rays-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshLightRaysModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-light-rays');
        root.hidden=elements.transitionModalEffect.value!=='light-rays';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayLightRaysSettings(root,target?.transitionParameters?.['light-rays']);
        }
    }
    function readBlockCoverSettings(root){
        const value=name=>root?.querySelector('[data-block-cover-param="'+name+'"]')?.value;
        return normaliseBlockCoverOptions({
            blocks:value('blocks'),color:value('color'),colorAlpha:value('colorAlpha'),
            pop:value('pop'),smoothness:value('smoothness')
        });
    }
    function displayBlockCoverSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseBlockCoverOptions(options))){
            const input=root?.querySelector('[data-block-cover-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshBlockCoverModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-block-cover');
        root.hidden=elements.transitionModalEffect.value!=='block-cover';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayBlockCoverSettings(root,target?.transitionParameters?.['block-cover']);
        }
    }
    function readDisintegrateSettings(root){
        const value=name=>root?.querySelector('[data-disintegrate-param="'+name+'"]')?.value;
        return normaliseDisintegrateOptions({
            particleSize:value('particleSize'),directionX:value('directionX'),
            directionY:value('directionY'),spread:value('spread')
        });
    }
    function displayDisintegrateSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseDisintegrateOptions(options))){
            const input=root?.querySelector('[data-disintegrate-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshDisintegrateModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-disintegrate');
        root.hidden=elements.transitionModalEffect.value!=='disintegrate';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayDisintegrateSettings(root,target?.transitionParameters?.disintegrate);
        }
    }
    function readAsciiSettings(root){
        const field=name=>root?.querySelector('[data-ascii-param="'+name+'"]');
        return normaliseAsciiOptions({
            cellSize:field('cellSize')?.value,
            colored:field('colored')?.checked,
            ink:field('ink')?.value,inkAlpha:field('inkAlpha')?.value,
            background:field('background')?.value,
            backgroundAlpha:field('backgroundAlpha')?.value
        });
    }
    function displayAsciiSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseAsciiOptions(options))){
            const field=root?.querySelector('[data-ascii-param="'+name+'"]');
            if(!field)continue;
            if(field.type==='checkbox')field.checked=Boolean(value);
            else field.value=String(value);
        }
    }
    function refreshAsciiModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-ascii');
        root.hidden=elements.transitionModalEffect.value!=='ascii';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayAsciiSettings(root,target?.transitionParameters?.ascii);
        }
    }
    function readFilmStripSettings(root){
        const value=name=>root?.querySelector('[data-film-strip-param="'+name+'"]')?.value;
        return normaliseFilmStripOptions({
            frames:value('frames'),shrink:value('shrink'),
            blur:value('blur'),weave:value('weave'),
            filmColor:value('filmColor'),filmAlpha:value('filmAlpha'),
            holeColor:value('holeColor'),holeAlpha:value('holeAlpha')
        });
    }
    function displayFilmStripSettings(root,options={}){
        for(const [name,value] of Object.entries(normaliseFilmStripOptions(options))){
            const input=root?.querySelector('[data-film-strip-param="'+name+'"]');
            if(input)input.value=String(value);
        }
    }
    function refreshFilmStripModalSettings({restoreValues=false}={}){
        const root=document.getElementById('transition-modal-film-strip');
        root.hidden=elements.transitionModalEffect.value!=='film-strip';
        if(!root.hidden&&restoreValues){
            const target=getTrack(elements.transitionModalTo.value);
            displayFilmStripSettings(root,target?.transitionParameters?.['film-strip']);
        }
    }
    const transitionPreviewScratch = {tracks:[]};
    let transitionPreviewFrame = 0;
    function previewDrawContained(ctx,source,width,height) {
        const sw=source.videoWidth || source.naturalWidth || source.width || 0;
        const sh=source.videoHeight || source.naturalHeight || source.height || 0;
        if(!sw || !sh || (source.readyState !== undefined && source.readyState < 2)) return false;
        const factor=Math.min(width/sw,height/sh),dw=sw*factor,dh=sh*factor;
        ctx.drawImage(source,(width-dw)/2,(height-dh)/2,dw,dh);
        return true;
    }
    function getTransitionChoices() {
        return state.tracks.filter(track => PAIR_VISUAL_TYPES.has(track.type) && track.file && track.sourceName)
            .sort((a,b)=>(Number(a.start)||0)-(Number(b.start)||0));
    }
    function renderTransitionPreview() {
        if (elements.transitionModal.hidden) return;
        const canvas=elements.transitionPreviewCanvas,ctx=canvas.getContext('2d');
        const a=getTrack(elements.transitionModalFrom.value),b=getTrack(elements.transitionModalTo.value);
        const width=canvas.width,height=canvas.height;
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle='#0c1012';ctx.fillRect(0,0,width,height);
        if (!a || !b || a.id === b.id) {
            ctx.fillStyle='#f5f0db';ctx.font='13px sans-serif';ctx.textAlign='center';
            ctx.fillText('Select two different video or image clips',width/2,height/2);
            return;
        }
        const effectId=elements.transitionModalEffect.value;
        const progress=Number(elements.transitionPreviewProgress.value)/100;
        const duration=Math.max(.1,Number(elements.transitionModalDuration.value)||1);
        ctx.save();
        try {
            previewDrawContained(ctx,a.media,width,height);
            if (progress <= 0) return;
            const draft={...b,start:0,transitionFromId:a.id,transitionEffectId:effectId,
                transitionParameters:effectId==='spiralblockwipe'
                    ?{...b.transitionParameters,spiralblockwipe:readSpiralBlockSettings(document.getElementById('transition-modal-spiral'))}
                    :effectId==='hologram'
                    ?{...b.transitionParameters,hologram:readHologramSettings(document.getElementById('transition-modal-hologram'))}
                    :effectId==='cell-dissolve'
                    ?{...b.transitionParameters,'cell-dissolve':readCellDissolveSettings(document.getElementById('transition-modal-cell-dissolve'))}
                    :effectId==='vortex'
                    ?{...b.transitionParameters,vortex:readVortexSettings(document.getElementById('transition-modal-vortex'))}
                    :effectId==='crumple'
                    ?{...b.transitionParameters,crumple:readCrumpleSettings(document.getElementById('transition-modal-crumple'))}
                    :effectId==='liquid-fill'
                    ?{...b.transitionParameters,'liquid-fill':readLiquidFillSettings(document.getElementById('transition-modal-liquid-fill'))}
                    :effectId==='heat-haze'
                    ?{...b.transitionParameters,'heat-haze':readHeatHazeSettings(document.getElementById('transition-modal-heat-haze'))}
                    :effectId==='sphere'
                    ?{...b.transitionParameters,sphere:readSphereSettings(document.getElementById('transition-modal-sphere'))}
                    :effectId==='rings-wipe'
                    ?{...b.transitionParameters,'rings-wipe':readRingsWipeSettings(document.getElementById('transition-modal-rings-wipe'))}
                    :effectId==='snapshot'
                    ?{...b.transitionParameters,snapshot:readSnapshotSettings(document.getElementById('transition-modal-snapshot'))}
                    :effectId==='color-panel-wipe'
                    ?{...b.transitionParameters,'color-panel-wipe':readColorPanelWipeSettings(document.getElementById('transition-modal-color-panel-wipe'))}
                    :effectId==='gallery'
                    ?{...b.transitionParameters,gallery:readGallerySettings(document.getElementById('transition-modal-gallery'))}
                    :effectId==='vhs-tracking'
                    ?{...b.transitionParameters,'vhs-tracking':readVhsTrackingSettings(document.getElementById('transition-modal-vhs-tracking'))}
                    :effectId==='card-swipe'
                    ?{...b.transitionParameters,'card-swipe':readCardSwipeSettings(document.getElementById('transition-modal-card-swipe'))}
                    :effectId==='camera-shake'
                    ?{...b.transitionParameters,'camera-shake':readCameraShakeSettings(document.getElementById('transition-modal-camera-shake'))}
                    :effectId==='smoke-dissolve'
                    ?{...b.transitionParameters,'smoke-dissolve':readSmokeDissolveSettings(document.getElementById('transition-modal-smoke-dissolve'))}
                    :effectId==='splatter-wipe'
                    ?{...b.transitionParameters,'splatter-wipe':readSplatterWipeSettings(document.getElementById('transition-modal-splatter-wipe'))}
                    :effectId==='ink-bleed'
                    ?{...b.transitionParameters,'ink-bleed':readInkBleedSettings(document.getElementById('transition-modal-ink-bleed'))}
                    :effectId==='refraction'
                    ?{...b.transitionParameters,'refraction':readRefractionSettings(document.getElementById('transition-modal-refraction'))}
                    :effectId==='whipspin'
                    ?{...b.transitionParameters,'whipspin':readWhipSpinSettings(document.getElementById('transition-modal-whipspin'))}
                    :effectId==='paper-tear'
                    ?{...b.transitionParameters,'paper-tear':readPaperTearSettings(document.getElementById('transition-modal-paper-tear'))}
                    :effectId==='aperture-wipe'
                    ?{...b.transitionParameters,'aperture-wipe':readApertureWipeSettings(document.getElementById('transition-modal-aperture-wipe'))}
                    :effectId==='spiral-wipe'
                    ?{...b.transitionParameters,'spiral-wipe':readSpiralWipeSettings(document.getElementById('transition-modal-spiral-wipe'))}
                    :effectId==='prisms'
                    ?{...b.transitionParameters,'prisms':readPrismsSettings(document.getElementById('transition-modal-prisms'))}
                    :effectId==='cube'
                    ?{...b.transitionParameters,'cube':readCubeSettings(document.getElementById('transition-modal-cube'))}
                    :effectId==='cross-hatch'
                    ?{...b.transitionParameters,'cross-hatch':readCrosshatchSettings(document.getElementById('transition-modal-cross-hatch'))}
                    :effectId==='glitch-flicker'
                    ?{...b.transitionParameters,'glitch-flicker':readGlitchFlickerSettings(document.getElementById('transition-modal-glitch-flicker'))}
                    :effectId==='pixelize'
                    ?{...b.transitionParameters,pixelize:readPixelizeSettings(document.getElementById('transition-modal-pixelize'))}
                    :effectId==='random-squares'
                    ?{...b.transitionParameters,'random-squares':readRandomSquaresSettings(document.getElementById('transition-modal-random-squares'))}
                    :effectId==='ripple'
                    ?{...b.transitionParameters,ripple:readRippleSettings(document.getElementById('transition-modal-ripple'))}
                    :effectId==='tv-turn-off'
                    ?{...b.transitionParameters,'tv-turn-off':readTvTurnOffSettings(document.getElementById('transition-modal-tv-turn-off'))}
                    :effectId==='bloom-dissolve'
                    ?{...b.transitionParameters,'bloom-dissolve':readBloomDissolveSettings(document.getElementById('transition-modal-bloom-dissolve'))}
                    :effectId==='bokeh-dissolve'
                    ?{...b.transitionParameters,'bokeh-dissolve':readBokehDissolveSettings(document.getElementById('transition-modal-bokeh-dissolve'))}
                    :effectId==='light-rays'
                    ?{...b.transitionParameters,'light-rays':readLightRaysSettings(document.getElementById('transition-modal-light-rays'))}
                    :effectId==='block-cover'
                    ?{...b.transitionParameters,'block-cover':readBlockCoverSettings(document.getElementById('transition-modal-block-cover'))}
                    :effectId==='disintegrate'
                    ?{...b.transitionParameters,disintegrate:readDisintegrateSettings(document.getElementById('transition-modal-disintegrate'))}
                    :effectId==='ascii'
                    ?{...b.transitionParameters,ascii:readAsciiSettings(document.getElementById('transition-modal-ascii'))}
                    :effectId==='film-strip'
                    ?{...b.transitionParameters,'film-strip':readFilmStripSettings(document.getElementById('transition-modal-film-strip'))}
                    :b.transitionParameters,
                visualTransitions:{...b.visualTransitions,enter:{type:'fade',curve:'linear',duration}}};
            if(effectId==='fade') {
                ctx.globalAlpha=progress;
                previewDrawContained(ctx,b.media,width,height);
            } else {
                // Original GL shader composes A and B together; clear the
                // already drawn A to avoid doubling transparent source pixels.
                if(['spiralblockwipe','hologram','cell-dissolve','vortex','crumple','liquid-fill','heat-haze','sphere','rings-wipe','snapshot','color-panel-wipe','gallery','vhs-tracking','card-swipe','camera-shake','smoke-dissolve','splatter-wipe','ink-bleed','refraction','whipspin','paper-tear','aperture-wipe','spiral-wipe','prisms','cube','cross-hatch','tv-turn-off','bloom-dissolve','bokeh-dissolve','light-rays','block-cover','disintegrate','ascii','film-strip'].includes(effectId)){
                    ctx.clearRect(0,0,width,height);
                    ctx.fillStyle='#0c1012';ctx.fillRect(0,0,width,height);
                }
                ctx.globalAlpha=1;
                transitionPreviewScratch.tracks=[a,draft];
                if (!paintPairedEffect(transitionPreviewScratch,ctx,draft,width,height,duration*progress,previewDrawContained))
                    previewDrawContained(ctx,b.media,width,height);
            }
        } catch(error) {
            console.warn('Transition thumbnail preview unavailable:',error);
            ctx.fillStyle='#f5f0db';ctx.font='12px sans-serif';ctx.fillText('Preview unavailable for this frame',15,height/2);
        } finally { ctx.restore(); }
    }
    function refreshTransitionModal() {
        const visuals=getTransitionChoices(),selected=visuals.filter(track=>state.selectedTrackIds.has(track.id));
        const choose=(select,previous,fallback)=>{
            select.replaceChildren();
            for(const clip of visuals){
                const option=document.createElement('option');
                option.value=clip.id;
                option.textContent=`${clip.sourceName} · ${formatTime(clip.start)} (${clip.laneLabel})`;
                select.appendChild(option);
            }
            select.value=visuals.some(clip=>clip.id===previous)?previous:(fallback || visuals[0]?.id || '');
        };
        choose(elements.transitionModalFrom,elements.transitionModalFrom.value,selected[0]?.id || visuals[0]?.id);
        choose(elements.transitionModalTo,elements.transitionModalTo.value,selected[1]?.id || visuals[1]?.id);
        elements.transitionModalEffect.replaceChildren();
        for(const effect of TRANSITION_CATALOG.filter(item=>item.status==='available')){
            const option=document.createElement('option');option.value=effect.id;option.textContent=effect.label;
            elements.transitionModalEffect.appendChild(option);
        }
        elements.transitionModalEffect.value=elements.pairTransitionEffect.value || 'fade';
        refreshSpiralModalSettings({restoreValues:true});
        refreshHologramModalSettings({restoreValues:true});
        refreshCellDissolveModalSettings({restoreValues:true});
        refreshVortexModalSettings({restoreValues:true});
        refreshCrumpleModalSettings({restoreValues:true});
        refreshLiquidFillModalSettings({restoreValues:true});
        refreshHeatHazeModalSettings({restoreValues:true});
        refreshSphereModalSettings({restoreValues:true});
        refreshRingsWipeModalSettings({restoreValues:true});
        refreshSnapshotModalSettings({restoreValues:true});
        refreshColorPanelWipeModalSettings({restoreValues:true});
        refreshGalleryModalSettings({restoreValues:true});
        refreshVhsTrackingModalSettings({restoreValues:true});
        refreshCardSwipeModalSettings({restoreValues:true});
        refreshCameraShakeModalSettings({restoreValues:true});
        refreshSmokeDissolveModalSettings({restoreValues:true});
        refreshSplatterWipeModalSettings({restoreValues:true});
        refreshInkBleedModalSettings({restoreValues:true});
        refreshRefractionModalSettings({restoreValues:true});
        refreshWhipSpinModalSettings({restoreValues:true});
        refreshPaperTearModalSettings({restoreValues:true});
        refreshApertureWipeModalSettings({restoreValues:true});
        refreshSpiralWipeModalSettings({restoreValues:true});
        refreshPrismsModalSettings({restoreValues:true});
        refreshCubeModalSettings({restoreValues:true});
        refreshCrosshatchModalSettings({restoreValues:true});
        refreshGlitchFlickerModalSettings({restoreValues:true});
        refreshPixelizeModalSettings({restoreValues:true});
        refreshRandomSquaresModalSettings({restoreValues:true});
        refreshRippleModalSettings({restoreValues:true});
        refreshTvTurnOffModalSettings({restoreValues:true});
        refreshBloomDissolveModalSettings({restoreValues:true});
        refreshBokehDissolveModalSettings({restoreValues:true});
        refreshLightRaysModalSettings({restoreValues:true});
        refreshBlockCoverModalSettings({restoreValues:true});
        refreshDisintegrateModalSettings({restoreValues:true});
        refreshAsciiModalSettings({restoreValues:true});
        refreshFilmStripModalSettings({restoreValues:true});
        updateTransitionModalValidation();
    }
    function updateTransitionModalValidation() {
        const a=elements.transitionModalFrom.value,b=elements.transitionModalTo.value;
        const count=getTransitionChoices().length;
        const valid=count>=2 && a && b && a!==b;
        elements.btnApplyTransitionModal.disabled=!valid;
        elements.transitionModalStatus.textContent=count<2
            ? 'Place at least two visual clips (video, PNG, JPEG, GIF or WebP) on the timeline.'
            : !valid ? 'Choose two different clips. A clip cannot transition into itself.'
            : `${count} available visual clips · 41 transitions. Preview the effect, then Apply.`;
        refreshSpiralModalSettings();
        refreshHologramModalSettings();
        refreshCellDissolveModalSettings();
        refreshVortexModalSettings();
        renderTransitionPreview();
    }
    function applyTransitionFromModal() {
        const a=elements.transitionModalFrom.value,b=elements.transitionModalTo.value;
        if(!a || !b || a===b){updateTransitionModalValidation();return;}
        const from=getTrack(a),to=getTrack(b);
        if(!from || !to || !PAIR_VISUAL_TYPES.has(from.type) || !PAIR_VISUAL_TYPES.has(to.type)){
            elements.transitionModalStatus.textContent='Choose two loaded visual clips.';return;
        }
        const requested=Number(elements.transitionModalDuration.value);
        const max=Math.min(30,from.clipDuration||0,to.clipDuration||0);
        if(!Number.isFinite(requested)||requested<.1||requested>max){
            elements.transitionModalStatus.textContent=`Choose an overlap from 0.1 to ${max.toFixed(2)} seconds.`;return;
        }
        state.selectedTrackIds=new Set([a,b]);
        state.selectedTrackId=a;
        timeline.setSelectedTrackIds(state.selectedTrackIds);
        elements.pairTransitionEffect.value=elements.transitionModalEffect.value;
        elements.pairTransitionDuration.value=elements.transitionModalDuration.value;
        syncSelectionTools();
        syncInspector();
        if(applySelectedVideoPair(true)) closeEditorModals();
    }
    elements.transitionModalFrom.addEventListener('change',updateTransitionModalValidation);
    elements.transitionModalTo.addEventListener('change',updateTransitionModalValidation);
    elements.transitionModalEffect.addEventListener('change',()=>{
        refreshSpiralModalSettings({restoreValues:true});
        refreshHologramModalSettings({restoreValues:true});
        refreshCellDissolveModalSettings({restoreValues:true});
        refreshVortexModalSettings({restoreValues:true});
        refreshCrumpleModalSettings({restoreValues:true});
        refreshLiquidFillModalSettings({restoreValues:true});
        refreshHeatHazeModalSettings({restoreValues:true});
        refreshSphereModalSettings({restoreValues:true});
        refreshRingsWipeModalSettings({restoreValues:true});
        refreshSnapshotModalSettings({restoreValues:true});
        refreshColorPanelWipeModalSettings({restoreValues:true});
        refreshGalleryModalSettings({restoreValues:true});
        refreshVhsTrackingModalSettings({restoreValues:true});
        refreshCardSwipeModalSettings({restoreValues:true});
        refreshCameraShakeModalSettings({restoreValues:true});
        refreshSmokeDissolveModalSettings({restoreValues:true});
        refreshSplatterWipeModalSettings({restoreValues:true});
        refreshInkBleedModalSettings({restoreValues:true});
        refreshRefractionModalSettings({restoreValues:true});
        refreshWhipSpinModalSettings({restoreValues:true});
        refreshPaperTearModalSettings({restoreValues:true});
        refreshApertureWipeModalSettings({restoreValues:true});
        refreshSpiralWipeModalSettings({restoreValues:true});
        refreshPrismsModalSettings({restoreValues:true});
        refreshCubeModalSettings({restoreValues:true});
        refreshCrosshatchModalSettings({restoreValues:true});
        refreshGlitchFlickerModalSettings({restoreValues:true});
        refreshPixelizeModalSettings({restoreValues:true});
        refreshRandomSquaresModalSettings({restoreValues:true});
        refreshRippleModalSettings({restoreValues:true});
        refreshTvTurnOffModalSettings({restoreValues:true});
        refreshBloomDissolveModalSettings({restoreValues:true});
        refreshBokehDissolveModalSettings({restoreValues:true});
        refreshLightRaysModalSettings({restoreValues:true});
        refreshBlockCoverModalSettings({restoreValues:true});
        refreshDisintegrateModalSettings({restoreValues:true});
        refreshAsciiModalSettings({restoreValues:true});
        refreshFilmStripModalSettings({restoreValues:true});renderTransitionPreview();
    });
    document.getElementById('transition-modal-spiral').querySelectorAll('[data-spiral-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('transition-modal-film-strip').querySelectorAll('[data-film-strip-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-film-strip-settings').querySelectorAll('[data-film-strip-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='film-strip'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readFilmStripSettings(document.getElementById('video-film-strip-settings'));
            const prior=normaliseFilmStripOptions(active.transitionParameters?.['film-strip']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original FilmStrip GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'film-strip':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-ascii').querySelectorAll('[data-ascii-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-ascii-settings').querySelectorAll('[data-ascii-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='ascii'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readAsciiSettings(document.getElementById('video-ascii-settings'));
            const prior=normaliseAsciiOptions(active.transitionParameters?.ascii);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Ascii GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,ascii:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-disintegrate').querySelectorAll('[data-disintegrate-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-disintegrate-settings').querySelectorAll('[data-disintegrate-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='disintegrate'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readDisintegrateSettings(document.getElementById('video-disintegrate-settings'));
            const prior=normaliseDisintegrateOptions(active.transitionParameters?.disintegrate);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Disintegrate GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,disintegrate:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-block-cover').querySelectorAll('[data-block-cover-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-block-cover-settings').querySelectorAll('[data-block-cover-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='block-cover'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readBlockCoverSettings(document.getElementById('video-block-cover-settings'));
            const prior=normaliseBlockCoverOptions(active.transitionParameters?.['block-cover']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original BlockCover GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'block-cover':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-light-rays').querySelectorAll('[data-light-rays-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-light-rays-settings').querySelectorAll('[data-light-rays-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='light-rays'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readLightRaysSettings(document.getElementById('video-light-rays-settings'));
            const prior=normaliseLightRaysOptions(active.transitionParameters?.['light-rays']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original LightRays GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'light-rays':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-bokeh-dissolve').querySelectorAll('[data-bokeh-dissolve-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-bokeh-dissolve-settings').querySelectorAll('[data-bokeh-dissolve-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='bokeh-dissolve'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readBokehDissolveSettings(document.getElementById('video-bokeh-dissolve-settings'));
            const prior=normaliseBokehDissolveOptions(active.transitionParameters?.['bokeh-dissolve']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original BokehDissolve GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'bokeh-dissolve':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-bloom-dissolve').querySelectorAll('[data-bloom-dissolve-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-bloom-dissolve-settings').querySelectorAll('[data-bloom-dissolve-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='bloom-dissolve'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readBloomDissolveSettings(document.getElementById('video-bloom-dissolve-settings'));
            const prior=normaliseBloomDissolveOptions(active.transitionParameters?.['bloom-dissolve']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original BloomDissolve GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'bloom-dissolve':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-splatter-wipe').querySelectorAll('[data-splatter-wipe-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-splatter-wipe-settings').querySelectorAll('[data-splatter-wipe-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='splatter-wipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readSplatterWipeSettings(document.getElementById('video-splatter-wipe-settings'));
            const prior=normaliseSplatterWipeOptions(active.transitionParameters?.['splatter-wipe']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original SplatterWipe GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'splatter-wipe':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-ink-bleed').querySelectorAll('[data-ink-bleed-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-ink-bleed-settings').querySelectorAll('[data-ink-bleed-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='ink-bleed'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readInkBleedSettings(document.getElementById('video-ink-bleed-settings'));
            const prior=normaliseInkBleedOptions(active.transitionParameters?.['ink-bleed']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original InkBleed GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'ink-bleed':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-refraction').querySelectorAll('[data-refraction-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-refraction-settings').querySelectorAll('[data-refraction-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='refraction'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readRefractionSettings(document.getElementById('video-refraction-settings'));
            const prior=normaliseRefractionOptions(active.transitionParameters?.['refraction']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Refraction GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'refraction':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-whipspin').querySelectorAll('[data-whipspin-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-whipspin-settings').querySelectorAll('[data-whipspin-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='whipspin'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readWhipSpinSettings(document.getElementById('video-whipspin-settings'));
            const prior=normaliseWhipSpinOptions(active.transitionParameters?.['whipspin']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original WhipSpin GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'whipspin':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-paper-tear').querySelectorAll('[data-paper-tear-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-paper-tear-settings').querySelectorAll('[data-paper-tear-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='paper-tear'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readPaperTearSettings(document.getElementById('video-paper-tear-settings'));
            const prior=normalisePaperTearOptions(active.transitionParameters?.['paper-tear']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original PaperTear GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'paper-tear':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-aperture-wipe').querySelectorAll('[data-aperture-wipe-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-aperture-wipe-settings').querySelectorAll('[data-aperture-wipe-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='aperture-wipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readApertureWipeSettings(document.getElementById('video-aperture-wipe-settings'));
            const prior=normaliseApertureWipeOptions(active.transitionParameters?.['aperture-wipe']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original ApertureWipe GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'aperture-wipe':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-spiral-wipe').querySelectorAll('[data-spiral-wipe-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-spiral-wipe-settings').querySelectorAll('[data-spiral-wipe-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='spiral-wipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readSpiralWipeSettings(document.getElementById('video-spiral-wipe-settings'));
            const prior=normaliseSpiralWipeOptions(active.transitionParameters?.['spiral-wipe']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original SpiralWipe GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'spiral-wipe':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-prisms').querySelectorAll('[data-prisms-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-prisms-settings').querySelectorAll('[data-prisms-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='prisms'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readPrismsSettings(document.getElementById('video-prisms-settings'));
            const prior=normalisePrismsOptions(active.transitionParameters?.['prisms']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Prisms GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'prisms':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-cube').querySelectorAll('[data-cube-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-cube-settings').querySelectorAll('[data-cube-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='cube'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readCubeSettings(document.getElementById('video-cube-settings'));
            const prior=normaliseCubeOptions(active.transitionParameters?.['cube']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Cube GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'cube':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-cross-hatch').querySelectorAll('[data-cross-hatch-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-cross-hatch-settings').querySelectorAll('[data-cross-hatch-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='cross-hatch'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readCrosshatchSettings(document.getElementById('video-cross-hatch-settings'));
            const prior=normaliseCrosshatchOptions(active.transitionParameters?.['cross-hatch']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Crosshatch GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'cross-hatch':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-glitch-flicker').querySelectorAll('[data-glitch-flicker-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-glitch-flicker-settings').querySelectorAll('[data-glitch-flicker-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='glitch-flicker'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readGlitchFlickerSettings(document.getElementById('video-glitch-flicker-settings'));
            const prior=normaliseGlitchFlickerOptions(active.transitionParameters?.['glitch-flicker']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original GlitchFlicker GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'glitch-flicker':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-pixelize').querySelectorAll('[data-pixelize-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-pixelize-settings').querySelectorAll('[data-pixelize-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='pixelize'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readPixelizeSettings(document.getElementById('video-pixelize-settings'));
            const prior=normalisePixelizeOptions(active.transitionParameters?.['pixelize']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Pixelize GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'pixelize':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-random-squares').querySelectorAll('[data-random-squares-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-random-squares-settings').querySelectorAll('[data-random-squares-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='random-squares'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readRandomSquaresSettings(document.getElementById('video-random-squares-settings'));
            const prior=normaliseRandomSquaresOptions(active.transitionParameters?.['random-squares']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original RandomSquares GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'random-squares':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-ripple').querySelectorAll('[data-ripple-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-ripple-settings').querySelectorAll('[data-ripple-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='ripple'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readRippleSettings(document.getElementById('video-ripple-settings'));
            const prior=normaliseRippleOptions(active.transitionParameters?.['ripple']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Ripple GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'ripple':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-tv-turn-off').querySelectorAll('[data-tv-turn-off-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-tv-turn-off-settings').querySelectorAll('[data-tv-turn-off-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='tv-turn-off'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readTvTurnOffSettings(document.getElementById('video-tv-turn-off-settings'));
            const prior=normaliseTvTurnOffOptions(active.transitionParameters?.['tv-turn-off']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original TvTurnOff GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'tv-turn-off':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-smoke-dissolve').querySelectorAll('[data-smoke-dissolve-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-smoke-dissolve-settings').querySelectorAll('[data-smoke-dissolve-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='smoke-dissolve'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readSmokeDissolveSettings(document.getElementById('video-smoke-dissolve-settings'));
            const prior=normaliseSmokeDissolveOptions(active.transitionParameters?.['smoke-dissolve']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original SmokeDissolve GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'smoke-dissolve':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-camera-shake').querySelectorAll('[data-camera-shake-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-camera-shake-settings').querySelectorAll('[data-camera-shake-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='camera-shake'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readCameraShakeSettings(document.getElementById('video-camera-shake-settings'));
            const prior=normaliseCameraShakeOptions(active.transitionParameters?.['camera-shake']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original CameraShake GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'camera-shake':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-card-swipe').querySelectorAll('[data-card-swipe-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-card-swipe-settings').querySelectorAll('[data-card-swipe-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='card-swipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readCardSwipeSettings(document.getElementById('video-card-swipe-settings'));
            const prior=normaliseCardSwipeOptions(active.transitionParameters?.['card-swipe']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original CardSwipe GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'card-swipe':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-vhs-tracking').querySelectorAll('[data-vhs-tracking-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-vhs-tracking-settings').querySelectorAll('[data-vhs-tracking-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='vhs-tracking'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readVhsTrackingSettings(document.getElementById('video-vhs-tracking-settings'));
            const prior=normaliseVhsTrackingOptions(active.transitionParameters?.['vhs-tracking']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original VhsTracking GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'vhs-tracking':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-gallery').querySelectorAll('[data-gallery-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-gallery-settings').querySelectorAll('[data-gallery-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='gallery'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readGallerySettings(document.getElementById('video-gallery-settings'));
            const prior=normaliseGalleryOptions(active.transitionParameters?.gallery);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Gallery GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,gallery:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-color-panel-wipe').querySelectorAll('[data-color-panel-wipe-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-color-panel-wipe-settings').querySelectorAll('[data-color-panel-wipe-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='color-panel-wipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readColorPanelWipeSettings(document.getElementById('video-color-panel-wipe-settings'));
            const prior=normaliseColorPanelWipeOptions(active.transitionParameters?.['color-panel-wipe']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original ColorPanelWipe GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'color-panel-wipe':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-snapshot').querySelectorAll('[data-snapshot-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-snapshot-settings').querySelectorAll('[data-snapshot-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='snapshot'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readSnapshotSettings(document.getElementById('video-snapshot-settings'));
            const prior=normaliseSnapshotOptions(active.transitionParameters?.snapshot);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Snapshot GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,snapshot:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-rings-wipe').querySelectorAll('[data-rings-wipe-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-rings-wipe-settings').querySelectorAll('[data-rings-wipe-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='rings-wipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readRingsWipeSettings(document.getElementById('video-rings-wipe-settings'));
            const prior=normaliseRingsWipeOptions(active.transitionParameters?.['rings-wipe']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original RingsWipe GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'rings-wipe':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-sphere').querySelectorAll('[data-sphere-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-sphere-settings').querySelectorAll('[data-sphere-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='sphere'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readSphereSettings(document.getElementById('video-sphere-settings'));
            const prior=normaliseSphereOptions(active.transitionParameters?.sphere);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Sphere GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,sphere:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-heat-haze').querySelectorAll('[data-heat-haze-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-heat-haze-settings').querySelectorAll('[data-heat-haze-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='heat-haze'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readHeatHazeSettings(document.getElementById('video-heat-haze-settings'));
            const prior=normaliseHeatHazeOptions(active.transitionParameters?.['heat-haze']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original HeatHaze GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'heat-haze':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-liquid-fill').querySelectorAll('[data-liquid-fill-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-liquid-fill-settings').querySelectorAll('[data-liquid-fill-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='liquid-fill'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readLiquidFillSettings(document.getElementById('video-liquid-fill-settings'));
            const prior=normaliseLiquidFillOptions(active.transitionParameters?.['liquid-fill']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original LiquidFill GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,'liquid-fill':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-crumple').querySelectorAll('[data-crumple-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-crumple-settings').querySelectorAll('[data-crumple-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='crumple'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readCrumpleSettings(document.getElementById('video-crumple-settings'));
            const prior=normaliseCrumpleOptions(active.transitionParameters?.crumple);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Crumple GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,crumple:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-vortex').querySelectorAll('[data-vortex-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-vortex-settings').querySelectorAll('[data-vortex-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='vortex'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readVortexSettings(document.getElementById('video-vortex-settings'));
            const prior=normaliseVortexOptions(active.transitionParameters?.vortex);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Vortex GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,vortex:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-cell-dissolve').querySelectorAll('[data-cell-dissolve-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-cell-dissolve-settings').querySelectorAll('[data-cell-dissolve-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='cell-dissolve'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readCellDissolveSettings(document.getElementById('video-cell-dissolve-settings'));
            const prior=normaliseCellDissolveOptions(active.transitionParameters?.['cell-dissolve']);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit CellDissolve original shader settings');
            active.transitionParameters={...active.transitionParameters,'cell-dissolve':updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('transition-modal-hologram').querySelectorAll('[data-hologram-param]')
        .forEach(input=>input.addEventListener('input',renderTransitionPreview));
    document.getElementById('video-hologram-settings').querySelectorAll('[data-hologram-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='hologram'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readHologramSettings(document.getElementById('video-hologram-settings'));
            const prior=normaliseHologramOptions(active.transitionParameters?.hologram);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit original Hologram GLSL uniforms');
            active.transitionParameters={...active.transitionParameters,hologram:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    document.getElementById('video-spiral-settings').querySelectorAll('[data-spiral-param]')
        .forEach(input=>input.addEventListener('change',()=>{
            const active=getTrack();
            if(!active||active.transitionEffectId!=='spiralblockwipe'
                ||!isPairedFadeActive(active,state.tracks))return;
            const updated=readSpiralBlockSettings(document.getElementById('video-spiral-settings'));
            const prior=normaliseSpiralBlockOptions(active.transitionParameters?.spiralblockwipe);
            if(JSON.stringify(prior)===JSON.stringify(updated))return;
            recordHistory('Edit SpiralBlockWipe shader settings');
            active.transitionParameters={...active.transitionParameters,spiralblockwipe:updated};
            engine.renderFrame();
            saveProjectRecovery();
        }));
    elements.transitionModalDuration.addEventListener('input',renderTransitionPreview);
    elements.transitionPreviewProgress.addEventListener('input',renderTransitionPreview);
    elements.btnTransitionPlayPreview.addEventListener('click',()=>{
        cancelAnimationFrame(transitionPreviewFrame);
        const start=performance.now();
        const animate=now=>{
            if(elements.transitionModal.hidden)return;
            const progress=Math.min(1,(now-start)/1100);
            elements.transitionPreviewProgress.value=String(Math.round(progress*100));
            renderTransitionPreview();
            if(progress<1)transitionPreviewFrame=requestAnimationFrame(animate);
        };
        transitionPreviewFrame=requestAnimationFrame(animate);
    });
    elements.btnToggleHeader.addEventListener('click', () => {
        const collapsed = elements.editorHeader.classList.toggle('is-collapsed');
        elements.btnToggleHeader.setAttribute('aria-expanded', String(!collapsed));
        elements.btnToggleHeader.textContent = collapsed ? '▾' : '▴';
        elements.btnToggleHeader.title = collapsed ? 'Show editor header' : 'Hide editor header';
    });
    elements.btnProjectSettings.addEventListener('click', () => openEditorModal(elements.projectSettingsModal));
    elements.btnProjectExport.addEventListener('click', () => openEditorModal(elements.projectExportModal));
    function closeResetMenu(){
        elements.resetMenu.hidden=true;
        elements.btnResetMenu.setAttribute('aria-expanded','false');
    }
    elements.btnResetMenu.addEventListener('click',()=>{
        const open=elements.resetMenu.hidden;
        elements.resetMenu.hidden=!open;
        elements.btnResetMenu.setAttribute('aria-expanded',String(open));
    });
    elements.resetMenu.addEventListener('click',event=>{
        if(event.target.closest('button'))closeResetMenu();
    });
    document.addEventListener('pointerdown',event=>{
        if(!event.target.closest('#reset-menu-wrap'))closeResetMenu();
    });
    document.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&!elements.resetMenu.hidden){
            closeResetMenu();
            elements.btnResetMenu.focus();
        }
    });
    elements.btnResetTimeline.addEventListener('click',async()=>{
        const count=state.tracks.length,markers=state.timelineMarkers.length;
        if(!count&&!markers){
            showToast('The timeline is already empty');
            return;
        }
        const accepted=await requestEditorAction({
            kind:'confirm',title:'Reset timeline?',
            description:`Remove all ${count} clip${count===1?'':'s'} and ${markers} timeline marker${markers===1?'':'s'}? Imported media stays in the Media panel. Undo restores the entire timeline.`,
            apply:'Reset timeline',danger:true
        });
        if(!accepted || (!state.tracks.length&&!state.timelineMarkers.length))return;
        recordHistory('Reset timeline');
        engine.clearAll(); // Stop playback and release discarded decoders.
        state.tracks=[];
        state.timelineMarkers=[];
        timeline.setMarkers([]);
        state.selectedTrackIds.clear();
        state.selectedTrackId=null;
        state.contextTrackId=null;
        state.laneContextId=null;
        state.contextClipboard=null;
        refreshAll();
        await engine.seek(0,{resume:false});
        // Source files and permitted file handles deliberately remain usable.
        // Undo records their IDs and will reconstruct previous clip decoders.
        pruneSourceRegistry();
        saveProjectRecovery();
        showToast('Timeline reset · '+count+' clip'+(count===1?'':'s')+' removed · Undo available');
    });
    elements.btnResetMediaList.addEventListener('click',async()=>{
        const visible=state.files.filter(entry=>!entry.hiddenFromBin);
        if(!visible.length){showToast('The media list is already empty');return;}
        const accepted=await requestEditorAction({
            kind:'confirm',title:'Reset media list?',
            description:`Remove ${visible.length} file${visible.length===1?'':'s'} from the visible Media list? Existing timeline clips, playback sources and file permissions will be preserved. Undo restores the list.`,
            apply:'Reset media list',danger:true
        });
        if(!accepted)return;
        recordHistory('Reset media list');
        for(const entry of visible)entry.hiddenFromBin=true;
        state.selectedFileId=null;
        renderFiles();
        refreshAll();
        saveProjectRecovery();
        showToast(`Media list reset · ${visible.length} hidden · Timeline preserved · Undo available`);
    });
    elements.btnOpenTransitions.addEventListener('click', () => { refreshTransitionModal(); openEditorModal(elements.transitionModal); });
    elements.btnApplyTransitionModal.addEventListener('click', applyTransitionFromModal);
    // Portal all small menus to <body> so panels cannot clip them.
    document.body.append(elements.trackTypeMenu, elements.snapOptionsMenu);
    function positionFloatingMenu(menu, trigger) {
        if (menu.hidden) return;
        const anchor = trigger.getBoundingClientRect();
        const width = menu.offsetWidth, height = menu.offsetHeight;
        const left = clamp(anchor.left, 8, Math.max(8, window.innerWidth - width - 8));
        const below = anchor.bottom + 6, above = anchor.top - height - 6;
        const top = below + height <= window.innerHeight - 8
            ? below : above >= 8 ? above : clamp(below, 8, Math.max(8, window.innerHeight - height - 8));
        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
    }
    function positionTrackMenu() { positionFloatingMenu(elements.trackTypeMenu, elements.btnAddTrack); }
    function positionSnapMenu() { positionFloatingMenu(elements.snapOptionsMenu, elements.btnSnapOptions); }
    elements.btnAddTrack.addEventListener('click', () => {
        elements.trackTypeMenu.hidden = !elements.trackTypeMenu.hidden;
        elements.btnAddTrack.setAttribute('aria-expanded', String(!elements.trackTypeMenu.hidden));
        positionTrackMenu();
    });
    window.addEventListener('resize', () => { positionTrackMenu(); positionSnapMenu(); });
    document.addEventListener('scroll', () => { positionTrackMenu(); positionSnapMenu(); }, true);
    elements.trackTypeMenu.querySelectorAll('[data-add-track-type]').forEach((button) => button.addEventListener('click', () => {
        const type = button.dataset.addTrackType;
        if (!['video','audio','sticker','background'].includes(type)) return;
        recordHistory(`Add ${type} track`);
        const track = createTrack(type);
        state.tracks.push(track);
        refreshAll();
        selectTrack(track.id);
        elements.trackTypeMenu.hidden = true;
        elements.btnAddTrack.setAttribute('aria-expanded','false');
        showToast(`Added ${track.laneLabel} — drag media here`);
    }));
    document.addEventListener('click', (event) => {
        if (!elements.trackTypeMenu.contains(event.target) && event.target !== elements.btnAddTrack) {
            elements.trackTypeMenu.hidden = true;
            elements.btnAddTrack.setAttribute('aria-expanded','false');
        }
        if (!elements.snapOptionsMenu.contains(event.target)
                && event.target !== elements.btnSnapOptions && event.target !== elements.btnSnapSelected) {
            elements.snapOptionsMenu.hidden = true;
            elements.btnSnapOptions.setAttribute('aria-expanded','false');
        }
    });
    function performSelectedSnap(mode) {
        elements.snapOptionsMenu.hidden = true;
        elements.btnSnapOptions.setAttribute('aria-expanded','false');
        let plan;
        try {
            plan = planClipSnap(state.tracks,[...state.selectedTrackIds],mode,engine.currentTime);
        } catch(error) {
            showToast(error.message);
            return;
        }
        if (Math.abs(plan.delta) < 0.0005) {
            showToast('Clips are already aligned at this edit point');
            return;
        }
        const moved = state.tracks.filter(track => plan.movingIds.includes(track.id));
        const target = getTrack(plan.targetId);
        const action = mode === 'pair' ? 'Snap clip end to start'
            : mode === 'start-playhead' ? 'Snap clip start to playhead' : 'Snap clip end to playhead';
        recordHistory(action);
        for (const clip of moved) {
            clip.start = Math.max(0, Number(clip.start || 0) + plan.delta);
        }
        timeline.ensureViewportForTime(Math.max(0,plan.joinTime));
        refreshAll();
        showToast(mode === 'pair'
            ? `Snapped A end to B start at ${formatTime(plan.joinTime)}`
            : `Snapped ${target?.sourceName || 'clip'} to the playhead`);
        if (mode === 'pair') void engine.seek(plan.joinTime,{resume:false})
            .catch(error => { elements.previewState.textContent = error.message; });
    }
    function toggleSnapOptions() {
        const count = state.selectedTrackIds.size;
        for (const button of elements.snapOptionsMenu.querySelectorAll('[data-snap-mode]')) {
            button.disabled = count !== (button.dataset.snapMode === 'pair' ? 2 : 1);
        }
        elements.trackTypeMenu.hidden = true;
        elements.btnAddTrack.setAttribute('aria-expanded','false');
        elements.snapOptionsMenu.hidden = !elements.snapOptionsMenu.hidden;
        elements.btnSnapOptions.setAttribute('aria-expanded',String(!elements.snapOptionsMenu.hidden));
        positionSnapMenu();
    }
    elements.btnSnapSelected.addEventListener('click', () => {
        if (state.selectedTrackIds.size === 2) performSelectedSnap('pair');
        else performSelectedSnap('start-playhead');
    });
    elements.btnSnapOptions.addEventListener('click', toggleSnapOptions);
    elements.snapOptionsMenu.querySelectorAll('[data-snap-mode]').forEach(button => {
        button.addEventListener('click', () => performSelectedSnap(button.dataset.snapMode));
    });

    for (const modal of [elements.projectSettingsModal, elements.projectExportModal, elements.transitionModal]) {
        modal.querySelector('[data-close-modal]').addEventListener('click', closeEditorModals);
        modal.addEventListener('pointerdown', (event) => { if (event.target === modal) closeEditorModals(); });
    }

    elements.projectFps.addEventListener('change', () => {
        if(Number(elements.projectFps.value)!==engine.projectFps)
            recordHistory('Change project frame rate');
        const fps=engine.setProjectFrameRate(elements.projectFps.value);
        showToast(`Project frame rate: ${fps} fps`);
    });
    elements.btnApplyCanvas.addEventListener('click', () => applyCanvasResolution({announce:true,remember:true}));
    for (const input of [elements.canvasWidth, elements.canvasHeight]) {
        input.addEventListener('change', () => applyCanvasResolution({announce:true,remember:true}));
        input.addEventListener('keydown', (event) => {
            if(event.key==='Enter'){
                event.preventDefault();
                applyCanvasResolution({announce:true,remember:true});
            }
        });
    }
    elements.btnUndo.addEventListener('click', () => { undoTimelineEdit(); });
    elements.btnRedo.addEventListener('click', () => { redoTimelineEdit(); });
    elements.timelineZoom.addEventListener('input', () => { timeline.setZoom(Number(elements.timelineZoom.value) / 100); syncTimelineZoom(); });
    elements.btnResetTimelineZoom.addEventListener('click', () => { timeline.resetZoom(); syncTimelineZoom(); showToast('Timeline zoom reset'); });
    function addOrRemoveCueMarker() {
        const time=Math.max(0,Number(engine.currentTime)||0);
        const existing=state.timelineMarkers.findIndex(t=>Math.abs(t-time)<.05);
        recordHistory(existing>=0?'Remove cue marker':'Add cue marker');
        if(existing>=0) {
            state.timelineMarkers.splice(existing,1);
            showToast(`Removed marker at ${formatTime(time)}`);
        } else {
            state.timelineMarkers.push(time);
            state.timelineMarkers.sort((a,b)=>a-b);
            showToast(`Added marker at ${formatTime(time)}`);
        }
        timeline.setMarkers(state.timelineMarkers);
    }
    function moveToCueMarker(direction) {
        const now=engine.currentTime;
        const candidates=state.timelineMarkers.filter(t=>direction<0?t<now-.02:t>now+.02);
        const target=direction<0?candidates[candidates.length-1]:candidates[0];
        if(target===undefined){showToast(direction<0?'No earlier markers':'No later markers');return;}
        void engine.seek(target).catch(error=>showToast(error.message));
    }
    function nudgeTimeline(direction) {
        const seconds=direction/Math.max(1,Number(engine.projectFps)||30);
        if(!state.selectedTrackIds.size) {
            void engine.seek(Math.max(0,engine.currentTime+seconds))
                .catch(error=>showToast(error.message));
            return;
        }
        const movingIds=new Set(state.selectedTrackIds);
        for(const track of state.tracks) {
            if(track.groupId && state.tracks.some(other=>movingIds.has(other.id)&&other.groupId===track.groupId))
                movingIds.add(track.id);
        }
        const moving=state.tracks.filter(track=>movingIds.has(track.id));
        if(!moving.length)return;
        for(const clip of moving) {
            const start=(Number(clip.start)||0)+seconds;
            const end=start+Math.max(0,Number(clip.clipDuration)||0);
            if(start<0 || end>36000) {showToast('Nudge blocked at timeline boundary');return;}
            const collision=state.tracks.some(other=>!movingIds.has(other.id)
                && other.sourceName && clip.sourceName
                && other.laneId===clip.laneId
                && start < (Number(other.start)||0)+(Number(other.clipDuration)||0)-.0001
                && end > (Number(other.start)||0)+.0001);
            if(collision){showToast('Nudge stopped: another clip occupies this track');return;}
        }
        recordHistory(`Nudge ${direction<0?'left':'right'} by one frame`);
        for(const clip of moving) clip.start=Number((Math.max(0,Number(clip.start)||0)+seconds).toFixed(6));
        refreshAll();
        showToast(`Nudged ${moving.length} clip(s) ${direction<0?'left':'right'} by one frame`);
    }
    elements.btnSplitAll.addEventListener('click', splitAllAtNow);
    elements.btnAddMarker.addEventListener('click',addOrRemoveCueMarker);
    elements.btnPreviousMarker.addEventListener('click',()=>moveToCueMarker(-1));
    elements.btnNextMarker.addEventListener('click',()=>moveToCueMarker(1));
    elements.btnNudgeLeft.addEventListener('click',()=>nudgeTimeline(-1));
    elements.btnNudgeRight.addEventListener('click',()=>nudgeTimeline(1));
    elements.btnSelectionMode.addEventListener('click', () => { state.selectionMode = !state.selectionMode; timeline.setSelectionMode(state.selectionMode); syncSelectionTools(); showToast(state.selectionMode ? 'Select mode on — click clips to select multiple' : 'Select mode off'); });
    elements.btnGroupSelection.addEventListener('click', groupSelectedTracks);
    elements.btnApplyPairTransition.addEventListener('click', applySelectedVideoPair);
    elements.btnUnpairTransition.addEventListener('click', unlinkSelectedVideoPair);
    elements.previewZoom.addEventListener('input', (event) => { state.previewZoom = Number(event.target.value); syncPreviewZoom(); });
    elements.btnResetPreviewZoom.addEventListener('click', () => { state.previewZoom = 100; syncPreviewZoom(); showToast('Preview zoom reset'); });

    elements.btnSaveProject.addEventListener('click',downloadPortableProject);
    elements.btnOpenProject.addEventListener('click',()=>elements.projectOpenInput.click());
    elements.projectOpenInput.addEventListener('change',(event)=>{
        const file=event.target.files?.[0]||null;
        event.target.value='';
        if(file)void loadPortableProjectFile(file);
    });
    elements.btnImport.addEventListener('click', () => { void importWithFileHandles(); });
    elements.btnBrowse.addEventListener('click', browseDirectory); elements.btnHeaderBrowse.addEventListener('click', browseDirectory);
    elements.btnRelink.addEventListener('click', () => { void reconnectRememberedMedia(); });
    elements.btnBasicMode.addEventListener('click', () => { window.location.href = './index.html?mode=basic'; });
    elements.btnClear.addEventListener('click', async () => {
        if (!state.files.length && !state.tracks.length) return;
        const confirmed=await requestEditorAction({kind:'confirm',title:'Clear all project media?',
            description:'Remove all media from the active bin and every timeline clip? Undo can still restore the project while its history remains.',apply:'Clear all',danger:true});
        if(!confirmed)return;
        recordHistory('Clear project');
        // Keep IndexedDB file handles needed by the persisted Clear-project
        // Undo snapshot. Erasing them here makes Undo after reload recover only
        // blank/offline clips, even when the browser still has file permission.
        // The active project and its visible file bin are still cleared below.
        engine.clearAll(); state.timelineMarkers=[];timeline.setMarkers([]); state.files = []; state.tracks = []; state.savedFileHandles.clear(); localStorage.removeItem(PROJECT_RECOVERY_KEY); state.lastRecoveryText=''; state.lastRecoveryFailedText=''; state.selectedTrackIds.clear(); state.selectedTrackId = null; state.selectedFileId = null; renderFiles(); refreshAll(); pruneSourceRegistry();
    });
    elements.fileInput.addEventListener('change', async (event) => { await addFiles(event.target.files); event.target.value = ''; });

    elements.btnPlay.addEventListener('click', async () => { try { await engine.togglePlay(); } catch (error) { elements.previewState.textContent = error.message; } });
    elements.btnStepBack.addEventListener('click', () => { void engine.stepFrame(-1).catch((error) => { elements.previewState.textContent = error.message; }); });
    elements.btnStepForward.addEventListener('click', () => { void engine.stepFrame(1).catch((error) => { elements.previewState.textContent = error.message; }); });
    const saveFrameSnapshot=async(format)=>{
        try { await engine.snapshot(format); }
        catch(error) {
            elements.previewState.textContent=error.message;
            showToast(`Frame snapshot failed: ${error.message}`);
        }
    };
    elements.btnSnapshot.addEventListener('click',()=>{void saveFrameSnapshot('png');});
    elements.btnSnapshotJpeg.addEventListener('click',()=>{void saveFrameSnapshot('jpeg');});
    elements.btnPreviewMute.addEventListener('click', () => { engine.togglePreviewMute(); syncPreviewMuteButton(); });
    elements.previewVolume.addEventListener('input', (event) => { engine.setPreviewVolume(Number(event.target.value) / 100); syncPreviewMuteButton(); });
    elements.previewSeek.addEventListener('pointerdown', () => { state.isSeeking = true; });
    elements.previewSeek.addEventListener('input', (event) => { void engine.seek(Number(event.target.value), { resume: false }).catch((error) => { elements.previewState.textContent = error.message; }); });
    elements.previewSeek.addEventListener('change', (event) => { state.isSeeking = false; void engine.seek(Number(event.target.value), { resume: true }).catch((error) => { elements.previewState.textContent = error.message; }); });

    elements.videoVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle video visibility'); const track = getTrack(); if (!track || track.type !== 'video') return; track.visible = !track.visible; refreshAll(); });
    elements.videoAudioSwitch.addEventListener('click', () => { recordHistory('Toggle linked video audio'); const track = getTrack(); if (!track || track.type !== 'video') return; track.audio.muted = !track.audio.muted; engine.syncAudioSettings(); syncInspector(); });
    elements.videoAudioVolume.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.audio.volume = Number(elements.videoAudioVolume.value) / 100; elements.videoAudioVolumeValue.textContent = `${elements.videoAudioVolume.value}%`; elements.videoAudioGainValue.textContent = `+${track.audio.gain || 0}% · ${Math.round(track.audio.volume*100+(track.audio.gain||0))}% total`; engine.syncAudioSettings(); });
    for(const control of elements.orgavoxControls){
        control.addEventListener('change',()=>{
            const track=getTrack();
            if(!track || !['audio','video'].includes(track.type))return;
            const prefix=track.type==='video'?'video':'audio';
            if(!control.id.startsWith(prefix+'-orgavox-'))return;
            const kind=control.id.slice((prefix+'-orgavox-').length);
            if(!Object.hasOwn(ORGAVOX_FX_PRESETS,kind))return;
            const fx=normalizeOrgavoxFx(track.audio?.fx);
            if(fx[kind]===control.value)return;
            const previous=fx[kind];
            recordHistory('Change Orgavox '+kind+' preset');
            fx[kind]=control.value;
            track.audio={...track.audio,fx};
            void engine.refreshOrgavoxAudioEffects(track).catch(error=>{
                if(getTrack(track.id)!==track)return;
                track.audio.fx={...track.audio.fx,[kind]:previous};
                void engine.refreshOrgavoxAudioEffects(track).catch(console.error);
                syncOrgavoxAudioInspector(track);
                showToast(error.message);
            });
            syncOrgavoxAudioInspector(track);
            const label=ORGAVOX_FX_PRESETS[kind][fx[kind]]?.label || 'Off';
            showToast('Orgavox '+kind+': '+label);
        });
    }

    elements.videoAudioGain.addEventListener('input', () => {
        const track=getTrack(); if(!track || track.type!=='video') return;
        track.audio.gain=Number(elements.videoAudioGain.value);
        elements.videoAudioGainValue.textContent=`+${track.audio.gain}% · ${Math.round(track.audio.volume*100+track.audio.gain)}% total`;
        engine.syncAudioSettings();
    });
    elements.videoOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.opacity = Number(elements.videoOpacity.value) / 100; elements.videoOpacityValue.textContent = `${elements.videoOpacity.value}%`; engine.renderFrame(); });
    elements.videoBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'video') return; track.blendMode = elements.videoBlendMode.value; engine.renderFrame(); });
    function updateVideoVisualFade(edge,control) {
        const track=getTrack();
        if(!track||track.type!=='video')return;
        track.visualTransitions=normalizeVisualTransitions(track.visualTransitions);
        track.visualTransitions[edge].duration=clamp(Number(control.value)||0,0,Math.min(30,Number(track.clipDuration)||0));
        timeline.updateVisualTransitionMarkers(track);
        syncInspector();
        engine.renderFrame();
    }
    for(const [edge,slider,curve] of [
        ['enter',elements.videoTransitionEnter,elements.videoTransitionEnterCurve],
        ['exit',elements.videoTransitionExit,elements.videoTransitionExitCurve]
    ]){
        slider.addEventListener('input',()=>updateVideoVisualFade(edge,slider));
        curve.addEventListener('change',()=>{
            const track=getTrack();
            if(!track||track.type!=='video')return;
            track.visualTransitions=normalizeVisualTransitions(track.visualTransitions);
            track.visualTransitions[edge].curve=curve.value==='smooth'?'smooth':'linear';
            syncInspector();engine.renderFrame();
        });
    }
    elements.btnExtractAudio.addEventListener('click', extractAudioFromSelectedVideo);

    elements.backgroundVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle background visibility'); const track = getTrack(); if (!track || track.type !== 'background') return; track.visible = !track.visible; refreshAll(); });
    elements.backgroundOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'background') return; track.opacity = Number(elements.backgroundOpacity.value) / 100; elements.backgroundOpacityValue.textContent = `${elements.backgroundOpacity.value}%`; engine.renderFrame(); });
    elements.backgroundBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'background') return; track.blendMode = elements.backgroundBlendMode.value; engine.renderFrame(); });

    elements.audioAuditionSwitch.addEventListener('click', () => { recordHistory('Toggle audio audition'); const track = getTrack(); if (!track || track.type !== 'audio') return; track.audio.muted = !track.audio.muted; engine.syncAudioSettings(); syncInspector(); });
    elements.audioTrackVolume.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'audio') return; track.audio.volume = Number(elements.audioTrackVolume.value) / 100; elements.audioTrackVolumeValue.textContent = `${elements.audioTrackVolume.value}%`; elements.audioTrackGainValue.textContent = `+${track.audio.gain || 0}% · ${Math.round(track.audio.volume*100+(track.audio.gain||0))}% total`; engine.syncAudioSettings(); });
    elements.audioTrackGain.addEventListener('input', () => {
        const track=getTrack(); if(!track || track.type!=='audio') return;
        track.audio.gain=Number(elements.audioTrackGain.value);
        elements.audioTrackGainValue.textContent=`+${track.audio.gain}% · ${Math.round(track.audio.volume*100+track.audio.gain)}% total`;
        engine.syncAudioSettings();
    });
    elements.audioFadeIn.addEventListener('input', () => updateAudioFade('fadeIn', elements.audioFadeIn, elements.audioFadeInValue));
    elements.audioFadeOut.addEventListener('input', () => updateAudioFade('fadeOut', elements.audioFadeOut, elements.audioFadeOutValue));

    elements.stickerVisibleSwitch.addEventListener('click', () => { recordHistory('Toggle sticker visibility'); const track = getTrack(); if (!track || track.type !== 'sticker') return; track.visible = !track.visible; refreshAll(); });
    elements.stickerOpacity.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.opacity = Number(elements.stickerOpacity.value) / 100; elements.stickerOpacityValue.textContent = `${elements.stickerOpacity.value}%`; engine.renderFrame(); });
    elements.stickerBlendMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.blendMode = elements.stickerBlendMode.value; engine.renderFrame(); });
    elements.stickerTransparencyMode.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.mode = elements.stickerTransparencyMode.value; engine.renderFrame(); });
    elements.stickerKeyColour.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.keyColour = elements.stickerKeyColour.value; elements.stickerKeyColourText.value = track.transparency.keyColour; engine.renderFrame(); });
    elements.stickerKeyColourText.addEventListener('change', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; const value = elements.stickerKeyColourText.value.trim(); const colour = /^#[0-9a-f]{6}$/i.test(value) ? value : '#00ff00'; track.transparency.keyColour = colour; elements.stickerKeyColour.value = colour; elements.stickerKeyColourText.value = colour; engine.renderFrame(); });
    elements.stickerKeyTolerance.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.tolerance = Number(elements.stickerKeyTolerance.value); elements.stickerKeyToleranceValue.textContent = `${track.transparency.tolerance}%`; engine.renderFrame(); });
    elements.stickerEdgeFeather.addEventListener('input', () => { const track = getTrack(); if (!track || track.type !== 'sticker') return; track.transparency.feather = Number(elements.stickerEdgeFeather.value); elements.stickerEdgeFeatherValue.textContent = `${track.transparency.feather}%`; engine.renderFrame(); });

    elements.visualInputs.forEach(input=>{
        input.addEventListener('input',()=>updateVisualProperty(input));
        registerInspectorHistory(input,'Adjust '+input.dataset.visualParam);
    });
    elements.visualKeyframes.forEach(button=>button.addEventListener('click',()=>toggleVisualKeyframe(button)));
    elements.visualBlendMode.addEventListener('change',()=>{
        const track=getTrack();if(!track||!VISIBLE_VISUAL_TYPES.has(track.type))return;
        recordHistory('Change visual blend mode');
        track.blendMode=elements.visualBlendMode.value;
        engine.renderFrame();syncInspector();
    });
    elements.visualSpeed.addEventListener('pointerdown',()=>recordHistory('Adjust clip speed'));
    elements.visualSpeed.addEventListener('input',updateVisualSpeed);
    registerInspectorHistory(elements.videoAudioVolume, 'Change video audio volume');
    registerInspectorHistory(elements.videoAudioGain, 'Change video audio gain');
    registerInspectorHistory(elements.videoOpacity, 'Change video opacity');
    registerInspectorHistory(elements.videoBlendMode, 'Change video blend mode');
    registerInspectorHistory(elements.videoTransitionEnter, 'Change video entrance fade');
    registerInspectorHistory(elements.videoTransitionExit, 'Change video exit fade');
    registerInspectorHistory(elements.videoTransitionEnterCurve, 'Change video entrance curve');
    registerInspectorHistory(elements.videoTransitionExitCurve, 'Change video exit curve');
    registerInspectorHistory(elements.backgroundOpacity, 'Change background opacity');
    registerInspectorHistory(elements.backgroundBlendMode, 'Change background blend mode');
    registerInspectorHistory(elements.audioTrackVolume, 'Change audio volume');
    registerInspectorHistory(elements.audioTrackGain, 'Change audio gain');
    registerInspectorHistory(elements.audioFadeIn, 'Change audio fade in');
    registerInspectorHistory(elements.audioFadeOut, 'Change audio fade out');
    registerInspectorHistory(elements.stickerOpacity, 'Change sticker opacity');
    registerInspectorHistory(elements.stickerBlendMode, 'Change sticker blend mode');
    registerInspectorHistory(elements.stickerTransparencyMode, 'Change sticker transparency');
    registerInspectorHistory(elements.stickerKeyColour, 'Change sticker key colour');
    registerInspectorHistory(elements.stickerKeyColourText, 'Change sticker key colour');
    registerInspectorHistory(elements.stickerKeyTolerance, 'Change sticker tolerance');
    registerInspectorHistory(elements.stickerEdgeFeather, 'Change sticker feather');

    elements.ContextClipActions.cut.addEventListener('click',()=>saveContextClip({cut:true}));
    elements.ContextClipActions.copy.addEventListener('click',()=>saveContextClip());
    elements.ContextClipActions.paste.addEventListener('click',()=>{void pasteContextClip();});
    elements.ContextClipActions['slice-click'].addEventListener('click',()=>{void sliceContextClip();});
    elements.ContextClipActions['toggle-visible'].addEventListener('click',toggleContextClipVisible);
    elements.ContextClipActions['download-source'].addEventListener('click',downloadContextSource);
    elements.contextDownloadSection.addEventListener('click',downloadContextSection);
    elements.contextDownloadWav.addEventListener('click',downloadContextWav);
    elements.contextSplitNow.addEventListener('click', async () => { await splitTrackAtNow(state.contextTrackId); hideContextMenu(); });
    elements.contextAddLayer.addEventListener('click', addLayerFromContext);
    elements.contextExtractAudio.addEventListener('click', async () => { await extractAudioFromSelectedVideo(); hideContextMenu(); });
    elements.contextDuplicate.addEventListener('click', () => {
        // Right-click selection already targets this clip. Keep the existing
        // duplicate routine and Undo history; only its entry point has moved.
        hideContextMenu();
        void duplicateSelectedTracks();
    });
    elements.contextRemoveLayer.addEventListener('click', removeLayerFromContext);
    elements.clipChangeColour.addEventListener('click',()=>{void recolourClip();});
    elements.clipResetColour.addEventListener('click',resetClipColour);
    elements.laneRename.addEventListener('click',()=>{void renameLane();});
    elements.laneChangeColour.addEventListener('click',()=>{void recolourLane();});
    elements.laneResetColour.addEventListener('click',resetLaneColour);
    elements.laneDelete.addEventListener('click',()=>{void deleteLane();});
    document.addEventListener('click', (event) => {
        if (!elements.contextMenu.contains(event.target)) hideContextMenu();
        if (!elements.laneMenu.contains(event.target)) hideLaneContextMenu();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { hideContextMenu(); hideLaneContextMenu(); closeEditorAction(null); closeEditorModals(); elements.trackTypeMenu.hidden = true; elements.btnAddTrack.setAttribute('aria-expanded','false'); elements.snapOptionsMenu.hidden = true; elements.btnSnapOptions.setAttribute('aria-expanded','false'); }
        const modifier = event.ctrlKey || event.metaKey;
        const target = event.target;
        const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
        if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace') && state.selectedTrackIds.size) {
            event.preventDefault();
            void deleteSelectedTracks();
            return;
        }
        if(!isTyping && event.altKey && (event.key==='ArrowLeft'||event.key==='ArrowRight')) {
            event.preventDefault();nudgeTimeline(event.key==='ArrowLeft'?-1:1);return;
        }
        if (!modifier || isTyping) return;
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undoTimelineEdit(); }
        if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') { event.preventDefault(); redoTimelineEdit(); }
    });
    window.addEventListener('beforeunload', (event) => {
        saveProjectRecovery();
        if (exporter.busy || offlineExporter.busy) {
            event.preventDefault();
            event.returnValue = '';
        } else {
            // destroy() detaches media elements and mutates clip metadata.
            // pagehide fires after beforeunload, so suppress autosave after
            // teardown or a valid project could be replaced by empty clips.
            state.editorDisposing=true;
            engine.destroy();
        }
    });

    // Native mouseover hints for every visible interactive control, including
    // ranges, selects, menus and dynamically created timeline items. Preserve
    // hand-authored contextual titles (Undo, missing media, export limits).
    function ensureControlTooltip(control) {
        if (!control || control.title?.trim() || control.hasAttribute('hidden')) return;
        const labelledBy=control.getAttribute('aria-labelledby');
        const labelled=labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : '';
        const label=control.labels?.[0]?.textContent?.trim()
            || control.closest('label')?.textContent?.trim()
            || labelled
            || control.getAttribute('aria-label')
            || control.getAttribute('data-tooltip')
            || control.textContent?.trim()
            || control.id?.replace(/^(btn-|context-)/,'').replace(/[-_]/g,' ');
        if(label)control.title=String(label).replace(/\s+/g,' ').slice(0,180);
    }
    document.querySelectorAll('button,input:not([type="hidden"]),select,summary,[role="tab"]').forEach(ensureControlTooltip);
    document.addEventListener('pointerover',event=>{
        const control=event.target?.closest?.('button,input,select,summary,[role="tab"],.timeline-clip,.file-row,.lane-name');
        if(control)ensureControlTooltip(control);
    });
    function setupInspectorHeightLock(){
        const viewer=document.querySelector('.master-column');
        const inspector=document.querySelector('.right-column');
        if(!viewer||!inspector)return;
        let appliedHeight=0;
        const sync=()=>{
            if(window.matchMedia('(min-width:1121px)').matches){
                const height=Math.ceil(viewer.getBoundingClientRect().height);
                if(height>0&&height!==appliedHeight){
                    appliedHeight=height;
                    inspector.style.height=`${height}px`;
                    inspector.style.maxHeight=`${height}px`;
                }
            }else{
                appliedHeight=0;
                inspector.style.removeProperty('height');
                inspector.style.removeProperty('max-height');
            }
        };
        if(typeof ResizeObserver!=='undefined')new ResizeObserver(sync).observe(viewer);
        window.addEventListener('resize',sync,{passive:true});
        requestAnimationFrame(sync);
    }
    setupInspectorHeightLock();
    restoreMediaIndex();
    const recovered=restoreSavedProjectMetadata();
    initAssetLibrary();
    const generatedRestored=recreateGeneratedProjectOverlays();
    renderTransitionCatalog(); installPreviewResize(); installGlobalFileDrop(); applyCanvasResolution(); renderFiles(); refreshAll(); syncPreviewMuteButton(); syncPreviewZoom(); syncTimelineZoom(); syncSelectionTools(); updateHistoryButtons(); initVideoExportUi();
    // Autosave on change only, plus pagehide/visibilitychange for immediate
    // closes. Unlike a video cache this stores at most a few MB of JSON.
    window.setInterval(saveProjectRecovery,1500);
    window.addEventListener('pagehide',saveProjectRecovery);
    document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='hidden')saveProjectRecovery();
    });
    void (async()=>{
        try {
            await restoreRememberedMediaHandles();
            await loadRecoveredMediaTracks();
            if(recovered) {
                await engine.seek(Math.min(recovered.currentTime,engine.getTimelineDuration()),{resume:false});
                const offline=state.tracks.filter(track=>track.sourceName&&!track.media).length;
                showToast(offline
                    ? `Recovered ${state.tracks.length} clips, regenerated ${generatedRestored} overlays; ${offline} need relinking`
                    : `Recovered ${state.tracks.length} clips and ${generatedRestored} generated overlays`);
            }
        } catch(error) {
            console.warn('Project media recovery incomplete:',error);
            showToast('Project layout recovered; some media may need relinking');
        } finally {
            state.recoveryLoading=false;
            updateHistoryButtons();
            saveProjectRecovery();
        }
    })();
    requestAnimationFrame(() => showToast('MotoriClip Advanced v0.24 loaded — File Explorer drops, preview resize/zoom, delete and duplicate are active'));
})();
