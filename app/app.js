(() => {
  const editor = document.getElementById('editor');
  const editorSyntax = document.querySelector('.editor-syntax code');
  const preview = document.getElementById('preview');
  const divider = document.querySelector('.divider');
  const explorerDivider = document.querySelector('.explorer-divider');
  const toolbars = document.querySelectorAll('.editor-toolbar, .workflow-toolbar');
  const fileActions = document.querySelector('.file-toolbar');
  const toast = document.querySelector('.toast');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-input');
  const explorer = document.querySelector('.file-explorer');
  const explorerName = document.querySelector('.file-explorer__name');
  const explorerTree = document.querySelector('.file-explorer__tree');
  const explorerEmpty = document.querySelector('.file-explorer__empty');
  const explorerEmptyMessage = document.querySelector('.file-explorer__empty-message');
  const explorerReconnect = document.querySelector('.file-explorer__reconnect');
  const explorerOpenFolder = document.querySelector('.file-explorer__open-folder');
  const explorerFooter = document.querySelector('.file-explorer__footer');
  const explorerDisconnect = document.querySelector('.file-explorer__disconnect');
  const disconnectDialog = document.querySelector('.disconnect-dialog');
  const disconnectDialogMessage = document.getElementById('disconnect-dialog-message');
  const explorerNewFile = document.querySelector('.file-explorer__new-file');
  const explorerToggles = document.querySelectorAll('[data-action="toggleExplorer"]');
  const main = document.querySelector('.app-main');
  const responsiveToggle = document.querySelectorAll('.view-toggle button');
  const root = document.documentElement;
  const editorPane = document.querySelector('.editor-pane');
  const previewPane = document.querySelector('.preview-pane');
  const themeToggle = document.querySelector('.theme-toggle');
  const docTitleInput = document.getElementById('document-title');
  const saveStatus = document.getElementById('save-status');
  const folderAutosaveToggle = document.querySelector('[data-folder-autosave]');
  const draftManager = document.querySelector('.draft-manager');
  const draftList = draftManager ? draftManager.querySelector('.draft-manager__list') : null;
  const draftEmpty = draftManager ? draftManager.querySelector('.draft-manager__empty') : null;
  const storageIndicator = draftManager ? draftManager.querySelector('.storage-indicator') : null;
  const storageBar = draftManager ? draftManager.querySelector('.storage-bar span') : null;
  const storageLabel = draftManager ? draftManager.querySelector('.storage-label') : null;
  const workspaceTabs = document.querySelector('.workspace-tabs');
  const workspacePanes = document.querySelector('.workspace-panes');
  const workspaceEmpty = document.querySelector('.workspace-empty');
  const contextSidebar = document.querySelector('.context-sidebar');
  const contextRailLabel = document.querySelector('.context-sidebar__rail-label');
  const workspaceModal = document.getElementById('workspace-modal');
  const workspaceQuery = document.getElementById('workspace-query');
  const workspaceResults = document.getElementById('workspace-results');
  const outlinePanel = document.getElementById('outline-panel');
  const backlinksPanel = document.getElementById('backlinks-panel');
  const graphPanel = document.getElementById('graph-panel');
  const graphModal = document.getElementById('graph-modal');
  const graphModalCanvas = document.getElementById('graph-modal-canvas');
  const aboutModal = document.querySelector('.about-modal');
  const aboutContent = document.querySelector('.about-modal__content');

  if (!editor || !preview || !editorPane || !previewPane) {
    return;
  }

  function bindThemeToggle() {
    if (!themeToggle) {
      return;
    }
    themeToggle.addEventListener('click', () => {
      toggleTheme();
    });
  }

  function bindAboutModal() {
    const openButton = document.querySelector('.file-explorer__about');
    if (!openButton || !aboutModal || !aboutContent) return;
    const closeButton = aboutModal.querySelector('[data-action="closeAbout"]');
    const fallbackMarkdown = document.getElementById('about-markdown').textContent.trim();
    let returnFocus = null;

    function renderAbout(markdown) {
      aboutContent.innerHTML = DOMPurify.sanitize(marked.parse(markdown), { USE_PROFILES: { html: true } });
      aboutContent.querySelectorAll('a[href]').forEach((link) => {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      });
    }

    function closeAbout() {
      aboutModal.hidden = true;
      if (returnFocus?.isConnected) returnFocus.focus();
    }

    openButton.addEventListener('click', async () => {
      returnFocus = document.activeElement;
      renderAbout(fallbackMarkdown);
      aboutModal.hidden = false;
      closeButton.focus();
      if (window.location.protocol === 'file:') return;
      try {
        const response = await fetch('app/about.md');
        if (response.ok && !aboutModal.hidden) renderAbout(await response.text());
      } catch (error) {
        // The bundled copy keeps About available without a server.
      }
    });
    aboutModal.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="closeAbout"]')) closeAbout();
    });
    aboutModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAbout();
      } else if (event.key === 'Tab') {
        const focusable = [closeButton, ...aboutContent.querySelectorAll('a[href]')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') {
    console.error('Markdown renderer not loaded');
    return;
  }

  const DOCUMENTS_KEY = 'markdown-studio-documents';
  const LEGACY_AUTOSAVE_KEY = 'markdown-studio-autosave';
  const SPLIT_KEY = 'markdown-studio-split';
  const EXPLORER_WIDTH_KEY = 'markdown-studio-explorer-width';
  const EXPLORER_COLLAPSED_KEY = 'markdown-studio-explorer-collapsed';
  const FOLDER_STATE_KEY = 'markdown-studio-folder-state';
  const FOLDER_AUTOSAVE_KEY = 'markdown-studio-folder-autosave';
  const FOLDER_DATABASE = 'markdown-studio-files';
  const FOLDER_STORE = 'handles';
  const THEME_KEY = 'markdown-studio-theme';
  const VIEW_KEY = 'markdown-studio-view';
  const WORKSPACE_KEY = 'markdown-studio-workspace-v1';
  const WELCOME_MARKDOWN = `# Welcome to Markdown Studio

Write Markdown on the left and see the finished page on the right. This welcome note is a draft you can edit or delete.

## Quick start

1. Start typing in the Markdown pane. The preview updates as you write.
2. Use the toolbar for formatting, or try **bold**, *italic*, and a heading with \`#\`.
3. Choose **Split**, **Visual**, **Markdown**, or **Preview** at the top to change how you work.
4. Open **File → New** for another draft, or **File → Open** to load a file.

Drafts save automatically in this browser; find them under **File → Drafts**. Use **File → Save** to download a Markdown file. To work directly with files in a folder, choose **File → Open Folder** (when your browser supports it).
`;
  const AUTOSAVE_DELAY = 3000;
  const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
  const ILLEGAL_FILENAME = /[<>:"/\\|?*]+/;
  const EXPORT_STYLES = `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#24292f;}[data-theme="dark"] body{background:#0d1117;color:#e6edf3;}a{color:#0969da;}code,pre{font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;border-radius:6px;}pre{padding:1rem;overflow:auto;background:#f6f8fa;color:#24292f;}[data-theme="dark"] pre{background:#161b22;color:#e6edf3;}code{background:#f6f8fa;color:#24292f;padding:0.15rem 0.4rem;}[data-theme="dark"] code{background:#161b22;color:#e6edf3;}table{border-collapse:collapse;width:100%;margin:1rem 0;}th,td{border:1px solid #d0d7de;padding:0.5rem;text-align:left;}blockquote{margin:1rem 0;padding:0.5rem 1rem;border-left:4px solid #d0d7de;color:rgba(87,96,106,0.9);}h1,h2,h3,h4,h5,h6{border-bottom:1px solid #d0d7de;padding-bottom:0.3em;margin:1.5em 0 0.8em;}img{max-width:100%;}article.markdown-body{max-width:860px;margin:0 auto;background:rgba(255,255,255,0.97);padding:2rem;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.08);font-size:0.97rem;line-height:1.65;}article.markdown-body pre{margin:1.5rem 0;}[data-theme="dark"] article.markdown-body{background:#161b22;color:#e6edf3;box-shadow:0 10px 30px rgba(0,0,0,0.45);}`;

  const supportsFileSystemAccess = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
  const supportsDirectoryAccess = typeof window.showDirectoryPicker === 'function';
  let currentFileHandle = null;
  let currentFileName = 'Untitled.md';
  let toastTimeout = 0;
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  let isResizingExplorer = false;
  let explorerStartX = 0;
  let explorerStartWidth = 0;
  const pendingSynchronizedScrolls = new WeakMap();
  const commandUndoStack = [];
  const commandRedoStack = [];
  const COMMAND_UNDO_LIMIT = 100;
  let isRestoring = false;
  let documents = {};
  let currentDocumentId = null;
  let autosaveTimer = 0;
  let folderAutosaveEnabled = localStorage.getItem(FOLDER_AUTOSAVE_KEY) !== 'false';
  let previewTimer = 0;
  let visualSyncTimer = 0;
  let isSyncingVisual = false;
  let quotaToastShown = false;
  let turndownService = null;
  const fileHandles = new Map();
  const folderEntries = new Map();
  const folderPathLookup = new Map();
  const folderDocumentIds = new Map();
  const folderPathsByDocumentId = new Map();
  let openedFolder = null;
  let activeFolderPath = null;
  let selectedFolderPath = null;
  let expandedFolderPaths = new Set();
  let rememberedDirectoryHandle = null;
  let pendingFolderReconnectState = null;
  let isDisconnectingFolder = false;
  let workspaceSession = { tabs: [], activeTab: null, context: 'outline', contextCollapsed: false, positions: {} };
  let vaultIndex = new Map();
  let graphCache = null;
  let graphPanelCache = null;
  let graphPanelActivePath = null;
  let graphView = null;
  let graphSelection = null;
  let graphReturnFocus = null;
  let graphResizeObserver = null;
  let workspaceMode = 'quick';
  let workspaceSelectedIndex = 0;
  let pendingLinkInsert = null;

  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    langPrefix: 'language-'
  });

  if (typeof window.TurndownService === 'function') {
    turndownService = new window.TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });
    turndownService.addRule('mark', {
      filter: ['mark'],
      replacement(content) {
        return content ? `==${content}==` : '';
      }
    });
    turndownService.addRule('taskCheckbox', {
      filter(node) {
        return node.nodeName === 'INPUT' && node.type === 'checkbox';
      },
      replacement(_content, node) {
        return node.checked ? '[x] ' : '[ ] ';
      }
    });
    turndownService.addRule('table', {
      filter: 'table',
      replacement(_content, table) {
        const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
          Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\|/g, '\\|'))
        ).filter((cells) => cells.length > 0);
        if (!rows.length) return '';
        const columnCount = Math.max(...rows.map((cells) => cells.length));
        const normalize = (cells) => Array.from({ length: columnCount }, (_, index) => cells[index] || '');
        const header = normalize(rows[0]);
        const separator = Array(columnCount).fill('---');
        const body = rows.slice(1).map(normalize);
        return `\n\n${[header, separator, ...body].map((cells) => `| ${cells.join(' | ')} |`).join('\n')}\n\n`;
      }
    });
  }

  restoreTheme();
  restoreExplorer();
  restoreSplit();
  restoreView();
  restoreWorkspaceSession();
  restoreDocuments();
  if (getCurrentDocument()) editor.focus();

  bindEditor();
  bindToolbar();
  bindFileActions();
  bindDivider();
  bindDragAndDrop();
  bindResponsiveToggle();
  bindAutosave();
  bindThemeToggle();
  bindAboutModal();
  bindDocumentTitle();
  bindDraftManager();
  bindFolderExplorer();
  bindPreviewLinks();
  bindExplorerControls();
  bindSynchronizedScrolling();
  bindWorkspace();
  bindVisualEditor();
  bindPersistenceLifecycle();
  restoreFolderConnection();

  function restoreTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    const theme = stored === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', theme);
    syncThemeToggle(theme);
  }

  function restoreSplit() {
    const stored = localStorage.getItem(SPLIT_KEY);
    if (stored) {
      const width = parseInt(stored, 10);
      if (!Number.isNaN(width)) {
        applySplitWidth(width);
      }
    }
  }

  function restoreExplorer() {
    const storedWidth = parseInt(localStorage.getItem(EXPLORER_WIDTH_KEY), 10);
    if (!Number.isNaN(storedWidth)) {
      const restoredWidth = Math.min(Math.max(storedWidth, 140), 480);
      root.style.setProperty('--explorer-width', `${restoredWidth}px`);
      if (explorerDivider) {
        explorerDivider.setAttribute('aria-valuenow', String(restoredWidth));
      }
    }
    const savedCollapsed = localStorage.getItem(EXPLORER_COLLAPSED_KEY);
    setExplorerCollapsed(savedCollapsed === null ? window.innerWidth <= 960 : savedCollapsed === 'true', false);
  }

  function restoreView() {
    const stored = localStorage.getItem(VIEW_KEY);
    setEditorView(stored === 'wysiwyg' || stored === 'live' ? 'wysiwyg' : stored === 'preview' ? 'preview' : stored === 'editor' ? 'editor' : 'split', false);
  }

  function restoreDocuments() {
    documents = {};
    currentDocumentId = null;
    let savedWithNoDocument = false;
    const isFirstRun = localStorage.getItem(DOCUMENTS_KEY) === null
      && localStorage.getItem(LEGACY_AUTOSAVE_KEY) === null;
    try {
      const raw = localStorage.getItem(DOCUMENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          savedWithNoDocument = parsed.currentId === null;
          if (parsed.documents && typeof parsed.documents === 'object') {
            Object.keys(parsed.documents).forEach((id) => {
              const doc = parsed.documents[id];
              if (!doc || typeof doc !== 'object') {
                return;
              }
              if (!doc.id || typeof doc.id !== 'string') {
                return;
              }
              const name = sanitizeName(doc.name || doc.fileName || generateUntitledName(), generateUntitledName());
              documents[doc.id] = {
                id: doc.id,
                name,
                content: typeof doc.content === 'string' ? doc.content : '',
                savedContent: typeof doc.savedContent === 'string' ? doc.savedContent : (typeof doc.content === 'string' ? doc.content : ''),
                openedContent: typeof doc.openedContent === 'string' ? doc.openedContent : (typeof doc.content === 'string' ? doc.content : ''),
                updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now(),
                folderId: typeof doc.folderId === 'string' ? doc.folderId : null,
                folderPath: typeof doc.folderPath === 'string' ? normalizeFolderPath(doc.folderPath) : null
              };
            });
          }
          if (parsed.currentId && typeof parsed.currentId === 'string' && documents[parsed.currentId]) {
            currentDocumentId = parsed.currentId;
          }
        }
      } else {
        migrateLegacyAutosave();
      }
    } catch (err) {
      console.warn('Document restore failed', err);
    }

    if ((!currentDocumentId || !documents[currentDocumentId]) && !savedWithNoDocument) {
      const ordered = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt);
      currentDocumentId = ordered.length > 0 ? ordered[0].id : null;
    }

    if (!currentDocumentId && isFirstRun) {
      setEditorView('split');
      currentDocumentId = createDocument(
        'Welcome.md',
        WELCOME_MARKDOWN,
        { persist: false, render: false, focus: false }
      );
    }

    if (currentDocumentId) setCurrentDocument(currentDocumentId, { focus: false, skipHistory: true });
    else showEmptyWorkspace({ render: false });
    if (isFirstRun) {
      saveDocumentsToStorage();
    }
    renderDraftList();
    updateStorageIndicator();
  }

  function migrateLegacyAutosave() {
    try {
      const raw = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
      if (!raw) {
        return;
      }
      const legacy = JSON.parse(raw);
      const content = legacy && typeof legacy.content === 'string' ? legacy.content : '';
      const name = sanitizeName(legacy && legacy.fileName ? legacy.fileName : generateUntitledName(), generateUntitledName());
      const id = createDocument(name, content, { persist: false, render: false, focus: false });
      const doc = documents[id];
      if (doc) {
        doc.updatedAt = legacy && typeof legacy.ts === 'number' ? legacy.ts : Date.now();
      }
      currentDocumentId = id;
      localStorage.removeItem(LEGACY_AUTOSAVE_KEY);
    } catch (err) {
      console.warn('Legacy autosave migration failed', err);
    }
  }

  function bindAutosave() {
    editor.addEventListener('input', () => {
      const doc = getCurrentDocument();
      if (doc) {
        doc.content = editor.value;
        doc.updatedAt = Date.now();
      }
      scheduleAutosave();
      schedulePreviewUpdate();
      persistWorkspaceSession();
    });
  }

  function scheduleAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    const documentId = currentDocumentId;
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = 0;
      const doc = documents[documentId];
      if (isFolderDocument(doc) && folderAutosaveEnabled) {
        autosaveFolderDocument(doc);
      } else {
        saveDocumentsToStorage();
        updateSaveStatusForCurrentDocument();
      }
    }, AUTOSAVE_DELAY);
    if (isFolderDocument(getCurrentDocument()) && !folderAutosaveEnabled) {
      setSaveStatus('Unsaved changes');
    } else {
      setSaveStatus(isFolderDocument(getCurrentDocument()) ? 'Saving to disk…' : 'Saving locally…');
    }
  }

  function schedulePreviewUpdate() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => {
      previewTimer = 0;
      updateActiveVaultIndex(false);
      updatePreview();
    }, 140);
  }

  function setSaveStatus(message, state = '') {
    if (!saveStatus) return;
    saveStatus.textContent = message;
    saveStatus.dataset.state = state;
  }

  function bindPersistenceLifecycle() {
    const flush = () => {
      if (autosaveTimer) window.clearTimeout(autosaveTimer);
      autosaveTimer = 0;
      saveDocumentsToStorage(false);
      persistWorkspaceSession();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', (event) => {
      if (!folderAutosaveEnabled && Object.values(documents).some(isDocumentDirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }

  function saveDocumentsToStorage(updateStatus = true) {
    try {
      const payload = JSON.stringify({ currentId: currentDocumentId, documents });
      localStorage.setItem(DOCUMENTS_KEY, payload);
      updateStorageIndicator(payload);
      if (updateStatus) setSaveStatus('Saved locally');
      return true;
    } catch (err) {
      console.warn('Autosave failed', err);
      setSaveStatus('Could not save locally', 'error');
      showToast('Could not save locally. Open Drafts to free storage.');
      return false;
    }
  }

  function isFolderDocument(doc) {
    return Boolean(doc && openedFolder && doc.folderPath
      && (doc.folderId === openedFolder.id || folderEntries.has(doc.folderPath)));
  }

  function isDocumentDirty(doc) {
    return Boolean(doc && isFolderDocument(doc) && doc.content !== doc.savedContent);
  }

  function updateSaveStatusForCurrentDocument() {
    const doc = getCurrentDocument();
    if (!isFolderDocument(doc)) {
      setSaveStatus('Saved locally');
    } else if (isDocumentDirty(doc)) {
      setSaveStatus('Unsaved changes');
    } else {
      setSaveStatus(folderAutosaveEnabled ? 'Saved to disk' : 'Saved');
    }
  }

  function updateFolderAutosaveControl() {
    if (!folderAutosaveToggle) return;
    const visible = Boolean(openedFolder);
    const writable = Boolean(openedFolder && openedFolder.handle);
    folderAutosaveToggle.hidden = !visible;
    folderAutosaveToggle.setAttribute('aria-pressed', String(folderAutosaveEnabled));
    folderAutosaveToggle.disabled = visible && !writable;
    folderAutosaveToggle.classList.toggle('is-unavailable', visible && !writable);
    const description = folderAutosaveEnabled ? 'Autosave to disk' : 'Keep changes locally until saved';
    folderAutosaveToggle.setAttribute('aria-label', description);
    folderAutosaveToggle.title = writable
      ? description
      : 'This browser opened the folder read-only; autosave to disk is unavailable';
  }

  async function autosaveFolderDocument(doc = getCurrentDocument()) {
    if (!isFolderDocument(doc) || !folderAutosaveEnabled) return false;
    const handle = fileHandles.get(doc.id);
    if (!handle) {
      setSaveStatus('Could not save to disk', 'error');
      return false;
    }
    const content = doc.content;
    try {
      await writeFile(handle, content);
      if (doc.content === content) doc.savedContent = content;
      saveDocumentsToStorage(false);
      if (doc.id === currentDocumentId) updateSaveStatusForCurrentDocument();
      return true;
    } catch (error) {
      console.error(error);
      if (doc.id === currentDocumentId) setSaveStatus('Could not save to disk', 'error');
      if (doc.id === currentDocumentId) showToast('Could not autosave to disk');
      return false;
    }
  }

  function getFolderState() {
    try {
      const raw = localStorage.getItem(FOLDER_STATE_KEY);
      const state = raw ? JSON.parse(raw) : null;
      if (!state || typeof state.id !== 'string' || typeof state.name !== 'string') {
        return null;
      }
      return {
        id: state.id,
        name: state.name,
        activePath: typeof state.activePath === 'string' ? normalizeFolderPath(state.activePath) : null,
        hasHandle: state.hasHandle === true
      };
    } catch (error) {
      console.warn('Folder state restore failed', error);
      return null;
    }
  }

  function saveFolderState() {
    if (!openedFolder) {
      return;
    }
    localStorage.setItem(FOLDER_STATE_KEY, JSON.stringify({
      id: openedFolder.id,
      name: openedFolder.name,
      activePath: activeFolderPath,
      hasHandle: Boolean(openedFolder.handle)
    }));
  }

  function openFolderDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }
      const request = window.indexedDB.open(FOLDER_DATABASE, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(FOLDER_STORE)) {
          database.createObjectStore(FOLDER_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open folder storage'));
    });
  }

  async function storeDirectoryHandle(folderId, handle) {
    const database = await openFolderDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FOLDER_STORE, 'readwrite');
      transaction.objectStore(FOLDER_STORE).put({ folderId, handle }, 'current');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Unable to remember folder'));
      };
    });
  }

  async function loadDirectoryHandle() {
    const database = await openFolderDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FOLDER_STORE, 'readonly');
      const request = transaction.objectStore(FOLDER_STORE).get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Unable to restore folder'));
      transaction.oncomplete = () => database.close();
    });
  }

  async function forgetDirectoryHandle() {
    const database = await openFolderDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(FOLDER_STORE, 'readwrite');
      transaction.objectStore(FOLDER_STORE).delete('current');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error || new Error('Unable to forget folder'));
      };
    });
  }

  async function restoreFolderConnection() {
    const state = getFolderState();
    if (!state) {
      return;
    }
    showRememberedFolder(state.name);
    if (!state.hasHandle) {
      return;
    }
    try {
      const saved = await loadDirectoryHandle();
      if (!saved || saved.folderId !== state.id || !saved.handle) {
        return;
      }
      rememberedDirectoryHandle = saved.handle;
      const permission = typeof saved.handle.queryPermission === 'function'
        ? await saved.handle.queryPermission({ mode: 'readwrite' })
        : 'granted';
      if (permission === 'granted') {
        await connectDirectoryHandle(saved.handle, state, false);
      }
    } catch (error) {
      console.warn('Folder connection restore failed', error);
    }
  }

  async function reconnectFolder() {
    const state = getFolderState();
    if (!state || !rememberedDirectoryHandle) {
      triggerOpenFolder({ reconnectState: state });
      return;
    }
    try {
      const permission = typeof rememberedDirectoryHandle.requestPermission === 'function'
        ? await rememberedDirectoryHandle.requestPermission({ mode: 'readwrite' })
        : 'granted';
      if (permission !== 'granted') {
        showToast('Folder access was not granted');
        return;
      }
      await connectDirectoryHandle(rememberedDirectoryHandle, state, true);
    } catch (error) {
      console.error(error);
      showToast('Unable to reconnect folder');
    }
  }

  async function connectDirectoryHandle(handle, state, notify) {
    const rootNode = await readDirectoryTree(handle, '');
    await activateFolder(rootNode, handle.name || state.name, handle, {
      id: state.id,
      initialPath: state.activePath,
      notify
    });
  }

  function showRememberedFolder(name) {
    if (!explorerEmpty) {
      return;
    }
    explorerName.textContent = name;
    explorerName.title = name;
    explorerEmpty.hidden = false;
    if (explorerEmptyMessage) {
      explorerEmptyMessage.textContent = `Reconnect to ${name} to restore the file tree.`;
    }
    if (explorerReconnect) {
      explorerReconnect.hidden = false;
    }
    if (explorerOpenFolder) {
      explorerOpenFolder.hidden = true;
    }
  }

  function clearCurrentDraft() {
    const doc = getCurrentDocument();
    if (!doc) return;
    if (isFolderDocument(doc)) {
      const restore = folderAutosaveEnabled ? doc.openedContent : doc.savedContent;
      const message = folderAutosaveEnabled
        ? `Revert “${doc.name}” to the version from when it was first opened? This will also write that version to disk.`
        : `Discard unsaved changes in “${doc.name}” and restore the last saved version?`;
      if (!window.confirm(message)) return;
      doc.content = restore;
      doc.updatedAt = Date.now();
      editor.value = restore;
      updatePreview();
      if (folderAutosaveEnabled) autosaveFolderDocument();
      else {
        saveDocumentsToStorage(false);
        updateSaveStatusForCurrentDocument();
      }
      showToast('Changes discarded');
      return;
    }
    if (!window.confirm(`Discard the local draft “${doc.name}”? This cannot be undone.`)) return;
    deleteDocument(currentDocumentId);
    showToast('Draft cleared');
  }

  function bindEditor() {
    editor.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      if (!modKey) {
        if (event.key === 'Tab') {
          handleTabKey(event);
          return;
        }
        if (event.key === 'Enter') {
          if (handleListEnter(event)) {
            return;
          }
        }
      }
      if (modKey) {
        switch (event.key.toLowerCase()) {
          case 'z':
            if (event.shiftKey) {
              if (performCommandRedo()) {
                event.preventDefault();
                return;
              }
            } else if (performCommandUndo()) {
              event.preventDefault();
              return;
            }
            break;
          case 'y':
            if (performCommandRedo()) {
              event.preventDefault();
              return;
            }
            break;
          case 'b':
            event.preventDefault();
            applyFormatting('bold');
            return;
          case 'i':
            event.preventDefault();
            applyFormatting('italic');
            return;
          case 'k':
            event.preventDefault();
            applyFormatting('link');
            return;
          case '1':
            event.preventDefault();
            applyFormatting('heading');
            return;
          case '`':
            event.preventDefault();
            applyFormatting('code');
            return;
          case 's':
            event.preventDefault();
            triggerSave();
            return;
          case 'o':
            event.preventDefault();
            if (openedFolder) {
              openWorkspaceModal('quick');
            } else {
              triggerOpen();
            }
            return;
        }
      }
    });

    editor.addEventListener('beforeinput', (event) => {
      if (event.defaultPrevented || isRestoring) {
        return;
      }
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        return;
      }
      pushUndoState(captureEditorState());
    });

    editor.addEventListener('paste', handlePaste);
  }

  function handlePaste(event) {
    if (!event || !event.clipboardData) {
      return;
    }
    const html = event.clipboardData.getData('text/html');
    const plainRaw = event.clipboardData.getData('text/plain');
    if (!html && !plainRaw) {
      return;
    }

    const normalize = (value) => (value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n');

    const plain = normalize(plainRaw);
    let markdown = '';
    let usedRichConversion = false;

    const containsCodeLikeMarkup = /<pre|<code|white-space\s*:\s*pre/i.test(html || '');

    if (turndownService && html && !containsCodeLikeMarkup) {
      try {
        markdown = normalize(turndownService.turndown(html));
        usedRichConversion = true;
      } catch (error) {
        console.warn('Rich text paste conversion failed', error);
        markdown = '';
        usedRichConversion = false;
      }
    }

    const hasIndent = (value) => /(^|\n)[ \t]+/.test(value || '');

    if (!markdown) {
      markdown = plain;
      usedRichConversion = false;
    } else if (plain && hasIndent(plain) && (!hasIndent(markdown) || containsCodeLikeMarkup)) {
      markdown = plain;
      usedRichConversion = false;
    }

    if (!markdown) {
      return;
    }

    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    ensureEditorFocus(start, end);
    replaceRange(start, end, markdown);
    const cursor = start + markdown.length;
    editor.setSelectionRange(cursor, cursor);
    showToast(usedRichConversion ? 'Converted rich text to Markdown' : 'Pasted with original spacing');
  }

  function bindToolbar() {
    if (!toolbars || toolbars.length === 0) {
      return;
    }
    toolbars.forEach((bar) => {
      bar.addEventListener('mousedown', (event) => {
        if (isVisualMode() && event.target.closest('button[data-action]')) {
          // Keep the document selection intact while a visual formatting button is clicked.
          event.preventDefault();
        }
      });
      bar.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
          return;
        }
        const action = button.dataset.action;
        if (isVisualMode()) {
          applyVisualFormatting(action);
          return;
        }
        if (action === 'undo') {
          triggerUndo(editor.selectionStart, editor.selectionEnd);
          return;
        }
        if (action === 'redo') {
          triggerRedo(editor.selectionStart, editor.selectionEnd);
          return;
        }
        applyFormatting(action);
        editor.focus();
      });
    });
  }

  function bindFileActions() {
    if (!fileActions) {
      return;
    }
    fileActions.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      switch (action) {
        case 'new':
          confirmNew();
          break;
        case 'open':
          triggerOpen();
          break;
        case 'openFolder':
          triggerOpenFolder();
          break;
        case 'graph':
          openGraphModal();
          break;
        case 'toggleExplorer':
          toggleExplorer();
          break;
        case 'save':
          triggerSave();
          break;
        case 'saveAs':
          triggerSaveAs();
          break;
        case 'exportHtml':
          exportHtml();
          break;
        case 'print':
          triggerPrint();
          break;
        case 'copyMd':
          copyMarkdown();
          break;
        case 'copyRich':
          copyRenderedHtml();
          break;
        case 'clearAutosave':
          clearCurrentDraft();
          break;
        case 'manageDrafts':
          openDraftManager();
          break;
        case 'livePreview':
          setEditorView(isVisualMode() ? 'split' : 'wysiwyg');
          break;
      }
      const menu = button.closest('.app-menu');
      if (menu) menu.open = false;
    });

    if (folderAutosaveToggle) {
      folderAutosaveToggle.addEventListener('click', () => {
        folderAutosaveEnabled = !folderAutosaveEnabled;
        localStorage.setItem(FOLDER_AUTOSAVE_KEY, String(folderAutosaveEnabled));
        updateFolderAutosaveControl();
        if (folderAutosaveEnabled && isDocumentDirty(getCurrentDocument())) autosaveFolderDocument();
        else updateSaveStatusForCurrentDocument();
      });
    }

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        const text = await file.text();
        importFileContent(text, file.name, null);
      }
      fileInput.value = '';
    });

    if (folderInput) {
      folderInput.addEventListener('change', async (event) => {
        const files = Array.from(event.target.files || []);
        const reconnectState = pendingFolderReconnectState;
        pendingFolderReconnectState = null;
        if (files.length > 0) {
          await openFallbackFolder(files, reconnectState);
        }
        folderInput.value = '';
      });
    }
  }

  function bindFolderExplorer() {
    if (!explorerTree) {
      return;
    }
    explorerTree.addEventListener('click', (event) => {
      const fileButton = event.target.closest('button[data-folder-path]');
      if (fileButton) {
        openFolderFile(fileButton.dataset.folderPath);
        return;
      }
      const directorySummary = event.target.closest('summary[data-directory-path]');
      if (directorySummary) {
        selectedFolderPath = directorySummary.dataset.directoryPath;
        syncFolderExplorerSelection();
      }
    });
    explorerTree.addEventListener('toggle', (event) => {
      const details = event.target;
      const summary = details && details.querySelector(':scope > summary[data-directory-path]');
      if (!summary) return;
      if (details.open) expandedFolderPaths.add(summary.dataset.directoryPath);
      else expandedFolderPaths.delete(summary.dataset.directoryPath);
    }, true);
    if (explorerReconnect) {
      explorerReconnect.addEventListener('click', reconnectFolder);
    }
    if (explorerOpenFolder) {
      explorerOpenFolder.addEventListener('click', () => triggerOpenFolder());
    }
    if (explorerDisconnect) {
      explorerDisconnect.addEventListener('click', disconnectFolder);
    }
  }

  function bindExplorerControls() {
    explorerToggles.forEach((button) => {
      if (button.closest('.file-toolbar')) {
        return;
      }
      button.addEventListener('click', toggleExplorer);
    });
    if (explorerNewFile) explorerNewFile.addEventListener('click', createFolderFile);
    if (!explorerDivider || !explorer) {
      return;
    }
    explorerDivider.addEventListener('mousedown', (event) => {
      if (main.classList.contains('explorer-collapsed')) {
        return;
      }
      isResizingExplorer = true;
      explorerStartX = event.clientX;
      explorerStartWidth = explorer.getBoundingClientRect().width;
      explorerDivider.classList.add('dragging');
      document.body.classList.add('resizing-explorer');
      document.addEventListener('mousemove', handleExplorerDragMove);
      document.addEventListener('mouseup', stopExplorerDragging);
      event.preventDefault();
    });
    explorerDivider.addEventListener('keydown', (event) => {
      const step = event.altKey ? 10 : 24;
      const current = explorer.getBoundingClientRect().width;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        applyExplorerWidth(current - step);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        applyExplorerWidth(current + step);
      }
    });
  }

  function handleExplorerDragMove(event) {
    if (!isResizingExplorer) {
      return;
    }
    applyExplorerWidth(explorerStartWidth + event.clientX - explorerStartX);
  }

  function stopExplorerDragging() {
    if (!isResizingExplorer) {
      return;
    }
    isResizingExplorer = false;
    explorerDivider.classList.remove('dragging');
    document.body.classList.remove('resizing-explorer');
    document.removeEventListener('mousemove', handleExplorerDragMove);
    document.removeEventListener('mouseup', stopExplorerDragging);
  }

  function applyExplorerWidth(width, persist = true) {
    if (!explorer) {
      return;
    }
    const min = 140;
    const available = main.clientWidth || window.innerWidth;
    const max = Math.max(min, Math.min(480, available - 240));
    const clamped = Math.min(Math.max(width, min), max);
    root.style.setProperty('--explorer-width', `${Math.round(clamped)}px`);
    if (explorerDivider) {
      explorerDivider.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
    if (persist) {
      localStorage.setItem(EXPLORER_WIDTH_KEY, String(Math.round(clamped)));
    }
    if (window.innerWidth > 960) {
      applySplitWidth(editorPane.getBoundingClientRect().width);
    }
  }

  function toggleExplorer() {
    setExplorerCollapsed(!main.classList.contains('explorer-collapsed'));
  }

  function setExplorerCollapsed(collapsed, persist = true) {
    main.classList.toggle('explorer-collapsed', collapsed);
    if (explorerDivider) {
      explorerDivider.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    }
    explorerToggles.forEach((button) => {
      button.setAttribute('aria-pressed', collapsed ? 'false' : 'true');
      button.setAttribute('aria-label', collapsed ? 'Show Explorer' : 'Hide Explorer');
      button.title = collapsed ? 'Show Explorer' : 'Hide Explorer';
      button.textContent = collapsed ? '›' : '‹';
    });
    if (persist) {
      localStorage.setItem(EXPLORER_COLLAPSED_KEY, String(collapsed));
    }
    window.requestAnimationFrame(restoreSplit);
  }

  function bindSynchronizedScrolling() {
    editor.addEventListener('scroll', () => { synchronizeEditorSyntaxScroll(); synchronizeScroll(editor, previewPane); });
    previewPane.addEventListener('scroll', () => synchronizeScroll(previewPane, editor));
  }

  function synchronizeScroll(source, target) {
    const pendingPosition = pendingSynchronizedScrolls.get(source);
    if (pendingPosition !== undefined) {
      pendingSynchronizedScrolls.delete(source);
      if (Math.abs(source.scrollTop - pendingPosition) <= 1) return;
    }
    if (!source.getClientRects().length || !target.getClientRects().length) {
      return;
    }
    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
    const targetPosition = targetRange > 0 ? progress * targetRange : 0;
    if (Math.abs(target.scrollTop - targetPosition) <= 1) return;
    pendingSynchronizedScrolls.set(target, targetPosition);
    target.scrollTop = targetPosition;
  }

  function bindPreviewLinks() {
    preview.addEventListener('click', (event) => {
      const externalMedia = event.target.closest('button[data-external-src]');
      if (externalMedia) {
        const image = document.createElement('img');
        image.src = externalMedia.dataset.externalSrc;
        image.alt = externalMedia.textContent.replace(/^Load external image:?\s*/i, '');
        externalMedia.replaceWith(image);
        return;
      }
      const link = event.target.closest('a[data-folder-path]');
      if (!link) {
        return;
      }
      event.preventDefault();
      openFolderFile(link.dataset.folderPath, link.dataset.folderFragment || '');
    });
  }

  function bindDivider() {
    divider.addEventListener('mousedown', (event) => {
      if (window.innerWidth <= 960) {
        return;
      }
      isResizing = true;
      startX = event.clientX;
      startWidth = editorPane.getBoundingClientRect().width;
      divider.classList.add('dragging');
      document.body.classList.add('dragging');
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', stopDragging);
      event.preventDefault();
    });

    divider.addEventListener('keydown', (event) => {
      if (window.innerWidth <= 960) {
        return;
      }
      const step = event.altKey ? 10 : 32;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const current = editorPane.getBoundingClientRect().width;
        applySplitWidth(current - step);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        const current = editorPane.getBoundingClientRect().width;
        applySplitWidth(current + step);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth <= 960) {
        divider.setAttribute('aria-hidden', 'true');
        applySplitWidth(0);
      } else {
        divider.removeAttribute('aria-hidden');
        restoreSplit();
      }
    });

    if (window.innerWidth <= 960) {
      divider.setAttribute('aria-hidden', 'true');
    }
  }

  function handleDragMove(event) {
    if (!isResizing) {
      return;
    }
    const delta = event.clientX - startX;
    applySplitWidth(startWidth + delta);
  }

  function stopDragging() {
    if (!isResizing) {
      return;
    }
    isResizing = false;
    divider.classList.remove('dragging');
    document.body.classList.remove('dragging');
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', stopDragging);
  }

  function applySplitWidth(width) {
    if (window.innerWidth <= 960) {
      editorPane.style.flex = "1 1 auto";
      previewPane.style.flex = "1 1 auto";
      return;
    }
    const min = 200;
    const available = workspacePanes ? workspacePanes.clientWidth : main.clientWidth;
    const max = Math.max(min, available - min);
    const clamped = Math.min(Math.max(width, min), max);
    editorPane.style.flex = `0 0 ${clamped}px`;
    previewPane.style.flex = '1 1 auto';
    localStorage.setItem(SPLIT_KEY, String(Math.round(clamped)));
  }

  function bindDragAndDrop() {
    ['dragenter', 'dragover'].forEach((type) => {
      main.addEventListener(type, (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        document.body.classList.add('dragging');
      });
    });

    ['dragleave', 'drop'].forEach((type) => {
      main.addEventListener(type, () => {
        document.body.classList.remove('dragging');
      });
    });

    main.addEventListener('drop', async (event) => {
      event.preventDefault();
      document.body.classList.remove('dragging');
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) {
        return;
      }
      const file = files[0];
      const text = await file.text();
      importFileContent(text, file.name, null);
    });
  }

  function bindResponsiveToggle() {
    responsiveToggle.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        setEditorView(view);
      });
    });

    window.addEventListener('resize', () => {
      const stored = localStorage.getItem(VIEW_KEY) || 'split';
      setEditorView(stored, false);
    });
  }

  function setEditorView(view, persist = true) {
    const chosen = ['split', 'wysiwyg', 'editor', 'preview'].includes(view) ? view : 'split';
    const wasVisual = isVisualMode();
    if (wasVisual && chosen !== 'wysiwyg') {
      syncVisualToMarkdown();
    }
    main.classList.toggle('wysiwyg-mode', chosen === 'wysiwyg');
    main.classList.remove('live-preview');
    main.classList.toggle('markdown-only', chosen === 'editor');
    main.classList.toggle('show-preview', chosen === 'preview');
    preview.contentEditable = chosen === 'wysiwyg' && getCurrentDocument() ? 'true' : 'false';
    preview.setAttribute('role', chosen === 'wysiwyg' ? 'textbox' : 'article');
    preview.setAttribute('aria-label', chosen === 'wysiwyg' ? 'Visual Markdown editor' : 'Markdown preview');
    preview.setAttribute('aria-live', 'off');
    if (persist) {
      sessionStorage.setItem(VIEW_KEY, chosen);
      localStorage.setItem(VIEW_KEY, chosen);
    }
    setResponsivePressed(chosen);
    if (wasVisual && chosen !== 'wysiwyg') {
      updatePreview();
    }
    if (chosen === 'wysiwyg' && getCurrentDocument()) {
      updatePreview();
      preview.querySelectorAll('li input[type="checkbox"]').forEach((checkbox) => {
        checkbox.disabled = false;
        checkbox.contentEditable = 'false';
      });
      window.requestAnimationFrame(() => preview.focus());
    }
  }

  function setResponsivePressed(view) {
    responsiveToggle.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.view === view ? 'true' : 'false');
    });
  }

  function bindWorkspace() {
    ensureWorkspaceTab(currentDocumentId);
    if (workspaceEmpty) {
      workspaceEmpty.addEventListener('click', (event) => {
        const action = event.target.closest('[data-empty-action]')?.dataset.emptyAction;
        if (action === 'new') createDocument(generateUntitledName(), '', { focus: true });
        if (action === 'drafts') openDraftManager();
        if (action === 'folder') triggerOpenFolder();
      });
    }
    if (workspaceTabs) {
      workspaceTabs.addEventListener('click', (event) => {
        const close = event.target.closest('[data-close-tab]');
        const tab = event.target.closest('[data-tab-id]');
        if (close) {
          event.stopPropagation();
          closeWorkspaceTab(close.dataset.closeTab);
        } else if (tab) {
          setCurrentDocument(tab.dataset.tabId);
        }
      });
      workspaceTabs.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const tabs = Array.from(workspaceTabs.querySelectorAll('[role="tab"]'));
        const index = tabs.indexOf(document.activeElement);
        if (index < 0 || !tabs.length) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus();
        setCurrentDocument(tabs[next].dataset.tabId);
      });
    }
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      const mod = navigator.platform.toUpperCase().includes('MAC') ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'o' && !event.shiftKey && openedFolder) { event.preventDefault(); openWorkspaceModal('quick'); }
      if (key === 'p' && !event.shiftKey) { event.preventDefault(); openWorkspaceModal('command'); }
      if (key === 'f' && event.shiftKey && openedFolder) { event.preventDefault(); openWorkspaceModal('search'); }
    });
    document.querySelectorAll('[data-context]').forEach((button) => {
      button.setAttribute('aria-controls', `context-${button.dataset.context}`);
      button.addEventListener('click', () => setContextPanel(button.dataset.context));
    });
    document.querySelectorAll('[data-action="toggleContext"]').forEach((button) => button.addEventListener('click', toggleContextSidebar));
    if (workspaceModal) {
      workspaceModal.addEventListener('click', (event) => { if (event.target.dataset.action === 'closeWorkspaceModal') closeWorkspaceModal(); });
    }
    if (graphModal) {
      graphModal.addEventListener('click', (event) => {
        if (event.target.dataset.action === 'closeGraphModal') closeGraphModal();
        const action = event.target.closest('[data-graph-action]')?.dataset.graphAction;
        if (action === 'zoomIn') graphView?.zoom(.75);
        if (action === 'zoomOut') graphView?.zoom(1.33);
        if (action === 'fit') graphView?.fit();
        if (action === 'current' && activeFolderPath) {
          selectGraphNode(activeFolderPath, true);
        }
      });
      document.getElementById('graph-labels').addEventListener('change', () => graphView?.refresh());
      const search = document.getElementById('graph-search');
      search.addEventListener('input', () => graphView?.highlight());
      search.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && search.value) { search.value = ''; graphView?.highlight(); event.stopPropagation(); }
        if (event.key === 'Enter') {
          const query = search.value.trim().toLowerCase();
          const match = graphView?.graph.nodes.find((node) => `${node.name} ${node.path}`.toLowerCase().includes(query));
          if (query && match) selectGraphNode(match.path, true);
        }
      });
      document.getElementById('graph-open-note').addEventListener('click', openSelectedGraphNote);
      graphModal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeGraphModal(); }
        if (event.key === 'Tab') {
          const focusable = Array.from(graphModal.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')).filter((element) => element.getClientRects().length);
          const first = focusable[0]; const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });
    }
    if (workspaceQuery) {
      workspaceQuery.addEventListener('input', () => { workspaceSelectedIndex = 0; renderWorkspaceResults(); });
      workspaceQuery.addEventListener('keydown', handleWorkspaceQueryKeydown);
    }
    if (workspaceResults) workspaceResults.addEventListener('click', (event) => {
      const result = event.target.closest('[data-result]'); if (result) activateWorkspaceResult(Number(result.dataset.result));
    });
    window.addEventListener('beforeunload', persistWorkspaceSession);
    renderWorkspace();
  }

  function restoreWorkspaceSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
      if (parsed && Array.isArray(parsed.tabs)) workspaceSession = { ...workspaceSession, ...parsed, tabs: parsed.tabs.filter((id) => typeof id === 'string') };
    } catch (error) { console.warn('Workspace restore failed', error); }
  }

  function persistWorkspaceSession() {
    if (currentDocumentId) captureWorkspacePosition(currentDocumentId);
    try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceSession)); } catch (error) { console.warn('Workspace save failed', error); }
  }

  function captureWorkspacePosition(id) {
    if (!id) return;
    workspaceSession.positions[id] = { start: editor.selectionStart, end: editor.selectionEnd, editorScroll: editor.scrollTop, previewScroll: previewPane.scrollTop };
  }

  function restoreWorkspacePosition(id) {
    const position = workspaceSession.positions[id];
    if (!position) return;
    window.requestAnimationFrame(() => {
      if (currentDocumentId !== id) return;
      editor.setSelectionRange(Math.min(position.start || 0, editor.value.length), Math.min(position.end || 0, editor.value.length));
      editor.scrollTop = position.editorScroll || 0; previewPane.scrollTop = position.previewScroll || 0;
      pendingSynchronizedScrolls.set(editor, editor.scrollTop);
      pendingSynchronizedScrolls.set(previewPane, previewPane.scrollTop);
    });
  }

  function ensureWorkspaceTab(id) {
    if (!id) return;
    if (!workspaceSession.tabs.includes(id)) workspaceSession.tabs.push(id);
    workspaceSession.activeTab = id;
    persistWorkspaceSession();
  }

  async function closeWorkspaceTab(id) {
    const index = workspaceSession.tabs.indexOf(id);
    if (index < 0) return;
    const doc = documents[id];
    const wasCurrent = currentDocumentId === id;
    if (wasCurrent) {
      if (isVisualMode() && !syncVisualToMarkdown()) return;
      doc.content = editor.value;
    }
    if (isDocumentDirty(doc) && !folderAutosaveEnabled) {
      const save = window.confirm(`“${doc.name}” has unsaved changes. Save before closing? Choose Cancel to close without saving.`);
      if (save && !await saveFolderDocument(doc)) return;
    }
    if (wasCurrent) {
      captureWorkspacePosition(id);
    }
    workspaceSession.tabs.splice(index, 1);
    if (wasCurrent) {
      const replacement = workspaceSession.tabs[index] || workspaceSession.tabs[index - 1] || null;
      workspaceSession.activeTab = replacement;
      if (replacement && documents[replacement]) setCurrentDocument(replacement);
      else showEmptyWorkspace();
    } else if (workspaceSession.activeTab === id) {
      workspaceSession.activeTab = currentDocumentId;
    }
    saveDocumentsToStorage(false);
    persistWorkspaceSession(); renderWorkspace();
  }

  function renderWorkspace() {
    const hasDocument = Boolean(getCurrentDocument());
    if (workspacePanes) {
      workspacePanes.hidden = !hasDocument;
      if (!hasDocument) workspacePanes.removeAttribute('aria-labelledby');
    }
    if (workspaceEmpty) workspaceEmpty.hidden = hasDocument;
    renderWorkspaceTabs();
    renderContextPanels();
  }

  function renderWorkspaceTabs() {
    if (!workspaceTabs) return;
    workspaceTabs.replaceChildren();
    workspaceSession.tabs = workspaceSession.tabs.filter((id) => documents[id]);
    workspaceTabs.hidden = workspaceSession.tabs.length === 0;
    workspaceSession.tabs.forEach((id) => {
      const doc = documents[id]; const tabGroup = document.createElement('div'); tabGroup.className = 'workspace-tab-group'; const tab = document.createElement('button');
      tab.type = 'button'; tab.id = `workspace-tab-${id}`; tab.className = 'workspace-tab'; tab.dataset.tabId = id; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(id === currentDocumentId)); tab.setAttribute('aria-controls', 'workspace-panes');
      const label = document.createElement('span'); label.className = 'workspace-tab__label'; label.textContent = doc.name.replace(/\.md$/i, '');
      const close = document.createElement('button'); close.type = 'button'; close.className = 'workspace-tab__close'; close.dataset.closeTab = id; close.setAttribute('aria-label', `Close ${doc.name}`); close.textContent = '×';
      tab.append(label); tabGroup.append(tab, close); workspaceTabs.appendChild(tabGroup);
      if (id === currentDocumentId && workspacePanes) workspacePanes.setAttribute('aria-labelledby', tab.id);
    });
  }

  function setContextPanel(name) {
    workspaceSession.context = ['outline', 'backlinks', 'graph'].includes(name) ? name : 'outline';
    if (contextRailLabel) contextRailLabel.textContent = workspaceSession.context;
    document.querySelectorAll('[data-context]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.context === workspaceSession.context)));
    document.querySelectorAll('.context-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== workspaceSession.context; });
    persistWorkspaceSession(); renderContextPanels();
  }

  function toggleContextSidebar() {
    workspaceSession.contextCollapsed = !workspaceSession.contextCollapsed;
    renderContextSidebarState();
    persistWorkspaceSession();
  }

  function renderContextPanels() {
    renderContextSidebarState();
    if (contextRailLabel) contextRailLabel.textContent = workspaceSession.context;
    document.querySelectorAll('[data-context]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.context === workspaceSession.context)));
    document.querySelectorAll('.context-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== workspaceSession.context; });
    renderOutline(); renderBacklinks(); renderGraph();
  }

  function renderContextSidebarState() {
    main.classList.toggle('context-collapsed', workspaceSession.contextCollapsed);
    document.querySelectorAll('[data-action="toggleContext"]').forEach((button) => {
      button.textContent = workspaceSession.contextCollapsed ? '‹' : '›';
      button.setAttribute('aria-label', workspaceSession.contextCollapsed ? 'Show note context' : 'Hide note context');
    });
  }

  function renderOutline() {
    if (!outlinePanel) return; outlinePanel.replaceChildren();
    const headings = Array.from(preview.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    if (!headings.length) { outlinePanel.innerHTML = '<p class="context-empty">No headings in this note.</p>'; return; }
    headings.forEach((heading) => { const button = document.createElement('button'); button.className = 'outline-item'; button.type = 'button'; button.style.paddingLeft = `${.35 + (Number(heading.tagName.slice(1)) - 1) * .7}rem`; button.textContent = heading.textContent; button.addEventListener('click', () => { const offset = heading.getBoundingClientRect().top - previewPane.getBoundingClientRect().top; previewPane.scrollTop += offset - 16; }); outlinePanel.appendChild(button); });
  }

  function renderBacklinks() {
    if (!backlinksPanel) return; backlinksPanel.replaceChildren();
    const currentPath = activeFolderPath; if (!currentPath || !vaultIndex.size) { backlinksPanel.innerHTML = '<p class="context-empty">Open a file within a folder to see backlinks.</p>'; return; }
    const matches = Array.from(vaultIndex.values()).filter((entry) => entry.path !== currentPath && entry.links.some((link) => link.path === currentPath));
    if (!matches.length) { backlinksPanel.innerHTML = '<p class="context-empty">No linked mentions.</p>'; return; }
    matches.forEach((entry) => { const button = document.createElement('button'); button.className = 'backlink-item'; button.type = 'button'; button.textContent = entry.name; const excerpt = document.createElement('small'); excerpt.textContent = entry.text.slice(0, 120); button.appendChild(excerpt); button.addEventListener('click', () => openFolderFile(entry.path)); backlinksPanel.appendChild(button); });
  }

  function renderGraph() {
    if (!graphPanel || workspaceSession.context !== 'graph' || workspaceSession.contextCollapsed) return;
    if (graphCache && graphPanel.childNodes.length && graphPanelCache === graphCache && graphPanelActivePath === activeFolderPath) return;
    graphPanel.replaceChildren();
    graphPanelCache = graphCache;
    graphPanelActivePath = activeFolderPath;
    if (!openedFolder) { graphPanel.innerHTML = '<p class="context-empty">Open a folder to explore its graph.</p>'; return; }
    if (!activeFolderPath) { graphPanel.innerHTML = '<p class="context-empty">Open a note to see its connected graph.</p>'; return; }
    const { graph, layout } = getFolderGraph();
    graphPanelCache = graphCache;
    const toolbar = document.createElement('div'); toolbar.className = 'graph-toolbar';
    const count = document.createElement('span'); count.textContent = `${graph.nodes.length} notes · ${graph.edges.length} links`;
    const open = document.createElement('button'); open.type = 'button'; open.className = 'graph-open-button'; open.textContent = 'Explore graph'; open.addEventListener('click', openGraphModal);
    toolbar.append(count, open);
    graphPanel.appendChild(toolbar);
    if (!graph.nodes.length) { graphPanel.insertAdjacentHTML('beforeend', '<p class="context-empty">This note is not in the open folder.</p>'); return; }
    const preview = createGraphSvg(graph, layout, { mini: true });
    preview.svg.addEventListener('click', openGraphModal);
    graphPanel.appendChild(preview.svg);
    preview.fit();
    const hint = document.createElement('p'); hint.className = 'graph-panel__hint'; hint.textContent = graph.nodes.length === 1 ? 'No links to other notes yet.' : 'This view follows links through the entire connected group.';
    graphPanel.appendChild(hint);
  }

  function getFolderGraph() {
    if (!graphCache || !graphCache.graph.byPath.has(activeFolderPath)) {
      const fullGraph = window.MarkdownGraph.build(vaultIndex.values());
      const graph = window.MarkdownGraph.connectedComponent(fullGraph, activeFolderPath);
      graphCache = { graph, layout: window.MarkdownGraph.layout(graph) };
    }
    return graphCache;
  }

  function createGraphSvg(graph, layout, options = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `graph-svg${options.mini ? ' graph-svg--mini' : ''}`);
    svg.setAttribute('role', options.mini ? 'img' : 'group');
    svg.setAttribute('aria-label', `Connected graph with ${graph.nodes.length} notes and ${graph.edges.length} links`);
    const bounds = layout.bounds;
    const view = { ...bounds };
    const edges = new Map(); const nodes = new Map(); const circles = new Map(); const labels = new Map();
    for (const edge of graph.edges) {
      const a = layout.positions.get(edge.source); const b = layout.positions.get(edge.target);
      const line = document.createElementNS(svg.namespaceURI, 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', 'graph-edge'); svg.appendChild(line);
      edges.set(JSON.stringify([edge.source, edge.target]), line);
    }
    for (const node of graph.nodes) {
      const point = layout.positions.get(node.path);
      const group = document.createElementNS(svg.namespaceURI, 'g');
      group.setAttribute('class', 'graph-node-group'); group.setAttribute('transform', `translate(${point.x} ${point.y})`);
      if (!options.mini) {
        const hit = document.createElementNS(svg.namespaceURI, 'circle'); hit.setAttribute('class', 'graph-hit'); group.appendChild(hit);
      }
      const circle = document.createElementNS(svg.namespaceURI, 'circle');
      circle.setAttribute('class', `graph-node${node.path === activeFolderPath ? ' graph-node--active' : ''}${node.degree ? '' : ' graph-node--orphan'}`);
      const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = `${node.path} · ${node.degree} connection${node.degree === 1 ? '' : 's'}`;
      group.append(circle, title);
      if (!options.mini) {
        group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
        group.setAttribute('aria-label', `${node.path}, ${node.degree} connections`);
        const label = document.createElementNS(svg.namespaceURI, 'text');
        label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'graph-label');
        const plainName = node.name.replace(/\.(?:md|markdown)$/i, '');
        label.textContent = plainName.length > 34 ? `${plainName.slice(0, 31)}…` : plainName;
        group.appendChild(label); labels.set(node.path, label);
        group.addEventListener('click', () => selectGraphNode(node.path));
        group.addEventListener('dblclick', openSelectedGraphNote);
        group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectGraphNode(node.path); } });
        group.addEventListener('pointerenter', () => { if (graphView) { graphView.hover = node.path; graphView.highlight(); } });
        group.addEventListener('pointerleave', () => { if (graphView) { graphView.hover = null; graphView.highlight(); } });
      }
      svg.appendChild(group); nodes.set(node.path, group); circles.set(node.path, circle);
    }
    function screenScale() {
      const rect = svg.getBoundingClientRect();
      return Math.max(.001, Math.min((rect.width || 900) / view.width, (rect.height || 600) / view.height));
    }
    function refreshLabels() {
      if (options.mini) return;
      const enabled = document.getElementById('graph-labels').checked;
      if (!enabled) { labels.forEach((label) => label.classList.remove('is-visible')); return; }
      const rect = svg.getBoundingClientRect(); const scale = screenScale();
      const offsetX = (rect.width - view.width * scale) / 2;
      const offsetY = (rect.height - view.height * scale) / 2;
      const query = document.getElementById('graph-search').value.trim().toLowerCase();
      const focus = graphView?.hover || graphSelection;
      const candidates = graph.nodes.map((node) => {
        const point = layout.positions.get(node.path);
        const label = labels.get(node.path);
        const match = query && `${node.name} ${node.path}`.toLowerCase().includes(query);
        return {
          path: node.path,
          x: (point.x - view.x) * scale + offsetX,
          y: (point.y - view.y) * scale + offsetY + Math.min(11, 6 + Math.sqrt(node.degree) * 1.3) + 3,
          width: Math.max(20, label.textContent.length * 7.2),
          height: 17,
          priority: node.path === graphView?.hover ? 120 : node.path === graphSelection ? 110 : match ? 100 : graph.neighbors.get(focus)?.has(node.path) ? 70 : node.degree * 2
        };
      });
      const visible = window.MarkdownGraph.pickLabels(candidates, rect.width, rect.height);
      labels.forEach((label, path) => label.classList.toggle('is-visible', visible.has(path)));
    }
    function refresh() {
      const scale = screenScale();
      for (const node of graph.nodes) {
        const radius = Math.min(11, 6 + Math.sqrt(node.degree) * 1.3);
        circles.get(node.path).setAttribute('r', String((options.mini ? Math.max(2.5, radius * .6) : radius) / scale));
        if (!options.mini) {
          nodes.get(node.path).querySelector('.graph-hit').setAttribute('r', String(17 / scale));
          const label = labels.get(node.path);
          label.setAttribute('font-size', String(12 / scale));
          label.setAttribute('y', String((radius + 17) / scale));
        }
      }
      refreshLabels();
    }
    function updateView() {
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
      refresh();
    }
    function fitBox(box) {
      const rect = svg.getBoundingClientRect();
      const aspect = Math.max(.5, (rect.width || 900) / (rect.height || 600));
      let width = Math.max(120, box.width); let height = Math.max(120, box.height);
      if (width / height < aspect) width = height * aspect;
      else height = width / aspect;
      view.x = box.x + (box.width - width) / 2;
      view.y = box.y + (box.height - height) / 2;
      view.width = width; view.height = height; updateView();
    }
    if (!options.mini) {
      let drag = null;
      svg.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.graph-node-group')) return;
        drag = { x: event.clientX, y: event.clientY, view: { ...view } };
        svg.setPointerCapture(event.pointerId);
        svg.classList.add('is-panning');
      });
      svg.addEventListener('pointermove', (event) => {
        if (!drag) return;
        const scale = screenScale();
        view.x = drag.view.x - (event.clientX - drag.x) / scale;
        view.y = drag.view.y - (event.clientY - drag.y) / scale;
        updateView();
      });
      const stopDrag = () => { drag = null; svg.classList.remove('is-panning'); };
      svg.addEventListener('pointerup', stopDrag); svg.addEventListener('pointercancel', stopDrag);
      svg.addEventListener('wheel', (event) => {
        event.preventDefault();
        const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
        const target = point.matrixTransform(svg.getScreenCTM().inverse());
        zoom(event.deltaY < 0 ? .85 : 1.18, target.x, target.y);
      }, { passive: false });
    }
    function zoom(factor, x = view.x + view.width / 2, y = view.y + view.height / 2) {
      const width = Math.max(70, Math.min(bounds.width * 4, view.width * factor));
      const height = view.height * width / view.width;
      view.x = x - (x - view.x) * width / view.width;
      view.y = y - (y - view.y) * height / view.height;
      view.width = width; view.height = height; updateView();
    }
    return {
      svg, graph, nodes, edges, hover: null, zoom, refresh,
      fit() { fitBox(bounds); },
      focus(path) {
        const point = layout.positions.get(path); if (!point) return;
        const points = [path, ...graph.neighbors.get(path)].map((member) => layout.positions.get(member));
        const xs = points.map((member) => member.x); const ys = points.map((member) => member.y);
        const left = Math.min(...xs) - 70; const top = Math.min(...ys) - 70;
        fitBox({ x: left, y: top, width: Math.max(...xs) - left + 70, height: Math.max(...ys) - top + 70 });
      },
      highlight() {
        const query = document.getElementById('graph-search').value.trim().toLowerCase();
        const focus = query ? null : this.hover || graphSelection;
        const nearby = focus ? graph.neighbors.get(focus) : null;
        for (const node of graph.nodes) {
          const element = nodes.get(node.path);
          const match = !query || `${node.name} ${node.path}`.toLowerCase().includes(query);
          element.classList.toggle('is-dimmed', !match || Boolean(this.hover && node.path !== focus && !nearby?.has(node.path)));
          element.classList.toggle('is-selected', node.path === graphSelection);
          element.classList.toggle('is-neighbor', Boolean(focus && nearby?.has(node.path)));
        }
        for (const edge of graph.edges) {
          const element = edges.get(JSON.stringify([edge.source, edge.target]));
          const searchDim = query && !(`${graph.byPath.get(edge.source).name} ${edge.source}`.toLowerCase().includes(query) || `${graph.byPath.get(edge.target).name} ${edge.target}`.toLowerCase().includes(query));
          element.classList.toggle('is-dimmed', Boolean(searchDim || (this.hover && edge.source !== focus && edge.target !== focus)));
          element.classList.toggle('is-emphasized', Boolean(focus && (edge.source === focus || edge.target === focus)));
        }
        refreshLabels();
      }
    };
  }

  function selectGraphNode(path, focus = false) {
    if (!graphView?.graph.byPath.has(path)) return;
    graphSelection = path;
    graphView.highlight();
    if (focus) graphView.focus(path);
    const node = graphView.graph.byPath.get(path);
    document.getElementById('graph-selection').textContent = `${node.path} · ${node.degree} connection${node.degree === 1 ? '' : 's'} · double-click to open`;
    document.getElementById('graph-open-note').disabled = false;
  }

  function renderGraphModal() {
    if (!graphModal || graphModal.hidden) return;
    const { graph, layout } = getFolderGraph();
    graphModalCanvas.replaceChildren(); graphView = null;
    document.getElementById('graph-modal-description').textContent = `${graph.nodes.length} related note${graph.nodes.length === 1 ? '' : 's'} · ${graph.edges.length} links`;
    if (!graph.nodes.length) {
      graphSelection = null;
      document.getElementById('graph-open-note').disabled = true;
      document.getElementById('graph-selection').textContent = 'Open a note from this folder to see its relations.';
      graphModalCanvas.innerHTML = '<p class="graph-empty">Open a note from this folder to see its relations.</p>';
    } else {
      graphView = createGraphSvg(graph, layout);
      graphModalCanvas.appendChild(graphView.svg);
      graphView.fit();
      if (graphSelection && graph.byPath.has(graphSelection)) selectGraphNode(graphSelection);
      else if (activeFolderPath && graph.byPath.has(activeFolderPath)) selectGraphNode(activeFolderPath);
      else { graphSelection = null; document.getElementById('graph-open-note').disabled = true; document.getElementById('graph-selection').textContent = 'Select a note to see its connections. Drag to pan · scroll to zoom.'; }
      graphView.highlight();
    }
  }
  function openGraphModal() {
    if (!graphModal || !openedFolder) { showToast('Open a folder to explore its graph'); return; }
    graphReturnFocus = document.activeElement;
    graphSelection = activeFolderPath;
    document.getElementById('graph-search').value = '';
    graphModal.hidden = false;
    renderGraphModal();
    if (typeof ResizeObserver === 'function') {
      graphResizeObserver = new ResizeObserver(() => graphView?.refresh());
      graphResizeObserver.observe(graphModalCanvas);
    }
    document.getElementById('graph-search').focus();
  }
  function closeGraphModal() {
    if (!graphModal) return;
    graphResizeObserver?.disconnect(); graphResizeObserver = null;
    graphModal.hidden = true; graphView = null;
    if (graphReturnFocus?.isConnected) graphReturnFocus.focus();
  }
  function openSelectedGraphNote() {
    if (!graphSelection) return;
    const path = graphSelection;
    closeGraphModal();
    openFolderFile(path);
  }

  function openWorkspaceModal(mode) { if (!workspaceModal || !workspaceQuery) return; workspaceMode = mode; workspaceSelectedIndex = 0; document.getElementById('workspace-modal-title').textContent = mode === 'command' ? 'Command palette' : mode === 'search' ? 'Search vault' : 'Quick switcher'; workspaceQuery.placeholder = mode === 'command' ? 'Type a command…' : mode === 'search' ? 'Search note contents…' : 'Search notes…'; workspaceQuery.value = ''; workspaceModal.hidden = false; renderWorkspaceResults(); workspaceQuery.focus(); }
  function closeWorkspaceModal() { if (workspaceModal) workspaceModal.hidden = true; editor.focus(); }
  function handleWorkspaceQueryKeydown(event) { const results = getWorkspaceResults(); if (event.key === 'Escape') { closeWorkspaceModal(); return; } if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); workspaceSelectedIndex = Math.max(0, Math.min(results.length - 1, workspaceSelectedIndex + (event.key === 'ArrowDown' ? 1 : -1))); renderWorkspaceResults(); } if (event.key === 'Enter') { event.preventDefault(); activateWorkspaceResult(workspaceSelectedIndex); } }
  function getWorkspaceResults() {
    const query = (workspaceQuery ? workspaceQuery.value : '').trim().toLowerCase();
    if (workspaceMode === 'command') return [{ label: 'New note', run: () => confirmNew() }, { label: 'Open folder', run: () => triggerOpenFolder() }, { label: 'Toggle file explorer', run: () => toggleExplorer() }, { label: 'Toggle note context', run: () => toggleContextSidebar() }, { label: 'Save current note', run: () => triggerSave() }].filter((item) => item.label.toLowerCase().includes(query));
    const entries = Array.from(vaultIndex.values()).filter((entry) => !query || (workspaceMode === 'search' ? entry.text.toLowerCase().includes(query) : `${entry.name} ${entry.path}`.toLowerCase().includes(query))).slice(0, 100);
    if (workspaceMode === 'link') {
      return entries.flatMap((entry) => [{ label: entry.name, detail: entry.path, run: () => insertVaultLink(entry.path) }, ...entry.headings.filter((heading) => !query || heading.toLowerCase().includes(query)).map((heading) => ({ label: `${entry.name} › ${heading}`, detail: entry.path, run: () => insertVaultLink(entry.path, heading) }))]);
    }
    return entries.map((entry) => ({ label: entry.name, detail: workspaceMode === 'search' ? entry.text.slice(0, 140) : entry.path, run: () => openFolderFile(entry.path) }));
  }
  function renderWorkspaceResults() { if (!workspaceResults) return; const results = getWorkspaceResults(); workspaceResults.replaceChildren(); if (!results.length) { workspaceResults.innerHTML = '<p class="context-empty">No results.</p>'; return; } results.forEach((result, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = `workspace-result${index === workspaceSelectedIndex ? ' is-active' : ''}`; button.dataset.result = String(index); button.setAttribute('role', 'option'); button.textContent = result.label; if (result.detail) { const detail = document.createElement('small'); detail.textContent = result.detail; button.appendChild(detail); } workspaceResults.appendChild(button); }); }
  function activateWorkspaceResult(index) { const result = getWorkspaceResults()[index]; if (!result) return; closeWorkspaceModal(); result.run(); }

  function openLinkPicker(text, start, end) { pendingLinkInsert = { text, start, end }; openWorkspaceModal('link'); document.getElementById('workspace-modal-title').textContent = 'Link to note'; workspaceQuery.placeholder = 'Search vault notes…'; renderWorkspaceResults(); }
  function insertVaultLink(targetPath, heading) { if (!pendingLinkInsert) return; const pending = pendingLinkInsert; pendingLinkInsert = null; const sourcePath = activeFolderPath || ''; const fragment = heading ? `#${slugifyHeading(heading)}` : ''; const href = `${relativeMarkdownPath(sourcePath, targetPath)}${fragment}`; ensureEditorFocus(pending.start, pending.end); const start = editor.selectionStart; replaceRange(start, editor.selectionEnd, `[${pending.text}](${href})`); editor.setSelectionRange(start + 1, start + 1 + pending.text.length); }
  function slugifyHeading(value) { return String(value).trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'); }
  function relativeMarkdownPath(fromPath, targetPath) { const from = fromPath ? fromPath.split('/').slice(0, -1) : []; const target = targetPath.split('/'); while (from.length && target.length && from[0] === target[0]) { from.shift(); target.shift(); } return `${from.map(() => '..').concat(target).join('/')}`.split('/').map(encodeURIComponent).join('/'); }

  async function rebuildVaultIndex() {
    vaultIndex = new Map(); graphCache = null; if (!openedFolder) return;
    const entries = Array.from(folderEntries.entries());
    const openDocsByPath = new Map(Object.values(documents)
      .filter((doc) => doc.folderId === openedFolder.id && doc.folderPath && folderEntries.has(doc.folderPath))
      .map((doc) => [doc.folderPath, doc]));
    await Promise.all(entries.map(async ([path, entry]) => {
      const openDoc = openDocsByPath.get(path);
      let content = openDoc ? openDoc.content : '';
      if (!openDoc) {
        try { const file = entry.handle ? await entry.handle.getFile() : entry.file; content = await file.text(); } catch (error) { console.warn(`Could not index ${path}`, error); }
      }
      vaultIndex.set(path, makeVaultIndexEntry(path, entry.name, content));
    }));
  }
  function updateActiveVaultIndex(shouldRender = true) {
    if (!activeFolderPath || !folderEntries.has(activeFolderPath)) return;
    const doc = getCurrentDocument();
    const previous = vaultIndex.get(activeFolderPath);
    const next = makeVaultIndexEntry(activeFolderPath, folderEntries.get(activeFolderPath).name, doc ? doc.content : editor.value);
    vaultIndex.set(activeFolderPath, next);
    if (!previous || previous.links.map((link) => link.path).join('\0') !== next.links.map((link) => link.path).join('\0')) graphCache = null;
    if (shouldRender) renderContextPanels();
  }
  function makeVaultIndexEntry(path, name, content) {
    const markdown = String(content || ''); const headings = [];
    markdown.replace(/^#{1,6}\s+(.+)$/gm, (_, heading) => { headings.push(heading.trim()); return _; });
    const links = window.MarkdownGraph.extractLinks(markdown, (href) => resolveVaultLink(path, href), (title) => resolveWikiLink(path, title), marked);
    return { path, name, headings, text: markdown.replace(/[`*_#>[\]()]/g, ' ').replace(/\s+/g, ' ').trim(), links };
  }
  function resolveWikiLink(fromPath, title) {
    if (!title) return null;
    const directory = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
    const local = resolveVaultLink(fromPath, title);
    if (local) return local;
    const root = resolveVaultLink('', title);
    if (root) return root;
    const wanted = title.replace(/\.(?:md|markdown)$/i, '').toLowerCase();
    const matches = Array.from(folderEntries.keys()).filter((path) => path.split('/').pop().replace(/\.(?:md|markdown)$/i, '').toLowerCase() === wanted);
    if (matches.length === 1) return { path: matches[0] };
    const nearby = matches.filter((path) => path.startsWith(`${directory}/`));
    return nearby.length === 1 ? { path: nearby[0] } : null;
  }
  function resolveVaultLink(fromPath, href) {
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) return null;
    const withoutHash = href.split('#')[0].split('?')[0]; const directory = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
    let decoded; try { decoded = decodeURIComponent(withoutHash); } catch (error) { return null; }
    const base = normalizeFolderPath(decoded.startsWith('/') ? decoded.slice(1) : `${directory}/${decoded}`); if (!base) return null;
    const candidates = /\.(?:md|markdown)$/i.test(base) ? [base] : [base, `${base}.md`, `${base}.markdown`];
    for (const candidate of candidates) { const resolved = folderPathLookup.get(candidate.toLowerCase()); if (resolved) return { path: resolved }; }
    return null;
  }

  function updatePreview() {
    updateEditorSyntax();
    const text = (editor.value || '').replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n');
    const html = marked.parse(splitYamlFrontmatter(text).content);
    const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    preview.innerHTML = clean;
    assignHeadingIds();
    transformMermaidCodeBlocks();
    promoteMultilineCode();
    if (window.hljs && typeof window.hljs.highlightElement === 'function') {
      preview.querySelectorAll('pre code').forEach((block) => {
        block.classList.add('hljs');
        window.hljs.highlightElement(block);
      });
    }
    enforceSafeLinks();
    protectExternalMedia();
    renderContextPanels();
    // Rebuilding the preview can clamp its scroll position. That is a layout
    // change, not a request to move the editor.
    pendingSynchronizedScrolls.set(previewPane, previewPane.scrollTop);
  }

  function splitYamlFrontmatter(markdown) {
    const match = String(markdown || '').match(/^(?:\uFEFF)?---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(?:\n|$)/);
    return match ? { frontmatter: match[0], content: markdown.slice(match[0].length) } : { frontmatter: '', content: markdown };
  }

  function updateEditorSyntax() {
    if (!editorSyntax) {
      return;
    }
    editorSyntax.innerHTML = highlightMarkdown(editor.value || '');
    synchronizeEditorSyntaxScroll();
  }

  function synchronizeEditorSyntaxScroll() {
    if (editorSyntax) {
      editorSyntax.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
    }
  }

  function escapeSyntaxHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightMarkdownInline(value) {
    return value.replace(/(`[^`]*`)|(\*\*|__)(.+?)\2|(\*|_)([^*_]+?)\4|(~~)(.+?)\6|(==)(.+?)\8|(!?\[[^\]]*\]\([^)]*\))/g,
      (match, code, strongMarker, strongText, emphasisMarker, emphasisText, strikeMarker, strikeText, highlightMarker, highlightText, link) => {
        if (code) return `<span class="syntax-code">${code}</span>`;
        if (strongMarker) return `<span class="syntax-marker">${strongMarker}</span><span class="syntax-strong">${strongText}</span><span class="syntax-marker">${strongMarker}</span>`;
        if (emphasisMarker) return `<span class="syntax-marker">${emphasisMarker}</span><span class="syntax-emphasis">${emphasisText}</span><span class="syntax-marker">${emphasisMarker}</span>`;
        if (strikeMarker) return `<span class="syntax-marker">${strikeMarker}</span><span class="syntax-emphasis">${strikeText}</span><span class="syntax-marker">${strikeMarker}</span>`;
        if (highlightMarker) return `<span class="syntax-marker">${highlightMarker}</span><span class="syntax-highlight">${highlightText}</span><span class="syntax-marker">${highlightMarker}</span>`;
        return `<span class="syntax-link">${link}</span>`;
      });
  }

  function highlightMarkdown(markdown) {
    let inCodeBlock = false;
    return markdown.replace(/\r\n?/g, '\n').split('\n').map((line) => {
      const escaped = escapeSyntaxHtml(line);
      if (/^\s*```/.test(line)) {
        inCodeBlock = !inCodeBlock;
        return `<span class="syntax-marker">${escaped}</span>`;
      }
      if (inCodeBlock) return `<span class="syntax-code-block">${escaped}</span>`;
      if (/^\s*&lt;!--/.test(escaped)) return `<span class="syntax-comment">${escaped}</span>`;
      const heading = escaped.match(/^(\s*)(#{1,6})(\s+)(.*)$/);
      if (heading) return `${heading[1]}<span class="syntax-marker">${heading[2]}</span>${heading[3]}<span class="syntax-heading">${highlightMarkdownInline(heading[4])}</span>`;
      const list = escaped.match(/^(\s*)((?:[-+*])|(?:\d+[.)]))(\s+)(.*)$/);
      if (list) return `${list[1]}<span class="syntax-list-marker">${list[2]}</span>${list[3]}${highlightMarkdownInline(list[4])}`;
      const quote = escaped.match(/^(\s*)(&gt;)(\s?)(.*)$/);
      if (quote) return `${quote[1]}<span class="syntax-marker">${quote[2]}</span>${quote[3]}${highlightMarkdownInline(quote[4])}`;
      return highlightMarkdownInline(escaped);
    }).join('\n');
  }

  function isVisualMode() {
    return main.classList.contains('wysiwyg-mode');
  }

  function bindVisualEditor() {
    preview.addEventListener('input', () => {
      if (isVisualMode() && !isSyncingVisual) {
        queueVisualSync();
      }
    });
    preview.addEventListener('keydown', (event) => {
      if (!isVisualMode()) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      if (!modKey && event.key === 'Tab' && handleVisualListIndent(event.shiftKey)) {
        event.preventDefault();
        return;
      }
      if (!modKey && event.key === 'Enter' && handleVisualTaskEnter()) {
        event.preventDefault();
        return;
      }
      if (!modKey && event.key === 'Backspace' && exitVisualEmptyTask()) {
        event.preventDefault();
        return;
      }
      if (!modKey && (event.key === ' ' || event.key === 'Spacebar') && startVisualHeadingFromMarker()) {
        event.preventDefault();
        return;
      }
      if (!modKey && (event.key === ' ' || event.key === 'Spacebar') && startVisualListFromMarker()) {
        event.preventDefault();
        return;
      }
      if (!modKey) {
        return;
      }
      if (event.key.toLowerCase() === 's') {
        // The visual editor owns keyboard focus, so it must intercept the
        // browser's native Save shortcut before it opens the download dialog.
        event.preventDefault();
        syncVisualToMarkdown();
        triggerSave();
        return;
      }
      const shortcuts = { b: 'bold', i: 'italic', k: 'link' };
      const action = shortcuts[event.key.toLowerCase()];
      if (action) {
        event.preventDefault();
        applyVisualFormatting(action);
      }
    });
    preview.addEventListener('blur', () => {
      if (isVisualMode()) {
        syncVisualToMarkdown();
      }
    });
    preview.addEventListener('change', (event) => {
      if (isVisualMode() && event.target.matches('input[type="checkbox"]')) queueVisualSync();
    });
  }

  function getVisualListItem() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !preview.contains(selection.anchorNode)) return null;
    const element = selection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode.parentElement;
    return element && element.closest ? element.closest('li') : null;
  }

  function placeVisualCaret(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    preview.focus();
  }

  function startVisualListFromMarker() {
    const block = getVisualBlockAtCaret();
    if (!block) return false;
    const marker = block.textContent.trim();
    const listName = marker === '-' || marker === '*' ? 'ul' : /^\d+\.$/.test(marker) ? 'ol' : '';
    if (!listName) return false;
    const list = document.createElement(listName);
    const item = document.createElement('li');
    list.appendChild(item);
    block.replaceWith(list);
    placeVisualCaret(item);
    queueVisualSync();
    return true;
  }

  function getVisualBlockAtCaret() {
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed || !selection.rangeCount || !preview.contains(selection.anchorNode)) return null;
    const element = selection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection.anchorNode.parentElement;
    const block = element && element.closest ? element.closest('p, div') : null;
    return block && block !== preview ? block : null;
  }

  function startVisualHeadingFromMarker() {
    const block = getVisualBlockAtCaret();
    if (!block) return false;
    const marker = block.textContent.trim();
    if (!/^#{1,6}$/.test(marker)) return false;
    const heading = document.createElement(`h${marker.length}`);
    block.replaceWith(heading);
    placeVisualCaret(heading);
    queueVisualSync();
    return true;
  }

  function handleVisualListIndent(outdent) {
    const item = getVisualListItem();
    if (!item) return false;
    const list = item.parentElement;
    if (!list || !/^(UL|OL)$/.test(list.tagName)) return false;
    if (outdent) {
      const parentItem = list.parentElement;
      const parentList = parentItem && parentItem.parentElement;
      if (!parentItem || parentItem.tagName !== 'LI' || !parentList || !/^(UL|OL)$/.test(parentList.tagName)) return true;
      parentList.insertBefore(item, parentItem.nextSibling);
      if (!list.children.length) list.remove();
    } else {
      const previous = item.previousElementSibling;
      if (!previous || previous.tagName !== 'LI') return true;
      let nested = Array.from(previous.children).find((child) => child.tagName === list.tagName);
      if (!nested) {
        nested = document.createElement(list.tagName.toLowerCase());
        previous.appendChild(nested);
      }
      nested.appendChild(item);
    }
    placeVisualCaret(item);
    queueVisualSync();
    return true;
  }

  function getVisualTaskCheckbox(item) {
    return item ? Array.from(item.children).find((child) => child.nodeName === 'INPUT' && child.type === 'checkbox') : null;
  }

  function ensureVisualTaskCheckbox(item) {
    let checkbox = getVisualTaskCheckbox(item);
    if (!checkbox) {
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.contentEditable = 'false';
      item.insertBefore(checkbox, item.firstChild);
      item.insertBefore(document.createTextNode(' '), checkbox.nextSibling);
    }
    checkbox.disabled = false;
    checkbox.contentEditable = 'false';
    return checkbox;
  }

  function handleVisualTaskEnter() {
    const item = getVisualListItem();
    const checkbox = getVisualTaskCheckbox(item);
    const list = item && item.parentElement;
    if (!checkbox || !list || !/^(UL|OL)$/.test(list.tagName)) return false;
    if (isVisualTaskEmpty(item)) return exitVisualEmptyTask(item);
    const next = document.createElement('li');
    ensureVisualTaskCheckbox(next);
    list.insertBefore(next, item.nextSibling);
    placeVisualCaret(next);
    queueVisualSync();
    return true;
  }

  function isVisualTaskEmpty(item) {
    return Array.from(item.childNodes).every((node) => {
      if (node.nodeType === Node.TEXT_NODE) return !node.textContent.trim();
      if (node.nodeType !== Node.ELEMENT_NODE) return true;
      if (node.nodeName === 'INPUT' && node.type === 'checkbox') return true;
      if (/^(UL|OL)$/.test(node.nodeName)) return true;
      return !node.textContent.trim();
    });
  }

  function exitVisualEmptyTask(existingItem) {
    const item = existingItem || getVisualListItem();
    const checkbox = getVisualTaskCheckbox(item);
    const list = item && item.parentElement;
    if (!checkbox || !list || !/^(UL|OL)$/.test(list.tagName) || !isVisualTaskEmpty(item)) return false;
    let rootList = list;
    while (rootList.parentElement && rootList.parentElement.nodeName === 'LI' && rootList.parentElement.parentElement && /^(UL|OL)$/.test(rootList.parentElement.parentElement.nodeName)) {
      rootList = rootList.parentElement.parentElement;
    }
    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createElement('br'));
    rootList.parentNode.insertBefore(paragraph, rootList.nextSibling);
    item.remove();
    let currentList = list;
    while (currentList && !currentList.children.length) {
      const parent = currentList.parentElement;
      currentList.remove();
      currentList = parent && /^(UL|OL)$/.test(parent.nodeName) ? parent : null;
    }
    placeVisualCaret(paragraph);
    queueVisualSync();
    return true;
  }

  function queueVisualSync() {
    window.clearTimeout(visualSyncTimer);
    visualSyncTimer = window.setTimeout(() => {
      visualSyncTimer = 0;
      syncVisualToMarkdown();
    }, 550);
  }

  function syncVisualToMarkdown() {
    window.clearTimeout(visualSyncTimer);
    visualSyncTimer = 0;
    if (!isVisualMode() || !turndownService) {
      return false;
    }
    let markdown;
    try {
      markdown = turndownService.turndown(preview.innerHTML).replace(/\r\n?/g, '\n');
    } catch (error) {
      console.warn('Visual editor conversion failed', error);
      return false;
    }
    const frontmatter = splitYamlFrontmatter(editor.value).frontmatter;
    markdown = frontmatter + markdown;
    if (markdown === editor.value) {
      return true;
    }
    isSyncingVisual = true;
    editor.value = markdown;
    const doc = getCurrentDocument();
    if (doc) {
      doc.content = markdown;
      doc.updatedAt = Date.now();
    }
    scheduleAutosave();
    updateActiveVaultIndex();
    isSyncingVisual = false;
    return true;
  }

  function applyVisualFormatting(action) {
    preview.focus();
    const command = (name, value = null) => document.execCommand(name, false, value);
    switch (action) {
      case 'undo': command('undo'); break;
      case 'redo': command('redo'); break;
      case 'bold': command('bold'); break;
      case 'italic': command('italic'); break;
      case 'strikethrough': command('strikeThrough'); break;
      case 'highlight': command('hiliteColor', '#fff2a8'); break;
      case 'heading': command('formatBlock', 'h1'); break;
      case 'ul': command('insertUnorderedList'); break;
      case 'ol': command('insertOrderedList'); break;
      case 'task': insertVisualTaskList(); return;
      case 'quote': command('formatBlock', 'blockquote'); break;
      case 'inlineCode': command('insertHTML', `<code>${escapeHtml(window.getSelection().toString() || 'code')}</code>`); break;
      case 'code': command('insertHTML', '<pre><code>code</code></pre>'); break;
      case 'link': {
        const url = window.prompt('Enter URL', 'https://');
        if (url) command('createLink', url);
        break;
      }
      case 'image': {
        const url = window.prompt('Enter image URL', 'https://');
        if (url) command('insertImage', url);
        break;
      }
      case 'table': command('insertHTML', '<table><thead><tr><th>Heading</th><th>Heading</th></tr></thead><tbody><tr><td>Text</td><td>Text</td></tr></tbody></table><p><br></p>'); break;
      default: return;
    }
    queueVisualSync();
  }

  function insertVisualTaskList() {
    const selection = window.getSelection();
    let items = getSelectedVisualListItems(selection);
    if (!items.length) {
      preview.focus();
      document.execCommand('insertUnorderedList');
      items = getSelectedVisualListItems(window.getSelection());
    }
    if (!items.length) {
      const list = document.createElement('ul');
      const item = document.createElement('li');
      list.appendChild(item);
      preview.appendChild(list);
      items = [item];
    }
    items.forEach(ensureVisualTaskCheckbox);
    placeVisualCaret(items[items.length - 1]);
    queueVisualSync();
  }

  function getSelectedVisualListItems(selection) {
    if (!selection || !selection.rangeCount || !preview.contains(selection.anchorNode)) return [];
    const range = selection.getRangeAt(0);
    const items = Array.from(preview.querySelectorAll('li')).filter((item) => range.intersectsNode(item));
    return items.length ? items : (getVisualListItem() ? [getVisualListItem()] : []);
  }

  function assignHeadingIds() {
    const used = new Set();
    preview.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      const base = (heading.id || heading.textContent || 'section')
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      let id = base || 'section';
      let suffix = 1;
      while (used.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      heading.id = id;
      used.add(id);
    });
  }

  function promoteMultilineCode() {
    preview.querySelectorAll('code').forEach((node) => {
      if (node.closest('pre')) {
        return;
      }
      if (!/\n/.test(node.textContent)) {
        return;
      }
      const pre = document.createElement('pre');
      const code = node.cloneNode(true);
      pre.appendChild(code);
      node.replaceWith(pre);
      const wrapper = pre.parentElement;
      if (wrapper && wrapper.tagName === 'P') {
        const hasOnlyWhitespace = Array.from(wrapper.childNodes).every((child) => {
          if (child === pre) {
            return true;
          }
          return child.nodeType === Node.TEXT_NODE && !child.textContent.trim();
        });
        if (hasOnlyWhitespace) {
          wrapper.replaceWith(pre);
        }
      }
    });
  }

  function enforceSafeLinks() {
    const links = preview.querySelectorAll('a');
    for (let i = 0; i < links.length; i += 1) {
      const link = links[i];
      const href = link.getAttribute('href') || '';
      const folderTarget = resolveFolderMarkdownLink(href);
      if (folderTarget) {
        link.dataset.folderPath = folderTarget.path;
        link.dataset.folderFragment = folderTarget.fragment;
        link.removeAttribute('target');
        link.removeAttribute('rel');
      } else if (href.startsWith('#')) {
        link.removeAttribute('target');
        link.removeAttribute('rel');
      } else {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noreferrer noopener');
      }
    }
  }

  function protectExternalMedia() {
    if (isVisualMode()) return;
    preview.querySelectorAll('img[src]').forEach((image) => {
      const source = image.getAttribute('src') || '';
      if (!/^https?:\/\//i.test(source)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'external-media-button';
      button.dataset.externalSrc = source;
      button.textContent = `Load external image${image.alt ? `: ${image.alt}` : ''}`;
      image.replaceWith(button);
    });
  }

  function resolveFolderMarkdownLink(href) {
    if (!openedFolder || !activeFolderPath || !href || href.startsWith('#')) {
      return null;
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
      return null;
    }
    const hashIndex = href.indexOf('#');
    const fragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
    const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    const pathPart = withoutHash.split('?')[0];
    if (!/\.(?:md|markdown)$/i.test(pathPart)) {
      return null;
    }
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathPart).replace(/\\/g, '/');
    } catch (error) {
      return null;
    }
    const currentDirectory = activeFolderPath.includes('/')
      ? activeFolderPath.slice(0, activeFolderPath.lastIndexOf('/'))
      : '';
    const candidate = decodedPath.startsWith('/')
      ? decodedPath.slice(1)
      : `${currentDirectory}/${decodedPath}`;
    const normalized = normalizeFolderPath(candidate);
    if (!normalized) {
      return null;
    }
    const resolvedPath = folderPathLookup.get(normalized.toLowerCase());
    if (!resolvedPath || !folderEntries.has(resolvedPath)) {
      return null;
    }
    return { path: resolvedPath, fragment };
  }

  function normalizeFolderPath(path) {
    const parts = [];
    const segments = String(path || '').replace(/\\/g, '/').split('/');
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment || segment === '.') {
        continue;
      }
      if (segment === '..') {
        if (parts.length === 0) {
          return '';
        }
        parts.pop();
      } else {
        parts.push(segment);
      }
    }
    return parts.join('/');
  }

  function transformMermaidCodeBlocks() {
    const blocks = Array.from(preview.querySelectorAll('pre code.language-mermaid'));
    if (blocks.length === 0) {
      return;
    }
    blocks.forEach((code) => {
      const pre = code.parentElement;
      const container = document.createElement('div');
      container.className = 'mermaid';
      container.textContent = code.textContent || '';
      pre.replaceWith(container);
    });
    renderMermaidDiagrams();
  }

  function renderMermaidDiagrams() {
    if (!window.mermaid || typeof window.mermaid.run !== 'function') {
      console.warn('Mermaid library not loaded; skipping diagram render');
      return;
    }
    const theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme
      });
      window.mermaid.run({ nodes: preview.querySelectorAll('.mermaid') });
    } catch (error) {
      console.warn('Mermaid rendering failed', error);
    }
  }

  function applyFormatting(action) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    ensureEditorFocus(start, end);
    const value = editor.value;
    const selected = value.slice(start, end);

    switch (action) {
      case 'undo':
        triggerUndo(start, end);
        return;
      case 'redo':
        triggerRedo(start, end);
        return;
      case 'bold':
        wrapSelection('**', '**', 'bold text');
        break;
      case 'italic':
        wrapSelection('_', '_', 'italic text');
        break;
      case 'inlineCode':
        wrapSelection('`', '`', 'code');
        break;
      case 'highlight':
        wrapSelection('<mark>', '</mark>', 'highlight');
        break;
      case 'strikethrough':
        wrapSelection('~~', '~~', 'strikethrough');
        break;
      case 'heading':
        toggleHeading();
        break;
      case 'code':
        insertFence();
        break;
      case 'link':
        insertLink(selected, start, end);
        break;
      case 'image':
        insertImage(selected, start, end);
        break;
      case 'ul':
        prefixLines('- ');
        break;
      case 'ol':
        prefixOrdered();
        break;
      case 'quote':
        prefixLines('> ');
        break;
      case 'table':
        insertTable();
        break;
      case 'task':
        prefixLines('- [ ] ');
        break;
      default:
        return;
    }
  }

  function ensureEditorFocus(selectionStart, selectionEnd) {
    if (document.activeElement !== editor) {
      editor.focus();
    }
    editor.setSelectionRange(selectionStart, selectionEnd);
  }

  function captureEditorState() {
    return {
      value: editor.value,
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      scrollTop: editor.scrollTop
    };
  }

  function restoreEditorState(state) {
    if (!state) {
      return;
    }
    isRestoring = true;
    editor.value = typeof state.value === 'string' ? state.value : editor.value;
    editor.scrollTop = typeof state.scrollTop === 'number' ? state.scrollTop : editor.scrollTop;
    const valueLength = editor.value.length;
    const clamp = (pos, fallback) => {
      if (typeof pos !== 'number' || Number.isNaN(pos)) {
        return fallback;
      }
      return Math.min(Math.max(0, pos), valueLength);
    };
    const start = clamp(state.selectionStart, valueLength);
    const end = clamp(state.selectionEnd, start);
    editor.setSelectionRange(start, end);
    isRestoring = false;
    dispatchInputEvent();
  }

  function trimHistory(stack) {
    while (stack.length > COMMAND_UNDO_LIMIT) {
      stack.shift();
    }
  }

  function clearRedoHistory() {
    commandRedoStack.length = 0;
  }

  function pushUndoState(state, options = {}) {
    if (!state) {
      return;
    }
    const last = commandUndoStack[commandUndoStack.length - 1];
    if (last && last.value === state.value && last.selectionStart === state.selectionStart && last.selectionEnd === state.selectionEnd) {
      return;
    }
    commandUndoStack.push(state);
    if (!options.preserveRedo) {
      clearRedoHistory();
    }
    trimHistory(commandUndoStack);
  }

  function pushRedoState(state) {
    if (!state) {
      return;
    }
    const last = commandRedoStack[commandRedoStack.length - 1];
    if (last && last.value === state.value && last.selectionStart === state.selectionStart && last.selectionEnd === state.selectionEnd) {
      return;
    }
    commandRedoStack.push(state);
    trimHistory(commandRedoStack);
  }

  function triggerUndo(selectionStart, selectionEnd) {
    ensureEditorFocus(selectionStart, selectionEnd);
    if (performCommandUndo()) {
      return;
    }
    let undone = false;
    if (typeof document.queryCommandSupported === 'function' && document.queryCommandSupported('undo')) {
      undone = document.execCommand('undo');
    } else if (typeof document.execCommand === 'function') {
      undone = document.execCommand('undo');
    }
    if (!undone) {
      console.warn('Undo command not supported');
    }
    window.requestAnimationFrame(() => {
      updatePreview();
    });
  }

  function triggerRedo(selectionStart, selectionEnd) {
    ensureEditorFocus(selectionStart, selectionEnd);
    if (performCommandRedo()) {
      return;
    }
    let redone = false;
    if (typeof document.queryCommandSupported === 'function' && document.queryCommandSupported('redo')) {
      redone = document.execCommand('redo');
    } else if (typeof document.execCommand === 'function') {
      redone = document.execCommand('redo');
    }
    if (!redone) {
      console.warn('Redo command not supported');
    }
    window.requestAnimationFrame(() => {
      updatePreview();
    });
  }

  function performCommandUndo() {
    if (commandUndoStack.length === 0) {
      return false;
    }
    const previous = commandUndoStack.pop();
    pushRedoState(captureEditorState());
    restoreEditorState(previous);
    return true;
  }

  function performCommandRedo() {
    if (commandRedoStack.length === 0) {
      return false;
    }
    const next = commandRedoStack.pop();
    pushUndoState(captureEditorState(), { preserveRedo: true });
    restoreEditorState(next);
    return true;
  }

  function wrapSelection(before, after, placeholder) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const hasSelection = start !== end;
    let selected = value.slice(start, end);

    if (!hasSelection) {
      selected = placeholder;
      const insertion = `${before}${selected}${after}`;
      replaceRange(start, end, insertion);
      const cursor = start + before.length;
      editor.setSelectionRange(cursor, cursor + selected.length);
      return;
    }

    if (selected.startsWith(before) && selected.endsWith(after)) {
      const inner = selected.slice(before.length, selected.length - after.length);
      replaceRange(start, end, inner);
      editor.setSelectionRange(start, start + inner.length);
      return;
    }

    const beforeStart = start - before.length;
    const afterEnd = end + after.length;
    if (beforeStart >= 0 && value.slice(beforeStart, start) === before && value.slice(end, afterEnd) === after) {
      replaceRange(beforeStart, afterEnd, selected);
      editor.setSelectionRange(beforeStart, beforeStart + selected.length);
      return;
    }

    const newText = `${before}${selected}${after}`;
    replaceRange(start, end, newText);
    const cursor = start + before.length;
    editor.setSelectionRange(cursor, cursor + selected.length);
  }

  function toggleHeading() {
    const start = editor.selectionStart;
    const value = editor.value;
    const lineInfo = getCurrentLine(value, start);
    const { lineStart, lineText } = lineInfo;
    const trimmed = lineText.replace(/^#+\s*/, '');
    const newLine = `# ${trimmed}`;
    replaceRange(lineStart, lineStart + lineText.length, newLine);
    const cursor = lineStart + 2;
    editor.setSelectionRange(cursor, cursor + trimmed.length);
  }

  function insertFence() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const selected = value.slice(start, end) || 'code';
    const opener = '\n\n```\n';
    const closer = '\n```\n';
    const fence = `${opener}${selected}${closer}`;
    replaceRange(start, end, fence);
    const cursorStart = start + opener.length;
    const cursorEnd = cursorStart + selected.length;
    editor.setSelectionRange(cursorStart, cursorEnd);
  }

  function insertLink(selectedText, originalStart, originalEnd) {
    const text = selectedText || 'link text';
    if (openedFolder && vaultIndex.size) {
      openLinkPicker(text, originalStart, originalEnd);
      return;
    }
    const url = window.prompt('Enter URL', 'https://');
    if (!url) {
      return;
    }
    ensureEditorFocus(originalStart, originalEnd);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const markdown = `[${text}](${url})`;
    replaceRange(start, end, markdown);
    const cursor = start + 1;
    editor.setSelectionRange(cursor, cursor + text.length);
  }

  function insertImage(selectedText, originalStart, originalEnd) {
    const initialAlt = selectedText && selectedText.trim() ? selectedText.trim() : '';
    const alt = initialAlt || window.prompt('Enter alt text', 'Image description') || 'Image';
    const url = window.prompt('Enter image URL', 'https://');
    if (!url) {
      return;
    }
    ensureEditorFocus(originalStart, originalEnd);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const markdown = `![${alt}](${url})`;
    replaceRange(start, end, markdown);
    const cursor = start + 2;
    editor.setSelectionRange(cursor, cursor + alt.length);
  }

  function prefixLines(prefix) {
    const selection = getSelectedLines();
    const prefixed = selection.lines.map((line) => {
      if (line.startsWith(prefix)) {
        return line;
      }
      return `${prefix}${line.replace(/^\s+/, '')}`;
    });
    replaceRange(selection.start, selection.end, prefixed.join('\n'));
    editor.setSelectionRange(selection.start, selection.start + prefixed.join('\n').length);
  }

  function prefixOrdered() {
    const selection = getSelectedLines();
    const prefixed = selection.lines.map((line, index) => {
      const trimmed = line.trim();
      return `${index + 1}. ${trimmed.replace(/^\d+\.\s+/, '')}`;
    });
    replaceRange(selection.start, selection.end, prefixed.join('\n'));
    editor.setSelectionRange(selection.start, selection.start + prefixed.join('\n').length);
  }

  function insertTable() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const template = '| Column 1 | Column 2 |\n| --- | --- |\n| Text | Text |\n';
    replaceRange(start, end, template);
    editor.setSelectionRange(start + 2, start + 10);
  }

  function replaceRange(start, end, text) {
    const previousValue = editor.value;
    const currentSlice = previousValue.slice(start, end);
    const shouldRecord = !isRestoring && currentSlice !== text;
    if (shouldRecord) {
      pushUndoState(captureEditorState());
    }

    if (typeof editor.setRangeText === 'function') {
      editor.setSelectionRange(start, end);
      editor.setRangeText(text, start, end, 'select');
      dispatchInputEvent();
    } else {
      editor.value = previousValue.slice(0, start) + text + previousValue.slice(end);
      dispatchInputEvent();
    }
  }

  function dispatchInputEvent() {
    const event = typeof window.InputEvent === 'function'
      ? new window.InputEvent('input', { bubbles: true })
      : new Event('input', { bubbles: true });
    editor.dispatchEvent(event);
  }

  function clearCommandHistory() {
    commandUndoStack.length = 0;
    clearRedoHistory();
  }

  function getCurrentLine(value, position) {
    let lineStart = value.lastIndexOf('\n', position - 1);
    if (lineStart === -1) {
      lineStart = 0;
    } else {
      lineStart += 1;
    }
    let lineEnd = value.indexOf('\n', position);
    if (lineEnd === -1) {
      lineEnd = value.length;
    }
    return {
      lineStart,
      lineEnd,
      lineText: value.slice(lineStart, lineEnd)
    };
  }

  function getSelectedLines() {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    let lineStart = value.lastIndexOf('\n', start - 1);
    if (lineStart === -1) {
      lineStart = 0;
    } else {
      lineStart += 1;
    }
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) {
      lineEnd = value.length;
    }
    const slice = value.slice(lineStart, lineEnd);
    return {
      start: lineStart,
      end: lineEnd,
      lines: slice.split('\n')
    };
  }

  function parseListLine(line) {
    const match = /^(\s*)([*+-]|\d+\.)(\s+\[(?: |x|X)\])?\s*(.*)$/.exec(line || '');
    if (!match) {
      return null;
    }
    return {
      indent: match[1] || '',
      marker: match[2],
      checkbox: match[3] ? match[3].trim() : '',
      content: match[4] || ''
    };
  }

  function handleTabKey(event) {
    const selectionInfo = getSelectedLines();
    const originalStart = editor.selectionStart;
    const originalEnd = editor.selectionEnd;
    event.preventDefault();
    if (event.shiftKey) {
      outdentSelection(selectionInfo, originalStart, originalEnd);
    } else {
      indentSelection(selectionInfo, originalStart, originalEnd);
    }
  }

  function indentSelection(selectionInfo, originalStart, originalEnd, indent = '  ') {
    const { start, end, lines } = selectionInfo;
    const indented = lines.map((line) => `${indent}${line}`);
    replaceRange(start, end, indented.join('\n'));
    const lineCount = lines.length;
    const newStart = originalStart + indent.length;
    const newEnd = originalEnd + indent.length * lineCount;
    editor.setSelectionRange(newStart, newEnd);
  }

  function outdentSelection(selectionInfo, originalStart, originalEnd, size = 2) {
    const { start, end, lines } = selectionInfo;
    const outdented = [];
    const removedCounts = [];
    lines.forEach((line) => {
      let removed = 0;
      if (/^\t/.test(line)) {
        removed = size;
        outdented.push(line.replace(/^\t/, ''));
      } else {
        const match = line.match(/^ {1,}/);
        removed = match ? Math.min(size, match[0].length) : 0;
        outdented.push(line.slice(removed));
      }
      removedCounts.push(removed);
    });
    replaceRange(start, end, outdented.join('\n'));
    const totalRemoved = removedCounts.reduce((sum, value) => sum + value, 0);
    const newStart = Math.max(start, originalStart - (removedCounts[0] || 0));
    const newEnd = Math.max(newStart, originalEnd - totalRemoved);
    editor.setSelectionRange(newStart, newEnd);
  }

  function handleListEnter(event) {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      return false;
    }
    if (editor.selectionStart !== editor.selectionEnd) {
      return false;
    }
    const cursor = editor.selectionStart;
    const value = editor.value;
    const line = getCurrentLine(value, cursor);
    const parsed = parseListLine(line.lineText);
    if (!parsed) {
      return false;
    }
    event.preventDefault();
    const prefix = `${parsed.indent}${parsed.marker} ${parsed.checkbox ? `${parsed.checkbox} ` : ''}`;
    const remaining = line.lineText.slice(prefix.length).trim();
    if (!remaining) {
      replaceRange(line.lineStart, line.lineEnd, '');
      const nextPos = line.lineStart;
      editor.setSelectionRange(nextPos, nextPos);
      return true;
    }
    const insertion = `\n${prefix}`;
    replaceRange(cursor, cursor, insertion);
    const nextCursor = cursor + insertion.length;
    editor.setSelectionRange(nextCursor, nextCursor);
    return true;
  }

  function getCurrentDocument() {
    if (!currentDocumentId || !documents[currentDocumentId]) {
      return null;
    }
    return documents[currentDocumentId];
  }

  function showEmptyWorkspace(options = {}) {
    currentDocumentId = null;
    workspaceSession.activeTab = null;
    activeFolderPath = null;
    currentFileHandle = null;
    currentFileName = 'Untitled.md';
    editor.value = '';
    editor.disabled = true;
    preview.replaceChildren();
    preview.contentEditable = 'false';
    if (editorSyntax) editorSyntax.textContent = '';
    if (previewTimer) window.clearTimeout(previewTimer);
    previewTimer = 0;
    clearCommandHistory();
    toolbars.forEach((bar) => bar.querySelectorAll('button[data-action]').forEach((button) => { button.disabled = true; }));
    updateDocumentTitle();
    setSaveStatus('No document open');
    if (options.render !== false) renderWorkspace();
    renderDraftList();
  }

  function setCurrentDocument(id, options = {}) {
    const doc = id && documents[id] ? documents[id] : null;
    if (!doc) {
      return;
    }
    if (currentDocumentId && currentDocumentId !== id) {
      captureWorkspacePosition(currentDocumentId);
    }
    currentDocumentId = id;
    editor.disabled = false;
    preview.contentEditable = isVisualMode() ? 'true' : 'false';
    toolbars.forEach((bar) => bar.querySelectorAll('button[data-action]').forEach((button) => { button.disabled = false; }));
    activeFolderPath = folderPathsByDocumentId.get(id)
      || (openedFolder && doc.folderId === openedFolder.id ? doc.folderPath : null)
      || null;
    if (activeFolderPath) {
      selectedFolderPath = getFolderParentPath(activeFolderPath);
    }
    editor.value = doc.content || '';
    clearCommandHistory();
    updatePreview();
    currentFileName = doc.name || 'Untitled.md';
    currentFileHandle = fileHandles.get(id) || null;
    updateDocumentTitle();
    syncFolderExplorerSelection();
    ensureWorkspaceTab(id);
    renderWorkspace();
    restoreWorkspacePosition(id);
    if (options.focus !== false) {
      (isVisualMode() ? preview : editor).focus();
    }
    if (options.render !== false) {
      renderDraftList();
    }
    updateSaveStatusForCurrentDocument();
  }

  function updateDocumentTitle() {
    if (!docTitleInput) {
      return;
    }
    const doc = getCurrentDocument();
    docTitleInput.value = doc ? doc.name : 'No document open';
    docTitleInput.disabled = !doc;
    docTitleInput.title = doc ? doc.name : '';
  }

  function createDocument(name, content, options = {}) {
    const opts = {
      makeCurrent: true,
      persist: true,
      render: true,
      focus: true,
      extension: '.md',
      ...options
    };
    const fallback = generateUntitledName(opts.extension);
    const sanitized = sanitizeName(typeof name === 'string' ? name : '', fallback);
    const resolvedName = resolveNameConflict(sanitized, null);
    const id = typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `doc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
    documents[id] = {
      id,
      name: resolvedName,
      content: typeof content === 'string' ? content : '',
      savedContent: typeof content === 'string' ? content : '',
      openedContent: typeof content === 'string' ? content : '',
      updatedAt: Date.now()
    };
    fileHandles.delete(id);
    if (opts.makeCurrent) {
      setCurrentDocument(id, { focus: opts.focus, render: opts.render });
    } else if (opts.render) {
      renderDraftList();
    }
    if (opts.persist) {
      saveDocumentsToStorage();
    }
    return id;
  }

  function deleteDocument(id, options = {}) {
    if (!id || !documents[id]) {
      return;
    }
    fileHandles.delete(id);
    const folderPath = folderPathsByDocumentId.get(id);
    if (folderPath) {
      folderDocumentIds.delete(folderPath);
      folderPathsByDocumentId.delete(id);
    }
    delete documents[id];
    let nextId = currentDocumentId;
    if (currentDocumentId === id) {
      const remaining = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt);
      if (remaining.length > 0) {
        nextId = remaining[0].id;
        setCurrentDocument(nextId, { focus: options.focus !== false, render: options.render !== false });
      } else {
        const newId = createDocument(generateUntitledName(), '', { persist: false, render: options.render !== false, focus: options.focus !== false });
        nextId = newId;
      }
    } else if (options.refreshCurrent) {
      setCurrentDocument(currentDocumentId, { focus: false, render: options.render !== false });
    }
    if (options.persist !== false) {
      saveDocumentsToStorage();
    }
    if (options.render !== false) {
      renderDraftList();
    }
  }

  function renameDocument(id, proposedName, options = {}) {
    const doc = id && documents[id] ? documents[id] : null;
    if (!doc) {
      return '';
    }
    const notify = options.notify !== false;
    const fallback = doc.name || generateUntitledName();
    const raw = typeof proposedName === 'string' ? proposedName.trim() : '';
    const sanitized = sanitizeName(raw || fallback, fallback);
    const currentExt = splitName(doc.name).ext || '.md';
    let candidate = sanitized;
    if (!/\.[^.]+$/.test(candidate)) {
      candidate = sanitizeName(`${candidate}${currentExt || '.md'}`, `${splitName(doc.name).base}${currentExt || '.md'}`);
    }
    const resolved = resolveNameConflict(candidate, id);
    const cleaned = sanitized !== (raw || fallback);
    const conflicted = resolved !== candidate;
    const changed = resolved !== doc.name;
    doc.name = resolved;
    doc.updatedAt = Date.now();
    if (id === currentDocumentId) {
      currentFileName = resolved;
      updateDocumentTitle();
    }
    if (options.persist !== false) {
      saveDocumentsToStorage();
    }
    if (options.render !== false) {
      renderDraftList();
    }
    if (notify) {
      if (cleaned && conflicted) {
        showToast('Name adjusted to remove invalid characters and ensure uniqueness');
      } else if (cleaned) {
        showToast('Removed invalid characters from name');
      } else if (conflicted) {
        showToast('Name already existed; added a suffix');
      } else if (changed) {
        showToast('Document renamed');
      }
    }
    return doc.name;
  }

  function generateUntitledName(extension = '.md') {
    const ext = typeof extension === 'string' && extension.startsWith('.') ? extension : '.md';
    const base = 'Untitled';
    const existing = new Set(Object.values(documents).map((doc) => doc.name.toLowerCase()));
    let counter = 1;
    let candidate = `${base}${ext}`;
    while (existing.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `${base} ${counter}${ext}`;
    }
    return candidate;
  }

  function resolveNameConflict(name, excludeId) {
    if (!name) {
      return generateUntitledName();
    }
    const normalized = name.toLowerCase();
    const existing = new Set(
      Object.values(documents)
        .filter((doc) => doc.id !== excludeId)
        .map((doc) => doc.name.toLowerCase())
    );
    if (!existing.has(normalized)) {
      return name;
    }
    const { base, ext } = splitName(name);
    let counter = 2;
    let candidate = `${base} ${counter}${ext}`;
    while (existing.has(candidate.toLowerCase())) {
      counter += 1;
      candidate = `${base} ${counter}${ext}`;
    }
    return candidate;
  }

  function splitName(name) {
    if (!name) {
      return { base: 'Untitled', ext: '.md' };
    }
    const trimmed = name.trim();
    const index = trimmed.lastIndexOf('.');
    if (index > 0 && index < trimmed.length - 1) {
      return {
        base: trimmed.slice(0, index).trim() || 'Untitled',
        ext: trimmed.slice(index)
      };
    }
    return { base: trimmed, ext: '' };
  }

  function sanitizeName(name, fallback) {
    const baseFallback = typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'Untitled.md';
    if (typeof name !== 'string') {
      return baseFallback;
    }
    let clean = name
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[<>:"/\\|?*]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    clean = clean.replace(/[\. ]+$/, '');
    if (!clean) {
      return baseFallback;
    }
    if (clean.length > 120) {
      clean = clean.slice(0, 120).trim();
    }
    return clean;
  }

  function renderDraftList() {
    if (!draftList || !draftEmpty) {
      return;
    }
    const docs = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt);
    draftList.innerHTML = '';
    if (docs.length === 0) {
      draftEmpty.hidden = false;
      return;
    }
    draftEmpty.hidden = true;
    const fragment = document.createDocumentFragment();
    docs.forEach((doc) => {
      const item = document.createElement('li');
      item.className = 'draft-item';
      item.dataset.id = doc.id;
      if (doc.id === currentDocumentId) {
        item.classList.add('draft-item--active');
      }
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = doc.name;
      nameInput.className = 'draft-item__name';
      nameInput.dataset.id = doc.id;
      nameInput.setAttribute('maxlength', '120');

      const actions = document.createElement('div');
      actions.className = 'draft-item__actions';

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.dataset.action = 'openDraft';
      openButton.dataset.id = doc.id;
      openButton.textContent = 'Open';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'deleteDraft';
      deleteButton.dataset.id = doc.id;
      deleteButton.textContent = 'Delete';

      actions.appendChild(openButton);
      actions.appendChild(deleteButton);

      const meta = document.createElement('span');
      meta.className = 'draft-item__meta';
      meta.textContent = formatRelativeTime(doc.updatedAt);

      item.appendChild(nameInput);
      item.appendChild(actions);
      item.appendChild(meta);
      fragment.appendChild(item);
    });
    draftList.appendChild(fragment);
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) {
      return '—';
    }
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) {
      return 'Just now';
    }
    if (diff < 60 * 60 * 1000) {
      const mins = Math.round(diff / (60 * 1000));
      return `${mins}m ago`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.round(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    }
    return new Date(timestamp).toLocaleDateString();
  }

  function updateStorageIndicator(serialized) {
    if (!storageIndicator || !storageBar || !storageLabel) {
      return;
    }
    let payload = serialized;
    if (!payload) {
      try {
        payload = JSON.stringify({ currentId: currentDocumentId, documents });
      } catch (error) {
        payload = '';
      }
    }
    let bytes = payload.length;
    if (typeof window.TextEncoder === 'function') {
      bytes = new TextEncoder().encode(payload).length;
    }
    const percent = STORAGE_LIMIT_BYTES > 0 ? Math.min(100, Math.round((bytes / STORAGE_LIMIT_BYTES) * 100)) : 0;
    storageBar.style.width = `${percent}%`;
    const usedMb = (bytes / (1024 * 1024)).toFixed(2);
    storageLabel.textContent = `Storage usage: ${percent}% (~${usedMb} MB of 5 MB)`;
    storageIndicator.classList.remove('storage-indicator--warn', 'storage-indicator--danger');
    if (percent >= 90) {
      storageIndicator.classList.add('storage-indicator--danger');
      if (!quotaToastShown) {
        showToast('Storage almost full. Delete drafts to free space.');
        quotaToastShown = true;
      }
    } else if (percent >= 75) {
      storageIndicator.classList.add('storage-indicator--warn');
      quotaToastShown = false;
    } else {
      quotaToastShown = false;
    }
  }

  function bindDocumentTitle() {
    if (!docTitleInput) {
      return;
    }
    docTitleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        docTitleInput.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        updateDocumentTitle();
        docTitleInput.blur();
      }
    });

    docTitleInput.addEventListener('blur', () => {
      const doc = getCurrentDocument();
      if (!doc) {
        return;
      }
      const updated = renameDocument(doc.id, docTitleInput.value, { notify: false });
      docTitleInput.value = updated;
    });
  }

  function bindDraftManager() {
    if (!draftManager) {
      return;
    }
    draftManager.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) {
        return;
      }
      const action = actionEl.dataset.action;
      const id = actionEl.dataset.id;
      switch (action) {
        case 'closeDrafts':
          closeDraftManager();
          break;
        case 'openDraft':
          if (id && documents[id]) {
            setCurrentDocument(id, { focus: true });
            closeDraftManager();
            showToast(`Switched to ${documents[id].name}`);
          }
          break;
        case 'deleteDraft':
          if (id) {
            const doc = documents[id];
            if (!doc || !window.confirm(`Delete the local draft “${doc.name}”? This cannot be undone.`)) break;
            deleteDocument(id);
            showToast(doc ? `Deleted ${doc.name}` : 'Draft deleted');
          }
          break;
        default:
          break;
      }
    });

    if (draftList) {
      draftList.addEventListener('keydown', (event) => {
        const input = event.target;
        if (!input || !input.classList.contains('draft-item__name')) {
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          const doc = documents[input.dataset.id];
          input.value = doc ? doc.name : input.value;
          input.blur();
        }
      });

      draftList.addEventListener('focusout', (event) => {
        const input = event.target;
        if (!input || !input.classList.contains('draft-item__name')) {
          return;
        }
        const id = input.dataset.id;
        const updated = renameDocument(id, input.value, { notify: false });
        input.value = updated;
      });
    }
  }

  function openDraftManager() {
    if (!draftManager) {
      return;
    }
    renderDraftList();
    draftManager.hidden = false;
    draftManager.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', handleDraftManagerKeydown);
    window.requestAnimationFrame(() => {
      const active = draftList ? draftList.querySelector('.draft-item--active .draft-item__name') : null;
      const fallback = draftList ? draftList.querySelector('.draft-item__name') : null;
      const target = active || fallback;
      if (target && typeof target.focus === 'function') {
        target.focus();
        target.select();
      }
    });
  }

  function closeDraftManager() {
    if (!draftManager) {
      return;
    }
    draftManager.hidden = true;
    draftManager.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', handleDraftManagerKeydown);
  }

  function handleDraftManagerKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDraftManager();
    }
  }

  function detectContentType(name, content) {
    if (typeof name === 'string') {
      if (/\.(html?|xhtml)$/i.test(name)) {
        return 'html';
      }
      if (/\.(txt|text)$/i.test(name)) {
        return 'txt';
      }
      if (/\.(md|markdown)$/i.test(name)) {
        return 'md';
      }
    }
    if (typeof content === 'string' && /<\s*(html|body|div|p|h[1-6]|table|article)/i.test(content)) {
      return 'html';
    }
    return 'md';
  }

  function stripHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  function prepareImportedDocument(content, name, excludeId) {
    const type = detectContentType(name, content);
    const fallback = type === 'txt' ? generateUntitledName('.txt') : generateUntitledName('.md');
    let sanitizedName = sanitizeName(typeof name === 'string' ? name : '', fallback);
    if (!/\.[^.]+$/.test(sanitizedName)) {
      const inferredExt = type === 'txt' ? '.txt' : type === 'html' ? '.html' : '.md';
      sanitizedName = sanitizeName(`${sanitizedName}${inferredExt}`, fallback);
    }
    let markdown = typeof content === 'string' ? content.replace(/\r\n?/g, '\n') : '';
    let toast = name ? `Loaded ${name}` : 'Loaded document';
    if (type === 'html') {
      const base = splitName(sanitizedName).base || 'Converted';
      if (turndownService) {
        try {
          markdown = turndownService.turndown(content);
          toast = name ? `Converted ${name} from HTML` : 'Converted HTML to Markdown';
        } catch (error) {
          console.warn('HTML conversion failed', error);
          markdown = stripHtml(content).replace(/\r\n?/g, '\n');
          toast = 'HTML conversion failed. Imported as plain text—please review.';
        }
      } else {
        markdown = stripHtml(content).replace(/\r\n?/g, '\n');
        toast = 'HTML conversion unavailable. Imported as plain text—please review.';
      }
      sanitizedName = sanitizeName(`${base}.md`, generateUntitledName('.md'));
    } else if (type === 'txt') {
      toast = name ? `Loaded ${name}` : 'Loaded text file';
    }
    const uniqueName = resolveNameConflict(sanitizedName, excludeId);
    return {
      type,
      name: uniqueName,
      content: markdown,
      toast
    };
  }

  function importFileContent(content, name, handle) {
    const current = getCurrentDocument();
    const prepared = prepareImportedDocument(content, name, current ? current.id : null);
    let targetId = currentDocumentId;
    const canReuseCurrent = current
      && (!current.content || current.content.trim() === '')
      && /^untitled/i.test(current.name || '');
    if (canReuseCurrent) {
      current.content = prepared.content;
      current.name = prepared.name;
      current.updatedAt = Date.now();
      currentFileName = current.name;
      if (handle) {
        fileHandles.set(current.id, handle);
        currentFileHandle = handle;
      } else {
        fileHandles.delete(current.id);
        currentFileHandle = null;
      }
      editor.value = prepared.content;
      clearCommandHistory();
      updatePreview();
      updateDocumentTitle();
      saveDocumentsToStorage();
      renderDraftList();
      targetId = current.id;
    } else {
      const id = createDocument(prepared.name, prepared.content, { focus: true, persist: false, render: false });
      if (handle) {
        fileHandles.set(id, handle);
        currentFileHandle = handle;
      } else {
        fileHandles.delete(id);
        currentFileHandle = null;
      }
      saveDocumentsToStorage();
      renderDraftList();
      targetId = id;
    }
    if (prepared.toast) {
      showToast(prepared.toast);
    }
    return targetId;
  }

  function confirmNew() {
    const shouldCreate = window.confirm('Start a new document? Current changes remain in drafts.');
    if (!shouldCreate) {
      return;
    }
    createDocument(generateUntitledName(), '', { focus: true });
    currentFileHandle = null;
    showToast('New document ready');
  }

  async function triggerOpenFolder(options = {}) {
    if (isDisconnectingFolder) return;
    if (supportsDirectoryAccess) {
      try {
        const pickerOptions = { mode: 'readwrite', id: 'markdown-studio-folder' };
        const lastFolderHandle = openedFolder?.handle || rememberedDirectoryHandle;
        if (lastFolderHandle) {
          pickerOptions.startIn = lastFolderHandle;
        }
        const directoryHandle = await window.showDirectoryPicker(pickerOptions);
        if (!directoryHandle) {
          return;
        }
        const reconnectState = options.reconnectState;
        const isReconnect = reconnectState && reconnectState.name === directoryHandle.name;
        const folderId = isReconnect ? reconnectState.id : generateFolderId();
        rememberedDirectoryHandle = directoryHandle;
        try {
          await storeDirectoryHandle(folderId, directoryHandle);
        } catch (storageError) {
          console.warn('Unable to persist folder handle', storageError);
        }
        const rootNode = await readDirectoryTree(directoryHandle, '');
        await activateFolder(rootNode, directoryHandle.name, directoryHandle, {
          id: folderId,
          initialPath: isReconnect ? reconnectState.activePath : null
        });
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error(error);
          showToast('Unable to open folder');
        }
      }
    } else if (folderInput) {
      pendingFolderReconnectState = options.reconnectState || null;
      folderInput.click();
    } else {
      showToast('Folder access is not supported in this browser');
    }
  }

  async function readDirectoryTree(directoryHandle, basePath) {
    const node = {
      type: 'directory',
      name: directoryHandle.name,
      path: basePath,
      handle: directoryHandle,
      children: []
    };
    for await (const [name, handle] of directoryHandle.entries()) {
      const path = normalizeFolderPath(basePath ? `${basePath}/${name}` : name);
      if (handle.kind === 'directory') {
        node.children.push(await readDirectoryTree(handle, path));
      } else if (/\.(?:md|markdown)$/i.test(name)) {
        node.children.push({ type: 'file', name, path, handle });
      }
    }
    sortFolderChildren(node);
    return node;
  }

  async function openFallbackFolder(files, reconnectState = null) {
    const firstPath = files[0].webkitRelativePath || files[0].name;
    const rootName = firstPath.includes('/') ? firstPath.split('/')[0] : 'Selected folder';
    const rootNode = { type: 'directory', name: rootName, path: '', children: [] };
    const directories = new Map([['', rootNode]]);

    files.forEach((file) => {
      const rawParts = (file.webkitRelativePath || file.name).split('/').filter(Boolean);
      const parts = rawParts[0] === rootName ? rawParts.slice(1) : rawParts;
      let parentPath = '';
      let parent = rootNode;
      parts.slice(0, -1).forEach((part) => {
        const path = normalizeFolderPath(parentPath ? `${parentPath}/${part}` : part);
        let directory = directories.get(path);
        if (!directory) {
          directory = { type: 'directory', name: part, path, children: [] };
          directories.set(path, directory);
          parent.children.push(directory);
        }
        parent = directory;
        parentPath = path;
      });
      const name = parts[parts.length - 1];
      if (name && /\.(?:md|markdown)$/i.test(name)) {
        const path = normalizeFolderPath(parentPath ? `${parentPath}/${name}` : name);
        parent.children.push({ type: 'file', name, path, file });
      }
    });
    sortFolderChildren(rootNode);
    const isReconnect = reconnectState && reconnectState.name === rootName;
    await activateFolder(rootNode, rootName, null, {
      id: isReconnect ? reconnectState.id : generateFolderId(),
      initialPath: isReconnect ? reconnectState.activePath : null
    });
  }

  function generateFolderId() {
    return typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `folder-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;
  }

  function sortFolderChildren(node) {
    node.children.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1;
      }
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
    node.children.forEach((child) => {
      if (child.type === 'directory') {
        sortFolderChildren(child);
      }
    });
  }

  async function activateFolder(rootNode, name, directoryHandle, options = {}) {
    const folderId = options.id || generateFolderId();
    openedFolder = { id: folderId, name, handle: directoryHandle, root: rootNode };
    updateFolderAutosaveControl();
    activeFolderPath = null;
    selectedFolderPath = '';
    expandedFolderPaths = new Set();
    folderEntries.clear();
    folderPathLookup.clear();
    folderDocumentIds.clear();
    folderPathsByDocumentId.clear();
    indexFolderFiles(rootNode);
    await rebuildVaultIndex();
    Object.values(documents).forEach((doc) => {
      if (doc.folderId !== folderId || !doc.folderPath || !folderEntries.has(doc.folderPath)) {
        return;
      }
      folderDocumentIds.set(doc.folderPath, doc.id);
      folderPathsByDocumentId.set(doc.id, doc.folderPath);
      const entry = folderEntries.get(doc.folderPath);
      if (entry && entry.handle) {
        fileHandles.set(doc.id, entry.handle);
      }
    });
    renderFolderExplorer();
    const current = getCurrentDocument();
    const rememberedPath = normalizeFolderPath(options.initialPath || '');
    const currentPath = current && current.folderId === folderId ? current.folderPath : null;
    const targetPath = folderEntries.has(rememberedPath)
      ? rememberedPath
      : folderEntries.has(currentPath) ? currentPath : folderEntries.keys().next().value;
    if (targetPath) {
      await openFolderFile(targetPath);
      if (options.notify !== false) {
        showToast(`Opened ${name}`);
      }
    } else {
      showToast('No Markdown files found');
      saveFolderState();
    }
  }

  function askDisconnectDecision(folderName, dirtyCount) {
    if (!disconnectDialog || !disconnectDialogMessage) return Promise.resolve('cancel');
    const fileLabel = dirtyCount === 1 ? 'file has' : 'files have';
    disconnectDialogMessage.textContent = `${dirtyCount} ${fileLabel} unsaved changes in “${folderName}”. Save the changes before disconnecting, or discard them?`;
    disconnectDialog.returnValue = 'cancel';
    return new Promise((resolve) => {
      disconnectDialog.addEventListener('close', () => resolve(disconnectDialog.returnValue), { once: true });
      disconnectDialog.showModal();
    });
  }

  async function disconnectFolder() {
    if (!openedFolder || isDisconnectingFolder) return;
    const folder = openedFolder;
    isDisconnectingFolder = true;
    if (explorerDisconnect) explorerDisconnect.disabled = true;
    const wasInert = main.inert;
    main.inert = true;
    try {
      if (isVisualMode() && !syncVisualToMarkdown()) {
        showToast('Unable to prepare visual changes for saving');
        return;
      }
      const current = getCurrentDocument();
      if (current && current.folderId === folder.id) current.content = editor.value;
      const folderDocuments = Object.values(documents).filter((doc) => doc.folderId === folder.id);
      const dirtyDocuments = folderDocuments.filter(isDocumentDirty);
      if (autosaveTimer) window.clearTimeout(autosaveTimer);
      autosaveTimer = 0;

      if (dirtyDocuments.length) {
        const decision = await askDisconnectDecision(folder.name, dirtyDocuments.length);
        if (decision === 'cancel' || openedFolder !== folder) return;
        if (decision === 'save') {
          for (const doc of dirtyDocuments) {
            if (!await saveFolderDocument(doc)) return;
          }
        }
      }
      if (openedFolder !== folder) return;

      try {
        await forgetDirectoryHandle();
      } catch (error) {
        console.warn('Unable to remove remembered folder handle', error);
      }
      if (openedFolder !== folder) return;
      localStorage.removeItem(FOLDER_STATE_KEY);
      rememberedDirectoryHandle = null;
      pendingFolderReconnectState = null;
      if (folderInput) folderInput.value = '';

      const folderDocumentIdsToClose = new Set(folderDocuments.map((doc) => doc.id));
      folderDocuments.forEach((doc) => {
        fileHandles.delete(doc.id);
        delete documents[doc.id];
        delete workspaceSession.positions[doc.id];
      });
      workspaceSession.tabs = workspaceSession.tabs.filter((id) => !folderDocumentIdsToClose.has(id));
      openedFolder = null;
      selectedFolderPath = null;
      expandedFolderPaths.clear();
      folderEntries.clear();
      folderPathLookup.clear();
      folderDocumentIds.clear();
      folderPathsByDocumentId.clear();
      vaultIndex.clear();
      graphCache = null;
      graphPanelCache = null;
      graphPanelActivePath = null;
      pendingLinkInsert = null;
      if (previewTimer) window.clearTimeout(previewTimer);
      previewTimer = 0;

      showEmptyWorkspace();
      updateFolderAutosaveControl();
      renderFolderExplorer();
      saveDocumentsToStorage(false);
      persistWorkspaceSession();
      showToast(`Disconnected ${folder.name}`);
    } finally {
      main.inert = wasInert;
      isDisconnectingFolder = false;
      if (explorerDisconnect) explorerDisconnect.disabled = false;
      if (openedFolder === folder) {
        saveDocumentsToStorage(false);
        if (isDocumentDirty(getCurrentDocument())) scheduleAutosave();
      }
    }
  }

  function indexFolderFiles(node) {
    node.children.forEach((child) => {
      if (child.type === 'directory') {
        indexFolderFiles(child);
      } else {
        folderEntries.set(child.path, child);
        folderPathLookup.set(child.path.toLowerCase(), child.path);
      }
    });
  }

  async function openFolderFile(path, fragment) {
    const entry = folderEntries.get(path);
    if (!entry) {
      showToast('Markdown file not found');
      return;
    }
    try {
      let documentId = folderDocumentIds.get(path);
      if (!documentId || !documents[documentId]) {
        const file = entry.handle ? await entry.handle.getFile() : entry.file;
        const content = await file.text();
        const current = getCurrentDocument();
        const canReuseCurrent = current
          && (!current.content || current.content.trim() === '')
          && /^untitled/i.test(current.name || '');
        if (canReuseCurrent) {
          documentId = current.id;
          current.name = entry.name;
          current.content = content.replace(/\r\n?/g, '\n');
          current.savedContent = current.content;
          current.openedContent = current.content;
          current.updatedAt = Date.now();
          current.folderId = openedFolder ? openedFolder.id : null;
          current.folderPath = path;
        } else {
          documentId = createDocument(entry.name, content, {
            makeCurrent: false,
            persist: false,
            render: false,
            focus: false
          });
          documents[documentId].name = entry.name;
          documents[documentId].savedContent = content.replace(/\r\n?/g, '\n');
          documents[documentId].openedContent = content.replace(/\r\n?/g, '\n');
          documents[documentId].folderId = openedFolder ? openedFolder.id : null;
          documents[documentId].folderPath = path;
        }
        folderDocumentIds.set(path, documentId);
        folderPathsByDocumentId.set(documentId, path);
        if (entry.handle) {
          fileHandles.set(documentId, entry.handle);
        }
      }
      setCurrentDocument(documentId, { focus: false });
      saveFolderState();
      saveDocumentsToStorage();
      if (fragment) {
        window.requestAnimationFrame(() => scrollPreviewToFragment(fragment));
      }
    } catch (error) {
      console.error(error);
      showToast(`Unable to open ${entry.name}`);
    }
  }

  function scrollPreviewToFragment(fragment) {
    let decoded = fragment;
    try {
      decoded = decodeURIComponent(fragment);
    } catch (error) {
      decoded = fragment;
    }
    const target = Array.from(preview.querySelectorAll('[id]')).find((element) => element.id === decoded);
    if (target) {
      target.scrollIntoView({ block: 'start' });
    }
  }

  function renderFolderExplorer() {
    if (!explorer || !explorerTree || !explorerName || !explorerEmpty) {
      return;
    }
    explorerTree.querySelectorAll('details[open] > summary[data-directory-path]').forEach((summary) => expandedFolderPaths.add(summary.dataset.directoryPath));
    explorerName.textContent = openedFolder ? openedFolder.name : 'No folder open';
    explorerName.title = openedFolder ? openedFolder.name : '';
    explorerTree.replaceChildren();
    explorerEmpty.hidden = Boolean(openedFolder);
    if (explorerFooter) explorerFooter.hidden = !openedFolder;
    if (explorerEmptyMessage) {
      explorerEmptyMessage.textContent = 'Open a folder to browse Markdown files.';
    }
    if (explorerReconnect) {
      explorerReconnect.hidden = true;
    }
    if (explorerOpenFolder) {
      explorerOpenFolder.hidden = false;
    }
    if (explorerNewFile) {
      const writable = Boolean(openedFolder && openedFolder.handle);
      explorerNewFile.disabled = !writable;
      explorerNewFile.title = writable ? 'Create Markdown file in selected folder' : 'Reopen folder with write permission to create files';
    }
    if (!openedFolder) {
      return;
    }
    const list = document.createElement('ul');
    list.className = 'file-tree';
    openedFolder.root.children.forEach((node) => list.appendChild(createTreeNode(node)));
    explorerTree.appendChild(list);
    revealFolderPath(selectedFolderPath || getFolderParentPath(activeFolderPath));
  }

  function syncFolderExplorerSelection() {
    if (!explorerTree) {
      return;
    }
    explorerTree.querySelectorAll('button[data-folder-path]').forEach((button) => {
      const isActive = button.dataset.folderPath === activeFolderPath;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
    explorerTree.querySelectorAll('summary[data-directory-path]').forEach((summary) => {
      const isSelected = summary.dataset.directoryPath === selectedFolderPath;
      summary.classList.toggle('is-active', isSelected);
      if (isSelected) summary.setAttribute('aria-current', 'true');
      else summary.removeAttribute('aria-current');
    });
  }

  function createTreeNode(node) {
    const item = document.createElement('li');
    if (node.type === 'directory') {
      const details = document.createElement('details');
      details.open = expandedFolderPaths.has(node.path);
      const summary = document.createElement('summary');
      summary.dataset.directoryPath = node.path;
      summary.textContent = node.name;
      const list = document.createElement('ul');
      node.children.forEach((child) => list.appendChild(createTreeNode(child)));
      details.append(summary, list);
      item.appendChild(details);
      return item;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.folderPath = node.path;
    button.textContent = node.name;
    button.title = node.path;
    if (node.path === activeFolderPath) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }
    item.appendChild(button);
    return item;
  }

  function revealFolderPath(path) {
    if (!explorerTree) return;
    const normalized = normalizeFolderPath(path || '');
    const parts = normalized.split('/').filter(Boolean);
    let current = '';
    parts.forEach((part) => {
      current = current ? `${current}/${part}` : part;
      const summary = explorerTree.querySelector(`summary[data-directory-path="${cssEscape(current)}"]`);
      if (summary && summary.parentElement) {
        summary.parentElement.open = true;
        expandedFolderPaths.add(current);
      }
    });
  }

  function cssEscape(value) {
    return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : String(value).replace(/(["\\])/g, '\\$1');
  }

  function getFolderParentPath(path) {
    const normalized = normalizeFolderPath(path || '');
    const slash = normalized.lastIndexOf('/');
    return slash === -1 ? '' : normalized.slice(0, slash);
  }

  function findFolderNode(node, path) {
    if (!node || node.type !== 'directory') return null;
    if (node.path === path) return node;
    for (const child of node.children) {
      const match = findFolderNode(child, path);
      if (match) return match;
    }
    return null;
  }

  async function getDirectoryHandleForPath(path) {
    if (!openedFolder || !openedFolder.handle) return null;
    let handle = openedFolder.handle;
    for (const part of normalizeFolderPath(path || '').split('/').filter(Boolean)) {
      handle = await handle.getDirectoryHandle(part);
    }
    return handle;
  }

  async function createFolderFile() {
    if (!openedFolder || !openedFolder.handle) {
      showToast('Reopen the folder with write permission to create files');
      return;
    }
    const rawName = window.prompt('New Markdown file name', 'untitled.md');
    if (rawName === null) return;
    const trimmedName = rawName.trim();
    if (!trimmedName || ILLEGAL_FILENAME.test(trimmedName) || trimmedName === '.' || trimmedName === '..') {
      showToast('Enter a valid file name');
      return;
    }
    const fileName = /\.(?:md|markdown)$/i.test(trimmedName) ? trimmedName : `${trimmedName}.md`;
    const parentPath = selectedFolderPath !== null ? selectedFolderPath : getFolderParentPath(activeFolderPath);
    const path = normalizeFolderPath(parentPath ? `${parentPath}/${fileName}` : fileName);
    if (folderPathLookup.has(path.toLowerCase())) {
      showToast('A file with that name already exists');
      return;
    }
    try {
      const directoryHandle = await getDirectoryHandleForPath(parentPath);
      const handle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write('');
      await writable.close();
      const parentNode = findFolderNode(openedFolder.root, parentPath);
      if (!parentNode) throw new Error('Folder location no longer exists');
      const entry = { type: 'file', name: fileName, path, handle };
      parentNode.children.push(entry);
      sortFolderChildren(parentNode);
      folderEntries.set(path, entry);
      folderPathLookup.set(path.toLowerCase(), path);
      const documentId = createDocument(fileName, '', { makeCurrent: false, persist: false, render: false, focus: false });
      const doc = documents[documentId];
      doc.folderId = openedFolder.id;
      doc.folderPath = path;
      folderDocumentIds.set(path, documentId);
      folderPathsByDocumentId.set(documentId, path);
      fileHandles.set(documentId, handle);
      vaultIndex.set(path, makeVaultIndexEntry(path, fileName, ''));
      graphCache = null;
      renderFolderExplorer();
      setCurrentDocument(documentId, { focus: true });
      saveFolderState();
      saveDocumentsToStorage();
      showToast(`Created ${fileName}`);
    } catch (error) {
      console.error(error);
      showToast('Unable to create file in this folder');
    }
  }

  async function triggerOpen() {
    if (supportsFileSystemAccess) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Markdown or Text Files',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'text/plain': ['.txt'],
                'text/html': ['.html', '.htm']
              }
            }
          ],
          excludeAcceptAllOption: false,
          multiple: false
        });
        if (!handle) return false;
        const file = await handle.getFile();
        const text = await file.text();
        importFileContent(text, file.name, handle);
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error(error);
          showToast('Unable to open file');
        }
      }
    } else {
      fileInput.click();
    }
  }

  async function triggerSave() {
    const doc = getCurrentDocument();
    if (!doc) {
      return false;
    }
    doc.content = editor.value;
    doc.updatedAt = Date.now();
    // A folder file may have been restored from a previous session before its
    // document metadata is rebuilt. Its handle is still the authoritative
    // signal that Save/Cmd+S must write the opened file, never download it.
    if (openedFolder && (isFolderDocument(doc) || currentFileHandle || fileHandles.get(doc.id))) {
      return saveFolderDocument(doc);
    }
    // Outside an opened folder, Save is deliberately an export: drafts remain
    // protected in local storage and the requested file is downloaded to disk.
    downloadFile(doc.name || 'document.md');
    saveDocumentsToStorage(false);
    renderDraftList();
    setSaveStatus('Saved locally');
    showToast('Downloaded');
    return true;
  }

  async function saveFolderDocument(doc) {
    const handle = fileHandles.get(doc.id) || (doc.id === currentDocumentId ? currentFileHandle : null);
    if (!handle) {
      showToast('This folder is read-only. Reopen it with write permission to save.');
      setSaveStatus('Could not save to disk', 'error');
      return false;
    }
    const content = doc.id === currentDocumentId ? editor.value : doc.content;
    doc.content = content;
    try {
      await writeFile(handle, content);
      doc.savedContent = content;
      saveDocumentsToStorage(false);
      renderDraftList();
      updateSaveStatusForCurrentDocument();
      showToast('Saved');
      return true;
    } catch (error) {
      console.error(error);
      showToast('Unable to save');
      setSaveStatus('Could not save to disk', 'error');
      return false;
    }
  }

  async function triggerSaveAs() {
    const doc = getCurrentDocument();
    if (!doc) {
      return false;
    }
    if (supportsFileSystemAccess) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: doc.name || 'document.md',
          types: [
            {
              description: 'Markdown or Text Files',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'text/plain': ['.txt']
              }
            }
          ]
        });
        if (!handle) return false;
        currentFileHandle = handle;
        fileHandles.set(doc.id, handle);
        const handleName = handle.name || doc.name;
        if (handleName) {
          renameDocument(doc.id, handleName, { notify: false, persist: false, render: false });
        }
        await writeFile(handle);
        doc.savedContent = editor.value;
        showToast('Saved');
        saveDocumentsToStorage();
        renderDraftList();
        updateSaveStatusForCurrentDocument();
        return true;
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error(error);
          showToast('Unable to save');
        }
        return false;
      }
    } else {
      const fallbackName = doc.name || 'document.md';
      downloadFile(fallbackName);
      showToast('Downloaded');
      saveDocumentsToStorage();
      renderDraftList();
      return true;
    }
  }

  async function writeFile(handle, content = editor.value) {
    const writable = await handle.createWritable();
    await writable.write(content.replace(/\r\n?/g, '\n'));
    await writable.close();
  }

  function downloadFile(filename) {
    const blob = new Blob([editor.value], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(editor.value);
      showToast('Markdown copied');
    } catch (error) {
      fallbackCopy(editor.value);
      showToast('Markdown copied');
    }
  }

  async function copyRenderedHtml() {
    const html = preview.innerHTML;
    if (!html) {
      showToast('Nothing to copy');
      return;
    }
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = new Blob([html], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
      } else {
        fallbackCopy(html, true);
      }
      showToast('Rendered HTML copied');
    } catch (error) {
      fallbackCopy(html, true);
      showToast('Rendered HTML copied');
    }
  }

  function fallbackCopy(text, isHtml) {
    const selection = window.getSelection();
    let previousRange = null;
    if (selection && selection.rangeCount > 0) {
      previousRange = selection.getRangeAt(0).cloneRange();
    }
    let temp;
    if (isHtml) {
      temp = document.createElement('div');
      temp.contentEditable = 'true';
      temp.innerHTML = text;
    } else {
      temp = document.createElement('textarea');
      temp.value = text;
    }
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    temp.style.pointerEvents = 'none';
    temp.style.top = '0';
    temp.style.left = '0';
    document.body.appendChild(temp);
    if (isHtml) {
      const range = document.createRange();
      range.selectNodeContents(temp);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      temp.focus();
      temp.select();
    }
    document.execCommand('copy');
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) {
        selection.addRange(previousRange);
      }
    }
    document.body.removeChild(temp);
  }

  function exportHtml() {
    const docTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const html = `<!DOCTYPE html><html lang="en" data-theme="${docTheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(currentFileName.replace(/\.[^.]+$/, ''))}</title><style>${EXPORT_STYLES}</style></head><body><article class="markdown-body">${preview.innerHTML}</article></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentFileName.replace(/\.[^.]+$/, '') || 'document'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported HTML');
  }

  function triggerPrint() {
    const shouldToggle = window.innerWidth <= 960 && !main.classList.contains('show-preview');
    if (shouldToggle) {
      main.classList.add('show-preview');
      setResponsivePressed('preview');
    }
    window.setTimeout(() => {
      window.print();
      if (shouldToggle) {
        main.classList.remove('show-preview');
        setResponsivePressed('editor');
      }
    }, 50);
  }

  function syncThemeToggle(theme) {
    if (!themeToggle) {
      return;
    }
    themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeToggle.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  function toggleTheme() {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    syncThemeToggle(next);
    showToast(`Switched to ${next} theme`);
    updatePreview();
  }

  function showToast(message) {
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toastTimeout = window.setTimeout(() => {
      toast.hidden = true;
    }, 2000);
  }

  function escapeHtml(input) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
