import {useCallback, useRef} from 'react';

type InlineStyleSnapshot = {
  value: string;
  priority: string;
};

type HostStyleSnapshot = {
  display: InlineStyleSnapshot;
  opacity: InlineStyleSnapshot;
  pointerEvents: InlineStyleSnapshot;
  visibility: InlineStyleSnapshot;
  transition: InlineStyleSnapshot;
};

function readInlineStyle(
  style: CSSStyleDeclaration,
  property: string
): InlineStyleSnapshot {
  return {
    value: style.getPropertyValue(property),
    priority: style.getPropertyPriority(property),
  };
}

function restoreInlineStyle(
  style: CSSStyleDeclaration,
  property: string,
  snapshot: InlineStyleSnapshot
): void {
  if (!snapshot.value) {
    style.removeProperty(property);
    return;
  }
  style.setProperty(property, snapshot.value, snapshot.priority);
}

export function useCaptureMode(
  shadowRoot: ShadowRoot,
  onCaptureChange?: (isCapturing: boolean) => void
): (isCapturing: boolean) => void {
  const hostStyleSnapshotRef = useRef<HostStyleSnapshot | null>(null);

  const setCaptureMode = useCallback(
    (isCapturing: boolean) => {
      onCaptureChange?.(isCapturing);
      const host = shadowRoot.host as HTMLElement | null;
      if (!host) {
        return;
      }
      const hostStyle = host.style;
      if (isCapturing) {
        if (!hostStyleSnapshotRef.current) {
          hostStyleSnapshotRef.current = {
            display: readInlineStyle(hostStyle, 'display'),
            opacity: readInlineStyle(hostStyle, 'opacity'),
            pointerEvents: readInlineStyle(hostStyle, 'pointer-events'),
            visibility: readInlineStyle(hostStyle, 'visibility'),
            transition: readInlineStyle(hostStyle, 'transition'),
          };
        }
        host.setAttribute('data-capture', 'true');
        hostStyle.setProperty('display', 'none', 'important');
        hostStyle.setProperty('opacity', '0', 'important');
        hostStyle.setProperty('pointer-events', 'none', 'important');
        hostStyle.setProperty('visibility', 'hidden', 'important');
        hostStyle.setProperty('transition', 'none', 'important');
      } else {
        host.removeAttribute('data-capture');
        const snapshot = hostStyleSnapshotRef.current;
        if (snapshot) {
          restoreInlineStyle(hostStyle, 'display', snapshot.display);
          restoreInlineStyle(hostStyle, 'opacity', snapshot.opacity);
          restoreInlineStyle(
            hostStyle,
            'pointer-events',
            snapshot.pointerEvents
          );
          restoreInlineStyle(hostStyle, 'visibility', snapshot.visibility);
          restoreInlineStyle(hostStyle, 'transition', snapshot.transition);
          hostStyleSnapshotRef.current = null;
        }
      }
    },
    [onCaptureChange, shadowRoot]
  );

  return setCaptureMode;
}
