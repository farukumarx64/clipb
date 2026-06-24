import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clipboard, Search, X } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Clip } from "../types";
import { formatTime, toDayKey } from "../lib/dates";
import { getRecentClips } from "../lib/db";
import { hideQuickWindow } from "../lib/desktop";

export function QuickCopyWindow() {
  const [query, setQuery] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadClips = useCallback(async () => {
    const rows = await getRecentClips({
      query,
      limit: 30,
    });

    setClips(rows);
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    loadClips().catch(console.error);
  }, [loadClips]);

  useEffect(() => {
    inputRef.current?.focus();

    function handleWindowFocus() {
      inputRef.current?.focus();
      loadClips().catch(console.error);
    }

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadClips]);

  const activeClip = useMemo(() => {
    return clips[activeIndex] ?? null;
  }, [clips, activeIndex]);

  useEffect(() => {
    const activeItem = itemRefs.current[activeIndex];

    if (!activeItem) return;

    activeItem.scrollIntoView({
      block: "nearest",
      behavior: "auto",
    });
  }, [activeIndex]);

  const copyClip = useCallback(async (clip: Clip) => {
    await writeText(clip.content);

    setCopiedId(clip.id);

    window.setTimeout(() => {
      hideQuickWindow();
    }, 140);
  }, []);

  const moveSelection = useCallback(
    (direction: "up" | "down") => {
      if (clips.length === 0) return;

      setActiveIndex((current) => {
        if (direction === "down") {
          return current >= clips.length - 1 ? 0 : current + 1;
        }

        return current <= 0 ? clips.length - 1 : current - 1;
      });
    },
    [clips.length],
  );

  useEffect(() => {
    async function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        await hideQuickWindow();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection("down");
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection("up");
        return;
      }

      if (event.key === "Enter" && activeClip) {
        event.preventDefault();
        await copyClip(activeClip);
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [activeClip, copyClip, moveSelection]);

  return (
    <main className="quick-window">
      <header className="quick-header">
        <div>
          <h1>Quick Copy</h1>
          <p>Search, select, press Enter.</p>
        </div>

        <button
          className="quick-close-button"
          onClick={() => hideQuickWindow()}
          title="Close quick copy"
          aria-label="Close quick copy"
        >
          <X size={17} />
        </button>
      </header>

      <label className="quick-search">
        <Search size={16} />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search clips..."
          title="Search clips"
          aria-label="Search clips"
        />
      </label>

      <section className="quick-list" aria-label="Recent clipboard clips">
        {clips.length === 0 ? (
          <div className="quick-empty">
            <Clipboard size={34} />
            <h2>No clips found</h2>
            <p>Copy text anywhere and it will show here.</p>
          </div>
        ) : (
          clips.map((clip, index) => {
            const isActive = index === activeIndex;
            const dayKey = toDayKey(clip.created_at);
            const preview =
              clip.content.length > 180
                ? `${clip.content.slice(0, 180)}...`
                : clip.content;

            return (
              <button
                key={clip.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                className={["quick-item", isActive ? "active" : ""].join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => copyClip(clip)}
                title="Copy this clip"
                aria-label={`Copy clip from ${dayKey}`}
              >
                <div className="quick-item__meta">
                  <span>{dayKey}</span>
                  <span>{formatTime(clip.created_at)}</span>
                </div>

                <p>{preview}</p>

                {copiedId === clip.id ? (
                  <span className="quick-copied">Copied</span>
                ) : null}
              </button>
            );
          })
        )}
      </section>

      <footer className="quick-footer">
        <span>↑↓ Navigate</span>
        <span>Enter Copy</span>
        <span>Esc Close</span>
        <span>⌥ Shift Q Toggle</span>
      </footer>
    </main>
  );
}
