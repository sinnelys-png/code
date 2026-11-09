// Данные публичного сайта: персонажи и факультеты.
// Источники (все приходят одним ответом Apps Script, см. apps-script/Code.gs):
//   rows        — лист «Дедлайн»: аватар, тема, отвечающий, роль, дуэт;
//   tech        — Техтаблица: H альбом, I рост, J факультет, L курс, M доп. предметы,
//                 N дом и O комната в общежитии, P можно ли соседа;
//   faculties   — Техтаблица: имя → факультет;
//   facultyInfo — таблица факультетов: предметы, преподаватели, декан, нпс, студенты по курсам, факультативы.
// Анкет (возраст, рост, биография…) в таблицах пока нет — они в обсуждениях ВК.
(() => {
    const { loadGviz } = RCU;

    const isEmpty = (s) => !s || /^[—–-]*$/.test(String(s).trim());

    // Запасной вариант, пока скрипт не обновлён: таблица факультетов, если она открыта по ссылке
    const FACULTY_INFO_SHEET_ID = '1Rs16v2rZ_PwRoVF-gNBU0fW4sdw_r5eZ2JjcbEyJ17s';
    const FACULTY_INFO_GID = '1846439865';

    // Тот же разбор, что facultyInfo_() в Apps Script (на случай, если скрипт ещё старый)
    async function facultyInfoFromSheet() {
        const rows = await loadGviz(FACULTY_INFO_SHEET_ID, FACULTY_INFO_GID);
        const clean = (v) => String(v || '').trim();
        const real = (v) => (isEmpty(v) ? '' : clean(v));
        const list = [];
        let f = null, mode = '', course = 0, elective = null;
        for (const cell of rows) {
            const c = cell.text('C'), e = cell.text('E'), fCol = cell.text('F'), j = cell.text('J'), k = cell.text('K');
            if (/факультет|^персонал$/i.test(c) && !/^возможные|^доп\. предметы|деканом/i.test(c) && !f) {
                f = { title: c, subjects: '', roles: '', teachers: [], dean: '', npc: '', courses: [], electives: [] };
                mode = 'head'; course = 0; elective = null;
                continue;
            }
            if (!f) continue;
            if (c === '✦✦✦') { list.push(f); f = null; continue; }
            if (/^возможные предметы/i.test(c)) { f.subjects = c.replace(/^возможные предметы[^:]*:\s*/i, ''); continue; }
            if (/^преподаватели$/i.test(c)) { mode = 'teachers'; continue; }
            if (/ролей занято/i.test(c)) { f.roles = c; continue; }
            if (/^декан$/i.test(c)) { f.dean = real(e); mode = 'dean'; }
            else if (/^нпс$/i.test(c)) { f.npc = real(e); mode = 'npc'; }
            else if (/^доп\. предметы/i.test(c)) { mode = 'electives'; }
            else if (/^все имена/i.test(c)) { mode = 'end'; }
            else if (mode === 'teachers' && c) { if (real(e) || real(c)) f.teachers.push({ subject: real(c), name: real(e) }); }
            else if (mode === 'electives') {
                if (c) { elective = { subject: real(c), curator: '', students: [] }; f.electives.push(elective); }
                if (elective) {
                    if (clean(e).toLowerCase() === 'куратор') elective.curator = real(fCol);
                    else if (real(fCol)) elective.students.push(real(fCol));
                }
            }
            const m = clean(j).match(/(\d+)\s*курс/i);
            if (m) course = Number(m[1]);
            const st = real(k);
            if (st && course) {
                let g = f.courses.find(x => x.course === course);
                if (!g) f.courses.push(g = { course, students: [] });
                g.students.push(st);
            }
        }
        return list;
    }

    // Лист [бронь] Техтаблицы. Он «повёрнут»: в колонке B подписи строк (роль, факультет,
    // курс, предмет, должность, окончание брони…), а каждая следующая колонка — один персонаж.
    // Бронь начинается с колонки, где в первой строке «[бронь]»; дуэт — две колонки подряд.
    // Брони с прошедшей датей окончания не считаются.
    const BRON_SHEET_ID = '1SaM0adTpbqMs-fiN8Yub2FaeJfWTo4odAt2ScREUSg0';
    const BRON_GID = '2050639534';

    function parseBron(grid, now = new Date()) {
        const cell = (r, c) => String((grid[r] || [])[c] ?? '').trim();
        const width = Math.max(0, ...grid.map(r => r.length));
        // колонка с подписями — та, где есть «роль» и «факультет»
        let lc = -1;
        for (let c = 0; c < width && lc < 0; c++) {
            const col = grid.map((_, r) => cell(r, c).toLowerCase());
            if (col.includes('роль') && col.includes('факультет')) lc = c;
        }
        if (lc < 0) return [];
        const rowOf = (re) => grid.findIndex((_, r) => re.test(cell(r, lc).toLowerCase()));
        const R = {
            name: rowOf(/^имя$/), role: rowOf(/^роль/), faculty: rowOf(/^факультет/), course: rowOf(/^курс/),
            subject: rowOf(/^предмет/), post: rowOf(/^должност/), until: rowOf(/^окончание/),
        };
        const get = (key, c) => (R[key] >= 0 ? cell(R[key], c) : '');
        const toDate = (t) => {
            const m = String(t).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
            return m ? new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
        };

        const out = [];
        let until = null, inGroup = false;
        for (let c = lc + 1; c < width; c++) {
            if (/\[бронь\]/i.test(cell(0, c))) { inGroup = true; until = toDate(get('until', c)); }
            const role = get('role', c), faculty = get('faculty', c);
            if (!role && !faculty) { inGroup = false; continue; }    // пустая колонка между бронями
            if (!inGroup || (until && until < now)) continue;
            out.push({
                name: get('name', c), role, faculty,
                course: get('course', c), subject: get('subject', c), post: get('post', c),
                until: until ? until.toISOString() : '',
            });
        }
        return out;
    }

    async function bronFromSheet() {
        const url = `https://docs.google.com/spreadsheets/d/${BRON_SHEET_ID}/gviz/tq?tqx=out:json&gid=${BRON_GID}&headers=0`;
        const text = await (await fetch(url)).text();
        const data = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
        if (data.status !== 'ok') throw new Error('Лист [бронь] недоступен');
        return data.table.rows.map(row => (row.c || []).map(c => (c ? String(c.f ?? c.v ?? '') : '')));
    }

    async function load() {
        let data = {};
        try { data = await RCU.bundle(); } catch (e) { console.warn('Скрипт недоступен:', e); }

        let facultyInfo = Array.isArray(data.facultyInfo) ? data.facultyInfo : null;
        if (!facultyInfo) {
            try { facultyInfo = await RCU.cached('faculty-info', facultyInfoFromSheet); }
            catch (e) { facultyInfo = []; console.warn('Таблица факультетов недоступна:', e); }
        }
        // пустые блоки (например, «Персонал» без данных) и пустые факультативы не показываем
        facultyInfo = facultyInfo.map(f => ({
            ...f,
            electives: (f.electives || []).filter(x => x.subject || x.curator || x.students.length),
        }));

        // брони: из скрипта, а если скрипт ещё старый — прямо из открытого листа
        let bronRaw = Array.isArray(data.bron) ? data.bron : null;
        if (!bronRaw) {
            try { bronRaw = parseBron(await RCU.cached('bron-sheet', bronFromSheet)); }
            catch (e) { bronRaw = []; console.warn('Лист [бронь] недоступен:', e); }
        }

        const deadlines = data.rows || [];
        const tech = data.tech || [];
        const facultyOf = data.faculties || {};

        // курс и должности — из таблицы факультетов
        const courseOf = {}, postsOf = {};
        const addPost = (name, text) => { if (name) (postsOf[name] = postsOf[name] || []).push(text); };
        facultyInfo.forEach(f => {
            (f.courses || []).forEach(g => g.students.forEach(n => { courseOf[n] = g.course; }));
            (f.teachers || []).forEach(t => addPost(t.name, t.subject ? `преподаватель: ${t.subject.toLowerCase()}` : 'преподаватель'));
            addPost(f.dean, `декан: ${f.title.toLowerCase()}`);
            (f.electives || []).forEach(x => addPost(x.curator, `куратор факультатива: ${(x.subject || '').toLowerCase()}`));
        });

        // все персонажи: Техтаблица + лист дедлайнов, сведённые по имени
        const byName = new Map();
        const get = (name) => {
            if (!byName.has(name)) byName.set(name, { name });
            return byName.get(name);
        };
        tech.forEach(t => {
            const c = get(t.name);
            Object.assign(c, {
                role: t.role || c.role,
                faculty: t.faculty || c.faculty,
                house: isEmpty(t.house) ? '' : t.house,
                room: isEmpty(t.room) ? '' : t.room,
                albumUrl: t.albumUrl || c.albumUrl,
                topicUrl: t.topicUrl || c.topicUrl,
                playerUrl: t.playerUrl || c.playerUrl,
                duet: isEmpty(t.duet) ? c.duet : t.duet,
                extra: isEmpty(t.extra) ? '' : t.extra,
                neighbor: isEmpty(t.neighbor) ? '' : t.neighbor,
                height: isEmpty(t.i) ? '' : t.i,                 // I — рост
                colL: isEmpty(t.l) ? '' : t.l,                   // L — курс / предмет / должность
            });
        });
        // Список персонажей — по Техтаблице; лист дедлайнов только дополняет (аватар, отвечающий).
        // Если Техтаблица недоступна, берём список из дедлайнов.
        deadlines.forEach(r => {
            if (tech.length && !byName.has(r.name)) return;
            const c = get(r.name);
            c.avatar = r.avatar || c.avatar;
            c.topicUrl = c.topicUrl || r.topicUrl;
            c.playerUrl = c.playerUrl || r.playerUrl;
            c.player = r.player || c.player;
            c.role = c.role || r.role;
            c.duet = c.duet || (isEmpty(r.duet) ? '' : r.duet);
            c.faculty = c.faculty || facultyOf[r.name] || r.faculty || '';
        });
        byName.forEach(c => {
            c.role = (c.role || '').toLowerCase();
            // колонка L: у студентов — курс (иначе — из таблицы факультетов),
            // у преподавателей — предмет, у персонала — должность
            c.course = c.role === 'студент' ? (c.colL || courseOf[c.name] || '') : '';
            c.subject = c.role === 'преподаватель' ? (c.colL || '') : '';
            c.post = c.role === 'персонал' ? (c.colL || '') : '';
            c.posts = postsOf[c.name] || [];
            c.role = (c.role || '').toLowerCase();
        });

        const characters = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        // брони из листа [бронь] Техтаблицы: роль приводим к «студент / преподаватель / персонал»
        const roleOf = (x) => {
            const r = String(x.role || '').toLowerCase();
            if (/студ/.test(r)) return 'студент';
            if (/преп/.test(r)) return 'преподаватель';
            if (/персон|сотруд|должн/.test(r)) return 'персонал';
            if (x.post) return 'персонал';
            if (x.subject) return 'преподаватель';
            return x.course || x.faculty ? 'студент' : '';
        };
        const bron = bronRaw
            .map(x => ({ ...x, role: roleOf(x), course: String(x.course || '').replace(/\D+/g, '') }))
            .filter(x => x.role && !byName.has(x.name));

        return { characters, byName, facultyInfo, bron, hasTech: tech.length > 0 };
    }

    // Один раз на сессию; страницы публичного сайта берут данные отсюда
    let promise = null;
    RCU.publicData = () => (promise = promise || load().catch(err => { promise = null; throw err; }));

    RCU.isEmptyValue = isEmpty;
})();
