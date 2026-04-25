import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalProps {
  children: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function Modal({
  children,
  closeOnBackdrop = false,
  closeOnEscape = true,
  isOpen,
  onClose,
  title,
}: ModalProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTimer = window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (
        !(activeElement instanceof HTMLElement) ||
        !sheetRef.current?.contains(activeElement)
      ) {
        sheetRef.current?.focus();
      }
    });
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !sheetRef.current) {
        return;
      }

      const focusableElements = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true' &&
          element.tabIndex >= 0 &&
          window.getComputedStyle(element).display !== 'none' &&
          window.getComputedStyle(element).visibility !== 'hidden',
      );

      if (!focusableElements.length) {
        event.preventDefault();
        sheetRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0]!;
      const lastElement = focusableElements[focusableElements.length - 1]!;
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (!activeElement || activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [closeOnEscape, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="modal-root"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
    >
      <div
        className="modal-sheet"
        onClick={(event) => event.stopPropagation()}
        ref={sheetRef}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
