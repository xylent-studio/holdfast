import { useMemo, useState } from 'react';

import {
  addContextDescription,
  buildQuickAddDraft,
  destinationActionLabel,
  destinationLabel,
  isContextDestination,
  primaryAddDestinationForContext,
  planQuickAddItem,
  splitCapturedText,
  type AddContext,
  type AddDestination,
} from '@/domain/logic/capture';
import {
  buildListTargetGroups,
  inferListKind,
} from '@/domain/logic/list-targets';
import type { DateKey } from '@/domain/dates';
import {
  createItem,
  createListItem,
  createListWithFirstItem,
  type HoldfastSnapshot,
} from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

import { ListCreatorFields } from '@/features/lists/ListCreatorFields';

interface QuickAddDialogProps {
  context: AddContext;
  currentDate: DateKey;
  currentListId?: string | null;
  isOpen: boolean;
  lists: HoldfastSnapshot['lists'];
  onClose: () => void;
  onOpenList: (listId: string) => void;
}

interface QuickAddDialogBodyProps {
  context: AddContext;
  currentDate: DateKey;
  currentListId: string | null;
  lists: HoldfastSnapshot['lists'];
  onClose: () => void;
  onOpenList: (listId: string) => void;
}

function ListTargetSection({
  title,
  lists,
  selectedListId,
  onSelect,
}: {
  title: string;
  lists: HoldfastSnapshot['lists'];
  selectedListId: string | null;
  onSelect: (listId: string) => void;
}) {
  if (!lists.length) {
    return null;
  }

  return (
    <div className="field-stack">
      <span>{title}</span>
      <div className="chip-row">
        {lists.map((list) => (
          <button
            className={`chip ${selectedListId === list.id ? 'active' : ''}`}
            key={list.id}
            onClick={() => onSelect(list.id)}
            type="button"
          >
            {list.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickAddDialogBody({
  context,
  currentDate,
  currentListId,
  lists,
  onClose,
  onOpenList,
}: QuickAddDialogBodyProps) {
  const defaults = useMemo(() => buildQuickAddDraft(currentDate), [currentDate]);
  const currentList =
    lists.find((entry) => entry.id === currentListId && !entry.deletedAt) ?? null;
  const activeLists = useMemo(
    () => lists.filter((entry) => !entry.deletedAt && !entry.archivedAt),
    [lists],
  );
  const primaryDestination = primaryAddDestinationForContext(context);
  const [rawText, setRawText] = useState('');
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<AddDestination>(
    primaryDestination,
  );
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [chosenDate, setChosenDate] = useState<DateKey>(defaults.chosenDate);
  const [chosenTime, setChosenTime] = useState(defaults.chosenTime);
  const [newListTitle, setNewListTitle] = useState('');

  const parsed = splitCapturedText(rawText);
  const canSubmit = Boolean(parsed);
  const activeDestination = showDestinationPicker
    ? selectedDestination
    : primaryDestination;
  const currentListTitle = currentList?.title ?? null;

  const listTargetGroups = useMemo(
    () =>
      buildListTargetGroups(activeLists, {
        currentListId,
        draftText: rawText,
        search: listSearch,
      }),
    [activeLists, currentListId, listSearch, rawText],
  );

  const selectableLists = (() => {
    const ordered = [
      ...listTargetGroups.current,
      ...listTargetGroups.suggested,
      ...listTargetGroups.recent,
      ...listTargetGroups.pinned,
      ...listTargetGroups.search,
    ];

    const seen = new Set<string>();
    return ordered.filter((list) => {
      if (seen.has(list.id)) {
        return false;
      }

      seen.add(list.id);
      return true;
    });
  })();

  const defaultListId = selectableLists[0]?.id ?? null;
  const effectiveSelectedListId = selectableLists.some(
    (list) => list.id === selectedListId,
  )
    ? selectedListId
    : defaultListId;

  const selectedListTitle =
    activeLists.find((entry) => entry.id === effectiveSelectedListId)?.title ??
    currentListTitle;

  const primaryActionLabel = destinationActionLabel(
    primaryDestination,
    currentListTitle,
  );
  const selectedActionLabel = destinationActionLabel(
    selectedDestination,
    selectedListTitle,
  );

  const contextCaptureMode = (destination: AddDestination) =>
    isContextDestination(context, destination, {
      currentListId,
      selectedListId: effectiveSelectedListId,
    })
      ? 'context'
      : 'direct';

  const handleSaveToInbox = async (): Promise<void> => {
    const planned = planQuickAddItem({
      rawText,
      currentDate,
      destination: 'inbox',
      chosenDate,
      chosenTime,
    });

    if (!planned) {
      return;
    }

    await createItem(planned);
    onClose();
  };

  const handleCreateItem = async (
    destination: Exclude<AddDestination, 'list' | 'new-list'>,
  ): Promise<void> => {
    const planned = planQuickAddItem({
      rawText,
      currentDate,
      destination,
      chosenDate,
      chosenTime,
      captureMode: contextCaptureMode(destination),
    });

    if (!planned) {
      return;
    }

    await createItem(planned);
    onClose();
  };

  const handleAddToExistingList = async (): Promise<void> => {
    if (!parsed || !effectiveSelectedListId) {
      return;
    }

    await createListItem({
      body: parsed.body,
      listId: effectiveSelectedListId,
      title: parsed.title,
    });
    onClose();
  };

  const handleCreateListFromDraft = async (): Promise<void> => {
    if (!parsed || !newListTitle.trim()) {
      return;
    }

    const title = newListTitle.trim();
    const listId = await createListWithFirstItem(
      {
        title,
        kind: inferListKind(title),
        lane: 'admin',
      },
      {
        title: parsed.title,
        body: parsed.body,
      },
    );

    onClose();
    onOpenList(listId);
  };

  const handleSubmitDestination = async (
    destination: AddDestination,
  ): Promise<void> => {
    if (destination === 'list') {
      await handleAddToExistingList();
      return;
    }

    if (destination === 'new-list') {
      await handleCreateListFromDraft();
      return;
    }

    await handleCreateItem(destination);
  };

  const showSaveToInboxSecondary = primaryDestination !== 'inbox';
  const showScheduleFields = activeDestination === 'scheduled';

  const selectListTarget = (listId: string): void => {
    setSelectedDestination('list');
    setSelectedListId(listId);
  };

  return (
    <div className="dialog-stack">
      <div>
        <div className="eyebrow">Capture</div>
        <h2>Add</h2>
        <p>{addContextDescription(context, currentListTitle)}</p>
      </div>

      <label className="field-stack">
        <span>What do you need to keep?</span>
        <textarea
          autoFocus
          onChange={(event) => setRawText(event.target.value)}
          placeholder="What do you need to keep?"
          rows={4}
          value={rawText}
        />
      </label>

      {showDestinationPicker ? (
        <>
          <div className="field-stack">
            <span>Choose another place</span>
            <div className="chip-row">
              {(['now', 'scheduled', 'undated', 'waiting'] as const).map(
                (destination) => (
                  <button
                    className={`chip ${
                      selectedDestination === destination ? 'active' : ''
                    }`}
                    key={destination}
                    onClick={() => setSelectedDestination(destination)}
                    type="button"
                  >
                    {destinationLabel(destination)}
                  </button>
                ),
              )}
              <button
                className={`chip ${selectedDestination === 'new-list' ? 'active' : ''}`}
                onClick={() => setSelectedDestination('new-list')}
                type="button"
              >
                {destinationLabel('new-list')}
              </button>
            </div>
          </div>

          <div className="item-card day-result">
            {listSearch.trim() ? (
              <>
                <label className="field-stack">
                  <span>Find a list</span>
                  <input
                    onChange={(event) => setListSearch(event.target.value)}
                    placeholder="Search all lists"
                    type="search"
                    value={listSearch}
                  />
                </label>
                <ListTargetSection
                  lists={listTargetGroups.search}
                  onSelect={selectListTarget}
                  selectedListId={
                    selectedDestination === 'list' ? effectiveSelectedListId : null
                  }
                  title="Matching lists"
                />
                {!listTargetGroups.search.length ? (
                  <div className="empty-inline">
                    No matching lists yet. Create a new one if this needs its own
                    home.
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <ListTargetSection
                  lists={listTargetGroups.current}
                  onSelect={selectListTarget}
                  selectedListId={
                    selectedDestination === 'list'
                      ? effectiveSelectedListId
                      : null
                  }
                  title="Current list"
                />
                <ListTargetSection
                  lists={listTargetGroups.suggested}
                  onSelect={selectListTarget}
                  selectedListId={
                    selectedDestination === 'list'
                      ? effectiveSelectedListId
                      : null
                  }
                  title="Suggested lists"
                />
                <ListTargetSection
                  lists={listTargetGroups.recent}
                  onSelect={selectListTarget}
                  selectedListId={
                    selectedDestination === 'list'
                      ? effectiveSelectedListId
                      : null
                  }
                  title="Recent lists"
                />
                <ListTargetSection
                  lists={listTargetGroups.pinned}
                  onSelect={selectListTarget}
                  selectedListId={
                    selectedDestination === 'list'
                      ? effectiveSelectedListId
                      : null
                  }
                  title="Pinned lists"
                />
                <label className="field-stack">
                  <span>Find a list</span>
                  <input
                    onChange={(event) => setListSearch(event.target.value)}
                    placeholder="Search all lists"
                    type="search"
                    value={listSearch}
                  />
                </label>
                {!selectableLists.length ? (
                  <div className="empty-inline">
                    No lists yet. Create a new one if this belongs somewhere
                    specific.
                  </div>
                ) : null}
              </>
            )}
          </div>

          {selectedDestination === 'list' && !effectiveSelectedListId ? (
            <div className="empty-inline">
              Search for a list or create a new one first.
            </div>
          ) : null}

          {selectedDestination === 'new-list' ? (
            <div className="item-card day-result">
              <ListCreatorFields
                kind={inferListKind(newListTitle)}
                onKindChange={() => undefined}
                onTitleChange={setNewListTitle}
                showKind={false}
                title={newListTitle}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {showScheduleFields ? (
        <div className="grid two">
          <label className="field-stack">
            <span>Date</span>
            <input
              onChange={(event) => setChosenDate(event.target.value as DateKey)}
              type="date"
              value={chosenDate}
            />
          </label>
          <label className="field-stack">
            <span>Time</span>
            <input
              onChange={(event) => setChosenTime(event.target.value)}
              type="time"
              value={chosenTime}
            />
          </label>
        </div>
      ) : null}

      <div className="dialog-actions spread">
        <button className="button ghost" onClick={onClose} type="button">
          Cancel
        </button>
        <div className="dialog-actions">
          {showDestinationPicker ? (
            <>
              <button
                className="button ghost"
                onClick={() => {
                  setListSearch('');
                  setShowDestinationPicker(false);
                }}
                type="button"
              >
                Back
              </button>
              {showSaveToInboxSecondary ? (
                <button
                  className="button ghost"
                  disabled={!canSubmit}
                  onClick={() => void handleSaveToInbox()}
                  type="button"
                >
                  Save to Inbox
                </button>
              ) : null}
              <button
                className="button accent"
                disabled={
                  !canSubmit ||
                  (selectedDestination === 'list' && !effectiveSelectedListId) ||
                  (selectedDestination === 'new-list' && !newListTitle.trim())
                }
                onClick={() => void handleSubmitDestination(selectedDestination)}
                type="button"
              >
                {selectedActionLabel}
              </button>
            </>
          ) : (
            <>
              {showSaveToInboxSecondary ? (
                <button
                  className="button ghost"
                  disabled={!canSubmit}
                  onClick={() => void handleSaveToInbox()}
                  type="button"
                >
                  Save to Inbox
                </button>
              ) : null}
              <button
                className="button accent"
                disabled={!canSubmit}
                onClick={() => void handleSubmitDestination(primaryDestination)}
                type="button"
              >
                {primaryActionLabel}
              </button>
              <button
                className="button ghost"
                disabled={!canSubmit}
                onClick={() => {
                  setSelectedDestination(primaryDestination);
                  setShowDestinationPicker(true);
                }}
                type="button"
              >
                Choose another place
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuickAddDialog({
  context,
  currentDate,
  currentListId = null,
  isOpen,
  lists,
  onClose,
  onOpenList,
}: QuickAddDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen onClose={onClose} title="Add">
      <QuickAddDialogBody
        context={context}
        currentDate={currentDate}
        currentListId={currentListId}
        key={`${currentDate}-${context}-${currentListId ?? 'global'}`}
        lists={lists}
        onClose={onClose}
        onOpenList={onOpenList}
      />
    </Modal>
  );
}
