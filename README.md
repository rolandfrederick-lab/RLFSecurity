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

## Contact form and Inbox

The form posts to `/api/contact`, handled by the Worker in `src/worker.js`. It emails the
request from website@rlfsecurity.com to the owner through Cloudflare Email Routing
(`send_email` binding in `wrangler.jsonc`) and saves it to the `messages` table, which the
staff app shows under the **Inbox** tab (owners and managers). A hidden field filters out
bots; the form never opens the visitor's email app.

Replies written in the Inbox go through `/api/reply`: the Worker checks the Supabase
sign-in (owner or manager only), builds the branded reply (the sender's name and title,
the phone numbers from the Website settings, and the original request quoted), and sends
it through **Gmail** (smtp.gmail.com, port 465) signed in as `GMAIL_USER` with a Gmail
app password, from rolandfrederick@rlfsecurity.com (a "Send mail as" address on that
Gmail account). Gmail keeps a copy in its Sent folder, and the reply is recorded in
`message_replies`.

The Inbox tab has four folders: Inbox (open requests), Sent (replies and new emails),
Archived and Trash. **Compose** writes a new email to any address in the same design,
without a quoted request. Trash, restore, delete forever and Empty trash act only on the
app's records; Gmail is not changed.

One-time setup: in Cloudflare, Workers & Pages, rlfsecurity, Settings, Variables and
Secrets, add a **secret** named `GMAIL_APP_PASSWORD` holding the Gmail app password
(from myaccount.google.com/apppasswords). Never put it in the code. Until it is added,
the Inbox can preview replies but not send them. If the app password is ever revoked or
the Google password changes, create a new app password and update the secret.

## Content still to fill in

Search the pages for text in square brackets, such as `[PRICE]`,
`[LICENSE TYPE]`, `[NUMBER]`, `[OFFICE HOURS]`, `[ADDRESS]` and the
`[PHOTO: ...]` placeholders on the About page.

## Publishing

The site is hosted on Cloudflare Workers at rlfsecurity.com. `wrangler.jsonc`
tells Cloudflare to serve the files in `public/`. Every push to the production
branch deploys automatically.
