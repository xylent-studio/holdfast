import type { ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function Modal({ children, isOpen, onClose, title }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
