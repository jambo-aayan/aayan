import { isValidIsoDateString } from "./date-validation";

/** Parses bulk-entered chart data — pasted text or a CSV file's contents,
 * both funnel through this one function (#165, ADR-0017). One row per
 * line: `date, value[, note]`, comma- or tab-separated (whatever's pasted
 * out of a spreadsheet). Pure — no Prisma/React — so it's directly
 * unit-testable; every ad-hoc date-based chart's "Add data" single-record
 * form, paste box, and CSV upload all end up calling this same parser. */

const LINE_PATTERN = /^\s*([^,\t]+?)\s*[,\t]\s*([^,\t]+?)\s*(?:[,\t]\s*(.*))?$/;

export type ParsedRecordRow = { line: number; date: string; value: number; note?: string };
export type ParseRecordError = { line: number; raw: string; message: string };
export type ParseRecordsResult = { rows: ParsedRecordRow[]; errors: ParseRecordError[] };

export function parseRecordsText(text: string): ParseRecordsResult {
  const rows: ParsedRecordRow[] = [];
  const errors: ParseRecordError[] = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === "") return;
    const lineNumber = index + 1;

    const match = line.match(LINE_PATTERN);
    if (!match) {
      errors.push({ line: lineNumber, raw: line, message: "Expected \"date, value\" (or \"date, value, note\")." });
      return;
    }
    const [, dateRaw, valueRaw, noteRaw] = match;

    if (!isValidIsoDateString(dateRaw)) {
      errors.push({ line: lineNumber, raw: line, message: `"${dateRaw}" isn't a real date like 2026-01-15.` });
      return;
    }

    const value = Number(valueRaw);
    if (!Number.isFinite(value)) {
      errors.push({ line: lineNumber, raw: line, message: `"${valueRaw}" isn't a number.` });
      return;
    }

    rows.push({ line: lineNumber, date: dateRaw, value, note: noteRaw?.trim() || undefined });
  });

  return { rows, errors };
}
