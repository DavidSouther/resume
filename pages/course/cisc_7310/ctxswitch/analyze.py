#!/usr/bin/env python3
"""Estimate incremental handoff overhead from switchbench CSV on standard input."""
import csv
import sys

rows = list(csv.DictReader(sys.stdin))
index = {}
for row in rows:
    key = (row['mechanism'], row['working_set_bytes'], row['stride_bytes'], row['access'])
    if key in index:
        sys.exit(f'duplicate measurement: {key}')
    index[key] = float(row['ns_per_switch'])

writer = csv.writer(sys.stdout, lineterminator='\n')
writer.writerow(['mechanism', 'working_set_bytes', 'stride_bytes', 'access',
                 'handoff_minus_control_ns', 'increment_above_zero_ns'])
for row in rows:
    mechanism = row['mechanism']
    if mechanism.startswith('baseline-'):
        continue
    size, stride, access = row['working_set_bytes'], row['stride_bytes'], row['access']
    control = 'baseline-socket' if mechanism in ('thread', 'process') else 'baseline-work'
    keys = [(mechanism, size, stride, access), (control, size, stride, access),
            (mechanism, '0', stride, access), (control, '0', stride, access)]
    if not all(key in index for key in keys):
        print(f'skipping {mechanism} size {size}: matched control or zero-size row missing', file=sys.stderr)
        continue
    total = index[keys[0]] - index[keys[1]]
    zero = index[keys[2]] - index[keys[3]]
    writer.writerow([mechanism, size, stride, access, f'{total:.1f}', f'{total-zero:.1f}'])
