#!/usr/bin/env python3
"""Tests for Step 7 of the manifold-paper plan: the scored transfer-test

protocol in design.md's User Journey section, and manifold.yaml's judge
extension for ledger completeness.

Run: python3 test_transfer_test_protocol.py
"""
import unittest
from pathlib import Path

from paper_test_helpers import HERE

DESIGN_MD = HERE.parents[3] / ".ailly" / "developer" / "2026-06-25-C-manifold" / "design.md"
MANIFOLD_YAML = HERE.parent / "manifold.yaml"


class TransferTestProtocolStep7Test(unittest.TestCase):
    def test_design_md_names_a_specific_held_out_workflow(self):
        text = DESIGN_MD.read_text(encoding="utf-8")
        self.assertIn("Reflexion", text)
        # It must be distinguished from Section 5's seven analyses, not just named.
        self.assertIn("absent from the paper's Section 5", text)

    def test_design_md_has_the_five_field_rubric(self):
        text = DESIGN_MD.read_text(encoding="utf-8").lower()
        for field in [
            "impulse",
            "target region",
            "signal",
            "referent validation",
            "evidence",
        ]:
            self.assertIn(field, text)

    def test_design_md_has_a_blind_prediction_step(self):
        text = DESIGN_MD.read_text(encoding="utf-8").lower()
        self.assertIn("before seeing", text)
        self.assertIn("blind", text)

    def test_design_md_has_a_quantified_pass_criterion(self):
        text = DESIGN_MD.read_text(encoding="utf-8").lower()
        self.assertIn("majority", text)
        self.assertIn("prompt-engineering-only baseline", text)

    def test_design_md_preserves_the_hand_picked_caveat_verbatim(self):
        text = " ".join(DESIGN_MD.read_text(encoding="utf-8").split())
        self.assertIn(
            "hand-picked examples that show what fails, not how often", text
        )

    def test_design_md_does_not_invent_a_frequency_claim(self):
        text = DESIGN_MD.read_text(encoding="utf-8")
        self.assertIn("not base-rate frequency", text)

    def test_manifold_yaml_judge_checks_ledger_completeness(self):
        text = MANIFOLD_YAML.read_text(encoding="utf-8")
        self.assertIn("Does not support", text)
        self.assertIn("Risk if wrong", text)


if __name__ == "__main__":
    unittest.main()
