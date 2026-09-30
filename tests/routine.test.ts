import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExplicitRoutine } from "../apps/api/src/planner/explicit-routine";
const routine = `Rodar das 05h30 até às 12h.
Almoçar e Descansar das 12h até às 15h.
Arrumar a casa às 16h até às 17h.
Rodar das 17h até às 20h.
Estudar das 20h até às 22h.`;
test("explicit Portuguese routine produces exactly five timezone-aware events", () => {
  const events = parseExplicitRoutine(routine, "2026-09-29", "America/Recife");
  assert.equal(events?.length, 5);
  assert.equal(events?.[0].start, "2026-09-29T05:30:00.000-03:00");
  assert.equal(events?.[4].end, "2026-09-29T22:00:00.000-03:00");
  assert.equal(events?.[1].title, "Almoçar e Descansar");
});
test("explicit parsing never drops unrecognized details or guesses dates", () => {
  for (const text of [
    routine + "\nTambém preciso ir ao mercado",
    "Estudar amanhã das 09h até às 10h",
    "Caminhar todo dia das 08h até às 09h",
    "Rodar todos os dias das 08h até às 09h",
    "Estudar das 25h até às 26h",
    "Estudar das 22h até às 01h",
    "Estudar das 08h99 até às 10h",
  ])
    assert.equal(
      parseExplicitRoutine(text, "2026-09-29", "America/Recife"),
      null,
    );
  assert.equal(
    parseExplicitRoutine(
      "Estudar das 02h30 até às 04h",
      "2026-03-08",
      "America/New_York",
    ),
    null,
  );
});
