// Страница «Дедлайны»: лист «Дедлайн» + блок «Ваши персонажи» для того,
// кто открыл мини-приложение ВКонтакте.
(() => {
    const { esc, safeUrl, link, plural, daysUntil, gvizDateToISO, loadGviz, getViewerId } = RCU;

    /* ===================== НАСТРОЙКИ ===================== */

    // Развёрнутый Apps Script (apps-script/Code.gs) — даёт аватары и ссылки.
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxk19tuN3_KujHDRSQM-OHpjLgkfb9_ygmvvpaZLro9JLLG0WpPcP74IxDe0SH5OWD_Pg/exec';

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

    async function addStatusFromSheet(rows) {
        try {
            const sheet = await loadGviz(SHEET_ID, SHEET_GID);
            const byName = new Map(sheet.map(cell => [cell.text('B'), cell.text('P')]));
            rows.forEach(r => { r.status = byName.get(r.name) || ''; });
        } catch (e) {
            console.warn('Не удалось прочитать колонку P:', e);
        }
    }

    async function loadRows() {
        if (APPS_SCRIPT_URL) {
            try {
                const data = await (await fetch(APPS_SCRIPT_URL)).json();
                if (data.error) throw new Error(data.error);
                if (data.rows.length && !('status' in data.rows[0])) {
                    // Старая версия скрипта без колонки P — берём её из публичной выгрузки
                    await addStatusFromSheet(data.rows);
                }
                return data.rows;
            } catch (e) {
                console.warn('Apps Script недоступен, беру публичную выгрузку:', e);
            }
        }
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
                    queue: cell.text('Q').split('\n').map(s => s.trim()).filter(Boolean),
                };
            })
            .filter(r => r.name && r.role && r.role !== 'Роль');
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

    function card(row) {
        const avatar = safeUrl(row.avatar)
            ? `<img class="dl-avatar" src="${esc(row.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<div class="dl-avatar dl-avatar--empty">${esc(row.name.charAt(0))}</div>`;

        const duet = isEmpty(row.duet) ? '' :
            `<button class="dl-duet" type="button" data-duet="${esc(row.duet)}" aria-label="Дуэт: ${esc(row.duet)}">👥</button>`;

        const active = isEmpty(row.activeSub) ? '' : row.activeSub;
        const current = currentSub(row);   // какую подроль подсветить в очереди
        const queue = (row.queue || []).filter(q => !isEmpty(q));
        let subs = '';
        if (active || queue.length) {
            const counter = isEmpty(row.noSub) ? '' : `<span class="dl-counter" title="Ответы без подроли">${esc(row.noSub)}</span>`;
            const chips = queue.map(q =>
                `<li class="dl-chip${q === current ? ' is-active' : ''}">${esc(q)}</li>`).join('');
            subs = `
                <div class="dl-subs">
                    ${active ? `<div class="dl-active"><span class="dl-label">текущая подроль:</span> ${esc(active)} ${counter}</div>` : ''}
                    ${queue.length > 1 || (queue.length === 1 && queue[0] !== active)
                        ? `<ol class="dl-queue" aria-label="Очередь подролей">${chips}</ol>` : ''}
                </div>`;
        }

        return `
            <article class="dl-card">
                ${avatar}
                <div class="dl-info">
                    <div class="dl-title">${link(row.topicUrl, row.name, 'dl-name')}${duet}</div>
                    <div class="dl-player"><span class="dl-label">отвечает:</span> ${link(row.playerUrl, row.player, 'dl-player-link')}</div>
                    ${subs}
                </div>
                <div class="dl-deadline">
                    ${isQueued(row.status)
                        ? '<div class="dl-date is-queued">пост скоро выйдет</div>'
                        : `<div class="dl-date">${esc(row.deadline) || '—'}</div>${deadlineBadge(row)}`}
                </div>
            </article>`;
    }

    function section(title, rows, extraClass = '') {
        return `
            <section class="dl-section ${extraClass}">
                <h2 class="dl-section-title">${esc(title)}</h2>
                ${rows.map(card).join('')}
            </section>`;
    }

    // Сворачиваемая группа (по умолчанию свёрнута)
    function collapsible(title, rows) {
        return `
            <details class="dl-section dl-group">
                <summary class="dl-section-title">
                    <span class="dl-group-name">${esc(title)}</span>
                    <span class="dl-group-count">${rows.length}</span>
                    <span class="dl-chevron" aria-hidden="true"></span>
                </summary>
                <div class="dl-group-body">
                    ${rows.map(card).join('')}
                </div>
            </details>`;
    }

    // Подсказка дуэта: на ПК — наведение (CSS), на телефоне — нажатие
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.dl-duet');
        document.querySelectorAll('.dl-duet.is-open').forEach(b => { if (b !== btn) b.classList.remove('is-open'); });
        if (btn) btn.classList.toggle('is-open');
    });

    RCU.pages.deadlines = {
        title: 'Дедлайны',
        load: () => Promise.all([loadRows(), getViewerId()]),
        render(root, [rows, viewerId]) {
            byName = new Map(rows.map(r => [r.name, r]));
            const sorted = sortRows(rows);
            let html = '';

            const mine = viewerId ? sorted.filter(r => r.playerId === viewerId) : [];
            if (mine.length) html += section('Ваши персонажи', mine, 'dl-section--mine');

            const groups = [];
            sorted.forEach(r => {
                let g = groups.find(g => g.role === r.role);
                if (!g) groups.push(g = { role: r.role, rows: [] });
                g.rows.push(r);
            });
            groups.forEach(g => { html += collapsible(ROLE_TITLES[g.role] || g.role, g.rows); });

            root.innerHTML = html;
        },
    };
})();
