from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_mrs import BuildError, parse_rules_file  # noqa: E402


class RuleParsingTests(unittest.TestCase):
    def test_mixed_rules_are_normalized_and_split(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "mixed.list"
            source.write_text(
                "\n".join(
                    (
                        "# comment",
                        "DOMAIN-SUFFIX, Example.COM",
                        "DOMAIN, api.example.com",
                        "IP-CIDR, 192.0.2.7/24, no-resolve",
                        "IP-CIDR6, 2001:db8::1/32, no-resolve",
                        "IP-CIDR, 192.0.2.0/24, no-resolve",
                    )
                ),
                encoding="utf-8",
            )
            parsed = parse_rules_file(source, "Rules/mixed.list")

            self.assertEqual(parsed.domain, ["+.example.com", "api.example.com"])
            self.assertEqual(parsed.ipcidr, ["192.0.2.0/24", "2001:db8::/32"])
            self.assertTrue(parsed.ipcidr_no_resolve)

    def test_domain_keyword_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "keyword.list"
            source.write_text("DOMAIN-KEYWORD,example\n", encoding="utf-8")

            with self.assertRaisesRegex(BuildError, "cannot be represented by MRS"):
                parse_rules_file(source, "Rules/keyword.list")

    def test_unknown_rule_type_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "unknown.list"
            source.write_text("PROCESS-NAME,example\n", encoding="utf-8")

            with self.assertRaisesRegex(BuildError, "unsupported rule type"):
                parse_rules_file(source, "Rules/unknown.list")

    def test_mixed_no_resolve_flags_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "mixed-flags.list"
            source.write_text(
                "IP-CIDR,192.0.2.0/24,no-resolve\nIP-CIDR,198.51.100.0/24\n",
                encoding="utf-8",
            )

            with self.assertRaisesRegex(BuildError, "use no-resolve consistently"):
                parse_rules_file(source, "Rules/mixed-flags.list")


if __name__ == "__main__":
    unittest.main()
