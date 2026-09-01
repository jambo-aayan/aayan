-- #161/#162 (Generic Data & Visualization) — see docs/adr/0017-generic-data-and-visualization.md.
--
-- Visual: one chart or table instance in a Pillar/Area page's Charts/Table zone.
-- VisualRecord: ad-hoc chart data points (only for an unbound chart).
-- TableColumn/TableRow: a Table Visual's user-added custom columns and rows
-- (a bound table's built-in columns are never persisted, only its custom ones).

CREATE TYPE "VisualType" AS ENUM ('LINE', 'BAR', 'PROGRESS_BAR', 'SCATTER', 'STREAK_HEATMAP', 'TABLE');
CREATE TYPE "TableColumnType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'CHECKBOX');

CREATE TABLE "Visual" (
  "id" TEXT NOT NULL,
  "pillarId" TEXT NOT NULL,
  "areaId" TEXT,
  "type" "VisualType" NOT NULL,
  "title" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Visual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisualRecord" (
  "id" TEXT NOT NULL,
  "visualId" TEXT NOT NULL,
  "date" DATE,
  "xValue" DOUBLE PRECISION,
  "yValue" DOUBLE PRECISION,
  "xLabel" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisualRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TableColumn" (
  "id" TEXT NOT NULL,
  "visualId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TableColumnType" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TableColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TableRow" (
  "id" TEXT NOT NULL,
  "visualId" TEXT NOT NULL,
  "boundEntityId" TEXT,
  "data" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableRow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Visual_pillarId_idx" ON "Visual"("pillarId");
CREATE INDEX "Visual_areaId_idx" ON "Visual"("areaId");
CREATE INDEX "VisualRecord_visualId_idx" ON "VisualRecord"("visualId");
CREATE INDEX "TableColumn_visualId_idx" ON "TableColumn"("visualId");
CREATE INDEX "TableRow_visualId_idx" ON "TableRow"("visualId");
CREATE INDEX "TableRow_visualId_boundEntityId_idx" ON "TableRow"("visualId", "boundEntityId");

ALTER TABLE "Visual" ADD CONSTRAINT "Visual_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Visual" ADD CONSTRAINT "Visual_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisualRecord" ADD CONSTRAINT "VisualRecord_visualId_fkey" FOREIGN KEY ("visualId") REFERENCES "Visual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableColumn" ADD CONSTRAINT "TableColumn_visualId_fkey" FOREIGN KEY ("visualId") REFERENCES "Visual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableRow" ADD CONSTRAINT "TableRow_visualId_fkey" FOREIGN KEY ("visualId") REFERENCES "Visual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
