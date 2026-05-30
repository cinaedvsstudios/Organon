(() => {
    'use strict';

    const cdnGifshot = window.gifshot && typeof window.gifshot.createGIF === 'function' ? window.gifshot : null;

    class ByteWriter {
        constructor() { this.bytes = []; }
        byte(value) { this.bytes.push(value & 255); }
        word(value) { this.byte(value); this.byte(value >> 8); }
        ascii(value) { for (let index = 0; index < value.length; index += 1) this.byte(value.charCodeAt(index)); }
        append(values) { for (const value of values) this.byte(value); }
        toUint8Array() { return new Uint8Array(this.bytes); }
    }

    function makeGifPalette() {
        const palette = [0, 0, 0];
        for (let red = 0; red < 6; red += 1) {
            for (let green = 0; green < 7; green += 1) {
                for (let blue = 0; blue < 6; blue += 1) {
                    palette.push(Math.round((red / 5) * 255), Math.round((green / 6) * 255), Math.round((blue / 5) * 255));
                }
            }
        }
        while (palette.length < 256 * 3) palette.push(0);
        return palette;
    }

    function pixelToPaletteIndex(red, green, blue, alpha) {
        if (alpha < 24) return 0;
        const r = Math.min(5, Math.round((red / 255) * 5));
        const g = Math.min(6, Math.round((green / 255) * 6));
        const b = Math.min(5, Math.round((blue / 255) * 5));
        return 1 + (r * 42) + (g * 6) + b;
    }

    function writeGifSubBlocks(writer, bytes) {
        let offset = 0;
        while (offset < bytes.length) {
            const length = Math.min(255, bytes.length - offset);
            writer.byte(length);
            for (let index = 0; index < length; index += 1) writer.byte(bytes[offset + index]);
            offset += length;
        }
        writer.byte(0);
    }

    function lzwEncode(indexedPixels, minimumCodeSize = 8) {
        const clearCode = 1 << minimumCodeSize;
        const endCode = clearCode + 1;
        let dictionary;
        let nextCode;
        let codeSize;
        let bitBuffer = 0;
        let bitLength = 0;
        const output = [];
        function resetDictionary() { dictionary = new Map(); nextCode = endCode + 1; codeSize = minimumCodeSize + 1; }
        function outputCode(code) {
            bitBuffer |= code << bitLength;
            bitLength += codeSize;
            while (bitLength >= 8) { output.push(bitBuffer & 255); bitBuffer >>= 8; bitLength -= 8; }
        }
        resetDictionary();
        outputCode(clearCode);
        if (indexedPixels.length) {
            let prefix = indexedPixels[0];
            for (let index = 1; index < indexedPixels.length; index += 1) {
                const suffix = indexedPixels[index];
                const key = `${prefix},${suffix}`;
                if (dictionary.has(key)) {
                    prefix = dictionary.get(key);
                } else {
                    outputCode(prefix);
                    if (nextCode < 4096) {
                        dictionary.set(key, nextCode);
                        nextCode += 1;
                        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
                    } else {
                        outputCode(clearCode);
                        resetDictionary();
                    }
                    prefix = suffix;
                }
            }
            outputCode(prefix);
        }
        outputCode(endCode);
        if (bitLength > 0) output.push(bitBuffer & 255);
        return output;
    }

    function bytesToDataUri(bytes, mimeType) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
        }
        return `data:${mimeType};base64,${window.btoa(binary)}`;
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Unable to read one of the rendered animation frames.'));
            image.src = source;
        });
    }

    async function loadIndexedGifFrame(source, width, height) {
        const image = await loadImage(source);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const rgba = context.getImageData(0, 0, width, height).data;
        const indexed = new Uint8Array(width * height);
        for (let offset = 0, pixel = 0; offset < rgba.length; offset += 4, pixel += 1) {
            indexed[pixel] = pixelToPaletteIndex(rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]);
        }
        return indexed;
    }

    async function buildFallbackGif(options) {
        const width = Math.max(1, parseInt(options.gifWidth, 10) || 480);
        const height = Math.max(1, parseInt(options.gifHeight, 10) || 480);
        const sources = Array.isArray(options.images) ? options.images : [];
        if (!sources.length) throw new Error('There are no rendered frames to encode.');
        const delay = Math.max(1, Math.round((Number(options.interval) || 0.2) * 100));
        const repeatInput = document.getElementById('play-count');
        const repeat = repeatInput ? Math.max(0, parseInt(repeatInput.value, 10) || 0) : 0;
        const writer = new ByteWriter();
        writer.ascii('GIF89a'); writer.word(width); writer.word(height); writer.byte(0xF7); writer.byte(0); writer.byte(0); writer.append(makeGifPalette());
        writer.byte(0x21); writer.byte(0xFF); writer.byte(0x0B); writer.ascii('NETSCAPE2.0'); writer.byte(0x03); writer.byte(0x01); writer.word(repeat); writer.byte(0x00);
        for (const source of sources) {
            const pixels = await loadIndexedGifFrame(source, width, height);
            writer.byte(0x21); writer.byte(0xF9); writer.byte(0x04); writer.byte(0x09); writer.word(delay); writer.byte(0); writer.byte(0);
            writer.byte(0x2C); writer.word(0); writer.word(0); writer.word(width); writer.word(height); writer.byte(0); writer.byte(0x08);
            writeGifSubBlocks(writer, lzwEncode(pixels, 8));
        }
        writer.byte(0x3B);
        return bytesToDataUri(writer.toUint8Array(), 'image/gif');
    }

    function textBytes(text) { return Uint8Array.from([...text].map((character) => character.charCodeAt(0))); }
    function uint16LE(value) { return Uint8Array.of(value & 255, (value >> 8) & 255); }
    function uint24LE(value) { return Uint8Array.of(value & 255, (value >> 8) & 255, (value >> 16) & 255); }
    function uint32LE(value) { return Uint8Array.of(value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255); }
    function concatenate(parts) {
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) { combined.set(part, offset); offset += part.length; }
        return combined;
    }
    function webpChunk(name, payload) {
        return concatenate([textBytes(name), uint32LE(payload.length), payload, payload.length % 2 ? Uint8Array.of(0) : new Uint8Array(0)]);
    }
    function readUint32LE(bytes, offset) {
        return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
    }
    function readText(bytes, offset, length) {
        return String.fromCharCode(...bytes.subarray(offset, offset + length));
    }

    async function sourceToStaticWebP(source, width, height, quality) {
        const image = await loadImage(source);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob || !/image\/webp/i.test(blob.type)) throw new Error('This browser cannot encode WebP images. Choose GIF output instead.');
        return new Uint8Array(await blob.arrayBuffer());
    }

    function extractFrameSubChunks(staticWebP) {
        if (readText(staticWebP, 0, 4) !== 'RIFF' || readText(staticWebP, 8, 4) !== 'WEBP') throw new Error('The browser returned invalid WebP frame data.');
        const keptChunks = [];
        let offset = 12;
        while (offset + 8 <= staticWebP.length) {
            const type = readText(staticWebP, offset, 4);
            const size = readUint32LE(staticWebP, offset + 4);
            const paddedLength = 8 + size + (size % 2);
            if (offset + paddedLength > staticWebP.length) break;
            if (type === 'ALPH' || type === 'VP8 ' || type === 'VP8L') keptChunks.push(staticWebP.slice(offset, offset + paddedLength));
            offset += paddedLength;
        }
        if (!keptChunks.some((chunk) => readText(chunk, 0, 4) === 'VP8 ' || readText(chunk, 0, 4) === 'VP8L')) throw new Error('No encodable image payload was found in a WebP frame.');
        return concatenate(keptChunks);
    }

    async function buildAnimatedWebP(options) {
        const width = Math.max(1, parseInt(options.gifWidth, 10) || 480);
        const height = Math.max(1, parseInt(options.gifHeight, 10) || 480);
        const sources = Array.isArray(options.images) ? options.images : [];
        if (!sources.length) throw new Error('There are no rendered frames to encode.');
        const qualityInput = document.getElementById('adj-webp-q');
        const losslessInput = document.getElementById('chk-webp-lossless');
        const quality = losslessInput && losslessInput.checked ? 1 : Math.max(0.01, Math.min(1, (parseInt(qualityInput && qualityInput.value, 10) || 80) / 100));
        const duration = Math.max(1, Math.round((Number(options.interval) || 0.2) * 1000));
        const repeatInput = document.getElementById('play-count');
        const repeat = repeatInput ? Math.max(0, Math.min(65535, parseInt(repeatInput.value, 10) || 0)) : 0;
        const frameChunks = [];
        for (const source of sources) {
            const framePayload = extractFrameSubChunks(await sourceToStaticWebP(source, width, height, quality));
            const frameHeader = concatenate([uint24LE(0), uint24LE(0), uint24LE(width - 1), uint24LE(height - 1), uint24LE(duration), Uint8Array.of(0x02)]);
            frameChunks.push(webpChunk('ANMF', concatenate([frameHeader, framePayload])));
        }
        const extendedHeader = concatenate([Uint8Array.of(0x12, 0, 0, 0), uint24LE(width - 1), uint24LE(height - 1)]);
        const animationHeader = concatenate([Uint8Array.of(0, 0, 0, 0), uint16LE(repeat)]);
        const body = concatenate([webpChunk('VP8X', extendedHeader), webpChunk('ANIM', animationHeader), ...frameChunks]);
        return concatenate([textBytes('RIFF'), uint32LE(body.length + 4), textBytes('WEBP'), body]);
    }

    function useWebPOutput() {
        const output = document.getElementById('opt-format');
        return output && output.value === 'webp';
    }
    function setDownloadFormat(format) {
        const anchor = document.getElementById('download-anchor');
        if (anchor) anchor.dataset.generatedFormat = format;
    }

    const gifEncoder = cdnGifshot || {
        createGIF(options, callback) {
            buildFallbackGif(options).then(
                (image) => callback({ error: false, image }),
                (error) => callback({ error: true, errorCode: error.message })
            );
        }
    };

    window.gifshot = {
        createGIF(options, callback) {
            if (useWebPOutput()) {
                buildAnimatedWebP(options).then(
                    (bytes) => {
                        setDownloadFormat('webp');
                        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
                        callback({ error: false, image: url });
                    },
                    (error) => callback({ error: true, errorCode: error.message })
                );
                return;
            }
            setDownloadFormat('gif');
            gifEncoder.createGIF(options, callback);
        }
    };

    function installWebPInterface() {
        const format = document.getElementById('opt-format');
        if (!format) return;
        const previousValue = format.value;
        format.innerHTML = '<option value="webp">WebP (Animated) — smaller file</option><option value="gif">GIF (Animated) — compatibility</option>';
        format.value = previousValue === 'gif' ? 'webp' : previousValue;
        if (!format.value) format.value = 'webp';
        const explanation = format.closest('.input-group') && format.closest('.input-group').nextElementSibling;
        if (explanation && explanation.classList.contains('help-text')) {
            explanation.textContent = 'Animated WebP is recommended for smaller files. GIF remains available for compatibility.';
        }
        const advancedCard = document.getElementById('advanced-webp-card');
        if (advancedCard) {
            const losslessSmall = advancedCard.querySelector('small');
            if (losslessSmall) losslessSmall.textContent = 'Uses maximum browser WebP quality; output size increases.';
            const effortLabel = [...advancedCard.querySelectorAll('.slider-label-row span')].find((element) => element.textContent.trim() === 'Compression Effort');
            if (effortLabel) effortLabel.textContent = 'Compression Effort (Browser Managed)';
            const effort = document.getElementById('adj-webp-effort');
            if (effort) effort.disabled = true;
        }
        const anchor = document.getElementById('download-anchor');
        if (anchor && !anchor.dataset.formatHandlerInstalled) {
            anchor.dataset.formatHandlerInstalled = 'true';
            anchor.addEventListener('click', () => {
                if (anchor.dataset.generatedFormat === 'webp') anchor.download = anchor.download.replace(/\.gif$/i, '.webp');
                if (anchor.dataset.generatedFormat === 'gif') anchor.download = anchor.download.replace(/\.webp$/i, '.gif');
            }, true);
        }
        format.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installWebPInterface);
    else installWebPInterface();
})();
