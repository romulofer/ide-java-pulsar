# AGENTS.md

Guidance for AI agents working in this repository.

## Project

`ide-java-pulsar` is a **Pulsar** editor package (Pulsar is the community
successor to Atom) providing Java language support, powered by the
[Eclipse JDT language server](https://github.com/eclipse/eclipse.jdt.ls).
It is a fork of the archived [`atom/ide-java`](https://github.com/atom/ide-java)
package, being adapted to run on modern Pulsar.

Features: auto completion, code format, diagnostics, document outline, find
references, go to definition, hover, reference highlighting, signature help,
and Java code actions (auto-import / remove unused import).

### Layout

- **`lib/main.js`** — the package entry point. `JavaLanguageClient extends
  AutoLanguageClient` (from `atom-languageclient`). Handles:
  - Downloading / installing the Eclipse JDT LS on first use (`installServer`).
  - Detecting the Java runtime and version (`checkJavaVersion`, min Java 1.8).
  - Launching the server process (`startServerProcess`) with JVM args.
  - Status bar, busy signals, actionable notifications, config mapping.
- **`lib/providers/`** — Java code-action providers:
  - `actionProviderComposer.js` — composes multiple action providers.
  - `autoImportActionProvider.js`, `removeUnusedImportActionProvider.js`.
  - `index.js` — barrel export.
- **`lib/views/importSuggestionListView.js`** — select-list UI for import
  suggestions (uses `atom-select-list`).
- **`test/`** — Mocha + Chai tests run via `atom --test test`
  (`test/runner.js`, `test/helpers/`).
- **`package.json`** — declares consumed/provided Atom-IDE services, config
  schema, and dependencies (`atom-languageclient`, `atom-select-list`,
  `decompress`).

### Dependencies of note

- `atom-languageclient` `0.9.9` — the LSP client base class. Old; a Pulsar-era
  replacement may be required (see the migration spec).
- Eclipse JDT LS `0.39.0` — downloaded at runtime from `download.eclipse.org`.
  URL is hard-coded in `lib/main.js`.

## Conventions

- Code style matches the existing source: **2-space indent, no semicolons**
  in `lib/main.js`, single quotes, `const`/`let`. Match the file you are
  editing; do not reformat untouched code.
- Config keys live under the `ide-java.*` namespace and map to Eclipse JDT
  `java.*` preferences via `mapConfigurationObject`.
- All Atom API access goes through the global `atom` object
  (`atom.config`, `atom.notifications`, `atom.workspace`, `atom.packages`).

## Hard rules for agents

- **Do NOT author or co-author git commits.** Leave all commits to a human
  maintainer.
- **Do NOT push to any remote / upstream.** No `git push`, no PR creation.
- **Do NOT use em dashes** in prose you write into the repo.
- Make and edit files only; report what changed and let the maintainer commit.
- When changing runtime download URLs, server versions, or the JVM launch
  args, verify the server still installs and starts before considering the
  change done.
