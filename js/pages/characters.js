// Публичный сайт, страница «Персонажи»: картотеки по ролям, по одной на экране.
// Стопка раскрывается в столбец; карточка в центре по нажатию открывает большую.
// Большую карточку открывают и другие страницы: RCU.openCharacter(имя).
(() => {
    const { esc, safeUrl } = RCU;

    const ROLES = [
        ['студент', 'студенты'],
        ['преподаватель', 'преподаватели'],
        ['персонал', 'персонал'],
    ];

    let data = null;   // { characters, byName, facultyInfo }

    /* ---------- Части карточек ---------- */

    // квадратный аватар без рамки факультета, как в прототипе (цвет факультета — полоса сверху карточки)
    function avatar(c, cls = '') {
        return safeUrl(c.avatar)
            ? `<img class="pc-ava ${cls}" src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<div class="pc-ava pc-ava--empty ${cls}">${esc(c.name.charAt(0))}</div>`;
    }

    // «Факультет художественного и театрального искусства» → «художественного и театрального искусства»
    const shortFaculty = (f) => String(f || '').replace(/^факультет\s+/i, '').replace(/\s+факультет$/i, '').toLowerCase();

    const facStyle = (c) => {
        const fac = RCU.facultyAttrs(c.faculty);
        const m = fac.attrs.match(/style="([^"]*)"/);
        return m ? ` style="${m[1]}"` : '';
    };

    /* ---------- Предмет в родительном падеже ----------
       «повышение спортивного мастерства» → «преподаватель повышения спортивного мастерства».
       Склоняются прилагательные в начале и первое существительное, остальное — как есть.
       Аббревиатуры (ДПИ) не склоняются; должности («Заведующий кафедрой…») выводятся как есть. */
    const POST_WORDS = /^(заведующ|декан|руководител|заместител|старш|главн|ведущ|проректор|ректор|куратор)/i;

    function genitiveWord(w, isAdj) {
        if (/^[A-ZА-ЯЁ]{2,}$/.test(w)) return w;                 // аббревиатура
        const lw = w.toLowerCase();
        if (isAdj) {
            return lw.replace(/(ое|ий|ый|ой)$/, 'ого').replace(/ая$/, 'ой').replace(/яя$/, 'ей').replace(/ее$/, 'его');
        }
        if (/ие$/.test(lw)) return lw.replace(/ие$/, 'ия');
        if (/ия$/.test(lw)) return lw.replace(/ия$/, 'ии');
        if (/ье$/.test(lw)) return lw.replace(/ье$/, 'ья');
        if (/ь$/.test(lw)) return lw.replace(/ь$/, 'и');
        if (/о$/.test(lw)) return lw.replace(/о$/, 'а');
        if (/[гкхжшчщ]а$/.test(lw)) return lw.replace(/а$/, 'и');
        if (/а$/.test(lw)) return lw.replace(/а$/, 'ы');
        if (/я$/.test(lw)) return lw.replace(/я$/, 'и');
        if (/[бвгджзклмнпрстфхцчшщ]$/.test(lw)) return lw + 'а';
        return lw;
    }

    function teacherRole(subject) {
        const s = String(subject || '').trim();
        if (!s) return 'преподаватель';
        if (POST_WORDS.test(s)) return s.charAt(0).toLowerCase() + s.slice(1);
        const words = s.split(/\s+/);
        const out = [];
        let done = false;
        for (const w of words) {
            if (done) { out.push(/^[A-ZА-ЯЁ]{2,}$/.test(w) ? w : w.toLowerCase()); continue; }
            const adj = /(ое|ий|ый|ой|ая|яя|ее)$/i.test(w) && words.length > 1;
            out.push(genitiveWord(w, adj));
            if (!adj) done = true;
        }
        return `преподаватель ${out.join(' ')}`;
    }

    const lowerFirst = (s) => (/^[A-ZА-ЯЁ]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

    // короткие названия факультетов для ярлычков (как в меню таблицы факультетов)
    const FAC_SHORT = [
        ['химико', 'хим-био'], ['историко', 'ист-арх'], ['журналист', 'журфак'], ['механико', 'мех-мат'],
        ['гостинич', 'гостин'], ['спортив', 'спорт'], ['философ', 'фил-соц'], ['художеств', 'худ-театр'],
        ['реклам', 'реклама'], ['экономич', 'эконом'], ['филолог', 'филфак'], ['музыкал', 'музыка'], ['юридич', 'юрфак'],
    ];
    const facShort = (f) => {
        const t = String(f || '').toLowerCase();
        const hit = FAC_SHORT.find(([k]) => t.includes(k));
        return hit ? hit[1] : (t ? t.slice(0, 8) : '—');
    };

    function tabText(c, sortBy) {
        if (sortBy === 'faculty') return facShort(c.faculty);
        if (sortBy === 'course') return c.course ? `${c.course} курс` : '—';
        return c.name.charAt(0);
    }

    function smallCard(c, sortBy = 'name') {
        const course = c.course ? `${c.course}` : '—';
        const row = (k, v, cls = '') => `<span class="pc-row"><span class="pc-k">${k}</span><span class="pc-v ${cls}">${esc(v || '—')}</span></span>`;
        let rows;
        if (c.role === 'персонал') rows = row('должн.', lowerFirst(c.post || ''));
        else if (c.role === 'преподаватель') rows = row('фак.', shortFaculty(c.faculty), 'pc-fac') + row('предм.', lowerFirst(c.subject || ''), 'pc-fac');
        else rows = row('курс', course) + row('фак.', shortFaculty(c.faculty), 'pc-fac');
        return `
            <button class="pc-card" type="button" data-name="${esc(c.name)}"${facStyle(c)}>
                <span class="pc-card-tab">${esc(tabText(c, sortBy))}</span>
                ${avatar(c, 'pc-card-avatar')}
                <span class="pc-card-info">
                    <span class="pc-row"><span class="pc-k">имя</span><span class="pc-v pc-name">${esc(c.name)}</span></span>
                    ${rows}
                </span>
            </button>`;
    }

    function stat(label, value) {
        return `<div class="pc-stat"><div class="pc-k">${esc(label)}</div><div class="pc-v">${value ? esc(value) : '<span class="pc-none">—</span>'}</div></div>`;
    }

    function bigCard(c) {
        const a = anketaOf(c);
        const tabs = [
            ['альбом', c.albumUrl],
            ['тема', c.topicUrl],
            ['отвечающий', c.playerUrl],
        ].filter(([, u]) => safeUrl(u))
            .map(([t, u]) => `<a class="pc-tab" href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`).join('');

        const home = c.house ? `д. ${c.house}${c.room ? `, к. ${c.room}` : ''}` : '';
        const duet = c.duet
            ? (data.byName.has(c.duet)
                ? `<button class="pc-link" type="button" data-name="${esc(c.duet)}">${esc(c.duet)}</button>`
                : esc(c.duet))
            : '';

        const extras = [
            c.posts.length ? `<li><span class="pc-k">должности</span> ${c.posts.map(esc).join('; ')}</li>` : '',
            c.extra ? `<li><span class="pc-k">доп. предметы</span> ${esc(c.extra)}</li>` : '',
            c.neighbor ? `<li><span class="pc-k">можно соседа</span> ${esc(c.neighbor)}</li>` : '',
            duet ? `<li><span class="pc-k">дуэт</span> ${duet}</li>` : '',
            c.player ? `<li><span class="pc-k">отвечает</span> ${safeUrl(c.playerUrl) ? `<a class="pc-link" href="${esc(c.playerUrl)}" target="_blank" rel="noopener">${esc(c.player)}</a>` : esc(c.player)}</li>` : '',
        ].join('');

        return `
            <article class="pc-big"${facStyle(c)}>
                ${tabs ? `<nav class="pc-tabs">${tabs}</nav>` : ''}
                <button class="pc-close" type="button" data-close aria-label="Закрыть">×</button>
                <span class="pc-bookmark" aria-hidden="true"></span>

                <div class="pc-head">
                    ${avatar(c, 'pc-big-avatar')}
                    <div class="pc-head-info">
                        <div class="pc-k">имя</div>
                        <h2 class="pc-big-name">${esc(c.name)}</h2>
                        ${c.role === 'студент'
                            ? `<div class="pc-k">курс</div><div class="pc-v">${esc(c.course || '—')}</div>`
                            : c.role === 'преподаватель'
                                ? `<div class="pc-k">роль</div><div class="pc-v">${esc(teacherRole(c.subject))}</div>`
                                : c.role === 'персонал'
                                    ? `<div class="pc-k">должность</div><div class="pc-v">${esc(lowerFirst(c.post || '') || '—')}</div>`
                                    : `<div class="pc-k">роль</div><div class="pc-v">${esc(c.role || '—')}</div>`}
                        ${c.role === 'персонал' ? '' : `<div class="pc-v pc-big-fac">${esc((c.faculty || '').toLowerCase() || '—')}</div>`}
                    </div>
                </div>

                <section class="pc-stats">
                    ${stat('возраст', a && a.age)}
                    ${stat('проживает', home)}
                    ${stat('вид', a && a.species)}
                    ${stat('рост', (a && a.height) || (c.height ? `${c.height}${/^\d+$/.test(c.height) ? ' см' : ''}` : ''))}
                    ${stat('вес', a && a.weight)}
                </section>

                ${extras ? `<ul class="pc-extra">${extras}</ul>` : ''}

                ${anketaHTML(c, a)}
            </article>`;
    }

    /* ---------- Анкета (колонка X Техтаблицы) ---------- */

    let anketaTexts = null;      // { имя: текст анкеты }
    let anketaPromise = null;

    function loadAnketas() {
        anketaPromise = anketaPromise || RCU.cached('anketas', async () => {
            const r = await (await fetch(`${RCU.scriptUrl}?part=anketas`)).json();
            return r.anketas || {};
        }).then(t => (anketaTexts = t)).catch(() => (anketaTexts = {}));
        return anketaPromise;
    }

    // анкета персонажа; у дуэта с общей анкетой она может лежать только в строке партнёра
    function anketaOf(c) {
        if (!anketaTexts || !RCU.parseAnketa) return null;
        let text = anketaTexts[c.name];
        if (!text && c.duet && anketaTexts[c.duet]) {
            const first = c.name.split(/\s+/)[0].toLowerCase();
            if (anketaTexts[c.duet].toLowerCase().includes(first)) text = anketaTexts[c.duet];
        }
        try { return text ? RCU.parseAnketa(text, c.name, c.duet) : null; } catch (e) { return null; }
    }

    function anketaHTML(c, a) {
        const link = safeUrl(c.topicUrl)
            ? `<a class="pc-link" href="${esc(c.topicUrl)}" target="_blank" rel="noopener">Открыть тему персонажа</a>` : '';
        if (!a) {
            return `
                <section class="pc-text">
                    <h3 class="pc-section-title">биография</h3>
                    <p class="pc-soon">${anketaTexts ? 'Анкеты пока нет в таблице.' : 'Загружаем анкету…'} ${link}</p>
                </section>`;
        }
        const paras = (list) => list.map(p => `<p>${esc(p)}</p>`).join('');
        return `
            ${a.shared ? '<p class="pc-shared">общая анкета дуэта</p>' : ''}
            ${a.bio.length ? `<section class="pc-text"><h3 class="pc-section-title">биография</h3>${paras(a.bio)}</section>` : ''}
            ${a.character.length ? `<section class="pc-text"><h3 class="pc-section-title">характер</h3>${paras(a.character)}</section>` : ''}
            ${a.facts.length ? `
                <section class="pc-text">
                    <h3 class="pc-section-title">интересные факты</h3>
                    <ul class="pc-facts">${a.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
                </section>` : ''}
            ${a.interaction ? `<p class="pc-interaction"><span class="pc-k">взаимодействия</span> ${esc(a.interaction)}</p>` : ''}
            ${link ? `<p class="pc-topic">${link}</p>` : ''}`;
    }

    /* ---------- Окно большой карточки ---------- */

    const modal = document.querySelector('.pc-modal');
    const modalBody = modal && modal.querySelector('.pc-modal-body');
    let lastFocus = null;

    function openCharacter(name) {
        if (!modal || !data || !data.byName.has(name)) return;
        if (modal.hidden) lastFocus = document.activeElement;
        modalBody.innerHTML = bigCard(data.byName.get(name));
        modalBody.dataset.name = name;
        // анкеты грузятся отдельно — когда придут, перерисуем открытую карточку
        if (!anketaTexts) loadAnketas().then(() => {
            if (!modal.hidden && modalBody.dataset.name === name && modalBody.querySelector('.pc-big:not(.fc-big)')) {
                modalBody.innerHTML = bigCard(data.byName.get(name));
            }
        });
        modal.hidden = false;
        document.documentElement.classList.add('pc-open');
        requestAnimationFrame(() => modal.classList.add('is-shown'));
        modalBody.querySelector('.pc-close').focus({ preventScroll: true });
    }

    function closeCharacter() {
        if (!modal || modal.hidden) return;
        modal.classList.remove('is-shown');
        document.documentElement.classList.remove('pc-open');
        setTimeout(() => { modal.hidden = true; modalBody.innerHTML = ''; }, 250);
        if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) { closeCharacter(); return; }
            const link = e.target.closest('.pc-link[data-name]');
            if (link) openCharacter(link.dataset.name);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCharacter(); });
        window.addEventListener('hashchange', closeCharacter);
    }

    // клики по маленьким карточкам на любой странице
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.pc-card[data-name], .pc-open-char[data-name]');
        // в картотеке нажатия обрабатывает она сама (центрирование / открытие)
        if (card && !e.target.closest('.pc-modal') && !e.target.closest('.pc-file')) openCharacter(card.dataset.name);
    });

    /* ---------- Картотека: одна группа на экране ----------
       Группы (студенты / преподаватели / персонал) — отдельные «экраны», между ними
       стрелки слева и справа. Посередине — стопка карточек. По нажатию стопка
       разлетается вверх и вниз в один столбец, как картотека: у центра карточки видны
       целиком, к краям постепенно прижимаются друг к другу, пока не останется
       видно только ярлычок с буквой. Колесо мыши, перетаскивание и стрелки ↑↓
       листают картотеку; нажатие на карточку в центре открывает большую карточку. */

    const GAP = 10;          // зазор между карточками у центра, px
    const PILE = 15;         // шаг в «прижатой» части (видно только ярлычок), px
    const TAU = 1.0;         // как быстро карточки прижимаются (в карточках от центра)
    const SPREAD_MS = 650;   // длительность раскрытия / сборки

    const file = {
        groups: [],          // [{ title, list }]
        gi: 0,               // текущая группа
        root: null,
        open: false,
        spread: 0,           // 0 — стопка, 1 — раскрыта
        spreadFrom: 0, spreadTo: 0, spreadStart: 0,
        s: 0, target: 0,     // какая карточка в центре (дробное число — во время прокрутки)
        H: 100,              // шаг между карточками у центра
        raf: 0,
        busy: false,         // идёт сборка/перелистывание
    };

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    // где стоит карточка, отстоящая от центра на d карточек (d может быть дробным)
    function placeOpen(d) {
        const x = Math.abs(d);
        const H = file.H;
        let y;
        if (x <= 1) y = x * H;
        else y = H + PILE * (x - 1) + (H - PILE) * TAU * (1 - Math.exp(-(x - 1) / TAU));
        return Math.sign(d) * y;
    }

    function cardsEl() { return file.root && file.root.querySelector('.pc-file'); }

    function layout() {
        const box = cardsEl();
        if (!box) return;
        const e = ease(file.spread);
        const items = box.children;
        for (let i = 0; i < items.length; i++) {
            const d = i - file.s;
            // стопка: верхние три карточки чуть сдвинуты, остальные спрятаны под ними
            const k = Math.min(i - Math.round(file.stackTop), 3);
            const inStack = k >= 0 && k < 3;
            const cx = inStack ? k * 7 : 14, cy = inStack ? k * 7 : 14;
            const oy = placeOpen(d);
            const x = cx * (1 - e);
            const y = cy * (1 - e) + oy * e;
            const op = e + (1 - e) * (inStack ? 1 - k * 0.25 : 0);
            const el = items[i];
            el.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`;
            el.style.opacity = op.toFixed(3);
            // в стопке сверху — верхняя карточка; в раскрытой — порядок картотеки
            el.style.zIndex = e < 0.5 ? (inStack ? 100 - k : 0) : i;
            el.classList.toggle('is-center', file.open && Math.abs(d) < 0.5);
        }
    }

    function tick(now) {
        file.raf = 0;
        let moving = false;
        if (file.spread !== file.spreadTo) {
            const t = Math.min(1, (now - file.spreadStart) / SPREAD_MS);
            file.spread = file.spreadFrom + (file.spreadTo - file.spreadFrom) * t;
            if (t < 1) moving = true; else file.spread = file.spreadTo;
        }
        const diff = file.target - file.s;
        if (Math.abs(diff) > 0.001) { file.s += diff * 0.2; moving = true; } else file.s = file.target;
        layout();
        if (moving) file.raf = requestAnimationFrame(tick);
    }

    function kick() { if (!file.raf) file.raf = requestAnimationFrame(tick); }

    function animateSpread(to) {
        return new Promise(resolve => {
            file.spreadFrom = file.spread;
            file.spreadTo = to;
            file.spreadStart = performance.now();
            kick();
            setTimeout(resolve, SPREAD_MS);
        });
    }

    const group = () => file.groups[file.gi];
    const clampS = (v) => Math.max(0, Math.min(group().list.length - 1, v));

    async function openFile() {
        if (file.open || file.busy) return;
        file.open = true;
        file.root.querySelector('.pc-screen').classList.add('is-open');
        // центр — середина группы: карточки разлетаются и вверх, и вниз
        file.s = file.target = Math.floor((group().list.length - 1) / 2);
        file.stackTop = file.s;
        await animateSpread(1);
    }

    async function closeFile() {
        if (!file.open) return;
        file.open = false;
        file.root.querySelector('.pc-screen').classList.remove('is-open');
        file.stackTop = Math.round(file.s);
        await animateSpread(0);
    }

    /* ---------- Сортировка: студенты — имя / факультет / курс, преподаватели — имя / факультет ---------- */
    const SORTS = { name: 'имя', faculty: 'факультет', course: 'курс' };
    const sortState = {};   // выбранная сортировка для каждой группы (по названию)

    const byNameCmp = (a, b) => a.name.localeCompare(b.name, 'ru');
    function sorted(list, by) {
        const l = [...list];
        if (by === 'faculty') return l.sort((a, b) => facShort(a.faculty).localeCompare(facShort(b.faculty), 'ru') || byNameCmp(a, b));
        if (by === 'course') return l.sort((a, b) => ((Number(a.course) || 99) - (Number(b.course) || 99)) || byNameCmp(a, b));
        return l.sort(byNameCmp);
    }

    function renderSortBar() {
        const g = group();
        const bar = file.root.querySelector('.pc-sort');
        const options = g.sorts || [];
        bar.hidden = options.length < 2;
        const current = sortState[g.title] || 'name';
        bar.innerHTML = options.map(k => `
            <button class="pc-sort-btn${k === current ? ' is-current' : ''}" type="button" data-sort="${k}" aria-pressed="${k === current}">${SORTS[k]}</button>`).join('');
    }

    function renderGroup() {
        const g = group();
        const by = sortState[g.title] || 'name';
        const list = sorted(g.list, by);
        g.view = list;
        const stage = file.root.querySelector('.pc-stage');
        stage.querySelector('.pc-deck-name').textContent = g.title;
        stage.querySelector('.pc-deck-count').textContent = `${g.list.length} ${RCU.plural(g.list.length, 'персонаж', 'персонажа', 'персонажей')}`;
        renderSortBar();
        stage.querySelector('.pc-file').innerHTML = list.map(c => `<div class="pc-file-card">${smallCard(c, by)}</div>`).join('');
        file.root.querySelectorAll('.pc-dot').forEach((d, i) => d.classList.toggle('is-current', i === file.gi));
        file.s = file.target = 0;
        file.stackTop = 0;
        RCU.widenHeadings(stage);
        measure();
        layout();
    }

    async function switchGroup(dir) {
        if (file.busy || file.groups.length < 2) return;
        file.busy = true;
        const wasOpen = file.open;
        if (wasOpen) await closeFile();
        const stage = file.root.querySelector('.pc-stage');
        stage.classList.add(dir > 0 ? 'is-leaving-left' : 'is-leaving-right');
        await new Promise(r => setTimeout(r, 220));
        file.gi = (file.gi + dir + file.groups.length) % file.groups.length;
        renderGroup();
        stage.classList.remove('is-leaving-left', 'is-leaving-right');
        stage.classList.add(dir > 0 ? 'is-entering-right' : 'is-entering-left');
        void stage.offsetWidth;
        stage.classList.remove('is-entering-right', 'is-entering-left');
        await new Promise(r => setTimeout(r, 260));
        file.busy = false;
        if (wasOpen) openFile();
    }

    // высота экрана = видимая часть основного блока; шаг между карточками = высота карточки
    function measure() {
        if (!file.root) return;
        const scroller = document.querySelector('.main-scroll-viewport');
        const screen = file.root.querySelector('.pc-screen');
        if (scroller && screen) {
            const cs = getComputedStyle(scroller);
            const h = scroller.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 40;
            screen.style.height = `${Math.max(320, h)}px`;
        }
        const first = file.root.querySelector('.pc-file-card');
        if (first) file.H = first.offsetHeight + GAP;
    }

    async function setSort(by) {
        const g = group();
        if (file.busy || (sortState[g.title] || 'name') === by) return;
        file.busy = true;
        const wasOpen = file.open;
        if (wasOpen) await closeFile();
        sortState[g.title] = by;
        renderGroup();
        file.busy = false;
        if (wasOpen) openFile();
    }

    function bindFile(root) {
        const box = root.querySelector('.pc-file');
        root.querySelector('.pc-sort').addEventListener('click', (e) => {
            const b = e.target.closest('.pc-sort-btn');
            if (b) setSort(b.dataset.sort);
        });

        root.querySelector('.pc-arrow-prev').addEventListener('click', () => switchGroup(-1));
        root.querySelector('.pc-arrow-next').addEventListener('click', () => switchGroup(1));

        box.addEventListener('click', (e) => {
            const item = e.target.closest('.pc-file-card');
            if (!item || file.busy) return;
            if (!file.open) { openFile(); return; }
            const i = [...box.children].indexOf(item);
            if (Math.abs(i - file.s) < 0.5) openCharacter(item.querySelector('.pc-card').dataset.name);
            else { file.target = i; kick(); }
        });

        // колесо мыши
        let snapTimer = 0;
        box.addEventListener('wheel', (e) => {
            if (!file.open) return;
            e.preventDefault();
            file.target = clampS(file.target + e.deltaY / file.H);
            kick();
            clearTimeout(snapTimer);
            snapTimer = setTimeout(() => { file.target = Math.round(file.target); kick(); }, 140);
        }, { passive: false });

        // перетаскивание пальцем / мышью
        let drag = null;
        box.addEventListener('pointerdown', (e) => {
            if (!file.open) return;
            drag = { y: e.clientY, s: file.target, moved: false };
        });
        window.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dy = e.clientY - drag.y;
            if (Math.abs(dy) > 4) drag.moved = true;
            file.target = clampS(drag.s - dy / file.H);
            kick();
        });
        window.addEventListener('pointerup', () => {
            if (!drag) return;
            if (drag.moved) {
                file.target = Math.round(file.target);
                kick();
                // не считать перетаскивание нажатием на карточку
                box.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
            }
            drag = null;
        });
    }

    // стрелки клавиатуры: ←→ — группы, ↑↓ — карточки, Esc — собрать
    document.addEventListener('keydown', (e) => {
        if (!file.root || !document.body.contains(file.root) || (modal && !modal.hidden)) return;
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (e.key === 'ArrowLeft') switchGroup(-1);
        else if (e.key === 'ArrowRight') switchGroup(1);
        else if (file.open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            file.target = clampS(Math.round(file.target) + (e.key === 'ArrowDown' ? 1 : -1));
            kick();
        } else if (file.open && e.key === 'Escape') closeFile();
    });
    window.addEventListener('resize', () => { measure(); layout(); });

    RCU.openCharacter = (name) => openCharacter(name);
    RCU.smallCharacterCard = (c) => smallCard(c);
    RCU.setPublicData = (d) => { data = d; };

    RCU.pages.characters = {
        title: 'Персонажи',
        load: () => RCU.publicData(),
        render(root, d) {
            data = d;
            const SORTS_OF = { 'студент': ['name', 'faculty', 'course'], 'преподаватель': ['name', 'faculty'] };
            const groups = ROLES.map(([role, title]) => ({ title, list: d.characters.filter(c => c.role === role), sorts: SORTS_OF[role] || [] }));
            const other = d.characters.filter(c => !ROLES.some(([r]) => r === c.role));
            if (other.length) groups.push({ title: 'остальные', list: other });
            file.groups = groups.filter(g => g.list.length);
            file.gi = Math.min(file.gi, Math.max(0, file.groups.length - 1));
            file.open = false;
            file.spread = file.spreadTo = 0;
            file.busy = false;
            file.root = root;
            loadAnketas();
            if (!file.groups.length) { root.innerHTML = '<p class="dl-status">Персонажей пока нет.</p>'; return; }

            root.innerHTML = `
                <div class="pc-screen">
                    <button class="pc-arrow pc-arrow-prev" type="button" aria-label="Предыдущая группа"><span></span></button>
                    <div class="pc-stage">
                        <h2 class="pc-deck-title"><span class="pc-deck-name"></span></h2>
                        <div class="pc-deck-count"></div>
                        <div class="pc-sort" role="group" aria-label="Сортировка"></div>
                        <div class="pc-file"></div>
                        <div class="pc-hint">
                            <span class="pc-hint-closed">нажмите на стопку, чтобы раскрыть</span>
                            <button class="pc-hint-open pc-fold" type="button">собрать</button>
                        </div>
                        <div class="pc-dots">${file.groups.map(g => `<span class="pc-dot" title="${esc(g.title)}"></span>`).join('')}</div>
                    </div>
                    <button class="pc-arrow pc-arrow-next" type="button" aria-label="Следующая группа"><span></span></button>
                </div>`;
            root.querySelector('.pc-fold').addEventListener('click', () => closeFile());
            bindFile(root);
            renderGroup();
            // после загрузки шрифтов и картинок и после того, как блок раздела
            // принял форму прямоугольника (≈0,7 с), высота экрана и карточек меняется
            requestAnimationFrame(() => { measure(); layout(); });
            setTimeout(() => { measure(); layout(); }, 800);
            setTimeout(() => { measure(); layout(); }, 3800);   // после заставки при первом открытии
        },
    };
})();
