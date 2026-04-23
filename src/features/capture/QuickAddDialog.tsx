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
import type { DateKey } from '@/domain/dates';
import type { ListKind } from '@/domain/schemas/records';
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
  const availableLists = useMemo(() => {
    const ordered = [
      ...(currentList ? [currentList] : []),
      ...lists.filter(
        (entry) => !entry.deletedAt && entry.pinned && entry.id !== currentListId,
      ),
    ];

    return ordered;
  }, [currentList, currentListId, lists]);
  const primaryDestination = primaryAddDestinationForContext(context);
  const [rawText, setRawText] = useState('');
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<AddDestination>(
    primaryDestination,
  );
  const [selectedListId, setSelectedListId] = useState<string | null>(
    currentList?.id ?? availableLists[0]?.id ?? null,
  );
  const [chosenDate, setChosenDate] = useState<DateKey>(defaults.chosenDate);
  const [chosenTime, setChosenTime] = useState(defaults.chosenTime);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListKind, setNewListKind] = useState<ListKind>('project');

  const parsed = splitCapturedText(rawText);
  const canSubmit = Boolean(parsed);
  const activeDestination = showDestinationPicker
    ? selectedDestination
    : primaryDestination;
  const currentListTitle = currentList?.title ?? null;
  const selectedListTitle =
    availableLists.find((entry) => entry.id === selectedListId)?.title ??
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
      selectedListId,
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
    if (!parsed || !selectedListId) {
      return;
    }

    await createListItem({
      body: parsed.body,
      listId: selectedListId,
      title: parsed.title,
    });
    onClose();
  };

  const handleCreateListFromDraft = async (): Promise<void> => {
    if (!parsed || !newListTitle.trim()) {
      return;
    }

    const listId = await createListWithFirstItem(
      {
        title: newListTitle.trim(),
        kind: newListKind,
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
  const currentListOptionLabel = currentList
    ? destinationLabel('list', currentList.title)
    : null;

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
              {(
                ['now', 'scheduled', 'undated', 'waiting'] as const
              ).map((destination) => (
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
              ))}
              {currentList ? (
                <button
                  className={`chip ${
                    selectedDestination === 'list' &&
                    selectedListId === currentList.id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedDestination('list');
                    setSelectedListId(currentList.id);
                  }}
                  type="button"
                >
                  {currentListOptionLabel}
                </button>
              ) : null}
              {availableLists
                .filter((entry) => entry.id !== currentList?.id)
                .map((list) => (
                  <button
                    className={`chip ${
                      selectedDestination === 'list' && selectedListId === list.id
                        ? 'active'
                        : ''
                    }`}
                    key={list.id}
                    onClick={() => {
                      setSelectedDestination('list');
                      setSelectedListId(list.id);
                    }}
                    type="button"
                  >
                    {list.title}
                  </button>
                ))}
              <button
                className={`chip ${selectedDestination === 'new-list' ? 'active' : ''}`}
                onClick={() => setSelectedDestination('new-list')}
                type="button"
              >
                {destinationLabel('new-list')}
              </button>
            </div>
          </div>

          {selectedDestination === 'list' && !selectedListId ? (
            <div className="empty-inline">
              Pin a list or create a new one before sending this there.
            </div>
          ) : null}

          {selectedDestination === 'new-list' ? (
            <div className="item-card day-result">
              <ListCreatorFields
                kind={newListKind}
                onKindChange={setNewListKind}
                onTitleChange={setNewListTitle}
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
                onClick={() => setShowDestinationPicker(false)}
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
                  (selectedDestination === 'list' && !selectedListId) ||
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
