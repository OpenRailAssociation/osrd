-- Removes all setup roles. It's fine to do so as we have a script attributing the right roles for all our groups in production and we don't have mocked data yet.
DELETE FROM authz_role;
