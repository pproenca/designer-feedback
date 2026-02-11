import type {ExportFormat} from '@/types';

export type ExportStatus = {
  type: 'success' | 'warning' | 'error' | 'info';
  text: string;
};

export type ExportState = {
  selectedFormat: ExportFormat;
  isExporting: boolean;
  exportOutcome: 'copied' | 'downloaded' | null;
  statusMessage: ExportStatus | null;
};

export type ExportAction =
  | {type: 'formatSelected'; format: ExportFormat}
  | {type: 'exportStarted'; format: ExportFormat; message: string}
  | {type: 'exportFinished'}
  | {type: 'resetStatus'};

export const initialExportState: ExportState = {
  selectedFormat: 'snapshot',
  isExporting: false,
  exportOutcome: null,
  statusMessage: null,
};

export function exportReducer(
  state: ExportState,
  action: ExportAction
): ExportState {
  switch (action.type) {
    case 'formatSelected':
      return {...state, selectedFormat: action.format};
    case 'exportStarted':
      return {
        ...state,
        isExporting: true,
        exportOutcome: null,
        selectedFormat: action.format,
        statusMessage: {type: 'info', text: action.message},
      };
    case 'exportFinished':
      return {...state, isExporting: false};
    case 'resetStatus':
      return {...state, statusMessage: null, exportOutcome: null};
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
