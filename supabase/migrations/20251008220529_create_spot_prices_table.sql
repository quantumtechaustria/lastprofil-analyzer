/*
  # EPEX Spot Prices Table
  
  1. New Tables
    - `spot_prices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `timestamp` (timestamptz) - Hour timestamp in UTC
      - `price_eur_mwh` (decimal) - Original price in EUR/MWh
      - `price_ct_kwh` (decimal) - Converted price in ct/kWh
      - `created_at` (timestamptz)
      - Composite unique constraint on (user_id, timestamp)
  
  2. Security
    - Enable RLS on `spot_prices` table
    - Add policy for authenticated users to read their own spot prices
    - Add policy for authenticated users to insert their own spot prices
    - Add policy for authenticated users to delete their own spot prices
  
  3. Indexes
    - Index on (user_id, timestamp) for fast queries
    - Index on user_id for filtering
  
  4. Notes
    - Prices are stored hourly (EPEX format)
    - Each user has their own set of spot prices
    - Timestamp uniqueness per user prevents duplicates
*/

CREATE TABLE IF NOT EXISTS spot_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp timestamptz NOT NULL,
  price_eur_mwh decimal(10, 2) NOT NULL,
  price_ct_kwh decimal(10, 4) NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_timestamp UNIQUE (user_id, timestamp)
);

ALTER TABLE spot_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spot prices"
  ON spot_prices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spot prices"
  ON spot_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own spot prices"
  ON spot_prices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_spot_prices_user_timestamp 
  ON spot_prices(user_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_spot_prices_user 
  ON spot_prices(user_id);
