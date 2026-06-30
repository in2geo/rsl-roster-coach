#!/usr/bin/env python3
"""
Collision audit for stage-signatures.json.

Checks every signature against every captured dump and flags:
  - any dump matched by MORE THAN ONE signature (collision / false positive)
  - (informational) dumps matched by none ("unknown")

A signature being "absent from all current dumps" does NOT make it globally
unique — a future dungeon can share generic enemy-wave boilerplate (this bit us
once: Spider's Den 1 leaked into Arcane Keep 6). Run this after adding/changing
any signature, and again whenever dumps from a NEW dungeon arrive. Any collision
means the colliding signature must be re-derived to also exclude the new dump.

Usage:
  python audit-signatures.py [path-to-stage-signatures.json] [path-to-battle-dumps]
Defaults assume the layout next to the built exe.
"""
import json, os, sys, glob

here = os.path.dirname(os.path.abspath(__file__))
sig_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "stage-signatures.json")
dump_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    here, "..", "bin", "Release", "net10.0-windows", "win-x64", "battle-dumps")

sigs = json.load(open(sig_path))["signatures"]
for s in sigs:
    s["_bytes"] = bytes.fromhex(s["signatureHex"])

dumps = {os.path.basename(p)[5:-4]: open(p, "rb").read()
         for p in glob.glob(os.path.join(dump_dir, "file_*.bin"))}

collisions = 0
for stamp, data in sorted(dumps.items()):
    hits = [s["label"] for s in sigs if s["_bytes"] in data]
    if len(hits) > 1:
        collisions += 1
        print(f"COLLISION  {stamp}: {hits}")
    elif not hits:
        print(f"unknown    {stamp}")
    else:
        print(f"ok         {stamp}: {hits[0]}")

print(f"\n{len(sigs)} signatures, {len(dumps)} dumps, {collisions} collision(s)")
sys.exit(1 if collisions else 0)
