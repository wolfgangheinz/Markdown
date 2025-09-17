Offline Markdown Studio
=======================

A self-contained, browser-based Markdown editor designed for restricted environments. It bundles editing, live preview, autosave, export, and file handling into a single HTML file that runs entirely offline—no build step or backend required.

Features
--------
- Split-view editor with resizable panes and responsive preview toggle.
- GitHub-flavoured Markdown rendering (headings, lists, tables, task lists, code blocks, etc.).
- Toolbar and keyboard shortcuts for common formatting, including highlight and fenced code insertion.
- Autosave to `localStorage`, plus open/save via the native File System Access API (with download fallbacks).
- Syntax-highlighted code blocks powered by Highlight.js.
- Copy rendered HTML, export standalone HTML, or print to PDF.
- Light/dark themes and toast notifications for key actions.

Getting Started
---------------

### 1. Download the App

You can use the GitHub UI without cloning:

1. Go to the repository home page.
2. Click the green `Code` button.
3. Select **Download ZIP**.
4. Extract the archive somewhere on your machine.

Alternatively, clone the repo:

```
git clone https://github.com/<your-account>/<your-repo>.git
```

### 2. Launch the Editor

1. Open the extracted folder.
2. Double-click `index.html`, or drag it into a modern browser (Edge, Chrome, Safari).
3. Start typing in the left pane; the preview updates automatically.

The app runs locally—no server is required. For best results in Edge/Chrome, allow the File System Access prompt when saving so the editor can write directly to disk. Safari users get automatic download fallbacks.

Keyboard Shortcuts
-------------------

- **Bold** `Ctrl/⌘ + B`
- **Italic** `Ctrl/⌘ + I`
- **Heading** `Ctrl/⌘ + 1`
- **Code Block** `Ctrl/⌘ + \``
- **Link** `Ctrl/⌘ + K`
- **Undo** `Ctrl/⌘ + Z` (also available via the toolbar)

Export & Copy Options
---------------------

- **Copy MD** – Copies the raw Markdown to your clipboard.
- **Copy Rich** – Copies the rendered HTML (useful for pasting into wikis or documentation portals).
- **Export HTML** – Generates a standalone HTML file that keeps the preview styling and syntax highlighting.
- **Print** – Opens the browser print dialog, handy for PDF export.

Project Structure
-----------------

- `index.html` – Main page with layout and script includes.
- `styles.css` – App and preview styling (light/dark themes, typography, etc.).
- `app.js` – Editor logic: autosave, toolbar formatting, file handling, syntax highlighting.
- `prd.md` – Product requirements reference.

Development Notes
-----------------

Everything is plain HTML/JS/CSS, so no build tooling is required. If you add third-party libraries (e.g. Mermaid for diagrams), prefer bundling the minified assets locally so the project remains fully offline.

Contributing
------------

Feel free to fork the repository and experiment on your own branches. At this time we are not accepting direct pull requests into the main branch. If you have ideas or find issues, please open a GitHub Issue instead of a PR.

License
-------

Specify your preferred license here (e.g. MIT, Apache-2.0). If you have not chosen one yet, consider adding a `LICENSE` file so contributors know how they may use the project.
