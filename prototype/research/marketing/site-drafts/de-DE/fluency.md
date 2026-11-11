# de-DE blind fluency check

Judge gemini-3.8-flash (another vendor than the writer). 200 of 590 sentences sampled.

- Passed: 200/200 (100%) (gate 90%)
- Canaries caught: 6/6 (need 5)
- Gate: **pass**
- Glossary lines flagged: 7/78
- Cost: $0.0946

## Flagged sentences

None.

## Canaries

- [fluency] Es ist empfohlen, dass Sie den Cache leeren machen.
  Ungrammatical phrasing ('leeren machen' is a crude translationese error).
  → Es wird empfohlen, den Cache zu leeren.
- [terms] Ziehen Sie die App in den Mülleimer, um sie zu entfernen.
  macOS uses 'Papierkorb', not 'Mülleimer'.
  → Ziehen Sie die App in den Papierkorb, um sie zu entfernen.
- [terms] Öffnen Sie Systempräferenzen › Allgemein › Speicher, um die Belegung zu sehen.
  macOS German uses 'Systemeinstellungen', not 'Systempräferenzen'.
  → Öffnen Sie Systemeinstellungen › Allgemein › Speicher, um die Belegung zu sehen.
- [fluency] [terms] Dieses Werkzeug hilft Ihnen, um Raum auf Ihrem Mac zu befreien.
  'hilft Ihnen, um ... zu befreien' is ungrammatical; 'Raum befreien' is an unnatural calque for 'Speicherplatz freigeben'.
  → Dieses Tool hilft Ihnen dabei, Speicherplatz auf Ihrem Mac freizugeben.
- [fluency] Die Caches werden wiederaufgebaut von dem Werkzeug in der nächsten Zeit.
  Clumsy passive word order and unnatural German phrasing ('wiederaufgebaut von dem Werkzeug in der nächsten Zeit').
  → Das Tool baut die Caches in nächster Zeit wieder auf.
- [fluency] [terms] Klicke auf den Knopf, um CacheDrop zu herunterladen.
  'Klicke' is informal 'du' form (site requires 'Sie'); 'zu herunterladen' is ungrammatical (must be 'herunterzuladen').
  → Klicken Sie auf den Button, um CacheDrop herunterzuladen.

## Flagged glossary lines

- [fluency] [terms] storage cleaner, Mac cleaner → Mac-Reiniger; Speicher-Cleaner
  'Speicher-Cleaner' is an awkward Denglisch hybrid; German Mac users say 'Mac-Cleaner' or 'Systemreiniger'.
  → Mac-Cleaner; Systemreiniger
- [fluency] [terms] leftovers (app) → Reste
  'Reste' alone sounds colloquial; 'App-Reste' or 'Rückstände' is the standard software cleaner term.
  → App-Reste; Rückstände
- [terms] Time Machine local snapshot → lokaler Time-Machine-Snapshot
  Apple's official German macOS terminology uses 'Schnappschuss' rather than 'Snapshot'.
  → lokaler Time-Machine-Schnappschuss
- [fluency] [terms] break (a project) → kaputtmachen
  'kaputtmachen' is too colloquial for developer software copy; 'beschädigen' or 'unbrauchbar machen' is professional.
  → beschädigen; unbrauchbar machen
- [fluency] [terms] Try it before you buy · No card needed · macOS 14 or later → Vor dem Kauf testen · Keine Karte nötig · macOS 14 oder neuer · App auf Englisch
  'Keine Karte nötig' is an unidiomatic literal calque; German requires 'Keine Kreditkarte nötig' or 'erforderlich'.
  → Vor dem Kauf testen · Keine Kreditkarte nötig · macOS 14 oder neuer · App auf Englisch
- [fluency] Limited-time price (pill) → Zeitlich begrenzter Preis
  'Zeitlich begrenzter Preis' is clunky for a UI pill; 'Aktionspreis' is the concise German e-commerce standard.
  → Aktionspreis
- [fluency] [terms] Was $29.99, now $19.99 for a limited time (spoken) → Regulär 29,99 $, jetzt 19,99 $ für begrenzte Zeit
  'für begrenzte Zeit' is an unidiomatic literal anglicism; German uses 'nur für kurze Zeit' or 'zeitlich begrenzt'.
  → Regulär 29,99 $, jetzt 19,99 $ – nur für kurze Zeit
