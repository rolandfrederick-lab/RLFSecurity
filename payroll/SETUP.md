# RLF Security Payroll and Time Clock: setup guide

About 30 minutes, all from a browser. Nothing to install.

What is in this folder:

- `supabase/migrations/20260924180000_payroll_schema.sql` builds the database: tables, access rules, and the time clock functions.
- `public/app/` is the app itself. It is published with the website at https://rlfsecurity.com/app/.
- `public/app/config.js` is where your two Supabase values go.

## 1. Create the database (Supabase)

1. Sign up at supabase.com and create a new project. Pick a region in the US. Save the database password somewhere safe.
2. Create the database, one of two ways (never both; the setup must run exactly once):
   - **Automatic (recommended):** in Supabase, Project Settings, Integrations, GitHub, connect this repository (`rolandfrederick-lab/RLFSecurity`), set the Supabase directory to `supabase` and the production branch to `main`, and turn on deploying to production. Supabase then applies the files in `supabase/migrations` itself, now and whenever new ones are pushed.
   - **By hand:** open **SQL Editor**, paste the whole contents of the migration file above, and run it once. It should finish with no errors.
3. Open the project's **Connect** dialog (or Settings, API Keys). Copy the **Project URL** and the **publishable key** (starts with `sb_publishable_`).
4. Paste both into `public/app/config.js`. Never put a secret key (`sb_secret_`) in this file. The publishable key is meant to be public; the access rules in the database are what protect the data.

## 2. Sign-up emails

In Supabase, open Authentication, then the Email provider settings.

- Simplest: turn **Confirm email** off. New accounts still cannot see or do anything until an owner or manager approves them in the app.
- If you leave it on, Supabase's built-in email sender only allows a few messages per hour. That is fine for a small crew signing up over a day or two. For more, add your own SMTP sender in the same area.

## 3. Put the app online

The app is already online: it is published with the website, so every push to the site's
production branch also publishes the app at **https://rlfsecurity.com/app/**. Geolocation
only works over HTTPS, which the site already uses.

1. In Supabase, open Authentication, URL Configuration, and set **Site URL** to `https://rlfsecurity.com/app/` so password reset links come back to the app.
2. After changing the app's code, update `public/app/version.json` (any new value) so phones reload the new version.

## 4. First run

1. Open the app address and choose **Create an account**. The first account created becomes the **owner**, so do this yourself before sharing the link.
2. More, Settings: business name, pay schedule, workweek start day, and the time clock rule (block off-site clock-ins, or allow and flag them).
3. More, Workers: add each worker with their hire date, pay rate and W-4 / MI-W4 answers. The hire date matters: it drives the sick time waiting period and the employee headcount.
4. More, Sites: add each location. Stand at the site and tap **Use my current location**, or paste coordinates from a maps app. Set the radius (150 m is a good start) and tick who works there.
5. More, People and roles: create a hiring code for each worker and send it to them. An account can only be created with a valid code (checked by the database), so strangers cannot sign up. The first account needs no code.
6. Each worker creates an account with their code and fills in their paperwork, contact details and guard license. Their name then shows "Ready to approve" under People and roles.
7. More, Settings: check the Employer status panel, then tap **Print the policy notice** and give a copy to each worker. Workers also sign it on their phone under the Time off tab.

## Hours, sick time, attendance

- **Weekly cap.** Settings sets a default cap (40) and whether reaching it warns or blocks clock-in. Each worker can have their own cap. The Clock tab shows hours this week; the Team tab shows everyone.
- **Sick time.** Earned at 1 hour per 30 worked from approved shifts. The yearly use cap and carryover cap are computed from the headcount: 40 hours while the business has under 10 employees, 72 once it has had 10 or more in 20 or more weeks. New hires wait up to 120 days. Workers request time under Time off: planned requests need 7 days notice, "Sick today" requests are always accepted and marked late if they come after the shift started. Managers approve or deny on the Team tab; short notice is never offered as a deny reason for sudden illness, because the law does not allow it. A doctor's note can be requested only after 3 consecutive days.
- **Attendance and discipline.** Tap a worker on the Team tab. Events (no call no show, late notice, unexcused, tardy) carry points you set in Settings; steps (verbal, written, final, termination) trigger at point totals you set. The app refuses to log an event on a day of approved sick time. Workers sign each step on their phone.
- **Site checklists.** Open a site under Sites and add tasks. For each task choose the proof: none, photo, video, or either, and whether it is required. Workers see the list on the Clock tab while clocked in at that site and tick items off; a required proof locks the box until a photo or video is added. Files go to a private bucket that only people who can see that shift can open. Every shift starts with a fresh list, and the Team tab shows "3/5 tasks" on each shift with the proof viewable from the shift sheet.
- **Schedule and guaranteed hours.** More, Schedule: add a shift for a worker at a site with either a fixed start or a window (opens after the site closes, due by a deadline, may cross midnight), a planned length, and repeat weekly if you like. Each site has scheduling defaults so most shifts are one tap. A worker who clocks in near a scheduled shift is linked to it. With guaranteed pay on, the shift is paid the greater of planned and actual hours; running over pays actual. Optional: guarantee only when all required checklist tasks are done. Overtime and sick accrual use hours actually worked. The Team tab shows planned, worked and paid on each shift, plus missed shifts with a one-tap no-call-no-show. Payroll pulls the guaranteed top-up as its own line.
- **Ending employment.** Workers, open the worker, End employment. The checklist shows the final pay date (next regular payday), the sick balance, and exports the worker's full record.
- **Headcount.** Nothing to set. The app recounts every time a worker is added, hired or ended, and shows the result in Settings. When the business crosses 10 employees for 20 weeks, the caps change and a notice asks you to save Settings once so workers re-sign the policy.

## 5. Add it to the phone's home screen

- iPhone: open the address in Safari, tap Share, then **Add to Home Screen**.
- Android: open it in Chrome, tap the menu, then **Add to Home screen** or **Install app**.

The first time someone clocks in, the phone asks for location permission. They must allow it.

## Roles

| Role | Can do |
|---|---|
| Administrator | Everything an owner can do, plus assigning owners and other administrators. Cannot be changed by an owner. Set with the Administrator box under People and roles. |
| Owner | Everything, including settings, tax rates, and owner/manager roles |
| Manager | Workers, sites, timesheets, payroll, taxes, approving employees and supervisors |
| Supervisor | Own clock and pay, plus reviewing shifts at sites they are assigned to. Cannot change their own hours. Cannot see pay rates or paychecks of others |
| Employee | Clock in and out, own hours, own pay stubs |

A supervisor needs three things: the supervisor role, a linked worker record, and a site assignment.

## How the time clock works

- Location is read once at clock-in and once at clock-out. Nothing is tracked in between.
- The distance check runs on the server, so it cannot be skipped by editing the page. A phone with a fake-GPS app can still lie, which is why supervisors review shifts.
- Clock-in away from the site is blocked or flagged, depending on your setting. Clock-out is never blocked, only flagged.
- A site with no pin has no location check.
- Every change to a shift is logged with who, when, and why. A shift that is already on a paycheck is locked.
- Forgot to clock out: a supervisor opens the shift, enters the clock-out time and a reason.

## Payroll from the time clock

On the Pay tab, set the work period and pick a worker. Approved, unpaid shifts in that period fill in the hours. Overtime is counted per workweek (over 40 hours). Use weekly or two-week periods that begin on your workweek start day so the overtime split is exact. Saving the paycheck marks those shifts as paid.

## Tax paperwork and filings

- **Employee paperwork.** Each worker fills in their own W-4, MI-W4, address and Social Security number from their phone (More, My tax paperwork) and signs it. A banner reminds them until it is done. Managers see the last four digits only.
- **Business details.** Settings, Business details for tax forms: legal name, EIN, address, contact, Michigan UIA account number, SSA Business Services Online user ID. These print on every form.
- **City tax.** Workers carry a home city and sites carry a city. Tax is figured per paycheck from where the work happened (residents: home rate on all wages with credit for tax paid to other cities; nonresidents: work city rate on wages earned there), with the $600 per exemption allowance. All 24 Michigan cities are built in.
- **Filings screen** (More, Tax filings) builds, from saved paychecks only:
  - Form 941 each quarter and Form 940 each year on the official IRS PDFs, filled and ready to sign and mail.
  - Employee W-2 copies (B, C, 2), the SSA EFW2 upload file (run it through AccuWage Online first), and a keying sheet.
  - Contractor 1099-NEC copies and an IRIS bulk-upload CSV (match the column order against the template downloaded from IRIS).
  - Michigan Form 5081 on the official PDF, the MiUI delimited quarterly wage file (test it with the MiUI validator), and one reconciliation page per city.
- **Deposit schedule.** The Filings screen shows whether federal deposits are monthly or semiweekly from the lookback period.
- **Tax tables.** Official federal tables are added each December. Until then the next year is projected with the inflation rate in Settings.

## Reminders, books and the guide

- **To do list.** The Timesheets tab and the Tax filings screen show what is due: shifts to review, requests, missed shifts, workers without paperwork, logins to approve, monthly federal and Michigan deposits with amounts, quarterly UIA and 941, FUTA when it passes $500, and year-end forms. Filing items appear 30 days ahead and stay until marked Done. Only periods that actually had payroll are flagged.
- **Books** (More, Books): record money received per site or client and expenses by Schedule C category, each with a photo of the check or receipt (private storage). Overview shows money in, payroll cost, expenses, profit, and each site's billing against its labor cost. Export the year as one CSV for the accountant.
- **Guide** (More, Guide, also docs/GUIDE.md): the complete manual with the daily, payday, monthly, quarterly and yearly calendar.

## Things to know

- **Free plan pause.** Supabase pauses free projects after about a week with no database activity, and you restore them from the dashboard. Daily clock-ins keep it awake. A slow season could pause it.
- **Backups.** Automatic daily backups are a paid-plan feature (Pro, about $25 a month). On the free plan, export the year as CSV from the Paychecks tab every month and keep the file. Time records generally need to be kept for at least three years.
- **Tax tables.** Federal brackets are for 2026 and are built into `index.html`. Rates on the Settings screen can be edited. Both need an update each January.
- **Consent.** Have each worker sign a short notice that location is recorded at clock-in and clock-out.
- **Sick time law.** The rules built in follow Michigan's Earned Sick Time Act as amended February 21, 2025. Have a lawyer read the printed policy once. Keep signed copies for 3 years.
- **W-2 vs 1099.** Workers who clock in at assigned sites and times will generally look like employees. Confirm classification with a CPA before using the clock for anyone paid as a contractor.
- **Sensitive data.** Social Security numbers are encrypted with a key held in Supabase Vault. Only owners and administrators can decrypt them, only through the app, and every reveal is logged (pii_access_log). Bank account numbers are never stored.
- The app calculates payroll and produces every filing. It does not transmit returns or move money; you upload the files and pay through the free government portals.
