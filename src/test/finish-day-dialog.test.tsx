import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '@/domain/constants';
import { FinishDayDialog } from '@/features/now/FinishDayDialog';

const closeDayMock = vi.fn();

vi.mock('@/storage/local/api', async () => {
  const actual = await vi.importActual<typeof import('@/storage/local/api')>(
    '@/storage/local/api',
  );

  return {
    ...actual,
    closeDay: (...args: unknown[]) => closeDayMock(...args),
  };
});

const day = {
  date: '2026-04-20',
  schemaVersion: SCHEMA_VERSION,
  startedAt: '2026-04-20T08:00:00.000Z',
  closedAt: null,
  readiness: {
    water: false,
    food: false,
    supplements: false,
    hygiene: false,
    movement: false,
    sleepSetup: false,
  },
  focusItemIds: [],
  launchNote: '',
  closeWin: 'Shipped something real',
  closeCarry: 'Buy batteries',
  closeSeed: 'Start with coffee',
  closeNote: '',
  seededRoutineIds: [],
  createdAt: '2026-04-20T08:00:00.000Z',
  updatedAt: '2026-04-20T08:00:00.000Z',
  syncState: 'pending' as const,
};

describe('FinishDayDialog', () => {
  it('resets to saved closeout state when reopened after cancel', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <FinishDayDialog
        currentDate="2026-04-20"
        day={day}
        isOpen
        key="open-1"
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText('What still matters'), {
      target: { value: 'Something half-written' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    rerender(
      <FinishDayDialog
        currentDate="2026-04-20"
        day={day}
        isOpen={false}
        key="closed"
        onClose={onClose}
      />,
    );
    rerender(
      <FinishDayDialog
        currentDate="2026-04-20"
        day={day}
        isOpen
        key="open-2"
        onClose={onClose}
      />,
    );

    expect(screen.getByLabelText('What still matters')).toHaveValue(
      'Buy batteries',
    );
    expect(screen.getByLabelText('Note for tomorrow')).toHaveValue(
      'Start with coffee',
    );
  });
});
