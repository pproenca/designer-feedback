export interface MountedToolbar {
  remove(): void;
}

export interface ToolbarLifecycle {
  enable(): Promise<void>;
  disable(): void;
  dispose(): void;
}

export function createToolbarLifecycle(
  mountToolbar: () => Promise<MountedToolbar>
): ToolbarLifecycle {
  let mountedToolbar: MountedToolbar | null = null;
  let mountingToolbar: Promise<MountedToolbar | null> | null = null;
  let shouldBeEnabled = false;
  let disposed = false;

  const safeRemove = (toolbar: MountedToolbar): void => {
    try {
      toolbar.remove();
    } catch (error) {
      console.error('Failed to remove toolbar UI:', error);
    }
  };

  async function enable(): Promise<void> {
    if (disposed) {
      return;
    }

    shouldBeEnabled = true;

    if (mountedToolbar) {
      return;
    }

    if (!mountingToolbar) {
      mountingToolbar = mountToolbar()
        .then(toolbar => {
          if (disposed || !shouldBeEnabled) {
            safeRemove(toolbar);
            return null;
          }
          mountedToolbar = toolbar;
          return toolbar;
        })
        .finally(() => {
          mountingToolbar = null;
        });
    }

    await mountingToolbar;
  }

  function disable(): void {
    shouldBeEnabled = false;

    if (!mountedToolbar) {
      return;
    }

    const toolbar = mountedToolbar;
    mountedToolbar = null;
    safeRemove(toolbar);
  }

  function dispose(): void {
    disposed = true;
    disable();
  }

  return {
    enable,
    disable,
    dispose,
  };
}
