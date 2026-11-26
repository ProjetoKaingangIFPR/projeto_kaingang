ALTER TABLE story_files ADD COLUMN object_key TEXT;
UPDATE story_files SET object_key = 'stories/' || id;
