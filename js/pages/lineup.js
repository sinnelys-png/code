// Публичный сайт, страница «Линейка»: персонажи по росту, как на полицейской линейке.
// Каждый — арка: аватар сверху и полоса цвета факультета той же ширины под ним, высотой по росту
// (в одном масштабе от пола). Линейка — во всю ширину основного блока (fullBleed), по высоте — как была.
// Рост — из Техтаблицы (колонка I), а если там пусто — из анкеты (js/pages/anketa.js).
// Поиск по имени и фильтры: роль, факультет. Нажатие на аватар открывает анкету.
(() => {
    const { esc, safeUrl } = RCU;

    const CM_FROM = 0;           // линейка от пола
    const STEP = 10;             // деления через 10 см

    let anketas = null;
    const loadAnketas = () => RCU.cached('anketas', async () => {
        const r = await (await fetch(`${RCU.scriptUrl}?part=anketas`)).json();
        return r.anketas || {};
    }).catch(() => ({}));

    // «187», «187 см», «1,87 м» → 187
    function cmOf(v) {
        const t = String(v || '').replace(',', '.');
        const m = t.match(/(\d+(?:\.\d+)?)/);
        if (!m) return 0;
        let n = Number(m[1]);
        if (n < 3) n *= 100;                 // в метрах
        return n >= 50 && n <= 300 ? Math.round(n) : 0;
    }

    function heightOf(c) {
        const own = cmOf(c.height);
        if (own) return own;
        if (!anketas || !RCU.parseAnketa || !anketas[c.name]) return 0;
        try {
            const a = RCU.parseAnketa(anketas[c.name], c.name, c.duet);
            return a ? cmOf(a.height) : 0;
        } catch (e) { return 0; }
    }

    const facStyle = (c) => {
        const m = RCU.facultyAttrs(c.faculty, c.role).attrs.match(/style="([^"]*)"/);
        return m ? ` style="${m[1]}"` : '';
    };
    const shortFac = (f) => String(f || '').replace(/^факультет\s+/i, '').replace(/\s+факультет$/i, '').toLowerCase();

    // фильтры — как в «Отношениях»: выпадающие меню с галочками; пустой выбор — без фильтра
    const state = { people: new Set(), roles: new Set(), faculties: new Set(), courses: new Set(), activities: new Set() };
    const ROLE_TITLES = [['студент', 'студенты'], ['преподаватель', 'преподаватели'], ['персонал', 'персонал']];
    const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

    function drop(group, title, items, { search = false, empty = '' } = {}) {
        const set = state[group];
        return `
            <div class="rg-drop" data-group="${group}">
                <button class="rg-drop-btn" type="button" aria-expanded="false" aria-haspopup="true">
                    ${title}<span class="rg-caret" aria-hidden="true">▾</span>
                </button>
                <div class="rg-drop-panel" hidden>
                    ${search ? '<input class="rg-search" type="search" placeholder="найти" autocomplete="off" aria-label="Найти персонажа">' : ''}
                    <div class="rg-drop-list">
                        ${items.length ? items.map(it => `
                            <label class="rg-opt" data-text="${esc(norm(it.label))}">
                                <input class="rg-check" type="checkbox" data-group="${group}" value="${esc(it.value)}"${set.has(String(it.value)) ? ' checked' : ''}>
                                ${it.ava || ''}
                                <span class="rg-opt-label">${esc(it.label)}</span>
                            </label>`).join('') : `<p class="rg-soon">${empty}</p>`}
                    </div>
                    ${items.length ? '<div class="rg-drop-foot"><button class="rg-drop-none" type="button">очистить</button></div>' : ''}
                </div>
            </div>`;
    }

    const avaOf = (c) => safeUrl(c.avatar)
        ? `<img class="rg-ava rg-ava--small" src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="rg-ava rg-ava--small rg-ava--empty">${esc(c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}</span>`;

    function filtersHTML(d) {
        const chars = [...d.characters].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        const faculties = [...new Set(chars.map(c => c.faculty).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
        const courses = [...new Set(chars.map(c => String(c.course || '')).filter(Boolean))].sort((a, b) => a - b);
        const activities = [...new Set(chars.flatMap(c => c.activities || []))];
        return `
            <div class="rg-filters lu-filters">
                ${drop('people', 'имя', chars.map(c => ({ value: c.name, label: c.name, ava: avaOf(c) })), { search: true })}
                ${drop('roles', 'роль', ROLE_TITLES.map(([r, t]) => ({ value: r, label: t })))}
                ${drop('faculties', 'факультет', faculties.map(f => ({ value: f, label: shortFac(f) })))}
                ${drop('courses', 'курс', courses.map(c => ({ value: c, label: `${c} курс` })))}
                ${drop('activities', 'подроль', activities.map(a => ({ value: a, label: a })), { empty: 'Появятся вместе со страницей подролей.' })}
                <button class="rg-reset" type="button">сброс</button>
            </div>`;
    }

    const passes = (c) =>
        (!state.people.size || state.people.has(c.name))
        && (!state.roles.size || state.roles.has(c.role))
        && (!state.faculties.size || state.faculties.has(c.faculty))
        && (!state.courses.size || state.courses.has(String(c.course || '')))
        && (!state.activities.size || (c.activities || []).some(a => state.activities.has(a)));

    function chartHTML(people) {
        if (!people.length) return '<p class="pc-soon lu-empty">Никого не нашлось.</p>';
        const max = Math.max(...people.map(p => p.cm));
        const top = Math.ceil((max + 15) / STEP) * STEP;           // запас сверху под аватар
        const marks = [];
        for (let cm = STEP * Math.ceil(CM_FROM / STEP); cm <= top; cm += STEP) marks.push(cm);
        const pct = (cm) => `${((cm - CM_FROM) / (top - CM_FROM)) * 100}%`;
        return `
            <div class="lu-chart">
                <div class="lu-grid" aria-hidden="true">
                    ${marks.map(cm => `<div class="lu-mark${cm % 50 === 0 ? ' is-major' : ''}" style="bottom:${pct(cm)}"><span>${cm}</span></div>`).join('')}
                </div>
                <div class="lu-row">
                    ${people.map(p => `
                        <button class="lu-person pc-open-char" type="button" data-name="${esc(p.c.name)}"${facStyle(p.c)}
                            title="${esc(p.c.name)} — ${p.cm} см">
                            <span class="lu-stand">
                                <span class="lu-figure" style="height:${pct(p.cm)}">
                                    <span class="lu-cm">${p.cm}</span>
                                    ${safeUrl(p.c.avatar)
                                        ? `<img class="lu-ava" src="${esc(p.c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
                                        : `<span class="lu-ava lu-ava--empty">${esc(p.c.name.charAt(0))}</span>`}
                                    <span class="lu-bar"></span>
                                </span>
                            </span>
                            <span class="lu-name">${esc(p.c.name)}</span>
                        </button>`).join('')}
                </div>
            </div>`;
    }

    function render(root, d) {
        const all = d.characters.map(c => ({ c, cm: heightOf(c) }));
        const people = all
            .filter(p => p.cm && passes(p.c))
            .sort((a, b) => a.cm - b.cm || a.c.name.localeCompare(b.c.name, 'ru'));
        const unknown = all.filter(p => !p.cm).length;
        root.querySelector('.lu-body').innerHTML = chartHTML(people)
            + (unknown ? `<p class="lu-note">Рост не указан у ${unknown} ${RCU.plural(unknown, 'персонажа', 'персонажей', 'персонажей')}.</p>` : '');
        // выбранный фильтр — кнопка выделена рамкой
        root.querySelectorAll('.rg-drop').forEach(dr => dr.classList.toggle('is-active', state[dr.dataset.group].size > 0));
    }

    RCU.pages.lineup = {
        title: 'Линейка',
        fullBleed: true,      // во всю ширину основного блока (без боковых полей)
        load: async () => {
            const d = await RCU.publicData();
            anketas = await loadAnketas();
            return d;
        },
        render(root, d) {
            if (RCU.setPublicData) RCU.setPublicData(d);
            root.innerHTML = `<div class="lu-page">${filtersHTML(d)}<div class="lu-body"></div></div>`;

            // выпадающие меню: открыть / закрыть, галочки, поиск по имени, «очистить», «сброс»
            const drops = () => root.querySelectorAll('.rg-drop');
            const closeDrops = (except) => drops().forEach(dr => {
                if (dr === except) return;
                dr.querySelector('.rg-drop-panel').hidden = true;
                dr.querySelector('.rg-drop-btn').setAttribute('aria-expanded', 'false');
            });
            const toggleDrop = (dr) => {
                const panel = dr.querySelector('.rg-drop-panel');
                const open = panel.hidden;
                closeDrops(dr);
                panel.hidden = !open;
                dr.querySelector('.rg-drop-btn').setAttribute('aria-expanded', String(open));
                if (!open) return;
                panel.style.left = ''; panel.style.right = '';
                if (panel.getBoundingClientRect().right > innerWidth - 8) { panel.style.left = 'auto'; panel.style.right = '0'; }
                const search = panel.querySelector('.rg-search');
                if (search) search.focus({ preventScroll: true });
            };
            const filters = root.querySelector('.lu-filters');
            filters.addEventListener('change', (e) => {
                const box = e.target.closest('.rg-check');
                if (!box) return;
                box.checked ? state[box.dataset.group].add(box.value) : state[box.dataset.group].delete(box.value);
                render(root, d);
            });
            filters.addEventListener('input', (e) => {
                const input = e.target.closest('.rg-search');
                if (!input) return;
                // и при неверной раскладке
                const qs = RCU.queryVariants ? RCU.queryVariants(input.value) : [norm(input.value).trim()].filter(Boolean);
                input.closest('.rg-drop-panel').querySelectorAll('.rg-opt')
                    .forEach(o => { o.hidden = !!qs.length && !qs.some(q => o.dataset.text.includes(q)); });
            });
            filters.addEventListener('click', (e) => {
                const btn = e.target.closest('.rg-drop-btn');
                if (btn) { toggleDrop(btn.closest('.rg-drop')); return; }
                const none = e.target.closest('.rg-drop-none');
                if (none) {
                    const dr = none.closest('.rg-drop');
                    state[dr.dataset.group].clear();
                    dr.querySelectorAll('.rg-check').forEach(b => { b.checked = false; });
                    render(root, d);
                    return;
                }
                if (e.target.closest('.rg-reset')) {
                    Object.values(state).forEach(set => set.clear());
                    root.querySelectorAll('.rg-check').forEach(b => { b.checked = false; });
                    closeDrops();
                    render(root, d);
                }
            });
            document.addEventListener('click', (e) => { if (!e.target.closest('.lu-filters .rg-drop')) closeDrops(); });

            // ряд листается вбок и колёсиком мыши, и перетаскиванием с зажатой левой кнопкой
            // (ряд перерисовывается при поиске и фильтрах — слушаем на постоянном контейнере)
            const body = root.querySelector('.lu-body');
            const rowOf = (t) => t.closest && t.closest('.lu-row');
            body.addEventListener('wheel', (e) => {
                const row = rowOf(e.target);
                if (!row || row.scrollWidth <= row.clientWidth) return;
                const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                const atStart = row.scrollLeft <= 0 && delta < 0;
                const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 && delta > 0;
                if (atStart || atEnd) return;               // дошли до края — страница листается как обычно
                e.preventDefault();
                row.scrollLeft += delta * (e.deltaMode === 1 ? 32 : 1);
            }, { passive: false });

            let drag = null;
            body.addEventListener('pointerdown', (e) => {
                const row = rowOf(e.target);
                if (!row || e.pointerType !== 'mouse' || e.button !== 0) return;
                drag = { row, x: e.clientX, left: row.scrollLeft, moved: false };
            });
            window.addEventListener('pointermove', (e) => {
                if (!drag) return;
                const dx = e.clientX - drag.x;
                if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; drag.row.classList.add('is-dragging'); }
                if (drag.moved) drag.row.scrollLeft = drag.left - dx;
            });
            window.addEventListener('pointerup', () => {
                if (!drag) return;
                const moved = drag.moved;
                drag.row.classList.remove('is-dragging');
                drag = null;
                // после перетаскивания отпускание не открывает анкету
                if (moved) window.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
            });
            render(root, d);
        },
    };
})();
