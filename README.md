# MDAC Filler

A Tampermonkey userscript that fills the Malaysia Digital Arrival Card (MDAC) registration
form from a saved traveller profile. It never solves the puzzle and never presses Submit.
You do both, after reading the review table.

Spec: [SPEC.md](SPEC.md). Build status: v0.1.2, all spec tests green on the live form
(never submitted), awaiting the first real trip.

## Install (once)

1. Install Tampermonkey for Chrome from the Chrome Web Store.
2. Open the raw script URL. Tampermonkey opens its install dialog. Press Install.
   `https://raw.githubusercontent.com/MrW3b/mdac-filler/main/mdac-filler.user.js`
   Until the repo is on GitHub, drag `mdac-filler.user.js` from this folder onto the
   Tampermonkey dashboard instead.
3. Open the MDAC registration page. A panel appears bottom-right.
4. Press Edit profiles, fill in Chris and Leah, press Save for each.

Profiles are stored in Tampermonkey's own storage on this Mac only.

## Every trip

1. Open `https://imigresen-online.imi.gov.my/mdac/main?registerMain`.
2. Pick the traveller, type the arrival date (today to today plus two days, Singapore
   time), check the trip fields, press Fill form.
3. Read the review table. Red rows mean do not submit: fix and fill again.
4. Press "Looks right, go to puzzle". Solve the puzzle by hand.
5. Press the site's SUBMIT.

## What it never does

- Press Submit, call the site's validation, or set the site's puzzle flag.
- Drag the puzzle, fetch puzzle images, or call the captcha endpoint.
- Store the arrival date. You type it every time.
- Write outside Tampermonkey storage.

## If the panel says "Form changed, not filling"

The government form drifted from the selector map. Press Copy report and paste it into a
Jarvis session. Every selector lives in the `MAP` constant at the top of the script.

## Development

```
npm install            # eslint only
npm run lint
pre-commit install     # gitleaks + eslint on every commit
```

Test plan: SPEC.md section 12. Live dry runs never press Submit.
