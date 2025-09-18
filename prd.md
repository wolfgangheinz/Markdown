# Product Requirements Document (PRD): Offline Markdown Editor

## 1. Goal
Provide a **self-contained, offline Markdown editor** (HTML + JS + CSS, no backend) that works in restricted corporate environments (e.g., Edge browser), supporting split edit/preview, GitHub-style Markdown, file operations, and basic export.

---

## 2. Users & Use Cases

### Users
- **Developers / Analysts**: Write PRDs, documentation, or wiki pages in Markdown.  
- **Employees in restricted IT environments**: Need a lightweight editor without external dependencies.

### Use Cases
- Draft feature specs and PRDs.
- Copy rendered Markdown to paste into Azure DevOps, GitHub, Confluence, or SharePoint block editor.
- Save `.md` files locally and re-open.
- Export to HTML or PDF for sharing.
- Work on multiple documents in parallel with autosave.

---

## 3. Functional Requirements

### Core Editing
- **Split View**: Side-by-side editor (textarea) and preview.
- **Responsive Toggle**: Auto-collapse to single-pane on small screens.
- **Basic Formatting**: Bold, italic, headings, inline code, fenced code blocks, lists, task lists, blockquotes, tables, links, strikethrough, inline highlight, images.
- **Keyboard Shortcuts**:
  - Bold: `Ctrl/Cmd+B`
  - Italic: `Ctrl/Cmd+I`
  - Heading: `Ctrl/Cmd+1`
  - Code block: `Ctrl/Cmd+\``
  - Link: `Ctrl/Cmd+K`
  - Save: `Ctrl/Cmd+S`
  - Open: `Ctrl/Cmd+O`
- **Toolbar**: Buttons for common Markdown constructs plus undo, highlight, insert image, table, and task list helpers.
- **Theme Toggle**: Light/Dark themes, instant switch, persisted in `localStorage`.
- **Syntax Highlighting**: Applies highlight.js styling to code blocks when the library is available.

### File Handling
- **Open / Save / Save As**:
  - Use File System Access API in Edge (preferred).
  - Fallback: file picker for open, “download” for save.
- **Drag & Drop**: Drop `.md` file to load, with visual drop zone.
- **Autosave**:
  - All open files autosaved in `localStorage` using UUID + display name.
  - Multiple files supported.
  - Debounced save (default 3s).
  - Storage usage shown via progress bar above 75%.
  - Quota warnings prompt user to delete drafts.
  - Drafts can be renamed inline and deleted via file manager.
  - Optionally auto-expire old drafts.
- **File Manager UI**:
  - Access to autosaved drafts.
  - Rename, delete, and open files.
  - “+ New” button creates untitled document.
  - Click-to-rename title inline.
  - Filename validation for illegal characters.
- **New Document Reset**: “New” action clears the current document after confirmation and resets autosave state.
- **Manual Draft Clear**: “Clear Draft” action removes the autosaved draft from storage.

### Copy / Export
- **Copy MD**: Copy raw Markdown.
- **Copy Rich**: Copy rendered HTML to clipboard (for wiki/office apps).
- **Export HTML**: Generate standalone HTML file with embedded CSS.
- **Print / Export PDF**: Use browser print dialog with preview styling.
- **File Types**:
  - Support opening `.md`, `.txt`, `.html`.
  - Autodetect format and convert accordingly.
- **Rich Text Paste**:
  - Paste rich text (e.g., from Word).
  - Convert to Markdown using Turndown.js.
  - Fallback to HTML or plain text if conversion fails.
  - Warn user and prompt for cleanup if needed.

### Layout & UX
- **Resizable Panes**: Draggable divider between editor/preview, state persists.
- **Line Wrapping & Safari Compatibility**: Correct handling of CR/LF and Unicode line separators; avoid regex lookbehind.
- **Storage Usage Indicator**: Progress bar with color cues (green/yellow/red).
- **Click-to-Rename**: Inline editing of document title, confirmed on blur.
- **Action Feedback**: Toast notifications confirm file operations and clipboard actions.
- **Preview Cleanup**: Multi-line inline code snippets are promoted into fenced code blocks for readability.

---

## 4. Non-Functional Requirements
- **Offline Only**: All JS/CSS bundled locally. No backend. No CDN dependencies.
- **Compatibility**: Edge (latest), Safari (latest stable), Chrome (latest).
- **Performance**: Handle docs up to ~1MB (~10k lines).
- **Security**:
  - Escape HTML to prevent injection.
  - Links open with `rel="noreferrer noopener"`.
- **Accessibility**:
  - Divider keyboard-resizable with arrow keys.
  - Preview is screen-reader accessible (`aria-live="polite"`).
  - Buttons labeled with tooltips and accessible names.

---

## 5. Out of Scope (v1)
- Real-time collaboration.
- Plugins/extensions (Mermaid, KaTeX).
- Full GitHub Flavored Markdown spec (e.g., footnotes, emoji shortcodes, table alignment).
- OneDrive/SharePoint API integration (manual file handling only).
- Localization (English-only UI).

---

## 6. Open Questions
1. Should we bundle **syntax highlighting** for code blocks (highlight.js)?
2. Should the app remember **cursor/scroll positions** across sessions?


## 7. Gaps to be closed
- **Offline dependencies**: `index.html` still loads `marked`, `DOMPurify`, `highlight.js`, and `Turndown` from public CDNs, breaking the offline-only requirement.
