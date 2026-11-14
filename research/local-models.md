# Local runtime and models for a 32 GB Mac mini (M6)

Research note for issue #3 (map: issue #1). Checked on 2026-11-14 against vendor docs, official repos, model cards and registry listings. Nothing here was run: the M6 has not arrived, so every memory figure is a file size and every speed is someone else's measurement.

## Short answer

- **Runtime: Ollama**, with **llama.cpp `llama-server`** as the fallback. Ollama is the only one of the four that combines the MLX engine (default on Apple silicon since v0.40.0), JSON-schema enforcement on that engine, OpenAI- and Anthropic-compatible endpoints, and built-in loading, unloading and keep-alive of several models.
- **One 27–31B model fits, two do not.** The strong candidates are 15–20 GB each at 4-bit. Two of them exceed 32 GB. One large model plus one 7–9 GB model is 25–27 GB of weights before any context cache: it fits on paper only, and must be measured.
- **Candidates by job** (sizes are Ollama download sizes at 4-bit):
  - Judging with a schema: `gpt-oss:20b` (14 GB), `gemma4:12b` (7.2–8.0 GB), `qwen3.5:9b` (6.6–8.9 GB), `qwen3.8:27b` (18 GB) when a small judge falls below its floor.
  - Writing in English, French and German: `gemma4:31b` (19–20 GB), `qwen3.8:27b` (18 GB), `mistral-small3.2:24b` (15 GB), `gemma4:12b` as the small option.
  - Coding with tool calls: `qwen3.8:27b` (18 GB), `qwen3.6:35b-a3b` (23–24 GB), `devstral-small-2:24b` (15 GB), `muse-glimmer:30b` (17–19 GB).
- **`qwen3.8:27b` is the only model that is a candidate for all three jobs.** Keeping it resident and swapping a small judge in beside it is the layout to test first.
- **No source publishes speed for these models on an M6.** Speed, the real memory at a working context length, and French and German copy quality all need the owner's own evals on the machine.

## The machine

Apple's spec page lists the M6 Mac mini with a 12-core CPU and 12-core GPU, 16 GB of unified memory configurable to 24 or 32 GB, and 170 GB/s memory bandwidth on the 24 and 32 GB configurations. [Apple, Mac mini tech specs](https://www.apple.com/mac-mini/specs/)

Two consequences:

- 32 GB is shared by macOS, the pipelines, any browser a job drives, and the models. No vendor source states how much of it a runtime may use for model memory on this machine. Unverified.
- Generation speed on Apple silicon is mostly bound by memory bandwidth. Benchmarks taken on Max-class chips will overstate what the M6 does. This is general knowledge, not a figure from a source here.

## Runtimes

| | Ollama | llama.cpp `llama-server` | LM Studio | mlx-lm `mlx_lm.server` |
|---|---|---|---|---|
| Version checked | v0.40.16 (2026-11-09) | b12385 (2026-11-14) | docs only | v0.32.2 (2026-10-16) |
| Engine on Apple silicon | MLX by default where the architecture is supported, else llama.cpp | llama.cpp (Metal), GGUF only | llama.cpp for GGUF, its own `mlx-engine` for MLX | MLX |
| OpenAI-compatible API | `/v1/chat/completions`, `/v1/responses`, `/v1/completions`, `/v1/models`, `/v1/embeddings` | `/v1/chat/completions`, `/v1/responses`, completions, embeddings | Chat Completions, Responses, Completions, Embeddings, Models | `/v1/chat/completions` and `/v1/models` |
| Anthropic-compatible API | `/v1/messages` | `/v1/messages` | not checked | no (open request) |
| JSON-schema enforcement | yes: `format` on the native API, `response_format` on `/v1` | yes: `response_format` with `json_schema`, or `json_schema` on `/completion`; grammar-based sampling | yes: `response_format` with `json_schema`; llama.cpp grammars for GGUF, Outlines for MLX | **no** (open request) |
| Tool calls | yes; `tool_choice` not supported | yes, with native handlers per model family and a generic fallback | yes (Tool Use page; not read in detail) | yes, where the tokenizer has a tool parser |
| Several models | loads on demand, keeps up to 3 by default if they fit, unloads idle ones | router mode: loads on demand, `--models-max` (default 4), optional memory margin | loads on demand, unloads after idle | one model per request, swapped on demand |
| Always-on on macOS | menu-bar app starts the server; settings through `launchctl setenv` | no service tooling documented; needs an own launchd job | `llmster` daemon (`lms daemon up`) or the app's run-on-login setting | none; its docs say it is not recommended for production |
| Licence | MIT (repo) | MIT (repo) | closed app, free for work use | MIT (repo) |

### Ollama

- **MLX is the default.** "On Apple Silicon devices, model architectures supported by the MLX runtime will automatically run on MLX." [v0.40.0 release notes, 2026-09-25](https://github.com/ollama/ollama/releases/tag/v0.40.0)
- **Schema enforcement works on the MLX engine.** v0.33.1 added "mlxrunner: add structured output support"; v0.34.4 says "Structured outputs on thinking models now apply in a single pass, making them faster and more reliable" and lists XGrammar among the updated components. [Releases](https://github.com/ollama/ollama/releases). The docs: pass a JSON schema in `format`, also pass the schema in the prompt, set temperature to 0, and the same works "through the OpenAI-compatible API via `response_format`". [Structured outputs](https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx)
- **OpenAI API gaps.** `response_format`, `tools`, `seed`, `reasoning_effort` are supported; `tool_choice`, `logit_bias`, `n` and logprobs are not. [OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx)
- **Anthropic API.** `/v1/messages` supports tools, tool results, thinking and streaming; `tool_choice` is not supported. [Anthropic compatibility](https://github.com/ollama/ollama/blob/main/docs/api/anthropic-compatibility.mdx). This matters because today's pipelines call Claude.
- **Tools together with a schema.** An open issue titled "server: allow tool calls with structured output" (#18975, opened 2026-10-13) suggests the two cannot be combined in one request. Only the title was read. Unverified.
- **Context length is not the model's maximum by default.** Defaults by memory: under 24 GiB 4k, 24–48 GiB 32k, 48 GiB and above 256k. "Tasks which require large context like web search, agents, and coding tools should be set to at least 64000 tokens." Set with `OLLAMA_CONTEXT_LENGTH`; a larger context needs more memory; `ollama ps` shows the allocated context and the CPU/GPU split. [Context length](https://github.com/ollama/ollama/blob/main/docs/context-length.mdx). That a 32 GB Mac lands in the 32k tier is an inference from this table.
- **Several models.** `OLLAMA_MAX_LOADED_MODELS` defaults to 3 per GPU, "provided they fit in available memory"; a model that does not fit waits until idle models are unloaded. Models stay loaded 5 minutes by default; `keep_alive: -1` or `OLLAMA_KEEP_ALIVE` keeps them. `OLLAMA_NUM_PARALLEL` defaults to 1 and multiplies context memory. [FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx)
- **Concurrent requests on MLX** appear only in a release candidate ("mlx: support concurrent generation", v0.40.17-rc0, 2026-11-10). Plan for one request at a time per model.
- **Service on macOS.** Requires macOS 14 or newer. The app runs the server and logs to `~/.ollama/logs/server.log`; environment variables are set with `launchctl setenv` and the app restarted. [macOS](https://github.com/ollama/ollama/blob/main/docs/macos.mdx), [FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx). The docs describe no headless launchd daemon; whether the app starts before login on an unattended machine is unverified.
- **Memory note from the MLX preview.** The March 2026 preview post said "Please make sure you have a Mac with more than 32GB of unified memory" for its one supported model, a 35B. [Ollama blog, 2026-03-30](https://ollama.com/blog/mlx). No current statement of a minimum was found. Unverified whether any limit remains.

### llama.cpp `llama-server`

- `response_format` accepts `{"type": "json_schema", ...}` including the OpenAI wrapper form with `strict`; enforcement is grammar-based sampling. [Server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- Function calling is on with the default Jinja templates; native tool-call formats are handled per model family with a generic fallback that "may consume more tokens and be less efficient". [Function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)
- Router mode (start without a model) loads and unloads by the request's `model` field. `--models-max` defaults to 4; `--models-memory-margin` unloads least-recently-used models until a new one fits; `--sleep-idle-seconds` sleeps an idle server. [Server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- Also exposes `/v1/responses` and an Anthropic-compatible `/v1/messages` ("no strong claims of compatibility").
- No MLX. Ollama bundles llama.cpp, so choosing llama.cpp directly buys control over flags, not a different engine.

### LM Studio

- Schema enforcement through `response_format` on `/v1/chat/completions`: llama.cpp grammars for GGUF, Outlines for MLX. The page warns that not all models manage it, "particularly LLMs below 7B parameters". [Structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output)
- Headless: `llmster` is a daemon without the GUI, started with `lms daemon up`; the desktop app can run the server on login. Models load on request and unload after idle. The page gives startup-service steps for Linux only. [Headless](https://lmstudio.ai/docs/developer/core/headless)
- Free for work use since 2025-07-08. [LM Studio blog](https://lmstudio.ai/blog/free-for-work). The app is closed source, which is the main reason it ranks below Ollama for an unattended operation.

### mlx-lm

- The server handles only `/v1/chat/completions` and `/v1/models`. Its documented request fields have no `response_format`; the requests "Allow structured generation through response_format in mlx_server" (#1007) and "Server v2 Anthropic API" (#2066) are open. [SERVER.md](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md), [issues](https://github.com/ml-explore/mlx-lm/issues)
- "The MLX LM server is not recommended for production as it only implements basic security checks." [SERVER.md](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md)
- Open issues report tool-call problems on specific models (#1061, #1293, #1639). Titles only were read.
- It rules itself out for the judging jobs. Its value here is as the engine inside Ollama and LM Studio.

## Models

Every model below is open-weight under Apache 2.0, checked on its Hugging Face card. "Repo created" is the creation date of the Hugging Face repository, which can precede the public release. Sizes are download sizes: Ollama's tag listing first, the `mlx-community` 4-bit conversion second. Resident memory is higher: add the context cache, which grows with the context length set.

| Model | Repo created | Params | Ollama 4-bit | MLX 4-bit | Context (card) | Notes |
|---|---|---|---|---|---|---|
| Qwen3.8-27B | 2026-08 | 27.8B dense | 18 GB | 16.1 GB | 262,144 | thinking on by default, can be disabled per request; vision |
| Qwen3.6-35B-A3B | 2026-04 | 36.0B, 3B active | 23–24 GB | 20.4 GB | 262,144 | mixture of experts, so faster per token than its size suggests |
| Gemma 4 31B | 2026-03 | 31.3B dense | 19–20 GB | 18.4 GB | 256K | 35+ languages out of the box; function calling |
| Gemma 4 26B A4B | 2026-03 | 25.8B, 4B active | 16–18 GB | 15.6 GB | 256K | mixture of experts |
| Gemma 4 12B | 2026-05 | 12.0B dense | 7.2–8.0 GB | 11.0 GB (QAT) | 256K | |
| Muse Glimmer 30B | 2026-08 | 29.8B | 17–19 GB | not checked | 131,072+ | Meta; built for local agents |
| Devstral Small 2 24B | 2025-11 | 24.0B dense | 15 GB | 15.1 GB | 256K | coding agent model |
| Mistral Small 3.2 24B | 2025-06 | 24.0B dense | 15 GB | not checked | 128K (Ollama) | card lists en, fr, de first |
| gpt-oss-20b | 2025-08 | 20.9B, MoE | 14 GB | 11.2–12.1 GB | 128K (Ollama) | text only; reasoning model |
| Ministral 3 14B | 2025-10 | 13.9B dense | 9.1 GB | 8.4 GB | 256K (Ollama) | card lists en, fr, de |
| Qwen3.5-9B | 2026-02 | 9.7B dense | 6.6–8.9 GB | 6.0 GB | 262,144 | |

Sources: Hugging Face cards and file listings for [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B), [Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B), [Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B), [gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it), [gemma-4-12B-it](https://huggingface.co/google/gemma-4-12B-it), [Muse-Glimmer-30B](https://huggingface.co/meta-models/Muse-Glimmer-30B), [Devstral-Small-2-24B](https://huggingface.co/mistralai/Devstral-Small-2-24B-Instruct-2512), [Mistral-Small-3.2-24B](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506), [gpt-oss-20b](https://huggingface.co/openai/gpt-oss-20b), [Ministral-3-14B](https://huggingface.co/mistralai/Ministral-3-14B-Instruct-2512); the [mlx-community](https://huggingface.co/mlx-community) conversions; Ollama tag pages for [qwen3.8](https://ollama.com/library/qwen3.8/tags), [qwen3.6](https://ollama.com/library/qwen3.6/tags), [qwen3.5](https://ollama.com/library/qwen3.5/tags), [gemma4](https://ollama.com/library/gemma4/tags), [muse-glimmer](https://ollama.com/library/muse-glimmer/tags), [devstral-small-2](https://ollama.com/library/devstral-small-2/tags), [mistral-small3.2](https://ollama.com/library/mistral-small3.2/tags), [gpt-oss](https://ollama.com/library/gpt-oss/tags), [ministral-3](https://ollama.com/library/ministral-3/tags).

Ruled out by size: the current flagships from the same vendors are far beyond 32 GB (Qwen3.8-Flash-Next 180B, GLM-5.3-Flash 321B, DeepSeek-V4.1-Flash 763B, Mistral Small 4 119B, by the parameter counts on their cards). 8-bit builds of the 24–31B models are 26–34 GB and do not fit either.

### Job 1: judging with schema-valid output

Schema validity comes from the runtime, not the model: with enforcement on, any model returns JSON that parses against the schema. The model decides whether the judgment is right. So the candidates are chosen for size and reasoning, and the eval decides.

- **`gpt-oss:20b`**, 14 GB, 128K. The card lists function calling "with defined schemas" and Structured Outputs as native capabilities, and says the model runs "within 16GB of memory". Text only.
- **`gemma4:12b`**, 7.2 GB (QAT) to 8.0 GB, 256K. Smallest credible judge; leaves the most room for a second model.
- **`qwen3.5:9b`**, 6.6 GB (GGUF) or 8.9 GB (MLX), 262K. ADR 0001 already names a small Qwen as the first local trial.
- **`qwen3.8:27b`**, 18 GB. The step up when a small judge falls below its floor. Thinking should be disabled or budgeted for judges; Ollama's single-pass structured output on thinking models dates from v0.34.4.

Ollama also ships "decision models" that return choices, yes/no probabilities and ratings (for example `d1`, `autotrust-jev`, v0.40.12 and v0.40.15 release notes). They were not investigated.

### Job 2: marketing copy in English, French and German

No source found publishes French or German copywriting quality for these models. Language claims below are the vendors' own.

- **`gemma4:31b`**, 19–20 GB, 256K. "Out-of-the-box support for 35+ languages, pre-trained on 140+ languages." (card)
- **`qwen3.8:27b`**, 18 GB, 262K. The Qwen3.8 card makes no language claim; the Qwen3.5 card, whose architecture it builds on, claims "201 languages and dialects".
- **`mistral-small3.2:24b`**, 15 GB, 128K. A European vendor; the card's language list starts en, fr, de. It dates from June 2025 and Mistral has released no newer model of this size (its successor, Mistral Small 4, is 119B).
- **`gemma4:12b`**, 7.2–8.0 GB, as the small option that can sit beside a large model.

### Job 3: coding with tool calls

All figures are vendor-reported on the model cards, at full precision, not at 4-bit.

- **`qwen3.8:27b`**, 18 GB, 262K. SWE-bench Pro 61.7, Terminal Bench 2.1 73.0, against Qwen3.6-27B's 53.5 and 63.4 and Muse Glimmer 30B's 51.2 and 51.7 in the same table. The evals ran in the Claude Code harness with a 256K context window, which a 32 GB machine cannot give it.
- **`qwen3.6:35b-a3b`**, 23–24 GB, 262K. SWE-bench Verified 73.4, SWE-bench Pro 49.5 (Gemma 4 31B: 52.0 and 35.7 in the same table). Faster per token, but it takes most of the machine by itself.
- **`devstral-small-2:24b`**, 15 GB, 256K. SWE-bench Verified 68.0%. The card says it is "light enough to run on a single RTX 4090 or a Mac with 32GB RAM". Smallest of the four, so it leaves the most room for context.
- **`muse-glimmer:30b`**, 17–19 GB, 131K+. Built for "autonomous agentic tasks on consumer hardware" with "reliable tool use" (card). Only Qwen's table was read for its scores.

A coding agent needs a long context: Ollama's docs say at least 64,000 tokens, double the 32k default expected on this machine. How much memory a 64k context adds for each model is not published. This, not the weights, decides whether a coding model can share the machine.

### Two models at once

By weights alone (Ollama sizes):

| Pair | Weights | Verdict |
|---|---|---|
| Any two of the 27–31B models | 34–40 GB | does not fit |
| `qwen3.8:27b` + `gemma4:12b` or `qwen3.5:9b` | 25–27 GB | fits on paper; 5–7 GB left for macOS, context caches and the pipelines; must be measured |
| `devstral-small-2` + `gemma4:12b` | 22–23 GB | plausible |
| `gpt-oss:20b` + `gemma4:12b` | 21–22 GB | plausible |
| `qwen3.6:35b-a3b` + anything | 30 GB and up | does not fit |

"Plausible" is arithmetic, not a test. If a second model does not fit, Ollama queues the request and unloads an idle model, so the cost of getting this wrong is reload time, not failure. Because the jobs are batch pipelines rather than interactive, loading one model per job in sequence is a workable design by itself.

### Speed

- **First-party, different model and unnamed chip.** Ollama's MLX preview post reports Qwen3.5-35B-A3B (NVFP4) at 1810 tokens/s prefill and 112 tokens/s decode, tested 2026-03-29 on unspecified Apple silicon. [Ollama blog](https://ollama.com/blog/mlx). A later post says NVFP4 generates "about 20% faster than q4_K_M" on Gemma 4 12B, without absolute numbers. [Ollama blog, 2026-06-11](https://ollama.com/blog/mlx-performance)
- **Third-party, unverified.** A blog reports Qwen3.8-27B MLX 4-bit at about 24 tokens/s on an M5 Max with 128 GB, more with speculative decoding. [jacar.es](https://jacar.es/?p=8613). Found through search; the page itself was not read.
- **Nothing for the M6.** No vendor or model card publishes tokens per second for any candidate on an M6. A dense 27B model on a base M6 should be expected to run well below the Max-class figure above. Measure it on arrival.

## Unverified or open

- Real resident memory of each candidate at 32k and 64k context on the M6, and therefore every "fits" above.
- Any speed on the M6.
- How much of 32 GB Ollama will use for models on this machine, and whether the "more than 32GB" note from the MLX preview still applies to any model.
- Whether tools and a schema can be combined in one Ollama request (issue #18975, title only).
- Whether Ollama serves requests before a user logs in on an unattended Mac.
- French and German copy quality for every candidate: vendor language claims only.
- Benchmark scores are vendor-reported at full precision; the effect of 4-bit quantization on them is not published.
- Which quantization Ollama picks for the default tags on Apple silicon (the `-mlx`, `-nvfp4` and `q4_K_M` tags are all listed at 17–19 GB for the 27B).
- LM Studio's Tool Use and TTL pages, and its Anthropic compatibility, were not read.
- Ollama's decision models as judges.
