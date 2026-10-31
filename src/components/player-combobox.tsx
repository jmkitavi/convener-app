"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface Player {
  id: number;
  name: string;
  defaultHandicap: number;
}

interface PlayerComboboxProps {
  players: Player[];
  value: string;
  onChange: (value: string, player?: Player) => void;
  placeholder?: string;
  id?: string;
}

export function PlayerCombobox({
  players,
  value,
  onChange,
  placeholder = "Search player...",
  id,
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(value.toLowerCase()),
  );
  function choose(player: Player) {
    onChange(player.name, player);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-autocomplete="list"
        aria-controls={open && filtered.length > 0 ? listId : undefined}
        aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setActiveIndex(0);
          setOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
          }
          if (event.key === "Enter" && open && filtered[activeIndex]) {
            event.preventDefault();
            choose(filtered[activeIndex]);
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div id={listId} role="listbox" aria-label="Matching players" className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((p, index) => (
            <button
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={index === activeIndex}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
            >
              <span className="min-w-0 break-words">{p.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.defaultHandicap}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
