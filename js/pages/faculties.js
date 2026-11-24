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

    // маленькая аватарка слева от имени (нет картинки — первая буква)
    const miniAva = (c) => RCU.safeUrl(c.avatar)
        ? `<img class="fc-ava" src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="fc-ava fc-ava--empty" aria-hidden="true">${esc(c.name.charAt(0))}</span>`;

    // имя персонажа: ссылка на его карточку, если он есть в данных
    const person = (name) => !name
        ? '<span class="pc-none">—</span>'
        : (data.byName.has(name)
            ? `<button class="pc-link fc-person pc-open-char" type="button" data-name="${esc(name)}">${miniAva(data.byName.get(name))}<span class="fc-person-name">${esc(name)}</span></button>`
            : esc(name));

    // места на факультете: брони из листа [бронь] Техтаблицы тоже занимают место
    const TEACHER_SEATS = 4;
    const STUDENT_SEATS = 15;

    const studentsCount = (f) => (f.courses || []).reduce((n, g) => n + g.students.length, 0);
    const teachersText = (f) => `${f.teachers.length}/${TEACHER_SEATS}`;
    const studentsText = (f) => `${studentsCount(f)}/${STUDENT_SEATS}`;

    // участник списка: { name, booked } — бронь помечается
    const member = (m) => m.booked
        ? (m.name ? `${person(m.name)} <span class="fc-bron">забронировано</span>` : '<span class="fc-bron">место занято</span>')
        : person(m.name);

    // правый столбец списка: каждое имя — с новой строки
    const names = (parts) => `<span class="fc-names">${parts.map(p => `<span class="fc-name">${p}</span>`).join('')}</span>`;

    // строка курса; брони без имени и курса — одной строкой «забронировано: 2 места»
    function courseLine(g) {
        const anon = g.students.filter(m => m.booked && !m.name);
        const named = g.students.filter(m => !(m.booked && !m.name));
        const label = g.course ? `${g.course} курс` : (named.length ? 'курс не указан' : 'забронировано');
        const parts = named.map(member);
        if (anon.length) parts.push(`<span class="fc-bron">${anon.length} ${RCU.plural(anon.length, 'место', 'места', 'мест')}</span>`);
        return `<li><span class="pc-k">${label}</span>${names(parts)}</li>`;
    }

    // Маленькая карточка — бейдж на ленте: основа у всех одна, лента и рисунок — основного
    // цвета факультета; внутренняя рамка с завитками по углам, полоса с названием,
    // ✦ между линиями, предметы, места и герб внизу, заходящий на рамку.
    // наклон крупного бейджа: у каждого факультета свой, в одну или другую сторону, 2–6°
    const TILTS = [-5, 3, -3, 5.5, -6, 2.5, -4, 4.5, -2.5, 5, -5.5, 3.5, -3.5, 4];

    // Крупный бейдж — как на референсе: широкая полоса с названием пониже,
    // под ней ✦ между линиями и «факультет», внизу герб, заходящий на рамку.
    function smallCard(f, i, pos = 0) {
        const title = f.staff ? 'персонал' : shortTitle(f.title);
        return `
            <div class="fc-card${f.staff ? ' fc-card--staff' : ''}" data-index="${i}" role="img"
                aria-label="${esc(f.staff ? 'Персонал' : f.title)}"${facStyle(f.title).replace('style="', `style="--tilt:${TILTS[pos % TILTS.length]}deg;`)}>
                <span class="fc-tilt">
                    <span class="fc-body">
                    <span class="fc-strap" aria-hidden="true"></span>
                    <span class="fc-edge" aria-hidden="true">${'<span></span>'.repeat(EDGE_LAYERS)}</span>
                    <span class="fc-badge">
                        <span class="fc-shine" aria-hidden="true"></span>
                        <span class="fc-slot" aria-hidden="true"></span>
                        <span class="fc-frame" aria-hidden="true"><span class="fc-wing"></span><span class="fc-wing fc-wing--r"></span></span>
                        <span class="fc-band"><span class="fc-card-title${title.length > 28 ? ' fc-card-title--xlong' : title.length > 14 ? ' fc-card-title--long' : ''}">${esc(title)}</span></span>
                        <span class="fc-divider" aria-hidden="true"><span></span>✦<span></span></span>
                        <span class="fc-kicker">${f.staff ? 'университет' : 'факультет'}</span>
                        <span class="fc-crest" aria-hidden="true"><span></span></span>
                    </span>
                    </span>
                </span>
            </div>`;
    }

    /* ---------- Объём: бейдж поворачивается за мышкой ----------
       Чем дальше указатель от середины бейджа, тем сильнее наклон (не больше TILT_3D),
       блик сдвигается следом. Толщина — слои под бейджем (.fc-edge), сколько — --thick в css. */
    const EDGE_LAYERS = 8;
    const TILT_3D = 16;
    const TILT_ON = false;      // поворот за мышкой пока выключен
    let tiltFrame = 0, tiltEvent = null;
    function follow() {
        tiltFrame = 0;
        const card = document.querySelector('.fc-badge-slot .fc-card:not(.is-leaving)');
        if (!card) return;
        const tilt = card.querySelector('.fc-tilt');
        if (!tiltEvent) { tilt.style.removeProperty('--rx'); tilt.style.removeProperty('--ry'); return; }
        const r = card.querySelector('.fc-badge').getBoundingClientRect();
        const clamp = (v) => Math.max(-1, Math.min(1, v));
        // доля расстояния: у края бейджа — половина, в полутора бейджах от него — во всю силу
        const dx = clamp((tiltEvent.clientX - (r.left + r.width / 2)) / (r.width * 1.5));
        const dy = clamp((tiltEvent.clientY - (r.top + r.height / 2)) / (r.height * 1.2));
        tilt.style.setProperty('--ry', `${(dx * TILT_3D).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${(-dy * TILT_3D).toFixed(2)}deg`);
        tilt.style.setProperty('--gx', `${Math.round(50 + dx * 50)}%`);
        tilt.style.setProperty('--gy', `${Math.round(50 + dy * 50)}%`);
    }
    document.addEventListener('pointermove', (e) => {
        if (!TILT_ON || e.pointerType !== 'mouse' || !document.querySelector('.fc-badge-slot')) return;
        tiltEvent = e;
        if (!tiltFrame) tiltFrame = requestAnimationFrame(follow);
    }, { passive: true });
    // мышь ушла из окна — бейдж выпрямляется
    document.addEventListener('mouseleave', () => {
        tiltEvent = null;
        if (!tiltFrame) tiltFrame = requestAnimationFrame(follow);
    });

    // язычок факультета: основной цвет, внутренняя обводка (подсвечивается мышью, js/site.js)
    let tabId = 0;
    function tabSVG(cls) {
        const glow = `fc-glow-${++tabId}`;
        return `
                <svg class="${cls}" viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <radialGradient id="${glow}" class="pc-ribbon-glow" gradientUnits="userSpaceOnUse" cx="-999" cy="-999" r="90">
                            <stop offset="0%" class="pc-ribbon-glow-core" />
                            <stop offset="50%" class="pc-ribbon-glow-mid" />
                            <stop offset="100%" class="pc-ribbon-glow-edge" />
                        </radialGradient>
                    </defs>
                    <path class="fc-tab-body" d="M0 0 H100 V100 L50 130 L0 100 Z" />
                    <path class="fc-tab-line" d="M10 0 V95 L50 118 L90 95 V0" stroke="url(#${glow})" />
                    <!-- сюда встанет эмблема факультета -->
                </svg>`;
    }

    // блоки как у анкеты: шапка с язычком факультета, разделы, низ со звёздочкой
    // (класс pc-ribbon — чтобы язычок вставал на место ленты и выпадал так же при открытии)
    const ticket = (f, head, sections) => `
            <article class="pc-big pc-ticket fc-big"${facStyle(f.title)}>
                <div class="pc-top">
                    ${tabSVG('pc-ribbon fc-big-tab')}
                    <div class="pc-seg pc-seg--head fc-head-seg">
                        <button class="pc-close" type="button" data-close aria-label="Закрыть">×</button>
                        <div class="fc-head">${head}</div>
                    </div>
                </div>
                ${sections}
                <div class="pc-seam-star"><span class="pc-seam-dot">✦</span></div>
                <div class="pc-seg pc-seg--foot"></div>
            </article>`;

    /* ---------- Персонал: отделы, должности и сколько на них мест ----------
       Список должностей — здесь (его меняют руками); кто занимает должность — по Техтаблице
       (колонка L у персонала) и листу [бронь]. Должности из таблицы, которых нет в списке,
       выводятся отдельным блоком «другие должности». */
    const STAFF = [
        ['оказание первой помощи', [['мед. сотрудник', 4], ['главный врач', 1]]],
        // третье — как подписать на сайте (должность в таблице — первое)
        ['охранники', [['дневной охранник', 3, 'дневные'], ['ночной охранник', 3, 'ночные']]],
        ['уборка', [['уборщик', 5]]],
        ['столовая', [['повар', 4], ['буфетчик', 2]]],
        ['сад', [['садовник', 4]]],
        ['главное управление', [['проректор', 1], ['секретарь', 3]]],
        ['библиотека', [['библиотекарь', 3]]],
        ['помощь студентам', [['психолог', 1], ['соц. работник', 2]]],
        ['бригада', [['ремонтник', 3]]],
        ['вход в университет', [['гардеробщик', 6]]],
        ['IT-специалисты', [['программист', 3]]],
    ];
    // «Мед. сотрудник» = «медсотрудник» = «мед сотрудник»
    const postKey = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я]/g, '');

    // люди на должностях: { ключ должности → [участники] }; кто не попал в список — отдельно
    function staffSeats(f) {
        const known = new Set(STAFF.flatMap(([, posts]) => posts.map(([p]) => postKey(p))));
        const byPost = new Map();
        const other = [];
        f.teachers.forEach(t => {
            const k = postKey(t.subject);
            if (known.has(k)) { if (!byPost.has(k)) byPost.set(k, []); byPost.get(k).push(t); }
            else other.push(t);
        });
        return { byPost, other };
    }

    // строка должности: название | ряд ✦ по числу мест (занятые — ярко) | кто на ней (никого — прочерк)
    function postLine(post, seats, people) {
        // сначала занятые, за ними брони (полупрозрачные), остальное — свободно
        const taken = people.filter(x => !x.booked).length;
        return `
            <li class="fc-post">
                <span class="pc-k">${esc(post)}</span>
                <span class="fc-stars" role="img" aria-label="занято ${people.length} из ${seats}">${
                    Array.from({ length: seats }, (_, k) => `<span class="${k < taken ? 'is-busy' : k < people.length ? 'is-booked' : ''}">✦</span>`).join('')}</span>
                <span class="fc-post-people">${people.length ? people.map(member).join(', ') : '<span class="pc-none">—</span>'}</span>
            </li>`;
    }

    // разделы карточки персонала (они же — справа от бейджа на странице)
    function staffSections(f) {
        const { byPost, other } = staffSeats(f);
        return STAFF.map(([dept, posts]) => {
                const busy = posts.reduce((n, [p]) => n + (byPost.get(postKey(p)) || []).length, 0);
                const booked = posts.reduce((n, [p]) => n + (byPost.get(postKey(p)) || []).filter(x => x.booked).length, 0);
                const all = posts.reduce((n, [, k]) => n + k, 0);
                return `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">${esc(dept)} <span class="dl-group-count" data-booked="${booked}">${busy}/${all}</span></h3>
                    <ul class="fc-list">${posts.map(([p, k, label]) => postLine(label || p, k, byPost.get(postKey(p)) || [])).join('')}</ul>
                </section>`;
            }).join('') + (other.length ? `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">другие должности</h3>
                    <ul class="fc-list">${other.map(t => `<li><span class="pc-k">${esc((t.subject || (t.booked ? 'забронировано' : '—')).toLowerCase())}</span> ${member(t)}</li>`).join('')}</ul>
                </section>` : '');
    }

    function staffCard(f) {
        return ticket(f, `
                    <div class="pc-k">университет</div>
                    <h2 class="pc-big-name">персонал</h2>
                    <div class="fc-pic" aria-hidden="true"></div>`, staffSections(f));
    }

    // декан и возможные предметы (под названием в карточке; на странице декан — справа
    // от бейджа, предметы — под бейджем)
    const deanLine = (f) => (f.dean ? `<p class="fc-dean"><span class="pc-k">декан</span> ${person(f.dean)}</p>` : '');
    const subjectsLine = (f) => (f.subjects ? `<p class="fc-subjects"><span class="pc-k">возможные предметы:</span> ${esc(f.subjects)}</p>` : '');
    const facultyFacts = (f) => deanLine(f) + subjectsLine(f);

    // разделы карточки факультета: преподаватели, студенты, факультативы
    function facultySections(f) {
        const teachers = (f.teachers || []).filter(t => t.name || t.subject || t.booked);
        const courses = (f.courses || []).slice().sort((a, b) => (a.course || 99) - (b.course || 99));
        const electives = f.electives || [];
        return `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">преподаватели <span class="dl-group-count" data-booked="${(f.teachers || []).filter(x => x.booked).length}">${teachersText(f)}</span></h3>
                    ${teachers.length
                        ? `<ul class="fc-list">${teachers.map(t => `<li><span class="pc-k">${esc((t.subject || (t.booked ? 'забронировано' : '—')).toLowerCase())}</span>${names([member(t)])}</li>`).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого — места свободны.</p>'}
                    <ul class="fc-list fc-list--npc">
                        <li><span class="pc-k">нпс</span>${names([person(f.npc)])}</li>
                    </ul>
                </section>

                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">студенты <span class="dl-group-count" data-booked="${(f.courses || []).reduce((n, g) => n + g.students.filter(x => x.booked).length, 0)}">${studentsText(f)}</span></h3>
                    ${courses.length
                        ? `<ul class="fc-list fc-courses">${courses.map(courseLine).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого.</p>'}
                </section>

                ${electives.length ? `
                    <section class="pc-seg pc-text fc-block">
                        <h3 class="pc-section-title">факультативы</h3>
                        <ul class="fc-electives">
                            ${electives.map(x => `
                                <li class="fc-elective">
                                    <div class="fc-elective-title">${esc((x.subject || '—').toLowerCase())}</div>
                                    <div class="fc-elective-cols">
                                        <div class="fc-elective-col">
                                            <div class="fc-sub">куратор</div>
                                            ${names([person(x.curator)])}
                                        </div>
                                        <div class="fc-elective-col">
                                            <div class="fc-sub">студенты</div>
                                            ${x.students.length ? names(x.students.map(person)) : '<span class="pc-none">—</span>'}
                                        </div>
                                    </div>
                                </li>`).join('')}
                        </ul>
                    </section>` : ''}`;
    }

    function bigCard(f) {
        if (f.staff) return staffCard(f);
        return ticket(f, `
                    <div class="pc-k">факультет</div>
                    <h2 class="pc-big-name">${esc(shortTitle(f.title))}</h2>
                    <div class="fc-pic" aria-hidden="true"></div>
                    ${facultyFacts(f)}`, facultySections(f));
    }

    // то же, что в карточке, — справа от крупного бейджа на странице
    const infoHTML = (f) => `
            <div class="fc-info pc-scroll">
                ${f.staff || !f.dean ? '' : `<div class="fc-info-facts">${deanLine(f)}</div>`}
                ${f.staff ? staffSections(f) : facultySections(f)}
            </div>`;

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

            // порядок анкет для листания стрелками — как на карточке факультета: преподаватели,
            // декан, нпс, студенты по курсам; внутри группы — как в таблице факультетов,
            // кого в таблице нет — по алфавиту
            const tableIdx = new Map();
            [...(info.teachers || []).map(t => t.name), info.dean, info.npc,
                ...(info.courses || []).flatMap(g => g.students)].forEach((n, k) => {
                if (n && !tableIdx.has(n)) tableIdx.set(n, k);
            });
            const byTable = (x, y) => (tableIdx.has(x.name) ? tableIdx.get(x.name) : 1e6) - (tableIdx.has(y.name) ? tableIdx.get(y.name) : 1e6)
                || x.name.localeCompare(y.name, 'ru');
            const memberNames = new Set(members.map(c => c.name));
            const order = [];
            const push = (n) => { if (n && memberNames.has(n) && !order.includes(n)) order.push(n); };
            members.filter(c => c.role === 'преподаватель').sort(byTable).forEach(c => push(c.name));
            push(info.dean);
            push(info.npc);
            members.filter(c => c.role === 'студент')
                .sort((x, y) => ((Number(x.course) || 99) - (Number(y.course) || 99)) || byTable(x, y))
                .forEach(c => push(c.name));
            members.slice().sort(byTable).forEach(c => push(c.name));

            return {
                title,
                subjects: info.subjects || '',
                teachers,
                dean: inTech(info.dean) ? info.dean : '',
                npc: inTech(info.npc) ? info.npc : '',
                courses,
                electives,
                order,
            };
        }).concat([{
            // персонал — отдельная карточка: должности из Техтаблицы (колонка L) и брони
            title: 'Персонал',
            staff: true,
            teachers: d.characters.filter(c => c.role === 'персонал')
                .map(c => ({ subject: c.post || '', name: c.name }))
                .concat(bron.filter(x => x.role === 'персонал').map(x => ({ subject: x.post || x.subject, name: x.name, booked: true }))),
            courses: [],
            order: d.characters.filter(c => c.role === 'персонал').map(c => c.name),
        }]);
    }

    // порядок анкет факультета для листания (персонажи — js/pages/characters.js):
    // по номеру открытой карточки факультета или по названию факультета
    let orderCache = { d: null, list: [] };
    const facultiesOf = (d) => {
        if (orderCache.d !== d) orderCache = { d, list: buildFaculties(d) };
        return orderCache.list;
    };
    RCU.facultyOrderAt = (i) => (faculties[i] ? faculties[i].order : null);
    RCU.facultyOrderOf = (d, title) => {
        const f = d && title && facultiesOf(d).find(x => !x.staff && key(x.title) === key(title));
        return f ? f.order : null;
    };

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
        // листают карточки в окне — бейдж этого факультета встаёт посередине (в него она и свернётся)
        if (pos >= 0 && pos !== cur) showAt(pos);
        modal.hidden = false;
        document.documentElement.classList.add('pc-open');
        // та же анимация открытия, что у анкеты: из маленькой карточки факультета
        if (!dir && wasHidden && RCU.unfoldCard) RCU.unfoldCard('', srcEl || document.querySelector(`.fc-card[data-index="${i}"]`));
        requestAnimationFrame(() => modal.classList.add('is-shown'));
        modalBody.querySelector('.pc-close').focus({ preventScroll: true });
    }

    /* ---------- Ряд маленьких бейджей и крупный выбранный ----------
       Наверху — все факультеты маленькими бейджами в один ряд внахлёст; место выбранного
       пустое. Нажатие на маленький — он вырастает в крупный внизу (а прежний возвращается
       на своё место); нажатие на крупный открывает карточку факультета. Листать ещё можно
       клавишами ← → и пальцем по крупному — тогда бейджи уезжают вбок. */
    let cur = 0;           // номер выбранного факультета (по порядку на странице)
    let listed = [];       // [{ f, i }] в порядке на странице

    // короткие подписи под маленькими бейджами
    const SHORT = [
        ['химико', 'хим-био'], ['философ', 'фил-соц'], ['историко', 'ист-арх'], ['художеств', 'худ-театр'],
        ['журналист', 'журфак'], ['реклам', 'реклама'], ['механико', 'мех-мат'], ['экономич', 'эконом'],
        ['гостинич', 'гостин'], ['филолог', 'филфак'], ['спортив', 'спорт'], ['музыкал', 'музыка'],
        ['юридич', 'юрфак'], ['персонал', 'персонал'],
    ];
    // цвета факультета из общей палитры: основной и тот, что виден на тёмном фоне
    const facVar = (f, name) => (RCU.facultyAttrs(f.staff ? 'Персонал' : f.title).attrs.match(new RegExp(`--${name}:([^;"]+)`)) || [])[1] || '';
    const facMain = (f) => facVar(f, 'fac-main');
    const facBright = (f) => ((/философ|экономич|музыкал|юридич/i.test(f.title || '') && facVar(f, 'fac-stripe')) || facMain(f));

    const shortLabel = (f) => {
        const t = String(f.title || '').toLowerCase();
        const hit = SHORT.find(([k]) => t.includes(k));
        return hit ? hit[1] : shortTitle(f.title);
    };

    function miniBadge(f, i, pos) {
        return `
            <button class="fc-mini${f.staff ? ' fc-mini--staff' : ''}" type="button"
                data-pos="${pos}" aria-label="${esc(f.staff ? 'Персонал' : f.title)}"${facStyle(f.title)}>
                <span class="fc-mini-strap" aria-hidden="true"></span>
                <span class="fc-mini-badge" aria-hidden="true"><span class="fc-mini-band"></span><span class="fc-mini-star">✦</span></span>
                <span class="fc-mini-label">${esc(shortLabel(f))}</span>
            </button>`;
    }

    const miniAt = (pos) => document.querySelector(`.fc-mini[data-pos="${pos}"] .fc-mini-badge`);
    const EASE_FLY = 'cubic-bezier(0.45, 0, 0.25, 1)';

    // transform крупного бейджа, при котором его основа ложится ровно на основу маленького
    // (масштаб — от левого верхнего угла карточки)
    // (меряется без наклона — он отдельно, у .fc-tilt)
    function mapOnto(card, target) {
        card.classList.add('is-flat');
        const c = card.getBoundingClientRect();
        const b = card.querySelector('.fc-badge').getBoundingClientRect();
        card.classList.remove('is-flat');
        const t = target.getBoundingClientRect();
        const s = t.width / b.width;
        return `translate(${t.left - c.left - s * (b.left - c.left)}px, ${t.top - c.top - s * (b.top - c.top)}px) scale(${s})`;
    }

    /* how: 0 — без анимации; 'grow' — нажали на маленький: он вырастает в крупный, а прежний
       крупный уменьшается обратно на своё место в ряду; ±1 — листание (клавиши, палец):
       прежний уезжает в одну сторону, новый приезжает с другой */
    function showAt(pos, how = 0) {
        const stage = document.querySelector('.fc-badge-slot');
        const info = document.querySelector('.fc-stage-info');
        if (!stage || !listed.length) return;
        const prev = cur;
        cur = Math.max(0, Math.min(listed.length - 1, pos));
        const old = stage.querySelector('.fc-card:not(.is-leaving)');
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animate = !!how && !!old && !!old.animate && !reduce;

        // прежний крупный: остаётся на месте поверх раскладки, пока уходит
        if (old && animate) {
            const sr = stage.getBoundingClientRect(), r = old.getBoundingClientRect();
            Object.assign(old.style, {
                position: 'absolute', left: `${r.left - sr.left}px`, top: `${r.top - sr.top}px`,
                width: `${r.width}px`, margin: '0', zIndex: '0', pointerEvents: 'none',
            });
            old.classList.add('is-leaving');
        } else if (old) old.remove();
        stage.querySelectorAll('.fc-card.is-leaving').forEach(el => { if (el !== old) el.remove(); });

        const { f, i } = listed[cur];
        stage.insertAdjacentHTML('beforeend', smallCard(f, i, cur));
        // сначала уходит прежний бейдж, потом появляется новый (LEAVE — сколько уходит)
        const LEAVE = how === 'grow' ? 520 : 280;
        const swapText = () => {
            if (info) {
                info.innerHTML = infoHTML(f);
                info.querySelectorAll('.pc-section-title').forEach(h => {
                    h.tabIndex = 0;
                    h.setAttribute('role', 'button');
                    h.setAttribute('aria-expanded', 'true');
                    // «занято/мест» — полоской под заголовком, цифры — при наведении на неё
                    const count = h.querySelector('.dl-group-count');
                    const m = count && count.textContent.match(/(\d+)\s*\/\s*(\d+)/);
                    if (!m) return;
                    const booked = Math.min(Number(count.dataset.booked) || 0, Number(m[1]));
                    count.remove();
                    const busy = Number(m[1]), all = Number(m[2]);
                    const pctOf = (x) => (all ? Math.min(100, x / all * 100) : 0);
                    // занятые — полностью, брони — следом, наполовину прозрачные
                    const taken = pctOf(busy - booked), held = Math.min(pctOf(booked), 100 - taken);
                    h.insertAdjacentHTML('afterend', `
                        <div class="fc-meter" role="meter" aria-valuemin="0" aria-valuemax="${all}" aria-valuenow="${busy}"
                            aria-label="занято ${busy} из ${all}${booked ? `, из них в броне ${booked}` : ''}">
                            <span class="fc-meter-fill" style="width:${taken}%"></span>
                            ${booked ? `<span class="fc-meter-booked" style="left:${taken}%;width:${held}%"></span>` : ''}
                            <span class="fc-meter-num">${busy}/${all}</span>
                        </div>`);
                });
                // бегунок прокрутки — цвета факультета (как в анкетах)
                const main = facMain(f);
                if (main) info.style.setProperty('--fac-accent', main); else info.style.removeProperty('--fac-accent');
                // полоски мест: у тёмных факультетов основной цвет на тёмном фоне не виден — берём второй
                info.style.setProperty('--fac-meter', facBright(f));
                // колонка должностей у персонала — по самому длинному названию
                const posts = [...info.querySelectorAll('.fc-post > .pc-k')];
                if (posts.length) {
                    posts.forEach(k => { k.style.whiteSpace = 'nowrap'; });
                    const w = Math.ceil(Math.max(...posts.map(k => k.scrollWidth)));
                    posts.forEach(k => { k.style.whiteSpace = ''; });
                    info.style.setProperty('--post-k', `${w + 2}px`);
                }
                // основа бейджа: у персонала голубая (для пустой части полосок мест)
                info.style.setProperty('--fac-paper', f.staff ? '#98afd3' : '#e2e1dd');
            }
        };
        // текст справа: гаснет, меняется, проявляется. Новое переключение отменяет незаконченное
        // прежнее (иначе при быстрых нажатиях затухание могло остаться висеть — блок пропадал)
        if (info) {
            const token = (info.swapToken = (info.swapToken || 0) + 1);
            info.getAnimations().forEach(a => a.cancel());
            if (animate) {
                const out = info.animate([{ opacity: 1 }, { opacity: 0 }],
                    { duration: LEAVE * 0.6, easing: 'ease-in', fill: 'forwards' });
                out.finished.then(() => {
                    if (info.swapToken !== token) return;
                    swapText();
                    out.cancel();
                    revealInfo(info, LEAVE * 0.4);
                }, () => {});
            } else swapText();
        }
        const card = stage.lastElementChild;
        card.classList.add('is-current');
        card.style.zIndex = '1';

        document.querySelectorAll('.fc-mini').forEach(el => {
            const on = Number(el.dataset.pos) === cur;
            el.classList.toggle('is-current', on);
            el.setAttribute('aria-pressed', String(on));
        });
        if (!animate) return;

        // наклон бейджа (в маленьких его нет): при вырастании — появляется, при возврате — уходит
        const tiltOf = (el) => `rotate(${parseFloat(el.style.getPropertyValue('--tilt')) || 0}deg)`;
        if (how === 'grow') {
            const from = miniAt(cur), back = miniAt(prev);
            card.querySelector('.fc-tilt').animate([{ transform: 'none' }, { transform: tiltOf(card) }],
                { duration: 620, delay: LEAVE, easing: EASE_FLY, fill: 'backwards' });
            old.querySelector('.fc-tilt').animate([{ transform: tiltOf(old) }, { transform: 'none' }],
                { duration: LEAVE, easing: EASE_FLY, fill: 'forwards' });
            // новый вырастает из своего маленького
            if (from) {
                card.style.transformOrigin = '0 0';
                // пока прежний улетает, новый ждёт на месте маленького (выглядит как он сам)
                card.animate([{ transform: mapOnto(card, from), opacity: 1 }, { transform: 'none', opacity: 1 }],
                    { duration: 620, delay: LEAVE, easing: EASE_FLY, fill: 'backwards' })
                    .finished.then(() => { card.style.transformOrigin = ''; }, () => {});
            }
            // прежний уменьшается на своё место в ряду; место пустое, пока он не долетит
            const slot = back && back.closest('.fc-mini');
            if (slot && prev !== cur) {
                slot.classList.add('is-returning');
                old.style.transformOrigin = '0 0';
                old.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.85 }, { transform: mapOnto(old, back), opacity: 0 }],
                    { duration: LEAVE, easing: EASE_FLY, fill: 'forwards' })
                    .finished.then(() => { old.remove(); slot.classList.remove('is-returning'); }, () => {});
            } else old.remove();
            return;
        }

        // листание: прежний уезжает, новый приезжает с другой стороны
        const dir = how > 0 ? 1 : -1;
        card.animate([{ transform: `translateX(${dir * 4}rem)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 450, delay: LEAVE, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)', fill: 'backwards' });
        old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 4}rem)`, opacity: 0 }],
            { duration: LEAVE, easing: 'ease-in', fill: 'forwards' })
            .finished.then(() => old.remove(), () => {});
    }
    const move = (dir) => { if (cur + dir >= 0 && cur + dir < listed.length) showAt(cur + dir, dir); };

    function wireStage(root) {
        const stage = root.querySelector('.fc-stage');
        // палец: провели вбок по крупному — следующий / предыдущий (нажатие после этого ничего не открывает)
        let x0 = null, y0 = 0;
        stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
        stage.addEventListener('pointerup', (e) => {
            if (x0 == null) return;
            const dx = e.clientX - x0, dy = e.clientY - y0;
            x0 = null;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                stage.dataset.swiped = '1';
                setTimeout(() => { delete stage.dataset.swiped; }, 350);
                move(dx < 0 ? 1 : -1);
            }
        });
    }

    // разделы справа (преподаватели, студенты…) сворачиваются по нажатию на заголовок
    document.addEventListener('click', (e) => {
        const title = e.target.closest('.fc-info .pc-section-title');
        if (!title) return;
        const sec = title.closest('.pc-seg');
        const off = sec.classList.toggle('is-collapsed');
        title.setAttribute('aria-expanded', String(!off));
    });
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.fc-info .pc-section-title')) {
            e.preventDefault();
            e.target.click();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!document.querySelector('.fc-stage') || document.querySelector('.fc-picked[hidden]') || (modal && !modal.hidden)) return;
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (e.key === 'ArrowLeft') move(-1);
        else if (e.key === 'ArrowRight') move(1);
    });

    RCU.pageFaculty = (dir) => {
        const pos = shown.indexOf(Number(modalBody.dataset.fac));
        const next = shown[pos + dir];
        if (pos >= 0 && next != null) openFaculty(next, null, dir);
    };

    document.addEventListener('click', (e) => {
        // маленький бейдж наверху — показать его крупно
        const mini = e.target.closest('.fc-mini[data-pos]');
        if (mini) {
            const pos = Number(mini.dataset.pos);
            if (pos !== cur) showAt(pos, 'grow');
            return;
        }
        // крупный бейдж — обратно в ряд, а ряд — в карусель
        const big = e.target.closest('.fc-badge-slot .fc-card');
        if (big) {
            const stage = big.closest('.fc-stage');
            if (stage && stage.dataset.swiped) return;          // провели пальцем — только листание
            backToRing(big.closest('.page-root') || document);
        }
    });

    /* ---------- Текст справа появляется: проявляется и чуть поднимается снизу ---------- */
    function revealInfo(info, delay = 0) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        info.animate([{ opacity: 0, transform: 'translateY(0.6rem)' }, { opacity: 1, transform: 'none' }],
            { duration: 420, delay, easing: 'ease-out', fill: 'backwards' });
    }

    /* ---------- Шкафчики: сначала все факультеты — рядами шкафчиков ----------
       У каждого факультета свой шкафчик: дверца его цвета, жалюзи, табличка с названием, ручка.
       Навели — дверца приоткрывается; нажали — распахивается, а бейдж, который висит внутри
       на своей ленте, достаётся и встаёт на своё место слева; шкафчики уменьшаются и уезжают
       вверх (в ряд маленьких), справа проявляются сведения. Нажатие на крупный бейдж —
       обратно: он возвращается в ряд, а ряд — в шкафчики. */
    function ringHTML(list) {
        return `
            <div class="fc-carousel fc-lockers">${list.map(({ f, i }, pos) => `
                <div class="fc-locker" data-pos="${pos}" role="button" tabindex="0" aria-label="${esc(f.staff ? 'Персонал' : f.title)}"
                    style="--door:${f.staff ? '#98afd3' : (facMain(f) || '#3b2620')}">
                    <div class="fc-locker-inside"><div class="fc-locker-face">${smallCard(f, i, pos)}</div></div>
                    <div class="fc-locker-door">
                        <span class="fc-locker-vents" aria-hidden="true"></span>
                        <span class="fc-locker-plate">${esc(shortLabel(f))}</span>
                        <span class="fc-locker-handle" aria-hidden="true"></span>
                        <span class="fc-locker-vents fc-locker-vents--low" aria-hidden="true"></span>
                    </div>
                </div>`).join('')}
            </div>`;
    }

    // шкафчики — сеткой (7 в ряд, на узком экране 4) во весь основной блок по высоте
    // (но не ниже, чем 1 : 1.5); бейдж внутри — по ширине шкафчика
    function layoutRing(car) {
        const card = car.querySelector('.fc-locker .fc-card');
        if (!card || !card.offsetWidth) return;
        const W = card.offsetWidth;
        const cw = car.clientWidth;
        const n = car.querySelectorAll('.fc-locker').length;
        const cols = cw < 500 ? 4 : 7, rows = Math.ceil(n / cols);
        const gap = 6, pad = 10;
        const lw = (cw - 2 * pad - (cols - 1) * gap) / cols;
        const s = (lw * 0.84) / W;
        const vp = car.closest('.main-scroll-viewport');
        const vs = vp && getComputedStyle(vp);
        const avail = vp ? vp.clientHeight - (parseFloat(vs.paddingTop) || 0) - (parseFloat(vs.paddingBottom) || 0) : 0;
        const minH = 2 * pad + rows * lw * 1.5 + (rows - 1) * gap;
        const hgt = Math.floor(Math.max(avail, minH));
        car.style.height = `${hgt}px`;
        // над шкафчиками бывает небольшой отступ страницы — чтобы не появлялась прокрутка, убираем его
        const over = vp && getComputedStyle(car).position !== 'absolute' ? vp.scrollHeight - vp.clientHeight : 0;
        if (over > 0 && hgt - over >= minH) car.style.height = `${hgt - over}px`;
        car.style.setProperty('--rows', String(rows));
        car.style.setProperty('--cols', String(cols));
        car.style.setProperty('--s', String(s));
        car.style.setProperty('--fw', `${Math.round(W * s)}px`);
    }

    function pickFromRing(root, pos) {
        const car = root.querySelector('.fc-carousel');
        if (!car || car.classList.contains('is-picking')) return;
        car.classList.add('is-picking');
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const item = car.querySelector(`.fc-locker[data-pos="${pos}"]`);
        const from = item.querySelector('.fc-card').getBoundingClientRect();
        item.querySelector('.fc-locker-face').style.visibility = 'hidden';   // шкафчик остаётся открытым и пустым

        // раскладка — поверх, чтобы ряд и сведения сразу встали на свои места
        const page = root.querySelector('.fc-page');
        const pr = page.getBoundingClientRect(), cr = car.getBoundingClientRect();
        Object.assign(car.style, { position: 'absolute', left: `${cr.left - pr.left}px`, top: `${cr.top - pr.top}px`, width: `${cr.width}px` });
        const picked = root.querySelector('.fc-picked');
        picked.hidden = false;
        picked.getAnimations().forEach(a => a.cancel());
        picked.style.opacity = '';
        showAt(pos);
        const card = root.querySelector('.fc-badge-slot .fc-card');
        const info = root.querySelector('.fc-stage-info');
        card.style.visibility = 'hidden';
        if (info) info.style.visibility = 'hidden';
        card.classList.add('is-flat');
        const to = card.getBoundingClientRect();
        card.classList.remove('is-flat');
        const tilt = parseFloat(card.style.getPropertyValue('--tilt')) || 0;

        // бейдж (копия поверх страницы) достаётся из шкафчика и встаёт на своё место
        const ghost = card.cloneNode(true);
        ghost.classList.add('fc-ghost');
        const W = card.offsetWidth;
        Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', margin: '0', zIndex: '50', width: `${W}px`,
            transformOrigin: '0 0', pointerEvents: 'none', visibility: '' });
        document.body.appendChild(ghost);
        const s0 = from.width / W;

        const done = () => {
            ghost.remove();
            card.style.visibility = '';
            if (info) { info.style.visibility = ''; revealInfo(info); }
            car.remove();
        };
        if (reduce) { done(); return; }
        const FLY = 800;
        car.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-45%) scale(0.3)', opacity: 0 }],
            { duration: 650, easing: 'cubic-bezier(0.5, 0, 0.7, 0.4)', fill: 'forwards' });
        root.querySelector('.fc-picker').animate(
            [{ transform: 'translateY(-1.5rem)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 500, delay: 300, easing: 'ease-out', fill: 'backwards' });
        ghost.querySelector('.fc-tilt').animate([{ transform: 'none' }, { transform: `rotate(${tilt}deg)` }],
            { duration: FLY, easing: EASE_FLY, fill: 'forwards' });
        // сначала чуть вверх — снимается с крючка, потом — на место
        const up = Math.min(from.top - 20, from.height * 0.2);
        ghost.animate([
            { transform: `translate(${from.left}px, ${from.top}px) scale(${s0})` },
            { transform: `translate(${from.left}px, ${from.top - up}px) scale(${s0})`, offset: 0.3 },
            { transform: `translate(${to.left}px, ${to.top}px) scale(${to.width / W})` },
        ], { duration: FLY, easing: EASE_FLY, fill: 'forwards' }).finished.then(done, done);
    }

    // обратно: крупный бейдж возвращается в ряд маленьких, потом ряд разрастается в шкафчики
    let returning = false;
    function backToRing(root) {
        const page = root.querySelector('.fc-page');
        const picked = root.querySelector('.fc-picked');
        const card = root.querySelector('.fc-badge-slot .fc-card:not(.is-leaving)');
        // (пока выбранный ещё летит на место — он скрыт, возвращать нечего)
        if (!page || !picked || picked.hidden || !card || returning || card.style.visibility === 'hidden') return;
        returning = true;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const slot = root.querySelector(`.fc-mini[data-pos="${cur}"]`);
        const target = slot && slot.querySelector('.fc-mini-badge');
        const info = root.querySelector('.fc-stage-info');
        const BACK = reduce ? 0 : 560;

        // 1) крупный уменьшается в своё место в ряду, сведения гаснут
        if (!reduce && target) {
            const tilt = parseFloat(card.style.getPropertyValue('--tilt')) || 0;
            card.style.transformOrigin = '0 0';
            card.querySelector('.fc-tilt').animate([{ transform: `rotate(${tilt}deg)` }, { transform: 'none' }],
                { duration: BACK, easing: EASE_FLY, fill: 'forwards' });
            card.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.85 }, { transform: mapOnto(card, target), opacity: 0 }],
                { duration: BACK, easing: EASE_FLY, fill: 'forwards' });
            if (info) info.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BACK * 0.6, fill: 'forwards' });
        }

        setTimeout(() => {
            // место в ряду заполнено — ряд разрастается в шкафчики
            if (slot) slot.classList.remove('is-current');
            page.insertAdjacentHTML('afterbegin', ringHTML(listed));
            const car = page.querySelector('.fc-carousel');
            Object.assign(car.style, { position: 'absolute', left: '0', top: '0', width: '100%' });
            wireCarousel(root);
            const finish = () => {
                picked.hidden = true;
                picked.getAnimations().forEach(a => a.cancel());   // затухание не должно остаться висеть
                picked.style.opacity = '';
                car.style.position = car.style.left = car.style.top = car.style.width = '';
                layoutRing(car);                                  // снова в потоке — высота по основному блоку
                if (info) info.getAnimations().forEach(a => a.cancel());
                card.getAnimations({ subtree: true }).forEach(a => a.cancel());
                card.style.transformOrigin = '';
                returning = false;
            };
            if (reduce) { finish(); return; }
            picked.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
            car.animate([{ transform: 'translateY(-45%) scale(0.3)', opacity: 0 }, { transform: 'none', opacity: 1 }],
                { duration: 700, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' }).finished.then(finish, finish);
        }, BACK);
    }

    function wireCarousel(root) {
        const car = root.querySelector('.fc-carousel');
        if (!car) return;
        layoutRing(car);
        if (document.fonts) document.fonts.ready.then(() => layoutRing(car));
        // ширина блока меняется (заставка, поворот телефона) — шкафчики пересчитываются
        if (window.ResizeObserver) {
            // (и высота основного блока — шкафчики во всю его высоту)
            const vp = car.closest('.main-scroll-viewport');
            let w = car.clientWidth, vh = vp ? vp.clientHeight : 0;
            const ro = new ResizeObserver(() => {
                if (!car.isConnected) { ro.disconnect(); return; }
                const nvh = vp ? vp.clientHeight : 0;
                if (car.classList.contains('is-picking') || (car.clientWidth === w && nvh === vh)) return;
                w = car.clientWidth;
                vh = nvh;
                layoutRing(car);
            });
            ro.observe(car);
            if (vp) ro.observe(vp);
        }
        // сначала распахивается дверца, потом достаётся бейдж
        const pick = (e) => {
            const item = e.target.closest('.fc-locker');
            if (!item || car.querySelector('.fc-locker.is-open')) return;
            item.classList.add('is-open');
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            setTimeout(() => pickFromRing(root, Number(item.dataset.pos)), reduce ? 0 : 420);
        };
        car.addEventListener('click', pick);
        car.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
    }

    // для других страниц (карта на «Университете»): список факультетов и их подписи и цвета
    RCU.facultyKit = {
        list: (d) => buildFaculties(d)
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => f.staff ? f.teachers.length : (studentsCount(f) || f.teachers.length || f.dean)),
        shortLabel,
        facBright,
    };

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
            listed = list;
            if (!list.length) {
                root.innerHTML = '<p class="dl-status">Не удалось загрузить таблицу факультетов.</p>';
                return;
            }
            // адрес вида #faculties/Музыкальный_факультет — сразу этот факультет, без шкафчиков
            const wanted = key(String(RCU.routeParam || '').replace(/_/g, ' '));
            const i = wanted ? faculties.findIndex(f => key(f.title) === wanted) : -1;
            const direct = i >= 0 && shown.includes(i);
            const picked = `
                   <div class="fc-picker" style="--n:${list.length}">${list.map(({ f, i }, pos) => miniBadge(f, i, pos)).join('')}</div>
                   <div class="fc-stage">
                       <div class="fc-stage-badge"><div class="fc-badge-slot"></div></div>
                       <div class="fc-stage-info"></div>
                   </div>`;
            root.innerHTML = `
                <div class="fc-page">
                    ${direct ? '' : ringHTML(list)}
                    <div class="fc-picked"${direct ? '' : ' hidden'}>${picked}</div>
                </div>`;
            wireStage(root);
            if (direct) showAt(shown.indexOf(i));
            else wireCarousel(root);
        },
    };
})();
