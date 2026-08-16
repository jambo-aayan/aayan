# UK Open Banking / AIS providers for a personal Lloyds + Yonder integration

Enable Banking (enablebanking.com) is ruled out — no UK entry in their Control Panel country picker. This
surveys the next candidates for a single-user, non-commercial app that needs to read a Lloyds Bank current
account and a Yonder credit card.

**Headline risk confirmed:** no aggregator's public documentation lists **Yonder** as a connectable source
institution. Every "Yonder" + aggregator hit describes Yonder as a *consumer* of open banking (using Yapily,
tell.money and GoCardless to pull data *from* customers' other banks for underwriting and pay-by-bank), not
Yonder exposing its own accounts as an AIS target. No institution directory or API-tracker mirror surfaced a
"Yonder" entry. This isn't fully settled either way: TrueLayer's and Yapily's live institution tables sit
behind a logged-in Console, and network egress to docs.truelayer.com, docs.yapily.com, openbanking.org.uk and
GoCardless's API was blocked from this environment. So absence of evidence isn't proof of absence — but it's a
real red flag for a niche, young, UK-only card issuer.

## Findings table

| Provider | Lloyds supported | Yonder supported | Personal/hobby access | Auth mechanism |
|---|---|---|---|---|
| TrueLayer | Yes — Lloyds Bank named explicitly among its ~70 supported UK providers [1] | Not confirmed either way — full table is behind login; no public mention found [2] | No self-serve hobby tier for live data. Free unlimited **sandbox** (fake data); production requires signing a Joint Agreement after a KYB (Know-Your-Business) check on a registered business entity, plus an AIS Agent process (KYC, policies, PII/cyber insurance) if you display account info to end users [3][4] | OAuth2 bank-redirect consent flow per connected account; API access via client credentials issued in TrueLayer Console [4] |
| Yapily | Not directly confirmed on a public institutions page (blocked); third-party trackers claim 400+ UK/EU institutions including major high-street banks [5] | Not confirmed as a target institution. The only public Yonder↔Yapily material is Yonder *using* Yapily to read other people's accounts, not Yapily reading Yonder [6][7] | **Yapily Connect** lets an individual operate under Yapily's own FCA TPP licence instead of getting your own — free **sandbox** tier for build/test without a licence; production still needs onboarding through Yapily Connect [8] | OAuth2 bank-redirect via Yapily Connect's hosted auth; API key/client credentials from Yapily account |
| GoCardless Bank Account Data (ex-Nordigen) | Historically comprehensive EU/UK coverage; a 2025 status incident specifically references Lloyds Banking Group in their institution set, implying past support [9] | Not found in any surfaced documentation | **Ruled out for new projects**: GoCardless's own page confirms new signups have been disabled since July 2025 — `bankaccountdata.gocardless.com/new-signups-disabled` [10]. Existing accounts keep working; new ones cannot be created | Was API-key based (secret ID/key → access token), no OAuth business onboarding — historically the most hobby-friendly option, now closed to newcomers |
| Plaid | Claimed generally ("major UK banks including...Lloyds") in secondary sources; Plaid is FCA-regulated in the UK (Plaid Financial Ltd / Plaid B.V. both listed on the Open Banking regulated-providers directory) [11][12] — could not verify Lloyds on a primary Plaid coverage page (blocked) | Not found; Plaid's UK partnerships surfaced (e.g. Capital on Tap) are business-only, no mention of Yonder | No personal/hobby self-serve tier found; Plaid's model is a developer dashboard gated to registered client applications, historically requiring a business use case to move past limited sandbox users | OAuth2/Plaid Link redirect flow; API keys (client_id/secret) per environment (sandbox/development/production) |
| Moneyhub | Not confirmed on a public institutions list (site not reachable); Moneyhub lists ~26 institutions per third-party trackers, smaller than TrueLayer/Yapily [13] | Not found | Moneyhub Enterprise is positioned as an enterprise/B2B data-and-intelligence API; no public free/personal tier surfaced | FCA-regulated AISP/PISP/CISP; standard OAuth2 consent flow, business-oriented onboarding |

Sources: [1] search-aggregated TrueLayer provider list (TrueLayer Help Centre / openbankingtracker.com mirror) · [2] docs.truelayer.com/docs/supported-providers-table (login-gated, not independently verified) · [3] support.truelayer.com "Does TrueLayer offer a trial period and a Sandbox environment?" · [4] TrueLayer Help Centre AIS Agent/Joint Agreement onboarding articles · [5] openbankingtracker.com/api-aggregators/yapily (secondary, unverified against Yapily's own list) · [6][7] yapily.com/blog/open-banking-case-study-yonder, yapily.com/blog/yonder-open-banking-partnership · [8] docs.yapily.com/tools-and-services/yapily-connect/overview · [9] status.ibp.gocardless.com Lloyds Banking Group incident (Nov 2025) · [10] bankaccountdata.gocardless.com/new-signups-disabled · [11][12] openbanking.org.uk/regulated-providers/plaid-financial-ltd/, plaid-b-v/ · [13] openbankingtracker.com/api-aggregators/moneyhub-enterprise.

## Recommendation

None of the five could be confirmed to support Yonder from primary sources — this is the project's real blocker,
not the choice of aggregator. Ranked:

1. **TrueLayer** — best bet to *try first*. Confirmed Lloyds coverage, an active free sandbox to prototype
   against immediately, and (unlike GoCardless) still onboarding new customers. The KYB/Joint Agreement step for
   production is real friction for a solo hobby project but is not an outright block — sole traders and
   individuals with a registered business have gone through it. Action: use the sandbox now, and directly ask
   TrueLayer support (or check the logged-in Supported Providers table) whether Yonder is in their network before
   investing further.
2. **Yapily (via Yapily Connect)** — second choice. No self-owned TPP licence needed, a genuine free sandbox for
   build/test, and Yapily already has a live commercial relationship with Yonder (as Yonder's *outbound* AIS
   provider) — worth a direct support enquiry, since that relationship makes them the single most plausible
   provider to also expose Yonder as an inbound institution, even though this isn't documented.
3. **Plaid** — plausible Lloyds coverage but no path to personal-only access found, and no Yonder evidence;
   treat as a fallback only if TrueLayer/Yapily both confirm no Yonder support.
4. **GoCardless Bank Account Data** — otherwise the most hobby-friendly (simple API keys, no business
   agreement) but is **closed to new signups since July 2025**, so it's unusable for a new project regardless of
   bank coverage.
5. **Moneyhub** — smallest confirmed institution count, clearly enterprise-postured; deprioritize.

**Next concrete step:** before committing engineering time to any provider, email/contact TrueLayer and Yapily
support directly and ask them to confirm whether Yonder is a connectable AIS institution in their live network —
this is the one fact none of the public documentation settles, and it determines whether this whole approach is
viable at all. If neither confirms Yonder, the fallback is Yonder's own consumer app/export (if any) or manual
entry for that one account, while still using TrueLayer or Yapily for Lloyds.
