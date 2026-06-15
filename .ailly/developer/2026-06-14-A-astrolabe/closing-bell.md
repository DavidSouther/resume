# Astrolabe Watch: Closing Bell

The exit criterion for the Astrolabe project (`developer/references/closing-bell.md`). It is written once now, before the features are designed, and run once near completion. The run uses a build with the release gate on, while production keeps `/astrolabe/` dark. The agent drafts the study, scripts the scenarios, and records the outcome. A real participant attempts the tasks and an evaluator judges them against the criteria below. A pass is evidence from a human study, not from automated checks.

## What the finished project should let a user do

Open `/astrolabe/` cold on a phone or a laptop and, with no instruction, recognize it as a luxury astronomical watch showing the current sky with Earth held still at 3 o'clock, read roughly where the planets are, set it running into the future, and change how it looks. Everything is reachable from the page itself.

## Participant profile

- **Who.** An adult comfortable using websites on a modern phone and laptop, with a casual interest in watches or astronomy. One participant per session, across three to five sessions.
- **Assumed prior knowledge.** General web literacy, meaning they tap, scroll, and find an on-screen control. They know the planets exist and that the zodiac is a band of star signs.
- **Knowledge they must NOT have.** Any walkthrough of this page, the geocentric thesis, the existence of a `#debug` mode, or any briefing on which control does what. No author over the shoulder.

## Setup and materials

- **Starting state.** A fresh browser tab opened to the release-gated `/astrolabe/` build with the gate on. The study runs on one phone (Safari on iOS or Chrome on Android) and one desktop (Safari or Chrome). No browser storage is primed, so it is a first-use, out-of-box session.
- **Provided.** The page as shipped, including any on-page affordances and visible labels that are part of the deliverable.
- **Withheld.** The visual spec, this document, the design docs, the `#debug` URL, and any verbal hints. If the participant cannot find something, that is data, not a cue to help.

## Task scenarios

Each task is stated as an outcome in the participant's language rather than as a sequence of control steps. The task is read aloud, and the participant thinks aloud.

- **T0, be awed.** The beauty and elegance jump out immediately; the engineering and styling show over time. When finished with the closing bell, the participant is awed at the grandeur of the universe and the project.
- **T1, recognize it.** "You have just opened this page. Tell me what you think you are looking at, and anything you can read off it." This exercises F1 case presence and F2 dial legibility.
- **T2, read a position.** "Roughly where is one of the planets right now, say Mars, or any planet you can pick out?" This exercises F2 body placement and identifiability.
- **T3, run time forward.** "Make it show you the sky some time from now, not just this exact moment." This exercises the F3 Realtime and Fast control.
- **T4, read togetherness.** "Is anything bunched up close together in the sky right now?" This exercises the F2 guilloché sightlines and the twilight wedge. It is secondary.
- **T5, change the look.** "Change something about how the watch looks, a color, a material, or a part you would rather hide." This exercises the controls sheet across F1, F2, and F3. It is secondary.

## Acceptance criteria per task

These are fixed before the study runs. "Ease" is a single post-task question, "How easy or hard was that?", on a 1 (very hard) to 7 (very easy) scale.

| Task | Correct completion | Time ceiling | Error ceiling | Ease floor | Class |
|------|--------------------|--------------|---------------|------------|-------|
| **T1** | Names it as an astronomical or planetary watch, and states that it shows the current sky. Noting that Earth is fixed is a bonus, not a requirement. | 60 s to first articulation | not applicable | 5 | **Critical** |
| **T2** | Points to a planet disc and gives its rough position (for example, "out toward the rim, lower left"), reading it off the dial rather than guessing. | 90 s | at most 1 wrong pick before correcting | 4 | **Critical** |
| **T3** | Finds and activates the Realtime and Fast control, and sees the system advance. | 90 s | at most 1 wrong control tried | 4 | **Critical** |
| **T4** | Identifies a close pairing or cluster, or correctly says nothing is notably close, using the dial sightlines and proximity. | 120 s | not applicable | 4 | Secondary |
| **T5** | Opens the controls and changes one material, color, or visibility toggle, and sees the watch update. | 120 s | at most 2 wrong controls tried | 4 | Secondary |

**Error ceiling marked "not applicable".** T1 and T4 are open articulation and judgment tasks with no single correct action to mis-click, so a discrete error count does not apply. Those two are gated on completion, time, and ease only.

**Project lands** when all three critical tasks (T1, T2, T3) pass across a majority of participants. The secondary tasks (T4, T5) inform the result and surface refinements, but they do not block the release.

**On a failed run.** A failing critical task reopens the feature that owns the failed behavior, per the project design doc's failure note. Recognition or position reading reopens F2, running time forward reopens F3. The reopened feature runs another design-to-build pass behind the still-dark gate, then this bell is rerun.

## Adjacent practice

Summative usability testing: task success rate, time on task, error rate, and a single-question ease scale, with acceptance criteria fixed before the study runs.
