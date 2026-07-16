(() => {
    'use strict';

    function updateRealWebPControls() {
        const format = document.getElementById('opt-format');
        const overlay = document.getElementById('webp-overlay');
        const gifSettings = document.getElementById('gif-specific-settings');
        const advancedCard = document.getElementById('advanced-webp-card');
        const playText = document.getElementById('play-btn-text');
        if (!format) return;
        const webp = format.value === 'webp';
        if (overlay) overlay.hidden = true;
        if (advancedCard) advancedCard.hidden = !webp;
        if (gifSettings) {
            gifSettings.style.opacity = '1';
            gifSettings.style.pointerEvents = 'auto';
            const irrelevantControls = gifSettings.querySelectorAll('.checkbox-container:first-of-type, .slider-row');
            irrelevantControls.forEach((control) => { control.style.display = webp ? 'none' : ''; });
        }
        if (playText) playText.textContent = webp ? 'PLAY WebP' : 'PLAY GIF';
    }

    function normaliseMime(value) {
        const mime = String(value || '').toLowerCase();
        if (mime === 'image/jpg') return 'image/jpeg';
        return mime;
    }

    function formatForMime(value) {
        const mime = normaliseMime(value);
        if (mime === 'image/webp') return { mime, extension: 'webp', label: 'WEBP' };
        if (mime === 'image/jpeg') return { mime, extension: 'jpg', label: 'JPG' };
        return { mime: 'image/png', extension: 'png', label: 'PNG' };
    }

    function formatFromSource(source) {
        const match = /^data:([^;,]+)/i.exec(String(source || ''));
        return formatForMime(match ? match[1] : 'image/png');
    }

    function frameFormatsFromGrid() {
        const grid = document.getElementById('frame-grid');
        if (!grid) return [];
        const formats = [];
        let videoClip = false;
        [...grid.children].forEach((child) => {
            if (child.classList.contains('clip-divider')) {
                const label = child.querySelector('.clip-title span:first-child');
                videoClip = /^CLIP\b/i.test(label ? label.textContent.trim() : '');
                return;
            }
            if (!child.classList.contains('frame-thumb-wrapper')) return;
            const image = child.querySelector('img');
            formats.push(videoClip ? formatForMime('image/png') : formatFromSource(image ? image.src : ''));
        });
        return formats;
    }

    function installFrameFormatBadges() {
        const grid = document.getElementById('frame-grid');
        if (!grid) return;
        if (!document.getElementById('frame-source-format-style')) {
            const style = document.createElement('style');
            style.id = 'frame-source-format-style';
            style.textContent = '.frame-source-format-badge{position:absolute;top:5px;right:5px;z-index:3;padding:2px 5px;border:1px solid rgba(121,180,227,.85);border-radius:999px;background:rgba(14,17,17,.9);color:#caecff;font:700 9px "Geist Mono",Consolas,monospace;letter-spacing:.04em;pointer-events:none}.frame-thumb-wrapper{position:relative}';
            document.head.appendChild(style);
        }
        const decorate = () => {
            let videoClip = false;
            [...grid.children].forEach((child) => {
                if (child.classList.contains('clip-divider')) {
                    const label = child.querySelector('.clip-title span:first-child');
                    videoClip = /^CLIP\b/i.test(label ? label.textContent.trim() : '');
                    return;
                }
                if (!child.classList.contains('frame-thumb-wrapper')) return;
                const image = child.querySelector('img');
                const format = videoClip ? formatForMime('image/png') : formatFromSource(image ? image.src : '');
                let badge = child.querySelector('.frame-source-format-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'frame-source-format-badge';
                    child.appendChild(badge);
                }
                if (badge.textContent !== format.label) badge.textContent = format.label;
                const title = `Source frame format: ${format.label}`;
                if (badge.title !== title) badge.title = title;
            });
        };
        new MutationObserver(decorate).observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        decorate();
    }

    let activeDecodedMime = null;
    function installAnimatedWebPPreservation() {
        const NativeDecoder = window.ImageDecoder;
        if (typeof NativeDecoder === 'function' && !NativeDecoder.__organonTracked) {
            function TrackedImageDecoder(init) {
                const sourceMime = normaliseMime(init && init.type);
                activeDecodedMime = sourceMime;
                const decoder = new NativeDecoder(init);
                if (decoder && typeof decoder.close === 'function') {
                    const nativeClose = decoder.close.bind(decoder);
                    decoder.close = (...args) => {
                        try { return nativeClose(...args); }
                        finally { if (activeDecodedMime === sourceMime) activeDecodedMime = null; }
                    };
                }
                return decoder;
            }
            Object.setPrototypeOf(TrackedImageDecoder, NativeDecoder);
            TrackedImageDecoder.prototype = NativeDecoder.prototype;
            Object.defineProperty(TrackedImageDecoder, '__organonTracked', { value: true });
            window.ImageDecoder = TrackedImageDecoder;
        }

        const NativeFile = window.File;
        if (typeof NativeFile === 'function' && !NativeFile.__organonFormatAware) {
            function FormatAwareFile(parts, name, options) {
                let nextName = name;
                let nextOptions = options;
                const firstPart = parts && parts[0];
                if (firstPart instanceof Blob && normaliseMime(firstPart.type) === 'image/webp' && /\.png$/i.test(String(name || '')) && normaliseMime(options && options.type) === 'image/png') {
                    nextName = String(name).replace(/\.png$/i, '.webp');
                    nextOptions = { ...(options || {}), type: 'image/webp' };
                }
                return new NativeFile(parts, nextName, nextOptions);
            }
            Object.setPrototypeOf(FormatAwareFile, NativeFile);
            FormatAwareFile.prototype = NativeFile.prototype;
            Object.defineProperty(FormatAwareFile, '__organonFormatAware', { value: true });
            window.File = FormatAwareFile;
        }
    }

    let zipExport = null;
    function installCanvasEncoderBridge() {
        const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
        if (!nativeToBlob || nativeToBlob.__organonFormatAware) return;

        function formatAwareToBlob(callback, type, quality) {
            const requested = normaliseMime(type || 'image/png');
            let desired = requested;
            let outputQuality = quality;

            if (zipExport && requested === 'image/png' && zipExport.blobIndex < zipExport.formats.length) {
                desired = zipExport.formats[zipExport.blobIndex].mime;
                zipExport.blobIndex += 1;
                if (desired === 'image/webp') outputQuality = 1;
                if (desired === 'image/jpeg') outputQuality = .95;
            } else if (!zipExport && activeDecodedMime === 'image/webp' && requested === 'image/png') {
                desired = 'image/webp';
                outputQuality = 1;
            }

            return nativeToBlob.call(this, (blob) => {
                if (desired !== 'image/png' && (!blob || normaliseMime(blob.type) !== desired)) {
                    nativeToBlob.call(this, callback, 'image/png');
                    return;
                }
                callback(blob);
            }, desired, outputQuality);
        }

        Object.defineProperty(formatAwareToBlob, '__organonFormatAware', { value: true });
        HTMLCanvasElement.prototype.toBlob = formatAwareToBlob;
    }

    function installZipFilenameBridge() {
        if (typeof window.JSZip !== 'function') return;
        const nativeFile = window.JSZip.prototype.file;
        if (!nativeFile || nativeFile.__organonFormatAware) return;

        function formatAwareZipFile(name, data, options) {
            let nextName = name;
            if (zipExport && data instanceof Blob && /-frame-\d+\.png$/i.test(String(name || '')) && zipExport.fileIndex < zipExport.formats.length) {
                const actual = formatForMime(data.type);
                nextName = String(name).replace(/\.png$/i, `.${actual.extension}`);
                zipExport.fileIndex += 1;
            }
            return nativeFile.call(this, nextName, data, options);
        }

        Object.defineProperty(formatAwareZipFile, '__organonFormatAware', { value: true });
        window.JSZip.prototype.file = formatAwareZipFile;
    }

    function describeFormats(formats) {
        const labels = [...new Set(formats.map((format) => format.label))];
        if (!labels.length) return 'source-format';
        if (labels.length === 1) return labels[0];
        return labels.join('/');
    }

    function watchZipCompletion(button, formats) {
        const observer = new MutationObserver(() => {
            if (button.disabled || button.textContent.trim() !== 'DOWNLOAD FRAMES ZIP') return;
            observer.disconnect();
            zipExport = null;
            try {
                window.parent.postMessage({ type: 'set-status', text: `Processed ${describeFormats(formats)} frames downloaded in their detected source formats.` }, '*');
                window.setTimeout(() => window.parent.postMessage({ type: 'clear-status' }, '*'), 4200);
            } catch (error) {}
        });
        observer.observe(button, { attributes: true, childList: true, characterData: true, subtree: true });
        window.setTimeout(() => {
            observer.disconnect();
            if (zipExport && zipExport.formats === formats) zipExport = null;
        }, 180000);
    }

    function installZipExportDetection() {
        document.addEventListener('click', (event) => {
            const button = event.target.closest && event.target.closest('#zip-btn');
            if (!button || button.disabled) return;
            const formats = frameFormatsFromGrid();
            if (!formats.length) return;
            zipExport = { formats, blobIndex: 0, fileIndex: 0 };
            watchZipCompletion(button, formats);
        }, true);
    }

    function install() {
        const format = document.getElementById('opt-format');
        if (format) {
            format.addEventListener('change', () => window.setTimeout(updateRealWebPControls, 0));
            window.setTimeout(updateRealWebPControls, 0);
        }
        installAnimatedWebPPreservation();
        installCanvasEncoderBridge();
        installZipFilenameBridge();
        installZipExportDetection();
        installFrameFormatBadges();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
})();