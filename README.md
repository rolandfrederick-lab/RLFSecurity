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

## Animations

- `public/js/silk.js`: animated silk background behind the home page headline.
- `public/js/accordion.js`: expanding service gallery on the Services page. Replace each
  `[PHOTO: ...]` placeholder with `<img src="images/..." alt="...">` when photos are ready.
- `src/badge3d.js`: 3D metallic badge on the home page. It is built into
  `public/js/badge3d.js`; after editing it, run `npm install` once, then `npm run build`,
  and commit the rebuilt file. The badge lettering uses `public/fonts/cinzel-badge.json`,
  made from the Cinzel font (SIL Open Font License).

## Viewing locally

Serve the `public/` folder, for example `python3 -m http.server -d public`, and open
http://localhost:8000. (The 3D badge needs a web server; opening the file directly shows
the flat badge instead.) No build step is needed.

## Contact form

The form opens the visitor's email app with the request addressed to
rolandfrederick@gmail.com. To receive submissions directly instead, point the
form at a form service (for example Formspree) or a backend.

## Content still to fill in

Search the pages for text in square brackets, such as `[PRICE]`,
`[LICENSE TYPE]`, `[NUMBER]`, `[OFFICE HOURS]`, `[ADDRESS]` and the
`[PHOTO: ...]` placeholders on the About page.

## Publishing

The site is hosted on Cloudflare Workers at rlfsecurity.com. `wrangler.jsonc`
tells Cloudflare to serve the files in `public/`. Every push to the production
branch deploys automatically.
