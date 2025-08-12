// Session Manager - Handles storage of meeting history with size management
// Storage limits: chrome.storage.local = 10MB total, 8KB per key

class SessionManager {
    constructor() {
        this.MAX_SESSIONS = 10;
        this.MAX_CHUNK_SIZE = 7000; // Stay under 8KB limit per key
        this.STORAGE_QUOTA = 8 * 1024 * 1024; // Reserve 8MB for sessions (leaving 2MB for settings)
    }

    // Calculate approximate size of data in bytes
    calculateSize(obj) {
        return new Blob([JSON.stringify(obj)]).size;
    }

    // Split large transcripts into chunks
    chunkTranscript(transcriptArray) {
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;

        for (const item of transcriptArray) {
            const itemSize = this.calculateSize(item);
            if (currentSize + itemSize > this.MAX_CHUNK_SIZE) {
                chunks.push([...currentChunk]);
                currentChunk = [item];
                currentSize = itemSize;
            } else {
                currentChunk.push(item);
                currentSize += itemSize;
            }
        }
        
        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }

    // Save a meeting session with automatic chunking
    async saveSession(transcriptArray, meetingTitle, attendeeReport = null) {
        try {
            const sessionId = `session_${Date.now()}`;
            const chunks = this.chunkTranscript(transcriptArray);
            
            // Create session metadata
            const metadata = {
                id: sessionId,
                title: meetingTitle || 'Untitled Meeting',
                timestamp: new Date().toISOString(),
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                captionCount: transcriptArray.length,
                chunkCount: chunks.length,
                duration: this.calculateDuration(transcriptArray),
                speakers: [...new Set(transcriptArray.map(c => c.Name))].slice(0, 10), // Limit to 10 speakers
                attendees: attendeeReport?.attendeeList?.slice(0, 20), // Limit attendees
                attendeeCount: attendeeReport?.totalUniqueAttendees || 0,
                preview: transcriptArray.slice(0, 3).map(c => `${c.Name}: ${c.Text.substring(0, 50)}`).join(' | '),
                size: this.calculateSize(transcriptArray)
            };

            // Check storage quota before saving
            const currentUsage = await this.getStorageUsage();
            const newDataSize = this.calculateSize(chunks) + this.calculateSize(metadata);
            
            if (currentUsage + newDataSize > this.STORAGE_QUOTA) {
                // Need to clean up old sessions
                await this.cleanupOldSessions(newDataSize);
            }

            // Save chunks
            const chunkPromises = chunks.map((chunk, index) => 
                chrome.storage.local.set({
                    [`${sessionId}_chunk_${index}`]: chunk
                })
            );
            await Promise.all(chunkPromises);

            // Save attendee data if exists
            if (attendeeReport) {
                await chrome.storage.local.set({
                    [`${sessionId}_attendees`]: attendeeReport
                });
            }

            // Update session index
            await this.updateSessionIndex(metadata);
            
            console.log(`[SessionManager] Saved session ${sessionId} with ${chunks.length} chunks`);
            return sessionId;
            
        } catch (error) {
            console.error('[SessionManager] Failed to save session:', error);
            throw error;
        }
    }

    // Load a session from storage
    async loadSession(sessionId) {
        try {
            const index = await this.getSessionIndex();
            const metadata = index.find(s => s.id === sessionId);
            
            if (!metadata) {
                throw new Error('Session not found');
            }

            // Load all chunks
            const chunkKeys = [];
            for (let i = 0; i < metadata.chunkCount; i++) {
                chunkKeys.push(`${sessionId}_chunk_${i}`);
            }
            
            const chunks = await chrome.storage.local.get(chunkKeys);
            const transcriptArray = [];
            
            for (let i = 0; i < metadata.chunkCount; i++) {
                const chunk = chunks[`${sessionId}_chunk_${i}`];
                if (chunk) {
                    transcriptArray.push(...chunk);
                }
            }

            // Load attendee data if exists
            const attendeeData = await chrome.storage.local.get(`${sessionId}_attendees`);
            
            return {
                transcript: transcriptArray,
                metadata: metadata,
                attendeeReport: attendeeData[`${sessionId}_attendees`] || null
            };
            
        } catch (error) {
            console.error('[SessionManager] Failed to load session:', error);
            throw error;
        }
    }

    // Delete a session
    async deleteSession(sessionId) {
        try {
            const index = await this.getSessionIndex();
            const metadata = index.find(s => s.id === sessionId);
            
            if (!metadata) return;

            // Delete all chunks
            const keysToDelete = [];
            for (let i = 0; i < metadata.chunkCount; i++) {
                keysToDelete.push(`${sessionId}_chunk_${i}`);
            }
            keysToDelete.push(`${sessionId}_attendees`);
            
            await chrome.storage.local.remove(keysToDelete);
            
            // Update index
            const newIndex = index.filter(s => s.id !== sessionId);
            await chrome.storage.local.set({ 'session_index': newIndex });
            
            console.log(`[SessionManager] Deleted session ${sessionId}`);
            
        } catch (error) {
            console.error('[SessionManager] Failed to delete session:', error);
        }
    }

    // Get list of all sessions
    async getSessionIndex() {
        const { session_index = [] } = await chrome.storage.local.get('session_index');
        return session_index;
    }

    // Update session index with new metadata
    async updateSessionIndex(metadata) {
        let index = await this.getSessionIndex();
        
        // Remove any existing entry with same ID
        index = index.filter(s => s.id !== metadata.id);
        
        // Add new metadata
        index.push(metadata);
        
        // Keep only recent sessions
        if (index.length > this.MAX_SESSIONS) {
            // Delete oldest sessions
            const toDelete = index.slice(0, index.length - this.MAX_SESSIONS);
            for (const session of toDelete) {
                await this.deleteSession(session.id);
            }
            index = index.slice(-this.MAX_SESSIONS);
        }
        
        // Sort by timestamp (newest first)
        index.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        await chrome.storage.local.set({ 'session_index': index });
    }

    // Calculate meeting duration from transcript
    calculateDuration(transcriptArray) {
        if (transcriptArray.length === 0) return '0 min';
        
        const firstTime = new Date(transcriptArray[0].Time);
        const lastTime = new Date(transcriptArray[transcriptArray.length - 1].Time);
        const durationMs = lastTime - firstTime;
        const minutes = Math.round(durationMs / 60000);
        
        if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours}h ${mins}m`;
        }
    }

    // Get current storage usage
    async getStorageUsage() {
        const items = await chrome.storage.local.get(null);
        let totalSize = 0;
        
        for (const key in items) {
            if (key.startsWith('session_')) {
                totalSize += this.calculateSize(items[key]);
            }
        }
        
        return totalSize;
    }

    // Clean up old sessions to make room
    async cleanupOldSessions(requiredSpace) {
        const index = await this.getSessionIndex();
        let freedSpace = 0;
        
        // Delete oldest sessions first
        for (const session of index) {
            if (freedSpace >= requiredSpace) break;
            
            freedSpace += session.size || 0;
            await this.deleteSession(session.id);
        }
    }

    // Get storage statistics
    async getStorageStats() {
        const usage = await this.getStorageUsage();
        const index = await this.getSessionIndex();
        
        return {
            usedBytes: usage,
            usedMB: (usage / (1024 * 1024)).toFixed(2),
            quotaMB: (this.STORAGE_QUOTA / (1024 * 1024)).toFixed(2),
            percentUsed: ((usage / this.STORAGE_QUOTA) * 100).toFixed(1),
            sessionCount: index.length,
            oldestSession: index[index.length - 1]?.date || 'N/A',
            newestSession: index[0]?.date || 'N/A'
        };
    }

    // Clear all sessions
    async clearAllSessions() {
        const index = await this.getSessionIndex();
        
        for (const session of index) {
            await this.deleteSession(session.id);
        }
        
        await chrome.storage.local.set({ 'session_index': [] });
        console.log('[SessionManager] Cleared all sessions');
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}