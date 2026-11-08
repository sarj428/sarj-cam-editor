import './style.css';

document.addEventListener('DOMContentLoaded', () => {

  /* ─────────────────────────────────────────────────────────
     1. INDEXEDDB DATABASE MANAGER
     ───────────────────────────────────────────────────────── */
  const DB_NAME = 'sarj_cam_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  let db = null;

  function initDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (e) => {
        console.error('[DB] Error opening database:', e);
        setStatusText('SYSTEM: DB ERROR', 'orange');
        reject(e);
      };
      
      request.onsuccess = (e) => {
        db = e.target.result;
        console.log('[DB] Database initialized successfully.');
        resolve(db);
      };
      
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          console.log('[DB] Object store created.');
        }
      };
    });
  }

  function getAllProjects() {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized');
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function getProject(id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized');
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function saveProject(project) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized');
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(project);
      
      request.onsuccess = () => {
        console.log(`[DB] Project "${project.name}" saved.`);
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function deleteProject(id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject('Database not initialized');
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log(`[DB] Project ${id} deleted.`);
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /* ─────────────────────────────────────────────────────────
     2. APP STATE VARIABLES
     ───────────────────────────────────────────────────────── */
  let currentProject = null;
  let videoSourceUrl = null;
  let isPlaying = false;
  let playheadTime = 0; // Current time in the timeline (sec)
  let selectedClipId = null;
  let selectedTextId = null;
  let zoomLevel = 2; // Timeline zoom multiplier
  let canvasAnimationId = null;
  let isScrubbing = false;

  // Constants
  const BASE_PIXELS_PER_SECOND = 15;

  /* ─────────────────────────────────────────────────────────
     3. DOM ELEMENT REFERENCES
     ───────────────────────────────────────────────────────── */
  // Navigation / Headers
  const statusText = document.querySelector('#editor-status .status-text');
  const statusDot = document.querySelector('#editor-status .status-dot');
  const btnNewProject = document.getElementById('btn-new-project');

  // Media Library
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
  const canvas = document.getElementById('editor-canvas');
  const ctx = canvas.getContext('2d');
  const hiddenVideo = document.getElementById('hidden-video-element');
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
  const volumeSlider = document.getElementById('hud-volume-slider');

  // Sidebar Right Properties
  const aspectButtons = document.querySelectorAll('[data-ratio]');
  const speedButtons = document.querySelectorAll('[data-speed]');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const activeTextOverlaysList = document.getElementById('active-text-overlays');
  const btnAddText = document.getElementById('btn-add-text');
  
  // Exports
  const btnRenderVideo = document.getElementById('btn-render-video');
  const btnExportProject = document.getElementById('btn-export-project');
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const projectImportInput = document.getElementById('project-import-input');

  // Timeline
  const btnTimelineSplit = document.getElementById('btn-timeline-split');
  const btnTimelineDeleteClip = document.getElementById('btn-timeline-delete-clip');
  const btnTimelineClear = document.getElementById('btn-timeline-clear');
  const timelineZoomSlider = document.getElementById('timeline-zoom-slider');
  const timelineScrollBox = document.getElementById('timeline-scroll-box');
  const timelineVessel = document.getElementById('timeline-vessel');
  const timelineRuler = document.getElementById('timeline-ruler-ticks');
  const videoTrackLane = document.getElementById('video-track-lane');
  const textTrackLane = document.getElementById('text-track-lane');
  const videoPlaceholder = document.getElementById('timeline-video-placeholder');
  const textPlaceholder = document.getElementById('timeline-text-placeholder');
  const timelinePlayhead = document.getElementById('timeline-playhead');
  const playheadDragHandle = document.getElementById('playhead-drag-handle');

  // Modals / Overlay Dialogue
  const textSettingsModal = document.getElementById('text-settings-modal');
  const modalTextId = document.getElementById('modal-text-id');
  const modalInputText = document.getElementById('modal-input-text');
  const modalInputStart = document.getElementById('modal-input-start');
  const modalInputEnd = document.getElementById('modal-input-end');
  const modalInputFontSize = document.getElementById('modal-input-font-size');
  const modalFontSizeVal = document.getElementById('modal-font-size-val');
  const modalInputX = document.getElementById('modal-input-x');
  const modalXVal = document.getElementById('modal-x-val');
  const modalInputY = document.getElementById('modal-input-y');
  const modalYVal = document.getElementById('modal-y-val');
  const btnModalDelete = document.getElementById('btn-modal-delete');
  const btnModalSave = document.getElementById('btn-modal-save');
  const btnModalClose = document.getElementById('btn-modal-close');
  const modalColorButtons = document.querySelectorAll('.color-picker-btn');

  // Render overlay
  const renderOverlay = document.getElementById('editor-export-overlay');
  const renderStatusTitle = document.getElementById('render-status-title');
  const renderExportCanvas = document.getElementById('render-export-canvas');
  const renderStatusIcon = document.getElementById('render-status-icon');
  const renderStatusMessage = document.getElementById('render-status-message');
  const renderStatusSubtitle = document.getElementById('render-status-subtitle');
  const renderProgressBar = document.getElementById('render-progress-bar');
  const renderProgressPercent = document.getElementById('render-progress-percent');
  const renderDoneActions = document.getElementById('render-done-actions');
  const btnDownloadRender = document.getElementById('btn-download-render');
  const btnCloseRenderOverlay = document.getElementById('btn-close-render-overlay');

  /* ─────────────────────────────────────────────────────────
     4. GENERAL HELPER FUNCTIONS
     ───────────────────────────────────────────────────────── */
  function setStatusText(text, theme = 'green') {
    statusText.textContent = text;
    statusDot.className = `status-dot ${theme}`;
  }

  function formatTime(sec) {
    if (isNaN(sec)) return '00:00.00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function formatShortTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function createId() {
    return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  }

  /* ─────────────────────────────────────────────────────────
     5. INITIALIZATION
     ───────────────────────────────────────────────────────── */
  initDb()
    .then(() => {
      refreshProjectsList();
      createNewProject(false); // Init default workspace empty state
    })
    .catch((err) => {
      console.error('[DB] Failed to init DB:', err);
      setStatusText('DB FAILED', 'orange');
    });

  // Tilt animations (Jeton-style hover)
  function addTilt(el, strength = 8) {
    if (!el) return;
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width / 2;
      const cy   = rect.top + rect.height / 2;
      const dx   = (e.clientX - cx) / (rect.width / 2);
      const dy   = (e.clientY - cy) / (rect.height / 2);
      el.style.transform = `perspective(800px) rotateY(${dx * strength}deg) rotateX(${-dy * strength}deg) scale(1.01)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  }
  addTilt(document.getElementById('camcorder-frame'), 3);

  /* ─────────────────────────────────────────────────────────
     5b. SIDE DOCK TAB SWITCHING
     ───────────────────────────────────────────────────────── */
  const dockBtns = document.querySelectorAll('.dock-btn');
  const drawerTabContents = document.querySelectorAll('.drawer-tab-content');
  const editorDrawer = document.getElementById('editor-drawer');

  dockBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Check if already active — clicking same tab collapses drawer
      const isAlreadyActive = btn.classList.contains('active');

      // Deactivate all dock btns
      dockBtns.forEach(b => b.classList.remove('active'));

      // Hide all tab content
      drawerTabContents.forEach(t => t.classList.remove('active'));

      if (isAlreadyActive) {
        // Collapse drawer
        editorDrawer.classList.add('collapsed');
      } else {
        // Expand drawer & show the correct tab
        editorDrawer.classList.remove('collapsed');
        btn.classList.add('active');

        const targetContent = document.getElementById(`tab-content-${targetTab}`);
        if (targetContent) targetContent.classList.add('active');
      }
    });
  });

  /* ─────────────────────────────────────────────────────────
     5c. KEYBOARD SHORTCUTS
     ───────────────────────────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    // Avoid triggering when typing in an input / textarea
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (isPlaying) pausePlayback();
      else startPlayback();
    }

    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      seekTimeline(playheadTime - 1);
    }

    if (e.code === 'ArrowRight') {
      e.preventDefault();
      seekTimeline(playheadTime + 1);
    }
  });

  /* ─────────────────────────────────────────────────────────
     6. WORKSPACE STATE & NEW PROJECTS
     ───────────────────────────────────────────────────────── */
  function createNewProject(promptName = true) {
    let name = 'SARJ-' + new Date().toLocaleTimeString();
    if (promptName) {
      const userInput = prompt('Enter a name for this project:', 'SARJ Project');
      if (userInput === null) return; // User cancelled
      if (userInput.trim() !== '') name = userInput.trim();
    }

    // Stop current playbacks
    pausePlayback();
    
    // Revoke old URL
    if (videoSourceUrl) {
      URL.revokeObjectURL(videoSourceUrl);
      videoSourceUrl = null;
    }

    currentProject = {
      id: createId(),
      name: name,
      videoBlob: null,
      videoName: '',
      videoSize: 0,
      videoDuration: 0,
      updatedAt: Date.now(),
      aspectRatio: '16/9',
      speed: 1.0,
      filter: 'none',
      volume: 0.8,
      clips: [],
      texts: []
    };

    selectedClipId = null;
    selectedTextId = null;
    playheadTime = 0;
    hiddenVideo.src = '';
    
    // Reset view variables
    resetUIForEmptyProject();
    setStatusText('NEW PROJECT');
  }

  function resetUIForEmptyProject() {
    loadedVideoContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    btnRenderVideo.disabled = true;
    btnExportProject.disabled = true;
    btnTimelineSplit.disabled = true;
    btnTimelineDeleteClip.disabled = true;
    
    // Reset canvas dimensions to standard 16:9
    canvas.width = 640;
    canvas.height = 360;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlaceholderOnCanvas("CAM VIEWER: STANDBY");

    // Clean timeline elements
    videoPlaceholder.classList.remove('hidden');
    textPlaceholder.classList.remove('hidden');
    videoTrackLane.querySelectorAll('.video-segment-block').forEach(el => el.remove());
    textTrackLane.querySelectorAll('.text-segment-block').forEach(el => el.remove());
    activeTextOverlaysList.innerHTML = '<p class="no-items-text">No text overlays added yet.</p>';

    hudCurrentTime.textContent = '00:00.00';
    hudTotalDuration.textContent = '00:00.00';
    timelineVessel.style.width = '100%';
    timelineRuler.innerHTML = '';
    timelinePlayhead.style.left = '0px';

    // Speed / Aspect ratio default active
    setActiveToggle(aspectButtons, '16/9', 'ratio');
    setActiveToggle(speedButtons, '1.0', 'speed');
    setActiveToggle(filterButtons, 'none', 'filter');
    crtOverlay.style.display = 'none';
  }

  function drawPlaceholderOnCanvas(message) {
    ctx.fillStyle = '#0b0f12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid overlay
    ctx.strokeStyle = 'rgba(45, 219, 222, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    ctx.font = "bold 20px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#2ddbde";
    ctx.shadowColor = "#2ddbde";
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
  }

  function setActiveToggle(elements, value, dataAttr) {
    elements.forEach(btn => {
      if (btn.getAttribute(`data-${dataAttr}`) === value) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────
     7. LOAD PROJECT FROM DB OR IMPORT
     ───────────────────────────────────────────────────────── */
  function loadProjectIntoWorkspace(project) {
    pausePlayback();
    currentProject = project;
    setStatusText(`LOADED: ${project.name.toUpperCase()}`);

    // Update UI controls
    setActiveToggle(aspectButtons, project.aspectRatio, 'ratio');
    setActiveToggle(speedButtons, String(project.speed), 'speed');
    setActiveToggle(filterButtons, project.filter, 'filter');
    volumeSlider.value = project.volume;
    hiddenVideo.volume = project.volume;
    hiddenVideo.playbackRate = project.speed;

    if (project.filter === 'scanlines') {
      crtOverlay.style.display = 'block';
    } else {
      crtOverlay.style.display = 'none';
    }

    selectedClipId = null;
    selectedTextId = null;
    playheadTime = 0;

    // Load video if exists
    if (project.videoBlob) {
      loadVideoBlob(project.videoBlob, false);
    } else {
      resetUIForEmptyProject();
      // Keep project details active, just need video re-upload
      dropZone.classList.remove('hidden');
      loadedVideoContainer.classList.add('hidden');
    }
  }

  function refreshProjectsList() {
    getAllProjects()
      .then((projects) => {
        projectsDbList.innerHTML = '';
        if (projects.length === 0) {
          projectsDbList.innerHTML = `
            <div class="no-projects-placeholder">
              <span class="material-symbols-outlined">info</span>
              <span>No saved projects yet.</span>
            </div>`;
          return;
        }

        // Sort by update date desc
        projects.sort((a, b) => b.updatedAt - a.updatedAt);

        projects.forEach(proj => {
          const item = document.createElement('div');
          item.className = 'db-project-item';
          
          const details = document.createElement('div');
          details.className = 'project-item-details';
          details.innerHTML = `
            <span class="project-item-name">${proj.name}</span>
            <span class="project-item-date">Updated: ${new Date(proj.updatedAt).toLocaleString()}</span>
          `;
          details.addEventListener('click', () => {
            loadProjectIntoWorkspace(proj);
          });

          const actions = document.createElement('div');
          actions.className = 'project-item-actions';
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn-icon-sm delete';
          deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">delete</span>';
          deleteBtn.title = 'Delete project';
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${proj.name}"?`)) {
              deleteProject(proj.id).then(() => {
                refreshProjectsList();
                if (currentProject && currentProject.id === proj.id) {
                  createNewProject(false);
                }
              });
            }
          });

          actions.appendChild(deleteBtn);
          item.appendChild(details);
          item.appendChild(actions);
          projectsDbList.appendChild(item);
        });
      })
      .catch(err => {
        console.error('[DB] Failed loading list:', err);
      });
  }

  /* ─────────────────────────────────────────────────────────
     8. VIDEO FILE PROCESSING (Blob / Object URL)
     ───────────────────────────────────────────────────────── */
  function loadVideoBlob(blob, isNewFile = true) {
    canvasLoadingSpinner.classList.remove('hidden');
    setStatusText('SYNCING TAPE...', 'orange');
    
    if (videoSourceUrl) {
      URL.revokeObjectURL(videoSourceUrl);
    }
    videoSourceUrl = URL.createObjectURL(blob);
    hiddenVideo.src = videoSourceUrl;
    hiddenVideo.load();

    hiddenVideo.onloadedmetadata = () => {
      const duration = hiddenVideo.duration;
      canvasLoadingSpinner.classList.add('hidden');
      setStatusText('TAPE LOADED', 'green');

      // Populate file metrics
      loadedVideoContainer.classList.remove('hidden');
      dropZone.classList.add('hidden');
      
      loadedVideoName.textContent = currentProject.videoName || 'raw_tape.mp4';
      metaDuration.textContent = formatShortTime(duration);
      metaSize.textContent = formatBytes(currentProject.videoSize || blob.size);

      // Setup initial clip state if uploading fresh file
      if (isNewFile) {
        currentProject.videoBlob = blob;
        currentProject.videoName = fileInput.files[0]?.name || 'dragged_tape.mp4';
        currentProject.videoSize = blob.size;
        currentProject.videoDuration = duration;
        
        // Initial clip spans whole video
        currentProject.clips = [{
          id: createId(),
          start: 0,
          end: duration,
          duration: duration
        }];
        currentProject.texts = [];
        saveCurrentProject();
      }

      btnRenderVideo.disabled = false;
      btnExportProject.disabled = false;
      
      updateCanvasAspect();
      initTimelineRuler();
      renderTimelineSegments();
      updatePlayheadPosition();
      drawCurrentFrame();
    };

    hiddenVideo.onerror = (e) => {
      canvasLoadingSpinner.classList.add('hidden');
      setStatusText('DECODING ERROR', 'orange');
      alert("Error loading video. Please make sure it's a valid HTML5 format (MP4/WebM).");
      console.error('[Decoder] Video error:', e);
    };
  }

  // File Upload Handlers
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
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      loadVideoBlob(files[0], true);
    } else {
      alert("Please drop a valid video file.");
    }
  });

  btnSelectFile.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files.length > 0) {
      loadVideoBlob(files[0], true);
    }
  });

  btnRemoveVideo.addEventListener('click', () => {
    if (confirm("Remove current raw video? All trims and edits will be lost.")) {
      createNewProject(false);
    }
  });

  /* ─────────────────────────────────────────────────────────
     9. DRAWING FRAME & RETRO CANVAS FILTERS
     ───────────────────────────────────────────────────────── */
  function updateCanvasAspect() {
    if (!hiddenVideo.videoWidth) return;
    const ratioVal = currentProject.aspectRatio;
    
    let width = 640;
    let height = 360;

    if (ratioVal === '9/16') {
      width = 360;
      height = 640;
    } else if (ratioVal === '1/1') {
      width = 480;
      height = 480;
    }

    canvas.width = width;
    canvas.height = height;
  }

  // Main draw runner
  function drawCurrentFrame() {
    if (hiddenVideo.readyState < 2) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply current aspect letterboxing if necessary
    const sourceW = hiddenVideo.videoWidth;
    const sourceH = hiddenVideo.videoHeight;
    const targetW = canvas.width;
    const targetH = canvas.height;
    
    const targetRatio = targetW / targetH;
    const sourceRatio = sourceW / sourceH;
    
    let drawW = targetW;
    let drawH = targetH;
    let x = 0;
    let y = 0;

    if (sourceRatio > targetRatio) {
      drawH = targetW / sourceRatio;
      y = (targetH - drawH) / 2;
    } else {
      drawW = targetH * sourceRatio;
      x = (targetW - drawW) / 2;
    }

    // Set filters
    const filter = currentProject.filter;
    ctx.filter = 'none'; // reset

    if (filter === 'vhs-cyber') {
      ctx.filter = 'contrast(1.25) saturate(1.4) hue-rotate(-20deg) sepia(0.15)';
    } else if (filter === 'neon-glitch') {
      ctx.filter = 'contrast(1.5) saturate(1.8) hue-rotate(140deg)';
    } else if (filter === 'grayscale') {
      ctx.filter = 'grayscale(1) contrast(1.1) brightness(0.95)';
    } else if (filter === 'scanlines') {
      ctx.filter = 'contrast(1.15) saturate(1.1)';
    }

    // Draw video frame
    ctx.drawImage(hiddenVideo, x, y, drawW, drawH);

    // Apply pixel scanlines (Recorded direct to canvas for export)
    if (filter === 'scanlines' || filter === 'vhs-cyber') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.13)';
      for (let i = 0; i < canvas.height; i += 3) {
        ctx.fillRect(0, i, canvas.width, 1);
      }
      // Occasional glitch noise
      if (Math.random() < 0.05) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(0, Math.random() * canvas.height, canvas.width, Math.random() * 6 + 2);
      }
    }

    // Draw Canvas Text Overlays
    ctx.filter = 'none'; // text has no filters
    currentProject.texts.forEach(textObj => {
      if (playheadTime >= textObj.start && playheadTime <= textObj.end) {
        ctx.font = `bold ${textObj.fontSize}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const pxX = (textObj.x / 100) * canvas.width;
        const pxY = (textObj.y / 100) * canvas.height;

        // Cyber neon glow styling
        ctx.shadowColor = textObj.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = textObj.color;
        ctx.fillText(textObj.text.toUpperCase(), pxX, pxY);
        
        // Reset shadow
        ctx.shadowBlur = 0;
      }
    });

    // Update Viewfinder indicators
    const currentFrame = Math.floor((playheadTime % 1) * 30);
    const totalSecs = Math.floor(playheadTime);
    const min = Math.floor(totalSecs / 60);
    const sec = totalSecs % 60;
    const hrs = Math.floor(min / 60);
    
    const pad = (n) => String(n).padStart(2, '0');
    timecodeHUD.textContent = `${pad(hrs)}:${pad(min % 60)}:${pad(sec)}:${pad(currentFrame)}`;
  }

  function frameLoop() {
    if (isPlaying) {
      syncVideoPlayhead();
      drawCurrentFrame();
      canvasAnimationId = requestAnimationFrame(frameLoop);
    }
  }

  /* ─────────────────────────────────────────────────────────
     10. TIMELINE TRANSLATIONS (SCENE SPLITTING / PLAYHEAD SYNC)
     ───────────────────────────────────────────────────────── */
  
  // Calculate total duration of all active timeline segments
  function getTotalTimelineDuration() {
    if (!currentProject || !currentProject.clips.length) return 0;
    return currentProject.clips.reduce((sum, c) => sum + c.duration, 0);
  }

  // Timeline time (seconds) -> Real Video Source element time (seconds)
  function timelineToSourceTime(tTime) {
    let accum = 0;
    for (let clip of currentProject.clips) {
      if (tTime >= accum && tTime <= accum + clip.duration) {
        return clip.start + (tTime - accum);
      }
      accum += clip.duration;
    }
    // Fallback/boundary safety
    if (currentProject.clips.length) {
      return currentProject.clips[currentProject.clips.length - 1].end;
    }
    return 0;
  }

  // Video source element time -> Timeline scrubber time
  function sourceToTimelineTime(sTime) {
    let accum = 0;
    for (let clip of currentProject.clips) {
      if (sTime >= clip.start && sTime <= clip.end) {
        return accum + (sTime - clip.start);
      }
      accum += clip.duration;
    }
    return accum;
  }

  function syncVideoPlayhead() {
    const sTime = hiddenVideo.currentTime;
    
    // Find active clip segment segment
    let accum = 0;
    let activeClip = null;
    let activeClipIdx = -1;
    
    for (let i = 0; i < currentProject.clips.length; i++) {
      let clip = currentProject.clips[i];
      if (sTime >= clip.start && sTime < clip.end) {
        activeClip = clip;
        activeClipIdx = i;
        break;
      }
      accum += clip.duration;
    }

    if (activeClip) {
      // Smoothly advance playheadTime
      playheadTime = accum + (sTime - activeClip.start);
    } else {
      // If we skipped/ended beyond clip boundaries, sync video element to next block start
      // or stop playback at the timeline end
      const totalTimeline = getTotalTimelineDuration();
      if (playheadTime >= totalTimeline) {
        pausePlayback();
        playheadTime = totalTimeline;
      } else {
        // Jump video to correct source time for current playhead
        hiddenVideo.currentTime = timelineToSourceTime(playheadTime);
      }
    }
    
    updatePlayheadPosition();
    updateHUDTimes();
  }

  function seekTimeline(targetTime) {
    const totalD = getTotalTimelineDuration();
    playheadTime = Math.max(0, Math.min(targetTime, totalD));
    hiddenVideo.currentTime = timelineToSourceTime(playheadTime);
    updatePlayheadPosition();
    updateHUDTimes();
    drawCurrentFrame();
  }

  /* ─────────────────────────────────────────────────────────
     11. PLAYBACK CONTROLS
     ───────────────────────────────────────────────────────── */
  function startPlayback() {
    if (!currentProject.videoBlob) return;
    isPlaying = true;
    playPauseIcon.textContent = 'pause';
    tapeReelIndicator.style.animationPlayState = 'running';
    
    if (recDot) recDot.classList.add('blink');
    if (recLabel) {
      recLabel.textContent = 'PLAY';
      recLabel.style.color = 'var(--color-cyan)';
    }

    // If playhead was at the end, restart from beginning
    if (playheadTime >= getTotalTimelineDuration()) {
      playheadTime = 0;
    }
    hiddenVideo.currentTime = timelineToSourceTime(playheadTime);
    hiddenVideo.play();
    
    canvasAnimationId = requestAnimationFrame(frameLoop);
  }

  function pausePlayback() {
    isPlaying = false;
    playPauseIcon.textContent = 'play_arrow';
    tapeReelIndicator.style.animationPlayState = 'paused';
    
    if (recDot) recDot.classList.remove('blink');
    if (recLabel) {
      recLabel.textContent = 'PAUSED';
      recLabel.style.color = 'var(--color-accent-pink)';
    }

    hiddenVideo.pause();
    if (canvasAnimationId) {
      cancelAnimationFrame(canvasAnimationId);
      canvasAnimationId = null;
    }
    drawCurrentFrame();
  }

  btnPlayPause.addEventListener('click', () => {
    if (isPlaying) pausePlayback();
    else startPlayback();
  });

  btnRewind.addEventListener('click', () => {
    seekTimeline(playheadTime - 5);
  });

  btnForward.addEventListener('click', () => {
    seekTimeline(playheadTime + 5);
  });

  btnMute.addEventListener('click', () => {
    hiddenVideo.muted = !hiddenVideo.muted;
    if (hiddenVideo.muted) {
      muteIcon.textContent = 'volume_off';
    } else {
      muteIcon.textContent = 'volume_up';
    }
  });

  volumeSlider.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    hiddenVideo.volume = vol;
    currentProject.volume = vol;
    if (vol === 0) {
      muteIcon.textContent = 'volume_off';
    } else {
      muteIcon.textContent = 'volume_up';
    }
    saveCurrentProject();
  });

  /* ─────────────────────────────────────────────────────────
     12. DYNAMIC TIMELINE RENDERING & INTERACTIONS
     ───────────────────────────────────────────────────────── */
  function getPixelsPerSecond() {
    return BASE_PIXELS_PER_SECOND * zoomLevel;
  }

  function initTimelineRuler() {
    timelineRuler.innerHTML = '';
    const duration = getTotalTimelineDuration();
    if (duration <= 0) return;

    const pps = getPixelsPerSecond();
    const totalW = duration * pps;
    timelineVessel.style.width = `${totalW}px`;

    // Draw ticks
    let tickStep = 1;
    if (zoomLevel < 1.5) tickStep = 5;
    if (zoomLevel < 0.8) tickStep = 10;

    for (let t = 0; t <= duration; t += tickStep) {
      const tick = document.createElement('div');
      tick.className = 'timeline-tick' + (t % 5 === 0 ? ' major' : '');
      tick.style.left = `${t * pps}px`;
      
      if (t % 5 === 0) {
        tick.innerHTML = `<span style="margin-left: 2px;">${formatShortTime(t)}</span>`;
      }
      timelineRuler.appendChild(tick);
    }
  }

  function renderTimelineSegments() {
    // Clear dynamic blocks
    videoTrackLane.querySelectorAll('.video-segment-block').forEach(el => el.remove());
    textTrackLane.querySelectorAll('.text-segment-block').forEach(el => el.remove());

    if (!currentProject || !currentProject.clips.length) {
      videoPlaceholder.classList.remove('hidden');
      textPlaceholder.classList.remove('hidden');
      btnTimelineSplit.disabled = true;
      btnTimelineDeleteClip.disabled = true;
      return;
    }

    videoPlaceholder.classList.add('hidden');
    btnTimelineSplit.disabled = false;

    const pps = getPixelsPerSecond();
    let currentX = 0;

    // 1. Render Video Track Clips
    currentProject.clips.forEach((clip) => {
      const w = clip.duration * pps;
      const block = document.createElement('div');
      block.className = 'video-segment-block';
      if (selectedClipId === clip.id) block.classList.add('selected');
      block.style.left = `${currentX}px`;
      block.style.width = `${w}px`;

      block.innerHTML = `
        <span class="segment-name">${currentProject.videoName} [Trim]</span>
        <span class="segment-duration">${clip.duration.toFixed(1)}s</span>
      `;

      block.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedClipId = (selectedClipId === clip.id) ? null : clip.id;
        selectedTextId = null;
        renderTimelineSegments();
      });

      videoTrackLane.appendChild(block);
      currentX += w;
    });

    // Toggle delete button
    btnTimelineDeleteClip.disabled = (selectedClipId === null && selectedTextId === null);

    // 2. Render Text Track Segments
    if (currentProject.texts.length > 0) {
      textPlaceholder.classList.add('hidden');
      
      currentProject.texts.forEach((textObj) => {
        const left = textObj.start * pps;
        const w = (textObj.end - textObj.start) * pps;
        
        const block = document.createElement('div');
        block.className = 'text-segment-block';
        if (selectedTextId === textObj.id) block.classList.add('selected');
        block.style.left = `${left}px`;
        block.style.width = `${w}px`;

        block.innerHTML = `
          <span class="segment-name">${textObj.text}</span>
          <span class="segment-duration">${(textObj.end - textObj.start).toFixed(1)}s</span>
        `;

        // Click on segment selects it and updates inspector
        block.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedTextId = (selectedTextId === textObj.id) ? null : textObj.id;
          selectedClipId = null;
          renderTimelineSegments();
          if (selectedTextId) {
            openTextSettingsModal(textObj.id);
          }
        });

        textTrackLane.appendChild(block);
      });
    } else {
      textPlaceholder.classList.remove('hidden');
    }

    // Update HUD durations
    hudTotalDuration.textContent = formatTime(getTotalTimelineDuration());
  }

  function updatePlayheadPosition() {
    const pps = getPixelsPerSecond();
    const leftPx = playheadTime * pps;
    timelinePlayhead.style.left = `${leftPx}px`;

    // Center scroll box on playhead during playing
    if (isPlaying && !isScrubbing) {
      const viewW = timelineScrollBox.offsetWidth;
      const scrollL = timelineScrollBox.scrollLeft;
      if (leftPx > scrollL + viewW - 100 || leftPx < scrollL) {
        timelineScrollBox.scrollLeft = leftPx - viewW / 2;
      }
    }
  }

  function updateHUDTimes() {
    hudCurrentTime.textContent = formatTime(playheadTime);
  }

  // Timeline Zoom Control
  timelineZoomSlider.addEventListener('input', () => {
    zoomLevel = parseFloat(timelineZoomSlider.value);
    initTimelineRuler();
    renderTimelineSegments();
    updatePlayheadPosition();
  });

  // Playhead scrubber dragging
  function handleScrub(e) {
    if (!currentProject.videoBlob) return;
    const rect = timelineVessel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / getPixelsPerSecond();
    seekTimeline(time);
  }

  playheadDragHandle.addEventListener('mousedown', () => {
    isScrubbing = true;
    if (isPlaying) {
      pausePlayback();
      // Resume playback after drag
      playheadDragHandle.setAttribute('data-was-playing', 'true');
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isScrubbing) return;
    handleScrub(e);
  });

  document.addEventListener('mouseup', () => {
    if (isScrubbing) {
      isScrubbing = false;
      if (playheadDragHandle.getAttribute('data-was-playing') === 'true') {
        playheadDragHandle.removeAttribute('data-was-playing');
        startPlayback();
      }
    }
  });

  // Clicking anywhere on timeline vessel seeks
  timelineVessel.addEventListener('click', (e) => {
    if (e.target.classList.contains('video-segment-block') || 
        e.target.classList.contains('text-segment-block') || 
        isScrubbing) return;
    handleScrub(e);
  });

  /* ─────────────────────────────────────────────────────────
     13. TIMELINE ACTION BUTTONS (SPLIT, DELETE, CLEAR)
     ───────────────────────────────────────────────────────── */

  // Split Clip
  btnTimelineSplit.addEventListener('click', () => {
    if (!currentProject.clips.length) return;
    
    // Find segment at playheadTime
    let accum = 0;
    let targetClip = null;
    let targetIdx = -1;

    for (let i = 0; i < currentProject.clips.length; i++) {
      let clip = currentProject.clips[i];
      if (playheadTime > accum && playheadTime < accum + clip.duration) {
        targetClip = clip;
        targetIdx = i;
        break;
      }
      accum += clip.duration;
    }

    if (!targetClip) {
      alert("Cannot split at boundary. Move playhead to the middle of a clip block.");
      return;
    }

    // Split targetClip into 2 clips
    const offset = playheadTime - accum; // split location in this clip
    
    const clip1 = {
      id: createId(),
      start: targetClip.start,
      end: targetClip.start + offset,
      duration: offset
    };

    const clip2 = {
      id: createId(),
      start: targetClip.start + offset,
      end: targetClip.end,
      duration: targetClip.duration - offset
    };

    // Replace in array
    currentProject.clips.splice(targetIdx, 1, clip1, clip2);
    
    saveCurrentProject();
    renderTimelineSegments();
    initTimelineRuler();
    seekTimeline(playheadTime);
  });

  // Delete segment (Video clip OR Text overlay)
  btnTimelineDeleteClip.addEventListener('click', () => {
    if (selectedClipId) {
      if (confirm("Delete this video segment?")) {
        currentProject.clips = currentProject.clips.filter(c => c.id !== selectedClipId);
        selectedClipId = null;
        saveCurrentProject();
        renderTimelineSegments();
        initTimelineRuler();
        seekTimeline(0);
      }
    } else if (selectedTextId) {
      currentProject.texts = currentProject.texts.filter(t => t.id !== selectedTextId);
      selectedTextId = null;
      saveCurrentProject();
      renderTimelineSegments();
      renderActiveTextOverlaysUI();
    }
  });

  btnTimelineClear.addEventListener('click', () => {
    if (confirm("Reset current project? This will restore original timeline duration and clear text titles.")) {
      if (currentProject.videoDuration) {
        currentProject.clips = [{
          id: createId(),
          start: 0,
          end: currentProject.videoDuration,
          duration: currentProject.videoDuration
        }];
        currentProject.texts = [];
        selectedClipId = null;
        selectedTextId = null;
        
        saveCurrentProject();
        renderTimelineSegments();
        initTimelineRuler();
        seekTimeline(0);
        renderActiveTextOverlaysUI();
      }
    }
  });

  /* ─────────────────────────────────────────────────────────
     14. VIDEO METADATA CUSTOMIZATIONS (FILTERS, SPEED, ASPECT)
     ───────────────────────────────────────────────────────── */
  
  // Aspect Ratio
  aspectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      aspectButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const ratio = btn.getAttribute('data-ratio');
      currentProject.aspectRatio = ratio;
      
      updateCanvasAspect();
      drawCurrentFrame();
      saveCurrentProject();
    });
  });

  // Playback Speed
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const speed = parseFloat(btn.getAttribute('data-speed'));
      currentProject.speed = speed;
      hiddenVideo.playbackRate = speed;
      
      saveCurrentProject();
    });
  });

  // Canvas Filters
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filter = btn.getAttribute('data-filter');
      currentProject.filter = filter;

      if (filter === 'scanlines') {
        crtOverlay.style.display = 'block';
      } else {
        crtOverlay.style.display = 'none';
      }

      drawCurrentFrame();
      saveCurrentProject();
    });
  });

  /* ─────────────────────────────────────────────────────────
     15. TEXT OVERLAYS / TITLES
     ───────────────────────────────────────────────────────── */
  
  function renderActiveTextOverlaysUI() {
    activeTextOverlaysList.innerHTML = '';
    
    if (currentProject.texts.length === 0) {
      activeTextOverlaysList.innerHTML = '<p class="no-items-text">No text overlays added yet.</p>';
      return;
    }

    currentProject.texts.forEach((textObj) => {
      const item = document.createElement('div');
      item.className = 'text-overlay-pill';
      
      const info = document.createElement('div');
      info.className = 'text-overlay-pill-info';
      info.innerHTML = `
        <span class="pill-text-content">${textObj.text}</span>
        <span class="pill-time-range">Time: ${textObj.start.toFixed(1)}s - ${textObj.end.toFixed(1)}s</span>
      `;
      info.addEventListener('click', () => {
        openTextSettingsModal(textObj.id);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-item';
      delBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
      delBtn.title = 'Remove text overlay';
      delBtn.addEventListener('click', () => {
        currentProject.texts = currentProject.texts.filter(t => t.id !== textObj.id);
        saveCurrentProject();
        renderTimelineSegments();
        renderActiveTextOverlaysUI();
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      activeTextOverlaysList.appendChild(item);
    });
  }

  btnAddText.addEventListener('click', () => {
    if (!currentProject.videoBlob) {
      alert("Please upload a video file first before adding titles.");
      return;
    }
    
    // Add default text overlay at current playhead time
    const start = playheadTime;
    const end = Math.min(start + 4, getTotalTimelineDuration());
    
    const newText = {
      id: createId(),
      text: 'CYBER TITLE',
      start: start,
      end: end,
      fontSize: 28,
      color: '#ffffff',
      x: 50,
      y: 50
    };

    currentProject.texts.push(newText);
    saveCurrentProject();
    renderTimelineSegments();
    renderActiveTextOverlaysUI();
    drawCurrentFrame();
  });

  // Modal actions
  function openTextSettingsModal(id) {
    const textObj = currentProject.texts.find(t => t.id === id);
    if (!textObj) return;

    modalTextId.value = textObj.id;
    modalInputText.value = textObj.text;
    modalInputStart.value = textObj.start.toFixed(1);
    modalInputEnd.value = textObj.end.toFixed(1);
    modalInputFontSize.value = textObj.fontSize;
    modalFontSizeVal.textContent = textObj.fontSize + 'px';
    modalInputX.value = textObj.x;
    modalXVal.textContent = textObj.x + '%';
    modalInputY.value = textObj.y;
    modalYVal.textContent = textObj.y + '%';

    // Color active button
    modalColorButtons.forEach(btn => {
      if (btn.getAttribute('data-color') === textObj.color) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    textSettingsModal.classList.remove('hidden');
  }

  function closeModal() {
    textSettingsModal.classList.add('hidden');
    selectedTextId = null;
    renderTimelineSegments();
  }

  btnModalClose.addEventListener('click', closeModal);
  
  modalInputFontSize.addEventListener('input', () => {
    modalFontSizeVal.textContent = modalInputFontSize.value + 'px';
  });

  modalInputX.addEventListener('input', () => {
    modalXVal.textContent = modalInputX.value + '%';
  });

  modalInputY.addEventListener('input', () => {
    modalYVal.textContent = modalInputY.value + '%';
  });

  // Modal color pickers
  modalColorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modalColorButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  btnModalSave.addEventListener('click', () => {
    const id = modalTextId.value;
    const textObj = currentProject.texts.find(t => t.id === id);
    if (!textObj) return;

    const startVal = parseFloat(modalInputStart.value);
    const endVal = parseFloat(modalInputEnd.value);
    
    if (isNaN(startVal) || isNaN(endVal) || startVal < 0 || endVal <= startVal) {
      alert("Invalid timestamps. Start must be positive, and End must exceed Start.");
      return;
    }

    const activeColorBtn = document.querySelector('.color-picker-btn.active');

    textObj.text = modalInputText.value.trim() || 'TITLE';
    textObj.start = startVal;
    textObj.end = endVal;
    textObj.fontSize = parseInt(modalInputFontSize.value);
    textObj.x = parseInt(modalInputX.value);
    textObj.y = parseInt(modalInputY.value);
    textObj.color = activeColorBtn ? activeColorBtn.getAttribute('data-color') : '#ffffff';

    saveCurrentProject();
    renderTimelineSegments();
    renderActiveTextOverlaysUI();
    closeModal();
    drawCurrentFrame();
  });

  btnModalDelete.addEventListener('click', () => {
    const id = modalTextId.value;
    currentProject.texts = currentProject.texts.filter(t => t.id !== id);
    saveCurrentProject();
    renderTimelineSegments();
    renderActiveTextOverlaysUI();
    closeModal();
    drawCurrentFrame();
  });

  /* ─────────────────────────────────────────────────────────
     16. DB SYNC AUTOSAVE HELPERS
     ───────────────────────────────────────────────────────── */
  function saveCurrentProject() {
    if (!currentProject) return;
    currentProject.updatedAt = Date.now();
    
    setStatusText('SAVING TAPE...', 'orange');
    saveProject(currentProject)
      .then(() => {
        setStatusText('PROJECT SYNCED', 'green');
        refreshProjectsList();
      })
      .catch(err => {
        console.error('[DB] Autosave error:', err);
        setStatusText('SYNC ERROR', 'orange');
      });
  }

  btnNewProject.addEventListener('click', () => {
    createNewProject(true);
  });

  /* ─────────────────────────────────────────────────────────
     17. JSON IMPORT / EXPORT STUDIO
     ───────────────────────────────────────────────────────── */
  
  // Export project layout to JSON file
  btnExportProject.addEventListener('click', () => {
    if (!currentProject) return;
    
    setStatusText('EXPORTING JSON...', 'orange');
    
    // Package project layout without large binary blob by default for efficiency
    // We provide information inside JSON on how to link back
    const config = {
      sarjcam_project: true,
      name: currentProject.name,
      aspectRatio: currentProject.aspectRatio,
      speed: currentProject.speed,
      filter: currentProject.filter,
      volume: currentProject.volume,
      clips: currentProject.clips,
      texts: currentProject.texts,
      videoName: currentProject.videoName,
      videoSize: currentProject.videoSize,
      videoDuration: currentProject.videoDuration
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `${currentProject.name.toLowerCase().replace(/\s+/g, '_')}_project.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    
    setStatusText('PROJECT EXPORTED');
  });

  // Import JSON project configurations
  btnTriggerImport.addEventListener('click', () => {
    projectImportInput.click();
  });

  projectImportInput.addEventListener('change', () => {
    const file = projectImportInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        if (!config.sarjcam_project) {
          throw new Error("Missing SARJ-CAM project headers in JSON file.");
        }

        // Initialize imported workspace shell
        const importedProject = {
          id: createId(),
          name: config.name || 'Imported project',
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

        // Prompt user to select matching source video file
        alert(`Project loaded! Please select the raw video file "${config.videoName}" from your PC to complete the sync.`);
        
        // Open file picker specifically for importing sync
        const selectPrompt = document.createElement('input');
        selectPrompt.type = 'file';
        selectPrompt.accept = 'video/*';
        selectPrompt.addEventListener('change', () => {
          const vFile = selectPrompt.files[0];
          if (vFile) {
            importedProject.videoBlob = vFile;
            importedProject.videoName = vFile.name;
            importedProject.videoSize = vFile.size;

            saveProject(importedProject).then(() => {
              loadProjectIntoWorkspace(importedProject);
              refreshProjectsList();
            });
          }
        });
        selectPrompt.click();

      } catch (err) {
        alert(`Import error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    projectImportInput.value = ''; // Reset input
  });

  /* ─────────────────────────────────────────────────────────
     18. CANVAS OFF-LINE VIDEO RENDER ENGINE (EXPORT VIDEO)
     ───────────────────────────────────────────────────────── */
  let renderVideoURL = null;

  btnRenderVideo.addEventListener('click', () => {
    if (!currentProject.videoBlob) return;

    // Show exporting modal
    renderOverlay.classList.add('show');
    renderOverlay.setAttribute('aria-hidden', 'false');
    renderDoneActions.classList.add('hidden');
    renderProgressBar.style.width = '0%';
    renderProgressPercent.textContent = '0%';
    renderStatusTitle.textContent = 'RENDERING TAPE';
    renderStatusMessage.textContent = 'Rendering retro frames...';
    renderStatusSubtitle.textContent = 'Capturing timeline frame animations. Please keep this browser window focused.';
    
    // Add spinning icon
    renderStatusIcon.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span>';

    // Revoke old rendered video
    if (renderVideoURL) {
      URL.revokeObjectURL(renderVideoURL);
      renderVideoURL = null;
    }

    // Set up rendering target canvas dimensions based on current aspect
    const expCanvas = renderExportCanvas;
    const activeW = canvas.width;
    const activeH = canvas.height;
    expCanvas.width = activeW;
    expCanvas.height = activeH;
    const expCtx = expCanvas.getContext('2d');

    // Setup recorder on export canvas stream
    // captureStream(fps)
    const stream = expCanvas.captureStream(30);
    
    // Try capturing audio track from video element so rendered file has sound
    try {
      const audioStream = hiddenVideo.captureStream ? hiddenVideo.captureStream() : (hiddenVideo.mozCaptureStream ? hiddenVideo.mozCaptureStream() : null);
      if (audioStream) {
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]);
          console.log('[Renderer] Audio track attached to export stream.');
        }
      }
    } catch (e) {
      console.warn('[Renderer] Audio track sync skipped/failed:', e);
    }

    // MediaRecorder options
    let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 4000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm', videoBitsPerSecond: 2500000 };
    }
    
    let recordedChunks = [];
    const mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const superBlob = new Blob(recordedChunks, { type: 'video/webm' });
      renderVideoURL = URL.createObjectURL(superBlob);
      
      // Update UI for download
      renderProgressBar.style.width = '100%';
      renderProgressPercent.textContent = '100%';
      renderStatusTitle.textContent = 'RENDER COMPLETE';
      renderStatusMessage.textContent = 'Project successfully compiled!';
      renderStatusSubtitle.textContent = 'Tape rendering finalized. Ready for digital distribution.';
      renderStatusIcon.innerHTML = '<span class="material-symbols-outlined" style="color:var(--color-cyan); font-size:64px;">check_circle</span>';
      
      renderDoneActions.classList.remove('hidden');
    };

    // Make sure playback is paused before rendering
    pausePlayback();

    const durationTotal = getTotalTimelineDuration();
    let currentRenderTime = 0;
    
    // Unmute video temporarily and set volume during recording, but hide/mute system-wide if needed
    // The WebRTC grab will capture the audio correctly
    hiddenVideo.muted = false;
    hiddenVideo.currentTime = timelineToSourceTime(0);

    mediaRecorder.start();

    // Set rendering interval loops (roughly 30 fps)
    hiddenVideo.play();
    
    const renderInterval = setInterval(() => {
      // Advance timeline position
      const sTime = hiddenVideo.currentTime;
      currentRenderTime = sourceToTimelineTime(sTime);

      if (currentRenderTime >= durationTotal || hiddenVideo.ended) {
        clearInterval(renderInterval);
        hiddenVideo.pause();
        mediaRecorder.stop();
        return;
      }

      // Draw frames onto export canvas
      expCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);
      
      const drawRatioW = expCanvas.width;
      const drawRatioH = expCanvas.height;
      const sRatio = hiddenVideo.videoWidth / hiddenVideo.videoHeight;
      const tRatio = expCanvas.width / expCanvas.height;
      
      let dW = drawRatioW;
      let dH = drawRatioH;
      let dX = 0;
      let dY = 0;

      if (sRatio > tRatio) {
        dH = drawRatioW / sRatio;
        dY = (drawRatioH - dH) / 2;
      } else {
        dW = drawRatioH * sRatio;
        dX = (drawRatioW - dW) / 2;
      }

      // Filters
      const currentFilter = currentProject.filter;
      expCtx.filter = 'none';

      if (currentFilter === 'vhs-cyber') {
        expCtx.filter = 'contrast(1.25) saturate(1.4) hue-rotate(-20deg) sepia(0.15)';
      } else if (currentFilter === 'neon-glitch') {
        expCtx.filter = 'contrast(1.5) saturate(1.8) hue-rotate(140deg)';
      } else if (currentFilter === 'grayscale') {
        expCtx.filter = 'grayscale(1) contrast(1.1) brightness(0.95)';
      } else if (currentFilter === 'scanlines') {
        expCtx.filter = 'contrast(1.15) saturate(1.1)';
      }

      expCtx.drawImage(hiddenVideo, dX, dY, dW, dH);

      // CRT overlays
      if (currentFilter === 'scanlines' || currentFilter === 'vhs-cyber') {
        expCtx.fillStyle = 'rgba(0, 0, 0, 0.13)';
        for (let i = 0; i < expCanvas.height; i += 3) {
          expCtx.fillRect(0, i, expCanvas.width, 1);
        }
      }

      // Text Overlays
      expCtx.filter = 'none';
      currentProject.texts.forEach(textObj => {
        if (currentRenderTime >= textObj.start && currentRenderTime <= textObj.end) {
          expCtx.font = `bold ${textObj.fontSize}px 'JetBrains Mono', monospace`;
          expCtx.textAlign = 'center';
          expCtx.textBaseline = 'middle';
          
          const pxX = (textObj.x / 100) * expCanvas.width;
          const pxY = (textObj.y / 100) * expCanvas.height;

          expCtx.shadowColor = textObj.color;
          expCtx.shadowBlur = 8;
          expCtx.fillStyle = textObj.color;
          expCtx.fillText(textObj.text.toUpperCase(), pxX, pxY);
          expCtx.shadowBlur = 0;
        }
      });

      // Update progress percent
      const progress = Math.min(100, Math.floor((currentRenderTime / durationTotal) * 100));
      renderProgressBar.style.width = `${progress}%`;
      renderProgressPercent.textContent = `${progress}%`;

    }, 33.3); // ~30 FPS
  });

  btnDownloadRender.addEventListener('click', () => {
    if (!renderVideoURL) return;
    const a = document.createElement('a');
    a.href = renderVideoURL;
    a.download = `${currentProject.name.toLowerCase().replace(/\s+/g, '_')}_render.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  btnCloseRenderOverlay.addEventListener('click', () => {
    renderOverlay.classList.remove('show');
    renderOverlay.setAttribute('aria-hidden', 'true');
    // Restore default state
    hiddenVideo.muted = true;
    seekTimeline(0);
  });

});
