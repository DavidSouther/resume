"""NYC census tract poverty and early voting poll site tools, one folder per domain (see docs/ddd/domain-model.md).

Core: tract_site_alignment (census tracts overlaid on election districts), disparity_hypotheses (poverty and distance tests H0 to H6).
Supporting: census_geography, poll_site_registry, boe_assignment, assembly (`load_dataset`, the one entry point), presentation.
Shared kernel: kernel (Site, Tract, Observation, poverty classes).
Generic: generic (cached HTTP, statistics, point in polygon).

A folder imports only from its own layer or lower (generic, kernel, supporting, core, presentation); tests/test_context_boundaries.py enforces it.
No step writes an intermediate file. Every script calls `load_dataset`, and the HTTP cache keeps the downloads between runs.
"""
