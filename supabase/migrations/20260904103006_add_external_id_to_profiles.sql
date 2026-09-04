-- Add external_id column to profiles to map with external HR systems like OfficeHub360
ALTER TABLE profiles
ADD COLUMN external_id TEXT;

-- Enforce multi-tenant uniqueness for external identifiers
ALTER TABLE profiles
ADD CONSTRAINT profiles_org_id_external_id_key UNIQUE (org_id, external_id);

-- Create an index to optimize employee resolution lookups
CREATE INDEX idx_profiles_org_external ON profiles(org_id, external_id);
