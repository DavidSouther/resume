"""Summarize results.csv as a markdown table: one row per strategy and start, daily vs monthly vs no stop."""
import csv
import statistics


def main(src="stop_loss/results.csv"):
    rows = list(csv.DictReader(open(src)))
    by = {}
    for r in rows:
        by.setdefault((r["strategy"], r["start"]), {})[r["mode"]] = r
    out = ["| Strategy | Start | Daily | Monthly | No stop | Daily stops | Monthly stops | Daily tax | Monthly tax |",
           "|---|---|---:|---:|---:|---:|---:|---:|---:|"]
    for (s, d), m in by.items():
        f = lambda k, c="final_value": f"{float(m[k][c]):,.0f}"
        out.append(f"| {s} | {d} | {f('daily')} | {f('monthly')} | {f('none')} | {m['daily']['stops']} | "
                   f"{m['monthly']['stops']} | {f('daily', 'taxes_paid')} | {f('monthly', 'taxes_paid')} |")
    pairs = list(by.values())
    mw = sum(float(m["monthly"]["final_value"]) > float(m["daily"]["final_value"]) for m in pairs)
    dw = sum(float(m["daily"]["final_value"]) > float(m["none"]["final_value"]) for m in pairs)
    mn = sum(float(m["monthly"]["final_value"]) > float(m["none"]["final_value"]) for m in pairs)
    ratio = lambda a, b: statistics.median(float(m[a]["final_value"]) / float(m[b]["final_value"]) for m in pairs)
    out += ["", f"- Monthly beat daily in {mw} of {len(pairs)} start and strategy pairs.",
            f"- Daily beat no stop in {dw} of {len(pairs)}; monthly beat no stop in {mn} of {len(pairs)}.",
            f"- Median final value ratio, monthly over daily: {ratio('monthly', 'daily'):.2f}. Daily over no stop: {ratio('daily', 'none'):.2f}. "
            f"Monthly over no stop: {ratio('monthly', 'none'):.2f}."]
    print("\n".join(out))


if __name__ == "__main__":
    main()
