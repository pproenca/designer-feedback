

import { createContext, useContext, useRef, type ReactNode, type Dispatch, type RefObject } from 'react';
import type { ExportFormat } from '@/types';

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
  | { type: 'updateState'; payload: Partial<ExportState> }
  | { type: 'resetStatus' };

export const initialExportState: ExportState = {
  selectedFormat: 'snapshot',
  isExporting: false,
  exportOutcome: null,
  statusMessage: null,
};

export function exportReducer(state: ExportState, action: ExportAction): ExportState {
  switch (action.type) {
    case 'updateState':
      return { ...state, ...action.payload };
    case 'resetStatus':
      return { ...state, statusMessage: null, exportOutcome: null };
    default:
      return state;
  }
}

interface ExportContextValue {

  state: ExportState;
  dispatch: Dispatch<ExportAction>;


  isMarkdownFormat: boolean;
  isSnapshotFormat: boolean;
  isClipboardFormat: boolean;
  statusMessageId: string | undefined;


  formatOptionsRef: RefObject<HTMLDivElement | null>;


  onClose: () => void;
  handleExport: () => Promise<void>;
}

const ExportContext = createContext<ExportContextValue | null>(null);

interface ExportProviderProps {
  children: ReactNode;
  state: ExportState;
  dispatch: Dispatch<ExportAction>;
  onClose: () => void;
  handleExport: () => Promise<void>;
}

export function ExportProvider({
  children,
  state,
  dispatch,
  onClose,
  handleExport,
}: ExportProviderProps) {
  const formatOptionsRef = useRef<HTMLDivElement | null>(null);

  const { selectedFormat, statusMessage } = state;
  const isMarkdownFormat = selectedFormat === 'image-notes';
  const isSnapshotFormat = selectedFormat === 'snapshot';
  const isClipboardFormat = isMarkdownFormat;
  const statusMessageId = statusMessage ? 'df-export-status' : undefined;

  const value: ExportContextValue = {
    state,
    dispatch,
    isMarkdownFormat,
    isSnapshotFormat,
    isClipboardFormat,
    statusMessageId,
    formatOptionsRef,
    onClose,
    handleExport,
  };

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

export function useExportContext(): ExportContextValue {
  const context = useContext(ExportContext);
  if (!context) {
    throw new Error('useExportContext must be used within an ExportProvider');
  }
  return context;
}

export function useExportState() {
  const { state, isMarkdownFormat, isSnapshotFormat, isClipboardFormat, statusMessageId } =
    useExportContext();
  return {
    ...state,
    isMarkdownFormat,
    isSnapshotFormat,
    isClipboardFormat,
    statusMessageId,
  };
}

export function useExportActions() {
  const { dispatch, onClose, handleExport, formatOptionsRef } = useExportContext();
  return { dispatch, onClose, handleExport, formatOptionsRef };
}
