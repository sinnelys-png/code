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
        'студент': 'Студенты',
        'преподаватель': 'Преподаватели',
        'персонал': 'Персонал',
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

    async function loadRows() {
        try {
            const data = await RCU.bundle();
            let rows = data.rows;
            if (rows.length && !('labels' in rows[0])) rows = await addStatus(rows);
            const faculties = data.faculties || {};   // из закрытой техтаблицы (колонка J)
            return rows.map(r => ({ ...r, faculty: faculties[r.name] || '' }));
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
        else { text = `через ${n} ${plural(n, 'день', 'дня', 'дней')}`; cls = n <= 3 ? 'is-urgent' : n <= 7 ? 'is-soon' : ''; }
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

    function card(row) {
        const fac = RCU.facultyAttrs(row.faculty);
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
            extra.push(`
                <div class="dl-subs">
                    ${active ? `<div class="dl-active"><span class="dl-label">текущая подроль:</span> ${esc(active)} ${counter}</div>` : ''}
                    ${queue.length ? `
                        <div class="dl-label">очередь подролей:</div>
                        <ol class="dl-queue">
                            ${queue.map(q => `<li class="dl-chip${q === current ? ' is-active' : ''}">${esc(q)}</li>`).join('')}
                        </ol>` : ''}
                </div>`);
        }

        const more = extra.length
            ? `<button class="dl-more" type="button" aria-expanded="false" aria-label="Подробнее"><span class="dl-chevron" aria-hidden="true"></span></button>`
            : '';

        const labels = labelsOf(row);

        return `
            <article class="dl-card" data-name="${esc(row.name)}" data-q="${esc(searchText(row))}">
                ${avatar}
                <div class="dl-info">
                    <div class="dl-title">${link(row.topicUrl, row.name, 'dl-name')}${more}</div>
                    <div class="dl-player"><span class="dl-label">отвечает:</span> ${link(row.playerUrl, row.player, 'dl-player-link')}</div>
                    ${duet}
                    ${extra.length ? `<div class="dl-extra" hidden>${extra.join('')}</div>` : ''}
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
                    ${rows.map(card).join('')}
                </div>
            </details>`;
    }

    /* ===================== ПОИСК ===================== */

    let query = '';   // переживает тихое обновление данных

    function applySearch(root) {
        const q = query.trim().toLowerCase().replace(/ё/g, 'е');
        let found = 0;
        root.querySelectorAll('.dl-card').forEach(c => {
            const hit = !q || c.dataset.q.includes(q);
            c.hidden = !hit;
            if (hit && !c.closest('.dl-section--mine')) found++;
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
        if (mine) mine.hidden = !!q && !mine.querySelector('.dl-card:not([hidden])');

        const empty = root.querySelector('.dl-empty');
        if (empty) empty.hidden = !q || found > 0 || (mine && !mine.hidden);
    }

    /* ===================== ДЕЙСТВИЯ ===================== */

    function scroller() { return document.querySelector('.main-scroll-viewport'); }

    document.addEventListener('click', (e) => {
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
            const target = cards.find(c => !c.closest('.dl-section--mine')) || cards[0];
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
            const sticky = group ? group.querySelector('summary').offsetHeight : 0;
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

            const mine = viewerId ? sorted.filter(r => r.playerId === viewerId) : [];
            if (mine.length) {
                html += `
                    <section class="dl-section dl-section--mine">
                        <h2 class="user-title dl-mine-title">Ваши персонажи</h2>
                        ${mine.map(card).join('')}
                        ${RCU.dividerHTML()}
                    </section>`;
            }

            // Поиск — под блоком «Ваши персонажи» и разделителем
            html += `
                <label class="dl-search">
                    <span class="visually-hidden">Поиск</span>
                    <input class="dl-search-input" type="search" autocomplete="off"
                        placeholder="поиск: персонаж, подроль или отвечающий" value="${esc(query)}">
                </label>`;


            const groups = [];
            sorted.forEach(r => {
                let g = groups.find(g => g.role === r.role);
                if (!g) groups.push(g = { role: r.role, rows: [] });
                g.rows.push(r);
            });
            groups.forEach(g => { html += collapsible(ROLE_TITLES[g.role] || g.role, g.rows); });
            html += '<p class="dl-status dl-empty" hidden>Никого не нашлось.</p>';

            root.innerHTML = html;

            // заголовки вкладок липнут прямо под закреплённым поиском
            const search = root.querySelector('.dl-search');
            const setSearchH = () => root.style.setProperty('--search-h', `${search.offsetHeight}px`);
            setSearchH();
            requestAnimationFrame(setSearchH);

            const input = root.querySelector('.dl-search-input');
            input.addEventListener('input', () => { query = input.value; applySearch(root); });
            if (query) applySearch(root);
        },
    };
})();
