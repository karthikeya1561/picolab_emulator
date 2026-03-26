/**
 * This file contains helper values like colors and logging functions.
 * It is used by other files to keep things consistent.
 */

export const colorMap = [
    '#000000', '#8B5B29', '#FF0000', '#FF8C00', '#FFFF00',
    '#4CAF50', '#2196F3', '#9C27B0', '#808080', '#FFFFFF'
];

export const digitColors = {
    0: '#000000', 1: '#8B5B29', 2: '#FF0000', 3: '#FFA500',
    4: '#FFFF00', 5: '#008000', 6: '#0000FF', 7: '#EE82EE',
    8: '#808080', 9: '#FFFFFF'
};

export const multiplierColors = {
    '-2': '#C0C0C0', '-1': '#FFD700', '0': '#000000', '1': '#8B5B29',
    '2': '#FF0000', '3': '#FFA500', '4': '#FFFF00', '5': '#008000',
    '6': '#0000FF', '7': '#EE82EE', '8': '#808080', '9': '#FFFFFF'
};

export const ledColorMap = {
    '#ef4444': { light: '#f87171', dark: '#b91c1c' },
    '#22c55e': { light: '#4ade80', dark: '#15803d' },
    '#3b82f6': { light: '#60a5fa', dark: '#1d4ed8' },
    '#facc15': { light: '#fde047', dark: '#ca8a04' },
    '#f97316': { light: '#fb923c', dark: '#c2410c' },
    '#a855f7': { light: '#c084fc', dark: '#7e22ce' },
    '#ec4899': { light: '#f472b6', dark: '#be185d' },
    '#22d3ee': { light: '#67e8f9', dark: '#0e7490' },
    '#ffffff': { light: '#ffffff', dark: '#e5e5e5' },
    '#a3e635': { light: '#bef264', dark: '#4d7c0f' }
};

let outputElement = null;

export function setOutputElement(element) {
    outputElement = element;
}

export function appendLog(info, type = "info") {
    if (!outputElement) return;
    const div = document.createElement("div");
    div.className = "flex gap-3 items-start group animate-in fade-in slide-in-from-bottom-1 duration-300";

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let colorClass = "text-gray-300";
    let typeLabel = "";

    if (type === "error") {
        colorClass = "text-red-400 font-bold";
        typeLabel = `<span class="text-red-500 shrink-0 select-none">[Error]</span>`;
    } else if (type === "system") {
        colorClass = "text-blue-400 italic";
        typeLabel = `<span class="text-blue-500 shrink-0 select-none">[System]</span>`;
    } else {
        typeLabel = `<span class="text-gray-600 shrink-0 select-none">[${timestamp}]</span>`;
    }

    div.innerHTML = `${typeLabel}<span class="${colorClass} break-all font-mono">${info}</span>`;
    outputElement.appendChild(div);
    outputElement.scrollTop = outputElement.scrollHeight;
}
