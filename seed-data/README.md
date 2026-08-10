# Seed data

`npm run db:seed` loads `seed-data/mafesh.json` into the database.

That file holds **real client content** — captions, internal revision notes and
Google Drive share links — so it is git-ignored and never leaves your machine.
`example.json` shows the shape it expects.

```bash
# content only
npm run db:seed

# content plus a login
npm run db:seed -- --user you@company.com "a-strong-password"
```

Re-running is safe: companies that already exist by name are skipped.
