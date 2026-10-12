# Intent review

Original prompt: apply Domain review top to bottom on NYC polling; separate central thesis (census and BOE alignment, poverty and distance hypotheses) from supporting domains (network, cache, stats, etc).

Questions for the human:

1. Is Tract Site Alignment plus Disparity Hypotheses the right split of the thesis, or one Core context?
2. "Apply" was read as classify and enforce, not restructure. Should deferred refactors (Observation split, subpackages) happen now?
3. Presentation is classified Supporting in docs but sits on its own top layer in the test. Acceptable?
4. Stats is Generic although hand written. Keep, or swap to scipy and drop the cross-check?
