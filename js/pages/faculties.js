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

    const studentsCount = (f) => (f.courses || []).reduce((n, g) => n + g.students.length, 0);

    function smallCard(f, i) {
        const n = studentsCount(f);
        return `
            <button class="fc-card" type="button" data-index="${i}"${facStyle(f.title)}>
                <span class="fc-tie" aria-hidden="true"></span>
                <span class="fc-card-info">
                    <span class="fc-card-title">${esc(shortTitle(f.title))}</span>
                    <span class="fc-card-meta">
                        ${n} ${RCU.plural(n, 'студент', 'студента', 'студентов')}
                        · преподаватели ${esc((f.roles || '').replace(/\s*ролей занято/i, '') || '—')}
                    </span>
                </span>
            </button>`;
    }

    function bigCard(f) {
        const teachers = (f.teachers || []).filter(t => t.name || t.subject);
        const courses = (f.courses || []).slice().sort((a, b) => a.course - b.course);
        const electives = f.electives || [];

        return `
            <article class="pc-big fc-big"${facStyle(f.title)}>
                <button class="pc-close" type="button" data-close aria-label="Закрыть">×</button>
                <span class="pc-bookmark" aria-hidden="true"></span>

                <div class="fc-head">
                    <div class="pc-k">факультет</div>
                    <h2 class="pc-big-name">${esc(shortTitle(f.title))}</h2>
                    ${f.subjects ? `<p class="fc-subjects"><span class="pc-k">возможные предметы:</span> ${esc(f.subjects)}</p>` : ''}
                </div>

                <section class="fc-block">
                    <h3 class="pc-section-title">преподаватели <span class="dl-group-count">${esc((f.roles || '').replace(/\s*ролей занято/i, '') || '0/4')}</span></h3>
                    ${teachers.length
                        ? `<ul class="fc-list">${teachers.map(t => `<li><span class="pc-k">${esc((t.subject || '—').toLowerCase())}</span> ${person(t.name)}</li>`).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого — места свободны.</p>'}
                    <ul class="fc-list">
                        <li><span class="pc-k">декан</span> ${person(f.dean)}</li>
                        <li><span class="pc-k">нпс</span> ${person(f.npc)}</li>
                    </ul>
                </section>

                <section class="fc-block">
                    <h3 class="pc-section-title">студенты <span class="dl-group-count">${studentsCount(f)}</span></h3>
                    ${courses.length
                        ? `<ul class="fc-list">${courses.map(g => `<li><span class="pc-k">${g.course ? `${g.course} курс` : 'курс не указан'}</span> ${g.students.map(person).join(', ')}</li>`).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого.</p>'}
                </section>

                ${electives.length ? `
                    <section class="fc-block">
                        <h3 class="pc-section-title">факультативы</h3>
                        <ul class="fc-list">
                            ${electives.map(x => `
                                <li>
                                    <span class="pc-k">${esc((x.subject || '—').toLowerCase())}</span>
                                    куратор: ${person(x.curator)}${x.students.length ? `; студенты: ${x.students.map(person).join(', ')}` : ''}
                                </li>`).join('')}
                        </ul>
                    </section>` : ''}
            </article>`;
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

        // все факультеты: из Техтаблицы и из таблицы факультетов, в порядке таблицы факультетов
        const titles = d.facultyInfo.map(f => f.title).filter(t => key(t) !== 'персонал');
        d.characters.forEach(c => {
            if (c.faculty && !titles.some(t => key(t) === key(c.faculty))) titles.push(c.faculty);
        });

        return titles.map(title => {
            const info = infoByKey.get(key(title)) || {};
            const members = d.characters.filter(c => key(c.faculty) === key(title));

            const subjectOf = new Map((info.teachers || []).filter(t => inTech(t.name)).map(t => [t.name, t.subject]));
            const teachers = members.filter(c => c.role === 'преподаватель')
                .map(c => ({ subject: c.subject || subjectOf.get(c.name) || '', name: c.name }));

            const courses = [];
            members.filter(c => c.role === 'студент').forEach(c => {
                const n = Number(c.course) || 0;
                let g = courses.find(x => x.course === n);
                if (!g) courses.push(g = { course: n, students: [] });
                g.students.push(c.name);
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
                roles: `${teachers.length}/4`,
                teachers,
                dean: inTech(info.dean) ? info.dean : '',
                npc: inTech(info.npc) ? info.npc : '',
                courses,
                electives,
            };
        });
    }

    function openFaculty(i) {
        if (!modal || !data) return;
        const f = faculties[i];
        if (!f) return;
        modalBody.innerHTML = bigCard(f);
        modal.hidden = false;
        document.documentElement.classList.add('pc-open');
        requestAnimationFrame(() => modal.classList.add('is-shown'));
        modalBody.querySelector('.pc-close').focus({ preventScroll: true });
    }

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.fc-card[data-index]');
        if (card) openFaculty(Number(card.dataset.index));
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
                .filter(({ f }) => studentsCount(f) || f.teachers.length || f.dean);
            root.innerHTML = list.length
                ? `<div class="fc-grid">${list.map(({ f, i }) => smallCard(f, i)).join('')}</div>`
                : '<p class="dl-status">Не удалось загрузить таблицу факультетов.</p>';
        },
    };
})();
