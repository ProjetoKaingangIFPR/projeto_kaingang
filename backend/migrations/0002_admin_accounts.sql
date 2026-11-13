CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session_version TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- As sessões antigas contêm um hash derivado da senha: descarte-as.
DROP TABLE admin_sessions;
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  session_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
CREATE INDEX admin_sessions_user ON admin_sessions(user_id);
