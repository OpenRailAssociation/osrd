-- The main init_db.sql file contains operations incompatible with test environments:
-- - User creation (CREATE USER osrd) - the osrd user already exists in test environments
-- - Fixed database names (template_osrd, osrd) - tests need unique database names
-- - Template database creation - handled dynamically by Rust code with migration hashing
--
-- This file focuses on:
-- - Installing required PostgreSQL extensions
-- - Creating necessary schemas
-- - Setting up permissions
--
-- The Rust code handles the complex logic (template creation, database cloning, cleanup)
-- while this SQL file provides the minimal foundation needed for migrations to work.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE SCHEMA IF NOT EXISTS openfga;

GRANT ALL PRIVILEGES ON SCHEMA public TO osrd;
GRANT ALL PRIVILEGES ON SCHEMA openfga TO osrd;
