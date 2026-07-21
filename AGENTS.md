# Repository Guidelines

## Repository scope

- This repository contains personal proxy-client rules, modules, and scripts for Mihomo, Surge, Loon, and Quantumult X.
- Keep changes narrowly scoped. Do not rewrite unrelated client configs or the WakaTime workflow while working on rule generation.
- `Rules/` is the source of truth for shared rule lists. `MSR/` contains generated Mihomo Rule Set artifacts and must not be edited by hand.

## MRS generation contract

- The binary format is named **MRS** (`.mrs`). The repository directory is named `MSR/` for compatibility with the established project layout.
- Run `.github/scripts/build_mrs.py` to transform every `Rules/**/*.list` file.
- A source file may contain both domain and IP rules. Generated files are therefore split by Mihomo behavior:
  - `DOMAIN` and `DOMAIN-SUFFIX` -> `MSR/domain/<relative-source-path>.mrs`
  - `IP-CIDR` and `IP-CIDR6` -> `MSR/ipcidr/<relative-source-path>.mrs`
- MRS does not store the classical `no-resolve` flag. All IP rules in one source list must agree on that flag; preserve the generated manifest's `ruleSetNoResolve` requirement when referencing the `ipcidr` provider from Mihomo rules.
- Mihomo MRS cannot represent classical `DOMAIN-KEYWORD` matching. Express intended scope with reviewed `DOMAIN` or `DOMAIN-SUFFIX` rules instead; the generator must fail on `DOMAIN-KEYWORD` rather than silently widening or dropping it.
- Never add a silent skip for a new rule type. Implement a lossless mapping or keep the build failure explicit.
- Deleted or renamed source lists must remove their stale generated `.mrs` files on the next build.

## Automation

- `.github/workflows/build-mrs.yml` runs when `Rules/**/*.list`, the generator, its tests, or the workflow changes, and it can also be started manually.
- The workflow downloads a pinned Mihomo release and verifies its SHA-256 digest. Do not switch it back to an unpinned `latest` release.
- Automation may stage and commit only `MSR/`; it must never commit unrelated workspace changes or credentials.
- When upgrading Mihomo, update both `MIHOMO_VERSION` and `MIHOMO_LINUX_AMD64_SHA256`, regenerate all artifacts, and verify the MRS round trip.

## Local validation

Run the focused tests first:

```bash
python3 -m unittest discover -s .github/scripts -p 'test_*.py'
```

Then build with a local Mihomo binary:

```bash
python3 .github/scripts/build_mrs.py --mihomo /path/to/mihomo
```

Review the complete generated diff:

```bash
git status --short
git diff --stat
git diff -- Rules MSR/manifest.json
```

The generator validates input syntax, compiles to a temporary tree, reads every result back through Mihomo, and only then updates `MSR/`. Preserve these fail-fast and atomic-update properties.
