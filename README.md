# SARJ-CAM

> Browser-based retro video editor built with HTML5 Canvas, the Web MediaStream Recording API, and IndexedDB.

[![Live Demo](https://img.shields.io/badge/Demo-editingapp.netlify.app-00ad9f?style=flat-square)](https://editingapp.netlify.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES_Modules-F7DF1E?logo=javascript&logoColor=black&style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Build Tool: Vite](https://img.shields.io/badge/Bundler-Vite_8-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev/)

SARJ-CAM is a lightweight, zero-framework client-side video editor crafted to demonstrate core browser media engineering. It processes video frames directly on the CPU/GPU via the HTML5 2D Canvas context, applies custom CRT scanline passes and retro chromatic presets, sequences text overlays, and encodes the final result to WebM directly inside the browser using `MediaRecorder`.

---

## 🚀 Live Demo

- **Production URL:** [https://editingapp.netlify.app](https://editingapp.netlify.app)
- **Studio Interface:** [https://editingapp.netlify.app/editor.html](https://editingapp.netlify.app/editor.html)
- **Source Code:** [https://github.com/sarj428/sarj-cam-editor](https://github.com/sarj428/sarj-cam-editor)

---

## 📸 Demo & Screenshots

> **Note for Reviewers & Recruiters:**  
> The section below contains placeholders for recorded demo assets. To record these:
>
> 1. Open `http://localhost:5173/editor.html`
> 2. Upload a sample clip (10–15 seconds, 1080p or 720p).
> 3. Record a 15-second screen capture demonstrating filter switching (VHS Glitch), timeline splitting, and title overlay creation. Convert to GIF or MP4 and place into `docs/demo.gif`.

```
+-------------------------------------------------------------------------+
|                                                                         |
|                          [ DEMO RECORDING ]                             |
|          Place docs/demo.gif or docs/screenshot-editor.png here         |
|                                                                         |
+-------------------------------------------------------------------------+
```

---

## 🛠 Features (Verified in Code)

Every feature listed below is implemented and tested in the codebase without external framework dependencies:

- **Drag-and-Drop Ingestion with Validation:**
  - Drag-and-drop or file picker upload (`#video-drop-zone`).
  - Validation engine verifying MIME types, video extensions, and an enforced 500 MB maximum file threshold (`validateVideoFile`).
  - User-facing non-blocking cyber toast messages for malformed inputs (no legacy `alert()` calls).
- **Real-Time HTML5 Canvas 2D Render Engine:**
  - Synchronous `requestAnimationFrame` frame pipeline with aspect-ratio letterboxing calculation (`computeLetterbox`).
  - Standby dynamic grid rendering with timecode displays prior to asset loading.
- **Retro Filter Presets & Shader Passes:**
  - 4 distinct presets: **VHS Glitch**, **Cyberpunk 2084**, **Noir 1940**, and **Raw / Neutral**.
  - Direct canvas scanline pass rendering (`renderScanlines`) via programmatic `createImageData` / raster scanlines.
- **Dynamic Text Overlay Sequencing:**
  - Modal with strict Tab focus trapping and Escape-to-close accessibility handlers.
  - In/Out point timing logic; overlays dynamically project onto the canvas during designated timeline frames.
- **Interactive Multi-Clip Timeline:**
  - Coordinate translation math mapping mouse clicks and playhead positions to absolute source time.
  - Non-destructive clip splitting (`splitClipAtTime`) and segment removal (`deleteClipSegment`).
  - Keyboard shortcuts: `Space` (Play/Pause), `ArrowLeft`/`ArrowRight` (±1s seek).
- **Resilient IndexedDB Persistence:**
  - Native IndexedDB object store wrapper with private-mode detection guard.
  - Automatic fallback to an in-memory `Map` when storage is blocked or quotas are exceeded.
  - Saves clip cuts, active filters, title overlay coordinates, and metadata.
- **JSON Project Portability:**
  - Direct schema serialization to `.json` files for external backups and project restoration.
- **Client-Side WebM Export:**
  - Code-split rendering pipeline (`exportRender.js` loaded on demand via dynamic `import()`).
  - Offline rendering loop with `captureStream()` and `MediaRecorder` encoding to VP8/VP9 WebM.

---

## 🏗 Architecture & Engineering Highlights

```mermaid
flowchart TD
    subgraph Input_Layer [Input & Persistence]
        A[Video File / Drop Zone] -->|Validation| B[HTML5 Video Element]
        C[(IndexedDB Project Store)] <-->|Save / Load Session| D[Central State]
        E[JSON Import / Export] <-->|Backup / Restore| D
    end

    subgraph Core_Engine [Reactive Playback & Render Loop]
        B --> F[requestAnimationFrame Loop]
        D --> F
        F --> G[Aspect Letterbox Math]
        G --> H[2D Canvas Context]
        H --> I[CSS Filter Preset Pass]
        I --> J[Procedural CRT Scanlines]
        J --> K[Text Overlay Compositing]
    end

    subgraph Export_Pipeline [On-Demand WebM Pipeline]
        L[Render Button Click] -.->|Dynamic import()| M[exportRender.js]
        M --> N[Offscreen Canvas Step Render]
        N --> O[canvas.captureStream]
        O --> P[MediaRecorder WebM VP8/9]
        P --> Q[Browser File Download]
    end

    K -->|Active Display| R[Main Studio Viewport]
```

### Canvas 2D Rendering Pipeline

Rather than relying on DOM overlays over a `<video>` tag, the application pipes decoded video frames into an offscreen/visible 2D canvas at display refresh rate. Letterboxing dimensions are computed dynamically (`computeLetterbox`) to prevent distortion across non-16:9 aspect ratios. On each tick, the rasterizer composites:

1. Clear pass with background fill (`#050811`).
2. Source video frame with active color transformation matrices applied.
3. Procedural CRT scanline overlays for retro aesthetic presets.
4. Active text overlays filtered by `currentTime >= item.startTime && currentTime <= item.endTime`.

### Resilient Client-Side Storage

All project metadata is stored locally via an IndexedDB Object Store (`sarj-cam-db`). The storage module (`projectStore.js`) implements a runtime availability check (`typeof window.indexedDB` and quota try-catch). If running in a restrictive sandboxed iframe or private browsing mode where IndexedDB throws `SecurityError`, the engine gracefully drops down to an in-memory `Map` store, alerting the user via the UI toast system without crashing.

---

## 📦 Project Structure

```
editor/
├── public/                 # Static assets (favicons, previews, sample images)
├── src/
│   ├── editor/
│   │   ├── canvasRenderer.js # Letterboxing, frame rasterization, scanline shaders
│   │   ├── exportRender.js   # Code-split offscreen renderer & MediaRecorder pipeline
│   │   ├── filters.js        # Color presets & CRT scanline raster math
│   │   ├── playback.js       # requestAnimationFrame playback synchronization
│   │   ├── state.js          # Centralized reactive state store
│   │   ├── textOverlays.js   # Overlay CRUD & modal focus management
│   │   ├── timeline.js       # Pure timeline math (splitting, coordinate mapping)
│   │   ├── ui.js             # Accessible modal hooks, 3D card tilts, mobile banner
│   │   └── uiToast.js        # Non-blocking cyber-styled toast notification system
│   ├── storage/
│   │   └── projectStore.js   # IndexedDB wrapper with in-memory fallback
│   ├── utils/
│   │   ├── formatters.js     # Pure timecode & byte formatters
│   │   ├── ids.js            # Unique ID generator
│   │   └── validation.js     # File integrity, MIME, and schema validators
│   ├── editor.js             # Studio view orchestrator
│   ├── main.js               # Landing page scroll animations & interactions
│   └── style.css             # Unified CSS tokens, typography, and dark UI styles
├── .editorconfig           # Consistent cross-editor formatting rules
├── .prettierrc             # Prettier configuration
├── eslint.config.js        # Flat ESLint configuration (ES2024 + Browser globals)
├── index.html              # Marketing landing page
├── editor.html             # Studio editor application shell
├── package.json            # Scripts and devDependencies
└── vite.config.js          # Multi-page build configuration
```

---

## ⚡ Performance & Bundle Metrics

Measurements taken directly from the production build (`vite build`):

| Asset                 | Size        | Gzip Size   | Load Strategy                                   |
| --------------------- | ----------- | ----------- | ----------------------------------------------- |
| `editor.html`         | 30.33 kB    | 5.64 kB     | Direct document load                            |
| `index.html`          | 28.48 kB    | 5.55 kB     | Direct document load                            |
| `style.css`           | 61.18 kB    | 10.54 kB    | Render-blocking stylesheet with CSS variables   |
| `editor.js`           | 36.11 kB    | 11.82 kB    | Main editor script                              |
| `main.js`             | 5.42 kB     | 2.12 kB     | Landing page script only (separate entry point) |
| **`exportRender.js`** | **2.54 kB** | **1.21 kB** | **Lazy-loaded on demand (`dynamic import`)**    |

- **Zero Runtime Dependencies:** Built strictly using native Web APIs.
- **Asset Optimization:** Legacy 6.4 MB GIF replaced with optimized `<video>` element (`.webm` at 435 kB, `.mp4` at 920 kB), reducing hero asset weight by over 93%.

---

## 💻 Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher recommended)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/sarj428/sarj-cam-editor.git
cd sarj-cam-editor

# Install development dependencies
npm install
```

### Development Server

```bash
# Start local Vite dev server at http://localhost:5173
npm run dev
```

### Production Build & Preview

```bash
# Lint code for syntax and style issues
npm run lint

# Build production bundle into /dist
npm run build

# Preview production build locally
npm run preview
```

### Code Formatting

```bash
# Check code formatting with Prettier
npm run format:check

# Auto-format all files
npm run format
```

---

## 👨‍💻 Author

**Sarthak Joshi**

- GitHub: [@sarj428](https://github.com/sarj428)
- LinkedIn: [Sarthak Joshi](https://linkedin.com/in/sarthak-joshi-)
- Project Portfolio: [https://editingapp.netlify.app](https://editingapp.netlify.app)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.
