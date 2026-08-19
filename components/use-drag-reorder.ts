"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pointer-based (mouse + touch) drag-to-reorder for a flat list. Deliberately
 * not the native HTML5 DnD API — most mobile browsers never fire its
 * dragstart from a touch, and this needs to work on both. A drag handle
 * calls the pointer-down handler; while dragging, `onLiveReorder` fires a
 * new array as soon as the pointer crosses a neighboring row's midpoint (so
 * the UI reorders live), and `onCommit` fires once on release with the
 * settled order, for the caller to persist.
 */
export function useDragReorder<T>({
  items,
  getId,
  onLiveReorder,
  onCommit,
}: {
  items: T[];
  getId: (item: T) => string;
  onLiveReorder: (next: T[]) => void;
  onCommit: (next: T[]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const registerRow = useCallback((id: string, el: HTMLElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const handlePointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingId(id);
    },
    []
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    setDraggingId((currentDraggingId) => {
      if (!currentDraggingId) return currentDraggingId;
      const current = itemsRef.current;
      const draggingIndex = current.findIndex((it) => getId(it) === currentDraggingId);
      if (draggingIndex === -1) return currentDraggingId;

      let targetIndex = current.length - 1;
      for (let i = 0; i < current.length; i++) {
        const el = rowRefs.current.get(getId(current[i]));
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex !== draggingIndex) {
        const next = [...current];
        const [moved] = next.splice(draggingIndex, 1);
        next.splice(targetIndex, 0, moved);
        onLiveReorder(next);
      }
      return currentDraggingId;
    });
  }, [getId, onLiveReorder]);

  const handlePointerUp = useCallback(() => {
    setDraggingId((currentDraggingId) => {
      if (currentDraggingId) onCommit(itemsRef.current);
      return null;
    });
  }, [onCommit]);

  return { draggingId, registerRow, handlePointerDown, handlePointerMove, handlePointerUp };
}
