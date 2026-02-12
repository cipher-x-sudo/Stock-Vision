#!/usr/bin/env python3
"""
Split a JSON array of prompt objects into separate JSON files.
Reads source path from CLI (or default Downloads path), prompts for output folder,
and writes one file per prompt: valentines-prompt-{scene_number}.json
"""

import json
import os
import sys
from pathlib import Path


def default_source_path() -> Path:
    """Default path to the big JSON in user's Downloads folder."""
    home = Path.home()
    if sys.platform == "win32":
        downloads = home / "Downloads"
    else:
        downloads = home / "Downloads"
    return downloads / "nano-banana-pro-prompts-valentines-day.json"


def main() -> None:
    # Source: CLI arg or default
    if len(sys.argv) > 1:
        source_path = Path(sys.argv[1])
    else:
        source_path = default_source_path()

    if not source_path.exists():
        print(f"Error: Source file not found: {source_path}", file=sys.stderr)
        sys.exit(1)

    # Ask for output folder
    output_dir_input = input("Enter output folder path: ").strip()
    if not output_dir_input:
        print("Error: Output folder path is required.", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(output_dir_input)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Read and parse
    with open(source_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("Error: Source JSON must be an array of prompt objects.", file=sys.stderr)
        sys.exit(1)

    # Write one file per item
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            print(f"Warning: Skipping non-object at index {i}.", file=sys.stderr)
            continue
        metadata = item.get("metadata") or {}
        scene_number = metadata.get("scene_number")
        if scene_number is None:
            scene_number = str(i + 1).zfill(2)
        else:
            scene_number = str(scene_number).zfill(2)
        filename = f"valentines-prompt-{scene_number}.json"
        out_path = output_dir / filename
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(item, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(data)} files to {output_dir}")


if __name__ == "__main__":
    main()
