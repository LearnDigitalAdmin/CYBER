# Samuhia Desk — Operations contract (v4)

## Who runs what
- **Top desk (`COG-0000`)** is the company's own desk inside the desk app. It reviews desks and their registration documents, activates, suspends or closes them, sets ranks, and **issues and makes payouts**. Every one of those privileges is enforced in cloud-function code, never by Firestore rules: the caller must be the top desk's own record, active, signed in with a **verified `@samuhia.co.ke`** address and a recent sign-in, and sensitive actions need a **per-action OTP** sent to the top desk's phone. Everything is audited.
- Your separate admin project may keep **reading** these collections; it is no longer needed for payouts.

## Automatic money
Every desk charge is a Paystack split (percentage, `all-proportional`). Paystack deducts its real fee and pays each share to the agent's subaccount automatically. Nothing to settle.

## Manual money (top desk, with OTP)
Rows in `desk_ledger` with `status: "payable"` and `kind` `bonus` (KES 2,000 per 10 retained paying accounts, lifetime cap KES 10,000) or `support`. The top desk pays them from the main Paystack balance: `desk_top_listPayables` → `desk_top_requestOtp(payout)` → `desk_top_payout`. Reference `payout_<entryId>`; the row moves `payable → processing → paid` once Paystack Transfers confirms (a scheduled reconciler verifies pending transfers). A daily cap (`topDesk.dailyPayoutCapMinor`) limits what can leave per day.

## One-way access (no loops)
Desk (the CYBER/PAY/PMS project) may read and write the Chama and Register projects. **They have no access to desk, ever.** When Chama or Register needs desk it writes a **support request** into its **own** `desk_requests` collection. A scheduled sweeper (`desk_sweepRequests`, every 30 minutes) pulls new items, creates desk's own copy idempotently, and marks the product's item `pulled` so it is never read twice. Plot Yangu is in desk's own project, so it writes requests directly. Payment facts never use the outbox: PAY's webhooks confirm every charge and write `desk_events` directly. Desk writes answers back into the product's item so the customer sees progress.

## Collections (all prefixed `desk_`)
`desk_agents` (status/rank are written only by top-desk functions), `desk_customers`, `desk_ledger`, `desk_tickets`, `desk_events`, `desk_requests`, `desk_docs` (metadata; the files live in Storage under `desk-docs/` and are reachable only through functions), `desk_audit`, `desk_config/global`.

## Config keys (`desk_config/global`)
`creditCostMinor`, `platformCutPct` (2.5, must match PAY's `chargeCustomer`), `expectedPaystackFeePct`, `smsShareOfMarginPct`, `firstPurchaseThresholdMinor`, `subShareByRank`, `reportShareByRank`, `rentDeskSharePct`, `rentTakeCapMinor`, `milestone`, `prices`, `support`, `delegate` (product `deskdelegate` URLs), `projects` (Chama and Register project IDs), `paystackAccounts` (`main` or `separate` per product), `topDesk.dailyPayoutCapMinor`. Missing keys fall back to `functions-desk/src/config.ts`.

## Secrets
Desk reuses the project's existing secrets: `PAYSTACK_SECRET_KEY` (main account), `MYCHAMA_PAYSTACK_SECRET_KEY` (MyChama's own account; only the payout-account sync binds it, to create the desk's MyChama subaccount) and the HostPinnacle set `HP_SMS_USERID/PASSWORD/APIKEY/SENDERID`. **No new secrets.**
