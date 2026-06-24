import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ClipTag } from "../types";

interface ClipTagsProps {
  clipId: number;
  tags: ClipTag[];
  onAddTag: (clipId: number, tagName: string) => Promise<void> | void;
  onRemoveTag: (clipId: number, tagId: number) => Promise<void> | void;
  onSelectTag: (tagId: number) => void;
}

export function ClipTags({
  clipId,
  tags,
  onAddTag,
  onRemoveTag,
  onSelectTag,
}: ClipTagsProps) {
  const [adding, setAdding] = useState(false);
  const [tagName, setTagName] = useState("");

  async function handleSubmit() {
    const cleanTagName = tagName.trim();

    if (!cleanTagName) {
      setAdding(false);
      setTagName("");
      return;
    }

    await onAddTag(clipId, cleanTagName);

    setTagName("");
    setAdding(false);
  }

  return (
    <div className="clip-tags" aria-label="Clip tags">
      {tags.map((tag) => (
        <span key={tag.tag_id} className="clip-tag">
          <button
            className="clip-tag__label"
            onClick={() => onSelectTag(tag.tag_id)}
            title={`Filter by ${tag.name}`}
            aria-label={`Filter by ${tag.name}`}
          >
            #{tag.name}
          </button>

          <button
            className="clip-tag__remove"
            onClick={() => onRemoveTag(clipId, tag.tag_id)}
            title={`Remove ${tag.name} tag`}
            aria-label={`Remove ${tag.name} tag`}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          className="clip-tag-input"
          value={tagName}
          autoFocus
          placeholder="tag name"
          title="Tag name"
          aria-label="Tag name"
          onChange={(event) => setTagName(event.target.value)}
          onBlur={handleSubmit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSubmit();
            }

            if (event.key === "Escape") {
              setAdding(false);
              setTagName("");
            }
          }}
        />
      ) : (
        <button
          className="clip-tag-add"
          onClick={() => setAdding(true)}
          title="Add tag"
          aria-label="Add tag"
        >
          <Plus size={12} aria-hidden="true" />
          Add tag
        </button>
      )}
    </div>
  );
}