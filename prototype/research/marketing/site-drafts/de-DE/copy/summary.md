# de-DE site drafts (website d8d7480)

Model anthropic/claude-sonnet-5-5. Total $1.9792.

| File | Kind | Review | Values | Fixes applied | Cost |
| --- | --- | --- | --- | --- | --- |
| `src/components/pricing.ts` | compare | pass | 2 | 0 | $0.0641 |
| `src/components/guides.ts` | other | pass | 5 | 0 | $0.0534 |
| `src/layouts/Guide.astro` | other | pass | 1 | 0 | $0.0260 |
| `src/components/footer.ts` | other | pass | 1 | 0 | $0.0633 |
| `src/components/Nav.astro` | other | pass | 1 | 0 | $0.0216 |
| `src/components/FeedbackModal.astro` | other | pass | 1 | 0 | $0.0335 |
| `src/components/bot-check.ts` | other | pass | 1 | 0 | $0.0219 |
| `src/components/AppWindow.astro` | other | pass | 1 | 0 | $0.0290 |
| `src/components/compare.ts` | compare | pass | 16 | 0 | $0.1151 |
| `src/pages/[...lang]/index.astro` | home | pass_with_notes | 1 | 0 | $0.2803 |
| `src/pages/[...lang]/pricing/index.astro` | pricing | pass | 1 | 0 | $0.0222 |
| `src/pages/[...lang]/cleanmymac-alternative/index.astro` | compare | pass_with_notes | 1 | 0 | $0.1363 |
| `src/pages/[...lang]/clear-mac-developer-caches/index.astro` | guide | pass_with_notes | 1 | 0 | $0.2246 |
| `src/pages/[...lang]/clear-adobe-media-cache-mac/index.astro` | guide | pass | 1 | 0 | $0.1156 |
| `src/pages/[...lang]/clear-system-data-mac/index.astro` | guide | pass_with_notes | 1 | 0 | $0.2358 |
| `src/pages/[...lang]/uninstall-apps-mac/index.astro` | guide | pass_with_notes | 1 | 0 | $0.1962 |
| `src/pages/[...lang]/uninstall-audio-plugins-mac/index.astro` | guide | pass | 1 | 0 | $0.3403 |

## Findings

### src/pages/[...lang]/index.astro
Claims review of de-DE-src-pages-lang-index-astro: Passes, with notes.
- [ahead_of_app] ahead_of_app: “History listet jede Bereinigung auf und legt Ihre Dateien an ihren ursprünglichen Ort zurück.” — Der Verlauf zeigt nur, was jede Bereinigung freigegeben hat. Eine Wiederherstellungsfunktion über History gibt es nicht. Put back funktioniert nur für deinstallierte Apps und Plug-ins im Papierkorb.
- [ahead_of_app] ahead_of_app: “Ihre Dateien landen im Papierkorb, und History legt sie zurück.” — History kann keine Dateien zurücklegen. Es ist nur ein Verlauf der freigegebenen Bereinigungen.
Facts 2026-11-10 / 1.0.4; anthropic/claude-sonnet-5-5; $0.0269.

### src/pages/[...lang]/cleanmymac-alternative/index.astro
Claims review of de-DE-src-pages-lang-cleanmymac-alternative-index-astro: Passes, with notes.
- [ahead_of_app] ahead_of_app: “Ihre eigenen Dateien kommen in den Papierkorb, und mit History legen Sie sie zurück.” — History only lists what each cleanup freed. Restoring files from it is not a shipped feature. Restoring uses the Trash's Put back.
- [ahead_of_app] ahead_of_app: “die Caches, alten Projektdateien, Reste und großen Downloads, die Ihren Mac füllen” — The shipped feature list has no detection of old project files or large downloads. The scan covers categories, caches, build files and leftovers from deleted apps.
Facts 2026-11-10 / 1.0.4; anthropic/claude-sonnet-5-5; $0.02194.

### src/pages/[...lang]/clear-mac-developer-caches/index.astro
Claims review of de-DE-src-pages-lang-clear-mac-developer-caches-index-astro: Passes, with notes.
- [ahead_of_app] ahead_of_app: “Projekte, die Sie in dieser Woche geändert haben, überspringt es.” — Skipping recently modified projects is not in the shipped feature list. The app lists node_modules folders for the user to review, and nothing says it skips recent projects.
Facts 2026-11-10 / 1.0.4; anthropic/claude-sonnet-5-5; $0.01635.

### src/pages/[...lang]/clear-system-data-mac/index.astro
Claims review of de-DE-src-pages-lang-clear-system-data-mac-index-astro: Passes, with notes.
- [ahead_of_app] ahead_of_app: “Bei Downloaded iCloud files behält Remove local copies die Originale in iCloud.” — The shipped feature list has no iCloud category and no "Remove local copies" action. The draft presents this as a concrete cleanup capability, so it is ahead of the app.
Facts 2026-11-10 / 1.0.4; anthropic/claude-sonnet-5-5; $0.02758.

### src/pages/[...lang]/uninstall-apps-mac/index.astro
Claims review of de-DE-src-pages-lang-uninstall-apps-mac-index-astro: Passes, with notes.
- [ahead_of_app] ahead_of_app: “Empty from Trash in CacheDrop löscht nur, was CacheDrop dorthin verschoben hat, und lässt Ihre eigenen Dateien im Papierkorb unberührt.” — Die ausgelieferte Funktion leert den Papierkorb aus CacheDrop und listet vorher alles auf. Dass nur von CacheDrop verschobene Objekte gelöscht werden und eigene Dateien unberührt bleiben, steht nicht in der Funktionsliste.
Facts 2026-11-10 / 1.0.4; anthropic/claude-sonnet-5-5; $0.0239.

## Verify on a German Mac

- Papierkorb
- Systemdaten (macOS-Name für System Data)
- Terminal
- Medien-Cache (Name in Premiere Pro)
- lokale Time-Machine-Snapshots
- Systemdaten (macOS-Bezeichnung im Footer-Link „Systemdaten löschen“)
- macOS 14 Sonoma
- Storage overview
- Systemdaten (Name in den macOS-Speichereinstellungen)
- Put back (Zurücklegen) – Finder-Menüpunkt „Zurücklegen“ gegenüber dem App-Label „Put back“
- Medien-Cache (Bezeichnung in den Premiere-Pro-Einstellungen)
- Mediathek (Final Cut Pro)
- Systemeinstellungen › Allgemein › Speicher
- Systemdaten (in den Speichereinstellungen)
- Aktivitätsanzeige
- Ordner „Library“ (Finder zeigt den Ordnernamen auf Deutsch als „Library“)
- „Zugriffsrechte reparieren“ (früherer Name der Funktion im Festplattendienstprogramm)
- XProtect
- History (App-Label, bleibt Englisch)
- Smart clean (App-Label, bleibt Englisch)
- Xcode › Settings › Locations (Menüpfad in Xcode, englisch belassen)
- Derived Data (Bezeichnung in Xcode Settings › Locations)
- Systemdaten (macOS-Speichereinstellungen)
- Ordner „Library“ (deutscher Finder-Name)
- Ordner „Library“ (Finder-Name für ~/Library)
- Mediathek (Final Cut Pro, Library)
- Seitenleiste „Libraries“ in Final Cut Pro
- File › Delete Generated Library Files (Final Cut Pro)
- Delete Render Files, Unused Only, All (Final Cut Pro)
- Settings › Media Cache (Premiere Pro)
- Preferences › Media Cache (ältere Premiere-Versionen)
- „Delete“-Schaltfläche im Media-Cache-Bereich von Premiere Pro
- Medien-Cache (deutscher Begriff in Premiere Pro)
- Finder
- Speicherkategorien Programme, Dokumente, Fotos
- Finder-Menü: Gehe zu › Gehe zum Ordner …
- iCloud Drive Kontextmenü: „Download entfernen“
- iPhone-/iPad-Backups: „Backups verwalten …“ (Finder, Gerät ausgewählt)
- Finder-Menüpunkt „Zurücklegen“ (Papierkorb)
- Ordner „Library“ im deutschen Finder
- Control-Taste (Control-Klick)
- Mail und Nachrichten (Messages-App) sowie Fotos-Mediathek
- iCloud Drive
- Gehe zu › Gehe zum Ordner … (Finder-Menü)
- Ordner „Programme“
- Ordner „Library“ (Name im deutschen Finder; ~/Library ist ausgeblendet)
- Return-Taste (Beschriftung auf deutscher Mac-Tastatur)
- Terminal-Meldung „Operation not permitted“ (bleibt englisch)
- Ordner „Programme“ (Applications folder)
- Ordner „Library“ (~/Library im deutschen Finder)
- Put back (Zurücklegen) – Finder-Menüpunkt
- Home-Ordner (Benutzerordner)
