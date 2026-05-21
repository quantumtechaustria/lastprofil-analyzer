# Weiterentwicklung mit Cursor & Claude Code

Diese Anleitung bringt dich vom bolt.new-Export zu einem vollständigen lokalen
Entwicklungs-Setup mit **Cursor**, **Claude Code**, **GitHub** und deiner
bestehenden **Supabase**-Datenbank. Die Befehle sind für **Windows** (PowerShell,
das Standard-Terminal in Cursor) geschrieben.

> Du musst die Schritte einmalig der Reihe nach durchgehen. Danach reicht im Alltag
> der „Entwicklungs-Loop" am Ende dieser Datei.

---

## Schritt 1 – Werkzeuge installieren

Installiere einmalig diese Programme:

1. **Node.js** (Version 18 oder neuer, LTS empfohlen) – <https://nodejs.org>
   Prüfen im Terminal: `node -v`
2. **Git** – <https://git-scm.com/download/win>
   Prüfen: `git --version`
3. **Cursor** (Editor) – <https://cursor.com>
4. **Claude Code** – am einfachsten über den Windows-Installer auf
   <https://code.claude.com>. Alternativ über npm:
   `npm install -g @anthropic-ai/claude-code`
   Du brauchst ein Claude-Konto (Pro, Team oder Console).
5. **GitHub-Konto** – <https://github.com> (kostenlos). Optional die GitHub-CLI
   `gh` für bequemeres Anlegen von Repos.
6. **Supabase-CLI** (optional, für Migrationen/Edge Functions) –
   `npm install -g supabase`

---

## Schritt 2 – Projekt in Cursor öffnen und zum Laufen bringen

1. Cursor öffnen → **File → Open Folder** → den Ordner `project` auswählen.
2. Terminal in Cursor öffnen: Menü **Terminal → New Terminal** (oder `Strg + ö`).
3. Die halb-fertige `node_modules` aus dem Import entfernen und sauber neu
   installieren:

   ```powershell
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

4. Zugangsdaten anlegen – `.env.example` kopieren und die echten Supabase-Werte
   eintragen (URL und Anon-Key findest du im Supabase-Dashboard unter
   **Project Settings → API**):

   ```powershell
   Copy-Item .env.example .env
   ```

   Danach `.env` in Cursor öffnen und die beiden Werte ausfüllen.

5. Entwicklungsserver starten:

   ```powershell
   npm run dev
   ```

   Cursor zeigt dir eine lokale Adresse (z. B. `http://localhost:5173`).
   Im Browser öffnen – die App sollte laufen. Mit `Strg + C` im Terminal stoppst
   du den Server wieder.

6. Einmal den Produktions-Build testen (sollte fehlerfrei durchlaufen):

   ```powershell
   npm run build
   ```

---

## Schritt 3 – Auf GitHub bringen

Im Projektordner im Terminal:

```powershell
git init
git add .
git commit -m "Initialer Import aus bolt.new"
```

Deine `.gitignore` sorgt dafür, dass `.env`, `node_modules` und `dist` **nicht**
hochgeladen werden – deine Zugangsdaten bleiben also lokal.

Repository auf GitHub anlegen (per Website oder mit der CLI) und verbinden:

```powershell
# Variante GitHub-CLI:
gh repo create lastprofil-analyzer --private --source=. --push

# Variante manuell (Repo vorher auf github.com angelegt):
git remote add origin https://github.com/DEIN-NAME/lastprofil-analyzer.git
git branch -M main
git push -u origin main
```

---

## Schritt 4 – Claude Code einrichten

1. Im Projektordner im Terminal starten:

   ```powershell
   claude
   ```

   Beim ersten Start öffnet sich der Browser zum Anmelden. Danach bist du
   dauerhaft eingeloggt.

2. Einmalig das Projektgedächtnis erzeugen:

   ```text
   /init
   ```

   Claude Code analysiert dein Projekt und legt eine `CLAUDE.md` an – eine Art
   Steckbrief (Tech-Stack, Build-Befehle, Konventionen), den Claude bei jedem
   Start automatisch liest. Du musst dann nicht jedes Mal alles neu erklären.
   Die Datei kannst du jederzeit von Hand ergänzen.

---

## Schritt 5 – So arbeitest du mit Cursor + Claude Code

Beide greifen auf denselben Projektordner zu und ergänzen sich. Du kannst die
**Claude-Code-Erweiterung direkt in Cursor** installieren (`Strg + Shift + X`,
nach „Claude Code" suchen) – dann hast du Claude Code im Editor und im Terminal.

Grundprinzip: Du beschreibst in normalem Deutsch, **was** du geändert haben
willst. Claude schlägt Änderungen vor und zeigt sie als **Diff** (Vorher/Nachher)
an – du bestätigst, bevor etwas gespeichert wird.

Wichtige Befehle in Claude Code:

- `/init` – Projektgedächtnis (`CLAUDE.md`) erzeugen, einmalig pro Projekt
- `/clear` – neue Unterhaltung beginnen (Projektgedächtnis bleibt erhalten);
  sinnvoll, wenn du das Thema wechselst
- `/review` – Änderungen / einen Pull Request prüfen lassen
- **Plan-Modus** – für größere Umbauten lässt Claude sich erst einen Plan
  bestätigen, bevor er loslegt. Für kleine Korrekturen nicht nötig.

Faustregeln für gute Ergebnisse:

- **Kleine, klare Aufgaben** funktionieren am besten: „Behebe den Fehler in
  `FileUpload.tsx`" ist besser als „bau die ganze App um".
- **Diffs immer kurz prüfen**, bevor du bestätigst.
- Claude darf Befehle wie `npm run build` selbst ausführen, um seine Änderungen
  zu testen – frag ihn ruhig danach.
- **`CLAUDE.md` aktuell halten:** wichtige Entscheidungen, Konventionen oder
  Stolperfallen dort ergänzen.

---

## Schritt 6 – Supabase weiter pflegen

Deine Datenbank bleibt unverändert bestehen; du verbindest nur das neue Setup
damit. Mit der Supabase-CLI kannst du Datenbank-Änderungen und die Edge Function
versioniert ausspielen:

```powershell
supabase login
supabase link --project-ref DEIN-PROJEKT-REF   # Ref steht im Dashboard-URL

# Tabellen-/Policy-Migrationen aus supabase/migrations/ einspielen:
supabase db push

# Edge Function (Spotpreis-Proxy) deployen:
supabase functions deploy energy-charts-proxy
```

Neue Tabellen-Änderungen legst du als neue Datei in `supabase/migrations/` an
(am besten von Claude Code erzeugen lassen) und spielst sie mit `supabase db push`
ein – so bleibt deine Datenbank nachvollziehbar und im Git versioniert.

---

## Dein typischer Entwicklungs-Loop (Alltag)

Wenn das Setup einmal steht, sieht ein Arbeitstag so aus:

1. **Branch anlegen** für ein Feature/eine Korrektur:
   `git checkout -b feature/profile-speichern`
2. **Server starten:** `npm run dev`
3. **Mit Claude Code / Cursor entwickeln** – Aufgabe beschreiben, Diffs prüfen,
   im Browser testen.
4. **Build prüfen:** `npm run build`
5. **Speichern in Git:** `git add .` → `git commit -m "..."` → `git push`
6. Optional: Auf GitHub einen **Pull Request** öffnen, mit `/review` prüfen lassen
   und in `main` zusammenführen.

---

## Empfohlene erste Aufgabe für dieses Projekt

Aktuell speichert die App hochgeladene Lastprofile nur im Browser (`localStorage`),
nicht in deiner Supabase-Datenbank – die Tabellen `load_profiles` und
`load_profile_data` existieren bereits, werden vom Frontend aber noch nicht
genutzt. Ein guter erster echter Schritt ist, das umzustellen, damit Profile
dauerhaft und geräteübergreifend gespeichert werden.

Du kannst diese Aufgabe fast wörtlich an Claude Code geben, zum Beispiel:

> „In `src/App.tsx` werden Lastprofile in `localStorage` gespeichert
> (`loadAnalyzer_profiles`). Stelle das auf Supabase um: Beim Upload sollen
> Profile in die Tabelle `load_profiles` (und die Messwerte in
> `load_profile_data`) geschrieben werden, beim Start aus der Datenbank des
> angemeldeten Nutzers geladen werden. Nutze den vorhandenen Supabase-Client aus
> `src/lib/supabase.ts` und beachte die Row-Level-Security. Zeig mir zuerst einen
> Plan."

Weitere sinnvolle nächste Schritte:

- Die fest auf `AT` (Österreich) eingestellte Gebotszone in
  `supabase/functions/energy-charts-proxy/index.ts` konfigurierbar machen
  (z. B. Deutschland `DE-LU`).
- Die vielen `any`-Typen in `App.tsx` durch echte TypeScript-Typen aus
  `src/types/` ersetzen.
- Hosting einrichten (Vercel oder Netlify, direkt mit dem GitHub-Repo verbunden),
  damit die App eine öffentliche URL bekommt.
