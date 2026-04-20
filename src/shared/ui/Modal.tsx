import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

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
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [closeOnEscape, isOpen, onClose]);

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
