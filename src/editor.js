/**
 * @fileoverview SARJ-CAM Editor entry orchestrator connecting modular canvas,
 * timeline, playback, storage, and UI subsystems.
 */

import './style.css';

// Utilities
import { formatTime, formatShortTime, formatBytes, padZero } from './utils/formatters.js';
import { validateVideoFile, validateProjectJson } from './utils/validation.js';
import { createId } from './utils/ids.js';

// Storage
import {
  initProjectStore,
  getAllProjects,
  saveProject,
  deleteProject,
  isStorageAvailable
} from './storage/projectStore.js';

// Editor Subsystems
import {
  createDefaultProject,
  getCurrentProject,
  setCurrentProject,
  getPlayheadTime,
  setPlayheadTime,
  getIsPlaying,
  getSelectedClipId,
  setSelectedClipId,
  getSelectedTextId,
  setSelectedTextId,
  getZoomLevel,
  setZoomLevel,
  getVideoSourceUrl,
  setVideoSourceUrl
} from './editor/state.js';

import {
  computeAspectRatioDimensions,
  drawStandbyCanvas,
  drawCanvasFrame
} from './editor/canvasRenderer.js';

import { startPlayback, pausePlayback, seekTimeline } from './editor/playback.js';

import {
  getTotalTimelineDuration,
  splitClipAtTime,
  deleteClipSegment,
  getPixelsPerSecond,
  generateRulerTicks
} from './editor/timeline.js';

import { createTextOverlay, updateTextOverlay, removeTextOverlay } from './editor/textOverlays.js';

import {
  setStatusText,
  setActiveToggle,
  addTilt,
  setupAccessibleModal,
  checkMobileResponsiveness
} from './editor/ui.js';

import { showNotification } from './editor/uiToast.js';

document.addEventListener('DOMContentLoaded', () => {
  /* ─────────────────────────────────────────────────────────
     1. DOM ELEMENT REFERENCES
     ───────────────────────────────────────────────────────── */
  // Navigation & Headers
  const btnNewProject = document.getElementById('btn-new-project');

  // Media Library & Upload
  const dropZone = document.getElementById('video-drop-zone');
  const btnSelectFile = document.getElementById('btn-select-file');
  const fileInput = document.getElementById('video-file-input');
  const loadedVideoContainer = document.getElementById('loaded-video-container');
  const loadedVideoName = document.getElementById('loaded-video-name');
  const btnRemoveVideo = document.getElementById('btn-remove-video');
  const metaDuration = document.getElementById('meta-duration');
  const metaSize = document.getElementById('meta-size');
  const projectsDbList = document.getElementById('projects-db-list');

  // Preview Workspace
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('editor-canvas'));
  const ctx = canvas.getContext('2d');
  const hiddenVideo = /** @type {HTMLVideoElement} */ (
    document.getElementById('hidden-video-element')
  );
  const crtOverlay = document.getElementById('crt-overlay');
  const timecodeHUD = document.getElementById('live-timecode');
  const canvasLoadingSpinner = document.getElementById('canvas-loading-spinner');
  const tapeReelIndicator = document.getElementById('tape-reel-indicator');
  const recDot = document.querySelector('#editor-rec-toggle .rec-dot');
  const recLabel = document.querySelector('#editor-rec-toggle .rec-label');

  // HUD Controls
  const btnPlayPause = document.getElementById('hud-btn-play-pause');
  const playPauseIcon = document.getElementById('play-pause-icon');
  const btnRewind = document.getElementById('hud-btn-rewind');
  const btnForward = document.getElementById('hud-btn-forward');
  const hudCurrentTime = document.getElementById('hud-current-time');
  const hudTotalDuration = document.getElementById('hud-total-duration');
  const btnMute = document.getElementById('hud-btn-mute');
  const muteIcon = document.getElementById('mute-icon');
  const volumeSlider = /** @type {HTMLInputElement} */ (
    document.getElementById('hud-volume-slider')
  );

  // Sidebar Properties
  const aspectButtons = document.querySelectorAll('[data-ratio]');
  const speedButtons = document.querySelectorAll('[data-speed]');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const activeTextOverlaysList = document.getElementById('active-text-overlays');
  const btnAddText = document.getElementById('btn-add-text');

  // Exports
  const btnRenderVideo = /** @type {HTMLButtonElement} */ (
    document.getElementById('btn-render-video')
  );
  const btnExportProject = /** @type {HTMLButtonElement} */ (
    document.getElementById('btn-export-project')
  );
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const projectImportInput = /** @type {HTMLInputElement} */ (
    document.getElementById('project-import-input')
  );

  // Timeline
  const btnTimelineSplit = /** @type {HTMLButtonElement} */ (
    document.getElementById('btn-timeline-split')
  );
  const btnTimelineDeleteClip = /** @type {HTMLButtonElement} */ (
    document.getElementById('btn-timeline-delete-clip')
  );
  const btnTimelineClear = document.getElementById('btn-timeline-clear');
  const timelineZoomSlider = /** @type {HTMLInputElement} */ (
    document.getElementById('timeline-zoom-slider')
  );
  const timelineScrollBox = document.getElementById('timeline-scroll-box');
  const timelineVessel = document.getElementById('timeline-vessel');
  const timelineRuler = document.getElementById('timeline-ruler-ticks');
  const videoTrackLane = document.getElementById('video-track-lane');
  const textTrackLane = document.getElementById('text-track-lane');
  const videoPlaceholder = document.getElementById('timeline-video-placeholder');
  const textPlaceholder = document.getElementById('timeline-text-placeholder');
  const timelinePlayhead = document.getElementById('timeline-playhead');
  const playheadDragHandle = document.getElementById('playhead-drag-handle');

  // Text Settings Modal
  const textSettingsModal = document.getElementById('text-settings-modal');
  const modalTextId = /** @type {HTMLInputElement} */ (document.getElementById('modal-text-id'));
  const modalInputText = /** @type {HTMLInputElement} */ (
    document.getElementById('modal-input-text')
  );
  const modalInputStart = /** @type {HTMLInputElement} */ (
    document.getElementById('modal-input-start')
  );
  const modalInputEnd = /** @type {HTMLInputElement} */ (
    document.getElementById('modal-input-end')
  );
  const modalInputFontSize = /** @type {HTMLInputElement} */ (
    document.getElementById('modal-input-font-size')
  );
  const modalFontSizeVal = document.getElementById('modal-font-size-val');
  const modalInputX = /** @type {HTMLInputElement} */ (document.getElementById('modal-input-x'));
  const modalXVal = document.getElementById('modal-x-val');
  const modalInputY = /** @type {HTMLInputElement} */ (document.getElementById('modal-input-y'));
  const modalYVal = document.getElementById('modal-y-val');
  const btnModalDelete = document.getElementById('btn-modal-delete');
  const btnModalSave = document.getElementById('btn-modal-save');
  const btnModalClose = document.getElementById('btn-modal-close');
  const modalColorButtons = document.querySelectorAll('.color-picker-btn');

  // Render Video Modal
  const renderOverlay = document.getElementById('editor-export-overlay');
  const renderStatusTitle = document.getElementById('render-status-title');
  const renderExportCanvas = /** @type {HTMLCanvasElement} */ (
    document.getElementById('render-export-canvas')
  );
  const renderStatusIcon = document.getElementById('render-status-icon');
  const renderStatusMessage = document.getElementById('render-status-message');
  const renderStatusSubtitle = document.getElementById('render-status-subtitle');
  const renderProgressBar = document.getElementById('render-progress-bar');
  const renderProgressPercent = document.getElementById('render-progress-percent');
  const renderDoneActions = document.getElementById('render-done-actions');
  const btnDownloadRender = document.getElementById('btn-download-render');
  const btnCloseRenderOverlay = document.getElementById('btn-close-render-overlay');

  let activeRenderJob = null;
  let activeRenderVideoUrl = null;
  let isScrubbing = false;

  /* ─────────────────────────────────────────────────────────
     2. INITIALIZATION & STORAGE GUARD
     ───────────────────────────────────────────────────────── */
  checkMobileResponsiveness();
  window.addEventListener('resize', checkMobileResponsiveness);
  addTilt(document.getElementById('camcorder-frame'), 3);

  // Setup accessible focus traps and escape key handlers for modals
  setupAccessibleModal(textSettingsModal, btnModalClose, () => closeTextModal());
  setupAccessibleModal(renderOverlay, btnCloseRenderOverlay, () => closeRenderOverlay());

  initProjectStore().then(({ inMemory }) => {
    if (inMemory) {
      setStatusText('DB: OFFLINE (IN-MEMORY)', 'orange');
      showNotification(
        'IndexedDB is unavailable (private mode or disabled). Session will save in-memory only.',
        'warning'
      );
    } else {
      setStatusText('SYSTEM: ONLINE', 'green');
    }
    refreshProjectsList();
    createNewProject(false);
  });

  /* ─────────────────────────────────────────────────────────
     3. CANVAS RENDERING & ASPECT HELPERS
     ───────────────────────────────────────────────────────── */
  function updateCanvasDimensions() {
    const proj = getCurrentProject();
    const dims = computeAspectRatioDimensions(proj.aspectRatio);
    canvas.width = dims.width;
    canvas.height = dims.height;
  }

  function renderCurrentFrame() {
    const proj = getCurrentProject();
    if (!hiddenVideo.src || hiddenVideo.readyState < 2) {
      drawStandbyCanvas(ctx, canvas.width, canvas.height, 'CAM VIEWER: STANDBY');
      return;
    }

    drawCanvasFrame(ctx, canvas, hiddenVideo, proj, getPlayheadTime());

    // Update timecode HUD in viewfinder
    const pTime = getPlayheadTime();
    const frameNumber = Math.floor((pTime % 1) * 30);
    const totalSecs = Math.floor(pTime);
    const min = Math.floor(totalSecs / 60);
    const sec = totalSecs % 60;
    const hrs = Math.floor(min / 60);
    timecodeHUD.textContent = `${padZero(hrs)}:${padZero(min % 60)}:${padZero(sec)}:${padZero(frameNumber)}`;

    hudCurrentTime.textContent = formatTime(pTime);
  }

  /* ─────────────────────────────────────────────────────────
     4. TIMELINE RENDERING
     ───────────────────────────────────────────────────────── */
  function updateRuler() {
    timelineRuler.innerHTML = '';
    const proj = getCurrentProject();
    const duration = getTotalTimelineDuration(proj.clips);
    if (duration <= 0) return;

    const pps = getPixelsPerSecond(getZoomLevel());
    timelineVessel.style.width = `${duration * pps}px`;

    const ticks = generateRulerTicks(duration, getZoomLevel());
    ticks.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'timeline-tick' + (t.isMajor ? ' major' : '');
      el.style.left = `${t.time * pps}px`;
      if (t.isMajor) {
        el.innerHTML = `<span style="margin-left: 2px;">${t.label}</span>`;
      }
      timelineRuler.appendChild(el);
    });
  }

  function renderTimelineSegments() {
    const proj = getCurrentProject();
    videoTrackLane.querySelectorAll('.video-segment-block').forEach((el) => el.remove());
    textTrackLane.querySelectorAll('.text-segment-block').forEach((el) => el.remove());

    if (!proj.clips || proj.clips.length === 0) {
      videoPlaceholder.classList.remove('hidden');
      textPlaceholder.classList.remove('hidden');
      btnTimelineSplit.disabled = true;
      btnTimelineDeleteClip.disabled = true;
      return;
    }

    videoPlaceholder.classList.add('hidden');
    btnTimelineSplit.disabled = false;

    const pps = getPixelsPerSecond(getZoomLevel());
    let currentX = 0;

    // 1. Video Clips Lane
    proj.clips.forEach((clip) => {
      const widthPx = clip.duration * pps;
      const block = document.createElement('div');
      block.className = 'video-segment-block';
      if (getSelectedClipId() === clip.id) block.classList.add('selected');
      block.style.left = `${currentX}px`;
      block.style.width = `${widthPx}px`;

      block.innerHTML = `
        <span class="segment-name">${proj.videoName || 'Clip'}</span>
        <span class="segment-duration">${clip.duration.toFixed(1)}s</span>
      `;

      block.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedClipId(getSelectedClipId() === clip.id ? null : clip.id);
        setSelectedTextId(null);
        renderTimelineSegments();
      });

      videoTrackLane.appendChild(block);
      currentX += widthPx;
    });

    btnTimelineDeleteClip.disabled = getSelectedClipId() === null && getSelectedTextId() === null;

    // 2. Text Overlays Lane
    if (proj.texts && proj.texts.length > 0) {
      textPlaceholder.classList.add('hidden');
      proj.texts.forEach((txt) => {
        const leftPx = txt.start * pps;
        const widthPx = (txt.end - txt.start) * pps;

        const block = document.createElement('div');
        block.className = 'text-segment-block';
        if (getSelectedTextId() === txt.id) block.classList.add('selected');
        block.style.left = `${leftPx}px`;
        block.style.width = `${widthPx}px`;

        block.innerHTML = `
          <span class="segment-name">${txt.text}</span>
          <span class="segment-duration">${(txt.end - txt.start).toFixed(1)}s</span>
        `;

        block.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedTextId(getSelectedTextId() === txt.id ? null : txt.id);
          setSelectedClipId(null);
          renderTimelineSegments();
          if (getSelectedTextId()) {
            openTextModal(txt.id);
          }
        });

        textTrackLane.appendChild(block);
      });
    } else {
      textPlaceholder.classList.remove('hidden');
    }

    hudTotalDuration.textContent = formatTime(getTotalTimelineDuration(proj.clips));
    updatePlayheadDOM();
  }

  function updatePlayheadDOM() {
    const pps = getPixelsPerSecond(getZoomLevel());
    const leftPx = getPlayheadTime() * pps;
    timelinePlayhead.style.left = `${leftPx}px`;

    if (getIsPlaying() && !isScrubbing) {
      const viewW = timelineScrollBox.offsetWidth;
      const scrollL = timelineScrollBox.scrollLeft;
      if (leftPx > scrollL + viewW - 100 || leftPx < scrollL) {
        timelineScrollBox.scrollLeft = leftPx - viewW / 2;
      }
    }
  }

  function handleScrub(e) {
    const proj = getCurrentProject();
    if (!proj.videoBlob && !hiddenVideo.src) return;
    const rect = timelineVessel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / getPixelsPerSecond(getZoomLevel());
    seekTimeline(time, hiddenVideo, proj, renderCurrentFrame);
    updatePlayheadDOM();
  }

  playheadDragHandle.addEventListener('mousedown', () => {
    isScrubbing = true;
    if (getIsPlaying()) {
      pausePlayback(hiddenVideo, updatePlayPauseUI);
      playheadDragHandle.setAttribute('data-was-playing', 'true');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isScrubbing) handleScrub(e);
  });

  document.addEventListener('mouseup', () => {
    if (isScrubbing) {
      isScrubbing = false;
      if (playheadDragHandle.getAttribute('data-was-playing') === 'true') {
        playheadDragHandle.removeAttribute('data-was-playing');
        startPlayback(hiddenVideo, getCurrentProject(), onPlayFrame, updatePlayPauseUI);
      }
    }
  });

  timelineVessel.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (
      target.classList.contains('video-segment-block') ||
      target.classList.contains('text-segment-block') ||
      isScrubbing
    )
      return;
    handleScrub(e);
  });

  timelineZoomSlider.addEventListener('input', () => {
    setZoomLevel(parseFloat(timelineZoomSlider.value));
    updateRuler();
    renderTimelineSegments();
    updatePlayheadDOM();
  });

  /* ─────────────────────────────────────────────────────────
     5. PLAYBACK CONTROLS
     ───────────────────────────────────────────────────────── */
  function onPlayFrame() {
    renderCurrentFrame();
    updatePlayheadDOM();
  }

  function updatePlayPauseUI(playing) {
    if (playing) {
      playPauseIcon.textContent = 'pause';
      tapeReelIndicator.style.animationPlayState = 'running';
      if (recDot) recDot.classList.add('blink');
      if (recLabel) {
        recLabel.textContent = 'PLAY';
        recLabel.style.color = '#2ddbde';
      }
    } else {
      playPauseIcon.textContent = 'play_arrow';
      tapeReelIndicator.style.animationPlayState = 'paused';
      if (recDot) recDot.classList.remove('blink');
      if (recLabel) {
        recLabel.textContent = 'PAUSED';
        recLabel.style.color = '#ec648c';
      }
    }
  }

  btnPlayPause.addEventListener('click', () => {
    if (getIsPlaying()) {
      pausePlayback(hiddenVideo, updatePlayPauseUI);
    } else {
      startPlayback(hiddenVideo, getCurrentProject(), onPlayFrame, updatePlayPauseUI);
    }
  });

  btnRewind.addEventListener('click', () => {
    seekTimeline(getPlayheadTime() - 5, hiddenVideo, getCurrentProject(), renderCurrentFrame);
    updatePlayheadDOM();
  });

  btnForward.addEventListener('click', () => {
    seekTimeline(getPlayheadTime() + 5, hiddenVideo, getCurrentProject(), renderCurrentFrame);
    updatePlayheadDOM();
  });

  btnMute.addEventListener('click', () => {
    hiddenVideo.muted = !hiddenVideo.muted;
    muteIcon.textContent = hiddenVideo.muted ? 'volume_off' : 'volume_up';
  });

  volumeSlider.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    hiddenVideo.volume = vol;
    getCurrentProject().volume = vol;
    muteIcon.textContent = vol === 0 ? 'volume_off' : 'volume_up';
    saveCurrentProject();
  });

  document.addEventListener('keydown', (e) => {
    const tag = ((e.target && /** @type {HTMLElement} */ (e.target).tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (getIsPlaying()) pausePlayback(hiddenVideo, updatePlayPauseUI);
      else startPlayback(hiddenVideo, getCurrentProject(), onPlayFrame, updatePlayPauseUI);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      seekTimeline(getPlayheadTime() - 1, hiddenVideo, getCurrentProject(), renderCurrentFrame);
      updatePlayheadDOM();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      seekTimeline(getPlayheadTime() + 1, hiddenVideo, getCurrentProject(), renderCurrentFrame);
      updatePlayheadDOM();
    }
  });

  /* ─────────────────────────────────────────────────────────
     6. VIDEO FILE PROCESSING WITH VALIDATION
     ───────────────────────────────────────────────────────── */
  function loadVideoBlob(blob, isNewFile = true, customName = '') {
    // File validation check
    const validation = validateVideoFile(blob);
    if (!validation.isValid) {
      showNotification(validation.error || 'Invalid file', 'error');
      return;
    }

    canvasLoadingSpinner.classList.remove('hidden');
    setStatusText('SYNCING TAPE...', 'orange');

    setVideoSourceUrl(URL.createObjectURL(blob));
    hiddenVideo.src = getVideoSourceUrl();
    hiddenVideo.load();

    hiddenVideo.onloadedmetadata = () => {
      const duration = hiddenVideo.duration;
      canvasLoadingSpinner.classList.add('hidden');
      setStatusText(isStorageAvailable() ? 'TAPE LOADED' : 'TAPE LOADED (IN-MEMORY)', 'green');

      loadedVideoContainer.classList.remove('hidden');
      dropZone.classList.add('hidden');

      const proj = getCurrentProject();
      const fileName =
        customName || (blob instanceof File ? blob.name : proj.videoName || 'imported_clip.mp4');

      loadedVideoName.textContent = fileName;
      metaDuration.textContent = formatShortTime(duration);
      metaSize.textContent = formatBytes(blob.size || proj.videoSize);

      if (isNewFile) {
        proj.videoBlob = blob;
        proj.videoName = fileName;
        proj.videoSize = blob.size;
        proj.videoDuration = duration;
        proj.clips = [
          {
            id: createId('clip'),
            start: 0,
            end: duration,
            duration: duration
          }
        ];
        proj.texts = [];
        saveCurrentProject();
      }

      btnRenderVideo.disabled = false;
      btnExportProject.disabled = false;

      updateCanvasDimensions();
      updateRuler();
      renderTimelineSegments();
      updatePlayheadDOM();
      renderCurrentFrame();

      showNotification(`Video loaded: ${fileName} (${formatShortTime(duration)})`, 'success');
    };

    hiddenVideo.onerror = (e) => {
      canvasLoadingSpinner.classList.add('hidden');
      setStatusText('DECODING ERROR', 'orange');
      showNotification(
        'Error decoding video file. Please ensure it is a valid HTML5 format (MP4/WebM).',
        'error'
      );
      console.error('[Decoder] Video element error:', e);
    };
  }

  // Drag and Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      loadVideoBlob(files[0], true);
    }
  });

  btnSelectFile.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      loadVideoBlob(fileInput.files[0], true);
    }
  });

  btnRemoveVideo.addEventListener('click', () => {
    if (confirm('Remove current raw video? All trims and edits on this project will be reset.')) {
      createNewProject(false);
      showNotification('Video removed and project reset.', 'info');
    }
  });

  /* ─────────────────────────────────────────────────────────
     7. TIMELINE ACTIONS (SPLIT, DELETE, RESET)
     ───────────────────────────────────────────────────────── */
  btnTimelineSplit.addEventListener('click', () => {
    const proj = getCurrentProject();
    const result = splitClipAtTime(proj.clips, getPlayheadTime());

    if (!result.success) {
      showNotification(result.error || 'Cannot split clip here', 'warning');
      return;
    }

    proj.clips = result.clips;
    saveCurrentProject();
    renderTimelineSegments();
    updateRuler();
    seekTimeline(getPlayheadTime(), hiddenVideo, proj, renderCurrentFrame);
    showNotification('Clip split successfully.', 'success');
  });

  btnTimelineDeleteClip.addEventListener('click', () => {
    const proj = getCurrentProject();

    if (getSelectedClipId()) {
      proj.clips = deleteClipSegment(proj.clips, getSelectedClipId());
      setSelectedClipId(null);
      saveCurrentProject();
      renderTimelineSegments();
      updateRuler();
      seekTimeline(0, hiddenVideo, proj, renderCurrentFrame);
      showNotification('Clip segment removed.', 'info');
    } else if (getSelectedTextId()) {
      proj.texts = removeTextOverlay(proj.texts, getSelectedTextId());
      setSelectedTextId(null);
      saveCurrentProject();
      renderTimelineSegments();
      renderActiveTextOverlaysUI();
      renderCurrentFrame();
      showNotification('Text overlay removed.', 'info');
    }
  });

  btnTimelineClear.addEventListener('click', () => {
    const proj = getCurrentProject();
    if (!proj.videoDuration) return;

    if (
      confirm('Reset project timeline? This will restore the full video clip and remove titles.')
    ) {
      proj.clips = [
        {
          id: createId('clip'),
          start: 0,
          end: proj.videoDuration,
          duration: proj.videoDuration
        }
      ];
      proj.texts = [];
      setSelectedClipId(null);
      setSelectedTextId(null);

      saveCurrentProject();
      renderTimelineSegments();
      updateRuler();
      seekTimeline(0, hiddenVideo, proj, renderCurrentFrame);
      renderActiveTextOverlaysUI();
      showNotification('Project timeline reset.', 'info');
    }
  });

  /* ─────────────────────────────────────────────────────────
     8. ASPECT RATIO, SPEED & FILTER INSPECTORS
     ───────────────────────────────────────────────────────── */
  aspectButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const ratio = btn.getAttribute('data-ratio');
      if (!ratio) return;
      setActiveToggle(aspectButtons, ratio, 'ratio');
      getCurrentProject().aspectRatio = ratio;
      updateCanvasDimensions();
      renderCurrentFrame();
      saveCurrentProject();
    });
  });

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const speedStr = btn.getAttribute('data-speed');
      if (!speedStr) return;
      const speed = parseFloat(speedStr);
      setActiveToggle(speedButtons, speedStr, 'speed');
      getCurrentProject().speed = speed;
      hiddenVideo.playbackRate = speed;
      saveCurrentProject();
    });
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') || 'none';
      setActiveToggle(filterButtons, filter, 'filter');
      getCurrentProject().filter = filter;

      if (filter === 'scanlines') {
        crtOverlay.style.display = 'block';
      } else {
        crtOverlay.style.display = 'none';
      }

      renderCurrentFrame();
      saveCurrentProject();
    });
  });

  /* ─────────────────────────────────────────────────────────
     9. TITLE OVERLAYS & ACCESSIBLE MODAL
     ───────────────────────────────────────────────────────── */
  function renderActiveTextOverlaysUI() {
    activeTextOverlaysList.innerHTML = '';
    const proj = getCurrentProject();

    if (!proj.texts || proj.texts.length === 0) {
      activeTextOverlaysList.innerHTML = '<p class="no-items-text">No text overlays added yet.</p>';
      return;
    }

    proj.texts.forEach((txt) => {
      const item = document.createElement('div');
      item.className = 'text-overlay-pill';

      const info = document.createElement('div');
      info.className = 'text-overlay-pill-info';
      info.setAttribute('tabindex', '0');
      info.setAttribute('role', 'button');
      info.setAttribute('aria-label', `Edit title ${txt.text}`);
      info.innerHTML = `
        <span class="pill-text-content">${txt.text}</span>
        <span class="pill-time-range">Time: ${txt.start.toFixed(1)}s - ${txt.end.toFixed(1)}s</span>
      `;
      info.addEventListener('click', () => openTextModal(txt.id));
      info.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTextModal(txt.id);
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-item';
      delBtn.setAttribute('aria-label', `Delete title ${txt.text}`);
      delBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
      delBtn.addEventListener('click', () => {
        proj.texts = removeTextOverlay(proj.texts, txt.id);
        saveCurrentProject();
        renderTimelineSegments();
        renderActiveTextOverlaysUI();
        renderCurrentFrame();
        showNotification('Title overlay deleted.', 'info');
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      activeTextOverlaysList.appendChild(item);
    });
  }

  btnAddText.addEventListener('click', () => {
    const proj = getCurrentProject();
    if (!proj.videoBlob && !hiddenVideo.src) {
      showNotification('Please upload a video file before adding titles.', 'warning');
      return;
    }

    const duration = getTotalTimelineDuration(proj.clips);
    const newText = createTextOverlay('CYBER TITLE', getPlayheadTime(), 4, duration);
    proj.texts.push(newText);

    saveCurrentProject();
    renderTimelineSegments();
    renderActiveTextOverlaysUI();
    renderCurrentFrame();
    showNotification('New title added. Click to edit properties.', 'success');
  });

  function openTextModal(id) {
    const proj = getCurrentProject();
    const item = proj.texts.find((t) => t.id === id);
    if (!item) return;

    modalTextId.value = item.id;
    modalInputText.value = item.text;
    modalInputStart.value = item.start.toFixed(1);
    modalInputEnd.value = item.end.toFixed(1);
    modalInputFontSize.value = String(item.fontSize || 28);
    modalFontSizeVal.textContent = (item.fontSize || 28) + 'px';
    modalInputX.value = String(item.x !== undefined ? item.x : 50);
    modalXVal.textContent = (item.x !== undefined ? item.x : 50) + '%';
    modalInputY.value = String(item.y !== undefined ? item.y : 50);
    modalYVal.textContent = (item.y !== undefined ? item.y : 50) + '%';

    modalColorButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-color') === item.color);
    });

    textSettingsModal.classList.remove('hidden');
    textSettingsModal.setAttribute('aria-hidden', 'false');
    modalInputText.focus();
  }

  function closeTextModal() {
    textSettingsModal.classList.add('hidden');
    textSettingsModal.setAttribute('aria-hidden', 'true');
    setSelectedTextId(null);
    renderTimelineSegments();
  }

  modalInputFontSize.addEventListener('input', () => {
    modalFontSizeVal.textContent = modalInputFontSize.value + 'px';
  });

  modalInputX.addEventListener('input', () => {
    modalXVal.textContent = modalInputX.value + '%';
  });

  modalInputY.addEventListener('input', () => {
    modalYVal.textContent = modalInputY.value + '%';
  });

  modalColorButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modalColorButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  btnModalSave.addEventListener('click', () => {
    const proj = getCurrentProject();
    const id = modalTextId.value;
    const activeColorBtn = document.querySelector('.color-picker-btn.active');

    const updates = {
      text: modalInputText.value,
      start: parseFloat(modalInputStart.value),
      end: parseFloat(modalInputEnd.value),
      fontSize: parseInt(modalInputFontSize.value, 10),
      x: parseInt(modalInputX.value, 10),
      y: parseInt(modalInputY.value, 10),
      color: activeColorBtn ? activeColorBtn.getAttribute('data-color') : '#ffffff'
    };

    const result = updateTextOverlay(proj.texts, id, updates);
    if (!result.success) {
      showNotification(result.error || 'Invalid time settings', 'error');
      return;
    }

    proj.texts = result.texts;
    saveCurrentProject();
    renderTimelineSegments();
    renderActiveTextOverlaysUI();
    closeTextModal();
    renderCurrentFrame();
    showNotification('Title properties updated.', 'success');
  });

  btnModalDelete.addEventListener('click', () => {
    const proj = getCurrentProject();
    const id = modalTextId.value;
    proj.texts = removeTextOverlay(proj.texts, id);
    saveCurrentProject();
    renderTimelineSegments();
    renderActiveTextOverlaysUI();
    closeTextModal();
    renderCurrentFrame();
    showNotification('Title deleted.', 'info');
  });

  /* ─────────────────────────────────────────────────────────
     10. PROJECT PERSISTENCE (SAVE / LOAD / DELETE / NEW)
     ───────────────────────────────────────────────────────── */
  function saveCurrentProject() {
    const proj = getCurrentProject();
    if (!proj) return;
    proj.updatedAt = Date.now();

    saveProject(proj).then(() => {
      refreshProjectsList();
    });
  }

  function createNewProject(promptUser = true) {
    let name = 'SARJ-' + new Date().toLocaleTimeString();
    if (promptUser) {
      const userInput = prompt('Enter a name for this project:', 'SARJ Project');
      if (userInput === null) return;
      if (userInput.trim() !== '') name = userInput.trim();
    }

    pausePlayback(hiddenVideo, updatePlayPauseUI);
    setVideoSourceUrl(null);
    hiddenVideo.src = '';

    const newProj = createDefaultProject(name);
    setCurrentProject(newProj);
    setSelectedClipId(null);
    setSelectedTextId(null);
    setPlayheadTime(0);

    resetUIForEmptyProject();
    setStatusText(isStorageAvailable() ? 'NEW PROJECT' : 'NEW PROJECT (IN-MEMORY)');
  }

  function resetUIForEmptyProject() {
    loadedVideoContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    btnRenderVideo.disabled = true;
    btnExportProject.disabled = true;
    btnTimelineSplit.disabled = true;
    btnTimelineDeleteClip.disabled = true;

    updateCanvasDimensions();
    drawStandbyCanvas(ctx, canvas.width, canvas.height);

    videoPlaceholder.classList.remove('hidden');
    textPlaceholder.classList.remove('hidden');
    videoTrackLane.querySelectorAll('.video-segment-block').forEach((el) => el.remove());
    textTrackLane.querySelectorAll('.text-segment-block').forEach((el) => el.remove());
    activeTextOverlaysList.innerHTML = '<p class="no-items-text">No text overlays added yet.</p>';

    hudCurrentTime.textContent = '00:00.00';
    hudTotalDuration.textContent = '00:00.00';
    timelineVessel.style.width = '100%';
    timelineRuler.innerHTML = '';
    timelinePlayhead.style.left = '0px';

    setActiveToggle(aspectButtons, '16/9', 'ratio');
    setActiveToggle(speedButtons, '1.0', 'speed');
    setActiveToggle(filterButtons, 'none', 'filter');
    crtOverlay.style.display = 'none';
  }

  function loadProjectIntoWorkspace(proj) {
    pausePlayback(hiddenVideo, updatePlayPauseUI);
    setCurrentProject(proj);
    setStatusText(`LOADED: ${proj.name.toUpperCase()}`);

    setActiveToggle(aspectButtons, proj.aspectRatio, 'ratio');
    setActiveToggle(speedButtons, String(proj.speed), 'speed');
    setActiveToggle(filterButtons, proj.filter, 'filter');
    volumeSlider.value = String(proj.volume !== undefined ? proj.volume : 0.8);
    hiddenVideo.volume = proj.volume !== undefined ? proj.volume : 0.8;
    hiddenVideo.playbackRate = proj.speed || 1.0;

    crtOverlay.style.display = proj.filter === 'scanlines' ? 'block' : 'none';

    setSelectedClipId(null);
    setSelectedTextId(null);
    setPlayheadTime(0);

    if (proj.videoBlob) {
      loadVideoBlob(proj.videoBlob, false, proj.videoName);
    } else {
      resetUIForEmptyProject();
      dropZone.classList.remove('hidden');
      loadedVideoContainer.classList.add('hidden');
      showNotification(
        `Project "${proj.name}" loaded. Please re-select the source video to sync timeline.`,
        'info'
      );
    }

    renderActiveTextOverlaysUI();
  }

  function refreshProjectsList() {
    getAllProjects().then((projects) => {
      projectsDbList.innerHTML = '';
      if (!projects || projects.length === 0) {
        projectsDbList.innerHTML = `
          <div class="no-projects-placeholder">
            <span class="material-symbols-outlined">info</span>
            <span>No saved projects yet.</span>
          </div>`;
        return;
      }

      projects.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'db-project-item';

        const details = document.createElement('div');
        details.className = 'project-item-details';
        details.setAttribute('tabindex', '0');
        details.setAttribute('role', 'button');
        details.setAttribute('aria-label', `Open project ${p.name}`);
        details.innerHTML = `
          <span class="project-item-name">${p.name}</span>
          <span class="project-item-date">Updated: ${new Date(p.updatedAt).toLocaleString()}</span>
        `;
        details.addEventListener('click', () => loadProjectIntoWorkspace(p));
        details.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            loadProjectIntoWorkspace(p);
          }
        });

        const actions = document.createElement('div');
        actions.className = 'project-item-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon-sm delete';
        deleteBtn.setAttribute('aria-label', `Delete project ${p.name}`);
        deleteBtn.innerHTML =
          '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete project "${p.name}"?`)) {
            deleteProject(p.id).then(() => {
              refreshProjectsList();
              if (getCurrentProject().id === p.id) {
                createNewProject(false);
              }
              showNotification(`Project "${p.name}" deleted.`, 'info');
            });
          }
        });

        actions.appendChild(deleteBtn);
        item.appendChild(details);
        item.appendChild(actions);
        projectsDbList.appendChild(item);
      });
    });
  }

  btnNewProject.addEventListener('click', () => createNewProject(true));

  /* ─────────────────────────────────────────────────────────
     11. JSON IMPORT & EXPORT
     ───────────────────────────────────────────────────────── */
  btnExportProject.addEventListener('click', () => {
    const proj = getCurrentProject();
    if (!proj) return;

    const payload = {
      sarjcam_project: true,
      name: proj.name,
      aspectRatio: proj.aspectRatio,
      speed: proj.speed,
      filter: proj.filter,
      volume: proj.volume,
      clips: proj.clips,
      texts: proj.texts,
      videoName: proj.videoName,
      videoSize: proj.videoSize,
      videoDuration: proj.videoDuration,
      exportedAt: new Date().toISOString()
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `${proj.name.toLowerCase().replace(/\s+/g, '_')}_project.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();

    showNotification('Project configuration exported as JSON.', 'success');
  });

  btnTriggerImport.addEventListener('click', () => projectImportInput.click());

  projectImportInput.addEventListener('change', () => {
    const file = projectImportInput.files && projectImportInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(/** @type {string} */ (e.target.result));
        const validation = validateProjectJson(config);
        if (!validation.isValid) {
          showNotification(validation.error || 'Invalid project file.', 'error');
          return;
        }

        const imported = {
          id: createId('proj'),
          name: config.name || 'Imported Project',
          videoBlob: null,
          videoName: config.videoName || '',
          videoSize: config.videoSize || 0,
          videoDuration: config.videoDuration || 0,
          updatedAt: Date.now(),
          aspectRatio: config.aspectRatio || '16/9',
          speed: config.speed || 1.0,
          filter: config.filter || 'none',
          volume: config.volume !== undefined ? config.volume : 0.8,
          clips: config.clips || [],
          texts: config.texts || []
        };

        saveProject(imported).then(() => {
          loadProjectIntoWorkspace(imported);
          refreshProjectsList();
          showNotification(
            `Project "${imported.name}" loaded from JSON. Please select "${imported.videoName}" to sync video frames.`,
            'info',
            6000
          );
        });
      } catch (err) {
        showNotification(`Failed to parse project JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    projectImportInput.value = '';
  });

  /* ─────────────────────────────────────────────────────────
     12. CANVAS WEBM VIDEO RENDER ENGINE (DYNAMIC IMPORT)
     ───────────────────────────────────────────────────────── */
  btnRenderVideo.addEventListener('click', async () => {
    const proj = getCurrentProject();
    if (!proj.videoBlob && !hiddenVideo.src) return;

    // Dynamically load the export engine module on-demand
    const { checkRenderSupport, startExportRender } = await import('./editor/exportRender.js');
    const support = checkRenderSupport();
    if (!support.supported) {
      showNotification(support.error || 'MediaRecorder unsupported in this browser.', 'error');
      return;
    }

    pausePlayback(hiddenVideo, updatePlayPauseUI);

    renderOverlay.classList.remove('hidden');
    renderOverlay.classList.add('show');
    renderOverlay.setAttribute('aria-hidden', 'false');
    renderDoneActions.classList.add('hidden');
    renderProgressBar.style.width = '0%';
    renderProgressPercent.textContent = '0%';
    renderStatusTitle.textContent = 'RENDERING TAPE';
    renderStatusMessage.textContent = 'Rendering retro frames...';
    renderStatusSubtitle.textContent =
      'Recording canvas frames to WebM. Keep this browser window focused.';
    renderStatusIcon.innerHTML =
      '<span class="material-symbols-outlined spinning-icon">sync</span>';

    if (activeRenderVideoUrl) {
      URL.revokeObjectURL(activeRenderVideoUrl);
      activeRenderVideoUrl = null;
    }

    renderExportCanvas.width = canvas.width;
    renderExportCanvas.height = canvas.height;

    activeRenderJob = startExportRender({
      exportCanvas: renderExportCanvas,
      videoElement: hiddenVideo,
      project: proj,
      onProgress: (percent) => {
        renderProgressBar.style.width = `${percent}%`;
        renderProgressPercent.textContent = `${percent}%`;
      },
      onComplete: (blobUrl) => {
        activeRenderVideoUrl = blobUrl;
        renderProgressBar.style.width = '100%';
        renderProgressPercent.textContent = '100%';
        renderStatusTitle.textContent = 'RENDER COMPLETE';
        renderStatusMessage.textContent = 'Project successfully compiled!';
        renderStatusSubtitle.textContent = 'Ready for digital download.';
        renderStatusIcon.innerHTML =
          '<span class="material-symbols-outlined" style="color:#2ddbde; font-size:64px;">check_circle</span>';
        renderDoneActions.classList.remove('hidden');
        showNotification('WebM video render completed successfully!', 'success');
      },
      onError: (err) => {
        renderStatusTitle.textContent = 'RENDER FAILED';
        renderStatusMessage.textContent = 'An error occurred during video rendering.';
        renderStatusSubtitle.textContent = err.message || 'Media encoding failed.';
        renderStatusIcon.innerHTML =
          '<span class="material-symbols-outlined" style="color:#ec648c; font-size:64px;">error</span>';
        showNotification(`Render error: ${err.message}`, 'error');
        setTimeout(() => {
          closeRenderOverlay();
        }, 3000);
      }
    });
  });

  btnDownloadRender.addEventListener('click', () => {
    if (!activeRenderVideoUrl) return;
    const proj = getCurrentProject();
    const a = document.createElement('a');
    a.href = activeRenderVideoUrl;
    a.download = `${proj.name.toLowerCase().replace(/\s+/g, '_')}_render.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showNotification('Download started.', 'success');
  });

  function closeRenderOverlay() {
    if (activeRenderJob) {
      activeRenderJob.abort();
      activeRenderJob = null;
    }
    renderOverlay.classList.remove('show');
    renderOverlay.classList.add('hidden');
    renderOverlay.setAttribute('aria-hidden', 'true');
    hiddenVideo.muted = true;
    seekTimeline(0, hiddenVideo, getCurrentProject(), renderCurrentFrame);
  }

  btnCloseRenderOverlay.addEventListener('click', closeRenderOverlay);

  /* ─────────────────────────────────────────────────────────
     13. SIDEBAR DRAWER COLLAPSIBLE CONTROLS
     ───────────────────────────────────────────────────────── */
  const dockBtns = document.querySelectorAll('.dock-btn');
  const drawerTabContents = document.querySelectorAll('.drawer-tab-content');
  const editorDrawer = document.getElementById('editor-drawer');

  dockBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      const isAlreadyActive = btn.classList.contains('active');

      dockBtns.forEach((b) => b.classList.remove('active'));
      drawerTabContents.forEach((t) => t.classList.remove('active'));

      if (isAlreadyActive) {
        editorDrawer.classList.add('collapsed');
      } else {
        editorDrawer.classList.remove('collapsed');
        btn.classList.add('active');
        const targetContent = document.getElementById(`tab-content-${targetTab}`);
        if (targetContent) targetContent.classList.add('active');
      }
    });
  });
});
