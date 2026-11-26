ALTER TABLE story_files ADD COLUMN author TEXT;
ALTER TABLE story_files ADD COLUMN recorded_on TEXT;
CREATE INDEX story_recorded_order ON story_files(recorded_on, collection, position);
