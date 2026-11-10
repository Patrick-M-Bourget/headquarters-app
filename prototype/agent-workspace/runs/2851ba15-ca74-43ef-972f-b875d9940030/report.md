# Research run 2851ba15 — CacheDrop competitors

Observations: 120 (verified 54, unknown 66). `?` = not stated on the fetched page (unknown, not "no"). A null annual price for DaisyDisk and Mole is verified n/a (one-time only, "No subscription").

| Competitor | Model | One-time $ | Annual $ | Distribution | Cleanup | Uninstall | Disk map | Duplicates |
|---|---|---|---|---|---|---|---|---|
| [CleanMyMac](https://macpaw.com/cleanmymac) | ? | ? | ? | direct | yes | yes | ? | yes |
| [DaisyDisk](https://daisydiskapp.com/) | one_time | 9.99 | n/a | both | ? | ? | yes | ? |
| [MacCleaner Pro](https://nektony.com/mac-cleaner-pro) | both | 85.95 | 39.95 | direct | yes | yes | ? | yes |
| [GrandPerspective](https://grandperspectiv.sourceforge.net/) | free | 2.99 (App Store) | ? | open_source | ? | ? | yes | ? |
| [OmniDiskSweeper](https://www.omnigroup.com/more) | ? | ? | ? | ? | ? | ? | ? | ? |
| [AppCleaner](https://freemacsoft.net/appcleaner/) | ? | ? | ? | direct | ? | yes | ? | ? |
| [Pearcleaner](https://github.com/alienator88/Pearcleaner) | free | 0 | ? | open_source | ? | yes | ? | ? |
| [Mole](https://mole.fit/) | one_time | 19 | n/a | direct | yes | yes | yes | ? |
| [Hyperspace](https://hypercritical.co/hyperspace/) | both | ? | ? | mac_app_store | ? | ? | ? | yes |
| [Sensei](https://cindori.com/sensei) | ? | ? | 29 | direct | yes | yes | ? | ? |

## Recommendations (all hypotheses)
- **Lead with 'one-time purchase, no subscription'**: MacCleaner Pro is $85.95 one-time vs $39.95/yr; DaisyDisk and Mole stress one-time pricing.
- **Price in a low-to-mid one-time band**: verified one-time prices are $9.99, $19 and $85.95.
- **Combine cleanup, uninstaller and disk map in one native app**: only Mole was verified covering all three.
- **Offer a free scan-first trial like Hyperspace**: Hyperspace scans free; MacCleaner Pro gives a 2-day trial.
- **Investigate developer-cache cleanup as a differentiator**: unknown for every competitor; needs a follow-up run.

## Caveats
- `https://macpaw.com/store/cleanmymac` returned HTTP 403, so CleanMyMac pricing is unknown.
- Page content came via a fetch tool that summarizes pages; evidence quotes come from those summaries.
- Features absent from a page are recorded unknown, not "no". Developer cleanup and plugin management were not mentioned on any page.
- 55% of observations are unknown, mostly because the pages do not state the value, not because of fetch failures (one 403), so status is `succeeded` rather than `partial`.
