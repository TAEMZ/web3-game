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
    -- Platform-custodial wallet key (TESTNET demo only, no real value): lets the
    -- platform stake/settle wagers on the player's behalf so players never touch
    -- a wallet or pay gas.
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS custodial_pk VARCHAR(80);
    -- One-time Arena Pass: unlocks wager (betting) mode. No expiry.
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT false;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMP;

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

    -- Wager (staked) matches settled through the ArenaEscrow contract on-chain.
    CREATE TABLE IF NOT EXISTS "wager" (
        id SERIAL PRIMARY KEY,
        game_code VARCHAR(16) UNIQUE,
        match_id INTEGER,                    -- on-chain ArenaEscrow match id
        stake NUMERIC NOT NULL,              -- whole ARENA each side stakes
        p1_user_id INT,
        p1_wallet VARCHAR(64),
        p2_user_id INT,
        p2_wallet VARCHAR(64),
        state VARCHAR(16) DEFAULT 'open',    -- open | funded | settled | cancelled
        winner_wallet VARCHAR(64),
        settle_tx VARCHAR(80),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wager_match ON "wager"(match_id);

    -- Token top-ups: player pays (off-chain, fiat/testnet), admin verifies the
    -- amount and releases (mints) ARENA to the player's wallet. Repeatable, no expiry.
    CREATE TABLE IF NOT EXISTS "deposit" (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES "user",
        user_name VARCHAR(64),
        amount NUMERIC NOT NULL,             -- whole ARENA to release
        method VARCHAR(32),                  -- e.g. bank / telebirr / cash
        reference TEXT,                      -- payment reference the player provides
        wallet VARCHAR(64),                  -- destination wallet for the mint
        status VARCHAR(16) DEFAULT 'pending',-- pending | approved | rejected
        mint_tx VARCHAR(80),
        reviewed_by VARCHAR(64),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_deposit_status ON "deposit"(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deposit_user ON "deposit"(user_id);

    -- Withdrawals (cash-out): player converts ARENA back to birr. Admin pays the
    -- birr off-chain and marks it paid. Amount/birr snapshot recorded at request.
    CREATE TABLE IF NOT EXISTS "withdrawal" (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES "user",
        user_name VARCHAR(64),
        amount NUMERIC NOT NULL,             -- ARENA to cash out
        usd NUMERIC,
        birr NUMERIC,
        wallet VARCHAR(64),
        payout_to TEXT,                      -- where the player wants the birr (phone/bank)
        status VARCHAR(16) DEFAULT 'pending',-- pending | paid | rejected
        reviewed_by VARCHAR(64),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON "withdrawal"(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON "withdrawal"(user_id);

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_game_white_id ON "game"(white_id);
    CREATE INDEX IF NOT EXISTS idx_game_black_id ON "game"(black_id);
    CREATE INDEX IF NOT EXISTS idx_game_ended_at ON "game"(ended_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_wallet ON "user"(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
`;
