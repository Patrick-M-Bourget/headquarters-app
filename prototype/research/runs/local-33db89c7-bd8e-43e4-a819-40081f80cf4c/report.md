# Research run local-33db89c7-bd8e-43e4-a819-40081f80cf4c (Mastra, claude-haiku-5-5)

Status: succeeded. Observations: 120 (verified 52, unknown 68). Every verified value's evidence was checked in code against the fetched page text. Cost $0.0205, 38s.

| Competitor | pricing_model | price_one_time_usd | price_annual_usd | distribution | feature_cleanup | feature_uninstall | feature_disk_map | feature_duplicates |
|---|---|---|---|---|---|---|---|---|
| [CleanMyMac](https://macpaw.com/cleanmymac) | subscription | ? | ? | ? | yes | yes | ? | yes |
| [DaisyDisk](https://daisydiskapp.com/) | one_time | 9.99 | ? | both | yes | ? | ? | no |
| [MacCleaner Pro](https://nektony.com/mac-cleaner-pro) | both | 85.95 | 39.95 | direct | yes | yes | yes | yes |
| [GrandPerspective](https://grandperspectiv.sourceforge.net/) | free | 2.99 (App Store) | ? | open_source_and_app_store | yes | ? | yes | ? |
| [OmniDiskSweeper](https://www.omnigroup.com/more) | ? | ? | ? | ? | ? | ? | ? | ? |
| [AppCleaner](https://freemacsoft.net/appcleaner/) | ? | ? | ? | ? | ? | yes | ? | ? |
| [Pearcleaner](https://github.com/alienator88/Pearcleaner) | free | ? | ? | ? | ? | ? | ? | ? |
| [Mole](https://mole.fit/) | one_time | 19 | ? | direct | yes | yes | yes | ? |
| [Hyperspace](https://hypercritical.co/hyperspace/) | both | ? | ? | mac_app_store | ? | ? | ? | yes |
| [Sensei](https://cindori.com/sensei) | both | 59 | 29 | ? | yes | yes | ? | ? |

## Recommendations (hypotheses)
- **Lead with a one-time purchase against subscription-based leaders**: CleanMyMac is the only verified competitor listing a subscription pricing model, while several rivals sell one-time licenses (DaisyDisk at $9.99, Mole at $19, Sensei at $59 one-time or $29 annual as an option). CacheDrop's one-time model can be positioned as the alternative to recurring fees, without claiming anything about competitors' total cost of ownership beyond the verified pricing model.
- **Target producers and developers with plug-in management and developer cleanup**: Among verified observations, plug-in management is listed only for MacCleaner Pro, and developer-specific cleanup is not verified for any competitor. CacheDrop's stated focus on music producers, developers and video editors can be differentiated by building plug-in management and developer cleanup as core features, citing the single verified competitor that offers plug-in management as the benchmark. Absence of other competitors' plug-in management is not treated as proof of a gap.
- **Price a one-time license against MacCleaner Pro's bundle**: MacCleaner Pro offers a bundle of six tools at $85.95 one-time or $39.95 annual, with a 2-day free trial that includes full Pro access and no credit card required. CacheDrop can compete on a lower-priced, focused one-time offer and consider a trial structure that matches or exceeds the verified trial terms, while avoiding unverified claims about the competitor's feature depth.
- **Bundle disk-usage mapping and duplicate finding into a single cleanup workflow**: Disk map and duplicate detection are verified for MacCleaner Pro and Mole (disk map) and GrandPerspective (disk map), while DaisyDisk is verified as lacking duplicate detection. Hyperspace is verified for duplicates but notably positions around reclaiming space without removing files. CacheDrop can combine disk mapping with duplicate handling in one flow, using the verified competitors that offer each feature as reference points.
- **Differentiate positioning from generic 'clean and fast' headlines**: Several verified headlines use generic performance language, such as CleanMyMac's 'Smart & effortless Mac care', Mole's 'Keep your Mac clean and light', and MacCleaner Pro's 'Keep your Mac always fast, clean and organized'. CacheDrop can instead anchor its message on the specific needs of producers, developers and video editors, which is consistent with its stated audience.

## Errors and notes
- fetch failed (HTTP 403): https://macpaw.com/store
- fetch failed (HTTP 403): https://macpaw.com/store/cleanmymac
- possible prompt injection (cleanmymac): Page contains a Ukraine donation appeal and a Cloudflare challenge script; neither gives instructions to the extractor. No injected instructions found.
- possible prompt injection (daisydisk): No instruction-like text aimed at the extractor was found in the page data; review and marketing text was treated as data only.
- possible prompt injection (daisydisk): feature_disk_map left unknown: the ring visualization appears only in quoted third-party media reviews, not in the vendor's own page text.
- possible prompt injection (maccleaner-pro): The page source includes developer code comments addressed to web developers about regex and backslashes; this is not directed at the extractor and was ignored.
- possible prompt injection (maccleaner-pro): The buy page's monthly price (14.95/mo) and annual plan prices were not used beyond the one-time and annual values requested; the one-time and annual values come from the buy page plan listings.
- possible prompt injection (maccleaner-pro): No text on the pages instructed the extractor to take any action.
- possible prompt injection (pearcleaner): The Pearcleaner README text says the project is on hold and warns that only itsalin.com is an official website; this is informational and not an instruction to me. The GitHub pricing and features pages are GitHub's own marketing pages and contain nothing about Pearcleaner's pricing or features, so they were not used.
- possible prompt injection (mole): Testimonial text on the page includes shell commands (brew install, mo clean) and calls to action; treated as quoted user content, not instructions, and not acted on.
- possible prompt injection (mole): free_trial: the page mentions a 14-day refund, which is not a free trial, so it was left unknown.
- possible prompt injection (mole): The page title 'Mole · Keep your Mac clean and light' was used as the positioning headline; no separate hero headline was found in the body text.
