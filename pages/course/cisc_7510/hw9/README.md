# HW9: Flying car proximity violators on Hadoop

Find every car that stays within s = 10 ft of another airborne car (z > 0) for longer than 1 second, from `VIN,timestamp_ms,x,y,z` records logged every 10 ms.

## Use

```sh
python3 test_flying.py                      # feature test: grid pipeline equals O(N^2) brute force
brew install hadoop                         # Hadoop 3.5.0, pulls openjdk@17
./setup_pseudo.sh start                     # 1-node HDFS + YARN, no ssh needed
python3 flying.py gen --cars 150 > cars.csv # small dataset with planted violators
./run_hadoop.sh hdfs cars.csv out           # 3 streaming jobs on the cluster
./run_hadoop.sh local cars.csv out          # same jobs, Hadoop local runner, no daemons
cat out/violators.txt
./setup_pseudo.sh stop
```

Files:

| File | Role |
|---|---|
| `flying.py` | Mapper, cell reducer, run reducer, distinct, brute-force reference, data generator |
| `run_hadoop.sh` | Three Hadoop Streaming jobs (`local` or `hdfs`) |
| `setup_pseudo.sh` | Writes config under `conf-pseudo/`, starts or stops 1-node HDFS and YARN |
| `test_flying.py` | Feature test |

## Algorithm

Semantics: a pair violates when both cars have z > 0 and distance <= s at ticks forming a run whose span is longer than 1000 ms. z is altitude above the local surface, so landed cars at any terrain elevation have z = 0. Unwrapping the Earth shell to a rectangle does not change the algorithm except at the wraparound seam, which is ignored. Which pairs count is set by `--airborne`: `both` (default, the assignment rule), `any` (at least one car z > 0, so flying near a parked car or a ground obstacle still violates), or `off` (every pair, which flags every neighbouring pair of parked cars). A run may skip up to `--gap` (default 2) consecutive missed ticks. Ticks are assumed synchronized across cars. Units are feet.

**Job 1, per timestamp, spatial (the assigned algorithm).**
- Map: drop z <= 0. Home cell is `floor(coord / d)` per axis with d = k*s, k = 5 so d = 50 ft. Key is `ts:pack(cx,cy,cz)`. A point also goes as a ghost to each neighbour cell its s-neighbourhood reaches (per axis, -1 if the offset inside the cell is < s, +1 if >= d - s, Cartesian product). Only the faces a point is near get a ghost, not all 26 neighbours. Replication is (1 + 2/k)^3 = 2.74 for uniform points, measured 2.56.
- Reduce: sort a cell's points by x, sweep while dx <= s, skip ghost-ghost pairs, test dist^2 <= s^2. A home/ghost pair shows up in both home cells, so it is reported only by the cell with the smaller uniquely encoded id. This makes each close pair appear once per tick, with no later dedupe.

**Job 2, per pair, temporal.** Key is `VIN_a,VIN_b`. Sort that pair's close ticks, split into runs at gaps larger than `--gap`, report runs with span > 1000 ms. Close pairs are rare, so this job is small.

**Job 3.** Distinct VINs from violating pairs.

**Stride option.** `--stride N --gap 0` samples every Nth tick and yields a superset of the strictly continuous violations. A verification pass at stride 1 with `--gap 0 --vins candidates.txt` filters the mapper to candidate cars and gives the exact answer, provided the full input is retained. With `--gap > 0` (the default), the program processes every tick even if a larger stride is requested: repeated tolerated dropouts can remove every sampled point. A stride longer than the minimum run length also falls back to every tick. Sampling still reads all records when applied inside the mapper; only the emitted data is reduced.

## Running time

Naive pairwise per tick is O(n^2). Over N records that is about N * n pairs, with n = 10^10 cars per tick, so 5 * 10^19 pairs per 10 ms tick. Not feasible.

Grid and ghosts: map is O(N), with constant replication r. Shuffle sort is O(rN log(rN)). Each cell sweep is O(m log m) plus comparisons for points within s on the x axis, regardless of their y and z separation. With bounded x-slab occupancy the comparisons are O(N), but in the worst case a cell requires O(m^2) comparisons. Job 2 is O(P log P) for P close pair-ticks; P can also be large. Thus O(N log N) requires bounded slab occupancy and a bounded number of close pair-ticks per input row; worst-case work is quadratic. Cells for different timestamps share nothing, so job 1 parallelizes with no coordination.

## Measured scaling (1 node, YARN + HDFS, dense uniform data)

Machine: 16-core macOS laptop running HDFS, YARN, and all containers. These measurements predate the collision-free cell encoding; performance of the corrected implementation has not been measured. Density is constant (about 1.9 cars per 50 ft cell). All runs found the same 15 planted violators, The 10^5 and 10^6 row cluster outputs were checked against `flying.py brute` and match. The 10^7 run was not checked because brute force is too slow, but it found the same 15 planted violators.

`run_hadoop.sh` first runs an identity job (`cat`, `cat`) on one row. Its time approximates per-job startup cost (YARN submit, application master, container launch) and is reported as `baseline_per_job`. The cluster is already running before any timing starts. Net time is job time minus baseline.

| Rows | Size | Job 1 (cells) | Job 1 net of baseline | 3 jobs, post-startup (total - 3 * baseline) |
|---|---|---|---|---|
| 1.0 * 10^5 | 5 MB | 27 s | 13 s | 33 s |
| 1.0 * 10^6 | 40 MB | 33 s | 20 s | 42 s |
| 1.0 * 10^7 | 401 MB | 57 s | 44 s | 66 s |

Baseline was 13 to 14 s per job. Jobs 2 and 3 handle almost no data and cost about 8 to 13 s each above baseline, which is Python launch and 2 reducers, so they are constant here. Job 1 is the scaling term. Marginal rate from 10^6 to 10^7 is 9 * 10^6 rows in 24 s, about **375,000 rows/s** for this node, and the cost model below uses 360,000. A single core of the same code in a plain `sort` pipe measured 160,000 rows/s (6.2 s per 10^6 rows: map 3.2, sort 1.2, cell reduce 1.8), so the cluster figure is consistent with 2 to 3 busy cores. Three data points over a 10x range cannot confirm the log factor, only that growth is close to linear. Runs are single samples, so expect a few seconds of noise.

## Cost to keep up with 10 billion cars

Input rate is 10^10 cars * 100 records/s = **10^12 records/s**, about 40 TB/s at roughly 40 bytes per row, 3.5 EB/day. Rental is $0.10 per node-hour. Node throughput is the measured 360,000 rows/s, assuming a rented node performs like this run.

Nodes needed = rate / throughput. Cost per hour = nodes * $0.10.

| Scenario | Rows/s to process | Nodes | Per day | Per month | Per year |
|---|---|---|---|---|---|
| A. Full file as specified | 10^12 | 2.8 * 10^6 | $6.7 M | $200 M | $2.4 B |
| B. Sampling every 10th tick, assuming strict continuity | 10^11 | 280,000 | $670 k | $20 M | $243 M |
| C. B, and parked cars (z = 0) not uploaded, assuming 10% airborne | 10^10 | 28,000 | $67 k | $2.0 M | $24 M |
| D. C with a JVM or C++ implementation, assuming 20x per-node speedup (not measured) | 10^10 | 1,400 | $3.3 k | $100 k | $1.2 M |

Rationale:
- A is the literal task. It is dominated by reading and shuffling 10^12 rows/s, and no algorithm below linear in N helps. The grid adds a measured replication factor of about 2.6 to shuffle volume; its comparison count depends on cell occupancy.
- B–D are hypothetical screening costs under strict continuity (`--gap 0`), not estimates for the default gap-tolerant rule. Under that rule, repeated isolated missed ticks can hide a violation from every sampled tick. Exact verification also needs the full-resolution records and additional capacity, neither included in B–D; uploading only every 10th tick cannot provide that verification.
- Filtering parked cars at the map input requires cars to not send them. If the file must contain every record, they still cost read bandwidth, so C only holds when filtering happens at ingest.
- Every figure is capacity to match the arrival rate with zero backlog. Add 20 to 30 percent headroom for skew, since a dense city cell takes longer than a sparse one.
- Physical density helps. 10^10 cars over Earth's surface is about 1 car per 5 * 10^5 ft^2, so most 50 ft cells hold 0 or 1 cars. Real cities are 100x to 1000x denser, which is why the test data above is dense.

## Bonus: real-time TCAS estimate (not implemented)

Goal: warn a car before a pair reaches 10 ft, not find violators afterward. All numbers are estimates. Cars move at car speed: 25 mph (36.7 ft/s, urban) and 75 mph (110 ft/s, highway lane). The 500 mph figure in the batch problem is not used here.

- **Geometry.** Head-on closure is 73 ft/s at 25 mph and 220 ft/s at 75 mph. A 10 s lookahead needs neighbours within about 730 ft (0.22 km) at 25 mph and 2,200 ft (0.67 km) at 75 mph. A 30 s lookahead triples those.
- **State exchange.** Each car broadcasts a 32 byte state (id, position, velocity, timestamp) at 10 Hz. Position every 10 ms is wasted because velocity lets receivers extrapolate. Per car, uplink is 320 B/s.
- **Neighbours in lookahead radius.** Assume airborne density of 100 cars/km^2 across a metro and 1,000 cars/km^2 downtown peak.

  | Speed, 10 s lookahead | Area | Metro (100/km^2) | Downtown (1,000/km^2) |
  |---|---|---|---|
  | 25 mph, 730 ft | 0.15 km^2 | 15 | 150 |
  | 75 mph, 2,200 ft | 1.4 km^2 | 140 | 1,400 |

- **Radio load.** Receive load is neighbours * 320 B/s. Worst case (75 mph, downtown) is 1,400 * 320 B/s = 450 KB/s = 3.6 Mbps on a shared channel. Typical metro at 75 mph is 0.36 Mbps. A 1 Mbps ADS-B class channel covers typical load but not the peak, which needs a spatially reused slotted channel (5G V2X class). Range-tiered rates (10 Hz inside 500 ft, 1 Hz beyond) cut load about 3x.
- **Compute per car.** Closest-point-of-approach for one pair is about 50 flops. Worst case: 1,400 * 50 * 10 Hz = 0.7 MFLOP/s per car, trivial on-board. The grid prefilter from this assignment (cell side = lookahead radius) keeps it near-linear in neighbours.
- **Centralized instead.** 10^8 airborne cars (1% of fleet) * 140 neighbours * 50 flops * 10 Hz = 7 * 10^12 FLOP/s typical, a few GPUs, and about 10x that at peak. Ingest is 10^8 * 320 B/s = 32 GB/s, about 26 nodes of 10 Gbps. That is feasible as primary at car speeds. A 100 ms network hop is 11 ft at 75 mph and 22 ft closing head-on, which is about the size of the protected zone. Keep a local check for the last 2 s and use the central service for long lookahead and audit.
- **Latency budget (10 s lookahead).** Detect and alert within 200 ms, reaction about 1 s, and a 20 ft sidestep at 0.3 g (about 10 ft/s^2) takes about 2 s, leaving several seconds of margin at both speeds.
- **Sensor error.** RTK GPS has about 3 ft error. Use a protected zone of 10 ft + 3 sigma of combined error, about 20 ft for two cars, so alerts trigger before a 10 ft violation.
- **False alarms.** 10^8 airborne * 140 neighbours * 10 Hz = 1.4 * 10^11 pair evaluations/s. Allowing one false alert per car per year is 10^8 / 3.15 * 10^7 s = 3.2 alerts/s fleet-wide, so false alarm probability per evaluation must be below about 2 * 10^-11. That forces a short confirmation window (2 to 3 consecutive hits) and good velocity estimates, not position alone.
