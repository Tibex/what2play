'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  eachDateKeyInRange,
  formatDateKey,
  parseDateKeyLocal,
} from '@/lib/schedulePollDates';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type DragState = {
  anchor: string;
  mode: 'select' | 'deselect';
  base: Set<string>;
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function applyRange(
  anchor: string,
  end: string,
  base: Set<string>,
  mode: 'select' | 'deselect',
): string[] {
  const keys = eachDateKeyInRange(anchor, end);
  const next = new Set(base);
  for (const k of keys) {
    if (mode === 'select') next.add(k);
    else next.delete(k);
  }
  return [...next].sort();
}

type DragSelectCalendarProps = {
  selectedKeys: string[];
  onChange: (sortedKeys: string[]) => void;
};

export default function DragSelectCalendar({
  selectedKeys,
  onChange,
}: Readonly<DragSelectCalendarProps>) {
  const [cursorMonth, setCursorMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const dragRef = useRef<DragState | null>(null);
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  useEffect(() => {
    const clear = () => {
      dragRef.current = null;
    };
    globalThis.window.addEventListener('pointerup', clear);
    globalThis.window.addEventListener('pointercancel', clear);
    return () => {
      globalThis.window.removeEventListener('pointerup', clear);
      globalThis.window.removeEventListener('pointercancel', clear);
    };
  }, []);

  const gridCells = useMemo(() => {
    const y = cursorMonth.getFullYear();
    const m = cursorMonth.getMonth();
    const first = new Date(y, m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const cells: { key: string | null; inMonth: boolean }[] = [];
    for (let i = 0; i < startPad; i++) {
      cells.push({ key: null, inMonth: false });
    }
    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(y, m, day);
      cells.push({ key: formatDateKey(d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: null, inMonth: false });
    }
    while (cells.length < 42) {
      cells.push({ key: null, inMonth: false });
    }
    return cells;
  }, [cursorMonth]);

  const onCellPointerDown = useCallback(
    (key: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const base = new Set(selectedSet);
      const was = base.has(key);
      const mode = was ? 'deselect' : 'select';
      dragRef.current = { anchor: key, mode, base };
      onChange(applyRange(key, key, dragRef.current.base, mode));
    },
    [onChange, selectedSet],
  );

  const onCellPointerEnter = useCallback(
    (key: string, e: React.PointerEvent) => {
      if (e.buttons !== 1) return;
      const d = dragRef.current;
      if (!d) return;
      onChange(applyRange(d.anchor, key, d.base, d.mode));
    },
    [onChange],
  );

  const label = cursorMonth.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--paper-strong)] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--surface-hover)]"
          onClick={() => setCursorMonth((c) => addMonths(c, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">{label}</span>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--surface-hover)]"
          onClick={() => setCursorMonth((c) => addMonths(c, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <p className="text-xs text-[var(--muted)] mb-2">
        Click or click-drag across days to select. Drag again over selected days to remove them.
      </p>
      <div
        className="grid grid-cols-7 gap-1 select-none"
        role="grid"
        aria-label="Select days"
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-medium text-[var(--muted)] py-1"
          >
            {w}
          </div>
        ))}
        {gridCells.map((cell, i) => {
          if (!cell.key) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }
          const selected = selectedSet.has(cell.key);
          const today = formatDateKey(new Date()) === cell.key;
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              aria-pressed={selected}
              data-date={cell.key}
              onPointerDown={(e) => onCellPointerDown(cell.key!, e)}
              onPointerEnter={(e) => onCellPointerEnter(cell.key!, e)}
              className={[
                'aspect-square rounded-lg text-sm font-medium transition-colors border',
                selected
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--paper)] border-[var(--border)] hover:border-[var(--primary)]',
                today && !selected ? 'ring-2 ring-[var(--accent)]/40' : '',
              ].join(' ')}
            >
              {parseDateKeyLocal(cell.key).getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={() => onChange([])}
        >
          Clear all days
        </button>
      </div>
    </div>
  );
}
