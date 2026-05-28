import { useEffect, useRef, RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus inside `containerRef` while the component is mounted.
 * - Focuses the first focusable element on mount.
 * - Wraps Tab / Shift+Tab at the container boundaries.
 * - Calls `onEscape` when Escape is pressed.
 * - Restores focus to the previously-focused element on unmount.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, onEscape?: () => void) {
  // Keep onEscape in a ref so the document listener never stales.
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))

    // Focus the first focusable element inside the dialog.
    getFocusable()[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscapeRef.current?.()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, []) // intentionally empty — runs once on mount, cleans up on unmount
}
