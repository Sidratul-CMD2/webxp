import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FsState } from '../domain/fs';
import { treeChildren, treeRoot, type TreeChild } from '../state/tree';
import { Icon } from './icons';

interface VisibleNode {
  key: string;
  node: TreeChild;
  level: number;
  parentKey: string | null;
  expanded: boolean;
  expandable: boolean;
  isLast: boolean;
  lines: boolean[];
  pos: number;
  size: number;
}

interface FolderTreeProps {
  fs: FsState;
  expanded: readonly string[];
  selectedKey: string | null;
  onToggle: (key: string, expand?: boolean) => void;
  onSelect: (key: string, node: TreeChild) => void;
  label: string;
  /** Hide nodes (and their subtrees) that fail this test. */
  include?: (node: TreeChild) => boolean;
  /** Mark nodes as unavailable (shown dimmed, still navigable). */
  dim?: (node: TreeChild) => boolean;
  /** Folder IDs that accept drops, for drag-and-drop targets. */
  dropTarget?: (node: TreeChild) => string | null;
  /** Nodes that act as the Recycle Bin drop target. */
  dropBin?: (node: TreeChild) => boolean;
  className?: string;
}

export function FolderTree({ fs, expanded, selectedKey, onToggle, onSelect, label, include, dim, dropTarget, dropBin, className }: FolderTreeProps) {
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const ref = useRef<HTMLUListElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  const visible = useMemo(() => {
    const out: VisibleNode[] = [];
    const walk = (node: TreeChild, key: string, level: number, parentKey: string | null, pos: number, size: number, lines: boolean[]) => {
      const kids = treeChildren(fs, node.id).filter((c) => !include || include(c));
      const isOpen = expandedSet.has(key) && kids.length > 0;
      const isLast = pos === size;
      out.push({ key, node, level, parentKey, expanded: isOpen, expandable: kids.length > 0, isLast, lines, pos, size });
      if (isOpen) kids.forEach((c, i) => walk(c, `${key}/${c.id}`, level + 1, key, i + 1, kids.length, [...lines, !isLast]));
    };
    walk(treeRoot(), 'desktop', 1, null, 1, 1, []);
    return out;
  }, [fs, expandedSet, include]);

  const current = visible.find((v) => v.key === focusKey) ?? visible.find((v) => v.key === selectedKey) ?? visible[0];

  useEffect(() => {
    if (!keyboardFocus || !current) return;
    ref.current?.querySelector<HTMLElement>(`[data-tree-key="${CSS.escape(current.key)}"]`)?.focus();
  }, [current, keyboardFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!current) return;
    const i = visible.indexOf(current);
    let next: VisibleNode | undefined;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        next = visible[i + 1];
        break;
      case 'ArrowUp':
        next = visible[i - 1];
        break;
      case 'Home':
        next = visible[0];
        break;
      case 'End':
        next = visible[visible.length - 1];
        break;
      case 'ArrowRight':
        if (current.expandable && !current.expanded) onToggle(current.key, true);
        else if (current.expanded) next = visible[i + 1];
        break;
      case 'ArrowLeft':
        if (current.expanded) onToggle(current.key, false);
        else next = visible.find((v) => v.key === current.parentKey);
        break;
      case 'Enter':
      case ' ':
        onSelect(current.key, current.node);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const k = e.key.toLowerCase();
          const after = [...visible.slice(i + 1), ...visible.slice(0, i + 1)];
          next = after.find((v) => v.node.label.toLowerCase().startsWith(k));
        } else handled = false;
    }
    if (next) {
      setKeyboardFocus(true);
      setFocusKey(next.key);
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <ul ref={ref} role="tree" aria-label={label} className={`xp-tree${className ? ` ${className}` : ''}`} onKeyDown={onKeyDown}>
      {visible.map((v) => {
        const selected = v.key === selectedKey;
        const isFocus = v === current;
        const drop = dropTarget?.(v.node) ?? null;
        return (
          <li
            key={v.key}
            role="treeitem"
            aria-level={v.level}
            aria-setsize={v.size}
            aria-posinset={v.pos}
            aria-expanded={v.expandable ? v.expanded : undefined}
            aria-selected={selected}
            tabIndex={isFocus ? 0 : -1}
            data-tree-key={v.key}
            data-drop-folder={drop ?? undefined}
            data-drop-bin={dropBin?.(v.node) ? '' : undefined}
            className={`xp-tree__row${selected ? ' is-selected' : ''}${dim?.(v.node) ? ' is-dim' : ''}`}
            onFocus={(e) => {
              if (e.target === e.currentTarget) setFocusKey(v.key);
            }}
            onClick={() => {
              setKeyboardFocus(false);
              setFocusKey(v.key);
              onSelect(v.key, v.node);
            }}
            onDoubleClick={() => v.expandable && onToggle(v.key)}
          >
            {v.lines.slice(1).map((line, li) => (
              <span key={li} className={`xp-tree__indent${line ? ' has-line' : ''}`} aria-hidden="true" />
            ))}
            {v.level > 1 && (
              <span className={`xp-tree__branch${v.isLast ? ' is-last' : ''}`} aria-hidden="true">
                {v.expandable && (
                  <span
                    className={`xp-tree__toggle${v.expanded ? ' is-open' : ''}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggle(v.key);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                )}
              </span>
            )}
            <span className="xp-tree__label">
              <Icon name={v.node.icon} size={16} />
              <span className="xp-tree__text">{v.node.label}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
