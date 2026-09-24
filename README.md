# R L Frederick Private Security & Weapon Safety

Website for R L Frederick Private Security & Weapon Safety, Detroit, Michigan.

## Pages

The website files are in `public/`.

- `index.html`: Home
- `services.html`: Security services
- `training.html`: Weapon safety training courses
- `about.html`: Company and leadership
- `contact.html`: Contact details and request form

Shared styles are in `css/styles.css` and scripts in `js/main.js`.

## Staff payroll and time clock

`public/app/` is the staff payroll and GPS time clock, published at
https://rlfsecurity.com/app/ and linked as "Staff login" in the footer. It runs on the
security company's own Supabase project, whose database setup lives in `supabase/migrations/`.
See `payroll/README.md` and `payroll/SETUP.md`.

Owners edit the website's photos, prices and contact details from the app (More, Website);
`public/js/content.js` loads them into the pages.

## Animations

- `public/js/silk.js`: animated gold silk background (behind the whole home page).
- `src/home-scene.js`: 3D badge leaning against a flashlight, fixed behind the home page;
  it turns a full circle as you scroll. The models are in `src/badge-model.js` and
  `src/flashlight-model.js`. These are built into `public/js/home-scene.js`: after
  editing them, run `npm install` once, then `npm run build`, and commit the rebuilt
  file. The badge lettering uses `public/fonts/cinzel-badge.json`, made from the Cinzel
  font (SIL Open Font License).
- `public/js/accordion.js`: expanding photo galleries on the home and Services pages.
  Replace each `[PHOTO: ...]` placeholder with `<img src="images/..." alt="...">` when
  photos are ready.

## Viewing locally

Serve the `public/` folder, for example `python3 -m http.server -d public`, and open
http://localhost:8000. (The 3D scene needs a web server; it doesn't load when the file is opened directly.) No build step is needed.

## Contact form

The form posts to `/api/contact`, handled by the Worker in `src/worker.js`, which emails
the request from website@rlfsecurity.com to the owner through Cloudflare Email Routing
(`send_email` binding in `wrangler.jsonc`). The destination must be a verified address in
Email Routing; to change it, update both `destination_address` and `CONTACT_EMAIL_TO` in
`wrangler.jsonc`. A hidden field filters out bots. The form never opens the visitor's email
app; if sending fails, it asks them to try again or call.

## Content still to fill in

Search the pages for text in square brackets, such as `[PRICE]`,
`[LICENSE TYPE]`, `[NUMBER]`, `[OFFICE HOURS]`, `[ADDRESS]` and the
`[PHOTO: ...]` placeholders on the About page.

## Publishing

The site is hosted on Cloudflare Workers at rlfsecurity.com. `wrangler.jsonc`
tells Cloudflare to serve the files in `public/`. Every push to the production
branch deploys automatically.
