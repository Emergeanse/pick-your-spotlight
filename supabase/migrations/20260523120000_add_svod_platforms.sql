-- Nouvelles plateformes SVOD françaises disponibles sur TMDB

-- MUBI (id: 11)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-mubi', 'MUBI', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- Arte (id: 234)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-arte', 'Arte', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- TF1+ (id: 1754)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-tf1plus', 'TF1+', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- M6+ (id: 147)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-m6plus', 'M6+', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- ADN / Animation Digital Network (id: 415)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-adn', 'ADN', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- LaCinetek (id: 310)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-lacinetek', 'LaCinetek', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- Shadowz (id: 513)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-shadowz', 'Shadowz', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- Molotov TV (id: 1967)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-molotov', 'Molotov TV', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- Pluto TV (id: 300)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-plutotv', 'Pluto TV', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- Pathé Home (id: 2601)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-pathehome', 'Pathé Home', 'platform', 0)
ON CONFLICT (key) DO NOTHING;

-- SFR Play (id: 193)
INSERT INTO preference_tags (key, label, category, weight_default)
VALUES ('platform-sfrplay', 'SFR Play', 'platform', 0)
ON CONFLICT (key) DO NOTHING;
