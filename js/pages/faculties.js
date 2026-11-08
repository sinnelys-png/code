// Публичный сайт, страница «Факультеты»: карточки факультетов по таблице факультетов.
// Маленькая карточка по клику открывает большую: предметы, преподаватели, декан, нпс,
// студенты по курсам и факультативы. Имена персонажей открывают их карточки.
(() => {
    const { esc } = RCU;

    let data = null;

    const facStyle = (title) => {
        const m = RCU.facultyAttrs(title).attrs.match(/style="([^"]*)"/);
        return m ? ` style="${m[1]}"` : '';
    };

    const shortTitle = (t) => String(t || '').replace(/^факультет\s+/i, '').replace(/\s+факультет$/i, '').toLowerCase();

    // имя персонажа: ссылка на его карточку, если он есть в данных
    const person = (name) => !name
        ? '<span class="pc-none">—</span>'
        : (data.byName.has(name)
            ? `<button class="pc-link" type="button" data-name="${esc(name)}">${esc(name)}</button>`
            : esc(name));

    // места на факультете: брони из листа [бронь] Техтаблицы тоже занимают место
    const TEACHER_SEATS = 4;
    const STUDENT_SEATS = 15;

    const studentsCount = (f) => (f.courses || []).reduce((n, g) => n + g.students.length, 0);
    const teachersText = (f) => `${f.teachers.length}/${TEACHER_SEATS}`;
    const studentsText = (f) => `${studentsCount(f)}/${STUDENT_SEATS}`;

    // участник списка: { name, booked } — бронь помечается
    const member = (m) => m.booked
        ? (m.name ? `${person(m.name)} <span class="fc-bron">бронь</span>` : '<span class="fc-bron">место занято</span>')
        : person(m.name);

    // предметы, которые уже кто-то ведёт (без броней)
    const taughtSubjects = (f) => [...new Set(f.teachers.filter(t => !t.booked && t.subject).map(t => t.subject.toLowerCase()))];

    // строка курса; брони без имени и курса — одной строкой «забронировано: 2 места»
    function courseLine(g) {
        const anon = g.students.filter(m => m.booked && !m.name);
        const named = g.students.filter(m => !(m.booked && !m.name));
        const label = g.course ? `${g.course} курс` : (named.length ? 'курс не указан' : 'бронь');
        const parts = named.map(member);
        if (anon.length) parts.push(`<span class="fc-bron">${anon.length} ${RCU.plural(anon.length, 'место', 'места', 'мест')} в броне</span>`);
        return `<li><span class="pc-k">${label}</span> ${parts.join(', ')}</li>`;
    }

    function smallCard(f, i) {
        const subjects = taughtSubjects(f);
        const meta = f.staff
            ? `${f.teachers.length} ${RCU.plural(f.teachers.length, 'человек', 'человека', 'человек')}`
            : `студенты ${studentsText(f)} · преподаватели ${teachersText(f)}`;
        return `
            <button class="fc-card${f.staff ? ' fc-card--staff' : ''}" type="button" data-index="${i}"${facStyle(f.title)}>
                <span class="fc-tie" aria-hidden="true"></span>
                <span class="fc-card-info">
                    <span class="fc-card-title">${esc(shortTitle(f.title))}</span>
                    ${subjects.length ? `<span class="fc-card-subjects">${esc(subjects.join(', '))}</span>` : ''}
                    <span class="fc-card-meta">${meta}</span>
                </span>
            </button>`;
    }

    // блоки как у анкеты: шапка с лентой, разделы, низ со звёздочкой
    const ticket = (f, head, sections) => `
            <article class="pc-big pc-ticket fc-big"${facStyle(f.title)}>
                <div class="pc-top">
                    ${RCU.ribbonHTML || ''}
                    <div class="pc-seg pc-seg--head fc-head-seg">
                        <button class="pc-close" type="button" data-close aria-label="Закрыть">×</button>
                        <div class="fc-head">${head}</div>
                    </div>
                </div>
                ${sections}
                <div class="pc-seam-star"><span class="pc-seam-dot">✦</span></div>
                <div class="pc-seg pc-seg--foot"></div>
            </article>`;

    function staffCard(f) {
        return ticket(f, `
                    <div class="pc-k">университет</div>
                    <h2 class="pc-big-name">персонал</h2>`, `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">должности <span class="dl-group-count">${f.teachers.length}</span></h3>
                    ${f.teachers.length
                        ? `<ul class="fc-list">${f.teachers.map(t => `<li><span class="pc-k">${esc((t.subject || (t.booked ? 'бронь' : '—')).toLowerCase())}</span> ${member(t)}</li>`).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого.</p>'}
                </section>`);
    }

    function bigCard(f) {
        if (f.staff) return staffCard(f);
        const teachers = (f.teachers || []).filter(t => t.name || t.subject || t.booked);
        const courses = (f.courses || []).slice().sort((a, b) => (a.course || 99) - (b.course || 99));
        const electives = f.electives || [];

        return ticket(f, `
                    <div class="pc-k">факультет</div>
                    <h2 class="pc-big-name">${esc(shortTitle(f.title))}</h2>
                    ${f.dean ? `<p class="fc-dean"><span class="pc-k">декан</span> ${person(f.dean)}</p>` : ''}
                    ${f.subjects ? `<p class="fc-subjects"><span class="pc-k">возможные предметы:</span> ${esc(f.subjects)}</p>` : ''}`, `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">преподаватели <span class="dl-group-count">${teachersText(f)}</span></h3>
                    ${teachers.length
                        ? `<ul class="fc-list">${teachers.map(t => `<li><span class="pc-k">${esc((t.subject || (t.booked ? 'бронь' : '—')).toLowerCase())}</span> ${member(t)}</li>`).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого — места свободны.</p>'}
                    <ul class="fc-list fc-list--npc">
                        <li><span class="pc-k">нпс</span> ${person(f.npc)}</li>
                    </ul>
                </section>

                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">студенты <span class="dl-group-count">${studentsText(f)}</span></h3>
                    ${courses.length
                        ? `<ul class="fc-list">${courses.map(courseLine).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого.</p>'}
                </section>

                ${electives.length ? `
                    <section class="pc-seg pc-text fc-block">
                        <h3 class="pc-section-title">факультативы</h3>
                        <ul class="fc-list">
                            ${electives.map(x => `
                                <li>
                                    <span class="pc-k">${esc((x.subject || '—').toLowerCase())}</span>
                                    куратор: ${person(x.curator)}${x.students.length ? `; студенты: ${x.students.map(person).join(', ')}` : ''}
                                </li>`).join('')}
                        </ul>
                    </section>` : ''}`);
    }

    // большая карточка факультета — в том же окне, что и карточка персонажа
    const modal = document.querySelector('.pc-modal');
    const modalBody = modal && modal.querySelector('.pc-modal-body');

    let faculties = [];

    // «Факультет рекламы и маркетинга» / «рекламы и маркетинга факультет» → «рекламы и маркетинга»
    const key = (t) => String(t || '').toLowerCase().replace(/факультет/g, '').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

    /**
     * Состав факультетов — по Техтаблице (колонка J — факультет, L — курс, роль).
     * Из таблицы факультетов берём только описание (предметы) и должности: предмет
     * преподавателя, декана, нпс, факультативы — и только для персонажей, которые есть
     * в Техтаблице (ушедшие из таблицы факультетов не показываются).
     */
    function buildFaculties(d) {
        const inTech = (n) => !!n && d.byName.has(n);
        const infoByKey = new Map(d.facultyInfo.map(f => [key(f.title), f]));
        const bron = d.bron || [];
        // в броне факультет может быть записан коротко: «хим-био», «журфак», «художественный»
        const sameFaculty = (a, b) => {
            const x = key(a), y = key(b);
            if (!x) return false;
            if (x === y || y.includes(x) || x.includes(y)) return true;
            const head = x.split(/[\s-]/)[0].slice(0, 5);
            return head.length >= 3 && y.split(/[\s-]/).some(w => w.startsWith(head));
        };

        // все факультеты: из Техтаблицы и из таблицы факультетов, в порядке таблицы факультетов
        const titles = d.facultyInfo.map(f => f.title).filter(t => key(t) !== 'персонал');
        d.characters.forEach(c => {
            if (c.faculty && !titles.some(t => key(t) === key(c.faculty))) titles.push(c.faculty);
        });

        return titles.map(title => {
            const info = infoByKey.get(key(title)) || {};
            const members = d.characters.filter(c => key(c.faculty) === key(title));
            const booked = bron.filter(x => sameFaculty(x.faculty, title));

            const subjectOf = new Map((info.teachers || []).filter(t => inTech(t.name)).map(t => [t.name, t.subject]));
            const teachers = members.filter(c => c.role === 'преподаватель')
                .map(c => ({ subject: c.subject || subjectOf.get(c.name) || '', name: c.name }))
                .concat(booked.filter(x => x.role === 'преподаватель').map(x => ({ subject: x.subject, name: x.name, booked: true })));

            const courses = [];
            members.filter(c => c.role === 'студент').forEach(c => {
                const n = Number(c.course) || 0;
                let g = courses.find(x => x.course === n);
                if (!g) courses.push(g = { course: n, students: [] });
                g.students.push({ name: c.name });
            });
            booked.filter(x => x.role === 'студент').forEach(x => {
                const n = Number(x.course) || 0;
                let g = courses.find(y => y.course === n);
                if (!g) courses.push(g = { course: n, students: [] });
                g.students.push({ name: x.name, booked: true });
            });
            courses.sort((a, b) => (a.course || 99) - (b.course || 99));

            const electives = (info.electives || []).map(x => ({
                subject: x.subject,
                curator: inTech(x.curator) ? x.curator : '',
                students: x.students.filter(inTech),
            })).filter(x => x.subject && (x.curator || x.students.length));

            return {
                title,
                subjects: info.subjects || '',
                teachers,
                dean: inTech(info.dean) ? info.dean : '',
                npc: inTech(info.npc) ? info.npc : '',
                courses,
                electives,
            };
        }).concat([{
            // персонал — отдельная карточка: должности из Техтаблицы (колонка L) и брони
            title: 'Персонал',
            staff: true,
            teachers: d.characters.filter(c => c.role === 'персонал')
                .map(c => ({ subject: c.post || '', name: c.name }))
                .concat(bron.filter(x => x.role === 'персонал').map(x => ({ subject: x.post || x.subject, name: x.name, booked: true }))),
            courses: [],
        }]);
    }

    let shown = [];   // факультеты в том порядке, в каком они на странице (для стрелок)

    // dir: 0 — открытие, ±1 — листание стрелками (старая карточка уезжает вбок)
    function openFaculty(i, srcEl, dir = 0) {
        if (!modal || !data) return;
        const f = faculties[i];
        if (!f) return;
        const wasHidden = modal.hidden || !modal.classList.contains('is-shown');
        const render = () => { modalBody.innerHTML = bigCard(f); };
        if (dir && !wasHidden && RCU.swapCard) RCU.swapCard(dir, render);
        else render();
        delete modalBody.dataset.name;
        modalBody.dataset.fac = String(i);
        const pos = shown.indexOf(i);
        if (RCU.setPager) RCU.setPager(pos > 0, pos >= 0 && pos < shown.length - 1);
        modal.hidden = false;
        document.documentElement.classList.add('pc-open');
        // та же анимация открытия, что у анкеты: из маленькой карточки факультета
        if (!dir && wasHidden && RCU.unfoldCard) RCU.unfoldCard('', srcEl || document.querySelector(`.fc-card[data-index="${i}"]`));
        requestAnimationFrame(() => modal.classList.add('is-shown'));
        modalBody.querySelector('.pc-close').focus({ preventScroll: true });
    }

    RCU.pageFaculty = (dir) => {
        const pos = shown.indexOf(Number(modalBody.dataset.fac));
        const next = shown[pos + dir];
        if (pos >= 0 && next != null) openFaculty(next, null, dir);
    };

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.fc-card[data-index]');
        if (card) openFaculty(Number(card.dataset.index), card);
    });

    RCU.pages.faculties = {
        title: 'Факультеты',
        load: () => RCU.publicData(),
        render(root, d) {
            data = d;
            RCU.setPublicData(d);
            faculties = buildFaculties(d);
            const list = faculties
                .map((f, i) => ({ f, i }))
                .filter(({ f }) => f.staff ? f.teachers.length : (studentsCount(f) || f.teachers.length || f.dean));
            shown = list.map(x => x.i);
            root.innerHTML = list.length
                ? `<div class="fc-grid">${list.map(({ f, i }) => smallCard(f, i)).join('')}</div>`
                : '<p class="dl-status">Не удалось загрузить таблицу факультетов.</p>';
            // адрес вида #faculties/Музыкальный_факультет — открыть карточку факультета
            const wanted = key(String(RCU.routeParam || '').replace(/_/g, ' '));
            const i = wanted ? faculties.findIndex(f => key(f.title) === wanted) : -1;
            if (i >= 0) setTimeout(() => openFaculty(i), 300);
        },
    };
})();
