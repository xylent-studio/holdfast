import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { SurfaceActionSpec } from '@/domain/logic/surface-actions';
import { useCompactLayout } from '@/shared/ui/useCompactLayout';

interface SurfaceActionBarProps {
  actions?: SurfaceActionSpec[];
  children?: ReactNode;
  className?: string;
  onAction?: (actionId: SurfaceActionSpec['id']) => void;
}

function actionClassName(action: SurfaceActionSpec): string {
  if (action.tone === 'chip') {
    return 'chip';
  }

  return `button ${
    action.tone === 'accent'
      ? 'accent'
      : action.tone === 'danger'
        ? 'danger'
        : 'ghost'
  } small`;
}

function compactActionGroups(actions: SurfaceActionSpec[]): {
  inlineActions: SurfaceActionSpec[];
  overflowActions: SurfaceActionSpec[];
} {
  const firstPrimary = actions.find((action) => action.priority === 'primary');
  const firstVisible =
    firstPrimary ??
    actions.find((action) => action.priority === 'secondary') ??
    actions[0] ??
    null;
  const firstSecondary = actions.find(
    (action) =>
      action.id !== firstVisible?.id && action.priority === 'secondary',
  );
  const inlineActions = [firstVisible, firstSecondary].filter(
    (action): action is SurfaceActionSpec => Boolean(action),
  );
  const visibleIds = new Set(inlineActions.map((action) => action.id));

  return {
    inlineActions,
    overflowActions: actions.filter((action) => !visibleIds.has(action.id)),
  };
}

export function SurfaceActionBar({
  actions = [],
  children,
  className = '',
  onAction,
}: SurfaceActionBarProps) {
  const compactActionLayout = useCompactLayout();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { inlineActions, overflowActions } = useMemo(() => {
    if (!compactActionLayout) {
      return { inlineActions: actions, overflowActions: [] };
    }

    return compactActionGroups(actions);
  }, [actions, compactActionLayout]);
  const actionBarClassName = ['item-actions', className].filter(Boolean).join(' ');

  if (!inlineActions.length && !children) {
    return null;
  }

  return (
    <>
      <div className={actionBarClassName}>
        {inlineActions.map((action) => (
          <button
            className={actionClassName(action)}
            key={action.id}
            onClick={() => onAction?.(action.id)}
            type="button"
          >
            {action.label}
          </button>
        ))}
        {compactActionLayout && overflowActions.length ? (
          <button
            aria-expanded={overflowOpen}
            className="button ghost small"
            onClick={() => setOverflowOpen((current) => !current)}
            type="button"
          >
            {overflowOpen ? 'Less' : 'More'}
          </button>
        ) : null}
        {children}
      </div>
      {compactActionLayout && overflowOpen && overflowActions.length ? (
        <div className={`${actionBarClassName} item-actions-overflow`}>
          {overflowActions.map((action) => (
            <button
              className={actionClassName(action)}
              key={`overflow-${action.id}`}
              onClick={() => onAction?.(action.id)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
