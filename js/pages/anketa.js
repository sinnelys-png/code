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
        // параметры отдельными пунктами: «4. Вес: 72 кг», «5. Порода: персидский кот»
        [/^(вес|порода|вид(\s+гибрида)?)\s*[:—–-]/i, 'params'],
        [/^(биография|история|био\s*:|био$)/i, 'bio'],
        [/^характер/i, 'character'],
        [/^роль/i, 'role'],
        [/^(номер\s+)?курс/i, 'course'],
        [/^факультет\s*:/i, 'faculty'],
        [/^(интересные\s+)?факты/i, 'facts'],
        [/^недопустимые/i, 'forbidden'],
        [/^(допустимые\s+взаимодействия|степень\s+взаимодействия|взаимодействи)/i, 'interaction'],
    ];

    // значки, которыми начинаются пункты списков (не начало раздела)
    const BULLET = /^[\s–—\-−>›»•*☆♡♤♧◇◆✦✧·]+/;
    const isLetterOrDigit = (ch) => /[\p{L}\p{N}]/u.test(ch);

    // «ㅤ» (U+3164) и подобные пустые символы — для отступов в анкетах, считаем пробелами
    const clean = (s) => String(s || '').replace(/\r/g, '').replace(/[ㅤᅟᅠ⠀ﾠ]/g, ' ').replace(/[「」『』]/g, '').trim();
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
        // подпись без двоеточия на отдельной строке («Биография», «Номер курса», «Биография ↓»)
        const bare = t.replace(/[^\p{L}\p{N})]+$/u, '');
        return /^[\p{L}\s.()]+$/u.test(bare) && bare.split(/\s+/).length <= 7 ? '' : t;
    }

    /* ---------- Блоки (раздельные анкеты дуэта) и разделы ---------- */

    // первый «значок» строки, если строка начинается не с буквы/цифры/маркера списка
    function leadSymbol(line) {
        const t = line.trimStart();
        if (!t || BULLET.test(t[0]) || isLetterOrDigit(t[0]) || /["«(]/.test(t[0])) return '';
        return [...t][0];
    }

    // раздел без подписи — по содержимому: «19 лет», «Студент», «1 курс», «Факультет гостиничного дела»
    function guessField(line) {
        const t = stripDecor(line).toLowerCase();
        if (/^\d{1,3}\s*(год|года|лет)(?![а-я])/.test(t)) return 'age';
        if (/^(студент|преподават|персонал)/.test(t)) return 'role';
        if (/^\d\s*курс|курс$/.test(t)) return 'course';
        if (/^факультет|факультет\.?$/.test(t) && t.length < 70) return 'faculty';
        return '';
    }

    function splitSections(text) {
        const lines = clean(text).replace(/^["«]|["»]$/g, '').split('\n');

        // 1) пронумерованные разделы; перед номером может стоять значок: «✩1. Селена Эсфир»;
        //    номера бывают и римскими: «IV. Биография»
        const NUM = /^\s*[^\p{L}\p{N}\s«"(]{0,3}\s*([1-9]|VIII|VII|VI|IV|IX|V|III|II|I)\s*[.)]\s*(.*)$/u;
        const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };
        const numOf = (v) => ROMAN[v] || Number(v);
        if (lines.filter(l => NUM.test(l)).length >= 4) {
            const blocks = [[]];
            let lastNum = 0;
            lines.forEach(l => {
                const m = l.match(NUM);
                if (m && numOf(m[1]) === 1 && lastNum >= 5) blocks.push([]);      // вторая анкета подряд
                if (m) {
                    lastNum = numOf(m[1]);
                    blocks[blocks.length - 1].push({ num: lastNum, lines: [m[2]] });
                } else if (blocks[blocks.length - 1].length) {
                    const sec = blocks[blocks.length - 1];
                    // подпись раздела без номера («БИО:» внутри пункта 3) — новый раздел
                    const lab = labelOf(l);
                    if (['bio', 'character', 'facts', 'interaction'].includes(lab) && stripDecor(l).length < 40) {
                        sec.push({ num: 0, field: lab, lines: [l] });
                    } else {
                        sec[sec.length - 1].lines.push(l);
                    }
                }
            });
            const isList = (s) => s.lines.filter(l => /^\s*[—–\-•*➥›»✦·]/.test(l)).length >= 2;
            return blocks.map(b => b.map(s => {
                let field = s.field || FIELDS[s.num - 1] || '';
                if (['course', 'faculty', 'role'].includes(field) && !labelOf(s.lines[0]) && isList(s)) field = 'facts';
                return { field, lines: s.lines };
            }));
        }

        // 2) разделы со значком в начале строки
        const blocks = [];
        let block = null;
        let para = 0;          // номер абзаца (абзацы разделены пустой строкой)
        lines.forEach(l => {
            if (!l.trim()) para++;
            const sym = leadSymbol(l);
            if (sym && (!block || block.sym !== sym) && (!block || !l.trim() || true)) {
                // новый значок — новый блок (раздельные анкеты дуэта)
                if (!block || block.sym !== sym) { block = { sym, sections: [] }; blocks.push(block); }
            }
            if (block && sym === block.sym) block.sections.push({ para, lines: [l.trim()] });
            else if (block && block.sections.length) block.sections[block.sections.length - 1].lines.push(l);
        });
        // абзац из 3+ строк с тем же значком, где ни одна не похожа на подпись или
        // роль/курс/факультет, — это список фактов («🐾 спит везде…», «🐾 боится…»)
        const isPlain = (s) => !labelOf(stripDecor(s.lines[0])) && !guessField(s.lines[0]);
        const mergeLists = (secs) => secs.reduce((out, s, i) => {
            const prev = out[out.length - 1];
            if (prev && prev.list && prev.para === s.para) { prev.lines.push(...s.lines); return out; }
            const group = secs.filter(x => x.para === s.para);
            if (i > 0 && group[0] === s && group.length >= 3 && group.every(isPlain)) {
                out.push({ para: s.para, list: true, lines: [...s.lines] });
            } else out.push(s);
            return out;
        }, []);
        blocks.forEach(b => { b.sections = mergeLists(b.sections); });
        if (blocks.length && blocks.some(b => b.sections.length >= 4)) {
            return blocks.filter(b => b.sections.length >= 3).map(b => b.sections.map((s, i) => {
                s.lines[0] = stripDecor(s.lines[0].replace(new RegExp('^' + b.sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), ''));
                return { field: labelOf(s.lines[0]) || guessField(s.lines[0]) || (s.list ? 'facts' : FIELDS[i]) || '', lines: s.lines };
            }));
        }

        // 3) разделы через длинное тире в начале строки («– 19 лет», «– Студент»);
        //    первая строка без тире — имя, пункты через короткий дефис — список фактов.
        //    Подписей нет, поэтому поле угадываем по содержимому.
        const DASH = /^\s*[–—]\s+/;
        if (lines.filter(l => DASH.test(l)).length >= 4) {
            const sections = [];
            let prevBlank = true;
            lines.forEach(l => {
                const t = l.trim();
                if (!t) { prevBlank = true; return; }
                const item = /^[-•*]\s+/.test(t);
                const last = sections[sections.length - 1];
                if (DASH.test(l) || !sections.length) sections.push({ lines: [t.replace(DASH, '')] });
                else if (item && prevBlank && !(last && last.list)) sections.push({ list: true, lines: [t] });
                else last.lines.push(t);
                prevBlank = false;
            });
            return [sections.map((s, i) => {
                const head = s.lines[0];
                let field = labelOf(head) || guessField(head);
                if (!field) {
                    if (s.list) field = 'facts';
                    else if (i === 0) field = 'name';
                    else if (/\d\s*(см|кг)/i.test(head)) field = 'params';
                    else if (/взаимодейств/i.test(head)) field = 'interaction';
                    else if (s.lines.join(' ').length > 150) field = 'bio';
                }
                return { field: field || '', lines: s.lines };
            })];
        }

        // 4) разделы по подписям: «✧ Возраст: …», «✧ Биография:», «✧ Интересные факты:»
        //    (значок раздела может совпадать с маркером списка, поэтому ищем по самим подписям)
        const isHead = (l) => {
            const t = stripDecor(l);
            return !!labelOf(t) && (/^[^:]{0,60}:/.test(t) || t.split(/\s+/).length <= 4);
        };
        if (lines.filter(isHead).length >= 4) {
            const sections = [];
            lines.forEach(l => {
                if (isHead(l)) sections.push({ field: labelOf(l), lines: [l] });
                else if (sections.length) sections[sections.length - 1].lines.push(l);
            });
            return [sections];
        }

        // 5) без явной разметки — весь текст как биография
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
        // рост: «рост: 187», «187 см», а если единиц нет — отдельное число от 100 до 249 (не килограммы)
        const height = (t.match(/рост\s*:?\s*(\d{2,3}(?:\s*\/\s*\d{2,3})?)/i) || t.match(/(\d{2,3}(?:\s*\/\s*\d{2,3})?)\s*см/i)
            || t.match(/(?:^|[^\d\/])((?:1\d\d|2[0-4]\d)(?:\s*\/\s*(?:1\d\d|2[0-4]\d))?)(?!\s*кг)(?=[^\d]|$)/i) || [])[1];
        const weight = (t.match(/вес\s*:?\s*(\d{2,3}(?:\s*\/\s*\d{2,3})?)/i) || t.match(/(\d{2,3}(?:\s*\/\s*\d{2,3})?)\s*кг/i) || [])[1];
        // «порода: …» / «вид: …» — только как подпись в начале строки (не «на вид грубый»)
        let species = (t.match(/(?:^|\n)[^\p{L}\n]*(?:порода|вид)(?:\s+гибрида)?\s*[:–—-]?[^\S\n]*(?:\n[^\p{L}\n]*)?([^\n;]+)/iu) || [])[1]
            // «Гибрид вида: каринтийская коровка»
            || (t.match(/(?:порода|вида?)\s*:\s*([^\n;]+)/i) || [])[1];
        // параметры списком («› 170 / › 60 кг / › лисица») — вид: строка без цифр
        const plines = t.split('\n').map(l => l.replace(BULLET, '').trim()).filter(Boolean);
        const noDigits = plines.filter(l => !/\d/.test(l) && !/^(рост|вес)/i.test(l));
        if (!species && plines.length > 1 && noDigits.length) species = noDigits[noDigits.length - 1];
        if (!species) {
            // «188 см, 97 кг, непородистый котик.» — то, что осталось после цифр
            species = t.replace(/рост|вес/gi, '')
                .replace(/\d{1,3}\s*(?:года|год|лет)(?![а-я])/gi, '')
                .replace(/\d{2,3}(?:\s*\/\s*\d{2,3})?\s*(см|кг)/gi, '')
                .replace(/[◦•|·]/g, ' ')
                .replace(/^[\s,./:;\-–—>]+|[\s,./:;\-–—>]+$/g, '')
                .split('\n')[0]
                .replace(/^[\s,./:;\-–—>]+/, '')
                .trim();
        }
        return {
            height: height ? `${pick(height, idx)} см` : '',
            weight: weight ? `${pick(weight, idx)} кг` : '',
            // длинный «вид» — значит, разбор ошибся и захватил текст
            species: cleanSpecies(species),
        };
    }

    // «/вид – лис» → «лис»; длинный текст или «1 курс» — значит, разбор ошибся
    function cleanSpecies(v) {
        const t = String(v || '')
            .replace(/^[^\p{L}]*(?:вид|порода)\s*[:–—-]?\s*/iu, '')
            .replace(/^(?:[/\s]*(?:вид|порода))?\s*гибрида\s*[:–—-]\s*/iu, '')
            // подпись «гибрид/порода - …» (а «гибрид-кот» — это сам вид, его не трогаем)
            .replace(/^[^\p{L}]*(?:гибрид|вид|порода)(?:\s*\/\s*(?:гибрид|вид|порода))*(?:\s*:\s*|\s+[–—-]\s+)/iu, '')
            .replace(/[.;\s]+$/, '')
            .replace(/^[^\p{L}]+/u, '')            // значок перед видом: «🌸 золотистый ретривер»
            .trim();
        return t && t.length <= 60 && !/(^|\s)курс/i.test(t) ? t : '';
    }

    function parseFacts(text) {
        if (!text) return [];
        const items = [];
        // пункт начинается со значка: обычного маркера или любого не-буквенного символа
        // (эмодзи «🥀», «🌕», «💖» и т. п.)
        // (тайская «๑» формально цифра, но тут это украшение: «๑✿ …»)
        const LEAD = /^[^\p{L}0-9«"(]+/u;
        text.split('\n').forEach(l => {
            const raw = l.trim();
            if (!raw) return;
            const t = raw.replace(LEAD, '').trim();
            if (!t) return;
            const isItem = LEAD.test(raw) || !items.length;
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

        // параметры без своей подписи могут идти строками под возрастом («🐀19 лет / 158см/45кг / крыса»)
        const ageLines = String(block.age || '').split('\n');
        const paramsText = block.params || ageLines.slice(1).join('\n')
            || (/\d\s*(см|кг)/i.test(ageLines[0]) ? ageLines[0] : '');
        const params = parseParams(personPart(paramsText, me, other), idx);
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
            interaction: stripDecor(clean(block.raw.interaction))
                // подпись целиком до двоеточия: «Степень взаимодействия других персонажей с вашим:»
                .replace(/^(допустимые\s+взаимодействия|степень\s+взаимодействия)(\s+других\s+персонажей)?(\s+с\s+(вашим|персонажем))?\s*[:~—–-]?\s*/i, '')
                .split('\n').map(x => x.replace(BULLET, '').replace(/^[–—\-\s]+/, '').trim()).filter(Boolean)[0] || '',
            shared,
        };
    }

    if (typeof window !== 'undefined' && window.RCU) window.RCU.parseAnketa = parseAnketa;
    if (typeof module !== 'undefined') module.exports = { parseAnketa };
})();
