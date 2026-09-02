import "server-only";
import { GoogleGenAI, Type } from "@google/genai";

export type ParsedTransaction = {
  date: string;
  amount: number;
  direction: "IN" | "OUT";
  description: string;
  category: string;
  confidence: number;
};

export type ParsedValuation = {
  balance: number;
  asOfDate: string;
  confidence: number;
};

/** A statement's own stated closing balance, alongside its transaction
 * lines — the ground truth uploadStatement anchors the new Snapshot's
 * balance to, instead of a computed running total that has no way to
 * recover from a wrong starting point (the account's balance before its
 * very first statement upload). Null when the statement doesn't state one
 * (e.g. some CSV exports), so callers can fall back to the computed delta
 * the same way they always have. institutionName/periodStart/periodEnd
 * feed the generated Statement name (#148, ADR-0015) — all null when the
 * statement doesn't state them clearly enough to extract with confidence,
 * same "omit rather than guess" rule as closingBalance. */
export type ParsedStatement = {
  transactions: ParsedTransaction[];
  closingBalance: number | null;
  institutionName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

/** category is constrained to the fixed category hierarchy's leaf labels
 * (#148 building on #147, hierarchy added #173/#174, ADR-0015) — an
 * enum, not a free-text guess, so statement extraction can't reintroduce
 * the near-duplicate-category fragmentation the taxonomy exists to fix.
 * `categoryLabels` are "Parent: Subcategory" strings (see
 * lib/finance/categories.ts's `leafCategoryLabel`) — never a top-level
 * category alone, and must include the caller's fallback leaf (e.g.
 * "Other: Uncategorized") so there's always a valid choice for a line
 * that doesn't clearly fit. */
function buildTransactionsSchema(categoryLabels: string[]) {
  return {
    type: Type.OBJECT,
    properties: {
      transactions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "The transaction date, as YYYY-MM-DD." },
            amount: { type: Type.NUMBER, description: "The absolute transaction amount, always positive." },
            direction: { type: Type.STRING, enum: ["IN", "OUT"], description: "IN for money received, OUT for money spent." },
            description: { type: Type.STRING, description: "The statement's own description/payee text for this line." },
            category: {
              type: Type.STRING,
              enum: categoryLabels,
              description: "The closest matching \"Parent: Subcategory\" label from the given list for this line's spending.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "0 to 1 — how confident the extraction is that date/amount/direction/category are all correct for this line.",
            },
          },
          required: ["date", "amount", "direction", "description", "category", "confidence"],
        },
      },
      closingBalance: {
        type: Type.NUMBER,
        description: "The statement's own stated closing/ending balance, if shown. Omit entirely if the statement doesn't state one.",
        nullable: true,
      },
      institutionName: {
        type: Type.STRING,
        description: "The bank/card issuer's name, e.g. 'Barclays' or 'Yonder'. Omit if not clearly stated.",
        nullable: true,
      },
      periodStart: {
        type: Type.STRING,
        description: "The statement period's start date, as YYYY-MM-DD. Omit if not clearly stated.",
        nullable: true,
      },
      periodEnd: {
        type: Type.STRING,
        description: "The statement period's end date, as YYYY-MM-DD. Omit if not clearly stated.",
        nullable: true,
      },
    },
    required: ["transactions"],
  };
}

function buildTransactionsPrompt(categoryLabels: string[]): string {
  return (
    "Extract every individual transaction line from this bank statement. Ignore running balance " +
    "columns, headers, and summary rows — only real transaction lines. Amounts are always positive; " +
    `use direction to encode whether money came in or went out. Categorize each line using only ` +
    `one of these "Parent: Subcategory" labels: ${categoryLabels.map((c) => `"${c}"`).join(", ")} — pick the closest ` +
    "match, always the full \"Parent: Subcategory\" label, never just the parent half and never an " +
    "invented label. Give each transaction its own confidence score reflecting how sure you are " +
    "the date, amount, direction, and category are all correct — lower it for handwritten-looking, " +
    "smudged, ambiguous, or unclear entries rather than guessing high. Separately, if the statement " +
    "states its own closing/ending balance, extract that too — this is the account's real balance " +
    "and takes priority over summing transactions. Also extract the issuing institution's name and " +
    "the statement's period start/end dates, if clearly stated. Leave any of these out rather than " +
    "guessing if the statement doesn't state them."
  );
}

const VALUATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    balance: { type: Type.NUMBER, description: "The account's total closing/current balance shown on the statement." },
    asOfDate: { type: Type.STRING, description: "The date this balance is as of, as YYYY-MM-DD." },
    confidence: {
      type: Type.NUMBER,
      description: "0 to 1 — how confident the extraction is that balance and asOfDate are both correct.",
    },
  },
  required: ["balance", "asOfDate", "confidence"],
};

const VALUATION_PROMPT =
  "This is a balance-only statement for an account like a pension or investment (no itemised " +
  "transaction list expected). Find the account's single total closing/current balance and the " +
  "date it's as of. Lower the confidence score for a statement with multiple candidate balances, " +
  "unclear formatting, or no clearly stated as-of date.";

function buildContents(fileBuffer: Buffer, mimeType: string, prompt: string) {
  const isCsv = mimeType === "text/csv";
  return [
    {
      role: "user" as const,
      parts: isCsv
        ? [{ text: fileBuffer.toString("utf-8") }, { text: prompt }]
        : [{ inlineData: { data: fileBuffer.toString("base64"), mimeType } }, { text: prompt }],
    },
  ];
}

/** Parses a bank statement (PDF or CSV) into dated transactions plus,
 * when the statement states them, its own closing balance and
 * institution/period metadata — via Gemini 2.5 Flash, sent as direct
 * file input against a structured schema — no hand-written per-bank
 * heuristics, no mocked parsing (#115, ADR-0010). `categoryLabels` are
 * the fixed hierarchy's "Parent: Subcategory" leaf labels (#147/#173,
 * lib/finance/categories.ts's `leafCategoryLabel`), constraining each
 * line's category to one of those labels rather than a free-text guess
 * (#148/#174, ADR-0015). Integration-level: not unit tested directly,
 * per ADR-0010 and #112's Testing Decisions — verified via typecheck and
 * manual review. */
export async function parseStatement(fileBuffer: Buffer, mimeType: string, categoryLabels: string[]): Promise<ParsedStatement> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildContents(fileBuffer, mimeType, buildTransactionsPrompt(categoryLabels)),
    config: { responseMimeType: "application/json", responseSchema: buildTransactionsSchema(categoryLabels) },
  });

  const parsed = JSON.parse(response.text ?? "{}") as Partial<ParsedStatement>;
  return {
    transactions: parsed.transactions ?? [],
    closingBalance: parsed.closingBalance ?? null,
    institutionName: parsed.institutionName ?? null,
    periodStart: parsed.periodStart ?? null,
    periodEnd: parsed.periodEnd ?? null,
  };
}

/** Parses a Valuation account's statement (PDF or CSV) for its single
 * balance figure and as-of date, reusing the same Gemini wrapper as
 * parseStatement — no transaction list expected (#116, ADR-0010). Returns
 * null when Gemini returns no usable response (blocked, safety-filtered,
 * empty candidate), so the caller can distinguish "nothing found" from a
 * successful zero-confidence extraction. */
export async function parseValuation(fileBuffer: Buffer, mimeType: string): Promise<ParsedValuation | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildContents(fileBuffer, mimeType, VALUATION_PROMPT),
    config: { responseMimeType: "application/json", responseSchema: VALUATION_SCHEMA },
  });

  if (!response.text) return null;
  const parsed = JSON.parse(response.text) as Partial<ParsedValuation>;
  if (parsed.balance === undefined || parsed.asOfDate === undefined || parsed.confidence === undefined) return null;
  return parsed as ParsedValuation;
}
