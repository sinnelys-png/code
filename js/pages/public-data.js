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
        return { characters, byName, facultyInfo, hasTech: tech.length > 0 };
    }

    // Один раз на сессию; страницы публичного сайта берут данные отсюда
    let promise = null;
    RCU.publicData = () => (promise = promise || load().catch(err => { promise = null; throw err; }));
    window.addEventListener('rcu:updated', () => { promise = null; });

    RCU.isEmptyValue = isEmpty;
})();
