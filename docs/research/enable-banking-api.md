# Enable Banking API — Integration Research

Investigation for linking a Lloyds Bank account and a Yonder credit card in
this personal finance app, and reading cash balances + recent transactions
via Enable Banking's Open Banking API (enablebanking.com).

**Update — confirmed against Enable Banking's own GitHub sample repo**
([enablebanking/enablebanking-api-samples](https://github.com/enablebanking/enablebanking-api-samples),
cloned directly — GitHub isn't blocked, unlike enablebanking.com itself).
This resolves most items the WebSearch-only pass below flagged as
unconfirmed. Corrections/confirmations, from `python_example/account_information.py`
and `go_example/models.go` (the JS sample has a bug — see below):

- **Control Panel URL confirmed:** `https://enablebanking.com/cp/applications`.
- **`POST /auth` body confirmed exactly:**
  ```json
  {
    "access": { "valid_until": "<ISO8601 datetime, e.g. now + 10 days>" },
    "aspsp": { "name": "Nordea", "country": "FI" },
    "state": "<your own opaque string, e.g. a uuid>",
    "redirect_url": "<one of the URLs registered in your application's redirect_urls>",
    "psu_type": "personal"
  }
  ```
  Field is `redirect_url`, **not** `redirect_uri` as guessed below. Get the
  exact registered value from `GET /application`'s `redirect_urls[0]` rather
  than hardcoding it twice.
- **`POST /auth` response:** `{"url": "<url to redirect the PSU's browser to>"}`.
- **`GET /aspsps` response:** `{"aspsps": [...]}` (wrapped, not a bare array) — confirmed via Python sample's `r.json()["aspsps"]`.
- **`POST /sessions` response `accounts` field is an array of OBJECTS with a `uid` field** — `session["accounts"][0]["uid"]`, confirmed identically in both the Python and Go samples. **The JS sample (`accountInformation.js`) is buggy/stale here** — it does `session.accounts[0]` directly as if accounts were an array of plain ID strings, which would break (stringify to `[object Object]`) against the real API. Trust the Python/Go samples, not the JS one, for this field.
- **Transactions endpoint pagination confirmed:** `GET /accounts/{uid}/transactions?date_from=YYYY-MM-DD&continuation_key=<from previous response>`. Response: `{"transactions": [...], "continuation_key": "<optional, omitted when done>"}`. Loop until `continuation_key` is absent.
- **PSU-identifying headers (`psu-ip-address`, `psu-user-agent`) appear optional** — present in the JS sample, absent in the (more thorough) Python sample which works with just `Authorization: Bearer <jwt>`. Treat as optional/best-effort to include, not required.
- **Still not resolved even with the sample repo:** exact per-item field names inside `balances[]` and `transactions[]` beyond the top-level wrapper keys (the samples just `pprint()`/log the raw response, they don't parse individual fields) — and, critically, **whether Yonder appears in `GET /aspsps?country=GB` at all**. Neither could be checked from this sandbox: `api.enablebanking.com` is blocked by the same network egress policy as the docs site. This needs a live check once the app is deployed (Vercel has normal network access) — building a simple ASPSP-listing view is the fastest way to get a real answer.

**Method note:** WebFetch to enablebanking.com is blocked by network egress
policy in this environment, so all findings below come from WebSearch
snippets against enablebanking.com docs pages and third-party sources (not
full page reads). Snippets can be stale, incomplete, or paraphrase the real
docs. Everything here should be double-checked against the live docs
(`https://enablebanking.com/docs/api/reference/` and
`https://enablebanking.com/docs/api/quick-start/`) before/while implementing.
Flags of "unconfirmed" mean the search snippets did not give a clear,
citable answer — do not treat those as facts.

---

## 1. JWT structure for `Authorization: Bearer <JWT>`

Found via query: `Enable Banking API JWT authorization header application_id RS256`
(source: [Quick Start with Enable Banking API](https://enablebanking.com/docs/api/quick-start/)).

**Header:**
```json
{
  "typ": "JWT",
  "alg": "RS256",
  "kid": "<application_id>"
}
```
- `alg` is always `RS256` — only RS256 is supported.
- `kid` is the Application ID (UUID) issued when the application/certificate was registered in the Control Panel.

**Payload/claims:**
```json
{
  "iss": "enablebanking.com",
  "aud": "api.enablebanking.com",
  "iat": <issued-at unix timestamp>,
  "exp": <expiry unix timestamp>
}
```
- `iss` is always the literal string `enablebanking.com` (not your own domain — this surprised me, worth re-verifying against the real reference page since it seems backwards for a client-issued JWT, but that's what the snippet says).
- `aud` is always `api.enablebanking.com`.
- Token is signed with the RSA private key downloaded at application-registration time.
- **Maximum allowed TTL is 86400 seconds (24 hours)** between `iat` and `exp`.
- Enable Banking publishes official code samples (Node.js, Python, PHP, C#, Ruby) in a GitHub repo (`enablebanking/enablebanking-api-samples` per one search result) — worth pulling the Node.js sample directly for exact JWT-signing code before implementing, since this is the highest-value place to get it from a primary source rather than a search snippet.

**Confidence:** Medium-high — the header/claims shape and the 24h max TTL were both returned as direct quoted structure from the Quick Start doc snippet, but I have not read the full page, so field order, additional optional claims, and the exact `iss` semantics are unconfirmed nuances.

---

## 2. Base API URL

Query: `Enable Banking API base URL api.enablebanking.com documentation`.

**`https://api.enablebanking.com`**

This is also corroborated by the JWT `aud` claim (`api.enablebanking.com`) and by the transactions endpoint example URL found separately (`GET https://api.enablebanking.com/accounts/{account_id}/transactions`).

**Confidence:** High.

---

## 3. Starting an authorization (`POST /auth`)

Query: `Enable Banking API "POST /auth" aspsp redirect_uri psu_type`
(source: [Quick Start](https://enablebanking.com/docs/api/quick-start/), [FAQ](https://enablebanking.com/docs/faq/)).

Flow, as described:
1. Your app calls `POST /auth` on the API, specifying:
   - `aspsp` — an object identifying the bank. An ASPSP is uniquely identified by the combination of **name + country** (e.g. `{"name": "Lloyds Bank", "country": "GB"}` — exact key/shape unconfirmed, but "name + country" is explicitly stated as the identifying pair).
   - `redirect_uri` — your callback URL; the PSU is redirected back here with extra query-string parameters after authenticating at the bank.
   - `psu_type` — example value seen: `"personal"` (as opposed to presumably `"business"`/`"corporate"`). Used together with `name`, `country`, and `auth_method` to select the exact integration variant for that ASPSP.
   - Presumably also `state` and information about requested access rights/scope (the FAQ snippet mentions "providing information about needed access rights" but didn't give the literal field name — **unconfirmed**, needs verification against the reference page for the exact field, e.g. `access` object with `valid_until`, balances/transactions scope, etc.).
2. Enable Banking responds with a redirect URL (an Enable Banking-hosted or ASPSP-hosted page) that your app should redirect the PSU's browser to.
3. PSU authenticates with their bank; on success they land back on your `redirect_uri` with a `code` query parameter (and likely `state`) appended.

**Confidence:** Medium. The three named parameters (`aspsp`, `redirect_uri`, `psu_type`) are confirmed as being part of the request; the exact JSON body shape, the `state` parameter, and the "access rights" field are **unconfirmed — needs verification during implementation** against the reference/quick-start page directly (not just search snippets).

---

## 4. `POST /sessions` request/response

Query: `Enable Banking API "POST /sessions" code session_id accounts`
(sources: [API reference](https://enablebanking.com/docs/api/reference/), [Quick Start](https://enablebanking.com/docs/api/quick-start/), [enablebanking-api-samples/python_example/account_information.py](https://github.com/enablebanking/enablebanking-api-samples/blob/master/python_example/account_information.py)).

**Request:** JSON body containing the `code` received as a query parameter on your `redirect_uri` after the bank auth step:
```json
{ "code": "<code from redirect>" }
```
This matches the constraint the user already knew going in.

**Response:** includes at minimum:
- `session_id` — unique identifier for the created session, used implicitly (or explicitly, unconfirmed) on subsequent account/balance/transaction calls.
- `accounts` — array of account objects. One search snippet paraphrased fields as: `account_id` (described in the snippet as "IBAN" — likely wrong/imprecise, since UK current accounts use sort-code+account-number not IBAN; more likely `account_id` is Enable Banking's own opaque UID and there's a separate `identification`/`iban`/`other` sub-object per PSD2 conventions), plus `currency`, `details`, `name`, `uid`.

**Confidence:** Low-medium on the exact account object field names. The `session_id` + `accounts` array shape is confirmed at a high level, but the precise per-account field names (is it `uid` or `account_id`? is there a nested `account_id` object with `iban`/`sort_code_account_number` per UK Open Banking convention, matching how UK accounts are usually identified?) are **unconfirmed — needs verification during implementation**, ideally by reading `enablebanking-api-samples/python_example/account_information.py` directly (on GitHub, not blocked) or the reference page.

---

## 5. Balances and transactions endpoints

Query: `Enable Banking API GET accounts balances transactions endpoint response fields amount currency`.

**Balances:**
```
GET https://api.enablebanking.com/accounts/{account_id}/balances
```
Response: a `balances` array, each entry roughly:
```json
{
  "name": "Booked balance",
  "balance_amount": { "currency": "GBP", "amount": "1.23" },
  "balance_type": "CLAV",
  "last_change_date_time": "...",
  "reference_date": "...",
  "last_committed_transaction": "..."
}
```
`balance_type` uses PSD2/Berlin Group-style codes (e.g. `CLAV` = closing available balance, `XPCD` = expected, etc. — this list of codes is a general Berlin Group/PSD2 convention, not something the search confirmed specifically for Enable Banking, so treat exact codes as **unconfirmed** until checked against the reference).

**Transactions:**
```
GET https://api.enablebanking.com/accounts/{account_id}/transactions
```
Fields seen in a separate, more targeted query (`"transaction_amount" "booking_date" "remittance_information"`):
- `transaction_amount` — object with `amount` and `currency`.
- `booking_date` — date the transaction was booked.
- `remittance_information` — free text / reference, "may contain free text, reference number or both."

Not confirmed from search: pagination parameters (likely `date_from`/`date_to` and a `continuation_key` per common Enable Banking pattern, but this is an educated guess, not a citation), transaction status field (`booked` vs `pending`), credit/debit indicator field name, and merchant/counterparty fields.

**Confidence:** Medium on the field names quoted directly in snippets (`balance_amount`, `transaction_amount`, `booking_date`, `remittance_information`); low on anything not explicitly quoted (pagination, status, credit/debit indicator). All of this needs direct verification against `https://enablebanking.com/docs/api/reference/` before writing parsing code.

---

## 6. Listing ASPSPs and confirming Lloyds / Yonder coverage

Query: `Enable Banking API GET /aspsps country GB list banks`.

```
GET https://api.enablebanking.com/aspsps?country=GB
```
`country` is a two-letter ISO 3166 code (`GB` for the UK). Response is a list of ASPSPs with metadata (name, country, presumably `psu_types`, `auth_methods`, logo — not directly confirmed beyond "necessary meta data").

**Lloyds:** Not confirmed directly against Enable Banking's own ASPSP list via search. Lloyds Banking Group (Lloyds Bank, Halifax, Bank of Scotland) is a mainstream UK CMA9 Open Banking participant with standard PSD2 AISP support, and Enable Banking claims 2,700+ banks across 30 European countries with a UK-listing page (openbankingtracker.com lists ~108 institutions reachable through enable:Banking) — so Lloyds being present is **likely but not confirmed by a direct citation**. **Action: query `GET /aspsps?country=GB` directly (or check the Enable Banking sandbox/docs bank-list page) to confirm the exact `name` string Lloyds is listed under** (e.g. it may be split by brand/psu_type such as "Lloyds Bank" vs "Lloyds Bank Business").

**Yonder:** Could not confirm Yonder is available as an Enable Banking ASPSP at all. Search results instead show that Yonder (the credit-card fintech) itself integrates **Yapily** (and separately GoCardless) as its own open-banking data aggregator for a completely different purpose — Yonder uses Yapily to pull applicants'/customers' *other* bank data for credit-risk decisioning and to accept account-to-account repayments. That is the reverse relationship from what's needed here (this app wants to read Yonder's own card balance/transactions as data, not have Yonder read someone else's bank data).

**This is an open, unresolved question, not a minor gap:** it is unconfirmed whether Yonder (as a card issuer) exposes an AISP-consumable Open Banking interface at all, and if it does, whether Enable Banking has it as a listed ASPSP. Since Yonder is a relatively new UK credit-card fintech (not one of the CMA9 mandated banks), it may or may not have voluntarily implemented an AISP-facing PSD2 interface. **Recommended next step before building anything Yonder-specific: hit `GET /aspsps?country=GB` (or `GB` + relevant filters) live and search the returned list for "Yonder"; if absent, contact Enable Banking support or check whether Yonder publishes its own Open Banking developer docs.** Do not assume Yonder is linkable via Enable Banking until this is checked directly.

**Confidence:** High on the `/aspsps?country=GB` endpoint shape; unconfirmed on Lloyds' exact listing; **unconfirmed and possibly false** on Yonder being available via Enable Banking at all.

---

## 7. Session / consent expiry

Query: `Enable Banking API "POST /sessions" code session_id accounts` (session duration detail) and `Enable Banking consent 90 days expiry re-authorization session`.

- One Enable Banking-flavored snippet: "Session validity depends on your bank's maximum consent period, up to 90 days, and you can revoke access at any time by deleting the session."
- Also: "Client applications only need to track session validity and initiate a new authorisation flow when the session (consent) reaches the end of its validity date-time. It is recommended that client applications notify end users (PSUs) about upcoming session expiration in advance and suggest performing a new authorisation before the current session expires." (This phrasing may be generic Open Banking guidance rather than an Enable Banking-specific quote — the source attribution in the snippet was ambiguous between Enable Banking's FAQ and general UK Open Banking standards docs, so treat the *exact wording* as unconfirmed even though the underlying behavior — max ~90 days, re-auth required at expiry — is a solid, well-established PSD2/UK Open Banking norm independent of Enable Banking specifically.)
- The general UK Open Banking industry direction (per FCA policy changes referenced in results) is shifting 90-day *re-authentication* responsibility from banks to TPPs/AISPs, with a lighter-weight "re-confirm consent" flow rather than a full new SCA journey in some cases — but this is evolving industry-wide, and it's **unconfirmed whether/how Enable Banking has implemented this** (e.g. whether their session object exposes an explicit expiry timestamp your app can read, and its field name).

**Practical implication for this app:** plan on treating a session/consent as good for **up to 90 days** (bank-dependent, could be shorter — e.g. some banks default to 90 days but others allow explicit shorter consent windows), track expiry, and prompt the user to re-run the `POST /auth` → bank login → `POST /sessions` flow when it lapses. **The exact field returned by the API that carries the expiry timestamp is unconfirmed — needs verification during implementation** (likely something in the `POST /sessions` response or a separate `GET /sessions/{session_id}` call, per REST convention, but not confirmed by search).

**Confidence:** Medium on the "up to 90 days" figure being roughly right; low on exact API mechanics for reading/tracking that expiry.

---

## Summary of what still needs direct-doc verification before coding

These could not be pinned down precisely from WebSearch snippets alone and should be confirmed by reading the actual reference pages (via browser, since WebFetch to enablebanking.com is blocked here) or the official GitHub sample repo before writing integration code:

1. Exact `POST /auth` request body schema (aspsp object shape, `state`, access-rights/scope object).
2. Exact `POST /sessions` response account object schema (field names for account identifiers — IBAN vs UK sort-code/account-number vs opaque UID).
3. Exact `balance_type` code vocabulary Enable Banking returns.
4. Transactions endpoint: pagination parameters, transaction status field, credit/debit indicator, counterparty/merchant fields.
5. Whether Lloyds Bank is listed (and under what exact `name` string) in `GET /aspsps?country=GB`.
6. **Whether Yonder is available as an Enable Banking ASPSP at all** — the search results only turned up Yonder's own use of Yapily as an aggregator for its own purposes, not evidence of Yonder being consumable as a data source through Enable Banking (or any AISP). This should be checked first, before any Yonder-specific implementation work, since it may mean Yonder simply isn't reachable this way and an alternative (e.g. Yonder's own app export, or a different aggregator) is needed.
7. The exact field name/endpoint for reading a session's consent-expiry timestamp.

## Sources referenced

- [Quick Start with Enable Banking API](https://enablebanking.com/docs/api/quick-start/)
- [API reference | Enable Banking Docs](https://enablebanking.com/docs/api/reference/)
- [Frequently Asked Questions | Enable Banking Docs](https://enablebanking.com/docs/faq/)
- [Whitelisting own accounts for restricted API usage in production](https://enablebanking.com/docs/api/linked-accounts/)
- [Open Banking Specifics by Country | Enable Banking Docs](https://enablebanking.com/docs/markets/)
- [enablebanking/enablebanking-api-samples (GitHub) — python_example/account_information.py](https://github.com/enablebanking/enablebanking-api-samples/blob/master/python_example/account_information.py)
- [Enable Banking Changelog – May 2025 Platform Updates](https://enablebanking.com/blog/2025/06/05/changelog-may-2025)
- [openbankingtracker.com — enable:Banking bank integrations](https://www.openbankingtracker.com/api-aggregators/enablebanking)
- [Yapily blog — Yonder open banking partnership](https://www.yapily.com/blog/yonder-open-banking-partnership)
- [Yapily blog — Open banking case study: Yonder](https://www.yapily.com/blog/open-banking-case-study-yonder)
- [FStech — Yonder Uses Open Banking To Expand Credit Access](https://www.fstech.co.uk/fst/Yonder_Uses_Open_Banking_To_Expand_Credit_Access.php)
- [GoCardless — Yonder customer story](https://gocardless.com/stories/yonder)
