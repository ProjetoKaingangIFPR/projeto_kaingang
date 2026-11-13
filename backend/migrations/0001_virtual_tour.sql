CREATE TABLE tours (
  slot TEXT PRIMARY KEY CHECK (slot = 'published'),
  metadata TEXT NOT NULL CHECK (json_valid(metadata)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE tour_walls (
  tour_slot TEXT NOT NULL REFERENCES tours(slot) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (tour_slot, id)
);
CREATE TABLE tour_rooms (
  tour_slot TEXT NOT NULL REFERENCES tours(slot) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (tour_slot, id)
);
CREATE TABLE tour_points (
  tour_slot TEXT NOT NULL REFERENCES tours(slot) ON DELETE CASCADE,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (tour_slot, id)
);
CREATE TABLE tour_connections (
  tour_slot TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (tour_slot, source_id, target_id),
  FOREIGN KEY (tour_slot, source_id) REFERENCES tour_points(tour_slot, id) ON DELETE CASCADE,
  FOREIGN KEY (tour_slot, target_id) REFERENCES tour_points(tour_slot, id) ON DELETE CASCADE
);
CREATE TABLE tour_hotspots (
  tour_slot TEXT NOT NULL,
  point_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  PRIMARY KEY (tour_slot, point_id, id),
  FOREIGN KEY (tour_slot, point_id) REFERENCES tour_points(tour_slot, id) ON DELETE CASCADE
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  credential_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE login_attempts (
  client_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX login_attempts_expiry ON login_attempts(expires_at);
