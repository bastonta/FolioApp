import { useEffect, useRef } from 'react';

export type BackHandler = () => boolean;

interface RegisteredHandler {
  id: number;
  handler: BackHandler;
  priority: number;
}

class BackHandlerManager {
  private handlers: RegisteredHandler[] = [];
  private nextId = 1;

  register(handler: BackHandler, priority: number = 0): () => void {
    const id = this.nextId++;
    this.handlers.push({ id, handler, priority });
    // Sort descending by priority (highest priority first), then newest first
    this.handlers.sort((a, b) => b.priority - a.priority || b.id - a.id);

    return () => {
      this.handlers = this.handlers.filter((h) => h.id !== id);
    };
  }

  handleBack(): boolean {
    for (const item of this.handlers) {
      try {
        if (item.handler()) {
          return true;
        }
      } catch (e) {
        console.warn('Error in back handler:', e);
      }
    }
    return false;
  }
}

export const backHandlerManager = new BackHandlerManager();

// Expose handleAndroidBack to window for Android WebView bridge
if (typeof window !== 'undefined') {
  (window as any).handleAndroidBack = () => {
    return backHandlerManager.handleBack();
  };

  // Also support Escape key across the entire application for keyboard/desktop users
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        if (backHandlerManager.handleBack()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    { capture: true }
  );
}

/**
 * React hook to register a back action handler.
 * Handler should return `true` if the back action was consumed, or `false` to pass to the next handler.
 * Higher priority handlers execute first.
 */
export function useBackHandler(
  handler: BackHandler,
  active: boolean = true,
  priority: number = 0
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    return backHandlerManager.register(() => handlerRef.current(), priority);
  }, [active, priority]);
}
