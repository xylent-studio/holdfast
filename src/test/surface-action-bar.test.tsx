import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SurfaceActionSpec } from '@/domain/logic/surface-actions';
import { SurfaceActionBar } from '@/shared/ui/SurfaceActionBar';

const actions: SurfaceActionSpec[] = [
  { id: 'schedule', label: 'Schedule', priority: 'primary', tone: 'accent' },
  { id: 'bring-to-now', label: 'Bring to Now', priority: 'secondary', tone: 'ghost' },
  {
    id: 'move-to-waiting',
    label: 'Move to Waiting on',
    priority: 'overflow',
    tone: 'ghost',
  },
  { id: 'archive', label: 'Archive', priority: 'overflow', tone: 'danger' },
];

function setCompactLayout(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
    writable: true,
  });
}

describe('SurfaceActionBar', () => {
  beforeEach(() => {
    setCompactLayout(false);
  });

  it('renders all actions on roomy layouts', () => {
    render(<SurfaceActionBar actions={actions} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bring to Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to Waiting on' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('keeps compact layouts to primary, secondary, and explicit overflow', () => {
    const onAction = vi.fn();
    setCompactLayout(true);

    render(<SurfaceActionBar actions={actions} onAction={onAction} />);

    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bring to Now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('button', { name: 'Move to Waiting on' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(onAction).toHaveBeenCalledWith('archive');
  });
});
