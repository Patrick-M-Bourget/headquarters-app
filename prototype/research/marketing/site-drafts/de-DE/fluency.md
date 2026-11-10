# de-DE blind fluency check

Judge gemini-3.8-flash (another vendor than the writer). 200 of 588 sentences sampled.

- Passed: 200/200 (100%) (gate 90%)
- Canaries caught: 6/6 (need 5)
- Gate: **pass**
- Glossary lines flagged: 5/78
- Cost: $0.0858

## Flagged sentences

None.

## Canaries

- [fluency] [terms] Es ist empfohlen, dass Sie den Cache leeren machen.
  Unnatural phrasing and incorrect grammar ('den Cache leeren machen').
  → Es wird empfohlen, den Cache zu leeren.
- [fluency] [terms] Ziehen Sie die App in den Mülleimer, um sie zu entfernen.
  Uses Windows/generic 'Mülleimer' instead of official macOS 'Papierkorb'.
  → Ziehen Sie die App in den Papierkorb, um sie zu entfernen.
- [fluency] [terms] Öffnen Sie Systempräferenzen › Allgemein › Speicher, um die Belegung zu sehen.
  'Systempräferenzen' is an English calque; the official macOS term is 'Systemeinstellungen'.
  → Öffnen Sie Systemeinstellungen › Allgemein › Speicher, um die Belegung zu sehen.
- [fluency] [terms] Dieses Werkzeug hilft Ihnen, um Raum auf Ihrem Mac zu befreien.
  'Raum ... zu befreien' is a literal English calque; the standard macOS term is 'Speicherplatz freigeben'.
  → Dieses Werkzeug hilft Ihnen, Speicherplatz auf Ihrem Mac freizugeben.
- [fluency] Die Caches werden wiederaufgebaut von dem Werkzeug in der nächsten Zeit.
  Clumsy and unnatural passive word order ('wiederaufgebaut von dem Werkzeug in der nächsten Zeit').
  → Die Caches werden in nächster Zeit vom Tool automatisch wieder aufgebaut.
- [fluency] [terms] Klicke auf den Knopf, um CacheDrop zu herunterladen.
  Uses informal 'Klicke' ('du' error), calque 'Knopf' instead of 'Schaltfläche/Button', and grammatical error 'zu herunterladen'.
  → Klicken Sie auf den Button, um CacheDrop herunterzuladen.

## Flagged glossary lines

- [fluency] [terms] storage cleaner, Mac cleaner → Mac-Reiniger; Speicher-Cleaner
  'Speicher-Cleaner' is an awkward Denglish hybrid; Mac users and marketers use Mac-Cleaner or Bereinigungsprogramm.
  → Mac-Cleaner; Mac-Bereinigungsprogramm
- [terms] Time Machine local snapshot → lokaler Time-Machine-Snapshot
  Apple's official German macOS terminology uses 'Schnappschuss' rather than 'Snapshot'.
  → lokaler Time-Machine-Schnappschuss
- [fluency] [terms] break (a project) → kaputtmachen
  'kaputtmachen' is overly colloquial for software website copy; 'beschädigen' is professional and idiomatic.
  → beschädigen
- [fluency] [terms] Limited-time price (pill) → Zeitlich begrenzter Preis
  'Zeitlich begrenzter Preis' is a wooden calque; 'Aktionspreis' is the standard German e-commerce term.
  → Aktionspreis
- [fluency] Was $29.99, now $19.99 for a limited time (spoken) → Regulär 29,99 $, jetzt 19,99 $ für begrenzte Zeit
  'für begrenzte Zeit' is an English calque; 'nur für kurze Zeit' is natural German.
  → Regulär 29,99 $, jetzt 19,99 $ (nur für kurze Zeit)
