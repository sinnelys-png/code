// Главная: короткая сводка из всех разделов.
// Для того, кто открыл сайт из ВК, — его дедлайны, посты и место в активности;
// для гостя — ближайшие посты и лидеры активности.
(() => {
    const { esc, safeUrl, link, plural, daysUntil } = RCU;

    const isEmpty = (s) => !s || /^-*$/.test(s);
    const isQueued = (s) => /отложк|предложк/i.test(s || '');

    function when(iso) {
        const n = daysUntil(iso);
        if (n === null) return { text: '', cls: '' };
        if (n < 0) return { text: `просрочен на ${-n} ${plural(-n, 'день', 'дня', 'дней')}`, cls: 'is-overdue' };
        if (n === 0) return { text: 'сегодня', cls: 'is-urgent' };
        if (n === 1) return { text: 'завтра', cls: 'is-urgent' };
        return { text: `через ${n} ${plural(n, 'день', 'дня', 'дней')}`, cls: n <= 3 ? 'is-urgent' : n <= 7 ? 'is-soon' : '' };
    }

    function section(title, body, more) {
        return `
            <section class="home-section">
                <h2 class="dl-section-title">${esc(title)}</h2>
                ${body}
                ${more ? `<a class="home-more" href="${more.href}">${esc(more.text)} →</a>` : ''}
            </section>`;
    }

    /* ---------- Дедлайны ---------- */

    function deadlinesBlock(mine) {
        // сначала просроченные и ближайшие, «пост скоро выйдет» — в конце
        const sorted = [...mine].sort((a, b) => {
            const qa = isQueued(a.status), qb = isQueued(b.status);
            if (qa !== qb) return qa ? 1 : -1;
            return (daysUntil(a.deadlineISO) ?? 9999) - (daysUntil(b.deadlineISO) ?? 9999);
        });
        const rows = sorted.map(c => {
            const fac = RCU.facultyAttrs(c.faculty);
            const avatar = safeUrl(c.avatar)
                ? `<img class="dl-avatar home-avatar${fac.cls}"${fac.attrs} src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
                : `<div class="dl-avatar dl-avatar--empty home-avatar${fac.cls}"${fac.attrs}>${esc(c.name.charAt(0))}</div>`;
            const w = when(c.deadlineISO);
            const right = isQueued(c.status)
                ? '<span class="dl-date is-queued">пост скоро выйдет</span>'
                : `<span class="dl-date">${esc(c.deadline) || '—'}</span>${w.text ? `<span class="dl-days ${w.cls}">${w.text}</span>` : ''}`;
            return `
                <div class="home-row">
                    ${avatar}
                    <div class="home-row-main">${link(c.topicUrl, c.name, 'dl-name')}</div>
                    <div class="home-row-side">${right}</div>
                </div>`;
        }).join('');
        return section('Ваши дедлайны', rows, { href: '#deadlines', text: 'все дедлайны' });
    }

    /* ---------- Посты ---------- */

    function postsBlock(title, posts, emptyText) {
        const upcoming = posts.filter(p => (daysUntil(p.iso) ?? 0) >= 0).slice(0, 4);
        const body = upcoming.length ? upcoming.map(p => {
            const n = daysUntil(p.iso);
            const day = n === 0 ? 'сегодня' : n === 1 ? 'завтра' : p.day;
            return `
                <div class="home-row home-post">
                    <div class="home-post-when"><span class="home-post-day">${esc(day)}</span> <span class="sc-time">${esc(p.time)}</span></div>
                    <div class="home-post-tags">${p.tags.map(t => `<span class="home-tag${t.character ? '' : ' is-service'}">${esc(t.text)}</span>`).join(' ')}</div>
                </div>`;
        }).join('') : `<p class="home-empty">${esc(emptyText)}</p>`;
        return section(title, body, { href: '#schedule', text: 'всё расписание' });
    }

    /* ---------- Активность ---------- */

    function myActivityBlock(me) {
        const text = me.winner
            ? 'Вы победили в прошлом месяце, поэтому не попадаете в рейтинг этого'
            : `Вы на ${me.place} месте — ${me.sum} ${plural(me.sumNum, 'балл', 'балла', 'баллов')}`;
        return section('Ваша активность', `<p class="home-activity">${esc(text)}</p>`, { href: '#activity', text: 'весь рейтинг' });
    }

    function leadersBlock(people) {
        const top = people.filter(p => !p.winner).slice(0, 3);
        if (!top.length) return '';
        const rows = top.map(p => `
            <div class="home-row ac-row is-top is-top-${p.place}">
                <div class="ac-place">${esc(p.place)}</div>
                <div class="home-row-main">${link(p.url, p.name, 'ac-name-link')}</div>
                <div class="home-row-side ac-sum">${esc(p.sum)}</div>
            </div>`).join('');
        return section('Лидеры активности', rows, { href: '#activity', text: 'весь рейтинг' });
    }

    /* ---------- Сборка ---------- */

    async function render(root, greetingEl) {
        root.innerHTML = RCU.loaderHTML('Собираем сводку…');
        const pick = (p) => p.catch(() => null);
        const [dl, posts, act] = await Promise.all([
            pick(RCU.dataOf('deadlines')),
            pick(RCU.dataOf('schedule')),
            pick(RCU.dataOf('activity')),
        ]);

        const viewerId = (dl && dl[1]) || (act && act.viewerId) || '';
        const mine = dl && viewerId ? dl[0].filter(r => r.playerId === viewerId) : [];
        const me = act && viewerId ? act.people.find(p => p.id === viewerId) : null;

        // Приветствие по имени игрока, если он есть в таблице
        if (greetingEl && mine.length && !isEmpty(mine[0].player)) {
            greetingEl.textContent = `Добро пожаловать, ${mine[0].player}`;
        }

        const blocks = [];
        if (mine.length) blocks.push(deadlinesBlock(mine));
        if (posts) {
            blocks.push(mine.length
                ? postsBlock('Ваши посты', posts.filter(p => p.mine), 'Запланированных постов пока нет.')
                : postsBlock('Ближайшие посты', posts, 'Запланированных постов пока нет.'));
        }
        if (act) blocks.push(me ? myActivityBlock(me) : leadersBlock(act.people));

        root.innerHTML = blocks.length
            ? blocks.filter(Boolean).join('')
            : '<p class="dl-status">Не удалось загрузить сводку. Попробуйте ещё раз чуть позже.</p>';
    }

    RCU.home = { render };
})();
