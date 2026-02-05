import {describe, expect, it} from 'vitest';
import {
  CONTEXT_MENU_IDS,
  createContextMenuDefinitions,
  getContextMenuAction,
} from './context-menu';

describe('context menu', () => {
  describe('createContextMenuDefinitions', () => {
    it('creates a grouped page menu with open and export actions', () => {
      const items = createContextMenuDefinitions();
      expect(items).toHaveLength(3);

      expect(items[0]).toMatchObject({
        id: CONTEXT_MENU_IDS.root,
        title: 'Designer Feedback',
        contexts: ['page'],
      });

      expect(items[1]).toMatchObject({
        id: CONTEXT_MENU_IDS.openToolbar,
        parentId: CONTEXT_MENU_IDS.root,
        title: 'Open Feedback Toolbar',
        contexts: ['page'],
      });

      expect(items[2]).toMatchObject({
        id: CONTEXT_MENU_IDS.exportSnapshot,
        parentId: CONTEXT_MENU_IDS.root,
        title: 'Export Feedback Snapshot',
        contexts: ['page'],
      });

      for (const item of items) {
        expect(item.documentUrlPatterns).toEqual(['http://*/*', 'https://*/*']);
      }
    });
  });

  describe('getContextMenuAction', () => {
    it('maps the open toolbar menu item id', () => {
      expect(getContextMenuAction(CONTEXT_MENU_IDS.openToolbar)).toBe(
        'open-toolbar'
      );
    });

    it('maps the export snapshot menu item id', () => {
      expect(getContextMenuAction(CONTEXT_MENU_IDS.exportSnapshot)).toBe(
        'export-snapshot'
      );
    });

    it('returns null for unknown menu ids', () => {
      expect(getContextMenuAction(CONTEXT_MENU_IDS.root)).toBeNull();
      expect(getContextMenuAction('unknown-id')).toBeNull();
      expect(getContextMenuAction(123)).toBeNull();
    });
  });
});
