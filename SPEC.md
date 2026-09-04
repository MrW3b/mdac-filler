# MDAC Filler, Build Spec (v0.1 draft, 2026-09-04)

Single binding source of truth for the Malaysia Digital Arrival Card (MDAC) userscript.
Amend-first rule: nothing ships that is not in this document. If reality forces a
deviation, amend the spec, then the code. Nothing is built until Chris approves v0.1.

Grounding artifacts (fetched from the live form on 2026-09-04, session tokens scrubbed):

- `reference/form-controls-2026-09-04.txt` (every live control, attributes, small option lists)
- `reference/inline-scripts-2026-09-04.js` (the page's own validation, datepickers, captcha init)
- `reference/ajax-endpoints-2026-09-04.md` (the dropdown re-render hooks and what they return)
- `reference/longbow.slidercaptcha-2026-09-04.js` (the puzzle library, for the handoff design)

## 0. Decision record

| Decided | Value | Where |
|---|---|---|
| Shell | Tampermonkey userscript, one file | memory 2026-08-10, unchanged |
| Runs on | `https://imigresen-online.imi.gov.my/mdac/main?registerMain` only | Section 2 |
| Profile storage | Tampermonkey storage (`GM_getValue` / `GM_setValue`), never the site's localStorage | Section 5 |
| Page access | `unsafeWindow.jQuery` for the datepickers, plain DOM for everything else | Section 6 |
| CAPTCHA | Never touched. Human solves the puzzle, human presses the site's Submit | Section 8 |
| Automation floor | gitleaks pre-commit hook + super-linter CI. No release-please, no dependabot (zero runtime deps) | Section 11 |

Calls I made that Chris can override without re-planning (Section 13 lists them).

## 1. Goal and non-goals

Goal: on every Malaysia entry, Chris opens the MDAC registration page, picks a traveller,
confirms the trip fields, presses Fill, checks the review panel, solves the puzzle, presses
the site's Submit. Total human effort: under one minute, zero retyping of passport data.

Non-goals (v1):

- Solving, bypassing, or pre-filling the CAPTCHA in any way.
- Pressing Submit, calling `validateSubmit()`, or setting `verifyResult`.
- Any other MDAC page (check registration, visit pass, eGate status).
- Mobile browsers, Safari, Firefox. Chrome desktop with Tampermonkey only.
- Syncing profiles between machines. Export/import JSON is v2 if wanted.

## 2. Hard constraints (the fence)

1. This is an official immigration declaration. The script fills fields; the human
   reviews and submits. The script never triggers a form submission by any path.
2. The script never touches `#submit`, `#reset`, `#sliderCapture`, `#captcha`, or the
   hidden Stripes tokens `_sourcePage`, `__fp`, `hdCurrLang`, `mdacVisaCountry`.
3. Review gate is mandatory: after filling, the panel shows every value it set and every
   mismatch, and a red state blocks nothing on the site but tells Chris not to submit.
4. Arrival date is confirmed by the human every trip. It is never remembered.
5. All selectors live in ONE constant (`MAP`) at the top of the file. A drift check runs
   on every page load before any fill (Section 8.1).
6. No passport data in the repo, in logs, in console output, or in error messages.
7. Beginner-friendly code: header comment per section, a WHY comment on every wait,
   every dispatched event, and every gate. No em-dashes in code, comments, or UI copy.

## 3. Ground truth: form anatomy (live fetch, 2026-09-04)

- One form, `form[name="permohonan"]`, `method="post"`, `action="/mdac/register"`,
  `onsubmit="return validateSubmit();"`. The Java Stripes framework, session-bound.
- 26 live controls plus 12 hidden inputs. Every id is unique in the live DOM (the
  duplicates in the raw HTML are inside HTML comments).
- Text inputs block paste (`onpaste="return false"`) and filter keypresses. Programmatic
  `value` assignment bypasses both, so the script must apply the same rules itself.
- `.uppercase` inputs are uppercased on blur by the page. The script uppercases first.
- Six selects have hidden mirror inputs (`sNation`, `sRegion`, `sState`, `sCity`, `sStay`,
  `sMode`, `sEmbark`) updated by jQuery `change` handlers. The script must dispatch a
  bubbling `change` event after setting any select, or the mirrors stay empty.
- Four date inputs are `readonly` bootstrap-datepickers, format `dd/mm/yyyy`:
  - `#dob` endDate `-1d`
  - `#passExpDte` startDate today
  - `#arrDt` startDate today, endDate `+2d` (this is the "within 3 days" rule)
  - `#depDt` startDate today; on `#arrDt` changeDate the page sets depDt startDate to
    the arrival date and CLEARS `#depDt`. So arrival must be filled before departure.
- Dropdown re-renders (all via `$.get`, see `reference/ajax-endpoints-2026-09-04.md`):
  - `#nationality` change AND `#pob` change both replace the whole `#region` option
    list with that country's dialling code preselected. So region is set LAST, after
    both AJAX calls settle, otherwise a place of birth that differs from the phone
    country overwrites the phone code.
  - `#accommodationState` change replaces the `#accommodationCity` option list.
  - `#accommodationCity` change calls a postcode endpoint that has no visible effect.
- `#formAccommodation` is hidden on load and shown once `searchMdacVisaCountry` returns
  `ALL` (observed). Treat accommodation as always required; verify visibility anyway.
- CAPTCHA: `sliderCaptcha` puzzle in `#captcha`, verified server-side at `/mdac/captcha`.
  On success the page sets `verifyResult = true` and enables `#submit`; on refresh or
  fail it disables `#submit`. `validateSubmit()` refuses when `verifyResult` is null.
  Google reCAPTCHA `api.js` is loaded but no widget exists on this page.
- Page-side `validateSubmit()` checks, in order: name, passport, nationality, sex, dob,
  passport expiry, email, region, mobile, arrival, departure, confirm email, mode,
  embark, vessel, then accommodation (stay, address1 non-empty and at least 3 words,
  state, city, postcode 5 digits), then captcha.

## 4. Field map (profile field to selector)

Fill methods: `text` = set value, dispatch `input` then `blur`. `select` = set value,
dispatch `change`, then verify `el.value` equals target. `date` = `jQuery(el).datepicker('update', 'DD/MM/YYYY')`
then verify `el.value` equals target (a value outside the picker's range comes back
different, which is how out-of-window dates are caught).

### 4.1 Traveller fields (stored per profile)

| Profile key | Selector | Method | Constraint the script enforces before fill | Notes |
|---|---|---|---|---|
| `name` | `#name` | text | `^[A-Z ]{1,60}$` | Page filter: letters and space only |
| `passportNo` | `#passNo` | text | `^[A-Z0-9]{1,12}$` | |
| `dob` | `#dob` | date | valid date, before today | Stored as `DD/MM/YYYY` |
| `nationality` | `#nationality` | select | value exists in option list | ISO3, e.g. `DEU`, `SGP` |
| `placeOfBirth` | `#pob` | select | value exists in option list | ISO3 |
| `sex` | `#sex` | select | `1` or `2` | `1` MALE, `2` FEMALE |
| `passportExpiry` | `#passExpDte` | date | valid date, after today | Warn (yellow) if less than 6 months after arrival |
| `email` | `#email` | text | page regex `^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$` | Same value goes to confirm |
| `email` | `#confirmEmail` | text | equals `email` | Page blocks paste and copy; script sets value directly |
| `phoneCountryCode` | `#region` | select | value exists in option list | Dialling code without plus, e.g. `65`. Set LAST (Section 6) |
| `mobile` | `#mobile` | text | `^[0-9]{1,12}$` | No plus, no country code |

### 4.2 Trip fields (asked every time, last values remembered except arrival)

| Trip key | Selector | Method | Constraint | Remembered |
|---|---|---|---|---|
| `arrivalDate` | `#arrDt` | date | today to today+2 inclusive, in Singapore local time | NO, always typed |
| `departureDate` | `#depDt` | date | on or after arrival | no (derived default: arrival + last trip length) |
| `transportNo` | `#vesselNm` | text | `^[A-Z0-9/\-@(),' ]{1,30}$` | yes |
| `travelMode` | `#trvlMode` | select | `1` AIR, `2` LAND, `3` SEA | yes |
| `embarkation` | `#embark` | select | ISO3 exists in list | yes, default `SGP` |
| `stayType` | `#accommodationStay` | select | `01` hotel, `02` friends/relatives, `99` others | yes |
| `address1` | `#accommodationAddress1` | text | 3+ space-separated words, not NA/N/A/NULL/NIL, chars `[A-Z0-9/\-@(),' ]`, max 100 | yes |
| `address2` | `#accommodationAddress2` | text | same charset, max 100, optional | yes |
| `stateCode` | `#accommodationState` | select | `01`..`16` (`14` WP Kuala Lumpur, `10` Selangor) | yes |
| `cityCode` | `#accommodationCity` | select | must exist in the AJAX-loaded list for `stateCode` | yes |
| `postcode` | `#accommodationPostcode` | text | `^[0-9]{5}$` | yes |

### 4.3 Never touched

`#submit`, `#reset`, `#captcha`, `#sliderCapture`, `#hdCurrLang`, `#mdacVisaCountry`,
`_sourcePage`, `__fp`, and all `s*` mirror inputs (they update themselves on `change`).

## 5. Profile store

Storage: Tampermonkey `GM_getValue('mdacFiller', ...)`. Reason: passport data must not sit
in the gov site's own localStorage where any script on that origin can read it. Tampermonkey
storage is extension-scoped and stays on this machine.

Schema (one JSON blob, version-stamped):

```json
{
  "version": 1,
  "profiles": {
    "Chris": {
      "name": "", "passportNo": "", "dob": "", "nationality": "DEU",
      "placeOfBirth": "", "sex": "1", "passportExpiry": "", "email": "",
      "phoneCountryCode": "65", "mobile": ""
    },
    "Leah": { "...": "same keys, nationality SGP" }
  },
  "lastTrip": {
    "transportNo": "", "travelMode": "1", "embarkation": "SGP",
    "stayType": "01", "address1": "", "address2": "",
    "stateCode": "14", "cityCode": "1401", "postcode": "",
    "tripLengthDays": 3
  }
}
```

Rules:

- Values are stored already normalised (uppercase, trimmed) so fill and review show
  exactly what will be posted.
- `arrivalDate` is never stored. `departureDate` is never stored; `tripLengthDays` is.
- A profile is edited in the panel, one field per input, saved on Save. No free-text JSON
  editing in v1.
- Deleting a profile asks once in the panel (not a browser `confirm()`, which would
  block the automation tooling used during testing).

## 6. Fill algorithm (ordered, with waits)

Every wait is a poll (100 ms) with a 5 s timeout; timeout is a red mismatch, not a throw.

1. Drift check (Section 8.1). Abort the fill on any failure.
2. Traveller text fields: `name`, `passportNo`, `email`, `confirmEmail`, `mobile`.
3. `sex` select.
4. `nationality` select, dispatch change, WAIT until `#region` contains an option with
   `selected` whose value matches that country (the AJAX re-render landed).
5. `placeOfBirth` select, dispatch change, WAIT again the same way.
6. `phoneCountryCode` select, dispatch change. Verify `#region.value`.
7. Dates `dob`, `passportExpiry` via datepicker update. Verify each.
8. `arrivalDate` via datepicker update. Verify. Then `departureDate`. Verify.
   WHY this order: the page clears departure whenever arrival changes.
9. `travelMode`, `embarkation`, `transportNo`.
10. `stayType`, `address1`, `address2`.
11. `stateCode` select, dispatch change, WAIT until `#accommodationCity` has more than
    one option. Then `cityCode` select, dispatch change. Verify `cityCode` landed
    (a stale city code for a changed state is the likeliest drift).
12. `postcode`.
13. Re-read every filled control and build the review table (Section 8.2).
14. Scroll `#captcha` into view. Enter the HANDOFF state (Section 8.3).

The script never sets a value it cannot verify by reading it back. A mismatch is shown, the
fill continues to the end, and the panel state is red.

## 7. UI: the panel

Fixed-position panel, bottom-right, 320 px wide, above the page's own content, draggable
is NOT required. Plain DOM and inline CSS, no framework. All copy below is frozen.

States and copy:

| State | Header | Body |
|---|---|---|
| `ready` | `MDAC Filler` | Traveller dropdown, trip fields, `Fill form` button, `Edit profiles` link |
| `drift` | `Form changed, not filling` | List of failed checks; `Copy report` button |
| `filling` | `Filling...` | Progress line `Step n of 14: <label>` |
| `review` | `Review before you submit` | Table label / value, mismatches in red, warnings in yellow; button `Looks right, go to puzzle` |
| `handoff` | `Solve the puzzle, then press SUBMIT` | `The script never presses Submit. Check the arrival date once more: <date>` |
| `verified` | `Puzzle solved. Review, then press SUBMIT` | Same review table, collapsed |

Trip inputs in `ready`: arrival date (empty every time, native `type="date"`), departure
date (prefilled from arrival + `tripLengthDays` once arrival is typed), transport number,
mode, embarkation, stay type, address 1, address 2, state, city (option list fetched from
the same `retrieveRefCity` endpoint the page uses, so the codes always match), postcode.

Panel detects the puzzle result by a `MutationObserver` on `#captcha` watching for the
`sliderContainer_success` class, and moves to `verified`. It never reads `verifyResult`
for anything but display, never writes it.

## 8. Gates

### 8.1 Drift check (runs on every page load, before the panel is offered)

For each entry in `MAP`: the element exists, is the expected tag, and for selects, the
expected sentinel option values exist (`sex` has `1` and `2`; `trvlMode` has `1`,`2`,`3`;
`accommodationStay` has `01`,`02`,`99`; `accommodationState` has `14`; `nationality` and
`embark` have `DEU` and `SGP`; `region` has `65` and `49`). Also: `form[name="permohonan"]`
exists, `#captcha` exists, `window.validateSubmit` is a function, `#formAccommodation`
exists. Any failure puts the panel in `drift` with the failed check names. This is the
"live-system check on the selector map" from the build process, made permanent.

### 8.2 Review before submit

Table of every filled field, value read back from the DOM after fill, not from the profile.
Red rows: read-back differs from target, or a wait timed out. Yellow rows: passport expiry
less than 6 months after arrival; departure more than 30 days after arrival; email domain
not in the profile's previous value. Red means: do not submit, fix the profile or the
form, fill again. The panel says so in one line.

### 8.3 Arrival date confirmation

The arrival date is typed by the human each trip in the panel, validated against the
today-to-today+2 window in Singapore time before fill, and shown again in the `handoff`
header copy. If the page's datepicker returns a different value on read-back, red row.

### 8.4 CAPTCHA handoff

The script scrolls the puzzle into view and stops. It does not simulate drags, does not
call the captcha endpoint, does not fetch puzzle images, does not touch `#submit`.

## 9. Error handling

- All page-side failures (AJAX timeout, missing option, datepicker refusal) become red
  review rows. Nothing throws to the console with field values in it.
- If `unsafeWindow.jQuery` or its `datepicker` plugin is missing, that is a drift failure.
- A profile with a missing required key is refused at Fill with the key name.
- The site's own `alert()` calls still fire on blur for a bad email; the script validates
  email first so this should not occur, and if it does the alert is the page's, not ours.

## 10. Security and privacy

- Profiles live only in Tampermonkey storage on this Mac.
- The repo contains no personal data. gitleaks runs pre-commit; a custom rule matches
  passport-like tokens next to the words passport or passNo.
- `@match` is exactly the registration URL. `@connect` is not needed (same-origin `fetch`
  for the city list). `@grant GM_getValue`, `GM_setValue`, `unsafeWindow` only.
- Script header carries `@updateURL` and `@downloadURL` pointing at the raw file on
  GitHub so a selector patch reaches the browser as a Tampermonkey update.

## 11. File layout and automation floor

```
mdac-filler/
  SPEC.md                         this file
  mdac-filler.user.js             the whole build, one file, sections in Section 6 order
  reference/                      grounding artifacts, dated, never edited
  .pre-commit-config.yaml         gitleaks (with the passport rule) + eslint
  .github/workflows/lint.yml      super-linter, JavaScript only
  package.json                    eslint as the only devDependency, no runtime deps
  README.md                       install (Tampermonkey, then the raw URL), one screen
```

Lean call: no release-please, no dependabot, no test framework. The test plan is a live
dry-run protocol (Section 12), because the only thing that can break is the form itself.

Tampermonkey status on this Mac (checked 2026-09-04): not installed in any of the four
Chrome profiles. Install is step 0 of the README.

## 12. Test plan (live form, never submitted)

1. Drift check green on a fresh load. Then rename one key in `MAP` locally, reload,
   confirm `drift` state names it, restore.
2. Fill with the Chris profile and a valid trip. Every review row green. Screenshot.
3. Fill with arrival = today+3. Panel refuses before fill with the window message.
4. Fill with place of birth different from phone country. `#region` reads back the
   phone country code, not the birth country (the ordering bug this spec exists for).
5. Change state from 14 to 10 in the panel, fill, confirm city list reloads and the
   Selangor city code lands.
6. Press the site's Reset. Confirm the panel returns to `ready` and profiles are intact.
7. Solve the puzzle by hand. Panel moves to `verified`. Do NOT press Submit in testing.
8. `/code-review` once on the userscript, then `/simplify`. Then the first real trip is the
   acceptance test, with Chris pressing Submit.

### 12.1 Results, 2026-09-04 (Playwright against the live form, fake profile, never submitted)

Harness: the script injected into the live page with `GM_getValue` / `GM_setValue` shimmed
to an in-memory object and `unsafeWindow` set to the page window. Nothing else changed.

| Test | Result |
|---|---|
| 1 Drift check | PASS. Renaming `#passNo` to `#passNoX` in `MAP` gives `Form changed, not filling` with `passportNo: #passNoX is missing`; no Fill button offered |
| 2 Happy path | PASS. 22 rows read back green, hidden mirror inputs all populated, the page's `verifyResult` stays null, `#submit` untouched |
| 3 Arrival today+3 | PASS. Refused before fill with the window message; typed trip fields kept in the panel |
| 4 Birth country differs from phone country | PASS. Place of birth PHL, phone code reads back `65` |
| 5 State change | PASS. State 10 reloads the city list, city 1038 SHAH ALAM lands, mirrors follow |
| 6 Site Reset | PASS. The page alerts `Please enter Name.` (its own validation), fields clear, panel returns to ready, profiles intact |
| 7 Puzzle | Observer verified by toggling the success class in the test browser only; the real puzzle is Chris's job on the first trip |
| Extra | Panel is invisible on the MDAC home page. Profile editor: bad passport refused with the rule, save persists, add and delete work with the in-panel confirm |

Bug found and fixed by test 3: the panel appended arrays and nulls to the DOM as text, so
the problems list never rendered and the review showed a stray `null`. Fixed with a
`mount()` helper that flattens and skips empties.

Re-run on v0.1.1 (after the `/code-review` amendments in Section 15, A6): all of the above
green again, plus: the panel's arrival min/max now equal the page picker's window; a
simulated late swap of the phone-code list after review was re-applied to `65` with the
mirror input following and the row turned yellow with the note; the same for the city list
while in `handoff`; switching traveller inside Edit without saving no longer leaks into the
next Edit.

## 13. Calls Chris can override

- Default embarkation `SGP`, mode `1` AIR, state `14` WP Kuala Lumpur, city `1401`.
- Two profiles seeded by name only: Chris and Leah. Values entered by Chris in the panel.
- Departure defaults to arrival + last trip length rather than being remembered as a date.
- Yellow warning threshold: passport expiry under 6 months after arrival.
- Repo name `mdac-filler` at `~/mdac-filler`, private GitHub repo under MrW3b.

## 14. Flip conditions (unchanged from 2026-08-10)

- Hand it to people who will not install Tampermonkey: rebuild as a Playwright app.
- Make it a Swift learning project: native.
- The form moves behind login or to a SPA framework: re-fetch, re-map, amend Section 3.

## 15. Amendments made during the build (2026-09-04)

- A1, Section 2 and 10. `@match` covers `/mdac/main*` and `/mdac/register*`, not only the
  registration URL. Reason: a server-side validation failure re-renders the same form at
  `/mdac/register` (that is what the hidden `s*` mirror inputs are for), and that is where
  a filler is wanted most. The script stays invisible unless the URL is the registration
  page or `/mdac/register` AND `form[name="permohonan"]` exists (home and confirmation
  pages show nothing). The drift check still guards every fill.
- A2, Section 7. An `edit` panel state (header `Edit profiles`) with Save, Back, Delete
  profile (in-panel confirm), and Add traveller. Implied by Section 5, now explicit.
- A3, Section 3 and 6. The page's bootstrap-datepicker (checked 2026-09-04): `update(string)`
  drops any date outside startDate..endDate, so the value reads back empty, and it does NOT
  fire `changeDate`. So a scripted arrival never clears departure. Arrival-first order kept.
- A4, Section 7. The site's Reset button is a submit input that calls `resetSearch()` and
  then trips the page's own validation alert. The panel listens for the click and returns
  to `ready`. It never clicks Reset itself.
- A5, Section 6 step 14 and Section 7. A fill ends in the `review` state with the puzzle
  scrolled into view behind the panel. The review button enters `handoff`, which scrolls
  again and starts watching the puzzle for its success class.
- A6, from the `/code-review` pass (2026-09-04), v0.1.1:
  - Section 6 steps 4 and 5: the wait condition is "the page replaced the option list"
    (a token on the first option is gone), not "the selected option matches the country",
    because the script has no country-to-dialling-code table. To close the gap that
    leaves (a slow response landing after the review turned green), a late-reload guard
    watches the phone-code and city lists from `review` onwards: if the page swaps one,
    the reviewed value is re-applied, the page is told (change event), the row is marked
    with a yellow note, and the review re-renders.
  - Section 3 and 4.2: the accommodation block's visibility is checked at fill time
    (waiting up to 5 s for the page's own page-load call). A hidden block makes every
    accommodation row red with the note `the form hides the accommodation section`.
  - Section 8.3: the arrival window is read from the page's own datepicker
    (`startDate`..`endDate`, the browser's calendar, frozen at page load), with Singapore
    time only as a fallback. Panel copy becomes: `Arrival must be between A and B, the
    form's own window. If that looks stale, reload the page.`
  - Section 7: a fill in progress blocks a second fill; a site Reset clicked during a
    fill is queued and applied after it. The store is re-read before the post-fill write
    so an edit saved meanwhile is not clobbered. Any exception during a fill returns the
    panel to `ready` with `Filling stopped at "<step>" (<error kind>). Reload the page and
    fill again.` and the typed trip kept; no value is logged.
  - Section 5: the email-domain warning compares against the same traveller's last fill
    (`emailDomains` map in the store), not a global last value.
  - Section 8.1: the puzzle widget and its success class are `MAP` entries; the success
    class is `optional` (exempt from the presence check, present only once solved).
  - Section 8.2: the passport warning uses six calendar months, not 183 days.
  - Panel state context is per state; only `review` hands its rows to `handoff`.
- A7, from the `/simplify` pass (2026-09-04), v0.1.2, behaviour preserved except where noted:
  - Section 6 steps 4, 5, 11, 13: the wait condition is now "the page is quiet", read
    from the page's own jQuery request counter (`jQuery.active === 0`). Every reload on
    this page is a jQuery `$.get` and the counter drops only after the callback that
    swaps the list has run, so zero in flight means every reload landed, for all four
    endpoints. The token-marked first option is gone. Read-back (step 13) also waits for
    quiet. The drift check requires the counter to exist. The late-reload guard from A6
    stays as the safety net for a request past the timeout or a page change that defers
    its AJAX.
  - Section 8.2: a hidden field is judged at read-back, per element (no `offsetParent`),
    with the note `the form hides this field`. Step 10 still waits for the accommodation
    block to appear.
  - Section 7 (changes A6): no fill-in-progress flags. The Fill button exists only in
    `ready` and the state is `filling` before the first await, so a second click does
    nothing. A site Reset clicked during a fill is ignored by the panel; the cleared
    fields simply read back red and the review says fill again.
  - Section 5: every store write goes through one read-fresh-then-write helper.
  - Section 6 step 1 is the real drift check; its failures route to the `drift` state.
  - The panel's city list is fetched once per state for the page's life.
