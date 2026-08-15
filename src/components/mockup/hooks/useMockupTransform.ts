import { useState, useRef, useEffect, useCallback } from 'react';
import { PrintArea } from '@/types/pod';

export type DragMode = 'move' | 'resize-se' | 'rotate';

interface UseMockupTransformProps {
  activePrintArea: PrintArea | undefined;
  updateActivePrintAreaDraft: (updates: Partial<PrintArea>) => void;
}

export function useMockupTransform({
  activePrintArea,
  updateActivePrintAreaDraft,
}: UseMockupTransformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeAreaRef = useRef<HTMLDivElement>(null);
  const dragValuesRef = useRef<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
  } | null>(null);

  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [dragStart, setDragStart] = useState<{
    mouseX: number;
    mouseY: number;
    area: PrintArea;
    startAngleDeg?: number;
    startRotation?: number;
    boxCenterX?: number;
    boxCenterY?: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (!activePrintArea) return;
      e.stopPropagation();
      e.preventDefault();
      setDragMode(mode);

      if (mode === 'rotate' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const containerW = rect.width;
        const containerH = rect.height;
        const boxCenterX =
          rect.left + ((activePrintArea.x + activePrintArea.width / 2) / 100) * containerW;
        const boxCenterY =
          rect.top + ((activePrintArea.y + activePrintArea.height / 2) / 100) * containerH;
        const rad = Math.atan2(e.clientY - boxCenterY, e.clientX - boxCenterX);
        const startAngleDeg = (rad * 180) / Math.PI;

        setDragStart({
          mouseX: e.clientX,
          mouseY: e.clientY,
          area: { ...activePrintArea },
          startAngleDeg,
          startRotation: activePrintArea.rotation || 0,
          boxCenterX,
          boxCenterY,
        });
      } else {
        setDragStart({
          mouseX: e.clientX,
          mouseY: e.clientY,
          area: { ...activePrintArea },
        });
      }
    },
    [activePrintArea]
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragMode || !dragStart || !containerRef.current || !activeAreaRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;
      if (containerW <= 0 || containerH <= 0) return;

      const deltaXPercent = ((e.clientX - dragStart.mouseX) / containerW) * 100;
      const deltaYPercent = ((e.clientY - dragStart.mouseY) / containerH) * 100;

      if (!dragValuesRef.current) dragValuesRef.current = {};
      const el = activeAreaRef.current;
      const v = dragValuesRef.current;

      if (dragMode === 'move') {
        const newX = Math.max(
          0,
          Math.min(100 - dragStart.area.width, dragStart.area.x + deltaXPercent)
        );
        const newY = Math.max(
          0,
          Math.min(100 - dragStart.area.height, dragStart.area.y + deltaYPercent)
        );
        el.style.left = `${newX}%`;
        el.style.top = `${newY}%`;
        v.x = newX;
        v.y = newY;
      } else if (dragMode === 'resize-se') {
        const newW = Math.max(
          10,
          Math.min(100 - dragStart.area.x, dragStart.area.width + deltaXPercent)
        );
        const newH = Math.max(
          10,
          Math.min(100 - dragStart.area.y, dragStart.area.height + deltaYPercent)
        );
        el.style.width = `${newW}%`;
        el.style.height = `${newH}%`;
        v.width = newW;
        v.height = newH;
      } else if (
        dragMode === 'rotate' &&
        dragStart.boxCenterX !== undefined &&
        dragStart.boxCenterY !== undefined
      ) {
        const rad = Math.atan2(e.clientY - dragStart.boxCenterY, e.clientX - dragStart.boxCenterX);
        const currentAngleDeg = (rad * 180) / Math.PI;
        const deltaDeg = currentAngleDeg - (dragStart.startAngleDeg || 0);

        let newRotation = Math.round((dragStart.startRotation || 0) + deltaDeg);
        while (newRotation > 180) newRotation -= 360;
        while (newRotation < -180) newRotation += 360;

        el.style.transform = `rotate(${newRotation}deg)`;
        v.rotation = newRotation;
      }
    };

    const handlePointerUp = () => {
      if (dragMode && dragValuesRef.current) {
        const v = dragValuesRef.current;
        const updates: Partial<PrintArea> = {};
        if (v.x !== undefined) updates.x = Math.round(v.x * 10) / 10;
        if (v.y !== undefined) updates.y = Math.round(v.y * 10) / 10;
        if (v.width !== undefined) updates.width = Math.round(v.width * 10) / 10;
        if (v.height !== undefined) updates.height = Math.round(v.height * 10) / 10;
        if (v.rotation !== undefined) updates.rotation = v.rotation;
        updateActivePrintAreaDraft(updates);
      }
      setDragMode(null);
      setDragStart(null);
      dragValuesRef.current = null;
    };

    if (dragMode) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragMode, dragStart, updateActivePrintAreaDraft]);

  return {
    containerRef,
    activeAreaRef,
    dragMode,
    handlePointerDown,
  };
}
