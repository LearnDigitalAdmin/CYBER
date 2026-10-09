# Samuhia Desk — Admin dashboard contract (v2)

Your admin project reads the CYBER Firebase project. All money is integer minor units (KES x 100); timestamps are epoch ms.

## What is automatic
Every desk charge is a Paystack **split** (percentage, `all-proportional`), so Paystack deducts its real fee and pays
the agent's share straight to the agent's subaccount (`agents/{uid}.paymentInfo.accountId`). **Nothing for you to settle.**
The ledger only records what already happened.

## The one manual payout: the KES 2,000 milestone bonus
1. Read bonuses waiting: `desk_ledger` where `kind == "bonus"` and `status == "payable"`.
2. Pay with **Paystack Transfers** from the admin dash. Use `reference = "bonus_" + entryId` (idempotent: a repeat
   transfer with the same reference is rejected by Paystack).
3. Call the private HTTPS function **`desk_admin_markBonusPaid`** (service accounts with `roles/run.invoker` only):
   body `{ "entryId": "...", "transferReference": "bonus_<entryId>" }`. The function **verifies the transfer with
   Paystack** (status `success`, amount equals the bonus) before setting `status: "paid"`, `paidAt`, `transferRef`,
   `transferCode`. It never trusts the caller's word, and repeating the call is safe.

## What to read (all collections are prefixed `desk_`)
| Collection | Use |
|---|---|
| `desk_agents` | roster, status, rank, ward |
| `desk_customers` | attribution (`ownerAgentId`), `paidMonths`, `firstPurchaseUsed` |
| `desk_ledger` | every earning: `settled` (auto-paid by split), `payable` / `paid` (bonus), `void`; refunds appear as `reversal` rows |
| `desk_tickets` | desk service charges, with real gross, fee, agent and platform amounts |
| `desk_events` | immutable payment facts from PAY and the products |
| `desk_rent_batches` | rent STK batches and per-tenant results |
| `desk_support` | support log and customer confirmations |
| `desk_audit` | append-only record of every agent action |
| `desk_config/global` | rates, caps and prices (you may edit this document) |
Existing PAY data stays authoritative for CYBER charges: `agents/{uid}/cyber-income/{reference}`.

## Config keys (`desk_config/global`)
`creditCostMinor`, `platformCutPct` (2.5, must match PAY's `chargeCustomer`), `expectedPaystackFeePct`, `smsShareOfMarginPct`,
`firstPurchaseThresholdMinor`, `subShareByRank`, `reportShareByRank`, `rentDeskSharePct`, `rentTakeCapMinor`, `milestone`,
`prices`. Missing keys fall back to `functions-desk/src/config.ts`. Changes apply to new charges only (cached up to 60 s);
existing Paystack split codes are keyed by their shares, so new rates automatically get new split codes.

## Do not
Edit `desk_ledger`, `desk_events` or `desk_audit` by hand. Corrections are made through a function so the audit trail stays intact.
