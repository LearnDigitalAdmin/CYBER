import { test } from "node:test";
import assert from "node:assert/strict";
import { CsvError, detectDelimiter, parseCsv } from "../../src/desk/modules/import/csv";
import { buildColumns, buildRows, cellToString, guessHasHeader, mappingProblem, normaliseGrid } from "../../src/desk/modules/import/table";
import { groupErrors, inferRowBase } from "../../src/desk/access/service/records";

test("csv: quotes, commas, doubled quotes, embedded newlines, CRLF", () => {
  const text = 'name,note\r\n"Wanjiku, Mary","said ""hi""\nthere"\r\nOtieno,\r\n';
  assert.deepEqual(parseCsv(text), [["name", "note"], ["Wanjiku, Mary", 'said "hi"\nthere'], ["Otieno", ""]]);
});
test("csv: BOM, LF and CR line ends, no trailing newline", () => {
  assert.deepEqual(parseCsv("\ufeffa,b\nc,d"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parseCsv("a,b\rc,d\r"), [["a", "b"], ["c", "d"]]);
});
test("csv: semicolon and tab delimiters are detected, commas inside quotes are ignored", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  assert.equal(detectDelimiter('"a,b,c";d\n'), ";");
  assert.equal(detectDelimiter("single"), ",");
  assert.deepEqual(parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
});
test("csv: empty fields and trailing delimiter are kept", () => {
  assert.deepEqual(parseCsv("a,,c\n,b,"), [["a", "", "c"], ["", "b", ""]]);
  assert.deepEqual(parseCsv(""), []);
});
test("csv: an unclosed quote is an error, not silent data loss", () => {
  assert.throws(() => parseCsv('a,b\n"oops,1\n2,3'), CsvError);
});

test("cellToString: dates, numbers, booleans, blanks", () => {
  assert.equal(cellToString(new Date("2025-03-04T00:00:00.000Z")), "2025-03-04");
  assert.equal(cellToString(new Date("2025-03-04T10:30:00.000Z")), "2025-03-04T10:30:00.000Z");
  assert.equal(cellToString(712345678), "712345678");
  assert.equal(cellToString(true), "true");
  assert.equal(cellToString(null), "");
  assert.equal(cellToString("  a\u00a0b  "), "a b");
  assert.equal(cellToString(NaN), "");
});

test("normaliseGrid: drops empty rows and empty trailing columns, keeps sheet line numbers", () => {
  const { grid, lines } = normaliseGrid([["Name", "Phone", "", ""], [null, null, null, null], ["Mary", "0712345678", null], ["Joe", null]]);
  assert.deepEqual(grid, [["Name", "Phone"], ["Mary", "0712345678"], ["Joe", ""]]);
  assert.deepEqual(lines, [1, 3, 4]);
});

test("guessHasHeader: labels yes, phone-like first row no", () => {
  assert.equal(guessHasHeader([["Name", "Phone"], ["Mary", "0712345678"]]), true);
  assert.equal(guessHasHeader([["Mary", "0712 345 678"], ["Joe", "0722345678"]]), false);
  assert.equal(guessHasHeader([]), false);
});

test("buildColumns: names from headers, duplicates and blanks handled, empty columns unticked", () => {
  const grid = [["Name", "Name", "", "Notes"], ["a", "b", "c", ""], ["d", "e", "f", ""]];
  const cols = buildColumns(grid, true);
  assert.deepEqual(cols.map((c) => c.field), ["Name", "Name_2", "column_3", "Notes"]);
  assert.deepEqual(cols.map((c) => c.include), [true, true, true, false]);
  assert.deepEqual(cols[0].samples, ["a", "d"]);
  assert.deepEqual(buildColumns([["a", "b"]], false).map((c) => c.field), ["column_1", "column_2"]);
});

test("mappingProblem: needs a column, unique non-empty names", () => {
  const cols = buildColumns([["Name", "Phone"], ["a", "1"]], true);
  assert.equal(mappingProblem(cols), null);
  assert.match(mappingProblem(cols.map((c) => ({ ...c, include: false }))) ?? "", /at least one/);
  assert.match(mappingProblem([{ ...cols[0] }, { ...cols[1], field: "name" }]) ?? "", /Two columns/);
  assert.match(mappingProblem([{ ...cols[0], field: "  " }, cols[1]]) ?? "", /field name/);
  assert.match(mappingProblem([{ ...cols[0], field: "x".repeat(61) }, cols[1]]) ?? "", /too long/);
});

test("buildRows: ticked columns only, text kept as text, blanks -> null, empty rows skipped, original lines kept", () => {
  const raw = [["Name", "Phone", "Skip"], ["Mary", "0712345678", "x"], [null, null, "y"], ["Joe", null, "z"]];
  const { grid, lines } = normaliseGrid(raw);
  const cols = buildColumns(grid, true).map((c) => (c.header === "Skip" ? { ...c, include: false } : c));
  const rows = buildRows(grid, lines, true, cols);
  assert.deepEqual(rows, [
    { line: 2, values: { Name: "Mary", Phone: "0712345678" } },
    { line: 4, values: { Name: "Joe", Phone: null } },
  ]);
});

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Person ${i}`, phone: `07000000${i}` }));

test("inferRowBase: row 0 means zero-based, row == count means one-based", () => {
  const rows = mk(5);
  assert.equal(inferRowBase([{ row: 0, field: "phone", reason: "bad" }], rows, rows.slice(1)), 0);
  assert.equal(inferRowBase([{ row: 5, field: "phone", reason: "bad" }], rows, rows.slice(0, 4)), 1);
  assert.equal(inferRowBase([], rows, rows), 1);
});
test("inferRowBase: ambiguous numbers are resolved from the rows the product accepted", () => {
  const rows = mk(5);
  // error on person 2: zero-based would say row 2, one-based would say row 3
  const valid = rows.filter((_, i) => i !== 2);
  assert.equal(inferRowBase([{ row: 2, field: "phone", reason: "bad" }], rows, valid), 0);
  assert.equal(inferRowBase([{ row: 3, field: "phone", reason: "bad" }], rows, valid), 1);
  // normalised values (phone rewritten) still line up through the name column
  const norm = valid.map((r) => ({ ...r, phone: "+254" + r.phone }));
  assert.equal(inferRowBase([{ row: 2, field: "phone", reason: "bad" }], rows, norm), 0);
});
test("inferRowBase: nothing to compare against falls back to 1", () => {
  const rows = mk(5);
  assert.equal(inferRowBase([{ row: 2, field: "phone", reason: "bad" }], rows, []), 1);
});

test("groupErrors: by index, out-of-range kept apart", () => {
  const errs = [{ row: 1, field: "a", reason: "x" }, { row: 1, field: "b", reason: "y" }, { row: 9, field: "a", reason: "z" }, { row: 0, field: "a", reason: "q" }];
  const g = groupErrors(errs, 1, 3);
  assert.equal(g.byIndex.get(0)?.length, 2);
  assert.deepEqual(g.unmatched.map((e) => e.row), [9, 0]);
});
