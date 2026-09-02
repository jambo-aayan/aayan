-- #182 (Metric system) — see #181, docs/adr/0007-v2-phase3-daily-log-sheet.md.
--
-- Replaces DailyLog's single fixed-shape row (mood/stress/energy/sleep
-- quality/pain/headache/stiffness/weight/waist/blood pressure, daily-only,
-- no required/cadence concept) with a generic Metric + MetricEntry system:
-- user-defined metrics with their own value type, cadence, and required
-- flag. Seeds one Metric per existing DailyLog field, backfills every
-- existing DailyLog row's data into MetricEntry rows against those seeded
-- metrics, then drops DailyLog — no data loss. mobility/trained stay
-- exactly as before (derived live from CheckIn data, never persisted here).

CREATE TYPE "MetricValueType" AS ENUM ('NUMBER', 'SCALE_5', 'BOOLEAN', 'ENUM', 'TEXT');
CREATE TYPE "MetricCadence" AS ENUM ('DAILY', 'WEEKLY', 'AD_HOC');

CREATE TABLE "Metric" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "valueType" "MetricValueType" NOT NULL,
  "cadence" "MetricCadence" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "unit" TEXT,
  "enumOptions" TEXT,
  "pillarId" TEXT,
  "areaId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Metric_pillarId_idx" ON "Metric"("pillarId");
CREATE INDEX "Metric_areaId_idx" ON "Metric"("areaId");

ALTER TABLE "Metric" ADD CONSTRAINT "Metric_pillarId_fkey"
  FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MetricEntry" (
  "id" TEXT NOT NULL,
  "metricId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "numberValue" DOUBLE PRECISION,
  "textValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MetricEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetricEntry_metricId_date_key" ON "MetricEntry"("metricId", "date");
CREATE INDEX "MetricEntry_metricId_idx" ON "MetricEntry"("metricId");

ALTER TABLE "MetricEntry" ADD CONSTRAINT "MetricEntry_metricId_fkey"
  FOREIGN KEY ("metricId") REFERENCES "Metric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed one Metric per DailyLog field, all DAILY-cadence, required: false
-- (matching the prior implicit behavior — nothing was ever "required" in
-- any enforced sense before). Fixed ids, not gen_random_uuid(), so the
-- backfill below can reference them directly by literal.
INSERT INTO "Metric" ("id", "name", "valueType", "cadence", "required", "unit", "pillarId", "areaId", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('metric-mood', 'Mood', 'SCALE_5', 'DAILY', false, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-stress', 'Stress', 'SCALE_5', 'DAILY', false, NULL, NULL, NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-energy', 'Energy', 'SCALE_5', 'DAILY', false, NULL, NULL, NULL, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-sleep-quality', 'Sleep quality', 'SCALE_5', 'DAILY', false, NULL, NULL, NULL, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-pain', 'Pain', 'SCALE_5', 'DAILY', false, NULL, NULL, NULL, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-stiffness', 'Morning stiffness', 'NUMBER', 'DAILY', false, 'min', NULL, NULL, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-weight', 'Weight', 'NUMBER', 'DAILY', false, 'kg', NULL, NULL, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-waist', 'Waist', 'NUMBER', 'DAILY', false, 'cm', NULL, NULL, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-bp-systolic', 'Blood pressure (systolic)', 'NUMBER', 'DAILY', false, 'mmHg', 'health', 'care', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('metric-bp-diastolic', 'Blood pressure (diastolic)', 'NUMBER', 'DAILY', false, 'mmHg', 'health', 'care', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Headache is the one ENUM-typed metric — enumOptions is a JSON string
-- array mirroring the old HeadacheLevel enum's four values, worst-first
-- severity implied by array order (see lib/metrics/logic.ts's own
-- day's-worst folding, which reasons about severity independently of this
-- array's order — the order here is just for a picker UI).
INSERT INTO "Metric" ("id", "name", "valueType", "cadence", "required", "enumOptions", "pillarId", "areaId", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('metric-headache', 'Headache', 'ENUM', 'DAILY', false, '["NONE","MILD","MODERATE","BAD"]', NULL, NULL, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Backfill: one MetricEntry per DailyLog row per non-null field. `date` is
-- already midnight-truncated on DailyLog (its own utcMidnight convention),
-- so no truncation needed here.
INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-mood', "date", "mood"::double precision, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-stress', "date", "stress"::double precision, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-energy', "date", "energy"::double precision, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-sleep-quality', "date", "sleepQuality"::double precision, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-pain', "date", "pain"::double precision, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-stiffness', "date", "stiffness"::double precision, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "textValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-headache', "date", "headache"::text, "createdAt", "updatedAt" FROM "DailyLog";

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-weight', "date", "weight", "createdAt", "updatedAt" FROM "DailyLog" WHERE "weight" IS NOT NULL;

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-waist', "date", "waist", "createdAt", "updatedAt" FROM "DailyLog" WHERE "waist" IS NOT NULL;

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-bp-systolic', "date", "bpSystolic"::double precision, "createdAt", "updatedAt" FROM "DailyLog" WHERE "bpSystolic" IS NOT NULL;

INSERT INTO "MetricEntry" ("id", "metricId", "date", "numberValue", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'metric-bp-diastolic', "date", "bpDiastolic"::double precision, "createdAt", "updatedAt" FROM "DailyLog" WHERE "bpDiastolic" IS NOT NULL;

DROP TABLE "DailyLog";
DROP TYPE "HeadacheLevel";
