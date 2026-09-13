# Profit and drawdown are fractions of start equity

Ruleset profit target, max drawdown, and daily drawdown used to be money. Dual money-or-percent is a footgun, and every mill already thinks in percent of the phase size.

They are `0–1` fractions, same scale as payout split. Target and max drawdown divide by start balance. Daily drawdown divides by daily start equity. Not trailing from peak.

Rejected: keep dollars, support both, trailing peak DD.
