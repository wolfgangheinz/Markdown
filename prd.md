# PRD: Offline Markdown Editor (Standalone HTML App)

## 1. Goal
Provide a **self-contained, offline Markdown editor** (HTML + JS + CSS, no backend) that works in restricted corporate environments (e.g., Edge browser), supporting split edit/preview, GitHub-style Markdown, file operations, and basic export.

---

## 2. Users & Use Cases
- **Developers / Analysts**: Write PRDs, documentation, or wiki pages in Markdown.  
- **Employees in restricted IT environments**: Need a lightweight editor without external dependencies.  
- **Use Cases**:
  - Draft feature specs and PRDs.
  - Copy rendered Markdown to paste into Azure DevOps / GitHub / Confluence.
  - Save `.md` files locally and re-open.
  - Export to HTML or PDF for sharing.

---

## 3. Functional Requirements

### Core Editing
- **Split View**: Side-by-side editor (textarea) and preview.
- **Responsive Toggle**: On small screens, allow switching between edit/preview.
- **Basic Formatting**: Bold, italic, headings, inline code, fenced code blocks, lists, task lists, blockquotes, tables, links, strikethrough.
- **Keyboard Shortcuts**:  
  - Bold: `Ctrl/Cmd+B`  
  - Italic: `Ctrl/Cmd+I`  
  - Heading: `Ctrl/Cmd+1`  
  - Code block: `Ctrl/Cmd+\``  
  - Link: `Ctrl/Cmd+K`
- **Toolbar**: Buttons for common Markdown constructs.

### File Handling
- **Open / Save / Save As**:  
  - Use File System Access API in Edge (preferred).  
  - Fallback: file picker for open, “download” for save.  
- **Drag & Drop**: Drop `.md` file to load.  
- **Autosave**: Draft saved in `localStorage` until explicitly cleared.  

### Copy / Export
- **Copy MD**: Copy raw Markdown.
- **Copy Rich**: Copy rendered HTML to clipboard (paste into wiki/office apps).
- **Export HTML**: Generate standalone HTML file with embedded CSS.
- **Print / Export PDF**: Use browser print dialog with preview styling.

### Layout & UX
- **Resizable Panes**: Draggable divider between editor/preview, state persists.
- **Theme Toggle**: Light/Dark themes, persisted in `localStorage`.
- **Line Wrapping & Safari Compatibility**: Correct handling of CR/LF and Unicode line separators; avoid regex lookbehind.

---

## 4. Non-Functional Requirements
- **Offline Only**: All JS/CSS bundled, CDNs can be used. No backend.
- **Compatibility**: Edge (latest), Safari (latest stable), Chrome (latest).
- **Performance**: Handle docs up to ~1MB (~10k lines).
- **Security**: Escape HTML to prevent injection. Links open with `rel="noreferrer noopener"`.
- **Accessibility**:
  - Divider keyboard-resizable with arrow keys.
  - Preview is screen-reader accessible (`aria-live="polite"`).
  - Buttons labeled with tooltips and accessible names.

---

## 5. Out of Scope (v1)
- Real-time collaboration.
- Plugins/extensions (Mermaid, KaTeX).
- Full GitHub Flavored Markdown spec (tables supported, but no advanced syntax like footnotes).

---

## 6. Open Questions
1. Should we bundle **syntax highlighting** for code blocks (highlight.js)?
2. Should we add optional support for diagrams (Mermaid) and math (KaTeX)?
3. Should the app remember **cursor/scroll positions** across sessions?