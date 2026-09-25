# Mazufa Records — transparency ledger mirror

This repository is an **independent public copy** of the transparency ledger published by Mazufa Records at <https://rights.mazufa.com/ledger>.

Every day a GitHub Action (outside Mazufa's own servers) downloads each daily checkpoint, checks its Ed25519 signature and its link to the previous day, and stores it here. Once a checkpoint is in this repository's history it cannot be changed without that change being visible to everyone. If a checkpoint that was already mirrored ever changes on Mazufa's server, the Action **fails** and the difference is recorded.

The ledger contains **no names, emails or personal data** — only contract references and SHA-256 fingerprints.

## Verify a checkpoint yourself

```bash
curl -s https://rights.mazufa.com/ledger/pubkey.pem -o pubkey.pem
node -e '
const {createPublicKey,verify}=require("crypto"),fs=require("fs");
const canon=v=>Array.isArray(v)?"["+v.map(canon).join(",")+"]":v&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}":JSON.stringify(v);
const j=JSON.parse(fs.readFileSync(process.argv[1]));
console.log(verify(null,Buffer.from(canon(j.checkpoint)),createPublicKey(fs.readFileSync("pubkey.pem")),Buffer.from(j.signature,"base64")));
' ledger/cp/YYYY-MM-DD.json
```

Each checkpoint is also timestamped by independent RFC 3161 authorities and anchored in Bitcoin through OpenTimestamps (`*.tsr`, `*.ots`).

---

# سجل معزوفة الشفاف — نسخة مستقلة

هذا المستودع نسخة عامة مستقلة من السجل الشفاف لشركة معزوفة ريكوردز. كل يوم تنزل خدمة GitHub (خارج خوادم معزوفة) نقطة التحقق اليومية، وتتأكد من توقيعها ومن ارتباطها باليوم السابق، وتحفظها هنا. بعد حفظها لا يمكن تغييرها دون أن يظهر التغيير للجميع، ولو تغيّرت نقطة محفوظة على خادم معزوفة يفشل الفحص ويُسجَّل الفرق. السجل لا يحتوي أي اسم أو بيانات شخصية — مراجع وبصمات فقط.
