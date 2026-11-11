// Страница «Дедлайны»: лист «Дедлайн» + блок «Ваши персонажи» для того,
// кто открыл мини-приложение ВКонтакте.
(() => {
    const { esc, safeUrl, link, plural, daysUntil, gvizDateToISO, loadGviz, getViewerId } = RCU;

    /* ===================== НАСТРОЙКИ ===================== */

    // Основной источник — Apps Script (apps-script/Code.gs, адрес — в js/core.js): даёт аватары и ссылки.

    // Запасной вариант, если скрипт не ответил: публичная выгрузка (без аватаров)
    const SHEET_ID = '1KTZmUktm284bdyGc_LfDpv9BVUDCqcEU8Av29s-NXVU';
    const SHEET_GID = '236702218';
    const TOPIC_PREFIX = 'https://vk.ru/topic-196210590_'; // + id обсуждения из колонки AB
    const PROFILE_PREFIX = 'https://vk.ru/id';              // + id отвечающего из колонки AC

    // Заголовки групп по роли из колонки D (если роли нет в списке — выводится как есть)
    const ROLE_TITLES = {
        'студент': 'студенты',
        'преподаватель': 'преподаватели',
        'персонал': 'персонал',
    };

    const isEmpty = (s) => !s || /^-*$/.test(s); // «------» в таблице = пусто

    // Колонка P: «в отложке/предложке» — вместо даты пишем, что пост скоро выйдет
    const isQueued = (s) => /отложк|предложк/i.test(s || '');

    /* ===================== ЗАГРУЗКА ===================== */

    // Запасной вариант: публичная выгрузка листа (без аватаров)
    async function gvizRows() {
        const rows = await loadGviz(SHEET_ID, SHEET_GID);
        return rows
            .map(cell => {
                const topicId = cell('AB')?.v != null ? String(cell('AB').v) : '';
                const playerId = cell.text('AC').replace(/\D/g, '');
                return {
                    avatar: '',
                    name: cell.text('B'),
                    topicUrl: topicId ? TOPIC_PREFIX + topicId : '',
                    duet: cell.text('C'),
                    role: cell.text('D'),
                    player: cell.text('E'),
                    playerUrl: playerId ? PROFILE_PREFIX + playerId : '',
                    playerId,
                    deadline: cell.text('J'),
                    deadlineISO: gvizDateToISO(cell('J')?.v),
                    noSub: cell.text('L'),
                    activeSub: cell.text('M'),
                    status: cell.text('P'),
                    labels: cell.text('H'),
                    queue: cell.text('Q').split('\n').map(s => s.trim()).filter(Boolean),
                };
            })
            .filter(r => r.name && r.role && r.role !== 'Роль');
    }

    // Старая версия скрипта не отдаёт колонки P (отложка) и H (метки) — берём их из публичной выгрузки
    async function addStatus(rows) {
        try {
            const extraByName = await RCU.cached('deadlines-extra', async () => {
                const sheet = await loadGviz(SHEET_ID, SHEET_GID);
                return Object.fromEntries(sheet.map(cell => [cell.text('B'), [cell.text('P'), cell.text('H')]]));
            });
            return rows.map(r => {
                const [status = '', labels = ''] = extraByName[r.name] || [];
                return { ...r, status: r.status ?? status, labels: r.labels ?? labels };
            });
        } catch (e) {
            console.warn('Не удалось прочитать колонку P:', e);
            return rows;
        }
    }

    /* ---------- Долги в игровой (лист игровой в Техтаблице) ----------
       Колонка M — блоки «заголовок события с датой» + строки должников (имя в колонке O),
       долг — ближайший заголовок выше; ячейка J6 — текущие должники, их долг — название из A1.
       Обычно приходит из Apps Script (debts); пока скрипт старый — из листа, если он открыт. */
    const DEBTS_SHEET_ID = '1SaM0adTpbqMs-fiN8Yub2FaeJfWTo4odAt2ScREUSg0';
    const DEBTS_GID = '1875298653';

    function parseDebts(grid) {
        const cell = (r, c) => String((grid[r] || [])[c] || '').replace(/\s+/g, ' ').trim();
        const out = {};
        const add = (name, what) => {
            name = String(name || '').trim();
            if (!name) return;
            out[name] = out[name] || [];
            if (what && !out[name].includes(what)) out[name].push(what);
        };
        let event = '';
        for (let r = 2; r < grid.length; r++) {
            const m = cell(r, 12), o = cell(r, 14);
            if (m && !/^@id/i.test(m)) event = m;
            if (o) add(o, event);
        }
        const title = cell(0, 0);
        // J6 — ячейка под подписью «текущие должники:» (ищем подпись: в выгрузке строки могут сдвигаться)
        const lab = grid.findIndex(r => /текущие должники/i.test(String((r || [])[9] || '')));
        const j6 = String((grid[lab >= 0 ? lab + 1 : 5] || [])[9] || '');
        const named = [...j6.matchAll(/\(([^)]+)\)/g)].map(x => x[1].trim());
        (named.length ? named : j6.split(/[\n,]/)).forEach(n => add(n, title));
        return out;
    }

    async function debtsFromSheet() {
        const url = `https://docs.google.com/spreadsheets/d/${DEBTS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${DEBTS_GID}&headers=0`;
        const text = await (await fetch(url)).text();
        const data = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
        if (data.status !== 'ok') throw new Error('Лист игровой недоступен');
        return parseDebts(data.table.rows.map(row => (row.c || []).map(c => (c ? String(c.f ?? c.v ?? '') : ''))));
    }

    async function loadRows() {
        try {
            const data = await RCU.bundle();
            let rows = data.rows;
            if (rows.length && !('labels' in rows[0])) rows = await addStatus(rows);
            const faculties = data.faculties || {};   // из закрытой техтаблицы (колонка J)
            let debts = data.debts;
            if (!debts) {
                try { debts = await RCU.cached('debts', debtsFromSheet); } catch (e) { debts = {}; }
            }
            const debtOf = new Map(Object.entries(debts).map(([n, d]) => [n.toLowerCase().replace(/ё/g, 'е'), d]));
            return rows.map(r => ({
                ...r,
                faculty: faculties[r.name] || '',
                debts: debtOf.get(r.name.toLowerCase().replace(/ё/g, 'е')) || null,
            }));
        } catch (e) {
            console.warn('Apps Script недоступен, беру публичную выгрузку:', e);
            return RCU.cached('deadlines', gvizRows);
        }
    }

    /* ===================== ОТРИСОВКА ===================== */

    // Как в таблице: группы по роли (в порядке появления), внутри — по алфавиту
    function sortRows(rows) {
        const roleOrder = [];
        rows.forEach(r => { if (!roleOrder.includes(r.role)) roleOrder.push(r.role); });
        return [...rows].sort((a, b) =>
            (roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)) ||
            a.name.localeCompare(b.name, 'ru'));
    }

    function deadlineBadge(row) {
        const n = daysUntil(row.deadlineISO);
        if (n === null) return '';
        let text, cls;
        if (n < 0) { text = `просрочен на ${-n} ${plural(-n, 'день', 'дня', 'дней')}`; cls = 'is-overdue'; }
        else if (n === 0) { text = 'сегодня'; cls = 'is-urgent'; }
        else if (n === 1) { text = 'завтра'; cls = 'is-urgent'; }
        else { text = `${n} ${plural(n, 'день', 'дня', 'дней')} до дедлайна`; cls = n <= 3 ? 'is-urgent' : n <= 7 ? 'is-soon' : ''; }
        return `<span class="dl-days ${cls}">${text}</span>`;
    }

    // «[актуальная подроль у дуэта]» в колонке M — значит, текущая подроль берётся у дуэта
    const fromDuet = (s) => /у\s+дуэта/i.test(s || '');
    let byName = new Map();
    function currentSub(row) {
        if (!fromDuet(row.activeSub)) return isEmpty(row.activeSub) ? '' : row.activeSub;
        const partner = byName.get(row.duet);
        return partner && !fromDuet(partner.activeSub) && !isEmpty(partner.activeSub) ? partner.activeSub : '';
    }

    // Метки из колонки H: «новичок, отсрочка» → ['новичок', 'отсрочка']
    const labelsOf = (row) => String(row.labels || '').split(/[,;\n]/).map(s => s.trim()).filter(s => !isEmpty(s));

    // Строка поиска по карточке: имя, подроли, отвечающий
    function searchText(row) {
        return [row.name, row.player, row.activeSub, currentSub(row), ...(row.queue || [])]
            .filter(s => !isEmpty(s)).join(' ').toLowerCase().replace(/ё/g, 'е');
    }

    // Счётчик ответов без подроли «3/3»: дошёл до предела — следующий ответ с подролью,
    // перевалил за него — персонаж снят с подроли
    function subNotice(noSub) {
        const m = String(noSub || '').match(/(\d+)\s*\/\s*(\d+)/);
        if (!m) return '';
        const done = +m[1], max = +m[2];
        if (!max || done < max) return '';
        return done === max ? 'следующий ответ должен содержать подроль' : 'персонаж снят с подроли';
    }

    // Золотые строки карточки: долг в игровой и напоминание о подроли (их же показывает главная)
    const debtHTML = (row) => row.debts
        ? `<div class="dl-debt"><span class="dl-label">есть долг в игровой${row.debts.length ? ':' : ''}</span> ${esc(row.debts.join('; '))}</div>`
        : '';
    const subNoticeHTML = (row) => subNotice(row.noSub) ? `<div class="dl-sub-notice">${subNotice(row.noSub)}</div>` : '';
    RCU.deadlineNotes = (row) => debtHTML(row) + subNoticeHTML(row);

    // open — карточка сразу раскрыта (свои персонажи)
    function card(row, open) {
        const fac = RCU.facultyAttrs(row.faculty, row.role);
        const avatar = safeUrl(row.avatar)
            ? `<img class="dl-avatar${fac.cls}"${fac.attrs} src="${esc(row.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<div class="dl-avatar dl-avatar--empty${fac.cls}"${fac.attrs}>${esc(row.name.charAt(0))}</div>`;

        // Дуэт — видно сразу, под отвечающим
        let duet = '';
        if (!isEmpty(row.duet)) {
            const partner = byName.get(row.duet)
                ? `<button class="dl-duet-link" type="button" data-target="${esc(row.duet)}">${esc(row.duet)}</button>`
                : esc(row.duet);
            duet = `<div class="dl-duet-line"><span class="dl-label">дуэт:</span> ${partner}</div>`;
        }

        // Скрытая часть: подроли
        const extra = [];

        const active = isEmpty(row.activeSub) ? '' : row.activeSub;
        const current = currentSub(row);   // какую подроль подсветить в очереди
        const queue = (row.queue || []).filter(q => !isEmpty(q));
        if (active || queue.length) {
            const counter = isEmpty(row.noSub) ? '' : `<span class="dl-counter" title="Ответы без подроли">${esc(row.noSub)}</span>`;
            const list = `<ol class="dl-queue">${queue.map(q =>
                `<li class="dl-chip${q === current ? ' is-active' : ''}">${esc(q)}</li>`).join('')}</ol>`;
            // больше одной подроли — очередь прячется в список у ✦ (наведение или касание)
            const pick = active && queue.length > 1
                ? `<span class="dl-sub-pick"><button class="dl-sub-star" type="button" aria-label="Очередь подролей" aria-expanded="false">✦</button><span class="dl-sub-pop">${list}</span></span>`
                : '';
            extra.push(`
                <div class="dl-subs">
                    ${active ? `<div class="dl-active"><span class="dl-label">текущая подроль:</span> ${esc(active)} ${pick}${counter}</div>` : ''}
                    ${subNoticeHTML(row)}
                    ${!active && queue.length ? `<div class="dl-label">очередь подролей:</div>${list}` : ''}
                </div>`);
        }

        const more = extra.length
            ? `<button class="dl-more" type="button" aria-expanded="${open ? 'true' : 'false'}" aria-label="Подробнее"><span class="dl-chevron" aria-hidden="true"></span></button>`
            : '';

        const labels = labelsOf(row);

        return `
            <article class="dl-card${open && extra.length ? ' is-expanded' : ''}" data-name="${esc(row.name)}" data-q="${esc(searchText(row))}">
                ${avatar}
                <div class="dl-info">
                    <div class="dl-title">${link(row.topicUrl, row.name, 'dl-name')}${more}</div>
                    <div class="dl-player"><span class="dl-label">отвечает:</span> ${link(row.playerUrl, row.player, 'dl-player-link')}</div>
                    ${debtHTML(row)}
                    ${duet}
                    ${extra.length ? `<div class="dl-extra"${open ? '' : ' hidden'}>${extra.join('')}</div>` : ''}
                </div>
                <div class="dl-deadline">
                    ${isQueued(row.status)
                        ? '<div class="dl-date is-queued">пост скоро выйдет</div>'
                        : `<div class="dl-date">${esc(row.deadline) || '—'}</div>${deadlineBadge(row)}`}
                    ${labels.length ? `<ul class="dl-labels">${labels.map(l => `<li class="dl-tag">${esc(l)}</li>`).join('')}</ul>` : ''}
                </div>
            </article>`;
    }

    // Сворачиваемая группа (по умолчанию свёрнута)
    function collapsible(title, rows) {
        return `
            <details class="dl-section dl-group">
                <summary class="dl-section-title">
                    <span class="dl-group-name">${esc(title)}</span>
                    <span class="dl-group-count" data-total="${rows.length}">${rows.length}</span>
                    <span class="dl-chevron" aria-hidden="true"></span>
                </summary>
                <div class="dl-group-body">
                    ${rows.map(r => card(r)).join('')}
                </div>
            </details>`;
    }

    /* ===================== ПОИСК ===================== */

    let query = '';   // переживает тихое обновление данных

    function applySearch(root) {
        const q = query.trim().toLowerCase().replace(/ё/g, 'е');
        const qs = RCU.queryVariants(query);          // и при неверной раскладке
        let found = 0;
        root.querySelectorAll('.dl-card').forEach(c => {
            const hit = !q || qs.some(v => c.dataset.q.includes(v));
            c.hidden = !hit;
            const list = c.closest('.dl-by-role, .dl-by-deadline');
            if (hit && list && !list.hidden) found++;
        });

        root.querySelectorAll('.dl-group').forEach(g => {
            const visible = g.querySelectorAll('.dl-card:not([hidden])').length;
            const count = g.querySelector('.dl-group-count');
            if (q) {
                if (!('wasOpen' in g.dataset)) g.dataset.wasOpen = g.open ? '1' : '';
                g.hidden = !visible;
                g.open = visible > 0;
                count.textContent = visible;
            } else {
                g.hidden = false;
                if ('wasOpen' in g.dataset) { g.open = !!g.dataset.wasOpen; delete g.dataset.wasOpen; }
                count.textContent = count.dataset.total;
            }
        });

        const mine = root.querySelector('.dl-section--mine');
        if (mine) {
            const visible = mine.querySelectorAll('.dl-card:not([hidden])').length;
            mine.hidden = !!q && !visible;
            const count = mine.querySelector('.dl-group-count');
            if (count) count.textContent = q ? visible : count.dataset.total;
        }

        const empty = root.querySelector('.dl-empty');
        if (empty) empty.hidden = !q || found > 0 || (mine && !mine.hidden);
    }

    /* ===================== «БЛИЖАЙШИЕ» ===================== */

    // Один список по близости дедлайна: просроченные и ближайшие сверху,
    // «пост скоро выйдет» и без даты — в конце. Выбор запоминается в браузере.
    const URGENT_KEY = 'rcu-deadlines-urgent';
    let urgentMode = false;
    try { urgentMode = localStorage.getItem(URGENT_KEY) === '1'; } catch (e) { /* без хранилища */ }

    function byDeadline(rows) {
        const key = (r) => isQueued(r.status) ? 100000 : (daysUntil(r.deadlineISO) ?? 200000);
        return [...rows].sort((a, b) => (key(a) - key(b)) || a.name.localeCompare(b.name, 'ru'));
    }

    function applyMode(root) {
        root.querySelector('.dl-by-role').hidden = urgentMode;
        root.querySelector('.dl-by-deadline').hidden = !urgentMode;
        const btn = root.querySelector('.dl-urgent-toggle');
        btn.setAttribute('aria-pressed', String(urgentMode));
        btn.classList.toggle('is-on', urgentMode);
        applySearch(root);
    }

    /* ===================== ДЕЙСТВИЯ ===================== */

    function scroller() { return document.querySelector('.main-scroll-viewport'); }

    document.addEventListener('click', (e) => {
        // ✦ у текущей подроли: на телефоне наведения нет — очередь открывается касанием
        const star = e.target.closest('.dl-sub-star');
        document.querySelectorAll('.dl-sub-pick.is-open').forEach(p => {
            if (!star || p !== star.parentElement) {
                p.classList.remove('is-open');
                p.querySelector('.dl-sub-star').setAttribute('aria-expanded', 'false');
            }
        });
        if (star) {
            const open = star.parentElement.classList.toggle('is-open');
            star.setAttribute('aria-expanded', String(open));
            return;
        }

        // Стрелка рядом с именем: показать / скрыть дуэт и подроли
        const more = e.target.closest('.dl-more');
        if (more) {
            const extra = more.closest('.dl-card').querySelector('.dl-extra');
            const open = more.getAttribute('aria-expanded') !== 'true';
            more.setAttribute('aria-expanded', String(open));
            more.closest('.dl-card').classList.toggle('is-expanded', open);
            extra.hidden = !open;
            return;
        }

        // «дуэт: Имя» — перейти к строке дуэта
        const jump = e.target.closest('.dl-duet-link');
        if (jump) {
            const root = jump.closest('.page-root');
            const name = jump.dataset.target;
            const cards = [...root.querySelectorAll('.dl-card')].filter(c => c.dataset.name === name);
            const inShownList = (c) => { const l = c.closest('.dl-by-role, .dl-by-deadline'); return l && !l.hidden; };
            const target = cards.find(inShownList) || cards[0];
            if (!target) return;
            if (target.hidden) {                       // скрыта поиском — сбрасываем поиск
                const input = root.querySelector('.dl-search-input');
                if (input) input.value = '';
                query = '';
                applySearch(root);
            }
            const group = target.closest('details');
            if (group) group.open = true;
            const sc = scroller();
            // над строкой закреплены поиск и заголовок вкладки — строка должна встать под ними целиком
            const searchH = parseFloat(getComputedStyle(root).getPropertyValue('--search-h')) || 0;
            const sticky = (group ? group.querySelector('summary').offsetHeight : 0) + searchH;
            if (sc) {
                const top = target.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
                sc.scrollTo({ top: top - sticky - 8, behavior: 'smooth' });
            }
            target.classList.remove('is-flash');
            void target.offsetWidth;
            target.classList.add('is-flash');
        }
    });

    RCU.pages.deadlines = {
        title: 'Дедлайны',
        load: () => Promise.all([loadRows(), getViewerId()]),
        render(root, [rows, viewerId]) {
            byName = new Map(rows.map(r => [r.name, r]));
            const sorted = sortRows(rows);
            let html = '';

            // Поиск и переключатель — в самом верху
            html += `
                <div class="dl-toolbar">
                    <label class="dl-search">
                        <span class="visually-hidden">Поиск</span>
                        <input class="dl-search-input" type="search" autocomplete="off"
                            placeholder="поиск: персонаж, подроль или отвечающий" value="${esc(query)}">
                    </label>
                    <button class="dl-urgent-toggle" type="button" aria-pressed="false">
                        <span class="dl-toggle-dot" aria-hidden="true"></span>ближайшие
                    </button>
                </div>`;

            // Свои персонажи — под поиском
            const mine = viewerId ? sorted.filter(r => r.playerId === viewerId) : [];
            if (mine.length) {
                // сворачивается так же, как вкладки, но по умолчанию открыт
                html += `
                    <details class="dl-section dl-group dl-section--mine" open>
                        <summary class="dl-section-title dl-mine-title">
                            <span class="dl-group-name">ваши персонажи</span>
                            <span class="dl-group-count" data-total="${mine.length}">${mine.length}</span>
                            <span class="dl-chevron" aria-hidden="true"></span>
                        </summary>
                        <div class="dl-group-body">
                            ${mine.map(r => card(r, true)).join('')}
                        </div>
                    </details>`;
            }

            // По ролям (вкладки)
            const groups = [];
            sorted.forEach(r => {
                let g = groups.find(g => g.role === r.role);
                if (!g) groups.push(g = { role: r.role, rows: [] });
                g.rows.push(r);
            });
            html += `<div class="dl-by-role">${groups.map(g => collapsible(ROLE_TITLES[g.role] || g.role, g.rows)).join('')}</div>`;

            // Все одним списком по сроку
            html += `
                <div class="dl-by-deadline" hidden>
                    <section class="dl-section">
                        ${byDeadline(rows).map(r => card(r)).join('')}
                    </section>
                </div>`;
            html += '<p class="dl-status dl-empty" hidden>Никого не нашлось.</p>';

            root.innerHTML = html;

            // заголовки вкладок липнут прямо под закреплённой строкой поиска
            const search = root.querySelector('.dl-toolbar');
            // дробная высота и заход на 1px: иначе на телефонах между поиском и заголовком
            // вкладки остаётся щель, в которой видно прокручиваемые строки
            const setSearchH = () => root.style.setProperty('--search-h', `${Math.max(0, search.getBoundingClientRect().height - 1)}px`);
            setSearchH();
            requestAnimationFrame(setSearchH);

            const input = root.querySelector('.dl-search-input');
            input.addEventListener('input', () => { query = input.value; applySearch(root); });

            root.querySelector('.dl-urgent-toggle').addEventListener('click', () => {
                urgentMode = !urgentMode;
                try { localStorage.setItem(URGENT_KEY, urgentMode ? '1' : '0'); } catch (e) { /* без хранилища */ }
                applyMode(root);
            });
            applyMode(root);
        },
    };
})();
