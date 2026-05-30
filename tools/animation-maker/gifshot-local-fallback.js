(() => {
    'use strict';

    if (typeof window.gifshot !== 'undefined' && typeof window.gifshot.createGIF === 'function') return;

    class ByteWriter {
        constructor() { this.bytes = []; }
        byte(value) { this.bytes.push(value & 255); }
        word(value) { this.byte(value); this.byte(value >> 8); }
        ascii(value) { for (let index = 0; index < value.length; index += 1) this.byte(value.charCodeAt(index)); }
        append(values) { for (const value of values) this.byte(value); }
        toUint8Array() { return new Uint8Array(this.bytes); }
    }

    function makePalette() {
        const palette = [0, 0, 0];
        for (let red = 0; red < 6; red += 1) {
            for (let green = 0; green < 7; green += 1) {
                for (let blue = 0; blue < 6; blue += 1) {
                    palette.push(
                        Math.round((red / 5) * 255),
                        Math.round((green / 6) * 255),
                        Math.round((blue / 5) * 255)
                    );
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

    function writeSubBlocks(writer, bytes) {
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

        function resetDictionary() {
            dictionary = new Map();
            nextCode = endCode + 1;
            codeSize = minimumCodeSize + 1;
        }
        function outputCode(code) {
            bitBuffer |= code << bitLength;
            bitLength += codeSize;
            while (bitLength >= 8) {
                output.push(bitBuffer & 255);
                bitBuffer >>= 8;
                bitLength -= 8;
            }
        }

        resetDictionary();
        outputCode(clearCode);
        if (!indexedPixels.length) {
            outputCode(endCode);
        } else {
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
            outputCode(endCode);
        }
        if (bitLength > 0) output.push(bitBuffer & 255);
        return output;
    }

    function dataUriFromBytes(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
            binary += String.fromCharCode(...chunk);
        }
        return `data:image/gif;base64,${window.btoa(binary)}`;
    }

    function loadIndexedFrame(source, width, height) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                try {
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
                    resolve(indexed);
                } catch (error) { reject(error); }
            };
            image.onerror = () => reject(new Error('Unable to read one of the rendered animation frames.'));
            image.src = source;
        });
    }

    async function buildGif(options) {
        const width = Math.max(1, parseInt(options.gifWidth, 10) || 480);
        const height = Math.max(1, parseInt(options.gifHeight, 10) || 480);
        const sources = Array.isArray(options.images) ? options.images : [];
        if (!sources.length) throw new Error('There are no rendered frames to encode.');
        const delay = Math.max(1, Math.round((Number(options.interval) || 0.2) * 100));
        const repeat = Number.isInteger(options.repeat) && options.repeat >= 0 ? options.repeat : 0;
        const writer = new ByteWriter();
        const palette = makePalette();

        writer.ascii('GIF89a');
        writer.word(width);
        writer.word(height);
        writer.byte(0xF7);
        writer.byte(0);
        writer.byte(0);
        writer.append(palette);

        writer.byte(0x21);
        writer.byte(0xFF);
        writer.byte(0x0B);
        writer.ascii('NETSCAPE2.0');
        writer.byte(0x03);
        writer.byte(0x01);
        writer.word(repeat);
        writer.byte(0x00);

        for (const source of sources) {
            const pixels = await loadIndexedFrame(source, width, height);
            writer.byte(0x21);
            writer.byte(0xF9);
            writer.byte(0x04);
            writer.byte(0x09);
            writer.word(delay);
            writer.byte(0x00);
            writer.byte(0x00);

            writer.byte(0x2C);
            writer.word(0);
            writer.word(0);
            writer.word(width);
            writer.word(height);
            writer.byte(0x00);
            writer.byte(0x08);
            writeSubBlocks(writer, lzwEncode(pixels, 8));
        }
        writer.byte(0x3B);
        return dataUriFromBytes(writer.toUint8Array());
    }

    window.gifshot = {
        __organonLocalFallback: true,
        createGIF(options, callback) {
            buildGif(options).then(
                (image) => callback({ error: false, image }),
                (error) => callback({ error: true, errorCode: error.message })
            );
        }
    };
})();
