type ContextMenuCreateProperties = Parameters<
  NonNullable<typeof browser.contextMenus>['create']
>[0];

export const CONTEXT_MENU_IDS = {
  root: 'df-root',
  openToolbar: 'df-open-toolbar',
  exportSnapshot: 'df-export-snapshot',
} as const;

const PAGE_CONTEXTS: NonNullable<ContextMenuCreateProperties['contexts']> = [
  'page',
];
const PAGE_URL_PATTERNS: NonNullable<
  ContextMenuCreateProperties['documentUrlPatterns']
> = ['http://*/*', 'https://*/*'];

export type ContextMenuAction = 'open-toolbar' | 'export-snapshot';

export function getContextMenuAction(
  menuItemId: string | number
): ContextMenuAction | null {
  if (menuItemId === CONTEXT_MENU_IDS.openToolbar) {
    return 'open-toolbar';
  }
  if (menuItemId === CONTEXT_MENU_IDS.exportSnapshot) {
    return 'export-snapshot';
  }
  return null;
}

export function createContextMenuDefinitions(): ContextMenuCreateProperties[] {
  return [
    {
      id: CONTEXT_MENU_IDS.root,
      title: 'Designer Feedback',
      contexts: PAGE_CONTEXTS,
      documentUrlPatterns: PAGE_URL_PATTERNS,
    },
    {
      id: CONTEXT_MENU_IDS.openToolbar,
      parentId: CONTEXT_MENU_IDS.root,
      title: 'Open Feedback Toolbar',
      contexts: PAGE_CONTEXTS,
      documentUrlPatterns: PAGE_URL_PATTERNS,
    },
    {
      id: CONTEXT_MENU_IDS.exportSnapshot,
      parentId: CONTEXT_MENU_IDS.root,
      title: 'Export Feedback Snapshot',
      contexts: PAGE_CONTEXTS,
      documentUrlPatterns: PAGE_URL_PATTERNS,
    },
  ];
}
