# Research run 8ed1c833 — CacheDrop competitors (run 2, revision of run 2851ba15)

Observations: 120 (verified 70, unknown 50). Run 1 (`runs/2851ba15-ca74-43ef-972f-b875d9940030/`) is kept unchanged for comparison.

`?` = not stated on any page fetched (unknown, not "no"). `n/a` = verified that no such price exists (one-time only, "no subscription").

## What changed from run 1
- Fetched pricing/store pages and feature pages where they exist, not just homepages (see Sources).
- OmniDiskSweeper: the seed URL (omnigroup.com/more) is in fact OmniDiskSweeper's own page on Omni's site (it has the product section, description and download link); no separate product page was found. "Free" is confirmed on Omni's legacy store page.
- CleanMyMac: both MacPaw store pages return HTTP 403. Pricing comes from the official Mac App Store listing instead (US prices); trial, channels and purchase types come from MacPaw's support pages.
- Developer-cleanup recommendation: reworded. Evidence now exists for Mole only; for the others it is unknown, which is not evidence of absence.

## Comparison

| Competitor | Model | One-time $ | Annual $ | Trial | Distribution | Cleanup | Uninstall | Disk map | Duplicates | Dev cleanup | Plugins/ext. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [CleanMyMac](https://macpaw.com/cleanmymac) | both | 89.99 (App Store) | 39.99 (App Store) | 7-day | both | yes | yes | ? | yes | ? | ? |
| [DaisyDisk](https://daisydiskapp.com/) | one_time | 9.99 | n/a | Try Free | both | yes | ? | yes | ? | ? | ? |
| [MacCleaner Pro](https://nektony.com/mac-cleaner-pro) | both | 85.95 | 39.95 | 2-day | direct | yes | yes | ? | yes | ? | yes |
| [GrandPerspective](https://grandperspectiv.sourceforge.net/) | free | 2.99 (App Store) | ? | ? | open_source | ? | ? | yes | ? | ? | ? |
| [OmniDiskSweeper](https://www.omnigroup.com/more) | free | 0 | ? | ? | direct | yes | ? | ? | ? | ? | ? |
| [AppCleaner](https://freemacsoft.net/appcleaner/) | ? | ? | ? | ? | direct | ? | yes | ? | ? | ? | ? |
| [Pearcleaner](https://github.com/alienator88/Pearcleaner) | free | 0 | ? | ? | open_source | ? | yes | ? | ? | ? | yes |
| [Mole](https://mole.fit/) | one_time | 19 | n/a | free scan + 2 uses/tool | direct | yes | yes | yes | ? | yes | ? |
| [Hyperspace](https://hypercritical.co/hyperspace/) | both | 49.99 (App Store) | 19.99 (App Store) | free scan | mac_app_store | ? | ? | ? | yes | ? | ? |
| [Sensei](https://cindori.com/sensei) | both | 59 | 29 | ? | direct | yes | yes | ? | ? | ? | ? |

## Recommendations (all hypotheses)
- **Lead with 'one-time purchase, no subscription'**: DaisyDisk and Mole already do at the low end; suite vendors pair one-time with subscriptions.
- **Price in the gap between $19 and ~$60-90 one-time**: low tier ($9.99, $19) and suite tier ($50-$90) are both populated.
- **Combine cleanup, uninstaller and disk map in one native app**: only Mole was verified covering all three.
- **Offer a free scan-first trial**: Hyperspace and Mole let users scan free; MacCleaner Pro gives 2 days.
- **Treat developer-tool cleanup as a feature to test, not yet a proven gap**: verified for Mole only.

## Evidence convention
The fetch tool returns an answer produced by a small model reading the page, not raw page text. Every `evidence` string is the closest text that tool returned for the page. It is a close quote, not guaranteed byte-for-byte verbatim. Where I added context in parentheses, it is mine and marked as such. Search-result snippets were used only to find URLs; no observation relies on a snippet alone.

## Caveats
- Prices marked "(App Store)" are Mac App Store US prices, which can differ from the same vendor's direct-store prices. CleanMyMac's direct prices could not be read (HTTP 403 on macpaw.com/store). A search snippet showed different direct-store prices; it was not fetched, so it is not used.
- Hyperspace "annual" is the App Store's "Unlock for One Year" item; the page describes one-year unlocks as one-time purchases, so it may not be a recurring subscription.
- DaisyDisk's disk map is inferred from a media quote on its homepage ("neat, colorful rings"); the page text does not say "disk map". MacCleaner Pro describes a disk space analyzer, which I did not count as a disk map.
- AppCleaner's page has a Donate link but no price statement, so its pricing is unknown.
- Pearcleaner's page lists a "Development Environment Manager"; I did not count that as developer cleanup.
- Failed fetches: macpaw.com/store (403), and two guessed URLs that do not exist (macpaw.com/cleanmymac/pricing, daisydiskapp.com/features, both 404).
- 50 of 120 observations are unknown (42%), mostly because pages do not mention a feature or price, not because fetches failed, so run status is `succeeded`.
