-- Owl & Compass (Atlas) — Database Migration 002: RRF Hybrid Search & Pattern Aggregation
-- Version: 2.0 | July 2026

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-Text Search Indices on Workspace Touchpoints and Founder Profiles
ALTER TABLE workspace_touchpoints 
  ADD COLUMN IF NOT EXISTS fts_vector tsvector 
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_workspace_touchpoints_fts ON workspace_touchpoints USING GIN (fts_vector);

-- Add embedding vector column to workspace_touchpoints for semantic search
ALTER TABLE workspace_touchpoints 
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Hybrid Search Procedure implementing Reciprocal Rank Fusion (RRF k=60)
CREATE OR REPLACE FUNCTION hybrid_workspace_search(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    touchpoint_id UUID,
    founder_id UUID,
    founder_name TEXT,
    company_name TEXT,
    source_type TEXT,
    snippet TEXT,
    rrf_score DOUBLE PRECISION
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH fts_results AS (
        SELECT 
            wt.id AS touchpoint_id,
            wt.founder_id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(wt.fts_vector, websearch_to_tsquery('english', query_text)) DESC) AS fts_rank
        FROM workspace_touchpoints wt
        WHERE wt.fts_vector @@ websearch_to_tsquery('english', query_text)
        LIMIT 50
    ),
    vec_results AS (
        SELECT 
            wt.id AS touchpoint_id,
            wt.founder_id,
            ROW_NUMBER() OVER (ORDER BY wt.embedding <=> query_embedding ASC) AS vec_rank
        FROM workspace_touchpoints wt
        WHERE wt.embedding IS NOT NULL
        LIMIT 50
    )
    SELECT 
        wt.id AS touchpoint_id,
        f.id AS founder_id,
        f.full_name AS founder_name,
        f.company_name AS company_name,
        wt.source_type,
        LEFT(wt.content, 200) AS snippet,
        (COALESCE(0.6 / (60 + fts.fts_rank), 0.0) + COALESCE(0.4 / (60 + vec.vec_rank), 0.0)) AS rrf_score
    FROM workspace_touchpoints wt
    JOIN founders f ON f.id = wt.founder_id
    LEFT JOIN fts_results fts ON fts.touchpoint_id = wt.id
    LEFT JOIN vec_results vec ON vec.touchpoint_id = wt.id
    WHERE fts.touchpoint_id IS NOT NULL OR vec.touchpoint_id IS NOT NULL
    ORDER BY rrf_score DESC
    LIMIT match_count;
END;
$$;
