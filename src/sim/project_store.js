/**
 * Project Save & Share — Step 13
 * 
 * Handles project persistence (localStorage) and shareable links (base64 URL).
 * 
 * This module is pure data — no DOM manipulation, no UI changes.
 * It serializes/deserializes project state: code, language, components,
 * wires (connections), and board type.
 * 
 * Data flow:
 *   save(project) → localStorage
 *   load() → project | null
 *   shareProject(project) → URL string
 *   loadFromURL() → project | null
 */

// ─── Constants ───────────────────────────────────────────────────────

const PROJECT_VERSION = 1;
const STORAGE_KEY = 'circuitflow_project';
const URL_PARAM = 'p';
const AUTO_SAVE_DELAY = 1000; // ms debounce

// ─── Project Creation ────────────────────────────────────────────────

/**
 * Creates a versioned project object from current app state.
 * 
 * @param {string} code — editor source code
 * @param {string} language — 'python' or 'c'
 * @param {Array} components — CanvasManager.components array
 * @param {Array} wires — CanvasManager.wires array
 * @param {string} board — board identifier (default: 'pico_w')
 * @returns {object} serializable project object
 */
export function createProject(code, language, components, wires, board = 'pico_w') {
    return {
        version: PROJECT_VERSION,
        language,
        code,
        board,
        components: serializeComponents(components),
        connections: serializeWires(wires)
    };
}

// ─── Serialization Helpers ───────────────────────────────────────────

/**
 * Extracts serializable data from component objects.
 * Strips DOM references (div, pathElement) and runtime-only state (isPressed).
 */
export function serializeComponents(components) {
    return components.map(c => {
        const base = {
            id: c.id,
            type: getComponentType(c.id),
            x: c.x,
            y: c.y,
            rotation: c.rotation || 0
        };

        // Type-specific properties
        if (c.id.startsWith('led_')) {
            base.color = c.color || '#ef4444';
            base.flipped = c.flipped || false;
        } else if (c.id.startsWith('res_')) {
            base.value = c.value;
            base.unit = c.unit;
        }
        // Push buttons have no extra serializable state

        return base;
    });
}

/**
 * Extracts serializable data from wire objects.
 * Preserves endpoint node data needed for wiring restoration.
 */
export function serializeWires(wires) {
    return wires.map(w => ({
        start: serializeNode(w.start),
        end: serializeNode(w.end),
        color: w.color || '#15803d'
    }));
}

/**
 * Serializes a wire endpoint node.
 * GPIO nodes: { nodeType, pin, x, y } — coords needed for wire rendering
 * Component pins: { nodeType, componentId, pin } — coords recalculated from component position
 */
function serializeNode(node) {
    const result = { nodeType: node.nodeType, pin: node.pin };
    if (node.nodeType === 'component_pin') {
        result.componentId = node.componentId;
    }
    if (node.gpNum !== undefined && node.gpNum !== null) {
        result.gpNum = node.gpNum;
    }
    // Save coordinates for GPIO nodes (needed for wire path rendering on restore)
    if (node.nodeType === 'gpio' && node.x !== undefined && node.y !== undefined) {
        result.x = node.x;
        result.y = node.y;
    }
    return result;
}

/**
 * Derives component type string from ID prefix.
 */
function getComponentType(id) {
    if (id.startsWith('led_')) return 'led';
    if (id.startsWith('res_')) return 'resistor';
    if (id.startsWith('btn_')) return 'button';
    return 'unknown';
}

// ─── localStorage Persistence ────────────────────────────────────────

/**
 * Saves a project to localStorage.
 * 
 * @param {object} project — project object from createProject()
 */
export function save(project) {
    try {
        const json = JSON.stringify(project);
        sessionStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
        console.warn('[ProjectStore] Failed to save project:', err.message);
    }
}

/**
 * Loads a project from localStorage.
 * 
 * @returns {object|null} project object, or null if nothing saved / parse error
 */
export function load() {
    try {
        const json = sessionStorage.getItem(STORAGE_KEY);
        if (!json) return null;

        const project = JSON.parse(json);
        if (!project || !project.version) {
            console.warn('[ProjectStore] Invalid project data in localStorage');
            return null;
        }

        return project;
    } catch (err) {
        console.warn('[ProjectStore] Failed to load project:', err.message);
        return null;
    }
}

// ─── URL Sharing ─────────────────────────────────────────────────────

/**
 * Encodes a project object to a base64 string.
 * Uses encodeURIComponent for Unicode safety before btoa.
 * 
 * @param {object} project — project object
 * @returns {string} base64-encoded string
 */
export function encodeProject(project) {
    const json = JSON.stringify(project);
    // Handle Unicode: encode to percent-escaped ASCII, then btoa
    return btoa(encodeURIComponent(json));
}

/**
 * Decodes a base64 string back to a project object.
 * 
 * @param {string} encoded — base64 string
 * @returns {object|null} project object, or null on failure
 */
export function decodeProject(encoded) {
    try {
        const json = decodeURIComponent(atob(encoded));
        const project = JSON.parse(json);
        if (!project || !project.version) return null;
        return project;
    } catch (err) {
        console.warn('[ProjectStore] Failed to decode project:', err.message);
        return null;
    }
}

/**
 * Generates a shareable URL containing the full project state.
 * 
 * @param {object} project — project object
 * @returns {string} full URL with ?p= parameter
 */
export function shareProject(project) {
    const encoded = encodeProject(project);
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM, encoded);
    // Remove hash if present
    url.hash = '';
    return url.toString();
}

/**
 * Checks the current URL for a shared project parameter.
 * If found, decodes and returns the project, then cleans the URL.
 * 
 * @returns {object|null} project object from URL, or null
 */
export function loadFromURL() {
    try {
        const url = new URL(window.location.href);
        const encoded = url.searchParams.get(URL_PARAM);
        if (!encoded) return null;

        const project = decodeProject(encoded);
        if (project) {
            // Clean the URL (remove ?p= param) without page reload
            url.searchParams.delete(URL_PARAM);
            window.history.replaceState({}, '', url.toString());
            console.log('[ProjectStore] Loaded project from shared URL');
        }
        return project;
    } catch (err) {
        console.warn('[ProjectStore] Failed to load from URL:', err.message);
        return null;
    }
}

// ─── Auto-Save ───────────────────────────────────────────────────────

/**
 * Creates a debounced auto-save mechanism.
 * 
 * @param {Function} getProjectFn — callback that returns the current project object
 * @returns {Function} trigger function — call this whenever project state changes
 */
export function setupAutoSave(getProjectFn) {
    let timer = null;

    const trigger = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            const project = getProjectFn();
            if (project) {
                save(project);
            }
        }, AUTO_SAVE_DELAY);
    };

    return trigger;
}
