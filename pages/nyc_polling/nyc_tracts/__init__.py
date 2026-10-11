"""NYC census tract poverty and early voting poll site tools.

Sources to objects: net (cached HTTP), census, boundaries, poll_sites, early_voting, layers, dataset (`load_dataset`, the one entry point).
Analysis: domain, assignment, hypotheses, stats, report.
Map: bands, combined, geojson (the only files the web page loads).
Shared: poverty (class breaks and colors), geo (point in polygon).

No step writes an intermediate file. Every script calls `load_dataset`, and the HTTP cache keeps the downloads between runs.
"""
