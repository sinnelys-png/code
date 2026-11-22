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
        ? (m.name ? `${person(m.name)} <span class="fc-bron">бронь</span>` : '<span class="fc-bron">место занято</span>')
        : person(m.name);

    // правый столбец списка: каждое имя — с новой строки
    const names = (parts) => `<span class="fc-names">${parts.map(p => `<span class="fc-name">${p}</span>`).join('')}</span>`;

    // предметы, которые уже кто-то ведёт (без броней)
    const taughtSubjects = (f) => [...new Set(f.teachers.filter(t => !t.booked && t.subject).map(t => t.subject.toLowerCase()))];

    // строка курса; брони без имени и курса — одной строкой «забронировано: 2 места»
    function courseLine(g) {
        const anon = g.students.filter(m => m.booked && !m.name);
        const named = g.students.filter(m => !(m.booked && !m.name));
        const label = g.course ? `${g.course} курс` : (named.length ? 'курс не указан' : 'бронь');
        const parts = named.map(member);
        if (anon.length) parts.push(`<span class="fc-bron">${anon.length} ${RCU.plural(anon.length, 'место', 'места', 'мест')} в броне</span>`);
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
        const curl = '<svg class="fc-curl" viewBox="0 0 60 40" aria-hidden="true"><path d="M2 38 C2 18 14 4 34 3 C46 2 56 8 58 16 C50 10 40 10 32 14 C22 19 16 28 14 38 M10 30 C16 22 26 17 38 17" /></svg>';
        return `
            <button class="fc-card${f.staff ? ' fc-card--staff' : ''}" type="button" data-index="${i}"
                aria-label="${esc(f.staff ? 'Персонал' : f.title)}: открыть карточку"${facStyle(f.title).replace('style="', `style="--tilt:${TILTS[pos % TILTS.length]}deg;`)}>
                <span class="fc-tilt">
                    <span class="fc-body">
                    <span class="fc-strap" aria-hidden="true"></span>
                    <span class="fc-edge" aria-hidden="true">${'<span></span>'.repeat(EDGE_LAYERS)}</span>
                    <span class="fc-badge">
                        <span class="fc-shine" aria-hidden="true"></span>
                        <span class="fc-slot" aria-hidden="true"></span>
                        <span class="fc-frame" aria-hidden="true">${curl}${curl.replace('fc-curl', 'fc-curl fc-curl--r')}</span>
                        <span class="fc-band"><span class="fc-card-title${title.length > 28 ? ' fc-card-title--xlong' : title.length > 14 ? ' fc-card-title--long' : ''}">${esc(title)}</span></span>
                        <span class="fc-divider" aria-hidden="true"><span></span>✦<span></span></span>
                        <span class="fc-kicker">${f.staff ? 'университет' : 'факультет'}</span>
                        <span class="fc-crest" aria-hidden="true"><span></span></span>
                    </span>
                    </span>
                </span>
            </button>`;
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
        ['охрана', [['дневной охранник', 3], ['ночной охранник', 3]]],
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

    // строка должности: название | «занято/мест» таблеткой, как у отдела | кто на ней (никого — прочерк)
    function postLine(post, seats, people) {
        return `
            <li class="fc-post">
                <span class="pc-k">${esc(post)}</span>
                <span class="dl-group-count fc-seats">${people.length}/${seats}</span>
                <span class="fc-post-people">${people.length ? people.map(member).join(', ') : '<span class="pc-none">—</span>'}</span>
            </li>`;
    }

    // разделы карточки персонала (они же — справа от бейджа на странице)
    function staffSections(f) {
        const { byPost, other } = staffSeats(f);
        return STAFF.map(([dept, posts]) => {
                const busy = posts.reduce((n, [p]) => n + (byPost.get(postKey(p)) || []).length, 0);
                const all = posts.reduce((n, [, k]) => n + k, 0);
                return `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">${esc(dept)} <span class="dl-group-count">${busy}/${all}</span></h3>
                    <ul class="fc-list">${posts.map(([p, k]) => postLine(p, k, byPost.get(postKey(p)) || [])).join('')}</ul>
                </section>`;
            }).join('') + (other.length ? `
                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">другие должности</h3>
                    <ul class="fc-list">${other.map(t => `<li><span class="pc-k">${esc((t.subject || (t.booked ? 'бронь' : '—')).toLowerCase())}</span> ${member(t)}</li>`).join('')}</ul>
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
                    <h3 class="pc-section-title">преподаватели <span class="dl-group-count">${teachersText(f)}</span></h3>
                    ${teachers.length
                        ? `<ul class="fc-list">${teachers.map(t => `<li><span class="pc-k">${esc((t.subject || (t.booked ? 'бронь' : '—')).toLowerCase())}</span>${names([member(t)])}</li>`).join('')}</ul>`
                        : '<p class="pc-soon">Пока никого — места свободны.</p>'}
                    <ul class="fc-list fc-list--npc">
                        <li><span class="pc-k">нпс</span>${names([person(f.npc)])}</li>
                    </ul>
                </section>

                <section class="pc-seg pc-text fc-block">
                    <h3 class="pc-section-title">студенты <span class="dl-group-count">${studentsText(f)}</span></h3>
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
                });
                // бегунок прокрутки — цвета факультета (как в анкетах)
                const main = (RCU.facultyAttrs(f.staff ? 'Персонал' : f.title).attrs.match(/--fac-main:([^;"]+)/) || [])[1];
                if (main) info.style.setProperty('--fac-accent', main); else info.style.removeProperty('--fac-accent');
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
                    info.animate([{ opacity: 0, transform: 'translateY(0.6rem)' }, { opacity: 1, transform: 'none' }],
                        { duration: 420, delay: LEAVE * 0.4, easing: 'ease-out', fill: 'backwards' });
                    out.cancel();
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
        if (!document.querySelector('.fc-stage') || (modal && !modal.hidden)) return;
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
        // крупный — открыть карточку факультета
        const card = e.target.closest('.fc-card[data-index]');
        if (!card) return;
        const stage = card.closest('.fc-stage');
        if (stage && stage.dataset.swiped) return;             // провели пальцем — только листание
        openFaculty(Number(card.dataset.index), card);
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
            listed = list;
            root.innerHTML = list.length
                ? `<div class="fc-picker" style="--n:${list.length}">${list.map(({ f, i }, pos) => miniBadge(f, i, pos)).join('')}</div>
                   <div class="fc-stage">
                       <div class="fc-stage-badge"><div class="fc-badge-slot"></div></div>
                       <div class="fc-stage-info"></div>
                   </div>`
                : '<p class="dl-status">Не удалось загрузить таблицу факультетов.</p>';
            if (list.length) {
                wireStage(root);
                showAt(Math.min(cur, list.length - 1));
            }
            // адрес вида #faculties/Музыкальный_факультет — открыть карточку факультета
            const wanted = key(String(RCU.routeParam || '').replace(/_/g, ' '));
            const i = wanted ? faculties.findIndex(f => key(f.title) === wanted) : -1;
            if (i >= 0) setTimeout(() => openFaculty(i), 300);
        },
    };
})();
