ALTER TABLE rolling_stock
ADD supported_signaling_systems jsonb NOT NULL DEFAULT ('["BAPR", "BAL", "TVM300", "TVM430"]');
