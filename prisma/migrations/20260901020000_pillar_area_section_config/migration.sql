-- #160 (Reorderable, toggleable section list) — see docs/adr/0016-user-creatable-pillars-and-areas.md.
--
-- Ordered {type, visible}[] per Pillar/Area page, nullable — null means
-- "no config yet", handled entirely in application code (every section
-- shows, in the default order) rather than backfilled here.

ALTER TABLE "Pillar" ADD COLUMN "sectionConfig" JSONB;
ALTER TABLE "Area" ADD COLUMN "sectionConfig" JSONB;
