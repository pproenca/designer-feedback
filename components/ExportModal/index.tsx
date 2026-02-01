import {useReducer, useEffect, useMemo, useCallback, useState} from 'react';
import {
  m,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import {Dialog} from '@base-ui/react/dialog';
import type {Annotation, ExportFormat} from '@/types';
import {exportAsImageWithNotes, exportAsSnapshotImage} from '@/utils/export';
import {
  isRestrictedPage,
  isActiveTabRequiredError,
} from '@/utils/dom/screenshot';
import {X, Copy, Image} from 'lucide-react';
import {clsx} from 'clsx';
import {FormatSelector, type ExportFormatOption} from './FormatSelector';
import {AnnotationPreview} from './AnnotationPreview';
import {ExportActions} from './ExportActions';
import {
  ExportProvider,
  exportReducer,
  initialExportState,
} from './ExportContext';
import {useSettings} from '@/hooks/useSettings';
import {useToasts, type ToastInput} from '@/components/Toast';

const EMIL_EASE_OUT: [number, number, number, number] = [0.32, 0.72, 0, 1];
const EMIL_EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];

const getOverlayVariants = (reduceMotion: boolean): Variants => ({
  hidden: {opacity: 0},
  visible: {
    opacity: 1,
    transition: {duration: reduceMotion ? 0.1 : 0.15, ease: EMIL_EASE_OUT},
  },
  exit: {
    opacity: 0,
    transition: {duration: reduceMotion ? 0.08 : 0.1, ease: EMIL_EASE_IN},
  },
});

const getModalVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : {y: 8, scale: 0.96}),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : {y: 0, scale: 1}),
    transition: {
      duration: reduceMotion ? 0.12 : 0.2,
      ease: EMIL_EASE_OUT,
    },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : {y: -4, scale: 0.98}),
    transition: {duration: reduceMotion ? 0.08 : 0.1, ease: EMIL_EASE_IN},
  },
});

interface ExportModalProps {
  annotations: Annotation[];
  onClose: () => void;
  onCaptureChange?: (isCapturing: boolean) => void;
  shadowRoot: ShadowRoot;
  autoStartFormat?: ExportFormat;
  onAutoStartConsumed?: () => void;
  onPermissionRequired?: (format: ExportFormat) => void;
}

export function ExportModal({
  annotations,
  onClose,
  onCaptureChange,
  shadowRoot,
  autoStartFormat,
  onAutoStartConsumed,
  onPermissionRequired,
}: ExportModalProps) {
  const {settings} = useSettings();
  const lightMode = settings.lightMode;
  const [isDialogOpen, setDialogOpen] = useState(true);
  const [state, dispatch] = useReducer(exportReducer, initialExportState);
  const reduceMotion = useReducedMotion() ?? false;
  const {pushToast} = useToasts();
  const overlayVariants = useMemo(
    () => getOverlayVariants(reduceMotion),
    [reduceMotion]
  );
  const modalVariants = useMemo(
    () => getModalVariants(reduceMotion),
    [reduceMotion]
  );
  const {isExporting, statusMessage, selectedFormat} = state;
  const themeClassName = lightMode ? '' : 'dark';

  const restricted = isRestrictedPage();

  const formatOptions: ExportFormatOption[] = useMemo(
    () => [
      {
        id: 'image-notes',
        label: 'Markdown (Clipboard)',
        description: 'Copies a concise markdown report to your clipboard.',
        icon: <Copy size={18} aria-hidden="true" />,
      },
      {
        id: 'snapshot',
        label: 'Snapshot (Download)',
        description: restricted
          ? 'Not available on browser pages (chrome://, about:, etc.)'
          : 'Full-page image with highlights and details sidebar.',
        icon: <Image size={18} aria-hidden="true" />,
        disabled: restricted,
        disabledHint: 'Not available on browser pages',
      },
    ],
    [restricted]
  );
  const dialogCloseDelayMs = reduceMotion ? 80 : 160;
  const captureDelayMs = reduceMotion ? 40 : 140;
  const toastDelayMs = reduceMotion ? 0 : 80;

  useEffect(() => {
    if (restricted && selectedFormat === 'snapshot') {
      dispatch({type: 'updateState', payload: {selectedFormat: 'image-notes'}});
    }
  }, [restricted, selectedFormat]);

  const getReadableError = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    return 'Export failed. Please try again.';
  };

  const closeDialogForCapture = useCallback(async () => {
    setDialogOpen(false);
    await new Promise(resolve => setTimeout(resolve, dialogCloseDelayMs));
  }, [dialogCloseDelayMs]);

  const runExport = useCallback(
    async (overrideFormat?: ExportFormat) => {
      const format = overrideFormat ?? selectedFormat;
      dispatch({
        type: 'updateState',
        payload: {
          isExporting: true,
          exportOutcome: null,
          selectedFormat: format,
          statusMessage: {
            type: 'info',
            text:
              format === 'snapshot'
                ? 'Capturing full page…'
                : 'Preparing export…',
          },
        },
      });
      let captureActive = false;
      let pendingToast: ToastInput | null = null;
      try {
        if (format === 'snapshot') {
          await closeDialogForCapture();
          captureActive = true;
          onCaptureChange?.(true);
          await new Promise(resolve => setTimeout(resolve, captureDelayMs));
          const result = await exportAsSnapshotImage(annotations);
          pendingToast =
            result.captureMode === 'full'
              ? {type: 'success', message: 'Snapshot downloaded.'}
              : {
                  type: 'error',
                  message:
                    result.captureMode === 'viewport'
                      ? 'Snapshot captured, but only the visible area was saved.'
                      : 'Snapshot failed. The screenshot was unavailable.',
                };
          onClose();
          return;
        } else {
          await exportAsImageWithNotes(annotations);
          pendingToast = {
            type: 'success',
            message: 'Markdown copied to clipboard.',
          };
          onClose();
        }
      } catch (error) {
        if (isActiveTabRequiredError(error) && format === 'snapshot') {
          onPermissionRequired?.(format);
          pendingToast = {
            type: 'warning',
            message:
              'Click the extension icon (or use the keyboard shortcut) to allow capture.',
          };
          onClose();
          return;
        }
        console.error('Export failed:', error);
        pendingToast = {type: 'error', message: getReadableError(error)};
        onClose();
      } finally {
        if (captureActive) {
          onCaptureChange?.(false);
        }
        if (pendingToast) {
          const toast = pendingToast;
          window.setTimeout(
            () => pushToast(toast),
            captureActive ? toastDelayMs : 0
          );
        }
        dispatch({type: 'updateState', payload: {isExporting: false}});
      }
    },
    [
      annotations,
      captureDelayMs,
      closeDialogForCapture,
      onCaptureChange,
      onClose,
      onPermissionRequired,
      pushToast,
      selectedFormat,
      toastDelayMs,
    ]
  );

  const handleExport = useCallback(async () => {
    await runExport();
  }, [runExport]);

  useEffect(() => {
    if (!autoStartFormat) return;
    onAutoStartConsumed?.();
    void runExport(autoStartFormat);
  }, [autoStartFormat, onAutoStartConsumed, runExport]);

  const statusMessageId = statusMessage ? 'df-export-status' : undefined;

  return (
    <Dialog.Root
      open={isDialogOpen}
      onOpenChange={open => {
        setDialogOpen(open);
        if (!open && !isExporting) {
          onClose();
        }
      }}
    >
      <Dialog.Portal container={shadowRoot}>
        <AnimatePresence>
          <Dialog.Backdrop
            key="df-export-backdrop"
            render={
              <m.div
                className={clsx(
                  'fixed inset-0 z-modal',
                  'bg-white/90 dark:bg-black/80',
                  themeClassName
                )}
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              />
            }
          />
          <Dialog.Popup
            key="df-export-popup"
            render={
              <m.div
                className={clsx(
                  'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                  'z-modal rounded-2xl w-11/12 max-w-100 max-h-[80vh] overflow-hidden overscroll-contain',
                  'flex flex-col font-sans',
                  'bg-white shadow-modal',
                  'dark:bg-df-dark-strong dark:shadow-modal-dark',
                  themeClassName
                )}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              />
            }
            aria-describedby={statusMessageId}
            aria-busy={isExporting}
          >
            {/* Header */}
            <div
              className={clsx(
                'flex items-center justify-between py-4 px-4.5 pb-3',
                'border-b border-black/8 dark:border-white/8'
              )}
            >
              <Dialog.Title
                className={clsx(
                  'text-base font-semibold m-0 tracking-normal',
                  'text-df-ink dark:text-white'
                )}
              >
                Export Feedback
              </Dialog.Title>
              <Dialog.Close
                className={clsx(
                  'flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer',
                  'transition-interactive',
                  'focus-ring',
                  'text-muted-strong hover:bg-black/5 hover:text-df-ink hover:-translate-y-px',
                  'dark:hover:bg-white/8 dark:hover:text-white'
                )}
                aria-label="Close export dialog"
              >
                <X size={18} />
              </Dialog.Close>
            </div>

            {/* Content - wrapped with ExportProvider for child components */}
            <ExportProvider
              state={state}
              dispatch={dispatch}
              onClose={onClose}
              handleExport={handleExport}
            >
              <div className="py-4 px-4.5 pb-4.5 overflow-y-auto flex-1">
                <FormatSelector options={formatOptions} />
                <AnnotationPreview annotations={annotations} />
              </div>

              <ExportActions />
            </ExportProvider>
          </Dialog.Popup>
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
