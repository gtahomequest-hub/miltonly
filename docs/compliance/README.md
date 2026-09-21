# Compliance documents

The rules this site is judged against, one line each: what the document is, where it came from, its date. A future session reads this before it decides what "compliant" means.

| File | What it is | Source | Date |
|---|---|---|---|
| `PROPTX_VOW_Best_Practices.pdf` | PropTx "Virtual Office Website Best Practises": the summary of a Member's and AVP's VOW obligations (items 1 to 54), Appendix A (the RESO Web API feed, Archive Data, the `internet` and `disp_addr` flags and the address fields they withhold), Appendix B (the minimum Terms of Use). Guidance; it does not alter the AUA, the MLS Rules or the VOW Data Feed Agreement. The document MC-036 is built from. | Sent to the desk by PropTx, copied here 2026-09-21. | Undated on its face. Appendix C (the VOW Compliance Survey, referenced at item 48) was not attached; Aamir has asked PropTx for it. |
| `RECO-Information-Guide.pdf` | RECO's consumer guide "Working with a real estate agent: things you need to know", the residential Information Guide a registrant gives a consumer. Reference only; no task attached. | RECO. | Content December 1, 2023; graphics April 2025. |
| `2026-07-broker-remarks-purge.md` | The remediation log for the July 2026 purge of `sold.sold_records.broker_remarks` (AMPRE `PrivateRemarks`) and the same key inside `raw_vow_data`: agent-only showing and access text that must never be retained or shown. MC-036 added the same treatment for `ShowingRequirements` and `ShowingAppointments` (`migrations/sold/006_showing_fields_purge.sql`, prepared, not executed) and the battery's `agent-only` check. | This repo. | 2026-07-26. |

## The binding rules, public, not in the repo

**PropTx MLS® Rules and Policies:** https://proptx.ca/files/proptx_mls_rules.pdf. Article 8, "Virtual Office Websites", rules 8.01 through 8.32. The copy fetched on 2026-09-21 says **"EFFECTIVE DECEMBER 2, 2024"** on its cover (60 pages); if PropTx publishes a later edition the mapping below must be re-read against it.

The Best Practices PDF cites rules under an older numbering (R-8xx and R-8.xx) that does not appear in the current document. The live rule for each:

| Cited in the Best Practices | Live rule (Article 8, effective 2024-12-02) | What it says |
|---|---|---|
| R-805, R-8.05(b) (item 23) | **8.05(b) and (c)** | the name and a verified email address of each Consumer, agreement to the Terms of Use; a username and password unique to the Consumer, one email address per username |
| R-8.06 (item 24) | **8.06** | passwords valid for at most 90 days, renewable; a record of name, email, username and current password kept at least 180 days past the password's validity |
| R-807 (item 31) | **8.07** | the VOW includes any copyright notice PropTx provides, as PropTx publishes it |
| R-8.08 (item 29) | **8.08** | on request after a suspected breach, the Consumer's record and an audit trail |
| R-8.09(b) (item 26) | **8.09** | the Terms of Use, (a) through (g): lawful broker-consumer relationship, personal non-commercial use, bona fide interest, no copying or redistribution (AI systems named), no display or transfer to others, no scraping, PropTx's copyright acknowledged |
| R-8.13 (item 25) | **8.13** | reasonable efforts against scraping and misappropriation, firewalls, an audit trail of Consumer activity |
| R-814(a) (item 36) | **8.14.01** | no display of a Listing or an address the Seller directed to be withheld from the internet (8.14.02 and 8.14.03: the Seller's signed direction and its one-year retention are the listing brokerage's) |
| R-824 (item 32) | **8.24** | Listing content not changed from the MLS System; augmentation allowed only with its source clearly identified |

Other live rules MC-036's items rest on, for the record: **8.12** (a prominent way to contact the Member about any displayed property), **8.16** (a means for a listing brokerage to report inaccurate added information, corrected within 48 hours), **8.17** (refresh at least every 24 hours), **8.19** (the privacy policy, boldly, including that Personal Information may be shared with PropTx), **8.23** (no Seller contact details, no co-operating-broker instructions such as showings or access), **8.25** (the "deemed reliable but not guaranteed accurate" notice), **8.26** (the listing brokerage in a readily visible colour, a reasonably prominent location and a typeface no smaller than the listing's), **8.27** (no more than 100 Listings in response to any inquiry), **8.28** and **8.29** (Listings from other sources identified and searched separately), **8.31** (a Seller's withholding direction produced to PropTx within 48 hours on request), **8.32** (the VOW Rules govern a conflict).

The VOW Policy the Best Practices cites by paragraph (7(a), 7(b), 14, 15, 19) is a separate PropTx document not held here; the Archive Data paragraph (15) is the one MC-036 item 2 turns on.
