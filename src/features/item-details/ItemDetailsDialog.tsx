import { useMemo, useRef, useState } from 'react';

import { ITEM_KIND_LABELS } from '@/domain/constants';
import { buildListTargetGroups, inferListKind } from '@/domain/logic/list-targets';
import {
  focusActionLabel,
  placementOptionSpecs,
  type ItemSurfaceContext,
  type PlacementChoice,
} from '@/domain/logic/surface-actions';
import type { DateKey } from '@/domain/dates';
import type { ItemKind, ItemStatus } from '@/domain/schemas/records';
import {
  addFilesToItem,
  deleteItem,
  getAttachmentDownload,
  moveItemToList,
  moveItemToNewList,
  removeAttachment,
  replaceItemWithLatestSavedVersion,
  saveItem,
  setItemFocus,
  type HoldfastSnapshot,
  type ItemWithAttachments,
} from '@/storage/local/api';
import { Modal } from '@/shared/ui/Modal';

import { ListCreatorFields } from '@/features/lists/ListCreatorFields';

interface ItemDetailsDialogProps {
  isFocused: boolean;
  currentDate: DateKey;
  isOpen: boolean;
  item: ItemWithAttachments;
  lists: HoldfastSnapshot['lists'];
  origin: ItemSurfaceContext;
  onClose: () => void;
  onOpenList: (listId: string) => void;
}

function formatBytes(value: number): string {
  if (!value) {
    return '0 B';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function initialPlacement(item: ItemWithAttachments): PlacementChoice {
  if (item.status === 'archived') {
    return 'archive';
  }

  if (item.status === 'today') {
    return 'now';
  }

  if (item.status === 'waiting') {
    return 'waiting';
  }

  if (item.status === 'upcoming') {
    return item.scheduledDate ? 'scheduled' : 'undated';
  }

  return 'inbox';
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

export function ItemDetailsDialog({
  currentDate,
  isFocused,
  isOpen,
  item,
  lists,
  origin,
  onClose,
  onOpenList,
}: ItemDetailsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [placement, setPlacement] = useState<PlacementChoice>(
    initialPlacement(item),
  );
  const [scheduledDate, setScheduledDate] = useState(
    item.scheduledDate ?? currentDate,
  );
  const [scheduledTime, setScheduledTime] = useState(item.scheduledTime ?? '');
  const [markDone, setMarkDone] = useState(item.status === 'done');
  const activeLists = useMemo(
    () => lists.filter((entry) => !entry.deletedAt && !entry.archivedAt),
    [lists],
  );
  const [listTargetMode, setListTargetMode] = useState<'existing' | 'new'>(
    activeLists.length ? 'existing' : 'new',
  );
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [replacingConflict, setReplacingConflict] = useState(false);

  const isConflict = item.syncState === 'conflict';
  const listTargetGroups = useMemo(
    () =>
      buildListTargetGroups(activeLists, {
        draftText: [title, body].filter(Boolean).join('\n\n'),
        search: listSearch,
      }),
    [activeLists, body, listSearch, title],
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
  const effectiveSelectedListId = selectableLists.some(
    (list) => list.id === selectedListId,
  )
    ? selectedListId
    : null;
  const effectiveListTargetMode =
    activeLists.length || listTargetMode === 'new' ? listTargetMode : 'new';
  const inferredNewListKind = inferListKind(newListTitle);
  const placementOptions = placementOptionSpecs(origin, placement, kind);

  const selectedListTitle =
    activeLists.find((entry) => entry.id === effectiveSelectedListId)?.title ??
    null;
  const showsNowByDateMessage =
    kind !== 'capture' &&
    item.status === 'upcoming' &&
    Boolean(item.scheduledDate) &&
    item.scheduledDate <= currentDate &&
    placement === 'scheduled';

  const handlePlacementChange = (nextPlacement: PlacementChoice): void => {
    setPlacement(nextPlacement);
    if (nextPlacement !== 'archive') {
      setMarkDone(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (placement === 'list') {
      if (effectiveListTargetMode === 'new') {
        const listId = await moveItemToNewList(item.id, {
          title: newListTitle.trim(),
          kind: inferredNewListKind,
          lane: item.lane,
        });
        if (listId) {
          onClose();
          onOpenList(listId);
        }
        return;
      }

      if (!effectiveSelectedListId) {
        return;
      }

      await saveItem(item.id, {
        title,
        body,
        kind,
        lane: item.lane,
        status:
          markDone && kind === 'task'
            ? 'done'
            : kind === 'capture'
              ? 'inbox'
              : 'inbox',
        scheduledDate: null,
        scheduledTime: null,
      });
      await moveItemToList(item.id, effectiveSelectedListId);
      onClose();
      return;
    }

    const nextStatus: ItemStatus =
      kind === 'capture'
        ? placement === 'archive'
          ? 'archived'
          : 'inbox'
        : markDone && kind === 'task'
          ? 'done'
          : placement === 'now'
            ? 'today'
            : placement === 'scheduled' || placement === 'undated'
              ? 'upcoming'
              : placement === 'waiting'
                ? 'waiting'
                : placement === 'archive'
                  ? 'archived'
                  : 'inbox';
    const nextScheduledDate =
      kind === 'capture'
        ? null
        : placement === 'now'
          ? currentDate
          : placement === 'scheduled'
            ? scheduledDate || currentDate
            : null;
    const nextScheduledTime =
      kind === 'capture'
        ? null
        : placement === 'scheduled' && nextScheduledDate
          ? scheduledTime || null
          : null;

    await saveItem(item.id, {
      title,
      body,
      kind,
      lane: item.lane,
      status: nextStatus,
      scheduledDate: nextScheduledDate,
      scheduledTime: nextScheduledTime,
    });

    onClose();
  };

  const handleDelete = async (): Promise<void> => {
    await deleteItem(item.id);
    onClose();
  };

  const handleUseLatestSavedVersion = async (): Promise<void> => {
    setConflictError(null);
    setReplacingConflict(true);

    try {
      await replaceItemWithLatestSavedVersion(item.id);
      onClose();
    } catch (error) {
      setConflictError(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load the latest saved version yet.",
      );
    } finally {
      setReplacingConflict(false);
    }
  };

  const handleDownload = async (attachmentId: string): Promise<void> => {
    setDownloadError(null);
    setDownloadingAttachmentId(attachmentId);

    const payload = await getAttachmentDownload(attachmentId).catch(() => null);
    if (!payload) {
      setDownloadingAttachmentId(null);
      setDownloadError(
        "Couldn't download this file yet. Keep this device signed in and online, then try again.",
      );
      return;
    }

    const url = URL.createObjectURL(payload.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = payload.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setDownloadingAttachmentId(null);
  };

  const handleAddFiles = (files: File[]): void => {
    if (files.length) {
      void addFilesToItem(item.id, files);
    }
  };

  const selectListTarget = (listId: string): void => {
    setListTargetMode('existing');
    setSelectedListId(listId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Item details">
      <div className="dialog-stack">
        <div className="dialog-header">
          <div>
            <div className="eyebrow">{ITEM_KIND_LABELS[kind]}</div>
            <h2>Keep it clear and in the right place.</h2>
            <p>Write first. Place it honestly. Shape it only when you need to.</p>
          </div>
          {kind !== 'capture' ? (
            <button
              className="button ghost"
              onClick={() =>
                void setItemFocus(
                  currentDate,
                  item.id,
                  item.status === 'today' ? !isFocused : true,
                )
              }
              type="button"
            >
              {item.status === 'today'
                ? isFocused
                  ? 'Remove focus'
                  : focusActionLabel(currentDate)
                : focusActionLabel(currentDate)}
            </button>
          ) : null}
        </div>

        {isConflict ? (
          <div className="recovery-note">
            <strong>This changed in two places.</strong>
            <p>
              Keep this version if it still matters, or pull in the latest saved
              version before you keep moving.
            </p>
            <div className="dialog-actions">
              <button
                className="button ghost"
                disabled={replacingConflict}
                onClick={() => void handleUseLatestSavedVersion()}
                type="button"
              >
                {replacingConflict ? 'Loading...' : 'Use latest saved version'}
              </button>
            </div>
            {conflictError ? (
              <p className="auth-feedback danger">{conflictError}</p>
            ) : null}
          </div>
        ) : null}

        <label className="field-stack">
          <span>Title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            type="text"
            value={title}
          />
        </label>

        <label className="field-stack">
          <span>Notes</span>
          <textarea
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            value={body}
          />
        </label>

        <div className="field-stack">
          <span>Placement</span>
          <div className="chip-row">
            {placementOptions.map((option) => (
              <button
                className={`chip ${option.current ? 'active' : ''}`}
                key={option.choice}
                onClick={() => handlePlacementChange(option.choice)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {kind === 'task' ? (
          <div className="field-stack">
            <span>Task state</span>
            <div className="chip-row">
              <button
                className={`chip ${markDone ? 'active' : ''}`}
                onClick={() => setMarkDone((current) => !current)}
                type="button"
              >
                {markDone ? 'Reopen' : 'Done'}
              </button>
            </div>
          </div>
        ) : null}

        {placement === 'scheduled' && kind !== 'capture' ? (
          <div className="grid two">
            <label className="field-stack">
              <span>Date</span>
              <input
                onChange={(event) => setScheduledDate(event.target.value)}
                type="date"
                value={scheduledDate}
              />
            </label>
            <label className="field-stack">
              <span>Time</span>
              <input
                onChange={(event) => setScheduledTime(event.target.value)}
                type="time"
                value={scheduledTime}
              />
            </label>
          </div>
        ) : null}

        {showsNowByDateMessage ? (
          <div className="empty-inline">
            {item.scheduledDate === currentDate
              ? 'This is showing in Now because its scheduled date has arrived.'
              : 'This is showing in Now because its scheduled date has already passed.'}
          </div>
        ) : null}

        {placement === 'list' ? (
          <div className="item-card day-result">
            <div className="field-stack">
              <span>Choose a list</span>
              <div className="chip-row">
                <button
                  className={`chip ${listTargetMode === 'existing' ? 'active' : ''}`}
                  onClick={() => setListTargetMode('existing')}
                  type="button"
                >
                  Existing list
                </button>
                <button
                  className={`chip ${listTargetMode === 'new' ? 'active' : ''}`}
                  onClick={() => setListTargetMode('new')}
                  type="button"
                >
                  New list...
                </button>
              </div>
            </div>
            {listTargetMode === 'existing' ? (
              <>
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
                      selectedListId={effectiveSelectedListId}
                      title="Matching lists"
                    />
                    {!listTargetGroups.search.length ? (
                      <div className="empty-inline">
                        No matching lists yet. Create a new one if this belongs
                        somewhere new.
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ListTargetSection
                      lists={listTargetGroups.suggested}
                      onSelect={selectListTarget}
                      selectedListId={effectiveSelectedListId}
                      title="Suggested lists"
                    />
                    <ListTargetSection
                      lists={listTargetGroups.recent}
                      onSelect={selectListTarget}
                      selectedListId={effectiveSelectedListId}
                      title="Recent lists"
                    />
                    <ListTargetSection
                      lists={listTargetGroups.pinned}
                      onSelect={selectListTarget}
                      selectedListId={effectiveSelectedListId}
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
                        No lists yet. Create a new one if this needs its own
                        home.
                      </div>
                    ) : null}
                  </>
                )}
                {!selectedListTitle ? (
                  <div className="empty-inline">
                    Search for a list or create a new one first.
                  </div>
                ) : null}
              </>
            ) : (
              <ListCreatorFields
                kind={inferredNewListKind}
                onKindChange={() => undefined}
                onTitleChange={setNewListTitle}
                showKind={false}
                title={newListTitle}
              />
            )}
          </div>
        ) : null}

        <div className="field-stack">
          <span>Convert to</span>
          <div className="chip-row">
            <button
              className={`chip ${kind === 'capture' ? 'active' : ''}`}
              onClick={() => {
                setKind('capture');
                setMarkDone(false);
                if (!['inbox', 'list', 'archive'].includes(placement)) {
                  setPlacement('inbox');
                }
              }}
              type="button"
            >
              Capture
            </button>
            <button
              className={`chip ${kind === 'task' ? 'active' : ''}`}
              onClick={() => setKind('task')}
              type="button"
            >
              Task
            </button>
            <button
              className={`chip ${kind === 'note' ? 'active' : ''}`}
              onClick={() => {
                setKind('note');
                setMarkDone(false);
              }}
              type="button"
            >
              Note
            </button>
          </div>
        </div>

        <div className="field-stack">
          <span>Attachments</span>
          {item.attachments.length ? (
            <div className="attachment-list">
              {item.attachments.map((attachment) => (
                <div className="attachment-row" key={attachment.id}>
                  <div>
                    <div className="attachment-name">{attachment.name}</div>
                    <div className="attachment-meta">
                      {attachment.kind} | {formatBytes(attachment.size)}
                    </div>
                  </div>
                  <div className="attachment-actions">
                    <button
                      className="button ghost small"
                      onClick={() => void handleDownload(attachment.id)}
                      type="button"
                    >
                      {downloadingAttachmentId === attachment.id
                        ? 'Downloading...'
                        : 'Download'}
                    </button>
                    <button
                      className="button danger small"
                      onClick={() => void removeAttachment(attachment.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">No attachments yet.</div>
          )}
          {downloadError ? (
            <p className="auth-feedback danger">{downloadError}</p>
          ) : null}
          <button
            className="button ghost file-button"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Add files
          </button>
          <input
            className="file-input-hidden"
            multiple
            onChange={(event) => {
              handleAddFiles([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
        </div>

        <div className="dialog-actions spread">
          <button
            className="button danger"
            onClick={() => void handleDelete()}
            type="button"
          >
            Delete
          </button>
          <div className="dialog-actions">
            <button className="button ghost" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="button accent"
              disabled={
                placement === 'list' &&
                ((effectiveListTargetMode === 'existing' &&
                  !effectiveSelectedListId) ||
                  (effectiveListTargetMode === 'new' && !newListTitle.trim()))
              }
              onClick={() => void handleSave()}
              type="button"
            >
              {isConflict ? 'Keep this version' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
