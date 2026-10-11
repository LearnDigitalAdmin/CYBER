/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { countSms, messageProblem, SMS_MAX_CHARS } from "./sms.ts";
import { buildSchedule, describeSchedule, nairobiNow } from "./scheduleFormat.ts";

test("GSM-7 messages: 160 in one segment, then 153 per segment", () => {
  assert.equal(countSms("").segments, 0);
  const one = countSms("a".repeat(160));
  assert.deepEqual([one.encoding, one.segments, one.remaining, one.perSegment], ["GSM-7", 1, 0, 160]);
  const two = countSms("a".repeat(161));
  assert.deepEqual([two.segments, two.perSegment, two.remaining], [2, 153, 145]);
  assert.equal(countSms("a".repeat(306)).segments, 2);
  assert.equal(countSms("a".repeat(307)).segments, 3);
});
test("extended GSM characters take two units", () => {
  const c = countSms("€".repeat(80));
  assert.deepEqual([c.encoding, c.units, c.chars, c.segments], ["GSM-7", 160, 80, 1]);
  assert.equal(countSms("€".repeat(81)).segments, 2);
  assert.equal(countSms("{[]}").units, 8);
});
test("any other character switches to Unicode: 70 then 67 per segment, and names the culprit", () => {
  const u = countSms("Habari 😀");
  assert.equal(u.encoding, "Unicode");
  assert.deepEqual(u.specials, ["😀"]);
  assert.equal(u.units, 9); // the emoji is two UTF-16 units
  assert.equal(countSms("ą".repeat(70)).segments, 1);
  assert.equal(countSms("ą".repeat(71)).segments, 2);
  assert.equal(countSms("ą".repeat(134)).segments, 2);
  assert.equal(countSms("ą".repeat(135)).segments, 3);
});
test("message problems mirror the server's 1–385 rule", () => {
  assert.equal(messageProblem("   "), "Write the message");
  assert.equal(messageProblem("Hello"), null);
  assert.equal(messageProblem("a".repeat(SMS_MAX_CHARS)), null);
  assert.match(String(messageProblem("a".repeat(SMS_MAX_CHARS + 3))), /3 characters too long/);
});

const NOW = Date.UTC(2026, 9, 11, 9, 0); // 12:00 in Nairobi
test("Nairobi time is UTC+3", () => assert.equal(nairobiNow(NOW), "2026-10-11T12:00"));
test("a one-off schedule needs a real date and at least five minutes' lead", () => {
  const ok = buildSchedule({ kind: "once", date: "2026-10-11", time: "12:05", days: [] }, NOW);
  assert.deepEqual(ok, { ok: true, schedule: { kind: "once", at: "2026-10-11T12:05" } });
  assert.equal(buildSchedule({ kind: "once", date: "2026-10-11", time: "12:04", days: [] }, NOW).ok, false);
  assert.equal(buildSchedule({ kind: "once", date: "", time: "12:30", days: [] }, NOW).ok, false);
  assert.equal(buildSchedule({ kind: "once", date: "2026-02-31x", time: "12:30", days: [] }, NOW).ok, false);
  assert.equal(buildSchedule({ kind: "once", date: "2026-10-12", time: "25:00", days: [] }, NOW).ok, false);
});
test("repeating schedules carry only what their kind uses", () => {
  assert.deepEqual(buildSchedule({ kind: "daily", date: "2026-01-01", time: "08:30", days: [1] }, NOW), { ok: true, schedule: { kind: "daily", at: "08:30" } });
  assert.deepEqual(buildSchedule({ kind: "weekly", date: "", time: "08:30", days: [5, 1, 5] }, NOW), { ok: true, schedule: { kind: "weekly", at: "08:30", days: [1, 5] } });
  assert.equal(buildSchedule({ kind: "weekly", date: "", time: "08:30", days: [] }, NOW).ok, false);
  assert.equal(buildSchedule({ kind: "weekly", date: "", time: "08:30", days: [8] }, NOW).ok, false);
  assert.deepEqual(buildSchedule({ kind: "monthly", date: "", time: "08:30", days: [31, 1] }, NOW), { ok: true, schedule: { kind: "monthly", at: "08:30", days: [1, 31] } });
  assert.equal(buildSchedule({ kind: "monthly", date: "", time: "08:30", days: [32] }, NOW).ok, false);
  assert.equal(buildSchedule({ kind: "daily", date: "", time: "", days: [] }, NOW).ok, false);
});
test("schedules are described in plain words", () => {
  assert.equal(describeSchedule({ kind: "weekly", at: "08:30", days: [1, 5] }), "Every Mon, Fri at 08:30 (Nairobi time)");
  assert.equal(describeSchedule({ kind: "once", at: "2026-10-12T09:00" }), "Once, on 2026-10-12 at 09:00 (Nairobi time)");
  assert.equal(describeSchedule({ kind: "monthly", at: "07:00", days: [1, 15] }), "On day 1, 15 of each month at 07:00 (Nairobi time)");
});
