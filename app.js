(() => {
  const editor = document.getElementById('editor');
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
  const explorerNewFile = document.querySelector('.file-explorer__new-file');
  const explorerToggles = document.querySelectorAll('[data-action="toggleExplorer"]');
  const main = document.querySelector('.app-main');
  const responsiveToggle = document.querySelectorAll('.view-toggle button');
  const root = document.documentElement;
  const editorPane = document.querySelector('.editor-pane');
  const previewPane = document.querySelector('.preview-pane');
  const themeToggle = document.querySelector('.theme-toggle');
  const docTitleInput = document.getElementById('document-title');
  const draftManager = document.querySelector('.draft-manager');
  const draftList = draftManager ? draftManager.querySelector('.draft-manager__list') : null;
  const draftEmpty = draftManager ? draftManager.querySelector('.draft-manager__empty') : null;
  const storageIndicator = draftManager ? draftManager.querySelector('.storage-indicator') : null;
  const storageBar = draftManager ? draftManager.querySelector('.storage-bar span') : null;
  const storageLabel = draftManager ? draftManager.querySelector('.storage-label') : null;

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
  const FOLDER_DATABASE = 'markdown-studio-files';
  const FOLDER_STORE = 'handles';
  const THEME_KEY = 'markdown-studio-theme';
  const VIEW_KEY = 'markdown-studio-view';
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
  let scrollSyncTarget = null;
  let scrollSyncRelease = 0;
  const commandUndoStack = [];
  const commandRedoStack = [];
  const COMMAND_UNDO_LIMIT = 100;
  let isRestoring = false;
  let documents = {};
  let currentDocumentId = null;
  let autosaveTimer = 0;
  let quotaToastShown = false;
  let turndownService = null;
  const fileHandles = new Map();
  const folderEntries = new Map();
  const folderPathLookup = new Map();
  const folderDocumentIds = new Map();
  const folderPathsByDocumentId = new Map();
  let openedFolder = null;
  let activeFolderPath = null;
  // Unlike activeFolderPath (the open file), this is the directory that receives
  // newly created files. Keeping them separate lets a user select a folder
  // without changing the document currently being edited.
  let selectedFolderPath = null;
  let rememberedDirectoryHandle = null;
  let pendingFolderReconnectState = null;
  let visualSyncTimer = 0;
  let isSyncingVisual = false;

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
  }

  restoreTheme();
  restoreExplorer();
  restoreSplit();
  restoreView();
  restoreDocuments();
  editor.focus();

  bindEditor();
  bindToolbar();
  bindFileActions();
  bindDivider();
  bindDragAndDrop();
  bindResponsiveToggle();
  bindAutosave();
  bindThemeToggle();
  bindDocumentTitle();
  bindDraftManager();
  bindFolderExplorer();
  bindPreviewLinks();
  bindExplorerControls();
  bindSynchronizedScrolling();
  bindVisualEditor();
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
    setExplorerCollapsed(localStorage.getItem(EXPLORER_COLLAPSED_KEY) === 'true', false);
  }

  function restoreView() {
    const stored = localStorage.getItem(VIEW_KEY);
    setEditorView(stored === 'wysiwyg' ? 'wysiwyg' : stored === 'preview' ? 'preview' : stored === 'editor' ? 'editor' : 'split', false);
  }

  function restoreDocuments() {
    documents = {};
    currentDocumentId = null;
    try {
      const raw = localStorage.getItem(DOCUMENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
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

    if (!currentDocumentId || !documents[currentDocumentId]) {
      const ordered = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt);
      currentDocumentId = ordered.length > 0 ? ordered[0].id : null;
    }

    if (!currentDocumentId) {
      currentDocumentId = createDocument(generateUntitledName(), '', { persist: false, render: false, focus: false });
    }

    setCurrentDocument(currentDocumentId, { focus: false, skipHistory: true });
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
      updatePreview();
    });
  }

  function scheduleAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = 0;
      saveDocumentsToStorage();
    }, AUTOSAVE_DELAY);
  }

  function saveDocumentsToStorage() {
    try {
      const payload = JSON.stringify({ currentId: currentDocumentId, documents });
      localStorage.setItem(DOCUMENTS_KEY, payload);
      updateStorageIndicator(payload);
    } catch (err) {
      console.warn('Autosave failed', err);
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
            triggerOpen();
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
        } else {
          applyFormatting(action);
          editor.focus();
        }
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
      }
      const menu = button.closest('.app-menu');
      if (menu) {
        menu.open = false;
      }
    });

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
      if (!directorySummary) {
        return;
      }
      selectedFolderPath = directorySummary.dataset.directoryPath;
      syncFolderExplorerSelection();
      saveFolderState();
    });
    if (explorerReconnect) {
      explorerReconnect.addEventListener('click', reconnectFolder);
    }
    if (explorerOpenFolder) {
      explorerOpenFolder.addEventListener('click', () => triggerOpenFolder());
    }
  }

  function bindExplorerControls() {
    explorerToggles.forEach((button) => {
      if (button.closest('.file-toolbar')) {
        return;
      }
      button.addEventListener('click', toggleExplorer);
    });
    if (explorerNewFile) {
      explorerNewFile.addEventListener('click', createFolderFile);
    }
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
    editor.addEventListener('scroll', () => synchronizeScroll(editor, previewPane));
    previewPane.addEventListener('scroll', () => synchronizeScroll(previewPane, editor));
  }

  function synchronizeScroll(source, target) {
    if (scrollSyncTarget === source) {
      return;
    }
    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
    scrollSyncTarget = target;
    target.scrollTop = targetRange > 0 ? progress * targetRange : 0;
    if (scrollSyncRelease) {
      window.cancelAnimationFrame(scrollSyncRelease);
    }
    scrollSyncRelease = window.requestAnimationFrame(() => {
      scrollSyncTarget = null;
      scrollSyncRelease = 0;
    });
  }

  function bindPreviewLinks() {
    preview.addEventListener('click', (event) => {
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
    const explorerWidth = explorer
      ? explorer.getBoundingClientRect().width + (explorerDivider ? explorerDivider.getBoundingClientRect().width : 0)
      : 0;
    const max = Math.max(min, main.clientWidth - explorerWidth - min);
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
        setEditorView(button.dataset.view);
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
    main.classList.toggle('markdown-only', chosen === 'editor');
    main.classList.toggle('show-preview', chosen === 'preview');
    preview.contentEditable = chosen === 'wysiwyg' ? 'true' : 'false';
    preview.setAttribute('role', chosen === 'wysiwyg' ? 'textbox' : 'article');
    preview.setAttribute('aria-label', chosen === 'wysiwyg' ? 'Visual Markdown editor' : 'Markdown preview');
    preview.setAttribute('aria-live', chosen === 'wysiwyg' ? 'off' : 'polite');
    if (persist) {
      sessionStorage.setItem(VIEW_KEY, chosen);
      localStorage.setItem(VIEW_KEY, chosen);
    }
    setResponsivePressed(chosen);
    if (chosen === 'wysiwyg') {
      updatePreview();
      window.requestAnimationFrame(() => preview.focus());
    }
  }

  function setResponsivePressed(view) {
    responsiveToggle.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.view === view ? 'true' : 'false');
    });
  }

  function splitYamlFrontmatter(markdown) {
    const match = markdown.match(/^(?:\uFEFF)?---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(?:\n|$)/);
    if (!match) {
      return { frontmatter: '', content: markdown };
    }
    return {
      frontmatter: match[0],
      content: markdown.slice(match[0].length)
    };
  }

  function updatePreview() {
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
      if (!modKey) {
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
  }

  function queueVisualSync() {
    window.clearTimeout(visualSyncTimer);
    visualSyncTimer = window.setTimeout(() => {
      visualSyncTimer = 0;
      syncVisualToMarkdown();
    }, 550);
  }

  function getVisualCaretOffset() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !preview.contains(selection.anchorNode)) {
      return null;
    }
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(preview);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  }

  function restoreVisualCaret(offset) {
    if (typeof offset !== 'number') {
      return;
    }
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.textContent.length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= node.textContent.length;
      node = walker.nextNode();
    }
  }

  function syncVisualToMarkdown() {
    window.clearTimeout(visualSyncTimer);
    visualSyncTimer = 0;
    if (!isVisualMode() || !turndownService) {
      return;
    }
    const caretOffset = getVisualCaretOffset();
    let markdown;
    try {
      markdown = turndownService.turndown(preview.innerHTML).replace(/\r\n?/g, '\n');
    } catch (error) {
      console.warn('Visual editor conversion failed', error);
      return;
    }
    const frontmatter = splitYamlFrontmatter(editor.value).frontmatter;
    markdown = frontmatter + markdown;
    if (markdown === editor.value) {
      return;
    }
    isSyncingVisual = true;
    editor.value = markdown;
    const doc = getCurrentDocument();
    if (doc) {
      doc.content = markdown;
      doc.updatedAt = Date.now();
    }
    scheduleAutosave();
    updatePreview();
    isSyncingVisual = false;
    preview.focus();
    restoreVisualCaret(caretOffset);
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

  function setCurrentDocument(id, options = {}) {
    const doc = id && documents[id] ? documents[id] : null;
    if (!doc) {
      return;
    }
    currentDocumentId = id;
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
    if (options.focus !== false) {
      (isVisualMode() ? preview : editor).focus();
    }
    if (options.render !== false) {
      renderDraftList();
    }
  }

  function updateDocumentTitle() {
    if (!docTitleInput) {
      return;
    }
    const doc = getCurrentDocument();
    docTitleInput.value = doc ? doc.name : 'Untitled.md';
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
    if (supportsDirectoryAccess) {
      try {
        const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
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
    activeFolderPath = null;
    selectedFolderPath = '';
    folderEntries.clear();
    folderPathLookup.clear();
    folderDocumentIds.clear();
    folderPathsByDocumentId.clear();
    indexFolderFiles(rootNode);
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
    explorerName.textContent = openedFolder ? openedFolder.name : 'No folder open';
    explorerName.title = openedFolder ? openedFolder.name : '';
    explorerTree.replaceChildren();
    explorerEmpty.hidden = Boolean(openedFolder);
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
      const canCreate = Boolean(openedFolder && openedFolder.handle);
      explorerNewFile.disabled = !canCreate;
      explorerNewFile.title = canCreate
        ? 'Create Markdown file in the selected folder'
        : 'Open the folder with write permission to create files';
    }
    if (!openedFolder) {
      return;
    }
    const list = document.createElement('ul');
    list.className = 'file-tree';
    openedFolder.root.children.forEach((node) => list.appendChild(createTreeNode(node)));
    explorerTree.appendChild(list);
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
      if (isSelected) {
        summary.setAttribute('aria-current', 'true');
      } else {
        summary.removeAttribute('aria-current');
      }
    });
  }

  function createTreeNode(node) {
    const item = document.createElement('li');
    if (node.type === 'directory') {
      const details = document.createElement('details');
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

  function getFolderParentPath(path) {
    const normalized = normalizeFolderPath(path || '');
    const slash = normalized.lastIndexOf('/');
    return slash === -1 ? '' : normalized.slice(0, slash);
  }

  function findFolderNode(node, path) {
    if (!node || node.type !== 'directory') {
      return null;
    }
    if (node.path === path) {
      return node;
    }
    for (let index = 0; index < node.children.length; index += 1) {
      const match = findFolderNode(node.children[index], path);
      if (match) {
        return match;
      }
    }
    return null;
  }

  async function getDirectoryHandleForPath(path) {
    if (!openedFolder || !openedFolder.handle) {
      return null;
    }
    let handle = openedFolder.handle;
    const parts = normalizeFolderPath(path || '').split('/').filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
      handle = await handle.getDirectoryHandle(parts[index]);
    }
    return handle;
  }

  async function createFolderFile() {
    if (!openedFolder || !openedFolder.handle) {
      showToast('Reopen the folder with write permission to create files');
      return;
    }
    const rawName = window.prompt('New Markdown file name', 'untitled.md');
    if (rawName === null) {
      return;
    }
    const trimmedName = rawName.trim();
    if (!trimmedName || ILLEGAL_FILENAME.test(trimmedName) || trimmedName === '.' || trimmedName === '..') {
      showToast('Enter a valid file name');
      return;
    }
    const fileName = /\.(?:md|markdown)$/i.test(trimmedName) ? trimmedName : `${trimmedName}.md`;
    const parentPath = selectedFolderPath !== null
      ? selectedFolderPath
      : getFolderParentPath(activeFolderPath);
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
      if (!parentNode) {
        throw new Error('Folder location no longer exists');
      }
      const entry = { type: 'file', name: fileName, path, handle };
      parentNode.children.push(entry);
      sortFolderChildren(parentNode);
      folderEntries.set(path, entry);
      folderPathLookup.set(path.toLowerCase(), path);

      const documentId = createDocument(fileName, '', {
        makeCurrent: false,
        persist: false,
        render: false,
        focus: false
      });
      const doc = documents[documentId];
      doc.folderId = openedFolder.id;
      doc.folderPath = path;
      folderDocumentIds.set(path, documentId);
      folderPathsByDocumentId.set(documentId, path);
      fileHandles.set(documentId, handle);
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
        if (!handle) {
          return;
        }
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
      return;
    }
    doc.content = editor.value;
    doc.updatedAt = Date.now();
    if (supportsFileSystemAccess) {
      if (!currentFileHandle) {
        await triggerSaveAs();
        return;
      }
      await writeFile(currentFileHandle);
      showToast('Saved');
    } else {
      downloadFile(doc.name || 'document.md');
      showToast('Downloaded');
    }
    saveDocumentsToStorage();
    renderDraftList();
  }

  async function triggerSaveAs() {
    const doc = getCurrentDocument();
    if (!doc) {
      return;
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
        if (!handle) {
          return;
        }
        currentFileHandle = handle;
        fileHandles.set(doc.id, handle);
        const handleName = handle.name || doc.name;
        if (handleName) {
          renameDocument(doc.id, handleName, { notify: false, persist: false, render: false });
        }
        await writeFile(handle);
        showToast('Saved');
        saveDocumentsToStorage();
        renderDraftList();
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error(error);
          showToast('Unable to save');
        }
      }
    } else {
      const fallbackName = doc.name || 'document.md';
      downloadFile(fallbackName);
      showToast('Downloaded');
      saveDocumentsToStorage();
      renderDraftList();
    }
  }

  async function writeFile(handle) {
    const writable = await handle.createWritable();
    await writable.write(editor.value.replace(/\r\n?/g, '\n'));
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
