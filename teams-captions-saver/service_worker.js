importScripts('idbStorage.js');

// --- Utility Functions ---
function getSanitizedMeetingName(fullTitle) {
    if (!fullTitle) return "Meeting";
    const parts = fullTitle.split('|');
    // Handles titles like "Meeting Name | Microsoft Teams" or "Location | Meeting | Teams"
    const meetingName = parts.length > 2 ? parts[1] : parts[0];
    const cleanedName = meetingName.replace('Microsoft Teams', '').trim();
    // Replace characters forbidden in filenames
    return cleanedName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') || "Meeting";
}


// Comparable meeting identity from a document.title. Must stay in sync with the
// copy in content_script.js.
function normalizeMeetingTitle(fullTitle) {
    return getSanitizedMeetingName(fullTitle).replace(/^\(\d+\)\s*/, '').trim().toLowerCase();
}

function applyAliasesToTranscript(transcriptArray, aliases = {}) {
    if (Object.keys(aliases).length === 0) {
        return transcriptArray;
    }
    return transcriptArray.map(entry => {
        const newName = aliases[entry.Name]?.trim();
        return {
            ...entry,
            Name: newName || entry.Name
        };
    });
}

function applyAliasesToAttendeeReport(attendeeReport, aliases = {}) {
    if (!attendeeReport || Object.keys(aliases).length === 0) {
        return attendeeReport;
    }
    
    // Create a new report with aliased names
    const aliasedReport = {
        ...attendeeReport,
        attendeeList: attendeeReport.attendeeList.map(name => {
            const aliasedName = aliases[name]?.trim();
            return aliasedName || name;
        }),
        currentAttendees: attendeeReport.currentAttendees.map(attendee => ({
            ...attendee,
            name: aliases[attendee.name]?.trim() || attendee.name
        })),
        attendeeHistory: attendeeReport.attendeeHistory.map(event => ({
            ...event,
            name: aliases[event.name]?.trim() || event.name
        }))
    };
    
    return aliasedReport;
}

// --- Formatting Functions ---
function formatAsTxt(transcript, attendeeReport) {
    let content = '';
    
    console.log('[Teams Caption Saver] formatAsTxt called with:', {
        transcriptLength: transcript?.length,
        hasAttendeeReport: !!attendeeReport,
        attendeeCount: attendeeReport?.totalUniqueAttendees || 0,
        attendeeList: attendeeReport?.attendeeList || []
    });
    
    // Add attendee information if available
    if (attendeeReport && attendeeReport.totalUniqueAttendees > 0) {
        content += '=== MEETING ATTENDEES ===\n';
        content += `Total Attendees: ${attendeeReport.totalUniqueAttendees}\n`;
        content += `Meeting Start: ${new Date(attendeeReport.meetingStartTime).toLocaleString()}\n`;
        content += '\nAttendee List:\n';
        attendeeReport.attendeeList.forEach(name => {
            content += `- ${name}\n`;
        });
        content += '\n=== TRANSCRIPT ===\n';
    }
    
    content += transcript.map(entry => `[${entry.Time}] ${entry.Name}: ${entry.Text}`).join('\n');
    return content;
}

function formatAsMarkdown(transcript, attendeeReport) {
    let content = '';
    
    // Add attendee information if available
    if (attendeeReport && attendeeReport.totalUniqueAttendees > 0) {
        content += '# Meeting Attendees\n\n';
        content += `**Total Attendees:** ${attendeeReport.totalUniqueAttendees}\n\n`;
        content += `**Meeting Start:** ${new Date(attendeeReport.meetingStartTime).toLocaleString()}\n\n`;
        content += '## Attendee List\n\n';
        attendeeReport.attendeeList.forEach(name => {
            content += `- ${name}\n`;
        });
        content += '\n---\n\n# Transcript\n\n';
    }
    
    let lastSpeaker = null;
    content += transcript.map(entry => {
        if (entry.Name !== lastSpeaker) {
            lastSpeaker = entry.Name;
            return `\n**${entry.Name}** (${entry.Time}):\n> ${entry.Text}`;
        }
        return `> ${entry.Text}`;
    }).join('\n').trim();
    
    return content;
}

function formatAsDoc(transcript, attendeeReport) {
    let body = '';
    
    // Add attendee information if available
    if (attendeeReport && attendeeReport.totalUniqueAttendees > 0) {
        body += '<h2>Meeting Attendees</h2>';
        body += `<p><b>Total Attendees:</b> ${attendeeReport.totalUniqueAttendees}</p>`;
        body += `<p><b>Meeting Start:</b> ${escapeHtml(new Date(attendeeReport.meetingStartTime).toLocaleString())}</p>`;
        body += '<h3>Attendee List</h3><ul>';
        attendeeReport.attendeeList.forEach(name => {
            body += `<li>${escapeHtml(name)}</li>`;
        });
        body += '</ul><hr><h2>Transcript</h2>';
    }
    
    body += transcript.map(entry =>
        `<p><b>${escapeHtml(entry.Name)}</b> (<i>${escapeHtml(entry.Time)}</i>): ${escapeHtml(entry.Text)}</p>`
    ).join('');
    
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Meeting Transcript</title></head><body>${body}</body></html>`;
}

async function formatForAi(transcript, meetingName, recordingStartTime, attendeeReport) {
    const { aiInstructions = '' } = await chrome.storage.sync.get('aiInstructions');
    const date = recordingStartTime ? new Date(recordingStartTime) : new Date();
    
    let metadataHeader = `Meeting Title: ${meetingName}\nDate: ${date.toLocaleString()}`;
    
    // Add attendee information if available
    if (attendeeReport && attendeeReport.totalUniqueAttendees > 0) {
        metadataHeader += `\nTotal Attendees: ${attendeeReport.totalUniqueAttendees}`;
        metadataHeader += '\n\nAttendee List:';
        attendeeReport.attendeeList.forEach(name => {
            metadataHeader += `\n- ${name}`;
        });
    }
    
    const transcriptText = transcript.map(entry => `[${entry.Time}] ${entry.Name}: ${entry.Text}`).join('\n\n');

    let finalContent = aiInstructions ? `${aiInstructions}\n\n---\n\n` : '';
    finalContent += `${metadataHeader}\n\n---\n\n${transcriptText}`;
    
    return finalContent;
}

// A simple HTML escaper for the .doc format
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// --- Core Actions ---
async function downloadFile(filename, content, mimeType, saveAs) {
    const url = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: saveAs
    });
}

async function generateFilename(pattern, meetingTitle, format, attendeeReport) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const attendeeCount = attendeeReport ? attendeeReport.totalUniqueAttendees : 0;
    
    const replacements = {
        '{date}': dateStr,
        '{time}': timeStr,
        '{title}': getSanitizedMeetingName(meetingTitle),
        '{format}': format,
        '{attendees}': attendeeCount > 0 ? `${attendeeCount}_attendees` : ''
    };
    
    let filename = pattern || '{date}_{title}_{format}';
    for (const [key, value] of Object.entries(replacements)) {
        filename = filename.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    // Clean up any double underscores or trailing underscores
    filename = filename.replace(/__+/g, '_').replace(/_+$/, '');
    
    return filename;
}

async function saveTranscript(meetingTitle, transcriptArray, aliases, format, recordingStartTime, saveAsPrompt, attendeeReport = null) {
    const processedTranscript = applyAliasesToTranscript(transcriptArray, aliases);
    const processedAttendeeReport = applyAliasesToAttendeeReport(attendeeReport, aliases);
    
    // Get filename pattern from settings
    const { filenamePattern } = await chrome.storage.sync.get('filenamePattern');
    const filename = await generateFilename(filenamePattern, meetingTitle, format, processedAttendeeReport);

    let content, extension, mimeType;

    switch (format) {
        case 'md':
            content = formatAsMarkdown(processedTranscript, processedAttendeeReport);
            extension = 'md';
            mimeType = 'text/markdown';
            break;
        case 'json':
            // For JSON, include both transcript and attendee data
            const jsonData = {
                meetingTitle: meetingTitle,
                recordingStartTime,
                transcript: processedTranscript,
                attendees: processedAttendeeReport
            };
            content = JSON.stringify(jsonData, null, 2);
            extension = 'json';
            mimeType = 'application/json';
            break;
        case 'doc':
            content = formatAsDoc(processedTranscript, processedAttendeeReport);
            extension = 'doc';
            mimeType = 'application/msword';
            break;
        case 'ai':
            content = await formatForAi(processedTranscript, meetingTitle, recordingStartTime, processedAttendeeReport);
            extension = 'txt';
            mimeType = 'text/plain';
            break;
        case 'txt':
        default:
            content = formatAsTxt(processedTranscript, processedAttendeeReport);
            extension = 'txt';
            mimeType = 'text/plain';
            break;
    }
    
    // Add extension to filename
    const fullFilename = `${filename}.${extension}`;
    downloadFile(fullFilename, content, mimeType, saveAsPrompt);
}

// --- State Management ---
let lastAutoSaveId = null;
let autoSaveInProgress = false;

async function createViewerTab(transcriptArray) {
    await chrome.storage.local.set({ captionsToView: transcriptArray });
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
}

function updateBadge(isCapturing) {
    if (isCapturing) {
        chrome.action.setBadgeText({ text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ color: '#28a745' }); // Green
    } else {
        chrome.action.setBadgeText({ text: 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: '#6c757d' }); // Grey
    }
}

// --- Migration from chrome.storage.local to IndexedDB (one-time, retry-safe) ---
async function migrateIfNeeded() {
    const { idb_migrated_v1 } = await chrome.storage.local.get('idb_migrated_v1');
    if (idb_migrated_v1) return;

    const keysToRemove = [];

    // Old committed sessions: session_index + per-session chunk/attendee keys
    const { session_index = [] } = await chrome.storage.local.get('session_index');
    for (const meta of session_index) {
        const chunkKeys = [];
        for (let i = 0; i < (meta.chunkCount || 0); i++) {
            chunkKeys.push(`${meta.id}_chunk_${i}`);
        }
        const stored = await chrome.storage.local.get([...chunkKeys, `${meta.id}_attendees`]);
        const transcript = chunkKeys.flatMap(key => stored[key] || []);
        await captionsDB.importMeeting({
            id: meta.id,
            title: meta.title || 'Untitled Meeting',
            startedAt: meta.timestamp || new Date().toISOString(),
            endedAt: meta.timestamp || null,
            lastFlush: meta.timestamp || new Date().toISOString(),
            status: 'complete',
            captionCount: transcript.length,
            duration: meta.duration || '0 min',
            speakers: meta.speakers || [],
            attendees: meta.attendees,
            attendeeCount: meta.attendeeCount || 0,
            preview: meta.preview || '',
            attendeeReport: stored[`${meta.id}_attendees`] || null,
            migratedFrom: 'storage.local'
        }, transcript);
        keysToRemove.push(...chunkKeys, `${meta.id}_attendees`);
    }
    if (session_index.length > 0) keysToRemove.push('session_index');

    // Orphaned crash backup from the old code: surface it as a recovered meeting
    const { transcriptBackup } = await chrome.storage.local.get('transcriptBackup');
    if (transcriptBackup?.transcript?.length > 5) {
        const startedAt = transcriptBackup.recordingStartTime || transcriptBackup.lastBackup || new Date().toISOString();
        await captionsDB.importMeeting({
            id: `recovered_backup_${new Date(startedAt).getTime()}`,
            title: transcriptBackup.meetingTitle || 'Untitled Meeting',
            startedAt: startedAt,
            endedAt: null,
            lastFlush: transcriptBackup.lastBackup || startedAt,
            status: 'recovered',
            recoveredAt: new Date().toISOString(),
            recoveredAcknowledged: false,
            captionCount: transcriptBackup.transcript.length,
            duration: '',
            speakers: [...new Set(transcriptBackup.transcript.map(c => c.Name))].slice(0, 10),
            attendeeCount: 0,
            preview: transcriptBackup.transcript.slice(0, 3).map(c => `${c.Name}: ${c.Text.substring(0, 50)}`).join(' | '),
            attendeeReport: transcriptBackup.attendeeData || null,
            migratedFrom: 'transcriptBackup'
        }, transcriptBackup.transcript);
    }
    if (transcriptBackup) keysToRemove.push('transcriptBackup');

    // Only after every import committed: remove old keys, then set the flag.
    if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
    }
    await chrome.storage.local.set({ idb_migrated_v1: true });
    console.log(`[Service Worker] Migrated ${session_index.length} session(s) to IndexedDB`);
}

// Runs on every service worker wake: persist storage, migrate old data, and
// promote stale 'live' meetings (crashed mid-meeting) to 'recovered'.
const dbReady = (async () => {
    try { await navigator.storage.persist(); } catch (e) { /* best effort */ }
    try {
        await migrateIfNeeded();
    } catch (error) {
        console.error('[Service Worker] Migration failed (will retry on next wake):', error);
    }
    try {
        await captionsDB.scanAndRecover();
    } catch (error) {
        console.error('[Service Worker] Recovery scan failed:', error);
    }
})();

// --- Event Listeners ---
chrome.runtime.onInstalled.addListener(() => {
    updateBadge(false);
});

chrome.runtime.onStartup.addListener(() => {
    updateBadge(false);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Viewer-bound broadcasts also pass through this listener; the service worker has
    // nothing to do for them, and returning false lets the sender resolve immediately.
    const VIEWER_BROADCASTS = ['live_caption_update', 'meeting_ended'];
    if (VIEWER_BROADCASTS.includes(message.message)) {
        return false;
    }

    (async () => {
        await dbReady;

        switch (message.message) {
            case 'flush_meeting':
                // Periodic crash-safety snapshot of an in-progress meeting
                try {
                    await captionsDB.flushMeeting({
                        id: message.meetingId,
                        title: message.meetingTitle,
                        startedAt: message.recordingStartTime,
                        transcript: message.transcriptArray,
                        attendeeReport: message.attendeeReport
                    });
                } catch (error) {
                    console.error('[Service Worker] Failed to flush meeting:', error);
                }
                break;

            case 'save_session_history':
                try {
                    await captionsDB.finalizeMeeting({
                        id: message.meetingId || `meeting_${Date.now()}`,
                        title: message.meetingTitle,
                        startedAt: message.recordingStartTime,
                        transcript: message.transcriptArray,
                        attendeeReport: message.attendeeReport
                    });
                    await captionsDB.pruneIfNeeded();
                    console.log('[Service Worker] Meeting saved to history:', message.meetingId);
                } catch (error) {
                    console.error('[Service Worker] Failed to save session:', error);
                }
                break;

            case 'get_resumable_meeting':
                // Rejoin detection: most recent meeting with the same normalized title
                // that was still being written to within the last 10 minutes
                try {
                    const normTitle = normalizeMeetingTitle(message.meetingTitle);
                    const cutoff = Date.now() - 10 * 60 * 1000;
                    const index = await captionsDB.getMeetingIndex();
                    const candidate = index.find(m =>
                        m.id !== message.excludeId &&
                        m.captionCount > 0 &&
                        normalizeMeetingTitle(m.title) === normTitle &&
                        new Date(m.lastFlush).getTime() > cutoff
                    );
                    sendResponse({
                        candidate: candidate
                            ? { id: candidate.id, title: candidate.title, captionCount: candidate.captionCount }
                            : null
                    });
                } catch (error) {
                    console.error('[Service Worker] Resumable lookup failed:', error);
                    sendResponse({ candidate: null });
                }
                break;

            case 'get_meeting_transcript':
                try {
                    const { meta, transcript } = await captionsDB.getMeeting(message.meetingId);
                    sendResponse({ transcript, startedAt: meta.startedAt });
                } catch (error) {
                    console.error('[Service Worker] Transcript fetch failed:', error);
                    sendResponse({ transcript: null });
                }
                break;

            case 'delete_meeting':
                // Used to drop the short-lived interim record after a merge
                try {
                    await captionsDB.deleteMeeting(message.meetingId);
                } catch (error) {
                    console.error('[Service Worker] Delete failed:', error);
                }
                break;

            case 'check_recovery':
                // Popup asks on open: promote any stale live meetings, report unacknowledged ones
                try {
                    await captionsDB.scanAndRecover();
                    sendResponse({ recovered: await captionsDB.getUnacknowledgedRecovered() });
                } catch (error) {
                    console.error('[Service Worker] Recovery check failed:', error);
                    sendResponse({ recovered: [] });
                }
                break;


            case 'download_captions': {
                console.log('[Teams Caption Saver] Download request received:', {
                    format: message.format,
                    transcriptCount: message.transcriptArray?.length,
                    hasAttendeeReport: !!message.attendeeReport,
                    attendeeCount: message.attendeeReport?.totalUniqueAttendees || 0
                });
                const { speakerAliases } = await chrome.storage.session.get('speakerAliases');
                await saveTranscript(message.meetingTitle, message.transcriptArray, speakerAliases, message.format, message.recordingStartTime, true, message.attendeeReport);
                break;
            }

            case 'save_on_leave': {
                // Generate unique ID for this save request
                const saveId = `${message.meetingTitle}_${message.recordingStartTime}`;

                // Prevent duplicate saves
                if (autoSaveInProgress || lastAutoSaveId === saveId) {
                    console.log('Auto-save already in progress or completed for this meeting, skipping...');
                    break;
                }

                autoSaveInProgress = true;
                lastAutoSaveId = saveId;

                try {
                    const settings = await chrome.storage.sync.get(['autoSaveOnEnd', 'defaultSaveFormat']);
                    if (settings.autoSaveOnEnd && message.transcriptArray.length > 0) {
                        const formatToSave = settings.defaultSaveFormat || 'txt';
                        console.log(`Auto-saving transcript in ${formatToSave.toUpperCase()} format.`);
                        const { speakerAliases } = await chrome.storage.session.get('speakerAliases');
                        await saveTranscript(message.meetingTitle, message.transcriptArray, speakerAliases, formatToSave, message.recordingStartTime, false, message.attendeeReport);
                        console.log('Auto-save completed successfully.');
                    }
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    // Reset state on error to allow retry
                    lastAutoSaveId = null;
                } finally {
                    autoSaveInProgress = false;
                }
                break;
            }

            case 'display_captions':
                await createViewerTab(message.transcriptArray);
                break;
            
            case 'update_badge_status':
                updateBadge(message.capturing);
                // Reset auto-save state when starting a new capture session
                if (message.capturing) {
                    lastAutoSaveId = null;
                    autoSaveInProgress = false;
                    // Clear speaker aliases from the previous meeting. Must happen here:
                    // content scripts have no access to chrome.storage.session.
                    await chrome.storage.session.remove('speakerAliases');
                    console.log('New capture session started, auto-save state reset.');
                }
                break;
                
            case 'error_logged':
                // Central error logging - could send to analytics service
                console.warn('[Teams Caption Saver] Error logged:', message.error);
                // Could implement error reporting here
                break;
        }
    })().then(
        // Always settle the channel: senders that await fire-and-forget messages
        // (flush_meeting, save_on_leave, ...) would otherwise get spurious
        // "message channel closed" rejections. Cases that already responded are
        // unaffected - a second sendResponse call is ignored.
        () => { try { sendResponse({ ok: true }); } catch (e) { /* channel gone */ } },
        (error) => {
            console.error('[Service Worker] Message handling failed:', message.message, error);
            try { sendResponse({ ok: false, error: String(error) }); } catch (e) { /* channel gone */ }
        }
    );

    return true; // Indicates that the response will be sent asynchronously
});