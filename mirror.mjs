// Independent mirror of the Mazufa Records transparency ledger.
// Runs in GitHub Actions (not on Mazufa's servers). It downloads every published
// daily checkpoint, verifies its Ed25519 signature and its link to the previous
// day, and refuses — failing loudly — if a checkpoint it already holds has changed.
import { createHash, createPublicKey, verify } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';

const BASE = process.env.LEDGER_BASE || 'https://rights.mazufa.com';
const OUT = 'ledger';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const exists = async (p) => access(p).then(() => true, () => false);
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: { 'User-Agent': 'mazufa-ledger-mirror (github actions)' } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
const problems = [];
await mkdir(`${OUT}/cp`, { recursive: true });

// 1) The public key must never change silently.
const pub = await get('/ledger/pubkey.pem');
if (await exists(`${OUT}/pubkey.pem`)) {
  const old = await readFile(`${OUT}/pubkey.pem`);
  if (!old.equals(pub)) problems.push('ledger public key CHANGED compared with the mirrored copy');
} else await writeFile(`${OUT}/pubkey.pem`, pub);
const key = createPublicKey((await readFile(`${OUT}/pubkey.pem`)).toString());

// 2) Every checkpoint: signature, chain link, immutability.
const index = JSON.parse((await get('/ledger/checkpoints.json')).toString());
const dates = (index.checkpoints || []).map((c) => c.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
let prevBytes = null, added = 0;
for (const d of dates) {
  const path = `${OUT}/cp/${d}.json`;
  const live = await get(`/ledger/cp/${d}.json`);
  if (await exists(path)) {
    const kept = await readFile(path);
    if (!kept.equals(live)) problems.push(`checkpoint ${d} differs from the copy mirrored earlier (kept ${sha(kept)}, live ${sha(live)})`);
  } else { await writeFile(path, live); added++; }
  const bytes = await readFile(path);
  const j = JSON.parse(bytes.toString());
  if (!verify(null, Buffer.from(canon(j.checkpoint)), key, Buffer.from(j.signature, 'base64'))) problems.push(`checkpoint ${d}: Ed25519 signature does NOT verify`);
  if (prevBytes && j.checkpoint.prev_checkpoint_sha256 !== sha(prevBytes)) problems.push(`checkpoint ${d}: link to the previous day is broken`);
  prevBytes = bytes;
  // Anchors (timestamps / Bitcoin proofs), best effort.
  try {
    const anc = await get(`/ledger/cp/${d}.anchors.json`);
    if (!(await exists(`${OUT}/cp/${d}.anchors.json`))) await writeFile(`${OUT}/cp/${d}.anchors.json`, anc);
    const a = JSON.parse(anc.toString());
    for (const f of [...(a.tsa || []), ...(a.ots || [])].map((x) => String(x.file || '').split('/').pop()).filter(Boolean)) {
      if (!/^\d{4}-\d{2}-\d{2}\.[a-z0-9-]+\.(tsr|tsq|ots)$/.test(f) || await exists(`${OUT}/cp/${f}`)) continue;
      try { await writeFile(`${OUT}/cp/${f}`, await get(`/ledger/cp/${f}`)); } catch {}
      const q = f.replace(/\.tsr$/, '.tsq');
      if (q !== f && !(await exists(`${OUT}/cp/${q}`))) { try { await writeFile(`${OUT}/cp/${q}`, await get(`/ledger/cp/${q}`)); } catch {} }
    }
  } catch {}
}
await writeFile(`${OUT}/checkpoints.json`, JSON.stringify(index, null, 1));
await writeFile(`${OUT}/LAST-CHECK.txt`, `checked ${new Date().toISOString()} · ${dates.length} checkpoints · ${added} new · ${problems.length} problems\n`);
console.log(`checkpoints: ${dates.length}, new: ${added}`);
if (problems.length) { console.error('PROBLEMS:\n- ' + problems.join('\n- ')); process.exit(1); }
