# Can the pipelines reach a local model with structured output?

Research for issue #4 (map: issue #1). Desk research on 2026-11-14. Nothing here was run: the prototype's dependencies are not installed and no local model server was available. Every claim is tagged **[source]** (read in the owning project's code), **[docs]** (stated in its official docs) or **[unverified]**.

## Short answer

**Yes, on paper, with a one-line change per job and no new dependency.** Mastra's `Agent` accepts a model object in place of the model string:

```ts
model: { id: "lmstudio/<model id>", url: "http://localhost:1234/v1" }
```

With a `url`, Mastra builds an OpenAI-compatible Chat Completions client with native structured output switched on, so the zod schema is sent as `response_format: { type: "json_schema", … }`. Ollama, LM Studio and llama.cpp's server all turn that schema into a decoding constraint, so the reply is syntactically valid JSON of the right shape. Mastra then validates the reply against the zod schema and throws if it fails.

"Reliably" has two limits that no setup removes:

1. A constraint guarantees shape, not truth. Enum values and required keys are enforced; a wrong verdict is not. That is the eval floor's job (issue #1), not this ticket's.
2. The constraint breaks in known ways (truncated output, silently skipped schema keywords, a context window that is too small). See [Failure modes](#failure-modes).

## What the pipelines use from Mastra

Read in `prototype/runners/` (local `main`, 2026-11-14).

- **Nine call sites, one shape.** `new Agent({ id, name, model, instructions })`, then `agent.generate(prompt, { structuredOutput: { schema }, maxSteps: 1 })`, then `r.object` and `r.usage.inputTokens` / `outputTokens`. Files: `seo-geo/labels.ts`, `seo-geo/answer-check.ts`, `seo-geo/generate-queries.ts`, `marketing/claims-review.ts`, `marketing/funnel.ts`, `marketing/content-writer.ts`, `marketing/site-draft.ts`, `marketing/onpage-fixes.ts`, `mastra/workflow.ts`.
- **No tools, no memory, no streaming, no multi-step loops.** One call sets `modelSettings: { maxOutputTokens: 32000 }` (`site-draft.ts`).
- **The workflow engine is used once.** `mastra/workflow.ts` chains two steps with `createWorkflow().foreach(…, { concurrency: 3 }).then(…).commit()`.
- **The model is already an environment variable per job** (`GEO_JUDGE_MODEL`, `CLAIMS_MODEL`, `ONPAGE_MODEL`, …), holding a router string such as `anthropic/<model>`.
- **Retries and evidence checks are the pipelines' own code** (quote-in-page checks, retry with an `extra` hint), not Mastra's.
- **Cost tables are keyed by the Anthropic model string** and fall back to zero for an unknown model, so a local model reports zero cost without a code change.

## How Mastra reaches a local endpoint

- **[docs]** The model option accepts `{ id, url }` for "a custom OpenAI-compatible endpoint"; `url` is the base URL (`…/v1`), not the chat route. The documented local example is LM Studio. `apiKey`, `headers` and `api: "responses"` are optional. ([Mastra models](https://mastra.ai/models))
- **[docs]** `ollama/<model>` strings do **not** resolve: "Ollama isn't a model router provider". The docs point to a community provider package instead. ([Mastra: Ollama](https://mastra.ai/models/providers/ollama)) The `{ id, url }` form avoids that package: Ollama serves the same OpenAI-compatible API at `http://localhost:11434/v1`. ([Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility))
- **[source]** With `url` set, the router calls `createOpenAICompatible({ name, apiKey, baseURL: url, headers, supportsStructuredOutputs: true }).chatModel(modelId)`. No API key or environment variable is required (`apiKey ?? ''`). This is the same in the `@mastra/core@1.82.0` tag the prototype locks and on `main` (`packages/core/src/llm/model/router.ts`, [repo](https://github.com/mastra-ai/mastra)).
- **[docs]** Provider options for a custom endpoint are keyed by the first segment of `id` (for example `providerOptions: { lmstudio: { reasoningEffort: "low" } }`).
- **[unverified]** The exact `model` value sent on the wire for each `id` form (whether the first segment is stripped) with each runtime. The docs say to use `provider/model` when the server expects a bare model name.

## How structured output is implemented

**Mastra side**

- **[docs]** "By default, Mastra passes the schema to the model provider using the `response_format` API parameter." `jsonPromptInjection` (`true`/`'system'`, `'inline'`, `'auto'`) switches to writing the schema into the prompt instead. `errorStrategy` is `strict` by default: a reply that fails validation throws. `structuredOutput.model` adds a second model that restructures free text (two calls). ([Mastra structured output](https://mastra.ai/docs/agents/structured-output))
- **[source]** The AI SDK's OpenAI-compatible chat model sends `response_format: { type: "json_schema", json_schema: { name, schema, strict } }` only when `supportsStructuredOutputs` is true; otherwise it sends `{ type: "json_object" }` with no schema. `strict` defaults to true. (`packages/openai-compatible/src/chat/openai-compatible-chat-language-model.ts`, [vercel/ai](https://github.com/vercel/ai)) Mastra sets the flag for every `url` model, so the schema is always sent.
- **[source]** Mastra rewrites schemas for OpenAI's strict mode (all properties required) only for some providers; router models are excluded from that rewrite by an `instanceof` check (`packages/core/src/stream/aisdk/v5/execute.ts`). **[unverified]** whether that check applies to a `url` model at run time, and whether any local runtime acts on `strict` at all. The prototype has one `.optional()` field in its runners, so the exposure is small.

**Runtime side**

| Runtime | Accepts `response_format: json_schema` | Enforcement | Source |
|---|---|---|---|
| Ollama | Yes: the OpenAI layer maps `json_schema.schema` to its native `format` field | Grammar-constrained. The schema is passed to its bundled `llama-server` as `json_schema`. Its MLX runner constrains through a separate grammar engine. | **[source]** `openai/openai.go`, `llm/llama_server.go`, `mlxrunner/client.go` on `main` ([repo](https://github.com/ollama/ollama)); **[docs]** [structured outputs](https://docs.ollama.com/capabilities/structured-outputs) |
| LM Studio | Yes | Grammar-constrained: "GGUF models use llama.cpp's grammar-based sampling"; MLX models use Outlines | **[docs]** [structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output) |
| llama.cpp `llama-server` | Yes: both `{type:"json_object", schema}` and the OpenAI `json_schema` wrapper | Grammar-constrained (schema converted to GBNF) | **[docs]** [server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [grammars README](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md) |
| `mlx_lm.server` | **Not documented.** `response_format` is absent from the documented request fields | None documented: prompt-and-parse only. Also "not recommended for production". | **[docs]** [SERVER.md](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md) |

- **[unverified]** Whether the Ollama release current today (v0.40.16) contains the MLX grammar path read on `main`.
- For `mlx_lm.server`, Mastra would need `jsonPromptInjection: true` and would rely on zod validation alone. Prefer one of the three constraining runtimes; LM Studio and Ollama both run MLX models with a constraint.

## Failure modes

1. **Context window too small, silently.** Ollama's default context is 4k tokens under 24 GiB of VRAM and 32k from 24 to 48 GiB; it is set with `OLLAMA_CONTEXT_LENGTH` or a Modelfile, and "the OpenAI API does not have a way of setting the context size". **[docs]** ([context length](https://docs.ollama.com/context-length), [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)) An over-long prompt is truncated with a log warning, not an error. **[source]** (`llm/llama_server.go`) The page-audit and site-draft prompts carry whole pages, so the model could judge half a page and still return valid JSON. **[unverified]** which default a 32 GB Mac gets.
2. **Truncated output is invalid JSON.** A grammar cannot close the object once `max_tokens` runs out. Thinking models spend output tokens before the JSON starts. Mastra throws on the parse failure (default `errorStrategy`), so this fails loudly. **[unverified]** each runtime's default output limit when the request sets none (eight of nine call sites set none).
3. **Schema keywords skipped silently.** llama.cpp: "Unsupported features are skipped silently"; numeric bounds work for `integer` only; `pattern` needs `^…$`; nested `$ref`s are broken; `uniqueItems`, `not` and conditionals are not planned. **[docs]** (grammars README) zod refinements never reach the schema at all. The zod validation after the call is the real gate; the pipelines' model-facing schemas today are plain objects, arrays, enums and nullable strings, which are inside the supported set.
4. **The schema is not shown to the model.** llama.cpp: "The JSON schema is only used to constrain the model output and is not injected into the prompt." **[docs]** Ollama advises to "also pass the JSON schema as a string in the prompt" and to set temperature to 0. **[docs]** A model that does not know the field meanings fills a valid shape with poor content. The pipelines' instructions already describe each field in prose; they set no temperature.
5. **Thinking models.** Ollama builds a grammar that leaves thinking free and constrains what follows. **[source]** (`llm/gbnf.go`) Its OpenAI layer accepts `reasoning_effort`. **[docs]** **[unverified]** how LM Studio and bare `llama-server` combine a thinking model with a schema, and whether reasoning text can leak into `content`.
6. **Small models.** LM Studio: "Not all models are capable of structured output, particularly LLMs below 7B parameters." **[docs]**
7. **Token counts.** **[unverified]** whether `r.usage` is populated through Mastra for each runtime. The AI SDK client only asks for streamed usage when `includeUsage` is set, and Mastra's `url` path does not set it; whether `generate()` streams internally was not checked.

## Options, smallest change first

1. **Mastra, model object.** Change `model: MODEL` to a model resolved from the same environment variable: a router string for cloud, `{ id, url }` for local. No new dependency, no change to schemas, prompts or result handling. Cloud and local stay on one code path, which keeps eval scores comparable.
2. **AI SDK directly** (`ai` plus `@ai-sdk/openai-compatible` and a cloud provider package). The same request on the wire, since Mastra wraps exactly this. Removes one layer; costs new direct dependencies and a rewrite of nine call sites and one workflow.
3. **Plain client plus zod.** `fetch` to `/v1/chat/completions` with `response_format` built from `z.toJSONSchema(schema)` (zod 4), then `schema.parse`. About 40 lines and no framework, but local only: cloud Claude would need a second client and a second structured-output path, and issue #1 keeps cloud as the authorized fallback for every job.

## Recommendation: keep Mastra, behind one seam

Keep Mastra for now and do not make a rewrite a precondition of going local.

- **It can do the job as it stands.** The local path is in the locked version, documented, and needs no new package.
- **What ADR 0001 named as Mastra's value, provider portability, is what local-first needs.** Each job runs local by default and may move to cloud on authorization. One call that takes either target is worth more here than it was in the stack trial.
- **A rewrite buys little.** Options 2 and 3 send the same request. They remove layers, not failure modes: every failure above lives in the runtime or the model.
- **The cost of keeping it is real but bounded.** Mastra is a large, fast-moving dependency (1.82 to 1.83 within days; it bundles three AI SDK majors) and the pipelines use a sliver of it. Bound that by routing all nine call sites through one function, for example `generateObject({ model, instructions, prompt, schema, maxOutputTokens }) → { object, usage }`, which also becomes the one place for temperature, the output cap, reasoning effort and a local/cloud model resolver. Changing nine files is a proposal for the owner, not part of this note.
- **Drop Mastra if a check below fails in a way the seam cannot fix**, or if the orchestration decision leaves `createWorkflow` unused. Behind the seam, the move to option 3 (local) or option 2 (both) is one file.

This is a desk recommendation. Mastra adding "nothing" locally, ADR 0001's drop condition, can only be judged on the machine.

## Checks to run on the M6

1. **Wire check.** Point one job (the on-page answer check: smallest schema) at each candidate runtime through `{ id, url }` and log the HTTP request. Confirm that `response_format.type` is `json_schema` with the full schema, that the `model` value is what the server expects, that `r.object` parses and that `r.usage` token counts are non-zero.
2. **Constraint check.** Run the same job 50 times at temperature 0 on a candidate model, including a thinking model, and count validation failures. Then set a low output cap and confirm the truncated reply throws and is not returned as an object.
3. **Context check.** Send the longest real prompt (a full site-draft page) and confirm from the server log that nothing was truncated at the configured context length, and that the configured length fits in memory beside the model (`ollama ps` or the runtime's equivalent).

Schema-valid is the entry ticket only. Each job still has to clear its eval floor on the local model before its output is used.

## Sources

- Mastra docs: [models](https://mastra.ai/models), [structured output](https://mastra.ai/docs/agents/structured-output), [Ollama provider](https://mastra.ai/models/providers/ollama)
- Mastra source ([mastra-ai/mastra](https://github.com/mastra-ai/mastra)), tag `@mastra/core@1.82.0` and `main` at `ca0af9fa`: `packages/core/src/llm/model/router.ts`, `packages/core/src/stream/aisdk/v5/execute.ts`
- AI SDK: [OpenAI-compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers); source `packages/openai-compatible/src/chat/openai-compatible-chat-language-model.ts` in [vercel/ai](https://github.com/vercel/ai)
- Ollama docs: [structured outputs](https://docs.ollama.com/capabilities/structured-outputs), [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [context length](https://docs.ollama.com/context-length); source `openai/openai.go`, `llm/llama_server.go`, `llm/gbnf.go`, `mlxrunner/client.go` in [ollama/ollama](https://github.com/ollama/ollama)
- LM Studio docs: [structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output)
- llama.cpp: [server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [grammars README](https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md)
- mlx-lm: [SERVER.md](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md)
- Prototype: `prototype/runners/`, `prototype/docs/decisions/0001-stack-validation.md`
