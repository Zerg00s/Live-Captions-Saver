// --- Constants for DOM Elements and Data ---
const UI_ELEMENTS = {
    statusMessage: document.getElementById('status-message'),
    manualStartInfo: document.getElementById('manual-start-info'),
    copyButton: document.getElementById('copyButton'),
    copyDropdownButton: document.getElementById('copyDropdownButton'),
    copyOptions: document.getElementById('copyOptions'),
    saveButton: document.getElementById('saveButton'),
    saveDropdownButton: document.getElementById('saveDropdownButton'),
    saveOptions: document.getElementById('saveOptions'),
    viewButton: document.getElementById('viewButton'),
    defaultSaveFormatSelect: document.getElementById('defaultSaveFormat'),
    autoEnableCaptionsToggle: document.getElementById('autoEnableCaptionsToggle'),
    autoSaveOnEndToggle: document.getElementById('autoSaveOnEndToggle'),
    trackCaptionsToggle: document.getElementById('trackCaptionsToggle'),
    trackAttendeesToggle: document.getElementById('trackAttendeesToggle'),
    autoOpenAttendeesToggle: document.getElementById('autoOpenAttendeesToggle'),
    timestampFormat: document.getElementById('timestampFormat'),
    filenamePattern: document.getElementById('filenamePattern'),
    meetingType: document.getElementById('meetingType'),
    templateName: document.getElementById('templateName'),
    saveTemplateBtn: document.getElementById('saveTemplateBtn'),
    deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
    customTemplatesGroup: document.getElementById('customTemplatesGroup'),
    aiInstructions: document.getElementById('aiInstructions'),
    speakerAliasList: document.getElementById('speaker-alias-list'),
    promptButtons: document.querySelectorAll('.prompt-button'),
    // Session History Elements
    sessionHistory: document.getElementById('sessionHistory'),
    historyButton: document.getElementById('historyButton'),
    sessionList: document.getElementById('sessionList')
};


const MEETING_TYPE_PROMPTS = {
    "executive": "You are an executive assistant preparing a comprehensive meeting brief. Analyze this transcript and create a structured summary with:\n\n## Executive Summary\nProvide a 2-3 sentence overview of the meeting's purpose and outcome.\n\n## Key Decisions Made\nList each decision with:\n- The decision itself\n- Who made it\n- Impact/rationale\n- Timeline if mentioned\n\n## Action Items & Owners\nFormat as a table:\n| Owner | Action | Due Date | Priority |\n\n## Critical Discussion Points\n- Highlight 3-5 most important topics discussed\n- Include any concerns or risks raised\n\n## Follow-up Required\nList items needing attention from leadership\n\n## Metrics & KPIs Mentioned\nExtract any numbers, targets, or measurements discussed\n\nBe concise but thorough. Focus on what executives need to know and act upon.",
    "standup": "You are a scrum master analyzing this daily standup. Create a comprehensive summary with:\n\n## Team Status Overview\nOne-line health check of the team's progress\n\n## Individual Updates\nFor each team member, capture:\n- ✅ Completed yesterday\n- 🎯 Working on today\n- 🚧 Blockers/impediments\n\n## Blocked Items Requiring Attention\nPrioritize by impact on sprint goals\n\n## Action Items\n- Include who will help resolve blockers\n- Note any meetings needed\n\n## Sprint Health Indicators\n- Are we on track for sprint goals?\n- Any risks to delivery?\n\nHighlight patterns across multiple team members (e.g., common blockers).",
    "retrospective": "You are an agile coach facilitating continuous improvement. Analyze this retrospective and produce:\n\n## Sprint Sentiment\nOverall team morale and satisfaction (based on tone and feedback)\n\n## What Went Well\n- Group by themes (e.g., Process, Communication, Technical)\n- Note frequency if mentioned multiple times\n- Identify practices to continue\n\n## What Could Be Improved\n- Categorize by impact (High/Medium/Low)\n- Include root causes if discussed\n- Link related issues\n\n## Action Items (SMART format)\nFor each action:\n- Specific action to take\n- Owner(s)\n- Success criteria\n- Target completion date\n- Expected impact\n\n## Trends from Previous Retros\nIdentify recurring themes or unresolved issues\n\n## Team Dynamics Observations\nNote participation levels and any team health indicators",
    "planning": "You are a product manager optimizing sprint planning. Extract and organize:\n\n## Sprint Goal\nClear, measurable objective for this sprint\n\n## Capacity Planning\n- Team availability (holidays, meetings)\n- Velocity comparison to previous sprints\n- Risk buffer included?\n\n## Committed User Stories\n| Story ID | Title | Story Points | Assignee | Acceptance Criteria Met? |\n\n## Technical Dependencies\n- Internal dependencies between stories\n- External team dependencies\n- Blocker mitigation plans\n\n## Risks & Mitigation\n- Identified risks to sprint success\n- Mitigation strategies discussed\n\n## Definition of Done Reminders\nAny special criteria for this sprint\n\n## Parking Lot\nItems discussed but deferred to next sprint\n\nCalculate total story points and flag if over/under capacity.",
    "review": "You are a senior architect conducting a thorough design review. Document:\n\n## Design Overview\nBrief description of what was reviewed\n\n## Architectural Decisions\nFor each major decision:\n- Decision made\n- Alternatives considered\n- Trade-offs accepted\n- Technical rationale\n\n## Concerns & Risks Identified\nCategorize by:\n- 🔴 Critical (blocks implementation)\n- 🟡 Important (needs resolution soon)\n- 🟢 Minor (can be addressed later)\n\n## Approved Changes\n- What was approved\n- Conditions/requirements\n- Impact on timeline\n\n## Technical Debt Acknowledged\n- What debt was accepted\n- Plan to address it\n\n## Follow-up Actions\n| Action | Owner | Due Date | Required For |\n\n## Compliance & Standards\nNote any deviations from standards and justifications\n\n## Performance Considerations\nAny performance impacts discussed",
    "interview": "You are a hiring manager evaluating candidates objectively. Structure your assessment as:\n\n## Candidate Overview\n- Role interviewed for\n- Interview round/type\n- Interviewers present\n\n## Technical Competencies Demonstrated\nRate each skill discussed:\n- Skill: [Strong/Adequate/Needs Development/Not Assessed]\n- Evidence from conversation\n\n## Behavioral Indicators\nUsing STAR format when possible:\n- Situation described\n- Actions taken\n- Results achieved\n- Competency demonstrated\n\n## Cultural Fit Observations\n- Alignment with company values\n- Team collaboration potential\n- Communication style\n\n## Red Flags or Concerns\n- Be specific and objective\n- Quote relevant statements\n\n## Strengths Highlighted\n- Unique value propositions\n- Standout moments\n\n## Questions from Candidate\n- What they asked about\n- Indicates interest/research level\n\n## Recommended Next Steps\n- Clear hire/no-hire recommendation\n- If proceeding, what to explore further\n- If not, specific gaps to document",
    "allhands": "You are a communications director ensuring company-wide alignment. Create a digest with:\n\n## Meeting Headline\nOne impactful sentence summarizing the main message\n\n## Leadership Messages\n- Key points from each executive\n- Strategic priorities emphasized\n- Cultural messages reinforced\n\n## Company Metrics Shared\n| Metric | Current | Target | Trend |\n\n## Major Announcements\nFor each announcement:\n- What's changing/new\n- Why it matters\n- Timeline\n- Impact on teams\n\n## Recognition & Celebrations\n- Teams/individuals recognized\n- Achievements celebrated\n\n## Q&A Highlights\n- Most important questions asked\n- Leadership responses\n- Concerns addressed\n\n## Action Items by Department\nWhat each team needs to do differently\n\n## Resources Mentioned\n- Links, documents, or tools referenced\n\n## Next All-Hands Preview\nTopics to be covered next time",
    "1on1": "You are a people manager focused on employee development. Document this 1:1 with:\n\n## Meeting Context\n- Manager and direct report names\n- Recurring or special 1:1?\n\n## Employee Well-being Check\n- Overall morale/satisfaction\n- Work-life balance indicators\n- Any personal concerns affecting work\n\n## Performance Discussion\n- Progress on current goals\n- Achievements to celebrate\n- Areas for improvement\n- Specific feedback exchanged\n\n## Career Development\n- Growth aspirations discussed\n- Skills to develop\n- Opportunities identified\n- Training/mentoring needs\n\n## Challenges & Support Needed\n- Current obstacles\n- Resources requested\n- Manager commitments to help\n\n## Action Items\n| Who | What | By When |\n\n## Topics for Next 1:1\n- Follow-ups needed\n- Topics parked for later\n\n## Manager Notes (Confidential)\n- Performance trends\n- Development opportunities\n- Team dynamics observations\n\nMaintain professional tone while capturing coaching moments.",
    "brainstorm": "You are an innovation strategist maximizing creative output. Organize this session into:\n\n## Session Objective\nWhat problem were we trying to solve?\n\n## Ideas Generated (Grouped by Theme)\nOrganize ideas into logical categories:\n\n### Category 1\n- Idea (contributor)\n- Build on this: [related ideas]\n\n### Category 2\n- Continue pattern...\n\n## Top Ideas by Engagement\nList 5-7 ideas that generated most discussion/excitement:\n1. Idea - Why it resonated\n2. Continue...\n\n## Feasibility Quick Assessment\n| Idea | Impact | Effort | Priority |\n| --- | --- | --- | --- |\n| Top ideas... | High/Med/Low | High/Med/Low | 1-5 |\n\n## Wild Cards\nUnconventional ideas worth noting (even if not practical)\n\n## Next Steps\n- Which ideas move to validation?\n- Who owns follow-up?\n- Timeline for decisions\n\n## Parking Lot\nGood ideas outside current scope\n\n## Session Effectiveness\n- Participation level\n- Diversity of ideas\n- Did we meet objective?\n\nCapture the energy and creativity while maintaining actionable output."
};

let currentDefaultFormat = 'txt';

// --- Error Handling ---
function safeExecute(fn, context = '', fallback = null) {
    try {
        return fn();
    } catch (error) {
        console.error(`[Teams Caption Saver] ${context}:`, error);
        return fallback;
    }
}

// --- Utility Functions ---
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function getActiveTeamsTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const teamsTab = tabs.find(tab => tab.url?.startsWith("https://teams.microsoft.com"));
    return teamsTab || null;
}

async function formatTranscript(transcript, aliases, type = 'standard') {
    const processed = transcript.map(entry => ({
        ...entry,
        Name: aliases[entry.Name] || entry.Name
    }));

    if (type === 'ai') {
        const { aiInstructions: instructions } = await chrome.storage.sync.get('aiInstructions');
        const transcriptText = processed.map(entry => `[${entry.Time}] ${entry.Name}: ${entry.Text}`).join('\n\n');
        return instructions ? `${instructions}\n\n---\n\n${transcriptText}` : transcriptText;
    }

    return processed.map(entry => `[${entry.Time}] ${entry.Name}: ${entry.Text}`).join('\n');
}

// --- UI Update Functions ---
async function updateStatusUI({ capturing, captionCount, isInMeeting, attendeeCount }) {
    const { statusMessage } = UI_ELEMENTS;
    const { trackCaptions, trackAttendees } = await chrome.storage.sync.get(['trackCaptions', 'trackAttendees']);
    
    if (isInMeeting) {
        // In meeting - show appropriate status based on what's being tracked
        if (trackCaptions !== false && capturing) {
            let status = captionCount > 0 ? `Capturing! (${captionCount} lines recorded` : 'Capturing... (Waiting for speech';
            if (attendeeCount > 0) {
                status += `, ${attendeeCount} attendees`;
            }
            status += ')';
            statusMessage.textContent = status;
            statusMessage.style.color = captionCount > 0 ? '#28a745' : '#ffc107';
        } else if (trackCaptions === false && trackAttendees !== false && attendeeCount > 0) {
            // Only tracking attendees
            statusMessage.textContent = `Tracking attendees (${attendeeCount} participants)`;
            statusMessage.style.color = '#17a2b8';
        } else if (trackCaptions === false) {
            statusMessage.textContent = 'In a meeting (caption tracking disabled)';
            statusMessage.style.color = '#6c757d';
        } else {
            statusMessage.textContent = 'In a meeting, but captions are off.';
            statusMessage.style.color = '#dc3545';
        }
    } else {
        // Not in meeting - show saved data status
        let hasData = captionCount > 0 || attendeeCount > 0;
        if (hasData) {
            let status = 'Meeting ended. ';
            let parts = [];
            if (captionCount > 0) parts.push(`${captionCount} lines`);
            if (attendeeCount > 0) parts.push(`${attendeeCount} attendees`);
            status += parts.join(', ') + ' available.';
            statusMessage.textContent = status;
            statusMessage.style.color = '#17a2b8';
        } else {
            statusMessage.textContent = 'Not in a meeting.';
            statusMessage.style.color = '#6c757d';
        }
    }
}

function updateButtonStates(hasData) {
    const buttons = [
        UI_ELEMENTS.copyButton, UI_ELEMENTS.copyDropdownButton,
        UI_ELEMENTS.saveButton, UI_ELEMENTS.saveDropdownButton,
        UI_ELEMENTS.viewButton
    ];
    buttons.forEach(btn => btn.disabled = !hasData);
}

function updateSaveButtonText(format) {
    UI_ELEMENTS.saveButton.textContent = format === 'ai' ? 'Save for AI' : `Save as ${format.toUpperCase()}`;
}

async function renderSpeakerAliases(tab) {
    const { speakerAliasList } = UI_ELEMENTS;
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { message: "get_unique_speakers" });
        if (!response?.speakers?.length) {
            speakerAliasList.innerHTML = '<p>No speakers detected yet.</p>';
            return;
        }

        const { speakerAliases = {} } = await chrome.storage.session.get('speakerAliases');
        speakerAliasList.innerHTML = ''; // Clear existing

        response.speakers.forEach(speaker => {
            const item = document.createElement('div');
            item.className = 'alias-item';
            item.innerHTML = `
                <label title="${escapeHtml(speaker)}">${escapeHtml(speaker)}</label>
                <input type="text" data-original-name="${escapeHtml(speaker)}" placeholder="Enter alias..." value="${escapeHtml(speakerAliases[speaker] || '')}">
            `;
            speakerAliasList.appendChild(item);
        });
    } catch (error) {
        console.error("Could not fetch or render speaker aliases:", error);
        speakerAliasList.innerHTML = '<p>Unable to load speakers. Please refresh the Teams tab and try again.</p>';
    }
}

// --- Template Management ---
async function loadCustomTemplates() {
    const { customTemplates = {} } = await chrome.storage.sync.get('customTemplates');
    
    // Clear existing custom templates
    UI_ELEMENTS.customTemplatesGroup.innerHTML = '';
    
    // Add custom templates to dropdown
    Object.entries(customTemplates).forEach(([id, template]) => {
        const option = document.createElement('option');
        option.value = `custom_${id}`;
        option.textContent = template.name;
        UI_ELEMENTS.customTemplatesGroup.appendChild(option);
    });
    
    // Show/hide custom templates optgroup
    UI_ELEMENTS.customTemplatesGroup.style.display = 
        Object.keys(customTemplates).length > 0 ? 'block' : 'none';
}

async function saveCustomTemplate(name, instructions) {
    if (!name.trim() || !instructions.trim()) {
        alert('Please enter both a template name and instructions.');
        return;
    }
    
    const { customTemplates = {} } = await chrome.storage.sync.get('customTemplates');
    
    // Generate unique ID
    const id = Date.now().toString();
    
    // Add new template
    customTemplates[id] = {
        name: name.trim(),
        instructions: instructions.trim(),
        createdAt: new Date().toISOString()
    };
    
    // Save to storage
    await chrome.storage.sync.set({ customTemplates });
    
    // Reload templates
    await loadCustomTemplates();
    
    // Clear template name input
    UI_ELEMENTS.templateName.value = '';
    
    // Select the newly created template
    UI_ELEMENTS.meetingType.value = `custom_${id}`;
    
    alert('Template saved successfully!');
}

async function deleteCustomTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this custom template?')) {
        return;
    }
    
    const { customTemplates = {} } = await chrome.storage.sync.get('customTemplates');
    
    // Remove the custom_ prefix to get the actual ID
    const id = templateId.replace('custom_', '');
    
    delete customTemplates[id];
    
    // Save to storage
    await chrome.storage.sync.set({ customTemplates });
    
    // Reload templates
    await loadCustomTemplates();
    
    // Reset selection
    UI_ELEMENTS.meetingType.value = '';
    UI_ELEMENTS.deleteTemplateBtn.style.display = 'none';
    
    alert('Template deleted successfully!');
}

// --- Settings Management ---
async function loadSettings() {
    const settings = await chrome.storage.sync.get([
        'autoEnableCaptions',
        'autoSaveOnEnd',
        'aiInstructions',
        'defaultSaveFormat',
        'trackCaptions',
        'trackAttendees',
        'autoOpenAttendees',
        'timestampFormat',
        'filenamePattern'
    ]);

    UI_ELEMENTS.autoEnableCaptionsToggle.checked = !!settings.autoEnableCaptions;
    UI_ELEMENTS.autoSaveOnEndToggle.checked = !!settings.autoSaveOnEnd;
    UI_ELEMENTS.trackCaptionsToggle.checked = settings.trackCaptions !== false; // Default to true
    UI_ELEMENTS.trackAttendeesToggle.checked = settings.trackAttendees !== false; // Default to true
    if (UI_ELEMENTS.autoOpenAttendeesToggle) {
        UI_ELEMENTS.autoOpenAttendeesToggle.checked = !!settings.autoOpenAttendees;
        UI_ELEMENTS.autoOpenAttendeesToggle.disabled = !UI_ELEMENTS.trackAttendeesToggle.checked;
    }
    UI_ELEMENTS.timestampFormat.value = settings.timestampFormat || '12hr';
    UI_ELEMENTS.filenamePattern.value = settings.filenamePattern || '{date}_{title}_{format}';
    UI_ELEMENTS.aiInstructions.value = settings.aiInstructions || '';
    UI_ELEMENTS.manualStartInfo.style.display = settings.autoEnableCaptions ? 'none' : 'block';

    currentDefaultFormat = settings.defaultSaveFormat || 'txt';
    UI_ELEMENTS.defaultSaveFormatSelect.value = currentDefaultFormat;
    updateSaveButtonText(currentDefaultFormat);
}

// --- Event Handling ---
function setupEventListeners() {
    // Settings Listeners
    UI_ELEMENTS.defaultSaveFormatSelect.addEventListener('change', (e) => {
        currentDefaultFormat = e.target.value;
        chrome.storage.sync.set({ defaultSaveFormat: currentDefaultFormat });
        updateSaveButtonText(currentDefaultFormat);
    });

    UI_ELEMENTS.trackCaptionsToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ trackCaptions: e.target.checked });
        // Disable auto-enable captions if caption tracking is disabled
        if (!e.target.checked) {
            UI_ELEMENTS.autoEnableCaptionsToggle.checked = false;
            UI_ELEMENTS.autoEnableCaptionsToggle.disabled = true;
            chrome.storage.sync.set({ autoEnableCaptions: false });
        } else {
            UI_ELEMENTS.autoEnableCaptionsToggle.disabled = false;
        }
    });
    
    UI_ELEMENTS.autoEnableCaptionsToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ autoEnableCaptions: e.target.checked });
        UI_ELEMENTS.manualStartInfo.style.display = e.target.checked ? 'none' : 'block';
    });

    UI_ELEMENTS.autoSaveOnEndToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ autoSaveOnEnd: e.target.checked });
    });

    UI_ELEMENTS.trackAttendeesToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ trackAttendees: e.target.checked });
        // Disable auto-open if tracking is disabled
        if (UI_ELEMENTS.autoOpenAttendeesToggle) {
            if (!e.target.checked) {
                UI_ELEMENTS.autoOpenAttendeesToggle.checked = false;
                UI_ELEMENTS.autoOpenAttendeesToggle.disabled = true;
                chrome.storage.sync.set({ autoOpenAttendees: false });
            } else {
                UI_ELEMENTS.autoOpenAttendeesToggle.disabled = false;
            }
        }
    });
    
    if (UI_ELEMENTS.autoOpenAttendeesToggle) {
        UI_ELEMENTS.autoOpenAttendeesToggle.addEventListener('change', (e) => {
            chrome.storage.sync.set({ autoOpenAttendees: e.target.checked });
        });
    }
    
    // Initialize auto-enable captions toggle state based on track captions
    if (UI_ELEMENTS.trackCaptionsToggle) {
        UI_ELEMENTS.autoEnableCaptionsToggle.disabled = !UI_ELEMENTS.trackCaptionsToggle.checked;
    }

    UI_ELEMENTS.timestampFormat.addEventListener('change', (e) => {
        chrome.storage.sync.set({ timestampFormat: e.target.value });
    });

    UI_ELEMENTS.filenamePattern.addEventListener('input', (e) => {
        chrome.storage.sync.set({ filenamePattern: e.target.value });
    });

    UI_ELEMENTS.meetingType.addEventListener('change', async (e) => {
        const value = e.target.value;
        
        // Show/hide delete button for custom templates
        UI_ELEMENTS.deleteTemplateBtn.style.display = 
            value.startsWith('custom_') ? 'inline-block' : 'none';
        
        if (value) {
            if (value.startsWith('custom_')) {
                // Load custom template
                const { customTemplates = {} } = await chrome.storage.sync.get('customTemplates');
                const id = value.replace('custom_', '');
                if (customTemplates[id]) {
                    UI_ELEMENTS.aiInstructions.value = customTemplates[id].instructions;
                    UI_ELEMENTS.aiInstructions.dispatchEvent(new Event('change'));
                }
            } else if (MEETING_TYPE_PROMPTS[value]) {
                // Load built-in template
                UI_ELEMENTS.aiInstructions.value = MEETING_TYPE_PROMPTS[value];
                UI_ELEMENTS.aiInstructions.dispatchEvent(new Event('change'));
            }
        }
    });
    
    UI_ELEMENTS.saveTemplateBtn.addEventListener('click', () => {
        const name = UI_ELEMENTS.templateName.value;
        const instructions = UI_ELEMENTS.aiInstructions.value;
        saveCustomTemplate(name, instructions);
    });
    
    UI_ELEMENTS.templateName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const name = UI_ELEMENTS.templateName.value;
            const instructions = UI_ELEMENTS.aiInstructions.value;
            saveCustomTemplate(name, instructions);
        }
    });
    
    UI_ELEMENTS.deleteTemplateBtn.addEventListener('click', () => {
        const selectedValue = UI_ELEMENTS.meetingType.value;
        if (selectedValue.startsWith('custom_')) {
            deleteCustomTemplate(selectedValue);
        }
    });

    UI_ELEMENTS.aiInstructions.addEventListener('change', (e) => {
        chrome.storage.sync.set({ aiInstructions: e.target.value });
    });

    UI_ELEMENTS.speakerAliasList.addEventListener('change', async (e) => {
        if (e.target.tagName === 'INPUT') {
            const { originalName } = e.target.dataset;
            const newAlias = e.target.value.trim();
            const { speakerAliases = {} } = await chrome.storage.session.get('speakerAliases');
            speakerAliases[originalName] = newAlias;
            await chrome.storage.session.set({ speakerAliases });
        }
    });

    // Action Button Listeners
    UI_ELEMENTS.saveButton.addEventListener('click', async () => {
        const tab = await getActiveTeamsTab();
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { message: "return_transcript", format: currentDefaultFormat });
        }
    });

    UI_ELEMENTS.viewButton.addEventListener('click', async () => {
        const tab = await getActiveTeamsTab();
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { message: "get_captions_for_viewing" });
        }
    });

    setupDropdown(UI_ELEMENTS.copyButton, UI_ELEMENTS.copyDropdownButton, UI_ELEMENTS.copyOptions, handleCopy);
    setupDropdown(null, UI_ELEMENTS.saveDropdownButton, UI_ELEMENTS.saveOptions, handleSave);

    // AI Prompt Buttons - Now act as smart template selectors
    UI_ELEMENTS.promptButtons.forEach(button => {
        button.addEventListener('click', function() {
            const buttonText = this.textContent;
            let templateToSelect = '';
            
            // Map buttons to the most appropriate templates
            switch(buttonText) {
                case 'Summarize':
                    templateToSelect = 'executive'; // Executive Summary template
                    break;
                case 'List Action Items':
                    templateToSelect = 'retrospective'; // Has comprehensive action items
                    break;
                case 'Find Decisions':
                    templateToSelect = 'review'; // Design Review has decision tracking
                    break;
            }
            
            // Select the template in dropdown
            if (templateToSelect) {
                UI_ELEMENTS.meetingType.value = templateToSelect;
                // Trigger change event to load the template
                UI_ELEMENTS.meetingType.dispatchEvent(new Event('change'));
                
                // Provide visual feedback
                this.style.backgroundColor = '#28a745';
                this.style.color = 'white';
                setTimeout(() => {
                    this.style.backgroundColor = '';
                    this.style.color = '';
                }, 500);
            }
        });
    });

    document.addEventListener('click', () => {
        UI_ELEMENTS.copyOptions.style.display = 'none';
        UI_ELEMENTS.saveOptions.style.display = 'none';
    });
}

function setupDropdown(mainButton, dropdownButton, optionsContainer, actionHandler) {
    if (mainButton) {
        mainButton.addEventListener('click', () => optionsContainer.firstElementChild.click());
    }
    dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsContainer.style.display = 'block';
    });
    optionsContainer.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        actionHandler(e.target);
        optionsContainer.style.display = 'none';
    });
}

async function handleCopy(target) {
    const copyType = target.dataset.copyType;
    if (!copyType) return;

    const tab = await getActiveTeamsTab();
    if (!tab) return;
    
    UI_ELEMENTS.statusMessage.textContent = "Preparing text to copy...";
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { message: "get_transcript_for_copying" });
        if (response?.transcriptArray) {
            const { speakerAliases = {} } = await chrome.storage.session.get('speakerAliases');
            const formattedText = await formatTranscript(response.transcriptArray, speakerAliases, copyType);
            await navigator.clipboard.writeText(formattedText);
            UI_ELEMENTS.statusMessage.textContent = "Copied to clipboard!";
            UI_ELEMENTS.statusMessage.style.color = '#28a745';
        }
    } catch (error) {
        UI_ELEMENTS.statusMessage.textContent = "Copy failed.";
        UI_ELEMENTS.statusMessage.style.color = '#dc3545';
    }
}

async function handleSave(target) {
    const format = target.dataset.format;
    if (!format) return;
    
    const tab = await getActiveTeamsTab();
    if (tab) {
        UI_ELEMENTS.statusMessage.textContent = `Saving as ${format === 'ai' ? 'AI' : format.toUpperCase()}...`;
        chrome.tabs.sendMessage(tab.id, { message: "return_transcript", format });
    }
}

// --- Session History Management ---
async function initializeSessionHistory() {
    try {
        // Load SessionManager script
        const script = document.createElement('script');
        script.src = 'sessionManager.js';
        document.head.appendChild(script);
        
        // Wait for script to load
        await new Promise(resolve => {
            script.onload = resolve;
            setTimeout(resolve, 100); // Fallback timeout
        });
        
        // Always show session history button
        UI_ELEMENTS.sessionHistory.style.display = 'flex';
        
        // Setup history button click handler
        UI_ELEMENTS.historyButton.addEventListener('click', async () => {
            const isVisible = UI_ELEMENTS.sessionList.style.display !== 'none';
            UI_ELEMENTS.sessionList.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                await loadSessionList();
            }
        });
        
        // Check if we have saved sessions and update button text
        const sessionManager = new SessionManager();
        const sessions = await sessionManager.getSessionIndex();
        
        if (sessions && sessions.length > 0) {
            UI_ELEMENTS.historyButton.innerHTML = `📁 View Previous Sessions (${sessions.length})`;
        } else {
            UI_ELEMENTS.historyButton.innerHTML = '📁 No Previous Sessions';
        }
    } catch (error) {
        console.log('[Session History] Initialization skipped:', error.message);
    }
}

async function loadSessionList() {
    try {
        const sessionManager = new SessionManager();
        const sessions = await sessionManager.getSessionIndex();
        const stats = await sessionManager.getStorageStats();
        
        if (!sessions || sessions.length === 0) {
            UI_ELEMENTS.sessionList.innerHTML = '<div style="text-align: center; color: #999;">No saved sessions</div>';
            return;
        }
        
        let html = '';
        for (const session of sessions) {
            const timeAgo = getTimeAgo(new Date(session.timestamp));
            html += `
                <div class="session-item" data-id="${session.id}">
                    <div class="session-title">${escapeHtml(session.title)}</div>
                    <div class="session-meta">
                        <span>${session.date} • ${session.duration} • ${session.captionCount} captions</span>
                        <span>${session.speakers.length} speakers</span>
                    </div>
                    <div class="session-meta" style="margin-top: 4px;">
                        <span style="font-size: 11px; color: #888;">${timeAgo}</span>
                    </div>
                    <div class="session-actions">
                        <button class="session-btn view-btn" data-id="${session.id}">View</button>
                        <button class="session-btn export-btn" data-id="${session.id}">Export</button>
                        <button class="session-btn delete" data-id="${session.id}">Delete</button>
                    </div>
                </div>
            `;
        }
        
        // Add storage info
        html += `
            <div class="storage-info">
                Storage: ${stats.usedMB}MB / ${stats.quotaMB}MB (${stats.percentUsed}%)
                <button id="clearAllSessions" style="margin-left: 10px; font-size: 11px; color: #dc3545; background: none; border: none; cursor: pointer; text-decoration: underline;">Clear All</button>
            </div>
        `;
        
        UI_ELEMENTS.sessionList.innerHTML = html;
        
        // Add event listeners for session actions
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => viewSession(e.target.dataset.id));
        });
        
        document.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => exportSession(e.target.dataset.id));
        });
        
        document.querySelectorAll('.session-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => deleteSession(e.target.dataset.id));
        });
        
        document.getElementById('clearAllSessions')?.addEventListener('click', clearAllSessions);
        
    } catch (error) {
        console.error('[Session History] Failed to load sessions:', error);
        UI_ELEMENTS.sessionList.innerHTML = '<div style="text-align: center; color: #dc3545;">Error loading sessions</div>';
    }
}

async function viewSession(sessionId) {
    try {
        const sessionManager = new SessionManager();
        const sessionData = await sessionManager.loadSession(sessionId);
        
        // Store in chrome.storage.local for viewer to access - using the correct key
        await chrome.storage.local.set({
            captionsToView: sessionData.transcript,
            viewerData: {
                transcriptArray: sessionData.transcript,
                meetingTitle: sessionData.metadata.title,
                attendeeReport: sessionData.attendeeReport,
                isHistorical: true
            }
        });
        
        // Open viewer
        window.open(chrome.runtime.getURL('viewer.html'), '_blank');
        
    } catch (error) {
        console.error('[Session History] Failed to view session:', error);
        alert('Failed to load session. It may have been corrupted.');
    }
}

async function exportSession(sessionId) {
    try {
        const sessionManager = new SessionManager();
        const sessionData = await sessionManager.loadSession(sessionId);
        
        // Use existing export logic - correct message type
        const format = currentDefaultFormat;
        await chrome.runtime.sendMessage({
            message: "download_captions",  // Fixed: was "save_transcript"
            transcriptArray: sessionData.transcript,
            format: format,
            meetingTitle: sessionData.metadata.title,
            attendeeReport: sessionData.attendeeReport,
            recordingStartTime: sessionData.metadata.timestamp
        });
        
        // Visual feedback
        const btn = document.querySelector(`.export-btn[data-id="${sessionId}"]`);
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '✓ Exported';
            btn.style.background = '#28a745';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.style.color = '';
            }, 2000);
        }
        
    } catch (error) {
        console.error('[Session History] Failed to export session:', error);
        alert('Failed to export session.');
    }
}

async function deleteSession(sessionId) {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    
    try {
        const sessionManager = new SessionManager();
        await sessionManager.deleteSession(sessionId);
        await loadSessionList(); // Refresh the list
    } catch (error) {
        console.error('[Session History] Failed to delete session:', error);
    }
}

async function clearAllSessions() {
    if (!confirm('Delete ALL saved sessions? This cannot be undone.')) return;
    
    try {
        const sessionManager = new SessionManager();
        await sessionManager.clearAllSessions();
        UI_ELEMENTS.sessionList.style.display = 'none';
        UI_ELEMENTS.sessionHistory.style.display = 'none';
    } catch (error) {
        console.error('[Session History] Failed to clear sessions:', error);
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Initialization ---
async function initializePopup() {
    await loadSettings();
    await loadCustomTemplates();
    setupEventListeners();
    await initializeSessionHistory(); // Initialize session history

    const tab = await getActiveTeamsTab();
    if (!tab) {
        UI_ELEMENTS.statusMessage.innerHTML = 'Please <a href="https://teams.microsoft.com" target="_blank">open a Teams tab</a> to use this extension.';
        UI_ELEMENTS.statusMessage.style.color = '#dc3545';
        return;
    }

    try {
        const status = await chrome.tabs.sendMessage(tab.id, { message: "get_status" });
        if (status) {
            await updateStatusUI(status);
            // Enable buttons if we have either captions or attendees
            const hasData = status.captionCount > 0 || (status.attendeeCount > 0 && status.isInMeeting === false);
            updateButtonStates(hasData);
            if (status.captionCount > 0) {
                renderSpeakerAliases(tab);
            }
        }
    } catch (error) {
        // This error is expected when content script isn't loaded yet
        if (error.message.includes("Could not establish connection")) {
            console.log("Content script not ready. This is normal if the Teams page was just opened.");
            UI_ELEMENTS.statusMessage.innerHTML = 'Please refresh your Teams tab (F5) to activate the extension.';
            UI_ELEMENTS.statusMessage.style.color = '#ffc107';
            
            // Try to inject the content script if it's not loaded
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content_script.js']
                });
                console.log("Content script injected successfully. Retrying connection...");
                // Retry after injection
                setTimeout(() => initializePopup(), 500);
            } catch (injectError) {
                console.log("Could not inject content script:", injectError.message);
                UI_ELEMENTS.statusMessage.textContent = "Please refresh your Teams tab to activate the extension.";
                UI_ELEMENTS.statusMessage.style.color = '#dc3545';
            }
        } else {
            console.error("Unexpected error:", error.message);
            UI_ELEMENTS.statusMessage.textContent = "Connection error. Please refresh your Teams tab and try again.";
            UI_ELEMENTS.statusMessage.style.color = '#dc3545';
        }
    }
}

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + S for save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!UI_ELEMENTS.saveButton.disabled) {
            UI_ELEMENTS.saveButton.click();
        }
    }
    
    // Ctrl/Cmd + C for copy
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        if (!UI_ELEMENTS.copyButton.disabled) {
            UI_ELEMENTS.copyButton.click();
        }
    }
    
    // Ctrl/Cmd + V for view
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        if (!UI_ELEMENTS.viewButton.disabled) {
            UI_ELEMENTS.viewButton.click();
        }
    }
});

document.addEventListener('DOMContentLoaded', initializePopup);