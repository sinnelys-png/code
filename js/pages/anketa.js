// Разбор анкеты персонажа (колонка X Техтаблицы) на поля карточки.
//
// Анкеты пишутся по шаблону группы, разделы всегда в одном порядке:
//   1 имя · 2 возраст · 3 параметры (рост, вес, вид/порода) · 4 биография (иногда с характером)
//   5 роль · 6 курс · 7 факультет · 8 интересные факты · 9 взаимодействия
// Оформление бывает разным, разбор понимает три вида:
//   • пронумерованные разделы: «1. …», «2. Возраст: …»;
//   • разделы с одинаковым значком в начале строки: «⚽˖ . 21 год»;
//   • подписи разделов: «Биография», «Интересные факты:», «♧Характер:».
// Дуэты: анкета бывает общая (один текст на двоих, параметры «192/190 см» или по именам)
// или раздельная (два блока подряд, у каждого свой значок) — тогда берётся блок персонажа.
(function () {
    const FIELDS = ['name', 'age', 'params', 'bio', 'role', 'course', 'faculty', 'facts', 'interaction'];

    // подписи разделов → поле
    const LABELS = [
        [/^имя/i, 'name'],
        [/^возраст/i, 'age'],
        [/^(параметры|рост|внешн)/i, 'params'],
        [/^(биография|история)/i, 'bio'],
        [/^характер/i, 'character'],
        [/^роль/i, 'role'],
        [/^(номер\s+)?курс/i, 'course'],
        [/^факультет\s*:/i, 'faculty'],
        [/^(интересные\s+)?факты/i, 'facts'],
        [/^(допустимые\s+взаимодействия|степень\s+взаимодействия|взаимодействи)/i, 'interaction'],
    ];

    // значки, которыми начинаются пункты списков (не начало раздела)
    const BULLET = /^[\s–—\-−>•*☆♡♤♧◇◆✦✧·]+/;
    const isLetterOrDigit = (ch) => /[\p{L}\p{N}]/u.test(ch);

    const clean = (s) => String(s || '').replace(/\r/g, '').trim();
    // убрать декоративные символы в начале строки («♤Биография» → «Биография»)
    const stripDecor = (s) => s.replace(/^[^\p{L}\p{N}«"(]+/u, '').trim();

    function labelOf(line) {
        const t = stripDecor(line);
        for (const [re, field] of LABELS) if (re.test(t)) return field;
        return '';
    }

    // убрать подпись раздела: «Возраст: 20 лет» → «20 лет», «Интересные факты:» → «»
    function dropLabel(line) {
        const t = stripDecor(line);
        if (!labelOf(t)) return t;
        const m = t.match(/^[^:]{0,60}:\s*/);
        if (m) return t.slice(m[0].length).trim();
        // подпись без двоеточия на отдельной строке («Биография», «Номер курса»)
        return /^[\p{L}\s.()]+$/u.test(t) && t.split(/\s+/).length <= 7 ? '' : t;
    }

    /* ---------- Блоки (раздельные анкеты дуэта) и разделы ---------- */

    // первый «значок» строки, если строка начинается не с буквы/цифры/маркера списка
    function leadSymbol(line) {
        const t = line.trimStart();
        if (!t || BULLET.test(t[0]) || isLetterOrDigit(t[0]) || /["«(]/.test(t[0])) return '';
        return [...t][0];
    }

    function splitSections(text) {
        const lines = clean(text).replace(/^["«]|["»]$/g, '').split('\n');

        // 1) пронумерованные разделы
        if (lines.filter(l => /^\s*[1-9]\s*[.)]/.test(l)).length >= 4) {
            const blocks = [[]];
            let lastNum = 0;
            lines.forEach(l => {
                const m = l.match(/^\s*([1-9])\s*[.)]\s*(.*)$/);
                if (m && Number(m[1]) === 1 && lastNum >= 5) blocks.push([]);      // вторая анкета подряд
                if (m) {
                    lastNum = Number(m[1]);
                    blocks[blocks.length - 1].push({ num: lastNum, lines: [m[2]] });
                } else if (blocks[blocks.length - 1].length) {
                    const sec = blocks[blocks.length - 1];
                    sec[sec.length - 1].lines.push(l);
                }
            });
            return blocks.map(b => b.map(s => ({ field: FIELDS[s.num - 1] || '', lines: s.lines })));
        }

        // 2) разделы со значком в начале строки
        const blocks = [];
        let block = null;
        lines.forEach(l => {
            const sym = leadSymbol(l);
            if (sym && (!block || block.sym !== sym) && (!block || !l.trim() || true)) {
                // новый значок — новый блок (раздельные анкеты дуэта)
                if (!block || block.sym !== sym) { block = { sym, sections: [] }; blocks.push(block); }
            }
            if (block && sym === block.sym) block.sections.push({ lines: [l.trim()] });
            else if (block && block.sections.length) block.sections[block.sections.length - 1].lines.push(l);
        });
        if (blocks.length && blocks.some(b => b.sections.length >= 4)) {
            return blocks.filter(b => b.sections.length >= 3).map(b => b.sections.map((s, i) => {
                s.lines[0] = stripDecor(s.lines[0].replace(new RegExp('^' + b.sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), ''));
                return { field: labelOf(s.lines[0]) || FIELDS[i] || '', lines: s.lines };
            }));
        }

        // 3) без явной разметки — весь текст как биография
        return [[{ field: 'bio', lines }]];
    }

    // поле раздела по подписи важнее, чем по номеру/порядку
    function toFields(sections) {
        const out = { raw: {} };
        sections.forEach(s => {
            const head = s.lines[0] || '';
            const field = labelOf(head) && labelOf(head) !== 'name' ? labelOf(head) : s.field;
            if (!field) return;
            const body = [dropLabel(head), ...s.lines.slice(1)].join('\n').trim();
            out[field] = out[field] ? `${out[field]}\n${body}` : body;
            out.raw[field] = [stripDecor(head), ...s.lines.slice(1)].join('\n').trim();
        });
        // «♧Характер:» внутри биографии — отдельное поле
        if (out.bio) {
            const parts = out.bio.split(/\n(?=[^\p{L}\n]*характер\s*:?\s*\n?)/iu);
            if (parts.length > 1) {
                out.bio = parts[0].trim();
                out.character = [out.character, dropLabel(parts.slice(1).join('\n').split('\n')[0]), parts.slice(1).join('\n').split('\n').slice(1).join('\n')]
                    .filter(Boolean).join('\n').trim();
            }
        }
        return out;
    }

    /* ---------- Поля одного персонажа ---------- */

    const firstName = (n) => String(n || '').trim().split(/\s+/)[0].toLowerCase().replace(/ё/g, 'е');
    const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

    // подраздел «Кэшиан:» … «Азалия:» внутри раздела — часть для нужного персонажа
    function personPart(text, me, other) {
        if (!text || !me) return text;
        const lines = text.split('\n');
        const heads = lines.map(l => {
            const t = norm(stripDecor(l)).replace(/[:.]/g, '').trim();
            if (!t || t.split(/\s+/).length > 3) return '';
            if (t.startsWith(me)) return 'me';
            if (other && t.startsWith(other)) return 'other';
            return '';
        });
        if (!heads.includes('me')) return text;
        const out = [];
        let take = null;
        lines.forEach((l, i) => {
            if (heads[i]) { take = heads[i] === 'me'; return; }
            if (take === true || take === null) out.push(l);
        });
        return out.join('\n').trim();
    }

    // «192/190» → значение для персонажа №idx
    const pick = (v, idx) => { const p = String(v).split('/').map(x => x.trim()); return p[Math.min(idx, p.length - 1)]; };

    function parseParams(text, idx) {
        const t = String(text || '');
        const height = (t.match(/рост\s*:?\s*(\d{2,3}(?:\s*\/\s*\d{2,3})?)/i) || t.match(/(\d{2,3}(?:\s*\/\s*\d{2,3})?)\s*см/i) || [])[1];
        const weight = (t.match(/вес\s*:?\s*(\d{2,3}(?:\s*\/\s*\d{2,3})?)/i) || t.match(/(\d{2,3}(?:\s*\/\s*\d{2,3})?)\s*кг/i) || [])[1];
        let species = (t.match(/(?:порода|вид)\s*:?\s*([^\n;]+)/i) || [])[1];
        if (!species) {
            // «188 см, 97 кг, непородистый котик.» — то, что осталось после цифр
            species = t.replace(/рост|вес/gi, '')
                .replace(/\d{2,3}(?:\s*\/\s*\d{2,3})?\s*(см|кг)/gi, '')
                .replace(/^[\s,./:;\-–—>]+|[\s,./:;\-–—>]+$/g, '')
                .split('\n')[0]
                .replace(/^[\s,./:;\-–—>]+/, '')
                .trim();
        }
        return {
            height: height ? `${pick(height, idx)} см` : '',
            weight: weight ? `${pick(weight, idx)} кг` : '',
            species: species ? species.replace(/[.\s]+$/, '').trim() : '',
        };
    }

    function parseFacts(text) {
        if (!text) return [];
        const items = [];
        text.split('\n').forEach(l => {
            const raw = l.trim();
            if (!raw) return;
            const t = raw.replace(BULLET, '').trim();
            if (!t) return;
            const isItem = BULLET.test(raw) || !items.length;
            if (isItem) items.push(t);
            else items[items.length - 1] += ' ' + t;
        });
        return items.map(s => s.replace(/[;,]\s*$/, ''));
    }

    const paragraphs = (text) => String(text || '').split(/\n\s*\n|\n/).map(s => s.replace(BULLET, '').trim()).filter(Boolean);

    /**
     * Поля анкеты для персонажа name (duet — имя дуэта, если есть).
     * Возвращает { age, height, weight, species, bio[], character[], facts[], interaction, shared }.
     */
    function parseAnketa(text, name, duet) {
        if (!clean(text)) return null;
        const blocks = splitSections(text).map(toFields);
        const me = firstName(name), other = firstName(duet);

        // раздельная анкета дуэта — блок с нужным именем
        let block = blocks[0];
        if (blocks.length > 1) block = blocks.find(b => norm(b.name).includes(me)) || blocks[0];

        // общая анкета дуэта: в разделе «имя» — оба имени
        const nameLine = norm(block.name || '');
        const shared = !!other && nameLine.includes(me) && nameLine.includes(other);
        const idx = shared && nameLine.indexOf(other) < nameLine.indexOf(me) ? 1 : 0;

        const params = parseParams(personPart(block.params, me, other), idx);
        const age = (String(block.age || '').match(/\d{1,3}\s*(года|год|лет)?/i) || [''])[0].trim();

        return {
            age: age && /\d+$/.test(age) ? `${age} лет` : age,
            height: params.height,
            weight: params.weight,
            species: params.species,
            bio: paragraphs(block.bio),
            character: paragraphs(block.character),
            facts: parseFacts(personPart(block.facts, me, other)),
            // «Степень взаимодействия любая.» / «Допустимые взаимодействия: любые!» / подпись + строка ниже
            interaction: clean(block.raw.interaction)
                .replace(/^(допустимые\s+взаимодействия(\s+с\s+персонажем)?|степень\s+взаимодействия)\s*:?\s*/i, '')
                .split('\n').map(x => x.trim()).filter(Boolean)[0] || '',
            shared,
        };
    }

    if (typeof window !== 'undefined' && window.RCU) window.RCU.parseAnketa = parseAnketa;
    if (typeof module !== 'undefined') module.exports = { parseAnketa };
})();
