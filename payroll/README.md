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
