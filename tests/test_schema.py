"""Tests for PostgreSQL Database Schema script structure."""

from pathlib import Path


def test_schema_sql_file_exists_and_contains_required_tables():
    """Verify db/schema.sql exists and contains all required table definitions and functions."""
    schema_path = Path(__file__).parent.parent / "db" / "schema.sql"
    assert schema_path.exists(), "db/schema.sql file must exist"

    content = schema_path.read_text(encoding="utf-8")

    # Verify tables
    assert "CREATE TABLE IF NOT EXISTS founders" in content
    assert "CREATE TABLE IF NOT EXISTS founder_sources" in content
    assert "CREATE TABLE IF NOT EXISTS workspace_touchpoints" in content
    assert "CREATE TABLE IF NOT EXISTS founder_timeline_events" in content

    # Verify Extensions and Indexes
    assert 'CREATE EXTENSION IF NOT EXISTS "vector"' in content
    assert 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"' in content
    assert "CREATE INDEX IF NOT EXISTS idx_touchpoints_fts" in content
    assert "CREATE INDEX IF NOT EXISTS idx_touchpoints_vector" in content

    # Verify Hybrid Search RRF function
    assert "CREATE OR REPLACE FUNCTION hybrid_workspace_search" in content
    assert "plainto_tsquery('english', query_text)" in content
    assert "embedding <=> query_embedding" in content
    assert "combined_score" in content
