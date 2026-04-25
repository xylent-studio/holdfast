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
  const [pickerStep, setPickerStep] = useState<
    null | 'destination' | 'list' | 'new-list'
  >(null);
  const [selectedDestination, setSelectedDestination] = useState<AddDestination>(
    primaryDestination,
  );
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [chosenDate, setChosenDate] = useState<DateKey>(defaults.chosenDate);
  const [chosenTime, setChosenTime] = useState(defaults.chosenTime);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListKindOverride, setNewListKindOverride] = useState<ListKind | null>(
    null,
  );
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsed = splitCapturedText(rawText);
  const canSubmit = Boolean(parsed);
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

  const effectiveSelectedListId = selectableLists.some((list) => list.id === selectedListId)
    ? selectedListId
    : currentListId && activeLists.some((list) => list.id === currentListId)
      ? currentListId
      : null;

  const selectedListTitle =
    activeLists.find((entry) => entry.id === effectiveSelectedListId)?.title ??
    currentListTitle;
  const inferredNewListKind = inferListKind(newListTitle);
  const effectiveNewListKind =
    inferredNewListKind === 'project'
      ? newListKindOverride ?? inferredNewListKind
      : inferredNewListKind;

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

  const resetPicker = (): void => {
    setListSearch('');
    setPickerStep(null);
    setSelectedDestination(primaryDestination);
    setSubmitError(null);
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
        kind: effectiveNewListKind,
        lane: currentList?.lane ?? 'admin',
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
    if (submitBusy) {
      return;
    }

    setSubmitBusy(true);
    setSubmitError(null);
    try {
      if (destination === 'list') {
        await handleAddToExistingList();
        return;
      }

      if (destination === 'new-list') {
        await handleCreateListFromDraft();
        return;
      }

      await handleCreateItem(destination);
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't keep that yet.",
      );
    } finally {
      setSubmitBusy(false);
    }
  };

  const showSaveToInboxSecondary = primaryDestination !== 'inbox';
  const showScheduleFields =
    pickerStep === 'destination' && selectedDestination === 'scheduled';

  const openListStep = (): void => {
    setSubmitError(null);
    setSelectedDestination('list');
    setPickerStep('list');
  };

  const openNewListStep = (): void => {
    setSubmitError(null);
    setSelectedDestination('new-list');
    if (!newListTitle.trim() && parsed?.title) {
      setNewListTitle('');
    }
    setPickerStep('new-list');
  };

  const selectNewListTitle = (value: string): void => {
    setNewListTitle(value);
    if (inferListKind(value) !== 'project') {
      setNewListKindOverride(null);
    }
  };

  return (
    <div className="dialog-stack quick-add-dialog">
      <div>
        <div className="eyebrow">Capture</div>
        <h2>Add</h2>
        <p>{addContextDescription(context, currentListTitle)}</p>
      </div>

      <label className="field-stack">
        <span>What do you need to keep?</span>
        <textarea
          autoFocus
          onChange={(event) => {
            setRawText(event.target.value);
            setSubmitError(null);
          }}
          placeholder="What do you need to keep?"
          rows={4}
          value={rawText}
        />
      </label>

      {pickerStep === 'destination' ? (
        <div className="item-card day-result quick-add-picker">
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
              <button className="chip" onClick={openListStep} type="button">
                Add to list
              </button>
              <button className="chip" onClick={openNewListStep} type="button">
                Create a new list
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pickerStep === 'list' ? (
        <div className="item-card day-result quick-add-picker">
          <label className="field-stack">
            <span>Find a list</span>
            <input
              onChange={(event) => setListSearch(event.target.value)}
              placeholder="Search all lists"
              type="search"
              value={listSearch}
            />
          </label>
          {!listSearch.trim() ? (
            <>
              <ListTargetSection
                lists={listTargetGroups.current}
                onSelect={setSelectedListId}
                selectedListId={effectiveSelectedListId}
                title="Current list"
              />
              <ListTargetSection
                lists={listTargetGroups.suggested}
                onSelect={setSelectedListId}
                selectedListId={effectiveSelectedListId}
                title="Suggested lists"
              />
              <ListTargetSection
                lists={listTargetGroups.recent}
                onSelect={setSelectedListId}
                selectedListId={effectiveSelectedListId}
                title="Recent lists"
              />
              <ListTargetSection
                lists={listTargetGroups.pinned}
                onSelect={setSelectedListId}
                selectedListId={effectiveSelectedListId}
                title="Pinned lists"
              />
            </>
          ) : null}
          {listSearch.trim() ? (
            <ListTargetSection
              lists={listTargetGroups.search}
              onSelect={setSelectedListId}
              selectedListId={effectiveSelectedListId}
              title="Matching lists"
            />
          ) : null}
          {!selectableLists.length ? (
            <div className="empty-inline">
              No lists yet. Create a new one if this belongs somewhere specific.
            </div>
          ) : null}
          {!effectiveSelectedListId ? (
            <div className="empty-inline">
              Pick a list or create a new one.
            </div>
          ) : null}
        </div>
      ) : null}

      {pickerStep === 'new-list' ? (
        <div className="item-card day-result quick-add-picker">
          <ListCreatorFields
            kind={effectiveNewListKind}
            onKindChange={setNewListKindOverride}
            onTitleChange={selectNewListTitle}
            showKind={false}
            title={newListTitle}
          />
          {inferListKind(newListTitle) === 'project' ? (
            <div className="field-stack">
              <span>Kind</span>
              <div className="chip-row">
                <button
                  className={`chip ${effectiveNewListKind === 'project' ? 'active' : ''}`}
                  onClick={() => setNewListKindOverride('project')}
                  type="button"
                >
                  Project
                </button>
                <button
                  className={`chip ${effectiveNewListKind === 'reference' ? 'active' : ''}`}
                  onClick={() => setNewListKindOverride('reference')}
                  type="button"
                >
                  Reference
                </button>
              </div>
            </div>
          ) : null}
          {parsed ? (
            <div className="empty-inline">
              First item | {parsed.title}
              {parsed.body ? ` | ${parsed.body}` : ''}
            </div>
          ) : null}
        </div>
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

      {submitError ? <p className="auth-feedback danger">{submitError}</p> : null}

      <div className="dialog-actions spread quick-add-footer">
        <button className="button ghost" onClick={onClose} type="button">
          Cancel
        </button>
        <div className="dialog-actions quick-add-actions">
          {pickerStep === null ? (
            <>
              {showSaveToInboxSecondary ? (
                <button
                  className="button ghost"
                  disabled={!canSubmit || submitBusy}
                  onClick={() => void handleSubmitDestination('inbox')}
                  type="button"
                >
                  Save to Inbox
                </button>
              ) : null}
              <button
                className="button accent"
                disabled={!canSubmit || submitBusy}
                onClick={() => {
                  if (primaryDestination === 'scheduled') {
                    setSelectedDestination('scheduled');
                    setPickerStep('destination');
                    return;
                  }

                  void handleSubmitDestination(primaryDestination);
                }}
                type="button"
              >
                {submitBusy ? 'Saving...' : primaryActionLabel}
              </button>
              <button
                className="button ghost"
                disabled={!canSubmit || submitBusy}
                onClick={() => {
                  setSelectedDestination(primaryDestination);
                  setPickerStep('destination');
                }}
                type="button"
              >
                Choose another place
              </button>
            </>
          ) : (
            <>
              <button
                className="button ghost"
                onClick={() => {
                  setListSearch('');
                  if (pickerStep === 'destination') {
                    resetPicker();
                    return;
                  }

                  setPickerStep('destination');
                  setSelectedDestination(primaryDestination);
                }}
                type="button"
              >
                Back
              </button>
              {showSaveToInboxSecondary ? (
                <button
                  className="button ghost"
                  disabled={!canSubmit || submitBusy}
                  onClick={() => void handleSubmitDestination('inbox')}
                  type="button"
                >
                  Save to Inbox
                </button>
              ) : null}
              <button
                className="button accent"
                disabled={
                  submitBusy ||
                  !canSubmit ||
                  (pickerStep === 'list' && !effectiveSelectedListId) ||
                  (pickerStep === 'new-list' && !newListTitle.trim())
                }
                onClick={() =>
                  void handleSubmitDestination(
                    pickerStep === 'list'
                      ? 'list'
                      : pickerStep === 'new-list'
                        ? 'new-list'
                        : selectedDestination,
                  )
                }
                type="button"
              >
                {submitBusy
                  ? 'Saving...'
                  : pickerStep === 'list'
                    ? destinationActionLabel('list', selectedListTitle)
                    : pickerStep === 'new-list'
                      ? destinationActionLabel('new-list')
                      : selectedActionLabel}
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
