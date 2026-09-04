// ==UserScript==
// @name         MDAC Filler
// @namespace    https://github.com/MrW3b/mdac-filler
// @version      0.1.2
// @description  Fills the Malaysia Digital Arrival Card registration form from a saved traveller profile. Never touches the puzzle or Submit.
// @author       Chris Weber
// @match        https://imigresen-online.imi.gov.my/mdac/main*
// @match        https://imigresen-online.imi.gov.my/mdac/register*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/MrW3b/mdac-filler/main/mdac-filler.user.js
// @downloadURL  https://raw.githubusercontent.com/MrW3b/mdac-filler/main/mdac-filler.user.js
// ==/UserScript==

/*
  MDAC Filler. Read SPEC.md first; this file follows its section numbers.

  What this file does, in one paragraph: on the MDAC registration page it shows a small
  panel. You pick a traveller, type the arrival date, confirm the trip details, press
  Fill. The script writes the saved values into the government form, waits for the
  page's own dropdown reloads, reads everything back, and shows you a review table.
  Then it scrolls to the puzzle and stops. You solve the puzzle and press the site's
  own Submit button. The script never presses Submit and never touches the puzzle.

  Sections in this file:
    1. Constants: MAP (every selector in one place), COPY (frozen UI strings), RULES
    2. Storage (Tampermonkey storage only, never the site's localStorage)
    3. Dates (the form's own arrival window; DD/MM/YYYY on the form, YYYY-MM-DD in the panel)
    4. Validation (the page's own rules, applied before we touch the form)
    5. Page helpers (set text / select / date, wait for the page to go quiet)
    6. Drift check (spec 8.1)
    7. Fill engine (spec 6, fourteen steps) and the late-reload guard
    8. Panel (spec 7)
    9. Boot
*/

/* global unsafeWindow, GM_getValue, GM_setValue */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------------
     1. Constants
     --------------------------------------------------------------------------- */

  // The real page window. Needed for the page's jQuery (datepicker, request counter).
  const W = unsafeWindow;

  // Set to true only while debugging. Even then, nothing personal is ever logged.
  const DEBUG = false;

  const STORAGE_KEY = 'mdacFiller';
  const WAIT_MS = 5000; // how long we wait for the page's AJAX reloads to settle
  const POLL_MS = 100;
  const CITY_ENDPOINT = '/mdac/register?retrieveRefCity&state='; // the page's own city list call
  const NOT_ALLOWED_ADDRESS = ['NA', 'N/A', 'NULL', 'NIL']; // the page rejects these

  // Every selector lives here and nowhere else. If the government form changes,
  // this is the only place to patch. The drift check (section 6) verifies each entry
  // on every page load before the panel is offered. `optional` entries appear only
  // at certain moments (the solved puzzle) and are exempt from the presence check.
  const MAP = {
    form: { sel: 'form[name="permohonan"]', tag: 'FORM' },
    captcha: { sel: '#captcha', tag: 'DIV' },
    puzzleWidget: { sel: '#captcha .sliderContainer', tag: 'DIV' },
    puzzleSolved: { sel: '#captcha .sliderContainer_success', tag: 'DIV', optional: true },
    accommodation: { sel: '#formAccommodation', tag: 'DIV' },
    submit: { sel: '#submit', tag: 'INPUT' }, // checked for presence only, never written
    reset: { sel: '#reset', tag: 'INPUT' }, // listened to only, never clicked
    name: { sel: '#name', tag: 'INPUT' },
    passportNo: { sel: '#passNo', tag: 'INPUT' },
    dob: { sel: '#dob', tag: 'INPUT' },
    nationality: { sel: '#nationality', tag: 'SELECT', sentinels: ['DEU', 'SGP'] },
    placeOfBirth: { sel: '#pob', tag: 'SELECT', sentinels: ['DEU', 'SGP'] },
    sex: { sel: '#sex', tag: 'SELECT', sentinels: ['1', '2'] },
    passportExpiry: { sel: '#passExpDte', tag: 'INPUT' },
    email: { sel: '#email', tag: 'INPUT' },
    confirmEmail: { sel: '#confirmEmail', tag: 'INPUT' },
    phoneCountryCode: { sel: '#region', tag: 'SELECT', sentinels: ['65', '49'] },
    mobile: { sel: '#mobile', tag: 'INPUT' },
    arrivalDate: { sel: '#arrDt', tag: 'INPUT' },
    departureDate: { sel: '#depDt', tag: 'INPUT' },
    transportNo: { sel: '#vesselNm', tag: 'INPUT' },
    travelMode: { sel: '#trvlMode', tag: 'SELECT', sentinels: ['1', '2', '3'] },
    embarkation: { sel: '#embark', tag: 'SELECT', sentinels: ['DEU', 'SGP'] },
    stayType: { sel: '#accommodationStay', tag: 'SELECT', sentinels: ['01', '02', '99'] },
    address1: { sel: '#accommodationAddress1', tag: 'INPUT' },
    address2: { sel: '#accommodationAddress2', tag: 'INPUT' },
    stateCode: { sel: '#accommodationState', tag: 'SELECT', sentinels: ['14'] },
    cityCode: { sel: '#accommodationCity', tag: 'SELECT' },
    postcode: { sel: '#accommodationPostcode', tag: 'INPUT' },
  };

  const LABELS = {
    name: 'Name',
    passportNo: 'Passport No.',
    dob: 'Date of Birth',
    nationality: 'Nationality',
    placeOfBirth: 'Place of Birth',
    sex: 'Sex',
    passportExpiry: 'Passport Expiry',
    email: 'Email',
    confirmEmail: 'Confirm Email',
    phoneCountryCode: 'Country / Region Code',
    mobile: 'Mobile No.',
    arrivalDate: 'Date of Arrival',
    departureDate: 'Date of Departure',
    transportNo: 'Flight / Vessel No.',
    travelMode: 'Mode of Travel',
    embarkation: 'Last Port of Embarkation',
    stayType: 'Accommodation of Stay',
    address1: 'Address 1',
    address2: 'Address 2',
    stateCode: 'State',
    cityCode: 'City',
    postcode: 'Postcode',
  };

  const PROFILE_KEYS = ['name', 'passportNo', 'dob', 'nationality', 'placeOfBirth', 'sex',
    'passportExpiry', 'email', 'phoneCountryCode', 'mobile'];
  // Trip keys that are remembered between trips. Arrival and departure are never stored.
  const TRIP_MEMORY_KEYS = ['transportNo', 'travelMode', 'embarkation', 'stayType',
    'address1', 'address2', 'stateCode', 'cityCode', 'postcode'];
  // Panel states that show the review rows (and keep the late-reload guard alive).
  const ROW_STATES = ['review', 'handoff', 'verified'];

  // Frozen UI copy (spec 7). Change the spec first if any of this changes.
  const COPY = {
    ready: { header: 'MDAC Filler', fill: 'Fill form', edit: 'Edit profiles', traveller: 'Traveller' },
    drift: { header: 'Form changed, not filling', copy: 'Copy report', copied: 'Copied' },
    filling: { header: 'Filling...', step: (n, total, label) => `Step ${n} of ${total}: ${label}` },
    review: {
      header: 'Review before you submit',
      go: 'Looks right, go to puzzle',
      red: 'Red rows: do not submit. Fix the profile or the form, then fill again.',
      again: 'Back',
    },
    handoff: {
      header: 'Solve the puzzle, then press SUBMIT',
      body: (date) => `The script never presses Submit. Check the arrival date once more: ${date}`,
      details: 'Show what was filled',
    },
    verified: { header: 'Puzzle solved. Review, then press SUBMIT' },
    edit: {
      header: 'Edit profiles', save: 'Save', saved: 'Saved', del: 'Delete profile',
      really: 'Really delete this profile?', yes: 'Yes, delete', no: 'No', back: 'Back',
      newName: 'New traveller name', add: 'Add',
    },
    problems: 'Fix these before filling:',
    arrivalWindow: (from, to) => `Arrival must be between ${from} and ${to}, the form's own window. If that looks stale, reload the page.`,
    stopped: (label, kind) => `Filling stopped at "${label}" (${kind}). Reload the page and fill again.`,
    hiddenField: 'the form hides this field',
    reloadTimeout: (what) => `${what} did not reload in time`,
    lateReload: 'The form reloaded this list after the fill; the value was re-applied.',
    warn: {
      expiry: 'Passport expires less than 6 months after arrival.',
      longStay: 'Departure is more than 30 days after arrival.',
      emailDomain: 'Email domain differs from this traveller\'s last fill.',
    },
  };

  // The page's own character rules (see reference/inline-scripts-2026-09-04.js).
  // Programmatic value assignment bypasses the page's keypress filters, so we apply
  // the same rules ourselves before writing anything.
  const RULES = {
    name: /^[A-Z ]{1,60}$/,
    passportNo: /^[A-Z0-9]{1,12}$/,
    email: /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/,
    mobile: /^[0-9]{1,12}$/,
    transportNo: /^[A-Z0-9/\-@(),' ]{1,30}$/,
    address1: /^[A-Z0-9/\-@(),' ]{1,100}$/,
    address2: /^[A-Z0-9/\-@(),' ]{0,100}$/,
    postcode: /^[0-9]{5}$/,
    dmy: /^\d{2}\/\d{2}\/\d{4}$/,
  };

  function log(...args) {
    if (DEBUG) console.log('[mdac-filler]', ...args);
  }

  /* ---------------------------------------------------------------------------
     2. Storage
     --------------------------------------------------------------------------- */

  function blankProfile(nationality, sex) {
    return {
      name: '', passportNo: '', dob: '', nationality, placeOfBirth: nationality, sex,
      passportExpiry: '', email: '', phoneCountryCode: '65', mobile: '',
    };
  }

  function defaultStore() {
    return {
      version: 1,
      profiles: { Chris: blankProfile('DEU', '1'), Leah: blankProfile('SGP', '2') },
      lastProfile: 'Chris',
      lastTrip: {
        transportNo: '', travelMode: '1', embarkation: 'SGP', stayType: '01',
        address1: '', address2: '', stateCode: '14', cityCode: '1401', postcode: '',
        tripLengthDays: 3,
      },
      // Email domain seen at each traveller's last fill, for the yellow warning.
      emailDomains: {},
    };
  }

  function loadStore() {
    let data = null;
    const raw = GM_getValue(STORAGE_KEY, null);
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = null; }
    }
    if (!data || data.version !== 1 || !data.profiles) data = defaultStore();
    if (!data.emailDomains) data.emailDomains = {};
    return data;
  }

  function saveStore(data) {
    GM_setValue(STORAGE_KEY, JSON.stringify(data));
  }

  // The only way to write: read fresh, change, save. WHY: a snapshot held across an
  // await (a fill takes seconds) would overwrite an edit saved in the meantime.
  function updateStore(mutate) {
    const s = loadStore();
    mutate(s);
    saveStore(s);
    return s;
  }

  /* ---------------------------------------------------------------------------
     3. Dates
     --------------------------------------------------------------------------- */

  const SG_DATE = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit',
  });

  // Today as YYYY-MM-DD in Singapore time. Only a fallback: the arrival window is
  // normally read from the form's own datepicker (see pickerWindow).
  function sgToday() {
    return SG_DATE.format(new Date());
  }

  function validIso(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
    const t = Date.parse(iso + 'T00:00:00Z');
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
  }

  function isDmy(dmy) {
    return RULES.dmy.test(dmy || '') && validIso(dmyToIso(dmy));
  }

  function isoToDmy(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function dmyToIso(dmy) {
    const [d, m, y] = dmy.split('/');
    return `${y}-${m}-${d}`;
  }

  const dmyToIsoOrBlank = (dmy) => (isDmy(dmy) ? dmyToIso(dmy) : '');
  const isoToDmyOrBlank = (iso) => (validIso(iso) ? isoToDmy(iso) : '');

  function addDays(iso, n) {
    const dt = new Date(iso + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function addMonths(iso, n) {
    const dt = new Date(iso + 'T00:00:00Z');
    dt.setUTCMonth(dt.getUTCMonth() + n);
    return dt.toISOString().slice(0, 10);
  }

  function diffDays(isoFrom, isoTo) {
    return Math.round((Date.parse(isoTo + 'T00:00:00Z') - Date.parse(isoFrom + 'T00:00:00Z')) / 86400000);
  }

  // The arrival window exactly as the form's datepicker enforces it (today to today
  // plus two, in the browser's calendar, frozen when the page loaded). WHY read it
  // from the page: judging the window with our own clock could accept a date the
  // form then drops, or refuse one it would take. Null if it cannot be read.
  function pickerWindow() {
    try {
      const dp = W.jQuery(MAP.arrivalDate.sel).data('datepicker');
      const o = dp && dp.o;
      const iso = (d) => (d && typeof d.getTime === 'function' && Number.isFinite(d.getTime())
        ? new Date(d.getTime()).toISOString().slice(0, 10) : null);
      const from = o && iso(o.startDate);
      const to = o && iso(o.endDate);
      return from && to ? { from, to } : null;
    } catch {
      return null;
    }
  }

  function arrivalWindow() {
    const win = pickerWindow();
    if (win) return win;
    const today = sgToday();
    return { from: today, to: addDays(today, 2) };
  }

  /* ---------------------------------------------------------------------------
     4. Validation
     --------------------------------------------------------------------------- */

  function hasOption(key, value) {
    const el = q(key);
    return !!(el && value && el.querySelector(`option[value="${CSS.escape(value)}"]`));
  }

  // Problems carry the field label and the rule, never the value (spec 2.6).
  function problemCollector() {
    const problems = [];
    const need = (key, ok, why) => { if (!ok) problems.push(`${LABELS[key]}: ${why}`); };
    return { problems, need };
  }

  function validateProfile(p) {
    const { problems, need } = problemCollector();
    const today = sgToday();
    need('name', RULES.name.test(p.name || ''), 'letters and spaces only, 1 to 60');
    need('passportNo', RULES.passportNo.test(p.passportNo || ''), 'letters and digits only, 1 to 12');
    need('dob', isDmy(p.dob) && dmyToIso(p.dob) < today, 'a date before today');
    need('nationality', hasOption('nationality', p.nationality), 'not in the form list');
    need('placeOfBirth', hasOption('placeOfBirth', p.placeOfBirth), 'not in the form list');
    need('sex', p.sex === '1' || p.sex === '2', 'choose one');
    need('passportExpiry', isDmy(p.passportExpiry) && dmyToIso(p.passportExpiry) > today, 'a date after today');
    need('email', RULES.email.test(p.email || ''), 'not a valid email');
    need('phoneCountryCode', hasOption('phoneCountryCode', p.phoneCountryCode), 'not in the form list');
    need('mobile', RULES.mobile.test(p.mobile || ''), 'digits only, 1 to 12, no country code');
    return problems;
  }

  function validateTrip(t) {
    const { problems, need } = problemCollector();
    const win = arrivalWindow();
    const arrivalOk = validIso(t.arrivalDate) && t.arrivalDate >= win.from && t.arrivalDate <= win.to;
    need('arrivalDate', arrivalOk, COPY.arrivalWindow(isoToDmy(win.from), isoToDmy(win.to)));
    // Only complain about departure once arrival itself is acceptable.
    need('departureDate', !arrivalOk || (validIso(t.departureDate) && t.departureDate >= t.arrivalDate), 'on or after arrival');
    need('transportNo', RULES.transportNo.test(t.transportNo || ''), "letters, digits, / - @ ( ) , ' only, 1 to 30");
    need('travelMode', ['1', '2', '3'].includes(t.travelMode), 'choose one');
    need('embarkation', hasOption('embarkation', t.embarkation), 'not in the form list');
    need('stayType', ['01', '02', '99'].includes(t.stayType), 'choose one');
    const a1 = (t.address1 || '').trim();
    need('address1', RULES.address1.test(a1) && a1.split(/\s+/).length >= 3 && !NOT_ALLOWED_ADDRESS.includes(a1),
      "at least 3 words, letters, digits, / - @ ( ) , ' only, not NA or NIL");
    const a2 = (t.address2 || '').trim();
    need('address2', RULES.address2.test(a2) && !NOT_ALLOWED_ADDRESS.includes(a2), "letters, digits, / - @ ( ) , ' only, not NA or NIL");
    need('stateCode', hasOption('stateCode', t.stateCode), 'not in the form list');
    need('cityCode', /^\d{4}$/.test(t.cityCode || ''), 'choose a city');
    need('postcode', RULES.postcode.test(t.postcode || ''), 'exactly 5 digits');
    return problems;
  }

  /* ---------------------------------------------------------------------------
     5. Page helpers
     --------------------------------------------------------------------------- */

  function q(key) {
    return document.querySelector(MAP[key].sel);
  }

  // Like q(), but a missing element is an error with the field's label, never a value.
  function must(key) {
    const el = q(key);
    if (!el) throw new Error(`${LABELS[key] || key} is missing on the form`);
    return el;
  }

  function fire(el, type) {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  // A control inside a hidden block has no offsetParent, so this answers per element.
  function isVisible(el) {
    return !!el && el.offsetParent !== null;
  }

  function cleanText(el) {
    return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
  }

  function selectedText(el) {
    if (!el || el.tagName !== 'SELECT') return '';
    return cleanText(el.options[el.selectedIndex]);
  }

  // Option lists in one shape everywhere: [value, text] pairs, "Please Choose" left out.
  const optionPairs = (opts) => [...opts].filter((o) => o.value).map((o) => [o.value, cleanText(o)]);
  const optionEls = (pairs) => pairs.map(([v, t]) => h('option', { value: v, text: t }));

  // Text inputs. WHY the events: the page strips unwanted characters on 'input',
  // uppercases and runs its email / address checks on 'blur'. Firing them makes the
  // page treat our value exactly as if a person had typed it.
  function setText(key, value) {
    const el = must(key);
    el.value = value;
    fire(el, 'input');
    fire(el, 'change');
    el.dispatchEvent(new Event('blur'));
  }

  // Selects. WHY the change event: the page's hidden mirror inputs and its AJAX
  // reloads (phone code list, city list) are wired to 'change'.
  function setSelect(key, value) {
    const el = must(key);
    el.value = value;
    fire(el, 'change');
  }

  // Readonly datepicker inputs. WHY the plugin call: the page's bootstrap-datepicker
  // drops any date outside its allowed range, so the value reads back empty when we
  // are outside the window. That is the check we want. Selected by selector string,
  // not by element, so nothing crosses between the sandbox and the page.
  function setDate(key, dmy) {
    must(key);
    W.jQuery(MAP[key].sel).datepicker('update', dmy);
  }

  function waitFor(cond, ms = WAIT_MS) {
    return new Promise((resolve) => {
      const started = Date.now();
      (function tick() {
        if (cond()) return resolve(true);
        if (Date.now() - started > ms) return resolve(false);
        return setTimeout(tick, POLL_MS);
      }());
    });
  }

  // "The page is quiet." WHY this works: every reload on this page is a jQuery $.get.
  // jQuery counts requests in flight in jQuery.active and decrements it only after the
  // success callback that swaps the option list has run, so zero in flight means every
  // reload has landed, for all four endpoints. The counter goes up synchronously inside
  // the page's change handler, so it is already non-zero when setSelect returns.
  function quiet() {
    return W.jQuery.active === 0;
  }

  // Sets a select whose change makes the page reload another list, and waits for the
  // page to go quiet. Returns the row note: empty when the reload landed in time.
  async function setSelectAndSettle(key, value, what) {
    setSelect(key, value);
    const landed = await waitFor(quiet);
    return landed ? '' : COPY.reloadTimeout(what);
  }

  // City lists never change during a page's life, so each state is fetched once.
  const cityCache = new Map();

  function fetchCities(stateCode) {
    if (!cityCache.has(stateCode)) {
      const request = fetch(CITY_ENDPOINT + encodeURIComponent(stateCode), {
        credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then((res) => res.text())
        .then((html) => optionPairs(new DOMParser().parseFromString(`<select>${html}</select>`, 'text/html').querySelectorAll('option')));
      request.catch(() => cityCache.delete(stateCode));
      cityCache.set(stateCode, request);
    }
    return cityCache.get(stateCode);
  }

  /* ---------------------------------------------------------------------------
     6. Drift check (spec 8.1)
     --------------------------------------------------------------------------- */

  function driftCheck() {
    const failures = [];
    for (const [key, spec] of Object.entries(MAP)) {
      if (spec.optional) continue;
      const el = document.querySelector(spec.sel);
      if (!el) { failures.push(`${key}: ${spec.sel} is missing`); continue; }
      if (el.tagName !== spec.tag) { failures.push(`${key}: expected ${spec.tag}, found ${el.tagName}`); continue; }
      for (const v of spec.sentinels || []) {
        if (!hasOption(key, v)) failures.push(`${key}: option ${v} is missing`);
      }
    }
    if (typeof W.validateSubmit !== 'function') failures.push('page function validateSubmit is missing');
    if (!W.jQuery || !W.jQuery.fn || typeof W.jQuery.fn.datepicker !== 'function') failures.push('page jQuery datepicker is missing');
    else if (!pickerWindow()) failures.push('arrival datepicker window is unreadable');
    if (!W.jQuery || typeof W.jQuery.active !== 'number') failures.push('page jQuery request counter is missing');
    if (typeof GM_getValue !== 'function' || typeof GM_setValue !== 'function') failures.push('Tampermonkey storage is unavailable');
    return failures;
  }

  /* ---------------------------------------------------------------------------
     7. Fill engine (spec 6)
     --------------------------------------------------------------------------- */

  // Runs the fourteen steps. Each row records what we meant to write; the read-back
  // step fills in what the form actually holds. A note on a row makes it red.
  async function fillForm(profile, trip, progress) {
    const rows = [];
    const add = (key, target, note) => rows.push({ key, target: String(target), note: note || '', actual: '', text: '', ok: false });
    const arrival = isoToDmy(trip.arrivalDate);
    const departure = isoToDmy(trip.departureDate);

    const steps = [
      ['Checking the form', () => {
        const failures = driftCheck();
        if (failures.length) throw Object.assign(new Error('drift'), { failures });
      }],
      ['Name, passport, email, mobile', () => {
        setText('name', profile.name); add('name', profile.name);
        setText('passportNo', profile.passportNo); add('passportNo', profile.passportNo);
        setText('email', profile.email); add('email', profile.email);
        setText('confirmEmail', profile.email); add('confirmEmail', profile.email);
        setText('mobile', profile.mobile); add('mobile', profile.mobile);
      }],
      ['Sex', () => { setSelect('sex', profile.sex); add('sex', profile.sex); }],
      // WHY the waits on the next two: nationality AND place of birth each make the
      // page reload the phone code list (observed 2026-09-04).
      ['Nationality', async () => add('nationality', profile.nationality,
        await setSelectAndSettle('nationality', profile.nationality, 'phone code list'))],
      ['Place of birth', async () => add('placeOfBirth', profile.placeOfBirth,
        await setSelectAndSettle('placeOfBirth', profile.placeOfBirth, 'phone code list'))],
      ['Country / Region Code', () => {
        // Set last, after both reloads, otherwise a reload overwrites it.
        setSelect('phoneCountryCode', profile.phoneCountryCode); add('phoneCountryCode', profile.phoneCountryCode);
      }],
      ['Date of birth, passport expiry', () => {
        setDate('dob', profile.dob); add('dob', profile.dob);
        setDate('passportExpiry', profile.passportExpiry); add('passportExpiry', profile.passportExpiry);
      }],
      ['Arrival, then departure', () => {
        // WHY this order: the page clears departure whenever arrival changes.
        setDate('arrivalDate', arrival); add('arrivalDate', arrival);
        setDate('departureDate', departure); add('departureDate', departure);
      }],
      ['Mode, embarkation, transport', () => {
        setSelect('travelMode', trip.travelMode); add('travelMode', trip.travelMode);
        setSelect('embarkation', trip.embarkation); add('embarkation', trip.embarkation);
        setText('transportNo', trip.transportNo); add('transportNo', trip.transportNo);
      }],
      ['Accommodation type and address', async () => {
        // WHY the wait: the page shows this block only after its own page-load call
        // answered. Read-back marks any field the traveller cannot see.
        await waitFor(() => isVisible(q('accommodation')));
        setSelect('stayType', trip.stayType); add('stayType', trip.stayType);
        setText('address1', trip.address1); add('address1', trip.address1);
        setText('address2', trip.address2); add('address2', trip.address2);
      }],
      ['State, then city', async () => {
        // WHY the wait: the city list only exists after the page fetched it for the state.
        add('stateCode', trip.stateCode, await setSelectAndSettle('stateCode', trip.stateCode, 'city list'));
        setSelect('cityCode', trip.cityCode); add('cityCode', trip.cityCode);
      }],
      ['Postcode', () => { setText('postcode', trip.postcode); add('postcode', trip.postcode); }],
      ['Reading the form back', async () => {
        await waitFor(quiet);
        rows.forEach(readBack);
      }],
      ['Scrolling to the puzzle', scrollToPuzzle],
    ];

    for (let i = 0; i < steps.length; i++) {
      progress(i + 1, steps.length, steps[i][0]);
      await steps[i][1]();
      log('step', i + 1, 'done');
    }
    return rows;
  }

  // The review shows what the form holds now, not what we intended to write.
  function readBack(r) {
    const el = q(r.key);
    r.actual = el ? el.value : '';
    r.text = selectedText(el);
    if (!isVisible(el)) r.note = r.note || COPY.hiddenField;
    r.ok = !r.note && r.actual === r.target;
  }

  function scrollToPuzzle() {
    must('captcha').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Yellow rows (spec 8.2). Attached to the row they concern.
  function applyWarnings(rows, profile, trip, lastEmailDomain) {
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    if (isDmy(profile.passportExpiry) && dmyToIso(profile.passportExpiry) < addMonths(trip.arrivalDate, 6)) {
      byKey.passportExpiry.warn = COPY.warn.expiry;
    }
    if (diffDays(trip.arrivalDate, trip.departureDate) > 30) byKey.departureDate.warn = COPY.warn.longStay;
    if (lastEmailDomain && domainOf(profile.email) !== lastEmailDomain) byKey.email.warn = COPY.warn.emailDomain;
  }

  function domainOf(email) {
    return (email || '').split('@')[1] || '';
  }

  // Late-reload guard, the safety net behind the quiet-wait. WHY keep it: if a reload
  // ever lands after the review (a request past the timeout, or a page change that
  // defers its own AJAX), the page would silently replace the list with its own
  // preselection. From the review onwards we watch the two lists; if the page swaps
  // one, we put the reviewed value back, tell the page (change event), mark the row,
  // and redraw the current view.
  function guardLateReloads(rows) {
    stopObserver('guardObserver');
    const targets = ['phoneCountryCode', 'cityCode'].map((key) => [key, q(key)]).filter(([, el]) => el);
    panel.guardObserver = new MutationObserver((mutations) => {
      for (const [key, el] of targets) {
        if (!mutations.some((m) => m.target === el)) continue;
        const r = rows.find((x) => x.key === key);
        if (!r) continue;
        if (el.value !== r.target) { el.value = r.target; fire(el, 'change'); }
        readBack(r);
        r.warn = COPY.lateReload;
        log('late reload', key, r.ok);
      }
      render(panel.state, panel.ctx);
    });
    for (const [, el] of targets) panel.guardObserver.observe(el, { childList: true });
  }

  /* ---------------------------------------------------------------------------
     8. Panel (spec 7)
     --------------------------------------------------------------------------- */

  const CSS_TEXT = `
    #mdacf-panel { position: fixed; right: 16px; bottom: 16px; width: 320px; max-height: 85vh; overflow: auto;
      z-index: 2147483000; background: #fff; color: #222; border: 1px solid #8a94c4; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,.25); font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; }
    #mdacf-panel .mdacf-head { background: #7080c0; color: #fff; padding: 8px 10px; font-weight: 600; }
    #mdacf-panel .mdacf-body { padding: 10px; }
    #mdacf-panel label { display: block; margin: 8px 0 2px; font-size: 12px; font-weight: 600; color: #444; }
    #mdacf-panel input, #mdacf-panel select { width: 100%; box-sizing: border-box; padding: 4px 6px; margin: 0;
      border: 1px solid #bbb; border-radius: 3px; font: inherit; background: #fff; color: #222; height: auto; }
    #mdacf-panel button { margin: 10px 6px 0 0; padding: 6px 10px; border: 1px solid #5a68a8; border-radius: 4px;
      background: #7080c0; color: #fff; cursor: pointer; font: inherit; }
    #mdacf-panel button.mdacf-secondary { background: #eee; color: #222; border-color: #bbb; }
    #mdacf-panel button.mdacf-danger { background: #c0392b; border-color: #96281b; }
    #mdacf-panel table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    #mdacf-panel td { padding: 3px 4px; border-bottom: 1px solid #eee; vertical-align: top; word-break: break-word; }
    #mdacf-panel td:first-child { color: #555; width: 42%; }
    #mdacf-panel tr.mdacf-red td { background: #fde2e2; }
    #mdacf-panel tr.mdacf-yellow td { background: #fff5cc; }
    #mdacf-panel .mdacf-note { font-size: 11px; color: #a00; display: block; }
    #mdacf-panel .mdacf-warn { font-size: 11px; color: #7a5b00; display: block; }
    #mdacf-panel .mdacf-problems { color: #a00; margin: 6px 0; padding-left: 16px; }
    #mdacf-panel .mdacf-muted { color: #666; font-size: 12px; margin: 6px 0; }
    #mdacf-panel .mdacf-red-line { color: #a00; font-weight: 600; margin-top: 8px; }
    #mdacf-panel details { margin-top: 8px; }
  `;

  // Appends children, flattening arrays and skipping empties. WHY: Element.append()
  // would turn an array or a null into visible text (the bug test 3 caught).
  function appendAll(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c !== null && c !== undefined && c !== false) el.append(c);
    }
  }

  // Tiny DOM builder so the panel needs no framework.
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
    }
    appendAll(el, children);
    return el;
  }

  function mount(...children) {
    appendAll(panel.body, children);
  }

  function optionsSelect(pairs, selected, attrs) {
    const sel = h('select', attrs, optionEls(pairs));
    sel.value = selected;
    return sel;
  }

  // A copy of one of the page's own selects, so the panel can only offer codes the
  // form accepts. Read once per list: the page never changes which codes exist.
  const pairsCache = new Map();

  function cloneSelect(key, selected, attrs) {
    if (!pairsCache.has(key)) pairsCache.set(key, optionPairs(must(key).options));
    return optionsSelect(pairsCache.get(key), selected, attrs);
  }

  // Panel state. `ctx` belongs to the current state only; nothing carries over
  // unless a view passes it on explicitly (review hands its rows to handoff).
  const panel = { root: null, head: null, body: null, state: 'ready', ctx: {}, puzzleObserver: null, guardObserver: null };

  function stopObserver(name) {
    if (panel[name]) panel[name].disconnect();
    panel[name] = null;
  }

  function mountPanel() {
    if (panel.root) return;
    document.head.append(h('style', { text: CSS_TEXT }));
    panel.head = h('div', { class: 'mdacf-head' });
    panel.body = h('div', { class: 'mdacf-body' });
    panel.root = h('div', { id: 'mdacf-panel' }, panel.head, panel.body);
    document.body.append(panel.root);
  }

  function render(state, ctx) {
    panel.state = state;
    panel.ctx = ctx || {};
    if (state !== 'handoff' && state !== 'verified') stopObserver('puzzleObserver');
    if (!ROW_STATES.includes(state)) stopObserver('guardObserver');
    panel.body.replaceChildren();
    const views = {
      ready: viewReady, drift: viewDrift, filling: viewFilling, review: viewReview,
      handoff: (c) => viewPuzzle(c, COPY.handoff.header), verified: (c) => viewPuzzle(c, COPY.verified.header),
      edit: viewEdit,
    };
    views[state](panel.ctx);
    log('state', state);
  }

  function setHeader(text) {
    panel.head.textContent = text;
  }

  function problemsList(problems) {
    if (!problems || !problems.length) return null;
    return [h('div', { class: 'mdacf-red-line', text: COPY.problems }),
      h('ul', { class: 'mdacf-problems' }, problems.map((p) => h('li', { text: p })))];
  }

  function travellerSelect(names, selected, attrs) {
    return optionsSelect(names.map((n) => [n, n]), selected, attrs);
  }

  /* ---- ready ---- */

  function viewReady(ctx) {
    setHeader(COPY.ready.header);
    const store = loadStore();
    const names = Object.keys(store.profiles);
    const win = arrivalWindow();
    // A draft exists only when a fill was refused with problems: keep what was typed.
    const draft = ctx.draft || {};
    const trip = { ...store.lastTrip, ...draft };
    const preferred = draft.profileName || store.lastProfile;

    const traveller = travellerSelect(names, names.includes(preferred) ? preferred : names[0], { id: 'mdacf-traveller' });
    const arrival = h('input', { type: 'date', id: 'mdacf-arrival', min: win.from, max: win.to, value: trip.arrivalDate || '' });
    const departure = h('input', { type: 'date', id: 'mdacf-departure', min: win.from, value: trip.departureDate || '' });
    arrival.addEventListener('change', () => {
      if (!validIso(arrival.value)) return;
      departure.min = arrival.value;
      departure.value = addDays(arrival.value, Math.max(0, trip.tripLengthDays || 0));
    });
    const transport = h('input', { type: 'text', id: 'mdacf-transport', value: trip.transportNo, maxlength: 30 });
    const mode = optionsSelect([['1', 'AIR'], ['2', 'LAND'], ['3', 'SEA']], trip.travelMode, { id: 'mdacf-mode' });
    const embark = cloneSelect('embarkation', trip.embarkation, { id: 'mdacf-embark' });
    const stay = cloneSelect('stayType', trip.stayType, { id: 'mdacf-stay' });
    const address1 = h('input', { type: 'text', id: 'mdacf-address1', value: trip.address1, maxlength: 100 });
    const address2 = h('input', { type: 'text', id: 'mdacf-address2', value: trip.address2, maxlength: 100 });
    const state = cloneSelect('stateCode', trip.stateCode, { id: 'mdacf-state' });
    const city = h('select', { id: 'mdacf-city' });
    const postcode = h('input', { type: 'text', id: 'mdacf-postcode', value: trip.postcode, maxlength: 5, inputmode: 'numeric' });

    // WHY the request counter: two city loads can finish out of order; only the
    // latest one may fill the list, and only while this view is still on screen.
    let cityRequest = 0;
    async function loadCities(stateCode, selected) {
      const request = ++cityRequest;
      city.replaceChildren(h('option', { value: '', text: 'Loading...' }));
      const cities = await fetchCities(stateCode).catch(() => []);
      if (request !== cityRequest || !city.isConnected) return;
      city.replaceChildren(...optionEls(cities));
      if (cities.some(([v]) => v === selected)) city.value = selected;
    }
    state.addEventListener('change', () => loadCities(state.value, ''));
    loadCities(trip.stateCode, trip.cityCode);

    const collect = () => ({
      profileName: traveller.value,
      trip: {
        arrivalDate: arrival.value,
        departureDate: departure.value,
        transportNo: transport.value.trim().toUpperCase(),
        travelMode: mode.value,
        embarkation: embark.value,
        stayType: stay.value,
        address1: address1.value.trim().toUpperCase(),
        address2: address2.value.trim().toUpperCase(),
        stateCode: state.value,
        cityCode: city.value,
        postcode: postcode.value.trim(),
      },
    });

    mount(
      problemsList(ctx.problems),
      h('label', { text: COPY.ready.traveller }), traveller,
      h('label', { text: LABELS.arrivalDate }), arrival,
      h('label', { text: LABELS.departureDate }), departure,
      h('label', { text: LABELS.transportNo }), transport,
      h('label', { text: LABELS.travelMode }), mode,
      h('label', { text: LABELS.embarkation }), embark,
      h('label', { text: LABELS.stayType }), stay,
      h('label', { text: LABELS.address1 }), address1,
      h('label', { text: LABELS.address2 }), address2,
      h('label', { text: LABELS.stateCode }), state,
      h('label', { text: LABELS.cityCode }), city,
      h('label', { text: LABELS.postcode }), postcode,
      h('div', {},
        h('button', { text: COPY.ready.fill, onclick: () => onFill(collect()) }),
        h('button', { class: 'mdacf-secondary', text: COPY.ready.edit, onclick: () => render('edit', {}) })),
    );
  }

  async function onFill({ profileName, trip }) {
    // The Fill button exists only in `ready`; the state moves to `filling` before the
    // first await below, so a second click during a fill does nothing.
    if (panel.state !== 'ready') return;
    const profile = loadStore().profiles[profileName];
    if (!profile) { render('ready', { problems: ['Traveller: profile not found'] }); return; }
    const problems = [
      ...validateProfile(profile).map((p) => `Profile, ${p}`),
      ...validateTrip(trip).map((p) => `Trip, ${p}`),
    ];
    if (problems.length) { render('ready', { problems, draft: { ...trip, profileName } }); return; }

    // Remember the trip shape (never the arrival date) before touching the form.
    updateStore((s) => {
      s.lastProfile = profileName;
      for (const k of TRIP_MEMORY_KEYS) s.lastTrip[k] = trip[k];
      s.lastTrip.tripLengthDays = diffDays(trip.arrivalDate, trip.departureDate);
    });

    let current = '';
    try {
      const rows = await fillForm(profile, trip, (n, total, label) => { current = label; render('filling', { n, total, label }); });
      let lastDomain = '';
      updateStore((s) => {
        lastDomain = s.emailDomains[profileName] || '';
        s.emailDomains[profileName] = domainOf(profile.email);
      });
      applyWarnings(rows, profile, trip, lastDomain);
      guardLateReloads(rows);
      render('review', { rows, arrival: isoToDmy(trip.arrivalDate) });
    } catch (e) {
      if (e && e.failures) { render('drift', { failures: e.failures }); return; }
      // Nothing personal reaches the panel or the console: the step name and the error kind only.
      render('ready', { problems: [COPY.stopped(current, (e && e.name) || 'error')], draft: { ...trip, profileName } });
    }
  }

  /* ---- drift ---- */

  function viewDrift(ctx) {
    setHeader(COPY.drift.header);
    const report = ctx.failures.join('\n');
    const btn = h('button', {
      text: COPY.drift.copy,
      onclick: () => navigator.clipboard.writeText(report).then(() => { btn.textContent = COPY.drift.copied; }),
    });
    mount(h('ul', { class: 'mdacf-problems' }, ctx.failures.map((f) => h('li', { text: f }))), btn);
  }

  /* ---- filling ---- */

  function viewFilling(ctx) {
    setHeader(COPY.filling.header);
    mount(h('div', { class: 'mdacf-muted', text: COPY.filling.step(ctx.n, ctx.total, ctx.label) }));
  }

  /* ---- review ---- */

  function reviewTable(rows) {
    return h('table', {}, rows.map((r) => {
      const cls = !r.ok ? 'mdacf-red' : (r.warn ? 'mdacf-yellow' : '');
      const shown = r.text ? `${r.actual} ${r.text}` : (r.actual || '(empty)');
      return h('tr', { class: cls },
        h('td', { text: LABELS[r.key] }),
        h('td', {}, shown,
          !r.ok ? h('span', { class: 'mdacf-note', text: r.note || `expected ${r.target || '(empty)'}` }) : null,
          r.warn ? h('span', { class: 'mdacf-warn', text: r.warn }) : null));
    }));
  }

  function viewReview(ctx) {
    setHeader(COPY.review.header);
    const anyRed = ctx.rows.some((r) => !r.ok);
    mount(
      reviewTable(ctx.rows),
      anyRed ? h('div', { class: 'mdacf-red-line', text: COPY.review.red }) : null,
      h('div', {},
        h('button', { text: COPY.review.go, onclick: () => render('handoff', ctx) }),
        h('button', { class: 'mdacf-secondary', text: COPY.review.again, onclick: () => render('ready', {}) })),
    );
  }

  /* ---- handoff and verified ---- */

  function viewPuzzle(ctx, header) {
    setHeader(header);
    mount(
      h('div', { text: COPY.handoff.body(ctx.arrival) }),
      h('details', {}, h('summary', { text: COPY.handoff.details }), reviewTable(ctx.rows)),
    );
    if (panel.state === 'handoff') scrollToPuzzle();
    watchPuzzle();
  }

  // We only LOOK at the puzzle widget, to move the panel between handoff and verified.
  function watchPuzzle() {
    if (panel.puzzleObserver) return;
    const target = must('captcha');
    panel.puzzleObserver = new MutationObserver(() => {
      const solved = !!q('puzzleSolved');
      if (solved && panel.state === 'handoff') render('verified', panel.ctx);
      if (!solved && panel.state === 'verified') render('handoff', panel.ctx);
    });
    panel.puzzleObserver.observe(target, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  }

  /* ---- edit ---- */

  function viewEdit(ctx) {
    setHeader(COPY.edit.header);
    const store = loadStore();
    const names = Object.keys(store.profiles);
    const current = names.includes(ctx.editing) ? ctx.editing : (names.includes(store.lastProfile) ? store.lastProfile : names[0]);
    const p = store.profiles[current] || blankProfile('DEU', '1');
    const dateField = (dmy) => h('input', { type: 'date', value: dmyToIsoOrBlank(dmy) });

    const traveller = travellerSelect(names, current, { id: 'mdacf-edit-traveller' });
    traveller.addEventListener('change', () => render('edit', { editing: traveller.value }));

    const fields = {
      name: h('input', { type: 'text', value: p.name, maxlength: 60 }),
      passportNo: h('input', { type: 'text', value: p.passportNo, maxlength: 12 }),
      dob: dateField(p.dob),
      nationality: cloneSelect('nationality', p.nationality),
      placeOfBirth: cloneSelect('placeOfBirth', p.placeOfBirth),
      sex: optionsSelect([['1', 'MALE'], ['2', 'FEMALE']], p.sex),
      passportExpiry: dateField(p.passportExpiry),
      email: h('input', { type: 'email', value: p.email, maxlength: 100 }),
      phoneCountryCode: cloneSelect('phoneCountryCode', p.phoneCountryCode),
      mobile: h('input', { type: 'text', value: p.mobile, maxlength: 12, inputmode: 'numeric' }),
    };

    const collect = () => ({
      name: fields.name.value.trim().toUpperCase(),
      passportNo: fields.passportNo.value.trim().toUpperCase(),
      dob: isoToDmyOrBlank(fields.dob.value),
      nationality: fields.nationality.value,
      placeOfBirth: fields.placeOfBirth.value,
      sex: fields.sex.value,
      passportExpiry: isoToDmyOrBlank(fields.passportExpiry.value),
      email: fields.email.value.trim(),
      phoneCountryCode: fields.phoneCountryCode.value,
      mobile: fields.mobile.value.trim(),
    });

    const save = () => {
      const next = collect();
      const problems = validateProfile(next);
      if (problems.length) { render('edit', { editing: current, problems }); return; }
      updateStore((s) => { s.profiles[current] = next; s.lastProfile = current; });
      render('edit', { editing: current, message: COPY.edit.saved });
    };

    const deleteFlow = h('div', {});
    const askDelete = () => {
      deleteFlow.replaceChildren(
        h('div', { class: 'mdacf-red-line', text: COPY.edit.really }),
        h('button', { class: 'mdacf-danger', text: COPY.edit.yes, onclick: () => {
          const s = updateStore((store) => {
            delete store.profiles[current];
            delete store.emailDomains[current];
            if (!Object.keys(store.profiles).length) store.profiles.Traveller = blankProfile('SGP', '1');
            store.lastProfile = Object.keys(store.profiles)[0];
          });
          render('edit', { editing: s.lastProfile });
        } }),
        h('button', { class: 'mdacf-secondary', text: COPY.edit.no, onclick: () => render('edit', { editing: current }) }),
      );
    };

    const newName = h('input', { type: 'text', placeholder: COPY.edit.newName, maxlength: 30 });
    const addProfile = () => {
      const n = newName.value.trim();
      if (!n) return;
      updateStore((s) => {
        if (!s.profiles[n]) s.profiles[n] = blankProfile('SGP', '1');
        s.lastProfile = n;
      });
      render('edit', { editing: n });
    };

    mount(
      h('label', { text: COPY.ready.traveller }), traveller,
      PROFILE_KEYS.map((k) => [h('label', { text: LABELS[k] }), fields[k]]),
      problemsList(ctx.problems),
      ctx.message ? h('div', { class: 'mdacf-muted', text: ctx.message }) : null,
      h('div', {},
        h('button', { text: COPY.edit.save, onclick: save }),
        h('button', { class: 'mdacf-secondary', text: COPY.edit.back, onclick: () => render('ready', {}) }),
        h('button', { class: 'mdacf-danger', text: COPY.edit.del, onclick: askDelete })),
      deleteFlow,
      h('label', { text: COPY.edit.newName }), newName,
      h('button', { class: 'mdacf-secondary', text: COPY.edit.add, onclick: addProfile }),
    );
  }

  /* ---------------------------------------------------------------------------
     9. Boot
     --------------------------------------------------------------------------- */

  function onRegistrationPage() {
    return location.search.includes('registerMain') || /\/mdac\/register(;|$)/.test(location.pathname);
  }

  function boot() {
    if (!onRegistrationPage()) return;
    // No registration form at all (home page, confirmation page): stay invisible.
    if (!document.querySelector(MAP.form.sel)) return;
    mountPanel();
    const failures = driftCheck();
    if (failures.length) { render('drift', { failures }); return; }
    // The site's Reset button clears the form; the panel follows it back to ready.
    // During a fill the click is left alone: the cleared fields read back red.
    q('reset').addEventListener('click', () => {
      if (panel.state === 'filling') return;
      setTimeout(() => render('ready', {}), 0);
    });
    render('ready', {});
  }

  boot();
}());
