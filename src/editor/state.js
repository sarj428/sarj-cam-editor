/**
 * @fileoverview Central state management for the SARJ-CAM editor session.
 */

import { createId } from '../utils/ids.js';

/**
 * @typedef {Object} ClipSegment
 * @property {string} id
 * @property {number} start
 * @property {number} end
 * @property {number} duration
 */

/**
 * @typedef {Object} TextOverlay
 * @property {string} id
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @property {number} fontSize
 * @property {string} color
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} EditorProject
 * @property {string} id
 * @property {string} name
 * @property {Blob|null} videoBlob
 * @property {string} videoName
 * @property {number} videoSize
 * @property {number} videoDuration
 * @property {number} updatedAt
 * @property {'16/9'|'9/16'|'1/1'} aspectRatio
 * @property {number} speed
 * @property {string} filter
 * @property {number} volume
 * @property {ClipSegment[]} clips
 * @property {TextOverlay[]} texts
 */

/**
 * Creates an empty default project object.
 * @param {string} [name] - Optional project name.
 * @returns {EditorProject}
 */
export function createDefaultProject(name) {
  const defaultName =
    name && name.trim() !== '' ? name.trim() : 'SARJ-' + new Date().toLocaleTimeString();
  return {
    id: createId('proj'),
    name: defaultName,
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
}

/** @type {EditorProject} */
let currentProject = createDefaultProject('Default Project');
let playheadTime = 0;
let isPlaying = false;
/** @type {string|null} */
let selectedClipId = null;
/** @type {string|null} */
let selectedTextId = null;
let zoomLevel = 2;
/** @type {string|null} */
let videoSourceUrl = null;

export function getCurrentProject() {
  return currentProject;
}

/**
 * @param {EditorProject} project
 */
export function setCurrentProject(project) {
  currentProject = project;
}

export function getPlayheadTime() {
  return playheadTime;
}

/**
 * @param {number} time
 */
export function setPlayheadTime(time) {
  playheadTime = Math.max(0, time);
}

export function getIsPlaying() {
  return isPlaying;
}

/**
 * @param {boolean} playing
 */
export function setIsPlaying(playing) {
  isPlaying = playing;
}

export function getSelectedClipId() {
  return selectedClipId;
}

/**
 * @param {string|null} id
 */
export function setSelectedClipId(id) {
  selectedClipId = id;
}

export function getSelectedTextId() {
  return selectedTextId;
}

/**
 * @param {string|null} id
 */
export function setSelectedTextId(id) {
  selectedTextId = id;
}

export function getZoomLevel() {
  return zoomLevel;
}

/**
 * @param {number} zoom
 */
export function setZoomLevel(zoom) {
  zoomLevel = Math.max(1, Math.min(5, zoom));
}

export function getVideoSourceUrl() {
  return videoSourceUrl;
}

/**
 * @param {string|null} url
 */
export function setVideoSourceUrl(url) {
  if (videoSourceUrl && videoSourceUrl !== url) {
    try {
      URL.revokeObjectURL(videoSourceUrl);
    } catch {
      // Ignore URL revocation errors on discarded object URLs
    }
  }
  videoSourceUrl = url;
}
