import { NextRequest, NextResponse } from "next/server";
import { getValidSession } from "@/lib/auth/session";
import { mapLegacyExport, type LegacyExport } from "@/lib/import/map-legacy-export";
import { importMappedData } from "@/lib/import/import-mapped-data";

/**
 * One-time import of the old prototype's JSON export (its Map-view "Export"
 * feature). Idempotent — every imported row is keyed by a `legacy-*` id
 * derived from the prototype's own id, so posting the same file twice is a
 * no-op rather than a duplicate import. Independent of actually having the
 * export file (wayfinder ticket #4) — this only needs to work once one exists.
 */
export async function POST(request: NextRequest) {
  const authenticated = await getValidSession();
  if (!authenticated) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let legacy: LegacyExport;
  try {
    legacy = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!legacy?.data?.actions || typeof legacy.data.actions !== "object" || Array.isArray(legacy.data.actions)) {
    return NextResponse.json(
      { ok: false, error: "Doesn't look like a prototype export — missing data.actions." },
      { status: 400 }
    );
  }
  if (!Array.isArray(legacy.data.myDayOrder)) {
    return NextResponse.json(
      { ok: false, error: "Doesn't look like a prototype export — data.myDayOrder isn't an array." },
      { status: 400 }
    );
  }
  for (const [bucketId, items] of Object.entries(legacy.data.actions)) {
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { ok: false, error: `Doesn't look like a prototype export — data.actions.${bucketId} isn't an array.` },
        { status: 400 }
      );
    }
  }

  try {
    const mapped = mapLegacyExport(legacy);
    const summary = await importMappedData(mapped);
    return NextResponse.json({ ok: true, summary });
  } catch {
    // Every row is upserted keyed by a stable legacy-derived id, so a
    // partially-applied import from a failure here is safe to retry —
    // re-posting the same file just re-applies what didn't land.
    return NextResponse.json(
      { ok: false, error: "Import failed partway through — safe to retry with the same file." },
      { status: 500 }
    );
  }
}
