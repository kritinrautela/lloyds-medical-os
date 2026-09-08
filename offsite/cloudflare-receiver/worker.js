/*
 * Head office receiver for Lloyds Medical OS backups.
 *
 * A clinic server sends its encrypted backup file here whenever it has a
 * connection. The file is stored as it arrives in an R2 bucket, under the
 * clinic's own prefix. Nothing here can open a backup: the clinic's backup
 * passphrase never leaves the clinic.
 *
 *   PUT  /backups/<clinic>/<file>   store one file (bearer key required)
 *   GET  /backups/<clinic>          list that clinic's files (bearer key required)
 *   GET  /backups/<clinic>/<file>   download one file (bearer key required)
 *
 * Keys: RECEIVER_KEYS is a JSON object of clinic id to key, so each clinic
 * has its own and one can be changed without touching the others. A single
 * RECEIVER_KEY is accepted for every clinic where that is simpler.
 */

const CLINIC = /^[A-Za-z0-9_.-]{1,64}$/;
const FILE = /^[A-Za-z0-9_.-]{1,120}\.db\.enc$/;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function keyFor(env, clinic) {
  if (env.RECEIVER_KEYS) {
    try {
      const map = JSON.parse(env.RECEIVER_KEYS);
      if (map && typeof map[clinic] === 'string') return map[clinic];
    } catch (err) {
      return null;
    }
  }
  return env.RECEIVER_KEY || null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'backups' || parts.length < 2 || parts.length > 3) return json(404, { error: 'Not found' });
    const clinic = parts[1];
    const file = parts[2] || '';
    if (!CLINIC.test(clinic) || (file && !FILE.test(file))) return json(400, { error: 'That name is not allowed' });

    const auth = request.headers.get('Authorization') || '';
    const presented = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const expected = keyFor(env, clinic);
    if (!expected || !presented || !sameKey(presented, expected)) return json(401, { error: 'Not authorised' });

    const prefix = `${clinic}/`;

    if (request.method === 'PUT' && file) {
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > 512 * 1024 * 1024) return json(413, { error: 'Too large' });
      await env.BACKUPS.put(prefix + file, request.body, {
        httpMetadata: { contentType: 'application/octet-stream' },
        customMetadata: { received_at: new Date().toISOString() }
      });
      return json(200, { stored: prefix + file });
    }

    if (request.method === 'GET' && !file) {
      const listed = await env.BACKUPS.list({ prefix, limit: 1000 });
      const files = listed.objects
        .map((o) => ({ name: o.key.slice(prefix.length), size: o.size, uploaded: o.uploaded }))
        .sort((a, b) => (a.name < b.name ? 1 : -1));
      return json(200, { clinic, count: files.length, files });
    }

    if (request.method === 'GET' && file) {
      const object = await env.BACKUPS.get(prefix + file);
      if (!object) return json(404, { error: 'No such file' });
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file}"`,
          'Cache-Control': 'no-store'
        }
      });
    }

    return json(405, { error: 'Method not allowed' });
  }
};
