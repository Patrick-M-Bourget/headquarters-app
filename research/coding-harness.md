# Which coding harness can drive a local model

Research for issue #5 (map: #1). Researched 2026-11-14. Planning input only; nothing here was installed or run.

## Question

Which coding-agent harnesses can drive a local model, served on a 32 GB Apple Silicon Mac mini, to work a ticket on a git repo unattended: edit files, run the repo's check script (unit tests plus about 900 Playwright tests) and open a GitHub pull request? For each: local-model support, how file, shell and network access are restricted on macOS, unattended operation, and documented behavior with weaker models.

## Short answer

- **Trial first: Qwen Code.** It speaks plain OpenAI chat completions, is built around open-weights models, ships macOS Seatbelt profiles, and has hard run budgets with their own exit codes.
- **Trial second: Codex CLI.** It has the strongest built-in macOS lockdown of the group (sandbox on by default in `codex exec`, network off by default, `.git` read-only). Its limit: the local server must offer the OpenAI *Responses* API, not only chat completions.
- **Reserve: OpenCode.** Best local-model ergonomics, but its own security policy says it has no sandbox, and V2 is weeks old. All lockdown would come from outside it.
- **Claude Code on a local model** works through Ollama's and LM Studio's Anthropic-compatible endpoints, but Anthropic states it does not support non-Claude models. Keep it as the harness for tickets the owner authorizes for cloud, where ADR 0001's lockdown recipe already applies.
- **Aider** is not recommended: its docs say most local models are "just barely capable" of working with it, it has no sandbox, and its last release is nine months old.

No source gives evidence of how well any harness completes real tickets on a model that fits in 32 GB. Only a trial can settle that.

## How to read this note

- **[doc]** means the vendor's own documentation or repository states it. Most pages were read through a fetch tool that summarizes, so quoted wording is exact only where marked *verbatim*.
- **[unverified]** means no primary source was found or read. Treat it as a question for the trial.
- **[suggestion]** marks this note's own reasoning, not a sourced fact.
- Versions and dates are from GitHub, npm and PyPI on 2026-11-14.

## Findings that apply to every harness

1. **Context length is the first thing to set.** Ollama's default context is 32k tokens on a machine with 24 to 48 GiB of memory, and its docs say agents and coding tools "should be set to at least 64000 tokens" [doc: [Ollama context length](https://docs.ollama.com/context-length)]. Ollama's pages for OpenCode, Codex and Claude Code each ask for 64k or more. A 64k context costs memory that the model weights and about 900 Playwright tests also need. [suggestion]
2. **macOS has one practical sandbox mechanism: Seatbelt (`sandbox-exec`).** Claude Code, Codex CLI, Qwen Code and Anthropic's standalone `sandbox-runtime` all use it. Bubblewrap-style sandboxes are Linux-only.
3. **A harness-independent wrapper exists.** Anthropic's [`sandbox-runtime`](https://github.com/anthropics/sandbox-runtime) (`srt <command>`) wraps any process in a Seatbelt profile with a domain allowlist (network denied by default) and write paths denied by default. Its README calls it a beta research preview whose config format may change. It could wrap a harness that has no sandbox. [doc]
4. **Playwright under Seatbelt is untested.** The check script starts a local preview server and Chromium. Claude Code's sandbox docs list Chromium trouble only for Linux, and say local port binding on macOS needs `allowLocalBinding`. Whether Chromium launches inside each harness's macOS sandbox is [unverified] and is the first thing a trial should check.
5. **The agent does not need to open the pull request.** [suggestion] A wrapper script can create the branch or worktree, run the harness, run `scripts/check.sh`, then `git push` and `gh pr create`. The GitHub token then never enters the agent's environment and the agent needs no network beyond the local model endpoint. This also works around two documented limits: Codex keeps `.git` read-only in its sandbox, and Go programs such as `gh` can fail TLS under Seatbelt (Claude Code sandbox docs).
6. **Lessons from the prototype still hold** (`.agent/memory/anti-patterns.md`): test paths you did not explicitly deny, and check that the agent does not inherit the owner's user-level settings.

## Comparison

| | Local model | Built-in macOS sandbox | Unattended run | Run limits | Maintained |
|---|---|---|---|---|---|
| Qwen Code | OpenAI chat completions, any base URL | Seatbelt profiles, opt-in | `qwen -p` | Turn, tool-call and wall-time budgets with exit codes | Yes (0.27.3, 2026-11-13) |
| Codex CLI | Responses API only; `--oss` for Ollama, LM Studio | Seatbelt, on by default in `exec`, network off | `codex exec` | None found | Yes (0.169.0, 2026-11-13) |
| OpenCode V2 | Auto-discovers Ollama, LM Studio; custom OpenAI-compatible | None ("No Sandbox") | `opencode run --auto` | Per-agent `steps` cap | Yes (v2.3.0, 2026-11-13) |
| Claude Code | Anthropic Messages format only; unsupported for non-Claude models | Seatbelt for shell commands, opt-in, domain allowlist | `claude -p` | `--max-budget-usd`; turn cap not checked | Yes |
| Aider | OpenAI-compatible, Ollama | None | `aider --message` | Not documented | Stale (0.86.2, 2026-02) |

## Qwen Code

Repo: [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code), Apache-2.0.

- **Local model.** Declare the model under `modelProviders.openai` in `settings.json` with `baseUrl` (docs list `http://localhost:11434/v1` for Ollama and `http://localhost:1234/v1` for LM Studio), an `envKey`, and `generationConfig.contextWindowSize`. A placeholder key is fine for servers without authentication. An unset window can fall back to 200K, so set it. [doc: [model providers](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/model-providers/)]
- **Lockdown on macOS.** The sandbox runs the whole CLI under `sandbox-exec`. Enable with `QWEN_SANDBOX=sandbox-exec`, `--sandbox` or `tools.sandbox`. Six built-in profiles combine write limits (permissive or restrictive) with network open, closed or proxied; the default profile, `permissive-open`, limits writes outside the project and leaves the network open. A custom profile can live in `.qwen/sandbox-macos-<name>.sb`. The proxied profiles need a proxy you supply. The docs do not spell out what "restrictive" covers. [doc: [sandbox](https://qwenlm.github.io/qwen-code-docs/en/users/features/sandbox/)]
- **Permissions.** `permissions.deny` blocks tool calls; `permissions.allow` only auto-approves; `tools.disabled` removes tools. Rule syntax for shell commands was not read. [doc, partly unverified]
- **Unattended.** `qwen -p "<prompt>"`, `--output-format json` or `stream-json`. `--yolo` approves everything and, per the docs, does not turn on a sandbox; the CLI warns when both conditions hold. How the non-yolo approval modes behave with nobody to answer is [unverified]. [doc: [headless](https://qwenlm.github.io/qwen-code-docs/en/users/features/headless/)]
- **Weaker models and long loops.** `--max-session-turns` (exit 53), `--max-tool-calls` and `--max-wall-time` (exit 55), a per-turn tool-call cap (default 100), and `model.loopProtection` (`warn`, `stop` or `off`). Streaming loop detection is off by default (`model.skipLoopDetection: true`). [doc: [settings](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/)]
- **Open questions.** Whether a network-closed profile still lets the CLI reach a model server on localhost; what the restrictive profiles allow; whether Playwright runs inside the sandbox.

## Codex CLI

Repo: [openai/codex](https://github.com/openai/codex), Apache-2.0.

- **Local model.** `codex --oss` uses a built-in `ollama` or `lmstudio` provider (`oss_provider`, or `--local-provider`; `codex exec` exits with an error if neither is set). Custom providers go in `model_providers`, but the config reference says of `wire_api`: "`responses` is the only supported value". The local server must therefore serve `/v1/responses`. Ollama does since v0.13.3 (stateless only); LM Studio documents a Codex integration. Other servers are [unverified]. Set `model_context_window` yourself. [doc: [advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced), [config reference](https://learn.chatgpt.com/docs/config-file/config-reference), [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [Ollama Codex page](https://docs.ollama.com/integrations/codex)]
- **Lockdown on macOS.** Seatbelt, and it "applies to spawned commands, not just to built-in file operations". Modes: `read-only`, `workspace-write`, `danger-full-access`. Network is off by default, also in `workspace-write`; turning it on is a separate setting, and a proxy with per-domain allow and deny rules can then narrow it. Inside writable roots, `.git`, `.codex`, `.agents` and `.aws` stay read-only. [doc: [sandboxing](https://learn.chatgpt.com/docs/sandboxing), [approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)]
- **Unattended.** `codex exec "<task>"` runs in a read-only sandbox by default; `--sandbox workspace-write` allows edits. `--json` gives a JSON Lines event stream, `--ignore-user-config` skips the user's config. `--full-auto` no longer exists. What happens when an action would need approval and the policy is `never` is not documented. [doc: [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)]
- **Weaker models and long loops.** No guidance found beyond Ollama's 64k minimum. No turn or tool-call cap was found in the pages read. [unverified]
- **Open questions.** Whether the sandbox with network off still reaches the local model server (the model call is made by the CLI, not by a sandboxed command, so it should; untested); whether Playwright's local server and Chromium run with network off; how a model that is not a GPT model copes with Codex's prompts and tools.

## OpenCode

Repo: [anomalyco/opencode](https://github.com/anomalyco/opencode), MIT. V2 is current: GitHub release v2.3.0 (2026-11-13), npm package `@opencode/cli`. The older npm package `opencode-ai` still has 1.19.5 as `latest`, and many third-party guides describe V1 config, which V2 does not accept unchanged.

- **Local model.** OpenCode discovers models from Ollama and LM Studio at their default local addresses and reads their context and tool support. For any other OpenAI-compatible server, add a provider with `settings.baseURL` and a model entry with `limit` and `capabilities`; unlisted models are assumed to have a 200,000-token context, which is wrong for a local model. [doc: [providers](https://opencode.ai/docs/providers/), [models](https://opencode.ai/docs/models/)]
- **Lockdown on macOS.** None built in. The repo's security policy says, *verbatim*: "OpenCode does **not** sandbox the agent. The permission system exists as a UX feature ... it is not designed to provide security isolation. If you need true isolation, run OpenCode inside a Docker container or VM." Sandbox escapes are out of scope for its security reports. [doc: [SECURITY.md](https://github.com/anomalyco/opencode/blob/dev/SECURITY.md)]
- **Permissions.** V2 uses an ordered `permissions` list of `action`, `resource`, `effect` rules; the last match wins, and the built-in base ends in allow-everything. Paths outside the project are allowed by default in V2 (V1 asked). `policies` can only tighten, and global policies override project ones. The docs say the shell tool runs with "the host user's filesystem, process, and network authority" and that reading directories out of command text is best effort. [doc: [permissions](https://opencode.ai/docs/permissions/), [policies](https://opencode.ai/docs/policies/), [migration](https://opencode.ai/docs/migrate-v1/)]
- **Unattended.** `opencode run "<message>"`, with `--agent`, `--model`, `--format json`, and `--auto`, which approves everything not explicitly denied. `--standalone` runs a private server instead of the shared per-user background service. How a request that would prompt is handled without `--auto` is not documented. [doc: [CLI commands](https://opencode.ai/docs/cli/commands/)]
- **Weaker models and long loops.** An agent can set `steps`; on the last step OpenCode removes the tools and asks for a summary. V1's `doom_loop` check (same call three times) is not a V2 permission. No guidance for weaker models. [doc: [agents](https://opencode.ai/docs/agents/)]
- **Other.** V2 reads only `AGENTS.md`, not `CLAUDE.md`. V1 had `opencode github` commands; whether V2 keeps them is [unverified].

## Claude Code on a local endpoint

- **Local model.** Claude Code speaks the Anthropic Messages format, not OpenAI's. Ollama (`/v1/messages`) and LM Studio both document an Anthropic-compatible endpoint and a Claude Code setup: `ANTHROPIC_BASE_URL`, a placeholder `ANTHROPIC_AUTH_TOKEN`, and `--model <local model>`. Ollama's endpoint lacks token counting, prompt caching and `tool_choice`. A plain OpenAI-compatible server would need a translating proxy. [doc: [Ollama Claude Code page](https://docs.ollama.com/integrations/claude-code), [Ollama Anthropic compatibility](https://docs.ollama.com/api/anthropic-compatibility), [LM Studio Claude Code page](https://lmstudio.ai/docs/integrations/claude-code)]
- **Vendor position**, *verbatim*: "Anthropic ... doesn't support routing Claude Code to non-Claude models through any gateway." [doc: [LLM gateways](https://code.claude.com/docs/en/llm-gateway)]
- **Settings a local model needs.** Claude Code assumes a 1M-token context for a model ID it does not recognize; `CLAUDE_CODE_MAX_CONTEXT_TOKENS` declares the real one. `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` stops pre-release request fields. Background tasks use the model in `ANTHROPIC_DEFAULT_HAIKU_MODEL`, which should also point at a local model. The WebFetch safety check and the fast-mode check call `api.anthropic.com` directly whatever the base URL is. [doc: [model configuration](https://code.claude.com/docs/en/model-config), [gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol)]
- **Lockdown on macOS.** Two layers. Permission rules govern every tool; the Seatbelt sandbox (`sandbox.enabled`, off by default) governs shell commands and their child processes only. In the sandbox, writes are limited to the working directory, reads are open by default (including `~/.ssh`) unless denied, and network goes through a proxy with a domain allowlist that starts empty. `allowUnsandboxedCommands: false` removes the escape hatch and `failIfUnavailable` stops a run that cannot be sandboxed. Documented macOS limits: Go programs such as `gh` may fail TLS, git over SSH fails, local ports need `allowLocalBinding`. [doc: [sandboxing](https://code.claude.com/docs/en/sandboxing)]
- **Unattended.** `claude -p`, with `--permission-mode dontAsk` (deny anything that would prompt), `--allowedTools`, `--output-format json`, and `--bare` to skip the host's hooks, plugins, memory and `CLAUDE.md`. Bare mode does not run hooks. The prototype found that `--setting-sources project --settings <file>` are both needed to keep the owner's user-level rules out (ADR 0001). [doc: [headless](https://code.claude.com/docs/en/headless)]
- **Weaker models and long loops.** No vendor guidance, by design. ADR 0001 judged long self-directed tool loops a poor fit for weak models. LM Studio asks for more than about 25k context, Ollama for 64k.

## Aider

Repo: [Aider-AI/aider](https://github.com/Aider-AI/aider), Apache-2.0. Last commit 2026-05-22; latest PyPI release 0.86.2 on 2026-02-12.

- **Local model.** `OPENAI_API_BASE` plus `--model openai/<name>`, or `OLLAMA_API_BASE` plus `ollama_chat/<name>`. Aider sizes Ollama's context per request; a fixed size goes in `.aider.model.settings.yml`. [doc: [OpenAI-compatible](https://aider.chat/docs/llms/openai-compat.html), [Ollama](https://aider.chat/docs/llms/ollama.html)]
- **Shape.** Aider is not a tool-calling agent. The model returns edits in a text format, Aider applies and commits them, and `--test-cmd` with `--auto-test` reruns a command and asks the model to fix failures. It needs no tool-calling support from the model, and the model never runs commands of its own when `--no-suggest-shell-commands` is set. The number of fix attempts is not documented. [doc: [lint and test](https://aider.chat/docs/usage/lint-test.html), [options](https://aider.chat/docs/config/options.html)]
- **Lockdown on macOS.** No sandbox and no permission rules. Scope is limited by what it is told to edit (`--subtree-only`, `.aiderignore`). The test command runs as the user. [doc]
- **Unattended.** `aider --message "<task>" --yes-always`. The Python API is "not officially supported". [doc: [scripting](https://aider.chat/docs/scripting.html)]
- **Weaker models**, per its own troubleshooting page: "Most local models are just barely capable of working with aider, so editing errors are probably unavoidable"; quantized models are worse; above about 25k tokens of context "most models start to become distracted". Suggested fixes: `--edit-format whole`, architect mode, fewer files. [doc: [edit errors](https://aider.chat/docs/troubleshooting/edit-errors.html)]

## Others looked at briefly

- **Goose** ([aaif-goose/goose](https://github.com/aaif-goose/goose), Apache-2.0, active). `goose run -t` or `--recipe` runs headless with JSON output; it has a "tool shim" that uses a second local model to interpret tool calls for models that lack them. Its documented macOS Seatbelt sandbox is for the Desktop app's backend; whether it covers the CLI, and how approval modes behave headless, are [unverified]. [doc: [running tasks](https://goose-docs.ai/docs/guides/running-tasks/), [sandbox](https://goose-docs.ai/docs/guides/sandbox), [tool shim](https://goose-docs.ai/docs/guides/tool-shim)]
- **Crush** ([charmbracelet/crush](https://github.com/charmbracelet/crush), FSL-1.1-MIT, active). Discovers local models from Ollama, LM Studio and llama.cpp; tool permissions and `--yolo`; no sandbox statement; a non-interactive mode was not confirmed. [doc: README]
- **Pi** ([earendil-works/pi](https://github.com/earendil-works/pi), MIT, active). Minimal harness with print, JSON and RPC modes. Its permission model and local-provider setup were not read. [unverified]
- **Cline, OpenHands, Gemini CLI, Continue**: active repos, not investigated. **Roo Code** is archived (2026-05).

## Shortlist and why

1. **Qwen Code.** It meets the endpoint as stated (OpenAI chat completions), its prompts and tool format target the same open-weights models the map already names for local work, it can sandbox itself on macOS without extra software, and its budgets turn a runaway loop into a distinct exit code the orchestrator can act on.
2. **Codex CLI.** Its lockdown needs the least work: `codex exec --sandbox workspace-write` already means no network, writes only in the workspace, and no changes to `.git`. The cost is the Responses API requirement and no documented loop budget.

OpenCode stays in reserve because every guarantee would rest on `sandbox-runtime` (beta) or a VM. Claude Code stays for cloud-authorized tickets.

**What the trial should measure** [suggestion]: the same three or four real website tickets on each harness with the same model and a 64k context; whether `scripts/check.sh` runs inside the sandbox; a lockdown test on paths that were not explicitly denied (home directory, SSH keys, another repo, an outside host); and tokens and wall time per ticket.

## Not verified

- Any harness actually completing a ticket on a 32 GB-class local model.
- Chromium and a local preview server inside each macOS sandbox.
- Qwen Code: what the restrictive profiles allow, localhost access under network-closed profiles, shell rule syntax, headless behavior of non-yolo approval modes.
- Codex CLI: behavior when approval is needed under `never`; Responses API support in servers other than Ollama and LM Studio; any turn cap.
- OpenCode V2: how `run` treats a prompt without `--auto`; whether the GitHub commands survived V1.
- Claude Code: the smallest context it accepts through `CLAUDE_CODE_MAX_CONTEXT_TOKENS` (the auto-compact setting has a 100k minimum), and how its large system prompt fits a 64k window.
- Goose CLI sandbox, Crush headless mode, Pi permissions.
