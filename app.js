(() => {
  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');
  const divider = document.querySelector('.divider');
  const toolbar = document.querySelector('.editor-toolbar');
  const fileActions = document.querySelector('.file-toolbar');
  const toast = document.querySelector('.toast');
  const fileInput = document.getElementById('file-input');
  const main = document.querySelector('.app-main');
  const responsiveToggle = document.querySelectorAll('.responsive-toggle button');
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
  const THEME_KEY = 'markdown-studio-theme';
  const VIEW_KEY = 'markdown-studio-view';
  const AUTOSAVE_DELAY = 3000;
  const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
  const ILLEGAL_FILENAME = /[<>:"/\\|?*]+/;
  const EXPORT_STYLES = `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#24292f;}[data-theme="dark"] body{background:#0d1117;color:#e6edf3;}a{color:#0969da;}code,pre{font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;border-radius:6px;}pre{padding:1rem;overflow:auto;background:#f6f8fa;color:#24292f;}[data-theme="dark"] pre{background:#161b22;color:#e6edf3;}code{background:#f6f8fa;color:#24292f;padding:0.15rem 0.4rem;}[data-theme="dark"] code{background:#161b22;color:#e6edf3;}table{border-collapse:collapse;width:100%;margin:1rem 0;}th,td{border:1px solid #d0d7de;padding:0.5rem;text-align:left;}blockquote{margin:1rem 0;padding:0.5rem 1rem;border-left:4px solid #d0d7de;color:rgba(87,96,106,0.9);}h1,h2,h3,h4,h5,h6{border-bottom:1px solid #d0d7de;padding-bottom:0.3em;margin:1.5em 0 0.8em;}img{max-width:100%;}article.markdown-body{max-width:860px;margin:0 auto;background:rgba(255,255,255,0.97);padding:2rem;border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.08);font-size:0.97rem;line-height:1.65;}article.markdown-body pre{margin:1.5rem 0;}[data-theme="dark"] article.markdown-body{background:#161b22;color:#e6edf3;box-shadow:0 10px 30px rgba(0,0,0,0.45);}`;

  const supportsFileSystemAccess = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
  let currentFileHandle = null;
  let currentFileName = 'Untitled.md';
  let toastTimeout = 0;
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  const commandUndoStack = [];
  const COMMAND_UNDO_LIMIT = 100;
  let isRestoring = false;
  let documents = {};
  let currentDocumentId = null;
  let autosaveTimer = 0;
  let quotaToastShown = false;
  let turndownService = null;
  const fileHandles = new Map();

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

  function restoreView() {
    const stored = localStorage.getItem(VIEW_KEY);
    if (window.innerWidth <= 960 && stored === 'preview') {
      main.classList.add('show-preview');
      setResponsivePressed('preview');
    } else {
      setResponsivePressed('editor');
    }
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
                updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : Date.now()
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
      if (modKey) {
        switch (event.key.toLowerCase()) {
          case 'z':
            if (!event.shiftKey && performCommandUndo()) {
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
    if (!toolbar) {
      return;
    }
    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      const action = button.dataset.action;
      applyFormatting(action);
      editor.focus();
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
    });

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        const text = await file.text();
        importFileContent(text, file.name, null);
      }
      fileInput.value = '';
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
    const max = Math.max(min, main.clientWidth - min);
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
        if (view === 'preview') {
          main.classList.add('show-preview');
        } else {
          main.classList.remove('show-preview');
        }
        sessionStorage.setItem(VIEW_KEY, view);
        localStorage.setItem(VIEW_KEY, view);
        setResponsivePressed(view);
      });
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 960) {
        main.classList.remove('show-preview');
        setResponsivePressed('editor');
      } else {
        const stored = localStorage.getItem(VIEW_KEY);
        if (stored === 'preview') {
          main.classList.add('show-preview');
          setResponsivePressed('preview');
        }
      }
    });
  }

  function setResponsivePressed(view) {
    responsiveToggle.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.view === view ? 'true' : 'false');
    });
  }

  function updatePreview() {
    const text = (editor.value || '').replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n');
    const html = marked.parse(text);
    const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    preview.innerHTML = clean;
    promoteMultilineCode();
    if (window.hljs && typeof window.hljs.highlightElement === 'function') {
      preview.querySelectorAll('pre code').forEach((block) => {
        block.classList.add('hljs');
        window.hljs.highlightElement(block);
      });
    }
    enforceSafeLinks();
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
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer noopener');
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

  function performCommandUndo() {
    if (commandUndoStack.length === 0) {
      return false;
    }
    const state = commandUndoStack.pop();
    isRestoring = true;
    editor.value = state.value;
    editor.scrollTop = state.scrollTop;
    editor.setSelectionRange(state.selectionStart, state.selectionEnd);
    isRestoring = false;
    dispatchInputEvent();
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
      pushUndoState({
        value: previousValue,
        selectionStart: start,
        selectionEnd: end,
        scrollTop: editor.scrollTop
      });
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

  function pushUndoState(state) {
    commandUndoStack.push(state);
    if (commandUndoStack.length > COMMAND_UNDO_LIMIT) {
      commandUndoStack.shift();
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
    editor.value = doc.content || '';
    clearCommandHistory();
    updatePreview();
    currentFileName = doc.name || 'Untitled.md';
    currentFileHandle = fileHandles.get(id) || null;
    updateDocumentTitle();
    if (options.focus !== false) {
      editor.focus();
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
