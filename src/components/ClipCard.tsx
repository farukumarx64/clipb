import {
  Check,
  Clipboard,
  Code2,
  File,
  FileText,
  Heart,
  ImageIcon,
  Link2,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { AssetImage } from "./AssetImage";
import type { Clip, ClipTag } from "../types";
import { ClipTags } from "./ClipTags";
import { formatTime } from "../lib/dates";
import { formatBytes } from "../lib/assets";
import { getCopyLabel, getCopyTitle } from "../lib/clipCopy";

interface ClipCardProps {
  clip: Clip;
  copied: boolean;
  tags: ClipTag[];
  onCopy: (clip: Clip) => void;
  onDelete: (id: number) => void;
  onTogglePin: (clip: Clip) => void;
  onToggleFavorite: (clip: Clip) => void;
  onUpdateNote: (clip: Clip, note: string | null) => void;
  onAddTag: (clipId: number, tagName: string) => Promise<void> | void;
  onRemoveTag: (clipId: number, tagId: number) => Promise<void> | void;
  onSelectTag: (tagId: number) => void;
}

function getCategoryIcon(category: Clip["category"]) {
  if (category === "url") return <Link2 size={14} aria-hidden="true" />;
  if (category === "code") return <Code2 size={14} aria-hidden="true" />;
  if (category === "image") return <ImageIcon size={14} aria-hidden="true" />;
  if (category === "file") return <File size={14} aria-hidden="true" />;

  return <FileText size={14} aria-hidden="true" />;
}

export function ClipCard({
  clip,
  copied,
  tags,
  onCopy,
  onDelete,
  onTogglePin,
  onToggleFavorite,
  onUpdateNote,
  onAddTag,
  onRemoveTag,
  onSelectTag,
}: ClipCardProps) {
  const preview =
    clip.content.length > 700
      ? `${clip.content.slice(0, 700)}...`
      : clip.content;

  function getAssetLabel(clip: Clip): string {
    if (clip.asset_name) return clip.asset_name;
    if (clip.content) return clip.content;

    return "Untitled asset";
  }
  return (
    <article className="clip-card">
      {clip.is_pinned ? (
        <div
          className="clip-pin-indicator"
          title="Pinned clip"
          aria-label="Pinned clip"
        >
          <Pin size={15} aria-hidden="true" />
        </div>
      ) : null}
      <div className="clip-card__meta">
        <span>{formatTime(clip.created_at)}</span>

        <span className={`clip-category clip-category--${clip.category}`}>
          {getCategoryIcon(clip.category)}
          {clip.category}
        </span>
      </div>

      {clip.category === "image" ? (
        <div className="clip-image-preview">
          <AssetImage
            assetPath={clip.asset_path}
            assetMime={clip.asset_mime}
            assetName={clip.asset_name}
            assetSize={clip.asset_size}
          />

          <div className="clip-asset-meta">
            <span>{getAssetLabel(clip)}</span>
            <small>{formatBytes(clip.asset_size)}</small>
          </div>
        </div>
      ) : clip.category === "file" ? (
        <div className="clip-file-preview">
          <File size={20} aria-hidden="true" />

          <div>
            <strong>{getAssetLabel(clip)}</strong>
            <span>
              {clip.content_type === "file/backup"
                ? `Backed up · ${formatBytes(clip.asset_size)}`
                : clip.asset_mime === "inode/directory"
                  ? "Folder path"
                  : `Path only · ${formatBytes(clip.asset_size)}`}
            </span>
          </div>
        </div>
      ) : (
        <pre className="clip-card__content">{preview}</pre>
      )}

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

      <div className="clip-card__tags">
        <ClipTags
          clipId={clip.id}
          tags={tags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onSelectTag={onSelectTag}
        />
      </div>

      <div className="clip-card__actions">
        <button
          className="icon-button"
          onClick={() => onCopy(clip)}
          title={getCopyTitle(clip, copied)}
          aria-label={getCopyTitle(clip, copied)}
        >
          {copied ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Clipboard size={16} aria-hidden="true" />
          )}
          {getCopyLabel(clip, copied)}
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
