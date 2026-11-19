// Публичный сайт, страница «Линейка»: персонажи по росту, как на полицейской линейке.
// Каждый — столбик в цвет факультета высотой по росту (в одном масштабе от пола), сверху аватар.
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

    const state = { q: '', role: '', fac: '' };
    const ROLES = [['', 'все'], ['студент', 'студенты'], ['преподаватель', 'преподаватели'], ['персонал', 'персонал']];

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
        const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
        const qs = RCU.queryVariants ? RCU.queryVariants(state.q) : [norm(state.q).trim()].filter(Boolean);
        const all = d.characters.map(c => ({ c, cm: heightOf(c) }));
        const people = all
            .filter(p => p.cm)
            .filter(p => !state.role || p.c.role === state.role)
            .filter(p => !state.fac || p.c.faculty === state.fac)
            .filter(p => !qs.length || qs.some(q => norm(p.c.name).includes(q)))
            .sort((a, b) => a.cm - b.cm || a.c.name.localeCompare(b.c.name, 'ru'));
        const unknown = all.filter(p => !p.cm).length;
        root.querySelector('.lu-body').innerHTML = chartHTML(people)
            + (unknown ? `<p class="lu-note">Рост не указан у ${unknown} ${RCU.plural(unknown, 'персонажа', 'персонажей', 'персонажей')}.</p>` : '');
        root.querySelectorAll('.lu-role').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === state.role)));
    }

    RCU.pages.lineup = {
        title: 'Линейка',
        load: async () => {
            const d = await RCU.publicData();
            anketas = await loadAnketas();
            return d;
        },
        render(root, d) {
            if (RCU.setPublicData) RCU.setPublicData(d);
            const faculties = [...new Set(d.characters.map(c => c.faculty).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
            root.innerHTML = `
                <div class="lu-tools">
                    <input class="dl-search-input lu-search" type="search" autocomplete="off" placeholder="поиск по имени" aria-label="Поиск по имени" value="${esc(state.q)}">
                    <div class="lu-roles" role="group" aria-label="Роль">
                        ${ROLES.map(([r, t]) => `<button class="tg-toggle lu-role" type="button" data-role="${r}" aria-pressed="false">${t}</button>`).join('')}
                    </div>
                    <select class="lu-fac" aria-label="Факультет">
                        <option value="">все факультеты</option>
                        ${faculties.map(f => `<option value="${esc(f)}"${f === state.fac ? ' selected' : ''}>${esc(shortFac(f))}</option>`).join('')}
                    </select>
                </div>
                <div class="lu-body"></div>`;
            root.querySelector('.lu-search').addEventListener('input', (e) => { state.q = e.target.value; render(root, d); });
            root.querySelector('.lu-roles').addEventListener('click', (e) => {
                const b = e.target.closest('.lu-role');
                if (b) { state.role = b.dataset.role; render(root, d); }
            });
            root.querySelector('.lu-fac').addEventListener('change', (e) => { state.fac = e.target.value; render(root, d); });
            render(root, d);
        },
    };
})();
