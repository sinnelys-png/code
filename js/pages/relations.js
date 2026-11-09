// Публичный сайт, страница «Отношения»: граф взаимоотношений персонажей.
// Данные — таблица взаимоотношений (Apps Script, ?part=relations): легенда (тип → цвет),
// люди (по колонкам таблицы) и связи «кто → к кому, тип, ещё не обсуждалось?, комментарий».
// Персонажи стоят по кругу, сгруппированные по факультетам; связи — дуги через центр.
// Фильтры (выпадающие меню): типы отношений, роли, факультеты, курсы, подроли
// (когда появятся) и персонажи — выбранные персонажи и те, с кем у них есть отношения.
// Нажатие на персонажа оставляет только его связи и показывает их списком под графом.
(() => {
    const { esc, safeUrl } = RCU;

    const R = 360;                 // радиус круга с аватарами (viewBox 1000×1000, центр в 0,0)
    const AVA = 15;                // радиус аватара
    // по умолчанию включены «сильные» отношения — иначе граф превращается в клубок
    const DEFAULT_TYPES = ['любовь', 'симпатия', 'дружба', 'ненависть', 'страх'];
    const ROLE_TITLES = [['студент', 'студенты'], ['преподаватель', 'преподаватели'], ['персонал', 'персонал']];

    const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
    const facKey = (t) => norm(t).replace(/факультет/g, '').trim();

    let model = null;      // { legend, people, links, groups }
    let state = null;      // выбранные фильтры и персонаж
    let root = null;

    /* ---------- Цвета связей: исходные цвета легенды, но различимые на фоне темы ---------- */

    function rgbOf(hex) {
        const n = parseInt(String(hex).replace('#', ''), 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    const toHex = (rgb) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    function lum(rgb) {
        return rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
            .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    }
    const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

    // чёрный «страх» на тёмном фоне или светлое «не знакомы» на бежевом — подмешиваем белый/тёмный,
    // пока цвет не станет заметным
    function visibleOn(hex, light) {
        const bg = rgbOf(light ? '#f2e9da' : '#022a42');
        const to = light ? [20, 40, 60] : [255, 255, 255];
        let c = rgbOf(hex);
        for (let k = 0; k < 10 && contrast(c, bg) < 2.2; k++) c = c.map((v, i) => v + (to[i] - v) * 0.18);
        return toHex(c);
    }
    const isLight = () => document.documentElement.dataset.theme === 'light';

    /* ---------- Данные ---------- */

    async function loadRelations() {
        return RCU.cached('relations', async () => {
            const r = await (await fetch(`${RCU.scriptUrl}?part=relations`)).json();
            if (!r || !Array.isArray(r.legend)) throw new Error('Скрипт ещё не отдаёт отношения');
            return r;
        });
    }

    function buildModel(rel, d) {
        const byNorm = new Map(d.characters.map(c => [norm(c.name), c]));
        const facultyInfoTitles = (d.facultyInfo || []).map(f => f.title);

        const people = rel.people.map((p, i) => {
            const c = byNorm.get(norm(p.name));
            const group = p.group || '';
            const sheetRole = /преподав/i.test(group) ? 'преподаватель' : /персонал/i.test(group) ? 'персонал' : 'студент';
            const role = (c && c.role) || sheetRole;
            const faculty = (c && c.faculty) || (sheetRole === 'студент' ? group : '');
            return {
                i,
                name: (c && c.name) || p.name,
                inTech: !!c,
                role,
                faculty,
                course: String((c && c.course) || p.course || '').replace(/\D+/g, ''),
                avatar: c && safeUrl(c.avatar) ? c.avatar : '',
                activities: (c && c.activities) || [],     // подроли — появятся вместе со страницей подролей
                group: sheetRole === 'студент' ? (faculty || group) : (sheetRole === 'преподаватель' ? 'преподаватели' : 'персонал'),
            };
        });

        // группы по кругу — в порядке таблицы
        const groups = [];
        people.forEach(p => {
            let g = groups.find(x => facKey(x.title) === facKey(p.group));
            if (!g) groups.push(g = { title: p.group, people: [] });
            g.people.push(p);
        });

        const facultyList = [...new Set(people.map(p => p.faculty).filter(Boolean))]
            .sort((a, b) => {
                const ia = facultyInfoTitles.findIndex(t => facKey(t) === facKey(a));
                const ib = facultyInfoTitles.findIndex(t => facKey(t) === facKey(b));
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            });
        // курсов всего 8: показываем все, даже если на 7 и 8 пока никого нет
        const courses = ['1', '2', '3', '4', '5', '6', '7', '8'];

        return { legend: rel.legend, people, links: rel.links, groups, facultyList, courses };
    }

    /* ---------- Фильтры ---------- */

    function freshState() {
        return {
            faculties: new Set(),        // пусто — все
            roles: new Set(),
            courses: new Set(),
            activities: new Set(),
            types: new Set(model.legend.map((l, i) => (DEFAULT_TYPES.includes(norm(l.name)) ? i : -1)).filter(i => i >= 0)),
            people: new Set(),           // выбранные персонажи (номера); пусто — все
            selected: -1,
        };
    }

    function personVisible(p) {
        if (state.faculties.size && !state.faculties.has(p.faculty)) return false;
        if (state.roles.size && !state.roles.has(p.role)) return false;
        if (state.courses.size && !(p.role === 'студент' && state.courses.has(p.course))) return false;
        if (state.activities.size && !p.activities.some(a => state.activities.has(a))) return false;
        return true;
    }

    // кто на графе: прошедшие фильтры; если выбраны персонажи — они сами и те,
    // с кем у них есть отношения выбранных типов
    function visibleSet() {
        const base = new Set(model.people.filter(personVisible).map(p => p.i));
        if (!state.people.size) return base;
        const vis = new Set(state.people);
        model.links.forEach(([a, b, t]) => {
            if (!state.types.has(t)) return;
            if (state.people.has(a) && base.has(b)) vis.add(b);
            if (state.people.has(b) && base.has(a)) vis.add(a);
        });
        return vis;
    }

    const shortFac = (t) => String(t || '').replace(/^факультет\s+/i, '').replace(/\s+факультет$/i, '').toLowerCase();

    // маленький аватар для списков (без картинки — инициалы)
    function avaHTML(p, cls = 'rg-ava') {
        return p.avatar
            ? `<img class="${cls}" src="${esc(p.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<span class="${cls} rg-ava--empty">${esc(p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join(''))}</span>`;
    }

    // выпадающее меню фильтра: кнопка с названием и счётчиком, список с галочками
    function drop(group, title, items, { search = false, empty = '', types = false } = {}) {
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
                            <label class="rg-opt" data-text="${esc(norm(it.text || it.label))}">
                                <input class="rg-check" type="checkbox" data-group="${group}" value="${esc(it.value)}"${set.has(it.key ?? it.value) ? ' checked' : ''}>
                                ${it.dot ? `<span class="rg-dot" style="background:${esc(it.dot)}"></span>` : ''}
                                ${it.ava || ''}
                                <span class="rg-opt-label">${esc(it.label)}</span>
                                ${it.meta ? `<span class="rg-opt-meta">${esc(it.meta)}</span>` : ''}
                            </label>`).join('') : `<p class="rg-soon">${empty}</p>`}
                    </div>
                    ${items.length ? `
                        <div class="rg-drop-foot">
                            ${types ? '<button class="rg-drop-all" type="button">все</button>' : ''}
                            <button class="rg-drop-none" type="button">${types ? 'ничего' : 'очистить'}</button>
                        </div>` : ''}
                </div>
            </div>`;
    }

    function filtersHTML() {
        const light = isLight();
        const allActivities = [...new Set(model.people.flatMap(p => p.activities))];
        const peopleSorted = [...model.people].sort((x, y) => x.name.localeCompare(y.name, 'ru'));
        return `
            <div class="rg-filters">
                ${drop('people', 'имя', peopleSorted.map(p => ({
                    value: p.i, key: p.i, label: p.name, ava: avaHTML(p, 'rg-ava rg-ava--small'),
                    text: p.name,
                })), { search: true })}
                ${drop('roles', 'роль', ROLE_TITLES.map(([r, t]) => ({ value: r, label: t })))}
                ${drop('faculties', 'факультет', model.facultyList.map(f => ({ value: f, label: shortFac(f) })))}
                ${drop('courses', 'курс', model.courses.map(c => ({ value: c, label: `${c} курс` })))}
                ${drop('activities', 'подроль', allActivities.map(a => ({ value: a, label: a })),
                    { empty: 'Появятся вместе со страницей подролей.' })}
                ${drop('types', 'отношение', model.legend.map((l, i) => ({ value: i, key: i, label: l.name.toLowerCase(), dot: visibleOn(l.color, light) })), { types: true })}
                <button class="rg-reset" type="button">сброс</button>
            </div>`;
    }

    // выбранный фильтр — кнопка выделена рамкой (у «отношения» — если включены не все типы)
    function updateCounts() {
        root.querySelectorAll('.rg-drop').forEach(d => {
            const g = d.dataset.group;
            const n = state[g].size;
            d.classList.toggle('is-active', g === 'types' ? n !== model.legend.length : n > 0);
        });
    }

    function closeDrops(except) {
        if (!root) return;
        root.querySelectorAll('.rg-drop').forEach(d => {
            if (d === except) return;
            d.querySelector('.rg-drop-panel').hidden = true;
            d.querySelector('.rg-drop-btn').setAttribute('aria-expanded', 'false');
        });
    }

    function toggleDrop(d) {
        const panel = d.querySelector('.rg-drop-panel');
        const open = panel.hidden;
        closeDrops(d);
        panel.hidden = !open;
        d.querySelector('.rg-drop-btn').setAttribute('aria-expanded', String(open));
        if (!open) return;
        // не вылезать за правый край экрана
        panel.style.left = ''; panel.style.right = '';
        const r = panel.getBoundingClientRect();
        if (r.right > innerWidth - 8) { panel.style.left = 'auto'; panel.style.right = '0'; }
        const search = panel.querySelector('.rg-search');
        if (search) search.focus({ preventScroll: true });
    }

    /* ---------- Граф ---------- */

    function layout(visible) {
        // по кругу — группами, между группами небольшой зазор
        const groups = model.groups.map(g => ({ ...g, people: g.people.filter(p => visible.has(p.i)) })).filter(g => g.people.length);
        const n = groups.reduce((s, g) => s + g.people.length, 0);
        const gap = groups.length > 1 ? 1.4 : 0;                 // зазор между группами — в «местах»
        const slots = n + gap * groups.length;
        const pos = new Map();
        const arcs = [];
        let k = 0;
        groups.forEach(g => {
            const from = k;
            g.people.forEach(p => {
                const a = (k + 0.5) / slots * Math.PI * 2 - Math.PI / 2;
                pos.set(p.i, { x: Math.cos(a) * R, y: Math.sin(a) * R, a });
                k += 1;
            });
            arcs.push({ title: g.title, from: from / slots * Math.PI * 2 - Math.PI / 2, to: k / slots * Math.PI * 2 - Math.PI / 2 });
            k += gap;
        });
        return { pos, arcs, slots };
    }

    function arcPath(r, a0, a1) {
        const p0 = [Math.cos(a0) * r, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
        const large = a1 - a0 > Math.PI ? 1 : 0;
        return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 ${large} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    }

    // дуга связи: из A в B через точку ближе к центру; встречные связи разного типа — по разные стороны
    function linkPath(a, b, side) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        let cx = mx * 0.25, cy = my * 0.25;
        if (side) {
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
            cx += -dy / len * 14 * side; cy += dx / len * 14 * side;
        }
        return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }

    function graphSVG() {
        const visible = visibleSet();
        const { pos, arcs } = layout(visible);
        const light = isLight();
        const colors = model.legend.map(l => visibleOn(l.color, light));
        const sel = state.selected;

        // связи: пара персонажей → одна линия, если отношение взаимное и одинаковое, иначе две
        const pairs = new Map();
        model.links.forEach(l => {
            const [from, to, type] = l;
            if (!visible.has(from) || !visible.has(to) || !state.types.has(type)) return;
            if (sel >= 0 && from !== sel && to !== sel) return;
            if (state.people.size && !state.people.has(from) && !state.people.has(to)) return;
            const key = from < to ? `${from}-${to}` : `${to}-${from}`;
            const p = pairs.get(key) || {};
            p[from < to ? 'ab' : 'ba'] = l;
            pairs.set(key, p);
        });

        const paths = [];
        pairs.forEach(({ ab, ba }) => {
            const draw = (l, side, mutual) => {
                const [from, to, type, pending] = l;
                paths.push(`<path class="rg-link${pending ? ' is-pending' : ''}${mutual ? ' is-mutual' : ''}" data-from="${from}" data-to="${to}"
                    d="${linkPath(pos.get(from), pos.get(to), side)}" stroke="${colors[type]}" />`);
            };
            if (ab && ba && ab[2] === ba[2] && ab[3] === ba[3]) draw(ab, 0, true);
            else { if (ab) draw(ab, ab && ba ? 1 : 0); if (ba) draw(ba, ab && ba ? 1 : 0); }
        });

        const connected = new Set();
        if (sel >= 0) pairs.forEach(({ ab, ba }) => [ab, ba].filter(Boolean).forEach(l => { connected.add(l[0]); connected.add(l[1]); }));

        const nodes = model.people.filter(p => visible.has(p.i)).map(p => {
            const { x, y, a } = pos.get(p.i);
            const fac = RCU.facultyAttrs(p.faculty).attrs.match(/--fac-main:([^;"]+)/);
            const ring = fac ? fac[1] : 'var(--gold-55)';
            const deg = a * 180 / Math.PI;
            const flip = deg > 90 && deg < 270;
            const dim = sel >= 0 && p.i !== sel && !connected.has(p.i);
            const initials = p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
            return `
                <g class="rg-node${p.i === sel ? ' is-selected' : ''}${dim ? ' is-dim' : ''}" data-i="${p.i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(p.name)}">
                    <circle class="rg-ava-bg" r="${AVA + 2}" style="stroke:${esc(ring)}" />
                    ${p.avatar
                        ? `<image href="${esc(p.avatar)}" x="${-AVA}" y="${-AVA}" width="${AVA * 2}" height="${AVA * 2}" clip-path="url(#rg-clip)" preserveAspectRatio="xMidYMid slice" />`
                        : `<text class="rg-initials" y="4">${esc(initials)}</text>`}
                    <text class="rg-name" transform="rotate(${flip ? deg - 180 : deg})" x="${flip ? -(AVA + 7) : AVA + 7}" y="3.5" text-anchor="${flip ? 'end' : 'start'}">${esc(p.name)}</text>
                </g>`;
        }).join('');

        const groupArcs = arcs.map(g => {
            const fac = RCU.facultyAttrs(g.title).attrs.match(/--fac-main:([^;"]+)/);
            return `<path class="rg-group" d="${arcPath(R - AVA - 10, g.from + 0.01, g.to - 0.01)}" style="stroke:${esc(fac ? fac[1] : 'var(--gold-55)')}"><title>${esc(g.title)}</title></path>`;
        }).join('');

        return `
            <svg class="rg-svg${sel >= 0 ? ' has-selection' : ''}" viewBox="${state.view.join(' ')}" aria-label="Граф отношений">
                <defs><clipPath id="rg-clip" clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5" /></clipPath></defs>
                <rect class="rg-bg" x="-2000" y="-2000" width="4000" height="4000" />
                ${groupArcs}
                <g class="rg-links">${paths.join('')}</g>
                <g class="rg-nodes">${nodes}</g>
            </svg>`;
    }

    /* ---------- Список связей выбранного персонажа ---------- */

    // имя персонажа: если у него есть анкета — открывает её
    const nameHTML = (p, cls) => p.inTech
        ? `<button class="${cls} pc-open-char" type="button" data-name="${esc(p.name)}" title="Открыть анкету">${esc(p.name)}</button>`
        : `<span class="${cls}">${esc(p.name)}</span>`;

    // отношения одного направления, сгруппированные по типу:
    //   любовь:
    //     Имя Фамилия — описание
    function groupedHTML(links, otherOf) {
        if (!links.length) return '<p class="rg-empty">тут ничего нет</p>';
        const done = links.filter(l => !l[3]);
        const pending = links.filter(l => l[3]);
        return `
            ${done.length ? byTypeHTML(done, otherOf) : ''}
            ${pending.length ? `
                <div class="rg-pending-block">
                    <h5 class="rg-pending-title">ещё не обсуждалось</h5>
                    ${byTypeHTML(pending, otherOf)}
                </div>` : ''}`;
    }

    function byTypeHTML(links, otherOf) {
        const light = isLight();
        const byType = new Map();
        links.forEach(l => {
            if (!byType.has(l[2])) byType.set(l[2], []);
            byType.get(l[2]).push(l);
        });
        return [...byType.keys()].sort((x, y) => x - y).map(type => {
            const lg = model.legend[type];
            const items = byType.get(type)
                .sort((x, y) => model.people[otherOf(x)].name.localeCompare(model.people[otherOf(y)].name, 'ru'))
                .map(l => {
                    const other = model.people[otherOf(l)];
                    const note = l[4];
                    return `
                        <li class="rg-item">
                            ${avaHTML(other)}
                            <div class="rg-item-body">
                                <button class="rg-person" type="button" data-i="${other.i}" title="Показать отношения ${esc(other.name)}">${esc(other.name)}</button>
                                ${note ? `<p class="rg-note">${esc(note)}</p>` : ''}
                            </div>
                        </li>`;
                }).join('');
            return `
                <details class="rg-type-group" open style="--type:${esc(visibleOn(lg.color, light))}">
                    <summary class="rg-type-title"><span>${esc(lg.name.toLowerCase())}</span></summary>
                    <ul class="rg-list">${items}</ul>
                </details>`;
        }).join('');
    }

    function detailsHTML() {
        const sel = state.selected;
        if (sel < 0) return '<p class="rg-hint">Нажмите на персонажа, чтобы увидеть только его отношения и комментарии к ним.</p>';
        const p = model.people[sel];
        const out = model.links.filter(l => l[0] === sel && state.types.has(l[2]));
        const inc = model.links.filter(l => l[1] === sel && state.types.has(l[2]));
        return `
            <h3 class="rg-details-name">${nameHTML(p, 'rg-details-link')}</h3>
            <div class="rg-columns">
                <section>
                    <h4 class="pc-section-title">${esc(p.name)} → другие</h4>
                    ${groupedHTML(out, l => l[1])}
                </section>
                <section>
                    <h4 class="pc-section-title">другие → ${esc(p.name)}</h4>
                    ${groupedHTML(inc, l => l[0])}
                </section>
            </div>`;
    }

    /* ---------- Отрисовка и события ---------- */

    function draw() {
        root.querySelector('.rg-filters-wrap').innerHTML = filtersHTML();
        drawGraph();
    }

    // линии каждого персонажа — для быстрой подсветки при наведении
    let linksByNode = new Map();

    function drawGraph() {
        const stage = root.querySelector('.rg-stage');
        stage.innerHTML = graphSVG();
        linksByNode = new Map();
        stage.querySelectorAll('.rg-link').forEach(l => {
            [l.dataset.from, l.dataset.to].forEach(i => {
                if (!linksByNode.has(i)) linksByNode.set(i, []);
                linksByNode.get(i).push(l);
            });
        });
        // два слоя подсветки поверх графа (пока один проявляется, другой гаснет)
        stage.insertAdjacentHTML('beforeend', [0, 1].map(() => `
            <div class="rg-hot" aria-hidden="true">
                <svg class="rg-hot-svg" viewBox="${state.view.join(' ')}"><g></g></svg>
            </div>`).join(''));
        stage.dispatchEvent(new Event('rg:redraw'));
        root.querySelector('.rg-details').innerHTML = detailsHTML();
        updateCounts();
        // «показать всех» — в углу графа, когда выбран персонаж или стоит фильтр по именам
        root.querySelector('.rg-clear').hidden = state.selected < 0 && !state.people.size;
    }

    function select(i) {
        state.selected = state.selected === i ? -1 : i;
        drawGraph();
    }

    // масштаб и сдвиг — через viewBox
    function zoom(factor, cx, cy) {
        const [x, y, w, h] = state.view;
        const nw = Math.min(1400, Math.max(250, w * factor)), nh = nw * h / w;
        const px = cx == null ? x + w / 2 : cx, py = cy == null ? y + h / 2 : cy;
        state.view = [px - (px - x) * nw / w, py - (py - y) * nh / h, nw, nh];
        setView();
    }

    function setView() {
        root.querySelectorAll('.rg-stage svg').forEach(svg => svg.setAttribute('viewBox', state.view.join(' ')));
    }

    function svgPoint(svg, e) {
        const r = svg.getBoundingClientRect();
        const [x, y, w, h] = state.view;
        return [x + (e.clientX - r.left) / r.width * w, y + (e.clientY - r.top) / r.height * h];
    }

    function bind() {
        const numeric = (g) => g === 'types' || g === 'people';
        const afterFilter = (group) => {
            // в фильтре «имя» выбран один персонаж — сразу его подробные отношения
            if (group === 'people') state.selected = state.people.size === 1 ? [...state.people][0] : -1;
            if (state.selected >= 0 && !visibleSet().has(state.selected)) state.selected = -1;
            drawGraph();
        };

        // галочки в меню фильтров
        root.addEventListener('change', (e) => {
            const box = e.target.closest('.rg-check');
            if (!box) return;
            const g = box.dataset.group;
            const v = numeric(g) ? Number(box.value) : box.value;
            box.checked ? state[g].add(v) : state[g].delete(v);
            afterFilter(g);
        });
        // поиск персонажа в меню
        root.addEventListener('input', (e) => {
            const input = e.target.closest('.rg-search');
            if (!input) return;
            const q = norm(input.value);
            input.closest('.rg-drop-panel').querySelectorAll('.rg-opt')
                .forEach(o => { o.hidden = !!q && !o.dataset.text.includes(q); });
        });

        root.addEventListener('click', (e) => {
            const btn = e.target.closest('.rg-drop-btn');
            if (btn) { toggleDrop(btn.closest('.rg-drop')); return; }
            const all = e.target.closest('.rg-drop-all, .rg-drop-none');
            if (all) {
                const d = all.closest('.rg-drop');
                const g = d.dataset.group;
                const on = all.classList.contains('rg-drop-all');
                state[g].clear();
                d.querySelectorAll('.rg-check').forEach(b => {
                    b.checked = on;
                    if (on) state[g].add(numeric(g) ? Number(b.value) : b.value);
                });
                afterFilter(g);
                return;
            }
            if (e.target.closest('.rg-reset')) {
                const view = state.view;
                state = freshState(); state.view = view;
                draw(); return;
            }
            // «показать всех» — граф в исходный вид: без выбранного персонажа,
            // без фильтра по персонажам, весь круг на экране (остальные фильтры остаются)
            if (e.target.closest('.rg-clear')) {
                state.selected = -1;
                state.people.clear();
                state.view = [-500, -500, 1000, 1000];
                root.querySelectorAll('.rg-drop[data-group="people"] .rg-check').forEach(b => { b.checked = false; });
                drawGraph();
                return;
            }
            const person = e.target.closest('.rg-person');
            if (person) { state.selected = Number(person.dataset.i); drawGraph(); return; }
            const zb = e.target.closest('[data-zoom]');
            if (zb) {
                if (zb.dataset.zoom === 'reset') {
                    state.view = [-500, -500, 1000, 1000];
                    setView();
                } else zoom(zb.dataset.zoom === 'in' ? 0.8 : 1.25);
            }
        });

        const stage = root.querySelector('.rg-stage');
        // перетаскивание — сдвиг; короткое нажатие на персонажа — выбор; по пустому месту — сброс
        let drag = null;
        stage.addEventListener('pointerdown', (e) => {
            const svg = stage.querySelector('.rg-svg');
            if (!svg) return;
            drag = { x: e.clientX, y: e.clientY, view: [...state.view], moved: false, svg };
        });
        stage.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (!drag.moved && Math.hypot(dx, dy) < 5) return;
            if (!drag.moved) { drag.moved = true; stage.setPointerCapture(e.pointerId); stage.classList.add('is-dragging'); }
            const r = drag.svg.getBoundingClientRect();
            const [x, y, w, h] = drag.view;
            state.view = [x - dx / r.width * w, y - dy / r.height * h, w, h];
            setView();
        });
        const end = (e) => {
            if (!drag) return;
            const wasMoved = drag.moved;
            drag = null;
            stage.classList.remove('is-dragging');
            if (wasMoved) return;
            const node = e.target.closest && e.target.closest('.rg-node');
            if (node) select(Number(node.dataset.i));
            else if (state.selected >= 0) { state.selected = -1; drawGraph(); }
        };
        stage.addEventListener('pointerup', end);
        stage.addEventListener('pointercancel', () => { drag = null; stage.classList.remove('is-dragging'); });
        stage.addEventListener('wheel', (e) => {
            const svg = stage.querySelector('.rg-svg');
            if (!svg || !(e.ctrlKey || e.metaKey || e.altKey)) return;        // без Ctrl колесо прокручивает страницу
            e.preventDefault();
            const [px, py] = svgPoint(svg, e);
            zoom(e.deltaY > 0 ? 1.12 : 0.89, px, py);
        }, { passive: false });
        stage.addEventListener('keydown', (e) => {
            const node = e.target.closest('.rg-node');
            if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(Number(node.dataset.i)); }
        });

        // наведение на персонажа (ПК) — подсветить его связи, не выбирая.
        // Пересчитываем только при переходе на другого персонажа и только его связи
        // (линий бывает почти 2000 — перебирать все на каждое движение мыши дорого)
        // Сам граф при наведении не меняется (иначе браузер перерисовывал бы все линии на каждом
        // кадре): линии персонажа и тех, с кем он связан, копируются на прозрачный слой поверх графа,
        // и плавно проявляется слой целиком — это делает видеокарта, без перерисовки.
        let hot = null, layer = 0;
        const setHot = (i) => {
            if (i === hot) return;
            hot = i;
            const layers = stage.querySelectorAll('.rg-hot');
            if (layers.length < 2) return;
            const old = layers[layer];
            layer = 1 - layer;
            const next = layers[layer];
            old.classList.remove('is-on');
            next.classList.remove('is-on');
            if (i == null) return;
            const base = stage.querySelector('.rg-svg');
            const links = linksByNode.get(i) || [];
            const ends = new Set([i]);
            links.forEach(l => { ends.add(l.dataset.from); ends.add(l.dataset.to); });
            const nodes = [...ends].map(n => base.querySelector(`.rg-node[data-i="${n}"]`)).filter(Boolean)
                .map(n => n.outerHTML.replace('class="rg-node', n.dataset.i === i ? 'class="rg-node is-hover' : 'class="rg-node'));
            next.querySelector('g').innerHTML = links.map(l => l.outerHTML).join('') + nodes.join('');
            next.querySelector('svg').setAttribute('viewBox', state.view.join(' '));
            requestAnimationFrame(() => { if (hot === i) next.classList.add('is-on'); });
        };
        stage.addEventListener('mouseover', (e) => {
            if (state.selected >= 0) return;
            const node = e.target.closest('.rg-svg .rg-node');
            setHot(node ? node.dataset.i : null);
        });
        stage.addEventListener('mouseleave', () => setHot(null));
        stage.addEventListener('rg:redraw', () => { hot = null; });

    }

    // меню фильтров закрываются по клику мимо и по Escape
    document.addEventListener('click', (e) => { if (!e.target.closest('.rg-drop')) closeDrops(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrops(); });

    // смена темы — пересчитать цвета связей (наблюдатель один на всю страницу)
    new MutationObserver(() => { if (root && root.isConnected && model) draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    RCU.pages.relations = {
        title: 'Отношения',
        load: async () => {
            const [d, rel] = await Promise.all([RCU.publicData(), loadRelations().catch(e => ({ error: String(e) }))]);
            return { d, rel };
        },
        render(el, { d, rel }) {
            root = el;
            RCU.setPublicData && RCU.setPublicData(d);
            if (!rel || rel.error || !Array.isArray(rel.legend)) {
                el.innerHTML = `
                    <div class="pub-soon">
                        <h2 class="dl-section-title pub-soon-title"><span>отношения</span></h2>
                        <p class="pc-soon">Граф появится, когда обновится скрипт сайта.</p>
                    </div>`;
                return;
            }
            model = buildModel(rel, d);
            state = freshState();
            state.view = [-500, -500, 1000, 1000];
            el.innerHTML = `
                <div class="rg">
                    <div class="rg-filters-wrap"></div>
                    <div class="rg-graph">
                        <div class="rg-stage"></div>
                        <button class="rg-clear" type="button" hidden>показать всех</button>
                        <div class="rg-zoom">
                            <button type="button" data-zoom="in" aria-label="Приблизить">+</button>
                            <button type="button" data-zoom="out" aria-label="Отдалить">−</button>
                            <button type="button" data-zoom="reset" aria-label="Весь граф">⟲</button>
                        </div>
                    </div>
                    <div class="rg-details"></div>
                </div>`;
            draw();
            bind();
        },
    };
})();
