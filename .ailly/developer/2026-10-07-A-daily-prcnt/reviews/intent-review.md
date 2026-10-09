# Intent review: research.md

Questions for the human, working backward from the original prompt.

- The prompt says "table" and "view selection table". Does a plain view satisfy it, or must rows persist for later homework queries?
- "Accounting for splits and dividends" could mean price return adjusted only for splits, with dividends added as total return. research.md assumes total return. Confirm.
- Dataset ends 2014-01-14. Any expectation that results match an outside source such as Yahoo adjusted close? research.md does not compare against one.
- Zero-close rows (231k) are excluded. Is dropping them acceptable, or should PRCNT be NULL for them?
