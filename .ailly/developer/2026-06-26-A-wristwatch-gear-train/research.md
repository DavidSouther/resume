# Wristwatch Gear Train Research

## Topic and Intent

Fill out a starting wheel-train table for a typical simple mechanical wristwatch. The table should be useful as a base movement: later complications can be driven from whichever arbors prove appropriate.

The most useful seed is a coherent simple going train rather than a claim that all wristwatches use the same tooth counts. This research uses an 18,000 bph lever movement as the baseline because it produces clean, common ratios and a plausible 40-hour reserve:

| Wheel | Pinion Teeth | Teeth | RPH | Arbor |
| --- | ---: | ---: | ---: | --- |
| Barrel | 0 | 80 | 0.125 | Mainspring, 5 windings for ~40 hr reserve |
| Center Wheel | 10 | 80 | 1 | None; use minute/cannon pinion here only if the model includes motion work on this arbor |
| Third Wheel | 10 | 75 | 8 | None |
| Fourth Wheel | 10 | 60 | 60 | Seconds Hand |
| Escape Wheel | 6 | 15 | 600 | Pallet fork / balance impulse |
| Balance Wheel | 0 | 0 | 18,000 BPH | Balance staff |

If the escape row must remain "Escapement" rather than "Escape Wheel", then the pallet fork itself has 0 gear teeth and no pinion. The gear-train row should still usually be the escape wheel: 6-leaf pinion, 15 escape teeth. The balance wheel row is an oscillator reference, not another geared wheel.

## Search/Expand

Public watchmaking references agree on the functional anchors:

- The center wheel in a normal going train is arranged to turn once per hour, which makes it the natural minute-hand reference if dial-side motion work is included [1].
- The fourth wheel is commonly geared to one revolution per minute, making it the natural seconds-hand arbor [1].
- The barrel normally rotates slowly; one reference gives about one revolution in eight hours as a typical watch value, with the barrel teeth driving the center pinion [1].
- Lever watch escape wheels are commonly 15-tooth wheels [2].
- In a lever escapement, the escape wheel advances by one tooth per full balance oscillation, or two beats/vibrations, so an 18,000 bph movement with a 15-tooth escape wheel needs an escape-wheel speed of 18,000 / (2 * 15) = 600 revolutions/hour = 10 rpm [2].

The proposed counts satisfy those anchors:

- Barrel to center: 80 / 10 = 8. The center wheel turns once per hour, so the barrel turns once per 8 hours. Five barrel turns give about 40 hours of reserve.
- Center to fourth: (80 / 10) * (75 / 10) = 60. The center wheel turns once per hour, so the fourth wheel turns 60 times per hour = once per minute.
- Fourth to escape: 60 / 6 = 10. The fourth wheel turns once per minute, so the escape wheel turns 10 rpm.
- Beat rate: 10 rpm * 60 min/hour * 15 teeth * 2 beats/tooth = 18,000 bph.

## Libraries & Skills

Before doing any work in this feature, load these skills via the Skill tool: none discovered.

No software library or framework is implicated by the research request. This is domain sizing and ratio selection only. If the next phase turns this into code or a visual mechanism, the relevant implementation skill should be selected then.

Public-source wiring is governed by `research:using-research` and its `references/configuring/public.md` contract; this session consumed the available web search/fetch path rather than configuring sources.

## Falsification/Refine

The load-bearing universal claim "a typical wristwatch has one canonical set of gear tooth counts" is false. Watch trains vary by beat rate, power reserve, layout, and manufacturer. The right-size outcome is therefore a baseline table with explicit assumptions:

- Size: single feature if implemented later, not a project by itself.
- Off-the-shelf: horological movement catalogues can provide named-caliber counts, but the user's table is better served by a clean constructive train unless a specific caliber is required.
- Smallest useful version: a five-row going train with barrel, center, third, fourth, and escape wheel, plus a balance wheel oscillator row for the BPH reference; do not attach extra complications yet.
- Variant handling: keep the barrel-center-third-fourth ratios for time display, and change the fourth-to-escape ratio when choosing 21,600 bph or 28,800 bph. With a 15-tooth escape wheel, 21,600 bph wants escape speed 12 rpm; 28,800 bph wants 16 rpm.

## Scope

In scope for the following design phase:

- A simple, internally consistent 18,000 bph mechanical wristwatch going train.
- Tooth/leaf counts for the base train.
- Arbor annotations for mainspring and seconds, with center-wheel minute-hand handling called out as a modeling choice.

Out of scope:

- Automatic winding, keyless works, motion works, calendar, moonphase, chronograph, power reserve, remontoir, or other complications.
- Selecting a named commercial caliber.
- Designing tooth profiles, module, depthing, jewels, friction, or escapement geometry.

## Resolved Decisions

- Use a coherent baseline rather than searching for one universal "typical" tooth-count table.
- Use 18,000 bph as the first baseline because it yields a clean 10:1 fourth-to-escape ratio with a 15-tooth escape wheel.
- Use barrel 80 / center pinion 10 as the power-reserve seed: approximately one barrel revolution per 8 hours, or about 40 hours for five turns.
- Use center 80 / third pinion 10 and third 75 / fourth pinion 10 to make the fourth wheel turn once per minute.
- Treat "Escapement" as "Escape Wheel" for the gear train. If the model separately represents the pallet fork, that part has 0 gear teeth and belongs after the escape wheel.

Open for human review:

- Whether the center wheel arbor should remain `None` in the base table or be marked `Minute Hand` / `Cannon Pinion`.
- Whether the baseline should instead target a modern 21,600 bph or 28,800 bph movement.
- Whether a named movement family should replace this constructed baseline.

## Sources

[1] "Wheel train," Wikipedia, accessed June 26, 2026. https://en.wikipedia.org/wiki/Wheel_train

[2] "Lever escapement," Wikipedia, accessed June 26, 2026. https://en.wikipedia.org/wiki/Lever_escapement
