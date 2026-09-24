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

## Viewing locally

Open `public/index.html` in a browser. No build step is needed.

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
