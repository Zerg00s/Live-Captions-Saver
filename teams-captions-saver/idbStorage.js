// idbStorage.js - Shared IndexedDB storage for meeting history and crash recovery.
// Plain script (no modules): loaded via importScripts() in the service worker and
// <script> tags in popup.html / viewer.html. Defines the global `captionsDB`.
//
// The service worker is the sole writer of meeting content (flush/finalize/import/
// recover/prune). Popup and viewer read directly and only perform single-transaction
// metadata mutations on non-live records (delete, clear all, acknowledge recovered).
//
// Stores:
//   meetings    (keyPath 'id', index 'startedAt') - metadata only, listing never
//               loads transcript bodies
//   transcripts (keyPath 'meetingId') - { meetingId, transcript: [{Name,Text,Time}] }
//
// Meeting status lifecycle: 'live' -> 'complete' (clean end)
//                           'live' -> 'recovered' (lastFlush went stale after a crash)

const captionsDB = (() => {
    const DB_NAME = 'captionsSaver';
    const DB_VERSION = 1;
    const QUOTA_HIGH_WATER = 0.8; // start pruning above 80% of quota
    const QUOTA_LOW_WATER = 0.7;  // prune down to 70%

    let dbPromise = null;

    function openDb() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains('meetings')) {
                        const meetings = db.createObjectStore('meetings', { keyPath: 'id' });
                        meetings.createIndex('startedAt', 'startedAt');
                    }
                    if (!db.objectStoreNames.contains('transcripts')) {
                        db.createObjectStore('transcripts', { keyPath: 'meetingId' });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    dbPromise = null;
                    reject(request.error);
                };
            });
        }
        return dbPromise;
    }

    // Promise wrapper around a readwrite/readonly transaction over the given stores.
    async function withTx(storeNames, mode, work) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, mode);
            let result;
            Promise.resolve(work(tx))
                .then(r => { result = r; })
                .catch(reject);
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        });
    }

    function req(idbRequest) {
        return new Promise((resolve, reject) => {
            idbRequest.onsuccess = () => resolve(idbRequest.result);
            idbRequest.onerror = () => reject(idbRequest.error);
        });
    }

    // Caption Time fields are locale strings ("3:45:12 PM") that Date can't parse,
    // so duration comes from the meeting's ISO startedAt instead.
    function calculateDuration(startedAt, transcript) {
        const start = new Date(startedAt).getTime();
        if (!isNaN(start)) {
            const minutes = Math.max(0, Math.round((Date.now() - start) / 60000));
            if (minutes < 60) return `${minutes} min`;
            return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        }
        // Fallback: estimate from caption count (~3 s per caption)
        const estimatedMinutes = Math.round(((transcript?.length || 0) * 3) / 60);
        return `~${estimatedMinutes} min`;
    }

    function buildMeta({ id, title, startedAt, transcript, attendeeReport }, status, extra = {}) {
        const now = new Date().toISOString();
        return {
            id,
            title: title || 'Untitled Meeting',
            startedAt: startedAt || now,
            endedAt: null,
            lastFlush: now,
            status,
            captionCount: transcript.length,
            duration: calculateDuration(startedAt || now, transcript),
            speakers: [...new Set(transcript.map(c => c.Name))].slice(0, 10),
            attendees: attendeeReport?.attendeeList?.slice(0, 20),
            attendeeCount: attendeeReport?.totalUniqueAttendees || 0,
            preview: transcript.slice(0, 3).map(c => `${c.Name}: ${c.Text.substring(0, 50)}`).join(' | '),
            attendeeReport: attendeeReport || null,
            ...extra
        };
    }

    // Upsert meta + transcript in one transaction.
    function putMeeting(meta, transcript) {
        return withTx(['meetings', 'transcripts'], 'readwrite', tx => {
            tx.objectStore('meetings').put(meta);
            tx.objectStore('transcripts').put({ meetingId: meta.id, transcript });
        });
    }

    return {
        // --- writes (service worker only) ---

        // Periodic flush of an in-progress meeting. Always sets status 'live':
        // this also self-heals a meeting wrongly flagged 'recovered' (e.g. laptop sleep).
        async flushMeeting(payload) {
            await withTx(['meetings', 'transcripts'], 'readwrite', async tx => {
                const meetings = tx.objectStore('meetings');
                // Last-gasp flushes carry no attendee report; keep the last known one
                if (!payload.attendeeReport) {
                    const existing = await req(meetings.get(payload.id));
                    if (existing?.attendeeReport) {
                        payload = { ...payload, attendeeReport: existing.attendeeReport };
                    }
                }
                const meta = buildMeta(payload, 'live');
                meetings.put(meta);
                tx.objectStore('transcripts').put({ meetingId: meta.id, transcript: payload.transcript });
            });
        },

        // Clean meeting end.
        async finalizeMeeting(payload) {
            const meta = buildMeta(payload, 'complete', { endedAt: new Date().toISOString() });
            await putMeeting(meta, payload.transcript);
        },

        // Used by migration and recovery imports. `meta` is stored as given.
        async importMeeting(meta, transcript) {
            await putMeeting({ attendeeReport: null, ...meta }, transcript);
        },

        // Promote stale 'live' meetings (crashed browser/tab) to 'recovered'.
        // A truly live meeting refreshes lastFlush every flush interval.
        async scanAndRecover(staleMs = 60000) {
            const now = Date.now();
            const recovered = [];
            await withTx(['meetings'], 'readwrite', async tx => {
                const store = tx.objectStore('meetings');
                const all = await req(store.getAll());
                for (const meta of all) {
                    if (meta.status === 'live' && now - new Date(meta.lastFlush).getTime() > staleMs) {
                        meta.status = 'recovered';
                        meta.recoveredAt = new Date(now).toISOString();
                        meta.recoveredAcknowledged = false;
                        store.put(meta);
                        recovered.push(meta);
                    }
                }
            });
            if (recovered.length > 0) {
                console.log(`[captionsDB] Recovered ${recovered.length} interrupted meeting(s)`);
            }
            return recovered;
        },

        // Delete oldest non-live meetings when usage nears the quota.
        // chrome.storage.local key 'debug_quota_bytes' overrides the quota for testing.
        async pruneIfNeeded() {
            const deleted = [];
            try {
                const estimate = await navigator.storage.estimate();
                let quota = estimate.quota || 0;
                try {
                    const { debug_quota_bytes } = await chrome.storage.local.get('debug_quota_bytes');
                    if (debug_quota_bytes) quota = debug_quota_bytes;
                } catch (e) { /* not in an extension context */ }
                if (!quota || (estimate.usage || 0) <= quota * QUOTA_HIGH_WATER) {
                    return { deleted };
                }

                // Oldest first (ascending startedAt), never touching 'live' meetings.
                const candidates = (await this.getMeetingIndex())
                    .filter(m => m.status !== 'live')
                    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

                for (const meta of candidates) {
                    const { usage } = await navigator.storage.estimate();
                    if (usage <= quota * QUOTA_LOW_WATER) break;
                    await this.deleteMeeting(meta.id);
                    deleted.push(meta.id);
                }
                if (deleted.length > 0) {
                    console.log(`[captionsDB] Pruned ${deleted.length} old meeting(s) to stay under quota`);
                }
            } catch (error) {
                console.error('[captionsDB] Prune failed:', error);
            }
            return { deleted };
        },

        // --- reads (any extension context) ---

        // Metadata only, newest first.
        async getMeetingIndex() {
            const metas = await withTx(['meetings'], 'readonly', tx =>
                req(tx.objectStore('meetings').getAll())
            );
            return metas.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
        },

        async getMeeting(id) {
            return withTx(['meetings', 'transcripts'], 'readonly', async tx => {
                const meta = await req(tx.objectStore('meetings').get(id));
                if (!meta) throw new Error('Meeting not found: ' + id);
                const record = await req(tx.objectStore('transcripts').get(id));
                return { meta, transcript: record?.transcript || [] };
            });
        },

        async getUnacknowledgedRecovered() {
            const metas = await this.getMeetingIndex();
            return metas.filter(m => m.status === 'recovered' && !m.recoveredAcknowledged);
        },

        async getStorageStats() {
            const estimate = await navigator.storage.estimate();
            const index = await this.getMeetingIndex();
            const usage = estimate.usage || 0;
            const quota = estimate.quota || 0;
            return {
                usage,
                quota,
                usedMB: (usage / (1024 * 1024)).toFixed(2),
                quotaMB: (quota / (1024 * 1024)).toFixed(0),
                percentUsed: quota ? ((usage / quota) * 100).toFixed(1) : '0',
                meetingCount: index.length,
                oldestMeeting: index[index.length - 1]?.startedAt || null,
                newestMeeting: index[0]?.startedAt || null
            };
        },

        // --- metadata mutations (popup allowed, non-live records) ---

        async acknowledgeRecovered(ids) {
            await withTx(['meetings'], 'readwrite', async tx => {
                const store = tx.objectStore('meetings');
                for (const id of ids) {
                    const meta = await req(store.get(id));
                    if (meta && meta.status === 'recovered') {
                        meta.recoveredAcknowledged = true;
                        store.put(meta);
                    }
                }
            });
        },

        async deleteMeeting(id) {
            await withTx(['meetings', 'transcripts'], 'readwrite', tx => {
                tx.objectStore('meetings').delete(id);
                tx.objectStore('transcripts').delete(id);
            });
        },

        async clearAllMeetings() {
            await withTx(['meetings', 'transcripts'], 'readwrite', tx => {
                tx.objectStore('meetings').clear();
                tx.objectStore('transcripts').clear();
            });
            console.log('[captionsDB] Cleared all meetings');
        }
    };
})();
