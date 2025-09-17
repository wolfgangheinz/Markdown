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

  const AUTOSAVE_KEY = 'markdown-studio-autosave';
  const SPLIT_KEY = 'markdown-studio-split';
  const THEME_KEY = 'markdown-studio-theme';
  const VIEW_KEY = 'markdown-studio-view';
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

  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    langPrefix: 'language-'
  });

  restoreTheme();
  restoreSplit();
  restoreView();
  restoreAutosave();
  updatePreview();
  editor.focus();

  bindEditor();
  bindToolbar();
  bindFileActions();
  bindDivider();
  bindDragAndDrop();
  bindResponsiveToggle();
  bindAutosave();
  bindThemeToggle();

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

  function restoreAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw);
      if (saved && typeof saved.content === 'string') {
        editor.value = saved.content;
        if (saved.fileName) {
          currentFileName = saved.fileName;
        }
      }
    } catch (err) {
      console.warn('Autosave restore failed', err);
    }
  }

  function bindAutosave() {
    editor.addEventListener('input', () => {
      scheduleAutosave();
      updatePreview();
    });
  }

  let autosaveTimer = 0;
  function scheduleAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = 0;
      saveAutosave();
    }, 400);
  }

  function saveAutosave() {
    try {
      const payload = { content: editor.value, fileName: currentFileName, ts: Date.now() };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  }

  function clearAutosave() {
    localStorage.removeItem(AUTOSAVE_KEY);
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
          clearAutosave();
          showToast('Draft cleared');
          break;
      }
    });

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        const text = await file.text();
        loadDocument(text, file.name, null);
        showToast(`Loaded ${file.name}`);
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
      if (!/\.(md|markdown|txt)$/i.test(file.name)) {
        showToast('Unsupported file type');
        return;
      }
      const text = await file.text();
      loadDocument(text, file.name, null);
      showToast(`Loaded ${file.name}`);
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

  function confirmNew() {
    const keep = window.confirm('Clear current document?');
    if (!keep) {
      return;
    }
    currentFileHandle = null;
    currentFileName = 'Untitled.md';
    editor.value = '';
    clearCommandHistory();
    updatePreview();
    saveAutosave();
  }

  async function triggerOpen() {
    if (supportsFileSystemAccess) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Markdown Files',
              accept: {
                'text/markdown': ['.md', '.markdown']
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
        loadDocument(text, file.name, handle);
        showToast(`Opened ${file.name}`);
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
    if (supportsFileSystemAccess) {
      if (!currentFileHandle) {
        await triggerSaveAs();
        return;
      }
      await writeFile(currentFileHandle);
      showToast('Saved');
    } else {
      downloadFile(currentFileName);
      showToast('Downloaded');
    }
    saveAutosave();
  }

  async function triggerSaveAs() {
    if (supportsFileSystemAccess) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: currentFileName,
          types: [
            {
              description: 'Markdown Files',
              accept: {
                'text/markdown': ['.md', '.markdown']
              }
            }
          ]
        });
        if (!handle) {
          return;
        }
        currentFileHandle = handle;
        currentFileName = handle.name || currentFileName;
        await writeFile(handle);
        showToast('Saved');
        saveAutosave();
      } catch (error) {
        if (error && error.name !== 'AbortError') {
          console.error(error);
          showToast('Unable to save');
        }
      }
    } else {
      const fallbackName = 'document.md';
      currentFileName = fallbackName;
      downloadFile(fallbackName);
      showToast('Downloaded');
      saveAutosave();
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

  function loadDocument(content, name, handle) {
    editor.value = content;
    clearCommandHistory();
    if (handle !== undefined) {
      currentFileHandle = handle;
    } else if (!supportsFileSystemAccess) {
      currentFileHandle = null;
    }
    currentFileName = name || currentFileName;
    updatePreview();
    saveAutosave();
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
