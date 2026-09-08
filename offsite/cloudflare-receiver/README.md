# Head office receiver

A small Cloudflare Worker that accepts each clinic's encrypted backup and keeps it in an R2 bucket. The clinic sends the file on its own whenever it has a connection. Nobody at the clinic sets anything up.

## Set it up once (head office)

From this folder, signed in to the Lloyds Cloudflare account:

```
npx wrangler login
npx wrangler r2 bucket create lloyds-clinic-backups
npx wrangler secret put RECEIVER_KEYS
npx wrangler deploy
```

For the secret, paste a JSON object with one long random key per clinic, for example:

```
{"lae-clinic": "paste-a-long-random-key-here"}
```

Make a key with `openssl rand -hex 32`. The deploy prints the worker address, something like `https://lloyds-backup-receiver.<account>.workers.dev`.

## Tell the clinic server where to send

On the clinic server, create `server/config/install.json` from `install.example.json` and fill in:

```
{
  "clinic_id": "lae-clinic",
  "offsite_url": "https://lloyds-backup-receiver.<account>.workers.dev",
  "offsite_key": "the same key as in RECEIVER_KEYS for this clinic"
}
```

The server picks the file up within half a minute. The first copy goes about three minutes after the server starts, then after every nightly backup.

## Reading a backup back

```
curl -H "Authorization: Bearer <key>" https://<worker>/backups/lae-clinic
curl -H "Authorization: Bearer <key>" -o hospital.db.enc https://<worker>/backups/lae-clinic/<file>
node server/scripts/restore-backup.js hospital.db.enc
```

The restore needs the clinic's backup passphrase. The receiver never has it.
