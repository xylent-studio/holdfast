import { useMemo, useState } from 'react';

import { LANES } from '@/domain/constants';
import type { DateKey } from '@/domain/dates';
import {
  itemMeta,
  openCountsByLane,
  overdueItems,
  recentDaySummaries,
  repeatedOpenTitles,
  searchAll,
} from '@/domain/logic/selectors';
import type { HoldfastSnapshot } from '@/storage/local/api';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ItemCard } from '@/shared/ui/ItemCard';
import { Panel } from '@/shared/ui/Panel';
import { StatCard } from '@/shared/ui/StatCard';

interface ReviewViewProps {
  currentDate: DateKey;
  onOpenItem: (itemId: string) => void;
  snapshot: HoldfastSnapshot;
}

export function ReviewView({
  currentDate,
  onOpenItem,
  snapshot,
}: ReviewViewProps) {
  const [search, setSearch] = useState('');
  const repeated = useMemo(
    () => repeatedOpenTitles(snapshot.items),
    [snapshot.items],
  );
  const overdue = useMemo(
    () => overdueItems(snapshot.items, currentDate),
    [currentDate, snapshot.items],
  );
  const searchResults = useMemo(
    () => searchAll(snapshot.items, snapshot.dailyRecords, search),
    [search, snapshot.dailyRecords, snapshot.items],
  );
  const recent = useMemo(
    () =>
      recentDaySummaries(snapshot.dailyRecords, snapshot.items, currentDate),
    [currentDate, snapshot.dailyRecords, snapshot.items],
  );
  const laneCounts = useMemo(
    () => openCountsByLane(snapshot.items),
    [snapshot.items],
  );

  return (
    <div className="stack">
      <Panel>
        <div className="panel-header split">
          <div>
            <h1>Review</h1>
            <p>
              Find things again, catch repeats, and decide what needs action.
            </p>
          </div>
        </div>
        <label className="field-stack">
          <span>Search</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search captures, items, closeouts, and seeds"
            type="search"
            value={search}
          />
        </label>
        {search.trim() ? (
          searchResults.length ? (
            <div className="item-list">
              {searchResults.map((result) =>
                result.type === 'item' ? (
                  <ItemCard
                    item={result.item}
                    key={result.item.id}
                    meta={itemMeta(
                      result.item,
                      currentDate,
                      result.item.attachments,
                    )}
                    onOpen={() => onOpenItem(result.item.id)}
                  />
                ) : (
                  <div
                    className="item-card day-result"
                    key={`day-${result.date}`}
                  >
                    <div className="eyebrow">{result.date}</div>
                    <p>
                      {[
                        result.dailyRecord.launchNote,
                        result.dailyRecord.closeWin,
                        result.dailyRecord.closeCarry,
                        result.dailyRecord.closeSeed,
                        result.dailyRecord.closeNote,
                      ]
                        .filter(Boolean)
                        .join(' | ') || 'Day entry'}
                    </p>
                  </div>
                ),
              )}
            </div>
          ) : (
            <EmptyState>No matches.</EmptyState>
          )
        ) : (
          <EmptyState>Search captures, items, closeouts, or seeds.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Needs attention</h2>
          <p>The shortest path to what may deserve action next.</p>
        </div>
        <div className="grid three">
          <StatCard
            detail="Items dated before today"
            label="Overdue"
            value={overdue.length}
          />
          <StatCard
            detail="Open loops showing up more than once"
            label="Repeating"
            value={repeated.length}
          />
          <StatCard
            detail="Recent days in view"
            label="Snapshots"
            value={recent.length}
          />
        </div>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Open by lane</h2>
          <p>Where the weight is gathering across the open system.</p>
        </div>
        <div className="grid two">
          {LANES.map((lane) => (
            <StatCard
              detail="Open items"
              key={lane.key}
              label={lane.label}
              value={laneCounts[lane.key]}
            />
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Recent days</h2>
          <p>A short read on how the last week actually went.</p>
        </div>
        <div className="grid two">
          {recent.map((day) => (
            <div className="item-card day-result" key={day.date}>
              <div className="eyebrow">{day.date}</div>
              <p>Basics {day.readinessCount}/6</p>
              <div className="meta-row">
                <span className="meta-chip">
                  Focus | {day.focusTitles.join(', ') || '--'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-chip">Win | {day.closeWin || '--'}</span>
              </div>
              <div className="meta-row">
                <span className="meta-chip">
                  Seed | {day.closeSeed || '--'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-chip">
                  Closeout | {day.closed ? 'yes' : 'no'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Repeating</h2>
          <p>Things that keep staying open and probably deserve structure.</p>
        </div>
        {repeated.length ? (
          <div className="item-list">
            {repeated.map(([title, count]) => (
              <div className="item-card day-result" key={`${title}-${count}`}>
                <div className="item-title-row">
                  <h3>{title}</h3>
                  <span className="chip small">{count}</span>
                </div>
                <p>
                  This title is still open across multiple items. Consider
                  making it a routine or clarifying scope.
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No repeated open loops right now.</EmptyState>
        )}
      </Panel>

      <Panel>
        <div className="panel-header">
          <h2>Overdue</h2>
          <p>Anything with a date before today.</p>
        </div>
        {overdue.length ? (
          <div className="item-list">
            {overdue.map((item) => (
              <ItemCard
                item={item}
                key={item.id}
                meta={itemMeta(item, currentDate, item.attachments)}
                onOpen={() => onOpenItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing overdue.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
