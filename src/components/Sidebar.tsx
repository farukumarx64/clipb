import { CalendarDays, Search } from "lucide-react";
import type { DailyCount, ViewMode } from "../types";
import { buildMonthCalendar, toDayKey } from "../lib/dates";

interface SidebarProps {
  selectedDate: Date;
  viewMode: ViewMode;
  query: string;
  dailyCounts: DailyCount[];
  onSelectDate: (date: Date) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onQueryChange: (query: string) => void;
}

const viewModes: ViewMode[] = ["day", "week", "month", "year"];

function formatClipCount(count: number): string {
  if (count < 1000) return String(count);

  if (count < 1_000_000) {
    const value = count / 1000;
    return `${Number.isInteger(value) ? value : value.toFixed(1)}k`;
  }

  const value = count / 1_000_000;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}m`;
}

function formatFullClipCount(count: number): string {
  return new Intl.NumberFormat().format(count);
}

export function Sidebar({
  selectedDate,
  viewMode,
  query,
  dailyCounts,
  onSelectDate,
  onViewModeChange,
  onQueryChange,
}: SidebarProps) {
  const days = buildMonthCalendar(selectedDate);

  const countMap = new Map(dailyCounts.map((item) => [item.day, item.count]));

  const selectedDayKey = toDayKey(selectedDate.getTime());
  const currentMonth = selectedDate.getMonth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__icon">
          <CalendarDays size={20} />
        </div>

        <div>
          <h1>ClipB</h1>
          <p>Clipboard timeline</p>
        </div>
      </div>

      <label className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search clips..."
          title="Search clips"
          aria-label="Search clips"
        />
      </label>

      <div className="view-switcher">
        {viewModes.map((mode) => (
          <button
            key={mode}
            className={mode === viewMode ? "active" : ""}
            onClick={() => onViewModeChange(mode)}
            title={`Switch to ${mode} view`}
            aria-label={`Switch to ${mode} view`}
          >
            {mode}
          </button>
        ))}
      </div>

      <section className="mini-calendar">
        <div className="mini-calendar__header">
          <strong>
            {selectedDate.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </strong>
        </div>

        <div className="mini-calendar__weekdays">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        <div className="mini-calendar__grid">
          {days.map((day) => {
            const dayKey = toDayKey(day.getTime());
            const count = countMap.get(dayKey) ?? 0;
            const formattedCount = formatClipCount(count);
            const fullCount = formatFullClipCount(count);

            const isSelected = dayKey === selectedDayKey;
            const isMuted = day.getMonth() !== currentMonth;

            const dateLabel = day.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            });

            return (
              <button
                key={dayKey}
                className={[
                  "calendar-day",
                  isSelected ? "selected" : "",
                  isMuted ? "muted" : "",
                  count > 0 ? "has-clips" : "",
                ].join(" ")}
                onClick={() => onSelectDate(day)}
                title={
                  count > 0
                    ? `${dateLabel} — ${fullCount} clips`
                    : `${dateLabel} — no clips`
                }
                aria-label={
                  count > 0
                    ? `Select ${dateLabel}, ${fullCount} clips`
                    : `Select ${dateLabel}, no clips`
                }
              >
                <span>{day.getDate()}</span>
                {count > 0 ? <small>{formattedCount}</small> : null}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
