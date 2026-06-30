#!/usr/bin/env python3
"""
Build a stage fingerprint for stage-signatures.json.

The battleResults file has no explicit stage id; the stage is encoded implicitly
in the enemy definition. This tool finds a byte run that is:
  - identical across ALL provided same-stage samples (any team, win or loss), and
  - absent from every provided other-stage sample.

Usage:
  python make-signature.py --same file_A.bin file_B.bin [file_C.bin ...] \
                           [--other file_X.bin file_Y.bin ...] \
                           [--dungeon "Ice Golem's Peak"] [--stage 9] \
                           [--difficulty Normal] [--minlen 32]

Give it 2+ same-stage dumps (ideally one victory + one defeat with different
teams). The more 'other' (different-stage) dumps you pass, the more confident the
distinctiveness check. Prints a ready-to-paste JSON signature entry.
"""
import argparse, json, sys

def read(p):
    with open(p, "rb") as f: return f.read()

def common_runs(a, b, k):
    """All maximal runs (>=k) common to a and b, as (offset_in_a, length)."""
    idx = {}
    for i in range(len(b) - k + 1):
        idx.setdefault(b[i:i+k], []).append(i)
    runs, i = [], 0
    while i <= len(a) - k:
        g = a[i:i+k]
        if g in idx:
            j = idx[g][0]
            L = k
            while i+L < len(a) and j+L < len(b) and a[i+L] == b[j+L]:
                L += 1
            runs.append((i, L))
            i += L
        else:
            i += 1
    return runs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--same", nargs="+", required=True)
    ap.add_argument("--other", nargs="*", default=[])
    ap.add_argument("--dungeon", default="")
    ap.add_argument("--stage", type=int, default=0)
    ap.add_argument("--difficulty", default="")
    ap.add_argument("--minlen", type=int, default=32)
    a = ap.parse_args()

    same = [read(p) for p in a.same]
    other = [read(p) for p in a.other]

    # Candidate runs common to same[0] and same[1].
    cands = common_runs(same[0], same[1], a.minlen)
    # Keep only those present in ALL same-samples and NO other-sample.
    good = []
    for off, L in cands:
        seq = same[0][off:off+L]
        if all(seq in s for s in same[2:]) and not any(seq in o for o in other):
            good.append(seq)

    if not good:
        print("No distinctive run found. Try lowering --minlen or adding samples.",
              file=sys.stderr)
        sys.exit(1)

    good.sort(key=len, reverse=True)
    best = good[0]
    label = f"{a.dungeon} Stage {a.stage}" + (f" ({a.difficulty})" if a.difficulty else "")
    entry = {
        "dungeon": a.dungeon,
        "stage": a.stage,
        "difficulty": a.difficulty,
        "label": label.strip(),
        "signatureHex": best.hex(),
    }
    print(f"# distinctive runs found: {len(good)}; using longest ({len(best)} bytes)")
    print(json.dumps(entry, indent=2))

if __name__ == "__main__":
    main()
