/**
 * useKeyboardShortcuts — Agent desktop keyboard shortcuts
 *
 * Technical approach:
 * - Global keydown listener with modifier key detection (Ctrl/Cmd + key)
 * - Shortcuts scoped to agent role only (safe to register globally)
 * - Returned `activeShortcut` state allows UI to show pressed shortcut briefly
 *
 * Available shortcuts:
 *   Ctrl+K / Cmd+K  — Focus customer search / selector
 *   Ctrl+N          — New hazard report
 *   Ctrl+S          — Save current agent notes
 *   Ctrl+R          — Refresh weather alerts
 *   Ctrl+1..4       — Quick actions (Call, REACH, PSPS Alert, Note)
 *   ?               — Show shortcuts help overlay
 */

import { useEffect, useState, useCallback } from "react";

export interface Shortcut {
  key: string;
  description: string;
  modifier?: "ctrl" | "shift";
}

export const SHORTCUTS: Shortcut[] = [
  { key: "k",  modifier: "ctrl", description: "Focus customer selector" },
  { key: "n",  modifier: "ctrl", description: "New hazard report" },
  { key: "s",  modifier: "ctrl", description: "Save agent notes" },
  { key: "r",  modifier: "ctrl", description: "Refresh weather alerts" },
  { key: "1",  modifier: "ctrl", description: "Quick action: Call Customer" },
  { key: "2",  modifier: "ctrl", description: "Quick action: Apply REACH" },
  { key: "3",  modifier: "ctrl", description: "Quick action: PSPS Alert" },
  { key: "4",  modifier: "ctrl", description: "Quick action: Add Note" },
  { key: "?",  description: "Show keyboard shortcuts" },
];

interface ShortcutHandlers {
  onFocusSearch?: () => void;
  onNewHazard?: () => void;
  onSaveNotes?: () => void;
  onRefreshAlerts?: () => void;
  onQuickAction?: (n: 1 | 2 | 3 | 4) => void;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const flash = useCallback((key: string) => {
    setActiveShortcut(key);
    setTimeout(() => setActiveShortcut(null), 800);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) {
        // Only allow Ctrl+S (save notes) inside textarea
        if (!(e.ctrlKey && e.key === "s" && tag === "textarea")) return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      if (e.key === "?") {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        handlers.onShowHelp?.();
        flash("?");
        return;
      }

      if (ctrl && e.key === "k") {
        e.preventDefault();
        handlers.onFocusSearch?.();
        flash("Ctrl+K");
        return;
      }

      if (ctrl && e.key === "n") {
        e.preventDefault();
        handlers.onNewHazard?.();
        flash("Ctrl+N");
        return;
      }

      if (ctrl && e.key === "s") {
        e.preventDefault();
        handlers.onSaveNotes?.();
        flash("Ctrl+S");
        return;
      }

      if (ctrl && e.key === "r") {
        e.preventDefault();
        handlers.onRefreshAlerts?.();
        flash("Ctrl+R");
        return;
      }

      if (ctrl && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        handlers.onQuickAction?.(Number(e.key) as 1 | 2 | 3 | 4);
        flash(`Ctrl+${e.key}`);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handlers, flash]);

  return { activeShortcut, showHelp, setShowHelp };
}
