CREATE TABLE story_files (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size > 0),
  created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','deleting')),
  upload_id TEXT
);
CREATE INDEX stories_order ON story_files(created DESC, collection, position);

CREATE TABLE story_storage (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  capacity INTEGER NOT NULL CHECK(capacity > 0)
);
INSERT INTO story_storage VALUES (1, 10000000000);

