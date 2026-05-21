/*
  # Create Load Profiles Table

  1. New Tables
    - `load_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text) - Profile name
      - `file_name` (text) - Original file name
      - `site_address` (text) - Optional site address
      - `meter_number` (text) - Optional meter number
      - `industry_sector` (text) - Optional industry sector
      - `profile_type` (text) - 'consumer', 'producer', or 'unknown'
      - `data_unit` (text) - 'kW' or 'kWh'
      - `data_start` (timestamptz) - Start of data period
      - `data_end` (timestamptz) - End of data period
      - `total_records` (integer) - Number of data points
      - `data_quality_score` (numeric) - Quality score 0-1
      - `customer_number` (text) - From CSV metadata
      - `customer_name` (text) - From CSV metadata
      - `metering_point` (text) - ZP-Nummer from CSV metadata
      - `period_start` (date) - Start from CSV metadata
      - `period_end` (date) - End from CSV metadata
      - `energy_direction` (text) - Verbrauch/Einspeisung from CSV
      - `metadata` (jsonb) - Additional metadata from CSV
      - `created_at` (timestamptz)
      - `processed_at` (timestamptz)

    - `load_profile_data`
      - `id` (uuid, primary key)
      - `load_profile_id` (uuid, foreign key to load_profiles)
      - `timestamp` (timestamptz) - Data point timestamp
      - `power_kw` (numeric) - Power value in kW
      - `created_at` (timestamptz)
      - Composite unique constraint on (load_profile_id, timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    - Users can only access profiles and data belonging to them

  3. Indexes
    - Index on user_id for filtering
    - Index on (load_profile_id, timestamp) for fast queries
    - Index on customer_number, metering_point, energy_direction for search

  4. Notes
    - Metadata fields store information extracted from CSV headers
    - energy_direction automatically determines profile_type
    - All metadata columns are nullable for backward compatibility
*/

CREATE TABLE IF NOT EXISTS load_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_name text NOT NULL,
  site_address text,
  meter_number text,
  industry_sector text,
  profile_type text DEFAULT 'unknown',
  data_unit text DEFAULT 'kW',
  data_start timestamptz NOT NULL,
  data_end timestamptz NOT NULL,
  total_records integer DEFAULT 0,
  data_quality_score numeric(3, 2) DEFAULT 0,
  customer_number text,
  customer_name text,
  metering_point text,
  period_start date,
  period_end date,
  energy_direction text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS load_profile_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_profile_id uuid REFERENCES load_profiles(id) ON DELETE CASCADE NOT NULL,
  timestamp timestamptz NOT NULL,
  power_kw numeric(10, 4) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_profile_timestamp UNIQUE (load_profile_id, timestamp)
);

ALTER TABLE load_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_profile_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own load profiles"
  ON load_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own load profiles"
  ON load_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own load profiles"
  ON load_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own load profiles"
  ON load_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own load profile data"
  ON load_profile_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM load_profiles
      WHERE load_profiles.id = load_profile_data.load_profile_id
      AND load_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own load profile data"
  ON load_profile_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM load_profiles
      WHERE load_profiles.id = load_profile_data.load_profile_id
      AND load_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own load profile data"
  ON load_profile_data
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM load_profiles
      WHERE load_profiles.id = load_profile_data.load_profile_id
      AND load_profiles.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_load_profiles_user 
  ON load_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_load_profiles_customer_number 
  ON load_profiles(customer_number);

CREATE INDEX IF NOT EXISTS idx_load_profiles_metering_point 
  ON load_profiles(metering_point);

CREATE INDEX IF NOT EXISTS idx_load_profiles_energy_direction 
  ON load_profiles(energy_direction);

CREATE INDEX IF NOT EXISTS idx_load_profile_data_profile_timestamp 
  ON load_profile_data(load_profile_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_load_profile_data_profile 
  ON load_profile_data(load_profile_id);
