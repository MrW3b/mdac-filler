# MDAC registration page: AJAX endpoints observed 2026-09-04

All are GET, same-origin, called by the page's own inline JS. Read-only probes, no submission.

| Trigger | URL | Returns | Effect on DOM |
|---|---|---|---|
| page load | `/mdac/register?searchMdacVisaCountry` | `ALL` | `#formAccommodation` is shown for every nationality |
| `#nationality` change, `#pob` change | `/mdac/register?retrieveCountryPhoneCode&ctryCd=<ISO3>` | full `<option>` list (244) with that country's dialling code `selected` | replaces the inner HTML of `#region` (class `.region`) |
| `#accommodationState` change | `/mdac/register?retrieveRefCity&state=<code>` | `<option>` list of cities for that state | replaces the inner HTML of `#accommodationCity` |
| `#accommodationCity` change | `/mdac/register?retrievePostcode&cityCd=<code>` | `<option value=''>Please Choose</option>` | injected into an `<input>` innerHTML: no visible effect |
| slider puzzle release | `/mdac/captcha` (via longbow.slidercaptcha `verify`) | success / fail | on success `verifyResult = true`, `#submit` enabled |

Samples:
- ctryCd=DEU -> `<option value='49' selected>( 49 ) GERMANY`
- ctryCd=SGP -> `<option value='65' selected>( 65 ) SINGAPORE`
- state=14 (WP KUALA LUMPUR) -> 1400 W.PERSEKUTUAN, 1401 KUALA LUMPUR, 1402 CHERAS, 1403 BATU CAVES
- state=10 (SELANGOR) -> 1024 PETALING JAYA, 1035 SEPANG, 1038 SHAH ALAM, 1039 SUBANG JAYA, 1052 CYBERJAYA
