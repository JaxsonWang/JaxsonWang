#!/usr/bin/env python3
"""Compile Surge-style rule lists into validated Mihomo MRS artifacts."""

from __future__ import annotations

import argparse
import filecmp
import hashlib
import ipaddress
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


DOMAIN_TYPES = {"DOMAIN", "DOMAIN-SUFFIX"}
IP_TYPES = {"IP-CIDR", "IP-CIDR6"}
MANAGED_BEHAVIORS = ("domain", "ipcidr")


class BuildError(RuntimeError):
    """Raised when source rules cannot be converted safely."""


@dataclass
class ParsedSource:
    source: str
    sha256: str
    domain: list[str] = field(default_factory=list)
    ipcidr: list[str] = field(default_factory=list)
    ipcidr_no_resolve: bool | None = None


def normalize_classical_rule(rule: str) -> str:
    fields = [field.strip() for field in rule.split(",")]
    if not fields or not fields[0]:
        raise BuildError("Rule type is empty")
    fields[0] = fields[0].upper()
    return ",".join(fields)


def parse_domain(value: str, *, source: str, line_number: int) -> str:
    domain = value.strip().lower().rstrip(".")
    if not domain:
        raise BuildError(f"{source}:{line_number}: domain is empty")
    if any(character in domain for character in ("/", "*", "+")) or any(
        character.isspace() for character in domain
    ):
        raise BuildError(f"{source}:{line_number}: invalid domain {value!r}")
    try:
        return domain.encode("idna").decode("ascii")
    except UnicodeError as error:
        raise BuildError(f"{source}:{line_number}: invalid domain {value!r}") from error


def parse_ip_network(
    rule_type: str, value: str, *, source: str, line_number: int
) -> str:
    try:
        network = ipaddress.ip_network(value.strip(), strict=False)
    except ValueError as error:
        raise BuildError(
            f"{source}:{line_number}: invalid network {value!r}"
        ) from error

    expected_version = 6 if rule_type == "IP-CIDR6" else 4
    if network.version != expected_version:
        raise BuildError(
            f"{source}:{line_number}: {rule_type} requires IPv{expected_version}, got {value!r}"
        )
    return network.with_prefixlen


def append_unique(values: list[str], seen: set[str], value: str) -> None:
    if value not in seen:
        values.append(value)
        seen.add(value)


def parse_rules_file(path: Path, source_label: str) -> ParsedSource:
    try:
        raw = path.read_bytes()
        text = raw.decode("utf-8-sig")
    except (OSError, UnicodeDecodeError) as error:
        raise BuildError(f"Cannot read {source_label}: {error}") from error

    parsed = ParsedSource(source=source_label, sha256=hashlib.sha256(raw).hexdigest())
    seen_domain: set[str] = set()
    seen_ipcidr: set[str] = set()

    for line_number, original_line in enumerate(text.splitlines(), start=1):
        content = original_line.partition("#")[0].strip()
        if not content:
            continue

        normalized = normalize_classical_rule(content)
        fields = normalized.split(",")
        rule_type = fields[0]

        if rule_type in DOMAIN_TYPES:
            if len(fields) != 2:
                raise BuildError(
                    f"{source_label}:{line_number}: {rule_type} requires exactly one value"
                )
            domain = parse_domain(
                fields[1], source=source_label, line_number=line_number
            )
            payload = f"+.{domain}" if rule_type == "DOMAIN-SUFFIX" else domain
            append_unique(parsed.domain, seen_domain, payload)
            continue

        if rule_type in IP_TYPES:
            if len(fields) not in (2, 3) or (
                len(fields) == 3 and fields[2].lower() != "no-resolve"
            ):
                raise BuildError(
                    f"{source_label}:{line_number}: {rule_type} accepts only an optional no-resolve flag"
                )
            no_resolve = len(fields) == 3
            if parsed.ipcidr_no_resolve is None:
                parsed.ipcidr_no_resolve = no_resolve
            elif parsed.ipcidr_no_resolve != no_resolve:
                raise BuildError(
                    f"{source_label}:{line_number}: all IP rules in one MRS source must "
                    "use no-resolve consistently"
                )
            network = parse_ip_network(
                rule_type, fields[1], source=source_label, line_number=line_number
            )
            append_unique(parsed.ipcidr, seen_ipcidr, network)
            continue

        if rule_type == "DOMAIN-KEYWORD":
            raise BuildError(
                f"{source_label}:{line_number}: DOMAIN-KEYWORD cannot be represented by MRS; "
                "replace it with reviewed DOMAIN or DOMAIN-SUFFIX rules"
            )

        raise BuildError(
            f"{source_label}:{line_number}: unsupported rule type {rule_type!r}"
        )

    return parsed


def resolve_executable(value: str) -> Path:
    candidate = Path(value).expanduser()
    if candidate.parent != Path(".") or candidate.is_absolute():
        executable = candidate.resolve()
        if not executable.is_file() or not os.access(executable, os.X_OK):
            raise BuildError(f"Mihomo executable is not runnable: {candidate}")
        return executable

    resolved = shutil.which(value)
    if resolved is None:
        raise BuildError(f"Mihomo executable was not found on PATH: {value}")
    return Path(resolved).resolve()


def run_mihomo(mihomo: Path, arguments: Iterable[object]) -> None:
    command = [str(mihomo), *(str(argument) for argument in arguments)]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode == 0:
        return
    details = "\n".join(
        output.strip() for output in (result.stdout, result.stderr) if output.strip()
    )
    suffix = f"\n{details}" if details else ""
    raise BuildError(
        f"Mihomo command failed ({result.returncode}): {' '.join(command)}{suffix}"
    )


def compile_mrs(
    mihomo: Path,
    behavior: str,
    rules: list[str],
    artifact: Path,
    work_directory: Path,
) -> int:
    artifact.parent.mkdir(parents=True, exist_ok=True)
    input_file = work_directory / "input" / behavior / artifact.with_suffix(".txt").name
    verified_file = (
        work_directory / "verified" / behavior / artifact.with_suffix(".txt").name
    )
    input_file.parent.mkdir(parents=True, exist_ok=True)
    verified_file.parent.mkdir(parents=True, exist_ok=True)
    input_file.write_text("\n".join(rules) + "\n", encoding="utf-8")

    run_mihomo(mihomo, ("convert-ruleset", behavior, "text", input_file, artifact))
    if not artifact.is_file() or artifact.stat().st_size == 0:
        raise BuildError(f"Mihomo produced an empty artifact: {artifact}")

    run_mihomo(mihomo, ("convert-ruleset", behavior, "mrs", artifact, verified_file))
    verified_rules = [
        line.strip()
        for line in verified_file.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not verified_rules:
        raise BuildError(f"Mihomo could not read rules back from {artifact}")
    return len(verified_rules)


def output_relative_path(source_relative: Path, behavior: str) -> Path:
    return Path(behavior) / source_relative.with_suffix(".mrs")


def write_manifest(staging: Path, sources: list[dict[str, object]]) -> None:
    manifest = {
        "schemaVersion": 1,
        "format": "MRSv1",
        "generator": ".github/scripts/build_mrs.py",
        "sources": sources,
    }
    (staging / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def files_are_equal(first: Path, second: Path) -> bool:
    return first.is_file() and filecmp.cmp(first, second, shallow=False)


def remove_empty_directories(root: Path) -> None:
    if not root.is_dir():
        return
    for directory in sorted(
        (path for path in root.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    ):
        if not any(directory.iterdir()):
            directory.rmdir()


def synchronize_outputs(staging: Path, output_directory: Path) -> None:
    output_directory.mkdir(parents=True, exist_ok=True)
    expected = {
        artifact.relative_to(staging)
        for behavior in MANAGED_BEHAVIORS
        for artifact in (staging / behavior).rglob("*.mrs")
        if (staging / behavior).is_dir()
    }

    for behavior in MANAGED_BEHAVIORS:
        managed_root = output_directory / behavior
        if managed_root.is_dir():
            for artifact in managed_root.rglob("*.mrs"):
                if artifact.relative_to(output_directory) not in expected:
                    artifact.unlink()

    for relative_path in sorted(expected):
        staged_artifact = staging / relative_path
        destination = output_directory / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not files_are_equal(destination, staged_artifact):
            os.replace(staged_artifact, destination)

    staged_manifest = staging / "manifest.json"
    destination_manifest = output_directory / "manifest.json"
    if not files_are_equal(destination_manifest, staged_manifest):
        os.replace(staged_manifest, destination_manifest)

    for behavior in MANAGED_BEHAVIORS:
        remove_empty_directories(output_directory / behavior)


def ensure_regular_source(path: Path, rules_directory: Path) -> None:
    if path.is_symlink():
        raise BuildError(f"Rule list symlinks are not supported: {path}")
    try:
        path.resolve().relative_to(rules_directory)
    except ValueError as error:
        raise BuildError(f"Rule list escapes the source directory: {path}") from error
    if not path.is_file():
        raise BuildError(f"Rule list is not a regular file: {path}")


def build(
    rules_directory: Path,
    output_directory: Path,
    mihomo: Path,
    repository_root: Path,
) -> None:
    if not rules_directory.is_dir():
        raise BuildError(f"Rules directory does not exist: {rules_directory}")

    source_files = sorted(rules_directory.rglob("*.list"))
    parsed_sources: list[tuple[Path, ParsedSource]] = []

    for source_file in source_files:
        ensure_regular_source(source_file, rules_directory)
        source_relative = source_file.relative_to(rules_directory)
        source_label = (
            rules_directory.relative_to(repository_root) / source_relative
        ).as_posix()
        parsed_sources.append(
            (source_relative, parse_rules_file(source_file, source_label))
        )

    output_directory.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(
        prefix=".mrs-build-", dir=output_directory.parent
    ) as temporary_directory:
        temporary_root = Path(temporary_directory)
        staging = temporary_root / "MSR"
        staging.mkdir()
        manifest_sources: list[dict[str, object]] = []

        for source_relative, parsed in parsed_sources:
            source_manifest: dict[str, object] = {
                "source": parsed.source,
                "sha256": parsed.sha256,
                "outputs": {},
            }
            outputs = source_manifest["outputs"]
            assert isinstance(outputs, dict)

            for behavior in MANAGED_BEHAVIORS:
                rules = getattr(parsed, behavior)
                if not rules:
                    continue
                relative_output = output_relative_path(source_relative, behavior)
                artifact = staging / relative_output
                compiled_rule_count = compile_mrs(
                    mihomo, behavior, rules, artifact, temporary_root
                )
                outputs[behavior] = {
                    "path": (
                        output_directory.relative_to(repository_root) / relative_output
                    ).as_posix(),
                    "sourceRuleCount": len(rules),
                    "compiledRuleCount": compiled_rule_count,
                    "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
                }
                if behavior == "ipcidr":
                    outputs[behavior]["ruleSetNoResolve"] = parsed.ipcidr_no_resolve
            manifest_sources.append(source_manifest)

        write_manifest(staging, manifest_sources)
        synchronize_outputs(staging, output_directory)

    artifact_count = sum(
        1
        for behavior in MANAGED_BEHAVIORS
        for _ in (output_directory / behavior).rglob("*.mrs")
        if (output_directory / behavior).is_dir()
    )
    print(
        f"Built and verified {artifact_count} MRS artifacts from {len(source_files)} source lists."
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rules-dir", default="Rules", help="Source list directory")
    parser.add_argument("--output-dir", default="MSR", help="Generated MRS directory")
    parser.add_argument(
        "--mihomo", default="mihomo", help="Path or command name for the Mihomo binary"
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    repository_root = Path.cwd().resolve()
    try:
        build(
            rules_directory=Path(arguments.rules_dir).resolve(),
            output_directory=Path(arguments.output_dir).resolve(),
            mihomo=resolve_executable(arguments.mihomo),
            repository_root=repository_root,
        )
    except (BuildError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
