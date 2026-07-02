type MonacoEditor = any;
type MonacoModels = {
  incomingModel: any;
  currentModel: any;
  baseModel: any;
  resultModel: any;
};

type MonacoEditors = {
  incomingEditor: MonacoEditor;
  currentEditor: MonacoEditor;
  resultEditor: MonacoEditor;
};

type CreateModelsOptions = {
  incomingText: string;
  currentText: string;
  baseText: string;
  resultText: string;
  language: string;
};

type CreateEditorsOptions = {
  incomingContainer: HTMLElement;
  currentContainer: HTMLElement;
  resultContainer: HTMLElement;
  theme: string;
  monacoOptions: any;
};

export function createMergeModels(monaco: any, options: CreateModelsOptions): MonacoModels {
  return {
    incomingModel: monaco.editor.createModel(options.incomingText, options.language),
    currentModel: monaco.editor.createModel(options.currentText, options.language),
    baseModel: monaco.editor.createModel(options.baseText, options.language),
    resultModel: monaco.editor.createModel(options.resultText, options.language),
  };
}

export function createMergeEditors(monaco: any, options: CreateEditorsOptions): MonacoEditors {
  const baseOptions = {
    ...options.monacoOptions,
    theme: options.theme,
    glyphMargin: true,
    stickyScroll: { enabled: false },
    lineNumbersMinChars: 3,
    wordWrap: 'on',
    scrollbar: { ...options.monacoOptions.scrollbar, alwaysConsumeMouseWheel: false },
  };

  return {
    incomingEditor: monaco.editor.create(options.incomingContainer, {
      ...baseOptions,
      readOnly: true,
    }),
    currentEditor: monaco.editor.create(options.currentContainer, {
      ...baseOptions,
      readOnly: true,
    }),
    resultEditor: monaco.editor.create(options.resultContainer, {
      ...baseOptions,
      readOnly: false,
    }),
  };
}

export function bindModelsToEditors(editors: MonacoEditors, models: MonacoModels) {
  editors.incomingEditor.setModel(models.incomingModel);
  editors.currentEditor.setModel(models.currentModel);
  editors.resultEditor.setModel(models.resultModel);
}

export function setupScrollSync(editors: MonacoEditors): any[] {
  const disposables: any[] = [];

  const syncScroll = (source: MonacoEditor) => {
    const top = source.getScrollTop();
    const left = source.getScrollLeft();

    if (source !== editors.incomingEditor) {
      editors.incomingEditor.setScrollTop(top);
      editors.incomingEditor.setScrollLeft(left);
    }
    if (source !== editors.currentEditor) {
      editors.currentEditor.setScrollTop(top);
      editors.currentEditor.setScrollLeft(left);
    }
    if (source !== editors.resultEditor) {
      editors.resultEditor.setScrollTop(top);
      editors.resultEditor.setScrollLeft(left);
    }
  };

  disposables.push(editors.incomingEditor.onDidScrollChange(() => syncScroll(editors.incomingEditor)));
  disposables.push(editors.currentEditor.onDidScrollChange(() => syncScroll(editors.currentEditor)));
  disposables.push(editors.resultEditor.onDidScrollChange(() => syncScroll(editors.resultEditor)));

  return disposables;
}

export function disposeMonacoResources(resources: {
  incomingEditor?: MonacoEditor | null;
  currentEditor?: MonacoEditor | null;
  resultEditor?: MonacoEditor | null;
  compareEditor?: MonacoEditor | null;
  incomingModel?: any;
  currentModel?: any;
  baseModel?: any;
  resultModel?: any;
  subscriptions?: any[];
}) {
  for (const disposable of resources.subscriptions || []) {
    disposable?.dispose?.();
  }

  resources.incomingEditor?.dispose();
  resources.currentEditor?.dispose();
  resources.resultEditor?.dispose();
  resources.compareEditor?.dispose();

  resources.incomingModel?.dispose();
  resources.currentModel?.dispose();
  resources.baseModel?.dispose();
  resources.resultModel?.dispose();
}
