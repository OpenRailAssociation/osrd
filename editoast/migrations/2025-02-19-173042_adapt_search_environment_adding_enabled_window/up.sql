ALTER TABLE stdcm_search_environment
    ADD COLUMN enabled_from TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01 00:00:00' NOT NULL,
    ADD COLUMN enabled_until TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-02 00:00:00' NOT NULL;
CREATE INDEX idx_search_environment_enabled_from ON stdcm_search_environment (enabled_from);
CREATE INDEX idx_search_environment_enabled_until ON stdcm_search_environment (enabled_until);
