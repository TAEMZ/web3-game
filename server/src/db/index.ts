import pg from "pg";

// Render's managed Postgres requires SSL. Enable it when a DATABASE_URL is set
// (Render provides one) or when PGSSL=true. rejectUnauthorized:false is needed
// because Render's CA isn't in Node's default trust bundle.
const useSsl = !!process.env.DATABASE_URL || process.env.PGSSL === "true";

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  // Connection pool optimization
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds (increased for slow connections)
});

db.on("error", (err) => {
  console.error("Postgres pool error:", err.message);
});

export const INIT_TABLES = /* sql */ `
    CREATE TABLE IF NOT EXISTS "user" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(128),
        password TEXT,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "game" (
        id SERIAL PRIMARY KEY,
        winner VARCHAR(5),
        end_reason VARCHAR(16),
        pgn TEXT,
        white_id INT REFERENCES "user",
        white_name VARCHAR(32),
        black_id INT REFERENCES "user",
        black_name VARCHAR(32),
        started_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(64) UNIQUE;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS resignations INTEGER DEFAULT 0;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_ip VARCHAR(64);

    CREATE TABLE IF NOT EXISTS "report" (
        id SERIAL PRIMARY KEY,
        reporter_id INT,
        reporter_name VARCHAR(64),
        reported_id INT,
        reported_name VARCHAR(64),
        reason VARCHAR(32),
        note TEXT,
        game_code VARCHAR(16),
        chat_snapshot TEXT,
        status VARCHAR(16) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_report_status ON "report"(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS "banned_ip" (
        ip VARCHAR(64) PRIMARY KEY,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_game_white_id ON "game"(white_id);
    CREATE INDEX IF NOT EXISTS idx_game_black_id ON "game"(black_id);
    CREATE INDEX IF NOT EXISTS idx_game_ended_at ON "game"(ended_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_wallet ON "user"(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
`;
