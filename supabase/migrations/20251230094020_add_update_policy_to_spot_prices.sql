/*
  # Add UPDATE policy to spot_prices table

  1. Security Changes
    - Add UPDATE policy for authenticated users to update their own spot prices
    - This is required for UPSERT operations to work correctly
  
  2. Notes
    - UPSERT requires both INSERT and UPDATE policies
    - Policy checks that user can only update their own data
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'spot_prices' 
    AND policyname = 'Users can update own spot prices'
  ) THEN
    CREATE POLICY "Users can update own spot prices"
      ON spot_prices
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
