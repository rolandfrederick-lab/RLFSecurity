# The complete guide

This app runs the whole business office: the time clock, scheduling, sick time, attendance, payroll, tax filings, and the books. This guide says what to do and when, then explains every screen. Managers see the To do list on the Timesheets tab; it repeats the deadlines below with the exact amounts.

## When to do what

### Every day

- **Timesheets tab.** Approve shifts waiting for review. Tap a shift to see where the worker clocked in and out, the checklist, and any photos. Fix a forgotten clock-out by entering the time and a reason.
- **Time off requests.** Approve or deny. The app only offers the deny reasons the law allows.
- **Missed shifts.** A scheduled shift with no clock-in shows up here. One tap logs a no-call no-show if that is what happened.

### Every payday

1. Pay tab. Set the work period and pick a worker. Hours, overtime, sick hours and guaranteed hours fill in from the clock.
2. Check the preview, then Save paycheck. Saving marks those shifts as paid and locks them.
3. Repeat for each worker. Paychecks tab shows every stub; workers see their own under My pay.
4. Pay the workers by whatever method you use. The app does not move money.

### Every month, by the 15th

- **Federal deposit.** Taxes tab shows what is owed for last month (employee withholding plus both halves of Social Security and Medicare). Pay it on EFTPS.gov, then tap Mark paid.
- If the deposit schedule says semiweekly (shown on Tax filings), deposit within three business days of each payday instead.

### Every month, by the 20th

- **Michigan and city withholding.** Taxes tab shows state and city amounts. State goes to Michigan Treasury Online, city tax to each city. Mark paid.

### Every quarter

| Due | What | Where |
|---|---|---|
| 25th of the month after the quarter | Michigan UIA wage report and tax | Tax filings, UIA wage file; upload in MiUI and pay |
| Last day of the month after the quarter | Form 941 | Tax filings, Form 941; sign and mail |
| Same day, if FUTA owed passes $500 | FUTA deposit | EFTPS.gov |
| Quarter end | Record income and expenses in Books | Books |
| April 15, June 15, September 15, January 15 | Owner's estimated tax payments (1040-ES and MI-1040ES) | Books, Overview shows the amount; pay on IRS Direct Pay and Michigan Treasury Online |

### Every year

| Due | What | Where |
|---|---|---|
| January 31 | W-2 copies to employees, W-2 file to SSA | Tax filings; run the file through AccuWage Online, then upload on Business Services Online |
| January 31 | 1099-NEC copies to contractors, IRIS upload | Tax filings; upload the CSV in the IRS IRIS portal |
| January 31 | Form 940 | Tax filings; sign and mail |
| February 28 | Michigan Form 5081 | Tax filings; file on Michigan Treasury Online |
| February 28 | City reconciliations | Tax filings; Detroit on MTO, other cities on their form |
| December | New tax tables | The app updates itself; check Settings after the update and enter the new UIA rate from your rate notice |
| December | Sick time policy | Settings shows the employer status; if the business crossed 10 employees, save Settings once so workers re-sign |

Keep every filed form and the signed W-4s for four years, time records for three.

## Roles

| Role | Can do |
|---|---|
| Administrator | Everything an owner can, plus make owners and administrators. Cannot be removed by an owner. |
| Owner | Everything: settings, tax rates, payroll, filings, books, roles. |
| Manager | Workers, sites, schedule, timesheets, payroll, filings, books. Cannot change owners. Sees SSN last four only. |
| Supervisor | Own clock and pay, review shifts and requests at their sites. Cannot see pay rates. |
| Worker | Shown as Employee or Contractor depending on the pay type on the linked worker record. An employee clocks in and out, does the checklist, sees hours, sick time and pay stubs. A contractor bills visits, claims jobs and sees payment statements. |
| Owner's own taxes | Private to owners and administrators. Managers, supervisors and workers never see the owner's tax settings or the estimate in Books. |

## W-2 employee or 1099 contractor

This is the decision the IRS audits most in security companies, and the worker's paperwork does not decide it. How the work happens decides it.

| | Employee (W-2) | Contractor (1099) |
|---|---|---|
| Who sets the schedule | The company | The contractor |
| Who says how the job is done | The company (checklists, training) | The contractor |
| Tools and supplies | The company's | Their own |
| Other customers | Usually none | Yes, they run a business |
| Can send a substitute | No | Yes |
| Paid how | Hourly or salary, on payroll | By invoice, often flat price |
| Taxes | Withheld; company pays its share and unemployment | None withheld; they pay self-employment tax |

An officer who clocks in at sites you schedule, follows your post orders and wears your uniform is an employee. Paying that person on a 1099 is misclassification. When it is found, usually because the worker files for unemployment or gets hurt, the company owes both halves of Social Security and Medicare, a share of the income tax that should have been withheld, penalties, interest, and Michigan unemployment tax, for up to three years back.

Genuine contractors exist: another licensed security company you subcontract extra coverage to, or a specialist such as an alarm or camera installer with their own customers. For them: get a signed W-9 (they can sign it in the app), pay by invoice, keep them off the time clock and schedule, and the app produces the 1099-NEC and IRIS upload in January.

What the app does for each type:

- **W-2:** withholding, employer taxes, sick time accrual, headcount for the sick time law, W-2, 941, 940, UIA, 5081.
- **1099:** no withholding, no employer taxes, no sick accrual, not in the headcount, 1099-NEC and IRIS, counted on the 5081 form count only.

Switching someone from 1099 to W-2 costs about 11% on top of wages (7.65% Social Security and Medicare, 0.6% FUTA, the UIA rate) plus workers' compensation insurance. That is the price of being right.

## Getting a worker started

1. More, People and roles, Hiring codes: type who it is for and tap **Create hiring code**. Send the message it gives you by text or email (Text it, Email it, or Copy message). It has the app link with the code filled in. Each code works once and expires after 14 days; tap Cancel code to stop one early. Nobody can create an account without a code, and 5 wrong codes lock the sign-up screen on that phone for 15 minutes.
2. They open the link, enter the code, create an account and are asked right away for their paperwork: legal name, address, Social Security number, W-4 and MI-W4 answers, cell phone, emergency contact, guard license number and expiration date, and a signature. It is encrypted and held against their login.
3. More, People and roles: their name shows "Ready to approve". Open it, pick W-2 or 1099, enter the hourly rate and hire date, choose the role and tick the sites they work at, then tap Approve and add to payroll. That one step creates the worker record, moves their signed paperwork onto it, assigns the sites and lets them sign in.
4. For a W-2 employee the worker record then shows the **new-hire checklist**:
   - **Form I-9**, due by the end of the third business day after they start. See their original ID documents in person, fill in Section 2 and keep it on file (3 years after hire, or 1 year after they leave, whichever is later). It is not mailed anywhere.
   - **Michigan new hire report**, due within 20 days of the hire date, free at mi-newhire.com.
   Both show on the To do list until you mark them done.
5. Anything else (weekly cap, notes) can be changed later under More, Workers.
6. On first open they sign the sick time policy. Contractors are also asked for a W-9 under More, My tax paperwork.
7. Setting someone up by hand still works: add the worker under More, Workers, then link the login under People and roles ("Set up by hand instead").

## Guard licenses and emergency contacts

Each person's phone, emergency contact and guard license are on their profile under People and roles (tap the phone numbers to call). Staff update their own under More, My contact and license. From 30 days before a license expires, it shows on your To do list and as a banner on that person's phone, and it stays until the new expiration date is entered. An expired license shows in red.

## The worker's phone

- **Clock.** Shows the next scheduled shift. Clock in at the site (location is checked once, then not tracked). The checklist for that site appears; tick items, and add a photo or video where the task asks for one. Clock out. Hours this week show against the cap.
- **My hours.** Every shift, by week.
- **Time off.** Sick time balance. Request planned time at least 7 days ahead, or Sick today any time. Sign the policy.
- **My pay.** Pay stubs with year-to-date totals and sick time balance.
- **More.** Tax paperwork, guide, sign out.

## Contractor invoices

A worker set up as 1099 does not see the clock. They see Invoices: bill a visit with the site, date, hours on site, the rate (prefilled with the rate you set on their record), any extra lines such as supplies, and a photo of their paper invoice if they have one. Invoices land on the Timesheets tab for approval; one that changes the rate is flagged in red with what the visit would cost at the agreed rate. The site's task list appears on the invoice as Work completed: the contractor ticks what was done and attaches photo or video proof; required items block the invoice until proof is attached. You see every item and file when you review. On the Pay tab, picking a contractor shows their invoices: pending ones can be approved on the spot, approved ones are listed and the work period stretches to cover them, and the total fills in as other pay. Saving marks them paid, downloads a payment statement (PDF) for your records and theirs, and adds to the 1099-NEC total. The contractor gets the same statement under My pay. In Books, contractor payments show as their own line (Schedule C contract labor), separate from employee payroll.

**Job board.** Under Schedule, post a job: site, start date and optional due date, description, and a flat price or hourly rate. Contractors see open jobs on their Invoices tab and take the ones they want; taking a job attaches them to the site so its scope and proof rules apply. When they bill it, the invoice is prefilled from the job and the job closes. Contractors are never put on the schedule or the clock; the app refuses both.

For a contractor, treat the task list as the scope of work you are buying and the photos as proof of delivery. That is normal contracting. What to avoid with contractors is telling them the method, the order, or how long to take.

## Schedule

More, Schedule. Add a shift: worker, site, date, planned hours. Fixed start time, or a window (site opens at 8 PM, work due by 7 AM). Repeat weekly. Site defaults fill most of it in.

**Guaranteed hours.** A shift with guarantee on is paid the greater of planned and actual time. Finish a 4-hour job in 3, get paid 4. Run to 5, get paid 5. Turn on "only when all required tasks are done" to tie the guarantee to the checklist. Overtime and sick accrual use hours actually worked, as federal law requires.

## Checklists and proof

More, Sites, open a site, Checklist. Add tasks. For each, choose no proof, photo, video, or either, and whether it is required. A required proof locks the checkbox until the worker adds the file. Files go to a private store that only people who can see that shift can open. Every shift starts with a fresh list.

## Sick time (Michigan Earned Sick Time Act)

- Earned at 1 hour per 30 worked, from approved shifts.
- Use and carryover caps are set by the app from your headcount: 40 hours while under 10 employees, 72 once you have had 10 or more in 20 weeks.
- New hires wait 120 days (you can shorten it in Settings).
- Planned requests need 7 days notice. Sudden illness is always accepted; it is marked late only if the request came after the shift started.
- After 3 consecutive days you may request a doctor's note (button appears on the request).
- Approved sick hours are paid at the regular rate on the next paycheck.
- Print the policy notice from Settings and have workers sign it in the app.

## Attendance and discipline

Timesheets, tap a worker. Log no-call no-show, late notice, unexcused absence or tardy; each carries points set in Settings. Steps (verbal, written, final, termination) trigger at point totals you set. The worker signs each step on their phone. The app refuses any event on a day of approved sick time.

## Payroll details

- Federal withholding uses the IRS percentage method with each worker's W-4 answers. Official tables are built in for the current year; later years are projected until the IRS publishes them.
- Social Security 6.2% each side up to the wage base, Medicare 1.45% each side plus 0.9% employee-only over $200,000.
- Michigan 4.25% after exemptions from the MI-W4.
- City tax from the worker's home city and the site's city, all 24 Michigan cities, with the resident credit and the $600 exemption.
- Employer side: FUTA 0.6% on the first $7,000, Michigan UIA at the rate on your notice.
- Overtime at 1.5 over 40 hours in a workweek.

## What each form is and why

| Form | What it is | Why it exists |
|---|---|---|
| Federal deposits (EFTPS) | The income tax you withheld plus both halves of Social Security and Medicare, sent monthly | The IRS collects payroll tax as you go; late deposits are the most common and most expensive payroll penalty |
| Form 941 | Quarterly report of wages, withholding and deposits | Lets the IRS match your deposits to what you owed; a balance appears only if deposits fell short |
| Form 940 | Annual federal unemployment tax, 0.6% of the first $7,000 per employee, employer-only | Funds the federal share of unemployment benefits |
| Form W-2 | Each employee's annual wage and tax statement | The worker files their return with it; Social Security credits their earnings from it |
| SSA wage file | The W-2 data sent electronically to Social Security | Replaces the paper W-3 summary; SSA forwards it to the IRS |
| Form 1099-NEC | Annual statement for each contractor paid $2,000 or more | Tells the IRS what you paid so the contractor pays their own tax |
| IRIS upload | The 1099 data sent electronically | Replaces the paper 1096 summary |
| Michigan withholding | State income tax you withheld, paid monthly on Michigan Treasury Online | Same idea as the federal deposit, for the state |
| Form 5081 | Annual Michigan reconciliation of wages, withholding and payments | Confirms your monthly state payments matched what you withheld |
| UIA wage report | Quarterly list of every employee's wages, uploaded in MiUI, with the state unemployment tax on the first $9,500 each | Funds unemployment benefits; paying it on time is what earns the FUTA credit |
| City reconciliation | Annual summary per city of wages and city tax withheld | Cities check your payments the way the state does |
| W-4, MI-W4, I-9, W-9 | Worker paperwork you keep, not file | W-4s set withholding; the I-9 proves work eligibility (paper, ID checked in person); the W-9 is the contractor's tax ID |

## Tax filings

More, Tax filings. Pick the year and quarter. Every button builds from saved paychecks:

- **Form 941** on the official IRS PDF, filled. Print, sign, mail. Line 13 assumes the deposits marked paid on the Taxes tab.
- **Form 940** on the official PDF. Enter what you already deposited for FUTA.
- **W-2 copies** for employees (copies B, C and 2), the **SSA file** to upload on Business Services Online (run AccuWage Online on it first), and a keying sheet.
- **1099-NEC copies** and the **IRIS file**. Match the column order with the template downloaded from IRIS before uploading.
- **Michigan 5081** on the official PDF. The **UIA wage file** for MiUI (test it with the MiUI validator).
- **City reconciliation pages**, one per city, with every number the city form asks for.

Paper Copy A of W-2s and 1099s is not produced, because those need the red-ink IRS forms. Upload instead; it is free.

## Books

More, Books. Record money received (date, site or client, amount, how, with a photo of the check) and expenses (date, category, vendor, amount or miles, with a photo of the receipt). The Overview shows money in, payroll cost, other expenses and profit for the period, and a table of each site's billing against its labor cost so you can see which jobs are priced right. Export the year as a CSV for your accountant; it lists every income line, every expense by Schedule C category, and payroll.

### Vehicles

Each vehicle you own gets one method for the whole year:

- **Standard mileage.** Log the miles for each trip (date, miles, where and why); the app values them at the IRS rate in Settings. You must use mileage in the first year a vehicle is in the business if you ever want to use it for that vehicle. Simplest, and usually best for a car.
- **Actual costs.** Fuel, repairs, tires, insurance, and depreciation, times the business-use percentage. Usually better for a van or truck that costs a lot to run. Keep every receipt.

Parking, tolls, loan interest and rental or lease payments are deductible under either method. Rentals are always actual cost. The Vehicles table on the Books overview shows which method each vehicle appears to be using and warns if both were logged.

### What to keep

A photo of every receipt over $75 (the app stores it), a mileage log, bank and card statements, and the year export. Keep them three years after the return is filed, seven if in doubt.

### What is not deductible

Owner draws, personal use of anything, federal income tax, fines and tickets, commuting from home to a regular first stop, and the half of meals the law excludes.

## The owner's own taxes

Everything above is the workers' side. The profit that is left after wages, employer taxes, contractor payments and expenses is the owner's personal income for the year. It is taxed whether it is drawn out or left sitting in the business account; a draw is not an expense and does not change the tax, and leaving the money in the account does not avoid it. Only real business spending lowers it.

For a sole proprietor or single-member LLC that means, on the profit: self-employment tax (15.3% on 92.35% of the profit, the owner's own Social Security and Medicare), federal income tax at the owner's personal brackets after the standard deduction, half the self-employment tax and the 20% qualified business income deduction, Michigan income tax at 4.25%, and city tax. City tax works the same way it does for paychecks: the city the owner lives in taxes all the profit at its resident rate, every other taxing city where the business works taxes its share at the nonresident rate, and the home city gives credit for that. The share is worked out from the income billed from sites in each city, so set each site's city under Sites. Together that is usually around a third of the profit.

The IRS and Michigan want it quarterly, not in April: April 15, June 15, September 15 and January 15. Paying late brings a penalty even if the year-end total is right.

This section is private: only owners and administrators see the settings and the estimate; managers, supervisors and workers do not. Set the owner's filing status under Settings, Owner's own taxes. Books, Overview then shows the tax on the profit so far, what to set aside, and the four payments with a Mark paid button; the same payments appear on the to-do list when they come due. It is a set-aside estimate, not the return. A partnership, S corporation or C corporation is taxed differently; choose that in Settings and ask the CPA what to set aside.

## Settings

Business details for tax forms (EIN, address, UIA account, SSA user ID), pay schedule, workweek, time clock rules, weekly hours cap, employer status (read-only), sick time options, attendance points and steps, mileage rate and labor load, tax rates and inflation assumption.

## Refresh and updates

Pull down on any screen, or tap the arrows in the top bar. Data also refreshes when you switch tabs or come back to the app. When a new version of the app is deployed, it reloads itself on the next refresh.

## What the app does not do

It does not transmit returns, move money, prepare the owner's personal return, or replace a CPA. Have an accountant look at the first quarter's 941 and the first year-end. Keep signed paper for anything the app printed for signature.
