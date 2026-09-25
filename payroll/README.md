# Payroll and time clock

The staff payroll and GPS time clock for R L Frederick Private Security, published at
https://rlfsecurity.com/app/ (linked as "Staff login" in the website footer).

It is a copy of the cleaning company's app (`gholsona171/payroll-timeclock`, commit
`d5e51b6`), reworded for security work and connected to the security company's own
Supabase project, so the two companies' data stay separate.

- `public/app/`: the app (plain HTML and JavaScript; no build step).
- `public/app/config.js`: the security company's Supabase Project URL and publishable key.
- `supabase/migrations/`: the database setup. Supabase's GitHub integration applies it to the
  project automatically; database changes go in new, dated files in this folder.
- `supabase/config.toml`: the linked Supabase project and its login settings.
- `payroll/SETUP.md`: full setup and first-run guide.
- `payroll/tests/sql/`: database tests carried over from the original app.

## Hiring codes, contact details, new-hire checklist

`supabase/migrations/20260925120000_hiring_codes_and_staff_details.sql` and `public/app/js/staff.js`.

- **Hiring codes.** Owners and managers create one-time codes under People and roles
  (8 characters, expire after 14 days, can be cancelled). The `handle_new_user` trigger
  refuses to create any account without a valid unused code, so the check cannot be
  skipped by going around the app; the very first account (the owner) needs none. The
  sign-up screen checks the code first (`check_hire_code`) and locks for 15 minutes on
  that device after 5 wrong codes.
- **Contact details.** `staff_details` holds each person's phone, date of birth, emergency
  contact and, for armed posts, their Michigan CPL and expiration. Michigan does not
  license security officers individually; they work under the agency license.
- **New-hire checklist.** Workers added from now on get the security screening required
  of a licensed agency (fingerprint background check, signed application, eligibility)
  before their first post, and W-2 employees also Form I-9 (3 business days) and the
  Michigan new hire report (20 days).
- **Agency compliance** (`supabase/migrations/20260925150000_agency_compliance.sql`).
  Settings holds the LARA agency license, surety bond, liability and workers' comp dates
  with reminders 60 days ahead. Workers, LARA employee roster builds the quarterly roster
  (name, date of birth, hire and end dates) with a reminder each quarter.

## Website editing

Owners (and administrators) get **More, Website** in the app. It edits the public site's
contact details, home page notice, credentials, About page text and photos, training
prices and dates, and the photo galleries. Text is stored in the `website` table and
photos in the public `website` storage bucket (`supabase/migrations/20260924200000_website_content.sql`);
`public/js/content.js` fills them into the pages, and anything left empty keeps the
page's built-in text.

Photos go through an editor (`public/app/js/photo-editor.js`): crop, zoom, drag to
position, rotate, and optional background removal using Google MediaPipe's selfie
segmentation model (Apache-2.0), which runs in the browser and loads from jsDelivr and
Google's model storage on first use. The untouched original and the edit settings are
stored with each photo so it can be re-cropped later.

Never put a Supabase secret key (`sb_secret_...`) or database password in this repository.
