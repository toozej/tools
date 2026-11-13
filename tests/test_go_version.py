"""Test Go version updates with isolated files and a simulated release service."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


class GoVersionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        source = Path(__file__).resolve().parents[1]
        shutil.copyfile(source / "Makefile", self.root / "Makefile")
        workflow = self.root / ".github/workflows/ci.yaml"
        workflow.parent.mkdir(parents=True)
        shutil.copyfile(source / ".github/workflows/ci.yaml", workflow)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.releases = self.root / "releases.json"
        self.releases.write_text(
            json.dumps(
                [
                    {"version": "go1.28rc1", "stable": False},
                    {"version": "go1.27.5", "stable": True},
                ]
            )
        )
        self.write_command("curl", 'cat "$RELEASES"\n')
        self.write_command(
            "go",
            'test "$1" = mod && test "$2" = edit || exit 1\nsed -i "s/^go .*/go ${3#-go=}/" "$4"\n',
        )
        for app in ("first", "second"):
            directory = self.root / "apps" / app
            directory.mkdir(parents=True)
            (directory / "go.mod").write_text(f"module example.com/{app}\n\ngo 1.27.4\n")
            (directory / "Dockerfile").write_text(
                "FROM golang:1.27.4-trixie AS builder\nFROM debian:trixie-slim\n"
            )

    def write_command(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/sh\nset -eu\n" + body)
        path.chmod(0o755)

    def update(self, *arguments):
        environment = os.environ.copy()
        environment["PATH"] = str(self.bin) + os.pathsep + environment["PATH"]
        environment["RELEASES"] = str(self.releases)
        return subprocess.run(
            ["make", "update-go-version", *arguments],
            cwd=self.root,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )

    def assert_app_version(self, app, version):
        directory = self.root / "apps" / app
        self.assertIn(f"\ngo {version}\n", (directory / "go.mod").read_text())
        self.assertEqual(
            (directory / "Dockerfile").read_text(),
            f"FROM golang:{version}-trixie AS builder\nFROM debian:trixie-slim\n",
        )

    def assert_shared_version(self, version):
        self.assertIn(f"GO_VERSION := {version}\n", (self.root / "Makefile").read_text())
        workflow = (self.root / ".github/workflows/ci.yaml").read_text()
        pins = [line.strip() for line in workflow.splitlines() if "go-version:" in line]
        self.assertEqual(pins, [f"go-version: '{version}'"] * 3)

    def snapshot(self):
        return {path: path.read_bytes() for path in self.root.rglob("*") if path.is_file()}

    def test_updates_all_modules_images_and_shared_toolchains(self):
        result = self.update()
        self.assertEqual(result.returncode, 0, result.stderr)
        for app in ("first", "second"):
            self.assert_app_version(app, "1.27.5")
        self.assert_shared_version("1.27.5")

    def test_app_updates_only_selected_app_and_shared_toolchains(self):
        result = self.update("APP=first")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_app_version("first", "1.27.5")
        self.assert_app_version("second", "1.27.4")
        self.assert_shared_version("1.27.5")

    def test_rejects_invalid_version_without_changing_files(self):
        self.releases.write_text('[{"version": "go1.27.invalid", "stable": true}]')
        before = self.snapshot()
        result = self.update()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Invalid Go release version", result.stderr)
        self.assertEqual(self.snapshot(), before)

    def test_network_failure_does_not_change_files(self):
        self.write_command("curl", "exit 22\n")
        before = self.snapshot()
        self.assertNotEqual(self.update().returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_module_failure_stops_before_updating_toolchain_pins(self):
        self.write_command("go", "exit 1\n")
        before = self.snapshot()
        self.assertNotEqual(self.update().returncode, 0)
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
