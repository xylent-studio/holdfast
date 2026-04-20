import type { ReactNode } from 'react';

import { Panel } from '@/shared/ui/Panel';

interface ExpandablePanelProps {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  summary?: string;
  title: string;
}

export function ExpandablePanel({
  action,
  children,
  description,
  isOpen,
  onToggle,
  summary,
  title,
}: ExpandablePanelProps) {
  return (
    <Panel>
      <div className="panel-header split">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="button-row">
          {isOpen ? action : null}
          <button className="button ghost small" onClick={onToggle} type="button">
            {isOpen ? 'Hide' : 'Open'}
          </button>
        </div>
      </div>
      {summary ? <div className="section-summary">{summary}</div> : null}
      {isOpen ? children : null}
    </Panel>
  );
}
