"use client";

import { useEffect, useRef, useState } from "react";
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
  const [search, setSearch] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

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
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={search}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                setSearch(p.name);
                onChange(p.name, p);
                setOpen(false);
              }}
            >
              <span>{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {p.defaultHandicap}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
