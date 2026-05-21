/*
  # Zentrale historische Spotpreise-Tabelle

  1. Neue Tabelle
    - `historical_spot_prices`
      - `timestamp` (timestamptz, primary key) - Zeitstempel
      - `price_eur_mwh` (decimal) - Preis in EUR/MWh
      - `price_ct_kwh` (decimal) - Preis in ct/kWh
      - `created_at` (timestamptz) - Erstellungszeitpunkt
  
  2. Sicherheit
    - Tabelle ist öffentlich lesbar (RLS)
    - Nur Service-Role kann schreiben
    - Alle authentifizierten und anonymen Nutzer können lesen
  
  3. Performance
    - Index auf timestamp für schnelle Abfragen
*/

CREATE TABLE IF NOT EXISTS historical_spot_prices (
  timestamp timestamptz PRIMARY KEY,
  price_eur_mwh decimal(10, 2) NOT NULL,
  price_ct_kwh decimal(10, 4) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE historical_spot_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read historical spot prices"
  ON historical_spot_prices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_historical_spot_prices_timestamp 
  ON historical_spot_prices(timestamp DESC);