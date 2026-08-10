"use client";

import { useEffect } from "react";

/**
 * Selector for elements that can receive keyboard focus.
 * `[tabindex="-1"]` is deliberately excluded: such elements are
 * programmatically focusable but must not appear in the tab order.
 */
const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => {
    // offsetParent is null for display:none and for anything inside it, which
    // filters out the collapsed controls this UI hides with `opacity-0` only
    // when they are also removed from layout. Checking visibility as well
    // catches `visibility: hidden`.
    if (el.hasAttribute("inert")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
  });
}

/**
 * Confines keyboard focus to an overlay while it is open.
 *
 * Without this, Tab walks straight out of a modal into the page behind it —
 * the user keeps typing but can no longer see where focus is, and screen
 * reader users are silently returned to content the dialog is covering.
 *
 * On activate: remembers the trigger, moves focus into the overlay, and locks
 * body scroll. While active: wraps Tab / Shift+Tab at the boundaries and calls
 * `onEscape` if provided. On deactivate: restores focus to the trigger, so the
 * user resumes from where they left off rather than at the top of the page.
 *
 * Pass `onEscape: undefined` for overlays that must not be dismissible — an
 * in-flight operation, for instance, where a stray keypress would lose work.
 */
export function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  onEscape?: () => void,
): void {
  useEffect(() => {
    if (!isActive) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus inside. Fall back to the container itself so focus never
    // stays behind the overlay when it holds no tabbable content yet.
    const initial = tabbablesIn(container);
    if (initial.length > 0) {
      initial[0].focus();
    } else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;

      // Recomputed per keystroke: overlay contents change as the user types
      // (file lists grow, conditional sections appear).
      const tabbables = tabbablesIn(container);
      if (tabbables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Only restore if the trigger is still in the document; it may have been
      // unmounted by the action the overlay performed.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [ref, isActive, onEscape]);
}
