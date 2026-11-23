/* Onda v3.14 — Read-only browser-audio cache audit.
 * This module NEVER deletes or rewrites audio, records, or original files.
 * It inspects File/Blob metadata and compares possible duplicate filenames,
 * sizes, modification dates, and types. No byte-content identity is claimed.
 */
(() => {
    'use strict';

    const AUDIO_STORE = 'audioFiles';
    const MAX_SCAN_RECORDS = 20000;

    function scanAudioRecords(db) {
        if (!db || typeof db.transaction !== 'function') {
            return Promise.reject(new Error('The existing Onda audio database is unavailable.'));
        }
        return new Promise((resolve, reject) => {
            const rows = [];
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                try { db.close(); } catch (_) {}
                if (error) reject(error);
                else resolve(rows);
            };
            try {
                const tx = db.transaction(AUDIO_STORE, 'readonly');
                const request = tx.objectStore(AUDIO_STORE).openCursor();
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (!cursor) return;
                    if (rows.length >= MAX_SCAN_RECORDS) {
                        finish(new Error('Too many cache entries for this review. No changes were made.'));
                        return;
                    }
                    const value = cursor.value || {};
                    const media = value.file || value.blob || null;
                    const validMedia = !!(media && typeof media.arrayBuffer === 'function'
                        && Number.isFinite(Number(media.size)) && Number(media.size) >= 0);
                    // Collect only small metadata values. Never call arrayBuffer(), text(),
                    // stream(), or any content-reading method on saved audio.
                    rows.push({
                        id: String(cursor.key),
                        fileName: String(value.fileName || media?.name || ''),
                        relativePath: String(value.localPath || ''),
                        sizeBytes: validMedia ? Number(media.size) : 0,
                        sizeKnown: validMedia,
                        lastModified: Number(value.lastModified || media?.lastModified || 0),
                        type: String(value.type || media?.type || ''),
                        savedAt: String(value.savedAt || '')
                    });
                    cursor.continue();
                };
                request.onerror = () => finish(request.error || new Error('Audio cache cursor failed.'));
                tx.onerror = () => finish(tx.error || new Error('Audio cache transaction failed.'));
                tx.onabort = () => finish(tx.error || new Error('Audio cache transaction aborted.'));
                tx.oncomplete = () => finish();
            } catch (error) {
                finish(error);
            }
        });
    }

    function fingerprint(row) {
        if (!row.sizeKnown || !(row.sizeBytes > 0) ||
            !(row.lastModified > 0) || !row.fileName || !row.type) return null;
        // A fingerprint identifies a possible match, never proves equal contents.
        return [
            row.fileName.trim().normalize('NFC').toLowerCase(),
            row.sizeBytes,
            row.lastModified,
            row.type.trim().toLowerCase()
        ].join('\u0000');
    }

    function analyse(records, referencedTrackIds) {
        const referenced = new Set(Array.from(referencedTrackIds || [], String));
        const rows = Array.isArray(records) ? records : [];
        const valid = rows.filter(row => row.sizeKnown);
        const damaged = rows.filter(row => !row.sizeKnown);
        const unlinked = valid.filter(row => !referenced.has(String(row.id)));
        const candidateMap = new Map();
        for (const row of valid) {
            const key = fingerprint(row);
            if (!key) continue;
            if (!candidateMap.has(key)) candidateMap.set(key, []);
            candidateMap.get(key).push(row);
        }
        const potentialDuplicates = [...candidateMap.values()]
            .filter(group => group.length > 1)
            .map(group => ({
                fileName: group[0].fileName,
                sizeBytes: group[0].sizeBytes,
                entries: group.map(row => ({ ...row, protected: referenced.has(String(row.id)) })),
                hypotheticalExtraBytes: (group.length - 1) * group[0].sizeBytes
            }))
            .sort((a, b) => b.hypotheticalExtraBytes - a.hypotheticalExtraBytes);

        const bytes = list => list.reduce((sum, row) => sum + row.sizeBytes, 0);
        return {
            scanned: rows.length,
            playable: valid.length,
            damaged: damaged.length,
            damagedEntries: damaged.slice(0, 100),
            cachedBytes: bytes(valid),
            linkedCount: valid.length - unlinked.length,
            unlinked: unlinked.sort((a, b) => b.sizeBytes - a.sizeBytes),
            unlinkedBytes: bytes(unlinked),
            potentialDuplicates,
            potentialDuplicateBytes: potentialDuplicates.reduce((sum, group) => sum + group.hypotheticalExtraBytes, 0),
            evaluatedAt: new Date().toISOString()
        };
    }

    window.OndaStorageAudit = Object.freeze({
        scanAudioRecords,
        analyse
    });
})();
