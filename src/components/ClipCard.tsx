import {
  Check,
  Clipboard,
  Code2,
  FileText,
  Heart,
  Link2,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import type { Clip } from "../types";
import { formatTime } from "../lib/dates";

interface ClipCardProps {
  clip: Clip;
  copied: boolean;
  onCopy: (clip: Clip) => void;
  onDelete: (id: number) => void;
  onTogglePin: (clip: Clip) => void;
  onToggleFavorite: (clip: Clip) => void;
  onUpdateNote: (clip: Clip, note: string | null) => void;
}

function getCategoryIcon(category: Clip["category"]) {
  if (category === "url") return <Link2 size={14} aria-hidden="true" />;
  if (category === "code") return <Code2 size={14} aria-hidden="true" />;

  return <FileText size={14} aria-hidden="true" />;
}

export function ClipCard({
  clip,
  copied,
  onCopy,
  onDelete,
  onTogglePin,
  onToggleFavorite,
  onUpdateNote,
}: ClipCardProps) {
  const preview =
    clip.content.length > 700
      ? `${clip.content.slice(0, 700)}...`
      : clip.content;

  return (
    <article className="clip-card">
      <div className="clip-card__meta">
        <span>{formatTime(clip.created_at)}</span>

        <span className={`clip-category clip-category--${clip.category}`}>
          {getCategoryIcon(clip.category)}
          {clip.category}
        </span>

        {clip.is_pinned ? <span className="pill">Pinned</span> : null}
        {clip.is_favorite ? <span className="pill">Favorite</span> : null}
      </div>

      <pre className="clip-card__content">{preview}</pre>

      <textarea
        className="clip-note-input"
        defaultValue={clip.note ?? ""}
        placeholder="Add a note..."
        title="Clip note"
        aria-label="Clip note"
        onBlur={(event) => {
          onUpdateNote(clip, event.target.value);
        }}
      />

      <div className="clip-card__actions">
        <button
          className="icon-button"
          onClick={() => onCopy(clip)}
          title={copied ? "Copied" : "Copy clip"}
          aria-label={copied ? "Copied" : "Copy clip"}
        >
          {copied ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Clipboard size={16} aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>

        <button
          className="icon-button"
          onClick={() => onTogglePin(clip)}
          title={clip.is_pinned ? "Unpin clip" : "Pin clip"}
          aria-label={clip.is_pinned ? "Unpin clip" : "Pin clip"}
        >
          {clip.is_pinned ? (
            <PinOff size={16} aria-hidden="true" />
          ) : (
            <Pin size={16} aria-hidden="true" />
          )}
          {clip.is_pinned ? "Unpin" : "Pin"}
        </button>

        <button
          className={[
            "icon-button",
            clip.is_favorite ? "icon-button--active" : "",
          ].join(" ")}
          onClick={() => onToggleFavorite(clip)}
          title={
            clip.is_favorite ? "Remove from favorites" : "Add to favorites"
          }
          aria-label={
            clip.is_favorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <Heart
            size={16}
            aria-hidden="true"
            fill={clip.is_favorite ? "currentColor" : "none"}
          />
          {clip.is_favorite ? "Favorited" : "Favorite"}
        </button>

        <button
          className="icon-button danger"
          onClick={() => onDelete(clip.id)}
          title="Delete clip"
          aria-label="Delete clip"
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </div>
    </article>
  );
}
