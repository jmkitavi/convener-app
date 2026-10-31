import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerPicker } from "./tool-workspace";

test("the player grid preserves an odd selection and labels missing handicaps rather than displaying zero", () => {
  const selectedIds = new Set([1, 2, 3]);
  const html = renderToStaticMarkup(createElement(PlayerPicker, {
    players: [
      { id: 1, name: "Zero Player", defaultHandicap: 0 },
      { id: 2, name: "Plus Player", defaultHandicap: -2 },
      { id: 3, name: "Unknown Player", defaultHandicap: null as unknown as number },
    ],
    selectedIds,
    onToggle() {},
    onSelectAll() {},
    onClear() {},
  }));
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 3);
  assert.match(html, /3 of 3 selected/);
  assert.match(html, /HI 0/);
  assert.match(html, /HI -2/);
  assert.match(html, /HI Unknown/);
  assert.deepEqual([...selectedIds], [1, 2, 3]);
});
