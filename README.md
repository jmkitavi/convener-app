This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Importing results slips

Use **Import Results** from Fixtures or an individual fixture. Upload one PDF,
JPEG or PNG (20 MB maximum; PDFs up to 5 pages). Review the fixture, tracked
team, names, handicaps and each result, then preview and explicitly approve
updates before saving. Existing matches are not silently replaced.

The importer uses OpenAI's vision API. Put these server-only settings in
`.env.local`, then restart the app:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_RESULTS_MODEL=gpt-4.1
```

The model must support images and strict JSON-schema output in the Responses
API. It is configurable so it can be changed when models are retired. Nothing
is sent until the user consents in the upload screen. Only normalized results
pages are sent, not your player database or contact details. API data is not
used for training by default, but OpenAI's
[data retention policies](https://developers.openai.com/api/docs/guides/your-data)
still apply; disabling response storage is not zero data retention.

Import endpoints currently accept **loopback hosts only** (`localhost`,
`127.0.0.1`, `::1`). This app has no user authentication; do not expose imports
or the existing app publicly without adding authentication and access controls.

Pages are processed locally into metadata-free JPEG previews, up to 1 MB per
page and 5 MB per import. Very small, unreadable, corrupt or oversized documents
must be replaced/cropped rather than silently compressed beyond readability.
Temporary files are private under `.results-imports/` (or `RESULTS_IMPORT_DIR`,
which must be a private writable directory outside public assets). They are
deleted after saving/cancellation/failure. Abandoned drafts expire after 24
hours; cleanup retries on subsequent import API requests, including after a
restart. If the app is stopped or idle, expired files remain until the next
request; schedule regular requests to the local import settings endpoint if
an operational retention deadline is required.

Draft edits autosave while reviewing. The source file itself is not retained
on the fixture; minimal import metadata and row-to-match links are retained to
make retries safe. A repeated document is flagged for review. Skipped rows and
unapproved conflicting updates do not alter existing matches.

Missing historical handicaps stay unknown. They do not become zero or
automatically use today's player defaults. Existing known values can be
retained on an update or deliberately cleared. Ordinary results statistics
still include completed matches; handicap calculations exclude only records
missing the values they need. Newly created players need a numeric default:
the review screen explicitly shows the initial value (18 if unknown), without
inventing a historical match handicap.

Handwriting, crossed-out scores, ambiguous initials, missing rows and column
perspective can be misread. Always compare all visible source rows with the
draft, add missed rows, and confirm team orientation. Tee groups retain their
printed foursome numbering, including odd/even sequences. Blank scores are
unresolved until corrected, explicitly marked pending, or skipped.

Strong, unique player-name/initial matches are preselected. Ambiguous names
and spelling-only matches stay highlighted with ranked suggestions for manual
acceptance; saved manual choices are preserved. Use **Confirm and collapse**
after checking a row to keep the remaining entries in view. Confirmed rows
remain collapsed after refresh and can be reopened with **Edit row**.

Before using a populated database, stop writes, take a SQLite backup (including
uncheckpointed WAL data via SQLite's backup API), then run:

```bash
npm run db:migrate
npm run dev
```

The migration command handles fresh databases and reconciles this app's
previous untracked schema. It does not reseed or delete match data. Keep
database backups outside the repository. Do not run `db:push` as a substitute
for the tracked upgrade.

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Tests use synthetic documents and isolated databases; supplied results slips
and credentials must not be committed. A live extraction acceptance check
requires a configured API key and explicit permission to send those documents.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
