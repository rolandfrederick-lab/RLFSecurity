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

Never put a Supabase secret key (`sb_secret_...`) or database password in this repository.
