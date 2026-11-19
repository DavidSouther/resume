#!/usr/bin/env python3
"""By default, find airborne cars within s feet of another for more than 1 second.
(A run may tolerate up to --gap consecutive missed ticks. z is altitude above the local surface;
the globe unwrapped to a plane changes nothing here except at the wraparound seam, which is ignored.)

Input lines are `VIN,timestamp_ms,x,y,z`, one per car every 10 ms. Every stage reads stdin
and writes stdout, so each runs under Hadoop Streaming or in a local `sort` pipe.

Stages (see README.md):
  map    airborne points -> `ts:cell<TAB>H|G<TAB>vin<TAB>x<TAB>y<TAB>z` (home and ghost points)
  cell   per (ts, cell): sort by x, sweep, emit `vinA,vinB<TAB>ts` for pairs within s
  runs   per pair: find a gap-tolerant run longer than 1 s, emit `vinA,vinB<TAB>start<TAB>end`
  vins   pairs -> one VIN per line
  distinct  sorted VINs -> unique VINs
  brute  O(N^2) per-timestamp reference, input to output in one process
  gen    synthetic dataset with planted violators
"""
import argparse
import itertools
import math
import random
import sys

TICK_MS = 10


def pack(cx, cy, cz):
    # Zigzag and Cantor pairing give every integer coordinate triple a unique ID.
    def zigzag(n):
        return 2 * n if n >= 0 else -2 * n - 1

    def pair(a, b):
        return (a + b) * (a + b + 1) // 2 + b

    return pair(pair(zigzag(cx), zigzag(cy)), zigzag(cz))


def home_cell(x, y, z, d):
    return pack(math.floor(x / d), math.floor(y / d), math.floor(z / d))


def axis_offsets(v, d, s):
    """Cell offsets along one axis that a point's s-neighbourhood reaches."""
    frac = v - math.floor(v / d) * d
    offs = [0]
    if frac < s:
        offs.append(-1)
    if frac >= d - s:
        offs.append(1)
    return offs


def targets(x, y, z, d, s):
    """Yield (packed_cell, is_home) for every cell that must see this point."""
    cx, cy, cz = math.floor(x / d), math.floor(y / d), math.floor(z / d)
    for ox, oy, oz in itertools.product(axis_offsets(x, d, s), axis_offsets(y, d, s), axis_offsets(z, d, s)):
        yield pack(cx + ox, cy + oy, cz + oz), (ox == 0 and oy == 0 and oz == 0)


def counts(za, zb, mode):
    """Whether a close pair at these altitudes counts. both: assignment rule (z > 0 for each car).
    any: at least one car in the air, so a car near a landed or parked one still counts.
    off: every pair counts."""
    if mode == "both":
        return za > 0 and zb > 0
    if mode == "any":
        return za > 0 or zb > 0
    return True


def sampled(ts, stride):
    return (ts // TICK_MS) % stride == 0


def run_threshold(stride, min_ms):
    """Span a sampled run must exceed. Exact at stride 1, a superset (candidates) above it."""
    return min_ms - 2 * (stride * TICK_MS - TICK_MS)


def find_run(times, stride, min_ms, gap=0):
    """Return the first run exceeding the stride-adjusted threshold, or None.

    times must be nonempty.

    A run may skip up to `gap` consecutive missed ticks (dropouts) between close samples.
    """
    # A dropout of `gap` ticks hides at most ceil(gap/stride) sampled ticks in a row.
    step = (-(-gap // stride) + 1) * stride * TICK_MS
    limit = run_threshold(stride, min_ms)
    ts = sorted(set(times))
    start = prev = ts[0]
    for t in ts[1:] + [None]:
        if t is None or t - prev > step:
            if prev - start > limit:
                return start, prev
            if t is not None:
                start = t
        if t is not None:
            prev = t
    return None


def stage_map(args):
    d = args.k * args.s
    vins = None
    if args.vins:
        with open(args.vins) as f:
            vins = {line.strip() for line in f if line.strip()}
    out = sys.stdout
    for line in sys.stdin:
        parts = line.rstrip("\n").split(",")
        if len(parts) != 5:
            continue
        vin, ts, x, y, z = parts
        try:
            ts, x, y, z = int(ts), float(x), float(y), float(z)
        except ValueError:
            continue
        if (z <= 0 and args.airborne == "both") or not sampled(ts, args.stride) or (vins is not None and vin not in vins):
            continue
        for cell, home in targets(x, y, z, d, args.s):
            out.write(f"{ts}:{cell}\t{'H' if home else 'G'}\t{vin}\t{x!r}\t{y!r}\t{z!r}\n")


def cell_pairs(points, d, s, cell, airborne="both"):
    """Sweep points of one cell. points: (x, y, z, vin, is_home). Yields (vinA, vinB)."""
    points.sort()
    s2 = s * s
    n = len(points)
    for i in range(n):
        xi, yi, zi, vi, hi = points[i]
        for j in range(i + 1, n):
            xj, yj, zj, vj, hj = points[j]
            if xj - xi > s:
                break
            if not hi and not hj:
                continue
            if (xj - xi) ** 2 + (yj - yi) ** 2 + (zj - zi) ** 2 > s2:
                continue
            if not counts(zi, zj, airborne):
                continue
            if hi != hj:
                ghost = points[j] if hi else points[i]
                # The pair appears in both home cells; only the smaller cell reports it.
                if cell >= home_cell(ghost[0], ghost[1], ghost[2], d):
                    continue
            yield (vi, vj) if vi < vj else (vj, vi)


def stage_cell(args):
    d = args.k * args.s
    out = sys.stdout

    def flush(key, points):
        ts, cell = key.split(":")
        for a, b in cell_pairs(points, d, args.s, int(cell), args.airborne):
            out.write(f"{a},{b}\t{ts}\n")

    key, points = None, []
    for line in sys.stdin:
        k, flag, vin, x, y, z = line.rstrip("\n").split("\t")
        if k != key:
            if key is not None:
                flush(key, points)
            key, points = k, []
        points.append((float(x), float(y), float(z), vin, flag == "H"))
    if key is not None:
        flush(key, points)


def stage_runs(args):
    out = sys.stdout

    def flush(pair, times):
        found = find_run(times, args.stride, args.min_ms, args.gap)
        if found:
            out.write(f"{pair}\t{found[0]}\t{found[1]}\n")

    pair, times = None, []
    for line in sys.stdin:
        p, ts = line.rstrip("\n").split("\t")[:2]
        if p != pair:
            if pair is not None:
                flush(pair, times)
            pair, times = p, []
        times.append(int(ts))
    if pair is not None:
        flush(pair, times)


def stage_vins(args):
    for line in sys.stdin:
        for vin in line.split("\t")[0].split(","):
            sys.stdout.write(vin + "\n")


def stage_distinct(args):
    last = None
    for line in sys.stdin:
        vin = line.strip()
        if vin and vin != last:
            sys.stdout.write(vin + "\n")
            last = vin


def stage_brute(args):
    by_ts = {}
    for line in sys.stdin:
        vin, ts, x, y, z = line.rstrip("\n").split(",")
        if float(z) > 0 or args.airborne != "both":
            by_ts.setdefault(int(ts), []).append((vin, float(x), float(y), float(z)))
    pair_times = {}
    s2 = args.s * args.s
    for ts, pts in by_ts.items():
        for (va, xa, ya, za), (vb, xb, yb, zb) in itertools.combinations(pts, 2):
            if (xa - xb) ** 2 + (ya - yb) ** 2 + (za - zb) ** 2 <= s2 and counts(za, zb, args.airborne):
                pair_times.setdefault((min(va, vb), max(va, vb)), []).append(ts)
    vins = set()
    for (a, b), times in pair_times.items():
        if find_run(times, 1, args.min_ms, args.gap):
            vins.update((a, b))
    for vin in sorted(vins):
        sys.stdout.write(vin + "\n")


# Planted outcomes assume default s, k, gap, and airborne settings (200 ticks at 10 ms).
PLANTED_VIOLATORS = {"P1a", "P1b", "P4a", "P4b", "P5a", "P5b", "P8a", "P8b", "P8c", "P9a", "P9b", "P10a", "P10b", "P7a", "P7b"}


def stage_gen(args):
    rng = random.Random(args.seed)
    box = args.box
    ticks, t0 = 200, 1_000_000
    rows = []

    def emit(vin, tick, x, y, z):
        rows.append((t0 + tick * TICK_MS, vin, x, y, z))

    for tick in range(ticks):
        # P1: 5 ft apart for 1.5 s, then split. Violator.
        sep = 5.0 if tick <= 150 else 300.0
        emit("P1a", tick, 100.0, 100.0, 500.0)
        emit("P1b", tick, 100.0 + sep, 100.0, 500.0)
        # P2: close for only 0.5 s. Not a violator.
        sep = 5.0 if tick < 50 else 300.0
        emit("P2a", tick, 400.0, 100.0, 500.0)
        emit("P2b", tick, 400.0 + sep, 100.0, 500.0)
        # P3: parked together on the ground. Not a violator.
        emit("P3a", tick, 700.0, 100.0, 0.0)
        emit("P3b", tick, 702.0, 100.0, 0.0)
        # P4: 1 ft apart straddling a cell edge (x = 50k). Violator.
        emit("P4a", tick, 849.5, 100.0, 500.0)
        emit("P4b", tick, 850.5, 100.0, 500.0)
        # P5: exactly 10 ft apart. Violator (distance <= 10 counts).
        emit("P5a", tick, 1000.0, 100.0, 500.0)
        emit("P5b", tick, 1010.0, 100.0, 500.0)
        # P6: 10.5 ft apart. Not a violator.
        emit("P6a", tick, 1200.0, 100.0, 500.0)
        emit("P6b", tick, 1210.5, 100.0, 500.0)
        # P7: close with a one-tick dropout (tolerated by --gap 2). Violator.
        sep = 300.0 if tick == 80 else 5.0
        if tick > 160:
            sep = 300.0
        emit("P7a", tick, 1400.0, 100.0, 500.0)
        emit("P7b", tick, 1400.0 + sep, 100.0, 500.0)
        # P11: close with a ten-tick dropout, each side under 1 s. Run is broken. Not a violator.
        sep = 300.0 if 70 <= tick < 80 else 5.0
        if tick > 140:
            sep = 300.0
        emit("P11a", tick, 1600.0, 100.0, 500.0)
        emit("P11b", tick, 1600.0 + sep, 100.0, 500.0)
        # P12: one car on the ground, one flying 4 ft above it. Violator only with --airborne any/off.
        emit("P12a", tick, 1800.0, 100.0, 0.0)
        emit("P12b", tick, 1803.0, 100.0, 4.0)
        # P8: a tight triple. All three are violators.
        emit("P8a", tick, 100.0, 400.0, 500.0)
        emit("P8b", tick, 106.0, 400.0, 500.0)
        emit("P8c", tick, 103.0, 405.0, 500.0)
        # P9: pair flying at 500 mph (7.33 ft per tick), crossing about 30 cells. Violator.
        emit("P9a", tick, 100.0 + 7.33 * tick, 700.0, 800.0)
        emit("P9b", tick, 104.0 + 7.33 * tick, 703.0, 800.0)
        # P10: close along a cell corner (x, y, z all near an edge). Violator.
        emit("P10a", tick, 1499.5, 1499.5, 499.5)
        emit("P10b", tick, 1500.5, 1500.5, 500.5)
    for i in range(args.cars):
        x, y, z = (rng.uniform(0, box), rng.uniform(0, box) + 1000, rng.uniform(-0.03 * box, box))
        vx, vy, vz = (rng.uniform(-7.33, 7.33) for _ in range(3))
        for tick in range(args.ticks):
            emit(f"R{i:06d}", tick, x + vx * tick, y + vy * tick, z + vz * tick)
    rng.shuffle(rows)
    for ts, vin, x, y, z in rows:
        sys.stdout.write(f"{vin},{ts},{x:.3f},{y:.3f},{z:.3f}\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stage", choices=["map", "cell", "runs", "vins", "distinct", "brute", "gen"])
    ap.add_argument("--s", type=float, default=10.0, help="minimum separation in feet")
    ap.add_argument("--k", type=int, default=5, help="cell side is k*s (k >= 2)")
    ap.add_argument("--stride", type=int, default=1, help="process every Nth 10 ms tick (candidates when > 1)")
    ap.add_argument("--min-ms", type=int, default=1000, help="duration a run must exceed")
    ap.add_argument(
        "--airborne", choices=["both", "any", "off"], default="both",
        help="which pairs count: both cars z > 0 (assignment), at least one z > 0, or all (z = altitude above local surface)",
    )
    ap.add_argument("--gap", type=int, default=2, help="max consecutive missed ticks tolerated inside a run")
    ap.add_argument("--vins", help="map: only keep these VINs (verification pass)")
    ap.add_argument("--cars", type=int, default=300, help="gen: random background cars")
    ap.add_argument("--box", type=float, default=3000.0, help="gen: side of the cube random cars fly in (smaller is denser)")
    ap.add_argument("--ticks", type=int, default=200, help="gen: ticks of random cars")
    ap.add_argument("--seed", type=int, default=7, help="gen: random seed")
    args = ap.parse_args()
    if args.k < 2:
        ap.error("--k must be at least 2")
    if args.stride < 1 or args.gap < 0 or args.min_ms < 0:
        ap.error("--stride must be positive; --gap and --min-ms must be nonnegative")
    if args.stride > 1 and (args.gap > 0 or args.stride * TICK_MS > args.min_ms + TICK_MS):
        print("warning: processing every tick because the requested sampling can miss violators", file=sys.stderr)
        args.stride = 1
    globals()["stage_" + args.stage](args)


if __name__ == "__main__":
    main()
