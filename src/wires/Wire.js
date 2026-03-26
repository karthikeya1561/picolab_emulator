/**
 * This file handles how wires look.
 * It calculates the curved path for the wire to follow.
 * It creates the line you see on the screen.
 */

import { ledColorMap } from '../utils/Helpers.js';

export function getOrthogonalPath(x1, y1, x2, y2, flipped = false) {
    const r = 16; // Smoother radius

    // Check if points are aligned (straight line)
    if (x1 === x2 || y1 === y2) {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (!flipped) {
        // Vertical first (move y), then Horizontal (move x)
        // Corner at (x1, y2)
        const dx = x2 - x1;
        const dy = y2 - y1;

        // Effective radius cannot exceed segment lengths
        const rx = Math.min(r, Math.abs(dx));
        const ry = Math.min(r, Math.abs(dy));
        const R = Math.min(rx, ry);

        const sy = dy > 0 ? 1 : -1;
        const sx = dx > 0 ? 1 : -1;

        // Start (x1, y1) -> Line to (x1, y2 - sy*R) -> Curve to (x1 + sx*R, y2) -> Line to (x2, y2)
        return `M ${x1} ${y1} L ${x1} ${y2 - sy * R} Q ${x1} ${y2} ${x1 + sx * R} ${y2} L ${x2} ${y2}`;
    } else {
        // Horizontal first (move x), then Vertical (move y)
        // Corner at (x2, y1)
        const dx = x2 - x1;
        const dy = y2 - y1;

        const rx = Math.min(r, Math.abs(dx));
        const ry = Math.min(r, Math.abs(dy));
        const R = Math.min(rx, ry);

        const sx = dx > 0 ? 1 : -1;
        const sy = dy > 0 ? 1 : -1;

        // Start (x1, y1) -> Line to (x2 - sx*R, y1) -> Curve to (x2, y1 + sy*R) -> Line to (x2, y2)
        return `M ${x1} ${y1} L ${x2 - sx * R} ${y1} Q ${x2} ${y1} ${x2} ${y1 + sy * R} L ${x2} ${y2}`;
    }
}

export function createWireElement(wire, wireLayer) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    path.setAttribute("fill", "none");
    path.setAttribute("stroke", wire.color);
    path.setAttribute("stroke-width", "10"); // Maximized Thickness (User Req)
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("style", "pointer-events:stroke; cursor:pointer");

    wireLayer.appendChild(path);
    wire.pathElement = path;

    // Interactions handled by attachWireListeners in Manager to avoid circular deps?
    // Or we attach them here if we pass the callback.
    // For now, return the path and let manager attach logic.
    return path;
}
