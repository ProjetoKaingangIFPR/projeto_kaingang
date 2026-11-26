ALTER TABLE story_files ADD COLUMN kind TEXT NOT NULL DEFAULT 'story' CHECK(kind IN ('story','culture'));
ALTER TABLE story_files ADD COLUMN cultural_year INTEGER;
CREATE INDEX cultural_weeks_order ON story_files(kind, cultural_year, created, position);
