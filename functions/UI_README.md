# Interactive UI (all flows)

Language, main menu, Pay Rent, Invoice, Help and My Chama use WhatsApp reply buttons and list messages, the same
way Landlord Watch does. Business logic is unchanged; only presentation (and the navigation fixes below) moved.

| File | Role |
| --- | --- |
| `utils/ui.ts` | Pure toolkit: `Reply` type, builders, id codec, stamping, tap resolution, paged pickers, main menu / welcome. |
| `constants/ui.messages.ts` | Bilingual labels and static copy (button <= 20 chars, row title <= 24, description <= 72; tested). |
| `services/outbound.service.ts` | `sendReply`: stamps the real session state into ids, sends each message in order. |
| `services/wa.sender.ts` | Cloud API sender (was `watch.sender.ts`): limits, retries, typed-text fallback. |

## How a tap works

A handler returns a `Reply` (`string | Outbound | Outbound[]`). Buttons and rows carry `ui:<STATE>:<value>`.
Tapping one is **identical to typing `<value>`**, so handlers keep their typed parsing and old habits still work:
option numbers, `0` back, `00` My Chama menu, `000` exit, `#` main menu, `FULL`, `PAY`, `YES`.

* `<STATE>` is the state the message was sent in. A tap from an earlier screen is **stale**: it gets a
  "no longer active" notice and is never acted on (this also makes a double tap on *Confirm* harmless).
* `#` returns to the main menu from every screen of every flow (webhook level).
* Pickers show 7 items per page plus Previous / More / Back (WhatsApp allows 10 rows). A row's value is its position in
  the whole list, so typing `11` works on any page.
* If Meta rejects an interactive message, the sender falls back to plain text led by what to type
  (`7. Landlord Watch`, `FULL. Pay full amount`).

## Adding a screen

1. Put copy in `constants/*.messages.ts` (both languages) and labels in `ui.messages.ts`.
2. Return `uiButtons(body, [btn(value, label), ...])` or `uiList(...)` / `picker(...)`; use `*` ids (the default).
3. The state's existing handler receives `value` as its input. Nothing else to wire.

## Tests

`npx tsc && node --test "lib/__tests__/**/*.test.js"` (`LW_MOCK=1` is set by the test env).
`__tests__/ui/rig.ts` drives real webhook payloads through the real handlers with Firestore, Paystack and the sender faked.
