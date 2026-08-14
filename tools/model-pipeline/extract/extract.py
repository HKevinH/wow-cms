#!/usr/bin/env python3
"""Pulls item art out of the client archives into a plain folder tree.

This is the one step that has to understand MPQ, and it is deliberately the
only one: everything downstream reads loose files, so the TypeScript pipeline
never links a decompressor and the web server never sees a game archive.

    pip install mpyq
    python extract.py --data "C:/WoW 5.4.8/Data" --out ./art

Then point the pipeline at the folder it wrote:

    node --experimental-strip-types ../src/cli.ts --art ./art --dbc <dbc dir> \
        --out ../../../apps/web/public/models --from-api http://localhost:3001

KNOWN LIMIT: a handful of the very last archives (wow-update-base-18280 and
above, and everything under Cache) store their hash and block tables
compressed, which mpyq does not decode, and they are skipped with a warning.
Everything those archives hold is art added in the final hotfixes of 5.4.8;
reaching it would mean using StormLib instead of mpyq.
"""
import argparse
import os
import re
import sys

try:
    from mpyq import MPQArchive
except ImportError:  # pragma: no cover - a missing dependency, not a code path
    sys.exit("mpyq is not installed. Run: pip install mpyq")

# Base archives in load order. Later archives win, which is how the client
# resolves a file present in more than one.
BASE_ARCHIVES = [
    "base-Win.MPQ",
    "misc.MPQ",
    "model.MPQ",
    "texture.MPQ",
    "itemtexture.MPQ",
    "alternate.MPQ",
    "expansion1.MPQ",
    "expansion2.MPQ",
    "expansion3.MPQ",
    "expansion4.MPQ",
]

WANTED_PREFIX = "item\\objectcomponents"
WANTED_SUFFIXES = (".m2", ".skin", ".blp")


def numbered(folder, pattern):
    """Archives matching `pattern`, ordered by the build number in the name."""
    if not os.path.isdir(folder):
        return []
    found = []
    for name in os.listdir(folder):
        match = re.match(pattern, name, re.I)
        if match:
            found.append((int(match.group(1)), os.path.join(folder, name)))
    return [path for _, path in sorted(found)]


def archive_paths(data_dir):
    """Base archives, then the update archives by ascending build.

    The wow-update-base archives are where the later patches put their art —
    Siege of Orgrimmar and the Pandaria PvP seasons live there, not in the
    base archives — so leaving them out silently loses about a fifth of the
    Pandaria models. They are listed last because later archives win.
    """
    found = [os.path.join(data_dir, name) for name in BASE_ARCHIVES]
    found += numbered(data_dir, r"wow-update-base-(\d+)\.MPQ$")
    found += numbered(os.path.join(data_dir, "Cache"), r"patch-base-(\d+)\.MPQ$")
    return [path for path in found if os.path.exists(path)]


def build_index(data_dir, verbose=True):
    """Maps a lowercased archive path to the archive and its original name."""
    index = {}
    unreadable = []
    for path in archive_paths(data_dir):
        name = os.path.basename(path)
        try:
            archive = MPQArchive(path, listfile=False)
            blob = archive.read_file("(listfile)")
        except Exception as exc:
            unreadable.append((name, str(exc)))
            continue
        if not blob:
            unreadable.append((name, "no listfile"))
            continue
        entries = blob.decode("utf-8", "replace").splitlines()
        for entry in entries:
            entry = entry.strip()
            if entry:
                index[entry.lower().replace("/", "\\")] = (path, entry)
        if verbose:
            print(f"  {name:<28} {len(entries):>7} entries")
    return index, unreadable


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="the client's Data folder")
    parser.add_argument("--out", required=True, help="folder to write the art tree into")
    parser.add_argument("--filter", default="",
                        help="only extract paths containing this substring")
    args = parser.parse_args()

    if not os.path.isdir(args.data):
        sys.exit(f"no such folder: {args.data}")

    print(f"indexing archives under {args.data}")
    index, unreadable = build_index(args.data)
    print(f"\n{len(index)} files indexed")
    for name, reason in unreadable:
        print(f"  unreadable: {name} ({reason})", file=sys.stderr)

    wanted = [
        key for key in index
        if key.startswith(WANTED_PREFIX)
        and key.endswith(WANTED_SUFFIXES)
        and args.filter.lower() in key
    ]
    print(f"{len(wanted)} item art files to extract\n")

    opened = {}
    written = 0
    skipped = 0
    for key in wanted:
        archive_path, real_name = index[key]
        archive = opened.get(archive_path)
        if archive is None:
            archive = opened[archive_path] = MPQArchive(archive_path, listfile=False)

        target = os.path.join(args.out, *real_name.split("\\"))
        if os.path.exists(target):
            skipped += 1
            continue
        try:
            blob = archive.read_file(real_name)
        except Exception as exc:
            print(f"  failed: {real_name} ({exc})", file=sys.stderr)
            continue
        if blob is None:
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "wb") as handle:
            handle.write(blob)
        written += 1
        if written % 2000 == 0:
            print(f"  {written} written...")

    print(f"\n{written} files written to {args.out}, {skipped} already present")


if __name__ == "__main__":
    main()
