import { useMemo, useState } from 'react';

import { LIST_KIND_LABELS } from '@/domain/constants';
import { searchLists } from '@/domain/logic/list-targets';
import type { ListKind } from '@/domain/schemas/records';
import { reviewListSummaries } from '@/domain/logic/selectors';
import { createList, type HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Panel } from '@/shared/ui/Panel';

import { ListCreatorFields } from '@/features/lists/ListCreatorFields';

interface ListsHomeViewProps {
  onOpenList: (listId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ListsHomeView({
  onOpenList,
  snapshot,
}: ListsHomeViewProps) {
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [listCreateBusy, setListCreateBusy] = useState(false);
  const [listCreateError, setListCreateError] = useState<string | null>(null);
  const [listKind, setListKind] = useState<ListKind>('project');
  const [listTitle, setListTitle] = useState('');
  const [search, setSearch] = useState('');

  const listSummaries = useMemo(
    () =>
      reviewListSummaries(
        snapshot.lists,
        snapshot.listItems,
        Number.MAX_SAFE_INTEGER,
      ),
    [snapshot.listItems, snapshot.lists],
  );
  const pinnedListSummaries = useMemo(
    () => listSummaries.filter((entry) => entry.list.pinned),
    [listSummaries],
  );
  const recentListSummaries = useMemo(
    () => listSummaries.filter((entry) => !entry.list.pinned).slice(0, 6),
    [listSummaries],
  );
  const libraryResults = useMemo(() => {
    if (!search.trim()) {
      return listSummaries;
    }

    const matches = searchLists(snapshot.lists, search);
    const matchIds = new Set(matches.map((list) => list.id));
    return listSummaries.filter((entry) => matchIds.has(entry.list.id));
  }, [listSummaries, search, snapshot.lists]);

  const handleCreateList = async (): Promise<void> => {
    const title = listTitle.trim();
    if (!title) {
      return;
    }

    setListCreateBusy(true);
    setListCreateError(null);
    try {
      const listId = await createList({
        title,
        kind: listKind,
        lane: 'admin',
      });
      setListTitle('');
      setListKind('project');
      setIsCreatingList(false);
      onOpenList(listId);
    } catch (error) {
      setListCreateError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't create this list yet.",
      );
    } finally {
      setListCreateBusy(false);
    }
  };

  const renderListCard = (
    entry: (typeof listSummaries)[number],
    eyebrow?: string,
  ) => (
    <div className="item-card day-result" key={entry.list.id}>
      <div className="eyebrow">
        {eyebrow ?? `${LIST_KIND_LABELS[entry.list.kind]} list`}
      </div>
        <div className="item-title-row">
          <h3>{entry.list.title}</h3>
          <div className="chip-row">
            <span className="chip small">{entry.openCount} current</span>
            {entry.doneCount ? (
              <span className="chip small">{entry.doneCount} done</span>
            ) : null}
            {entry.list.scheduledDate ? (
              <span className="chip small">
                {entry.list.scheduledDate > snapshot.currentDate ? 'Scheduled' : 'In Now'}
              </span>
            ) : null}
          </div>
        </div>
      <p>
        {entry.previewTitles.length
          ? entry.previewTitles.join(' | ')
          : 'Nothing current here right now.'}
      </p>
      <div className="dialog-actions">
        <button
          className="button ghost small"
          onClick={() => onOpenList(entry.list.id)}
          type="button"
        >
          Open list
        </button>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <h1>Lists</h1>
            <p>Keep quiet libraries and working lists close without loading Review down.</p>
          </div>
          <div className="dialog-actions">
            <button
              className="button ghost small"
              onClick={() => {
                setIsCreatingList(true);
                setListCreateError(null);
                setListKind('project');
              }}
              type="button"
            >
              New list
            </button>
          </div>
        </div>
        {isCreatingList ? (
          <div className="item-card day-result">
            <ListCreatorFields
              disabled={listCreateBusy}
              kind={listKind}
              onKindChange={setListKind}
              onTitleChange={setListTitle}
              title={listTitle}
            />
            {listCreateError ? (
              <p className="auth-feedback danger">{listCreateError}</p>
            ) : null}
            <div className="dialog-actions spread">
              <button
                className="button ghost"
                disabled={listCreateBusy}
                onClick={() => {
                  setIsCreatingList(false);
                  setListCreateError(null);
                  setListTitle('');
                  setListKind('project');
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button accent"
                disabled={!listTitle.trim() || listCreateBusy}
                onClick={() => void handleCreateList()}
                type="button"
              >
                {listCreateBusy ? 'Creating...' : 'Create list'}
              </button>
            </div>
          </div>
        ) : null}
        <label className="field-stack">
          <span>Find a list</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lists"
            type="search"
            value={search}
          />
        </label>
      </Panel>

      {pinnedListSummaries.length ? (
        <Panel>
          <div className="panel-header">
            <h2>Pinned</h2>
            <p>The lists worth keeping within easy reach.</p>
          </div>
          <div className="grid two">
            {pinnedListSummaries.map((entry) =>
              renderListCard(entry, `${LIST_KIND_LABELS[entry.list.kind]} list | pinned`),
            )}
          </div>
        </Panel>
      ) : null}

      {recentListSummaries.length ? (
        <Panel>
          <div className="panel-header">
            <h2>Recent</h2>
            <p>Lists with the freshest real activity.</p>
          </div>
          <div className="grid two">
            {recentListSummaries.map((entry) => renderListCard(entry))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="panel-header">
          <h2>All lists</h2>
          <p>Search stays light here and opens straight into the right list.</p>
        </div>
        {libraryResults.length ? (
          <div className="stack compact">
            {libraryResults.map((entry) => renderListCard(entry))}
          </div>
        ) : (
          <EmptyState>No matching lists.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
