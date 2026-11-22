// Метки версий у стилей и скриптов в site.html и index.html: «css/public.css?v=1a2b3c4d».
// Метка — начало хеша содержимого файла: файл изменился — метка другая, и браузер
// скачивает его заново, а не берёт старый из кэша (не нужно жать Ctrl+F5).
// Неизменённые файлы метку не меняют и остаются в кэше.
//
// Запуск из корня репозитория: node tools/stamp-versions.js
// (запускается сам перед каждым коммитом — см. tools/README.md)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const pages = ['site.html', 'index.html'];

// href="css/…css" и src="js/…js" (с меткой или без), только свои файлы, не CDN
const REF = /((?:href|src)=")((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?(")/g;

const hashOf = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);

let changed = 0;
for (const page of pages) {
    const file = path.join(root, page);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const out = src.replace(REF, (all, before, ref, after) => {
        const target = path.join(root, ref);
        if (!fs.existsSync(target)) return all;
        return `${before}${ref}?v=${hashOf(target)}${after}`;
    });
    if (out !== src) {
        fs.writeFileSync(file, out);
        changed++;
        console.log(`метки обновлены: ${page}`);
    }
}
if (!changed) console.log('метки уже актуальны');
