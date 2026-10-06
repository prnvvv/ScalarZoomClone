"use client";

import { REACTION_EMOJIS } from "@/lib/constants";

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
}

/**
 * Emoji picker for the React control. Reactions are transient: each pick is
 * broadcast over the signaling socket and fades from the tile after a few
 * seconds — participant state is never modified.
 */
export function ReactionPicker({ onReact }: ReactionPickerProps) {
  return (
    <div className="reaction-picker">
      <div className="reaction-picker__title">React</div>
      <div className="reaction-picker__grid">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            className="reaction-picker__emoji"
            aria-label={`React with ${emoji}`}
            onClick={() => onReact(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
