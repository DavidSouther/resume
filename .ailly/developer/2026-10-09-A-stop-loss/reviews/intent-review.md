# Intent review (quick loop, after build)

Questions against .ailly/prompts/stop_loss.md:

1. Prompt says "choose 5 start dates" and "create three purchase strategies". The strategies (momentum, low volatility, liquidity) and dates were chosen without human input. Are these the three you wanted?
2. "Best idea that fits with your investment strategy" is implemented as re-running the same ranking, excluding the symbol just sold. Intended?
3. Prompt asks for 30 scenarios. Added 15 no-stop control runs. Accepted as an addition.
4. Monthly rule uses the daily peak and checks only every 30 days from purchase (per human correction 2026-10-09).
5. Universe cleanup (indices, dash symbols, ETFs kept) was done by inspection and changed results materially between runs. Is an ETF-inclusive universe acceptable?
6. Tax rates (32 percent short, 15 percent long) are assumed. Confirm or supply rates.
