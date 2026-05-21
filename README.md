# Lastprofil-Analyzer

Web-Anwendung zur professionellen Analyse von Energie-Lastprofilen, EPEX-Spotpreisen
und Wirtschaftlichkeitsberechnungen. Nutzer laden Lastgang-Dateien (CSV/Excel) hoch,
die App berechnet Kennzahlen, visualisiert die Profile und vergleicht sie mit
historischen Spotpreisen.

## Tech-Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Lucide-Icons
- **Charts:** Recharts
- **Datei-Parsing:** PapaParse (CSV), SheetJS/xlsx (Excel), eigener EPEX-Parser
- **PDF-Export:** jsPDF + html2canvas
- **Backend / Daten:** Supabase (Postgres, Auth, Edge Functions)
- **Performance:** Web Worker für die Aggregation großer Datenmengen

## Lokales Setup

Voraussetzung: Node.js (Version 18 oder neuer) und npm.

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen anlegen
#    .env.example nach .env kopieren und die eigenen Supabase-Werte eintragen
cp .env.example .env

# 3. Entwicklungsserver starten
npm run dev

# Weitere Befehle
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal vorschauen
npm run lint      # ESLint
```

## Umgebungsvariablen

| Variable                 | Beschreibung                                  |
| ------------------------ | --------------------------------------------- |
| `VITE_SUPABASE_URL`      | URL des Supabase-Projekts                     |
| `VITE_SUPABASE_ANON_KEY` | Öffentlicher Anon-Key (kein Service-Role-Key) |

Werte stehen im Supabase-Dashboard unter **Project Settings → API**.

## Projektstruktur

```
project/
├── src/
│   ├── components/      # React-Komponenten (Dashboard, Upload, Charts, ...)
│   ├── lib/             # Geschäftslogik: Parser, KPI-Berechnung, Supabase-Client
│   ├── workers/         # Web Worker für Daten-Aggregation
│   ├── types/           # TypeScript-Typen
│   └── App.tsx          # Einstiegspunkt der App
├── supabase/
│   ├── migrations/      # SQL-Migrationen (Tabellen, RLS-Policies)
│   └── functions/       # Edge Functions (energy-charts-proxy)
└── ...                  # Vite-, Tailwind-, TS-Konfiguration
```

## Datenbank (Supabase)

Tabellen (alle mit Row-Level-Security):

- `load_profiles` + `load_profile_data` – hochgeladene Lastprofile und Messwerte
- `spot_prices` – nutzerindividuelle EPEX-Spotpreise
- `historical_spot_prices` – öffentlich lesbare, zentrale Spotpreis-Historie

Edge Function:

- `energy-charts-proxy` – Proxy zur Energy-Charts-API (umgeht CORS, lädt Spotpreise)

Migrationen liegen in `supabase/migrations/` und werden mit der Supabase-CLI
ausgespielt (`supabase db push`).
