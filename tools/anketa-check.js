// Проверка разбора анкет: разбирает все анкеты из таблицы нынешним js/pages/anketa.js
// и сравнивает с прошлым разбором (снимком). Показывает, у кого и какое поле изменилось —
// так правка под одну анкету не сломает тихо чужие.
//
//   node tools/anketa-check.js           — сравнить со снимком (первый запуск — создать снимок)
//   node tools/anketa-check.js --update  — принять нынешний разбор как новый снимок
//   node tools/anketa-check.js Имя       — показать разбор одной анкеты целиком
//
// Порядок работы: перед правкой парсера — снимок (--update), после правки — сравнение;
// если все изменения ожидаемые — снова --update.
// Снимок (tools/anketa-snapshot.json) хранится только у себя — он в .gitignore.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SNAPSHOT = path.join(__dirname, 'anketa-snapshot.json');
const { parseAnketa } = require(path.join(root, 'js/pages/anketa.js'));

// адрес таблицы — тот же, что у сайта (js/core.js)
const core = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8');
const SCRIPT_URL = (core.match(/SCRIPT_URL = '([^']+)'/) || [])[1];

const short = (v) => {
    const s = JSON.stringify(v);
    return s === undefined ? '—' : s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

async function main() {
    const args = process.argv.slice(2);
    const update = args.includes('--update');
    const only = args.filter(a => !a.startsWith('--')).join(' ').trim().toLowerCase();

    if (!SCRIPT_URL) throw new Error('не нашёл SCRIPT_URL в js/core.js');
    const res = await fetch(`${SCRIPT_URL}?part=anketas`);
    const anketas = (await res.json()).anketas || {};
    const names = Object.keys(anketas).sort((a, b) => a.localeCompare(b, 'ru'));

    const now = {};
    for (const n of names) {
        try { now[n] = parseAnketa(anketas[n], n); } catch (e) { now[n] = { ERROR: String(e) }; }
    }

    if (only) {
        const hit = names.filter(n => n.toLowerCase().includes(only));
        if (!hit.length) console.log('нет такой анкеты');
        hit.forEach(n => console.log(`===== ${n}\n${JSON.stringify(now[n], null, 2)}\n`));
        return;
    }

    if (update || !fs.existsSync(SNAPSHOT)) {
        fs.writeFileSync(SNAPSHOT, JSON.stringify(now, null, 1));
        console.log(`снимок сохранён: ${names.length} анкет`);
        return;
    }

    const old = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    let diffs = 0;
    for (const n of new Set([...Object.keys(old), ...names])) {
        if (!(n in now)) { console.log(`− ${n}: анкеты больше нет в таблице`); diffs++; continue; }
        if (!(n in old)) { console.log(`+ ${n}: новая анкета`); diffs++; continue; }
        const a = old[n] || {}, b = now[n] || {};
        const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])]
            .filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
        if (!fields.length) continue;
        diffs++;
        console.log(`\n≠ ${n}`);
        fields.forEach(k => console.log(`   ${k}:\n     было: ${short(a[k])}\n     стало: ${short(b[k])}`));
    }
    console.log(diffs ? `\nизменений: ${diffs} (из ${names.length} анкет)` : `без изменений (${names.length} анкет)`);
    // разбор упал хоть на одной анкете — код ошибки (видно и в скриптах)
    if (Object.values(now).some(v => v && v.ERROR)) process.exitCode = 1;
}

main().catch(e => { console.error(e.message || e); process.exitCode = 1; });
