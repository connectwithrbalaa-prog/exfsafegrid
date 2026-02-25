-- ============================================================
-- Seed: utility_circuits for ExfSafeGrid
-- Run on VPS:  docker exec -i exf_db psql -U postgres -d exf_wildfire < scripts/seed_circuits.sql
-- ============================================================

INSERT INTO utility_circuits (circuit_id, circuit_name, voltage_kv, utility_name, psa_id, county, state, hftd_tier, length_miles, customer_count, critical_customers, metadata)
VALUES
  ('SCE-001', 'Malibu Canyon 12kV',    12.0, 'SCE',    'CA-SC01', 'Los Angeles',    'CA', 3, 18.4,  3200,  45, '{"substation":"Malibu","feeder":"MC-101"}'),
  ('SCE-002', 'Santa Ana 66kV',        66.0, 'SCE',    'CA-SC01', 'Orange',         'CA', 2, 32.1,  8500, 120, '{"substation":"Santa Ana","feeder":"SA-201"}'),
  ('SCE-003', 'Big Bear 12kV',         12.0, 'SCE',    'CA-SC02', 'San Bernardino', 'CA', 3, 24.7,  1800,  22, '{"substation":"Big Bear","feeder":"BB-301"}'),
  ('SCE-004', 'Banning Pass 115kV',   115.0, 'SCE',    'CA-SC02', 'Riverside',      'CA', 2, 41.3,  6200,  88, '{"substation":"Banning","feeder":"BP-401"}'),
  ('SCE-005', 'Newhall Ranch 12kV',    12.0, 'SCE',    'CA-SC01', 'Los Angeles',    'CA', 2, 15.6,  4100,  55, '{"substation":"Newhall","feeder":"NR-501"}'),
  ('PGE-001', 'Diablo Range 60kV',     60.0, 'PG&E',   'CA-NC01', 'Alameda',        'CA', 2, 28.9,  5400,  72, '{"substation":"Sunol","feeder":"DR-101"}'),
  ('PGE-002', 'Sonoma Hills 12kV',     12.0, 'PG&E',   'CA-NC01', 'Sonoma',         'CA', 3, 22.3,  2900,  38, '{"substation":"Glen Ellen","feeder":"SH-201"}'),
  ('PGE-003', 'Paradise Feeder 21kV',  21.0, 'PG&E',   'CA-NC02', 'Butte',          'CA', 3, 19.8,  2100,  65, '{"substation":"Paradise","feeder":"PF-301"}'),
  ('PGE-004', 'Napa Valley 60kV',      60.0, 'PG&E',   'CA-NC01', 'Napa',           'CA', 2, 35.2,  7200,  95, '{"substation":"Calistoga","feeder":"NV-401"}'),
  ('PGE-005', 'Placerville 12kV',      12.0, 'PG&E',   'CA-NC02', 'El Dorado',      'CA', 3, 16.5,  1500,  18, '{"substation":"Placerville","feeder":"PL-501"}'),
  ('PGE-006', 'Santa Rosa 115kV',     115.0, 'PG&E',   'CA-NC01', 'Sonoma',         'CA', 2, 44.1, 11200, 145, '{"substation":"Santa Rosa","feeder":"SR-601"}'),
  ('PGE-007', 'Redding North 60kV',    60.0, 'PG&E',   'CA-NC03', 'Shasta',         'CA', 2, 38.7,  4800,  60, '{"substation":"Redding","feeder":"RN-701"}'),
  ('PGE-008', 'Grass Valley 12kV',     12.0, 'PG&E',   'CA-NC02', 'Nevada',         'CA', 3, 14.2,  2200,  30, '{"substation":"Grass Valley","feeder":"GV-801"}'),
  ('SDGE-001','Ramona 69kV',           69.0, 'SDG&E',  'CA-SD01', 'San Diego',      'CA', 3, 26.4,  3800,  42, '{"substation":"Ramona","feeder":"RM-101"}'),
  ('SDGE-002','Alpine 12kV',           12.0, 'SDG&E',  'CA-SD01', 'San Diego',      'CA', 3, 20.1,  2600,  35, '{"substation":"Alpine","feeder":"AL-201"}'),
  ('SDGE-003','Fallbrook 69kV',        69.0, 'SDG&E',  'CA-SD01', 'San Diego',      'CA', 2, 31.8,  5100,  68, '{"substation":"Fallbrook","feeder":"FB-301"}'),
  ('SDGE-004','Julian 12kV',           12.0, 'SDG&E',  'CA-SD01', 'San Diego',      'CA', 3, 12.9,   950,  15, '{"substation":"Julian","feeder":"JL-401"}'),
  ('PGE-009', 'Ukiah 60kV',            60.0, 'PG&E',   'CA-NC03', 'Mendocino',      'CA', 2, 29.5,  3600,  48, '{"substation":"Ukiah","feeder":"UK-901"}'),
  ('PGE-010', 'Mariposa 12kV',         12.0, 'PG&E',   'CA-NC02', 'Mariposa',       'CA', 3, 17.3,  1200,  20, '{"substation":"Mariposa","feeder":"MP-1001"}'),
  ('SCE-006', 'Ventura Hills 66kV',    66.0, 'SCE',    'CA-SC01', 'Ventura',        'CA', 2, 27.6,  6800,  90, '{"substation":"Ventura","feeder":"VH-601"}')
ON CONFLICT (circuit_id) DO UPDATE SET
  circuit_name     = EXCLUDED.circuit_name,
  voltage_kv       = EXCLUDED.voltage_kv,
  utility_name     = EXCLUDED.utility_name,
  psa_id           = EXCLUDED.psa_id,
  county           = EXCLUDED.county,
  state            = EXCLUDED.state,
  hftd_tier        = EXCLUDED.hftd_tier,
  length_miles     = EXCLUDED.length_miles,
  customer_count   = EXCLUDED.customer_count,
  critical_customers = EXCLUDED.critical_customers,
  metadata         = EXCLUDED.metadata;

-- Verify
SELECT circuit_id, circuit_name, utility_name, hftd_tier, customer_count FROM utility_circuits ORDER BY circuit_id;
