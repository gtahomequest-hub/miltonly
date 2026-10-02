# MH-012 · hero links against https://miltonly.com

| Side | Role | Label | data-hero-intent | Intent it serves | Target | Status |
|---|---|---|---|---|---|---|
| Buyer | primary | Book a showing | `book-showing` | Ready to see a home: wants a time with an agent. | `/book?ref=%2F` | 200 · noindex, nofollow |
| Buyer | row | Homes listed this week | `new-listings` | Active searcher checking fresh inventory before a showing. | `/listings` | 200 · index, follow |
| Buyer | row | Buying your first home | `first-home` | First-time buyer setting a budget before booking showings. | `/guides/what-it-costs-to-buy-your-first-home-in-milton` | 200 · index, follow |
| Buyer | row | Buying to rent it out | `investor` | Investor sizing a rental purchase against what homes ask in rent. | planned `/invest` | 404 today, not built |
| Seller | primary | Get my home's value | `home-value` | Owner deciding whether and when to sell: wants a number for their home. | `/sell` | 200 · index, follow |
| Seller | row | Look up your own street | `own-street` | Owner checking what is listed near them; the street page carries an owner's valuation form. | `#hd-q` (this hero's search field) | in-page; the search it opens is live |
| Seller | row | Selling and buying at once | `sell-and-buy` | Owner moving within Milton: two transactions to time against each other. | planned `/sell-and-buy` | 404 today, not built |
| Seller | row | Talk it through first | `call` | Owner ready to speak to an agent now. | `tel:+16478399090` | a phone number, not a page |
| Renter | line | Renting instead? | `rentals` | Renter who arrived at a buy-or-sell page. | `/rentals` | 200 · index, follow |

## Planned, not built

| Side | Label | Intent | Planned path | Status today |
|---|---|---|---|---|
| Buyer | Buying to rent it out | Investor sizing a rental purchase against what homes ask in rent. | `/invest` | 404 |
| Seller | Selling and buying at once | Owner moving within Milton: two transactions to time against each other. | `/sell-and-buy` | 404 |

5 page targets, 0 not answering 200.
