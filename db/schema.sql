-- Owl & Compass (Atlas) — Database Schema (PostgreSQL / Supabase)
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Founders Table
CREATE TABLE IF NOT EXISTS founders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_stage TEXT,
    industry TEXT,
    bio TEXT,
    email TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    linkedin_url TEXT,
    linkedin_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verified Sources Table (Temporal Tracking)
CREATE TABLE IF NOT EXISTS founder_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'podcast', 'blog', 'linkedin', 'interview'
    extracted_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Touchpoints / Notes Memory Table
CREATE TABLE IF NOT EXISTS workspace_touchpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'email', 'linkedin', 'transcript', 'note'
    fts_vec TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding VECTOR(1536), -- Dynamic embedding generated on save
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timeline Events Table
CREATE TABLE IF NOT EXISTS founder_timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'research', 'outreach', 'reply', 'meeting', 'followup'
    summary TEXT NOT NULL,
    open_loops TEXT[],
    promises TEXT[],
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for Hybrid Search
CREATE INDEX IF NOT EXISTS idx_touchpoints_fts ON workspace_touchpoints USING GIN(fts_vec);
CREATE INDEX IF NOT EXISTS idx_touchpoints_vector ON workspace_touchpoints USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Reciprocal Rank Fusion (RRF) Hybrid Search Function
CREATE OR REPLACE FUNCTION hybrid_workspace_search(
    query_text TEXT,
    query_embedding VECTOR(1536),
    match_count INT DEFAULT 10,
    rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    founder_id UUID,
    content TEXT,
    source_type TEXT,
    combined_score FLOAT
) AS $$
WITH fts_matches AS (
    SELECT 
        id, 
        founder_id, 
        content, 
        source_type,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fts_vec, plainto_tsquery('english', query_text)) DESC) AS rank
    FROM workspace_touchpoints
    WHERE fts_vec @@ plainto_tsquery('english', query_text)
    LIMIT match_count * 2
),
vector_matches AS (
    SELECT 
        id, 
        founder_id, 
        content, 
        source_type,
        ROW_NUMBER() OVER (ORDER BY embedding <=> query_embedding ASC) AS rank
    FROM workspace_touchpoints
    LIMIT match_count * 2
)
SELECT 
    COALESCE(f.id, v.id) AS id,
    COALESCE(f.founder_id, v.founder_id) AS founder_id,
    COALESCE(f.content, v.content) AS content,
    COALESCE(f.source_type, v.source_type) AS source_type,
    (COALESCE(1.0 / (rrf_k + f.rank), 0.0) + COALESCE(1.0 / (rrf_k + v.rank), 0.0))::FLOAT AS combined_score
FROM fts_matches f
FULL OUTER JOIN vector_matches v ON f.id = v.id
ORDER BY combined_score DESC
LIMIT match_count;
$$ LANGUAGE sql STABLE;
