"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlayerForm } from "@/components/player-form";
import { PlusIcon, PencilIcon, EyeIcon, ArrowUpDown } from "lucide-react";

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  defaultHandicap: number;
  active: boolean;
  createdAt: string;
}

interface PlayersListClientProps {
  players: Player[];
  createPlayer: (formData: FormData) => Promise<void>;
  updatePlayer: (formData: FormData) => Promise<void>;
  togglePlayerActive: (formData: FormData) => Promise<void>;
}

export function PlayersListClient({
  players,
  createPlayer,
  updatePlayer,
  togglePlayerActive,
}: PlayersListClientProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "handicap">("name");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const filtered = players
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === "handicap"
        ? a.defaultHandicap - b.defaultHandicap
        : a.name.localeCompare(b.name)
    );

  async function handleCreate(formData: FormData) {
    await createPlayer(formData);
    setAddDialogOpen(false);
  }

  async function handleUpdate(formData: FormData) {
    if (editingPlayer) {
      formData.append("id", editingPlayer.id.toString());
      await updatePlayer(formData);
      setEditingPlayer(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Players</h1>
          <p className="text-muted-foreground">
            Manage your club&apos;s players and handicaps.
          </p>
        </div>
        <Dialog
          open={addDialogOpen}
          onOpenChange={(open) => setAddDialogOpen(open)}
        >
          <DialogTrigger render={<Button />}>
            <PlusIcon />
            Add Player
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
              <DialogDescription>
                Enter the player&apos;s details below.
              </DialogDescription>
            </DialogHeader>
            <PlayerForm onSubmit={handleCreate} submitLabel="Add Player" />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-1">
          <Button
            variant={sortBy === "name" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("name")}
          >
            <ArrowUpDown className="size-3.5" />
            Name
          </Button>
          <Button
            variant={sortBy === "handicap" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("handicap")}
          >
            <ArrowUpDown className="size-3.5" />
            Handicap
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Handicap</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {search
                    ? "No players match your search."
                    : "No players yet. Add one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/players/${player.id}`}
                      className="hover:underline"
                    >
                      {player.name}
                    </Link>
                  </TableCell>
                  <TableCell>{player.defaultHandicap}</TableCell>
                  <TableCell>
                    <form action={togglePlayerActive}>
                      <input type="hidden" name="id" value={player.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={String(player.active)}
                      />
                      <button type="submit" className="cursor-pointer">
                        <Badge
                          variant={player.active ? "default" : "secondary"}
                        >
                          {player.active ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/players/${player.id}`}>
                        <Button variant="ghost" size="icon-sm">
                          <EyeIcon />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingPlayer(player)}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Player Dialog */}
      <Dialog
        open={editingPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPlayer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>
              Update {editingPlayer?.name}&apos;s details.
            </DialogDescription>
          </DialogHeader>
          {editingPlayer && (
            <PlayerForm
              defaultValues={editingPlayer}
              onSubmit={handleUpdate}
              submitLabel="Update Player"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
