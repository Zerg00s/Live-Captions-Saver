![](IMG/logo.png)

# MS Teams Live Captions Saver Browser Extension v4.5

The MS Teams Live Captions Saver is a powerful Chrome extension that captures, saves, and analyzes live captions from Microsoft Teams meetings. With advanced features like AI-powered summaries, speaker tracking, attendee monitoring, and automated exports, it's the perfect tool for meeting documentation and accessibility.

## Key Features

### Core Functionality
- **Real-time Caption Capture** - Automatically captures live captions during Teams meetings
- **Multiple Export Formats** - Save as TXT, Markdown, JSON, YAML, DOC, or AI-optimized formats
- **Speaker Identification & Aliasing** - Track who said what with customizable speaker names
- **Attendee Tracking** - Monitor meeting participants with join/leave timestamps
- **Auto-Save on Meeting End** - Never lose your transcripts with automatic saving

### Advanced Features
- **AI-Powered Templates** - 9 built-in meeting templates (Standup, Retrospective, Planning, etc.)
- **Custom AI Instructions** - Create and save your own AI analysis templates
- **Meeting Analytics Dashboard** - View speaker participation, word counts, and statistics
- **Live Transcript Viewer** - Search and filter transcripts in real-time
- **Customizable Filename Patterns** - Use variables like {date}, {time}, {title}, {attendees}
- **Multiple Timestamp Formats** - Choose between 12-hour, 24-hour, or relative timestamps

## Install from the Chrome Store

[MS Teams Live Captions Saver - Chrome Web Store](https://chromewebstore.google.com/detail/ms-teams-live-captions-sa/ffjfmokaelmhincapcajcnaoelgmpoih)

## Quick Start

### Using the Extension

1. **Navigate to Microsoft Teams** in your browser: https://teams.microsoft.com
2. **Join a meeting**
3. **The extension will automatically enable live captions** (if auto-start is enabled)
4. **Capture is automatic** - The extension starts recording once captions appear
5. **Save your transcript** using the extension popup when ready

![Extension Popup - Active Capture](IMG/Extension%20Popup%203.png)

*The extension actively capturing captions with speaker aliases enabled*

### Extension Interface

![Extension Settings](IMG/Extension%20Popup%201.png)

*Comprehensive settings panel with automation options*

The extension popup provides:
- **Real-time status** showing capture progress and attendee count
- **Quick export buttons** with dropdown format selection
- **Speaker alias management** for correcting names
- **Auto-save configuration** with customizable settings
- **AI template selection** for intelligent summaries

## Transcript Viewer

Click "View Transcript" to open the interactive viewer with:

![Transcript Viewer](IMG/View%20Transcript.png)

*Interactive transcript viewer with analytics dashboard*

- **Meeting Analytics** - Total messages, words, and speaker count
- **Speaker Participation Graph** - Visual representation of contribution
- **Search & Filter** - Find specific content or speakers
- **Real-time Updates** - See new captions as they arrive

## Advanced Settings

![Advanced Settings](IMG/Extension%20Popup%202.png)

*AI customization and meeting features configuration*

### Meeting Features
- **Auto-start Live Captions** - Automatically enables Teams captions when joining
- **Track Meeting Attendees** - Records participant join/leave times
- **Timestamp Format Options** - Customize time display format
- **Filename Pattern Variables** - Create dynamic file names

### AI Customization
- **9 Built-in Templates**:
  - Executive Summary
  - Daily Standup
  - Sprint Retrospective
  - Sprint Planning
  - Design Review
  - Interview Notes
  - All Hands Meeting
  - One-on-One
  - Brainstorming Session
- **Custom Templates** - Save your own AI prompts for reuse
- **Quick Template Buttons** - One-click access to common analyses

## Standalone Console Script

For environments where browser extensions cannot be installed:

![Standalone Script](IMG/Standalone%20Script.png)

*Console script v2.0 with attendee tracking and speaker aliases*

### Features:
- Attendee tracking with join/leave times
- Speaker aliasing system
- Enhanced duplicate prevention
- Multiple export formats
- Auto-enable captions
- Draggable UI panel

### Usage:
1. Open Developer Console (F12) in Teams meeting
2. Paste the script from `Standalone-scripts/teams-caption-saver-console.js`
3. Press Enter to run

## Export Formats

### Standard Formats
- **TXT** - Plain text with timestamps
- **Markdown** - Formatted with speaker sections
- **JSON** - Structured data with metadata
- **YAML** - Human-readable structured format
- **DOC** - Microsoft Word document

### AI-Optimized Format
Includes special formatting and instructions for AI analysis:
- Meeting context and metadata
- Structured transcript for LLM processing
- Template-specific prompts
- Action item extraction
- Decision tracking

## Manual Installation (Developer Mode)

1. Download the `teams-captions-saver` folder
2. Open Chrome/Edge/Brave and navigate to extensions:
   - `chrome://extensions/` - Chrome
   - `edge://extensions/` - Edge
   - `brave://extensions/` - Brave
3. Enable **Developer mode** (top right toggle)
4. Click **"Load unpacked"**
5. Select the `teams-captions-saver` directory

## Contributing

We welcome contributions! To get started:

1. Fork the repository
2. Load the extension in developer mode
3. Make your changes to the `teams-captions-saver` directory
4. Test in a Teams meeting
5. Submit a pull request

### Development Setup
- No build system required - pure JavaScript/HTML/CSS
- Test with actual Teams meetings (captions must be enabled)
- Update version in `manifest.json` for releases

## Requirements

- Chrome, Edge, or Brave browser
- Microsoft Teams web version (teams.microsoft.com)
- Live captions must be enabled in Teams meeting
- Extension works only during active meetings

## Privacy & Legal

### Important Notice
This extension captures and saves live captions from meetings, which may include sensitive information. Before using:

- **Obtain consent** from all meeting participants
- **Comply with local laws** regarding recording and transcription
- **Follow your organization's policies** on meeting documentation
- **Respect privacy** and confidentiality requirements

### Data Handling
- All processing happens locally in your browser
- No data is sent to external servers
- Transcripts are saved to your local device only
- No telemetry or usage tracking

## Troubleshooting

### Common Issues

**Captions not capturing:**
- Ensure live captions are enabled in Teams (More → Turn on live captions)
- Refresh the Teams page after installing the extension
- Check that you're in an active meeting

**Extension not appearing:**
- Verify installation in browser extensions page
- Check permissions for teams.microsoft.com
- Try reloading the extension

**Export not working:**
- Check browser download settings
- Verify sufficient disk space
- Look for errors in browser console (F12)

**Attendee tracking issues:**
- Enable "Track Attendees" in settings
- Ensure roster panel is accessible
- Note: Only shows current participants

## License

This project is provided "as is" without warranty. Users are responsible for compliance with all applicable laws and regulations. See LICENSE file for details.

## Acknowledgments

- Original concept inspired by the need for accessible meeting documentation
- Built for the Microsoft Teams community
- Special thanks to all contributors and users providing feedback

## Support

For issues, feature requests, or questions:
- Open an issue on [GitHub](https://github.com/Zerg00s/Live-Captions-Saver/issues)
- Check existing issues for solutions
- Provide detailed reproduction steps for bugs

---

**Version:** 4.5  
**Last Updated:** August 2025  
**Compatibility:** Chrome/Edge/Brave with Manifest V3