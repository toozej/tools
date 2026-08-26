"""Create the Fly homepage colophon without changing the checked-in source."""

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("exclude_file", type=Path)
    args = parser.parse_args()

    excluded = {
        line.strip()
        for line in args.exclude_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    data = json.loads(args.source.read_text(encoding="utf-8"))
    apps = data.get("apps")
    if not isinstance(apps, list):
        raise TypeError("colophon must contain an apps list")

    app_names = {app.get("name") for app in apps if isinstance(app, dict)}
    unknown = excluded - app_names
    if unknown:
        raise ValueError(f"excluded apps are absent from colophon: {sorted(unknown)}")

    data["apps"] = [app for app in apps if app.get("name") not in excluded]
    data["total_apps"] = len(data["apps"])
    args.destination.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
