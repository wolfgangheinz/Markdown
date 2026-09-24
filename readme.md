Offline Markdown Studio
=======================

A self-contained, browser-based Markdown editor designed for restricted environments. It bundles editing, live preview, autosave, export, and file handling into a small set of local HTML, CSS, JavaScript, and vendored assets that run entirely offline—no build step or backend required. The goal is to let you edit Markdown locally without pasting sensitive text into third-party web apps.

Features
--------
- Compact grouped formatting toolbar, File menu, and Split / Visual / Markdown / Preview modes.
- Local-vault workspace with persistent tabs, Quick Switcher (`Ctrl/⌘+O`), Command Palette (`Ctrl/⌘+P`), vault search (`Ctrl/⌘+Shift+F`), and Outline / Backlinks / folder graph panels.
- Connected graph showing every Markdown note reachable from the current file through resolved Markdown and `[[wiki]]` links. Unrelated groups are hidden. Open it from the Graph panel or File menu to search, pan, zoom, focus a note, and open it. Labels stay readable as you zoom and are shown only where they fit. The graph stays entirely local.
- GitHub-flavoured Markdown rendering (headings, lists, tables, task lists, code blocks, etc.), Mermaid diagrams, and syntax highlighting in both the source editor and rendered code blocks.
- Toolbar and keyboard shortcuts for common formatting, including highlight, images, tables, task lists, and fenced code insertion.
- Outside a folder, drafts always autosave to `localStorage` and **Save** downloads a copy. Opened writable folders add an **Autosave to disk** toggle; when disabled, changes stay local until Save and unsaved files are protected on tab/browser close.
- Create a Markdown file in the selected Explorer folder with the **+** button when folder write permission is available.
- Open Markdown, plain-text, or HTML files (HTML is converted to Markdown), or drag and drop a file into the workspace. Rich-text paste is converted to Markdown where possible.
- Copy rendered HTML, export standalone HTML, or print to PDF.
- Light/dark themes and toast notifications for key actions.
- Autosave status with a final save on browser background/close, plus confirmation before permanently deleting a draft.
- Visual editing mode that persists with the selected view; remote images are opt-in to avoid background network requests.
- Marked, DOMPurify, Highlight.js, Mermaid, and Turndown are bundled in `vendor/`; no document contents or runtime dependencies leave the machine.

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
2. Keep the `vendor/` folder alongside `index.html`, then double-click `index.html` or drag it into a modern browser (Edge, Chrome, Safari).
3. Start typing in the Markdown pane; the preview updates automatically. Use **Visual** in the view switcher to write directly in the rendered document, or **Split** to see both representations.

On the first visit, a short **Welcome.md** guide opens in Split view and is saved as the first local draft. Later visits restore existing drafts and the chosen view.

The app runs locally—no server is required. To edit a folder’s files directly in Edge or Chrome, choose **Open Folder** and allow its permission prompt. Safari and other browsers use the available file-picker and download fallbacks.

Keyboard Shortcuts
-------------------

- **Bold** `Ctrl/⌘ + B`
- **Italic** `Ctrl/⌘ + I`
- **Heading** `Ctrl/⌘ + 1`
- **Code Block** `Ctrl/⌘ + \``
- **Link** `Ctrl/⌘ + K`
- **Save** `Ctrl/⌘ + S`
- **Undo** `Ctrl/⌘ + Z` (also available via the toolbar)
- **Redo** `Ctrl/⌘ + Shift + Z` or `Ctrl/⌘ + Y`
- **Quick Switcher** `Ctrl/⌘ + O` (when a folder vault is open)
- **Command Palette** `Ctrl/⌘ + P`
- **Vault Search** `Ctrl/⌘ + Shift + F`

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
- `app.js` – Editor logic: workspace and vault features, editing and preview, persistence, file handling, and export.
- `graph.js` – Folder graph model and layout.
- `about.md` – The About dialog's Markdown content.
- `vendor/` – Offline copies of Marked, DOMPurify, Highlight.js, Mermaid, Turndown, and preview styles.
- `prd.md` – Product requirements reference.

Development Notes
-----------------

Everything is plain HTML/JS/CSS, so no build tooling is required. If you add third-party libraries (e.g. Mermaid for diagrams), prefer bundling the minified assets locally so the project remains fully offline.

Run the graph model tests with `node --test tests/graph.test.js`.

Contributing
------------

Feel free to fork the repository and experiment on your own branches. At this time we are not accepting direct pull requests into the main branch. If you have ideas or find issues, please open a GitHub Issue instead of a PR.

License
-------

Specify your preferred license here (e.g. MIT, Apache-2.0). If you have not chosen one yet, consider adding a `LICENSE` file so contributors know how they may use the project.
