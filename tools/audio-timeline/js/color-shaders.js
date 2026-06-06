/**
 * ORGANON STUDIO: COLOR SHADERS & CHROMINANCE
 * Analyzes frame luminance to detect AI exposure shifts and suggest corrections.
 */

const rawCanvas = document.getElementById('chroma-canvas-raw');
const fixedCanvas = document.getElementById('chroma-canvas-fixed');
const masterCanvas = document.getElementById('master-canvas');

const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
const fixedCtx = fixedCanvas.getContext('2d');

// State for baseline brightness comparison
let baselineLuminance = null;

/**
 * Calculates the average luminance of a given canvas context.
 * Uses the standard WCAG relative luminance formula.
 */
function calculateAverageLuminance(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    let totalLuminance = 0;
    let pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        // Luminance formula
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        totalLuminance += lum;
    }
    
    return totalLuminance / pixelCount;
}

/**
 * Pulls the current frame from the master canvas, downsamples it to the mini-panel,
 * checks for brightness shifts, and draws a corrected version.
 */
export function analyzeCurrentFrame() {
    // 1. Draw master canvas to the mini "Raw" canvas
    rawCtx.drawImage(masterCanvas, 0, 0, rawCanvas.width, rawCanvas.height);
    
    // 2. Calculate its brightness
    const currentLuminance = calculateAverageLuminance(rawCtx, rawCanvas.width, rawCanvas.height);
    
    // Set baseline if it's the first time we are checking
    if (baselineLuminance === null) {
        baselineLuminance = currentLuminance;
    }

    // 3. Calculate the difference (Delta)
    const diff = baselineLuminance - currentLuminance;
    
    // 4. Draw the "Fixed" version by applying a brightness filter
    // We convert the difference to a percentage for the CSS filter
    let correctionPercentage = 100; 
    if (diff > 5 || diff < -5) {
        // If there's a noticeable shift, calculate counter-balance
        correctionPercentage = 100 + (diff / 255) * 100;
    }

    fixedCtx.filter = `brightness(${correctionPercentage}%)`;
    fixedCtx.drawImage(rawCanvas, 0, 0, fixedCanvas.width, fixedCanvas.height);
    fixedCtx.filter = 'none'; // Reset filter

    // Output data to the console for debugging
    console.log(`Luminance: ${Math.round(currentLuminance)} | Target: ${Math.round(baselineLuminance)} | Correction: ${correctionPercentage.toFixed(1)}%`);
}

/**
 * Resets the baseline so the user can set a new "target" brightness frame.
 */
export function setBaselineLuminance() {
    rawCtx.drawImage(masterCanvas, 0, 0, rawCanvas.width, rawCanvas.height);
    baselineLuminance = calculateAverageLuminance(rawCtx, rawCanvas.width, rawCanvas.height);
    console.log(`New Baseline Luminance set to: ${baselineLuminance}`);
}