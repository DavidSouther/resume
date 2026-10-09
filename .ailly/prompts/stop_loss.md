/developer:ailly quickloop Using the hw4 data

Implement a trailing stop-loss strategy calculating the losses from the maximum price the asset has reached since purchase.

Compare Daily and Monthly stop-loss strategies.

Assume US capital gains taxes over the appropriate timeframe.

Sell your investment if at the evaluation date the trailing stop-loss level of 20% has been exceeded

Reinvest the cash from the sale in the best idea that fits with your investment strategy.

The stop-less strategy should take:

1. Simulation starting date
2. Purchase strategy

It should then proceede through the data calculating both daily and monthly stop loss periods, assuming sales & new purchases happen at the following day's open price. Assume that volumes are small enough relative to market cap that they would not be market movers.

Start with $10k cash.

Create three purchase strategies, choose 5 start dates, and run each - 3 strategy x 5 start date x 2 stop-loss timeframes = 30 scenarios