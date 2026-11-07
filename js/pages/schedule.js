// Страница «Расписание будущих постов»: колонки B (дата и время) и C (хэштеги).
(() => {
    const { esc, plural, daysUntil, gvizDateToISO, loadGviz } = RCU;

    const SHEET_ID = '1KTZmUktm284bdyGc_LfDpv9BVUDCqcEU8Av29s-NXVU';
    const SHEET_GID = '1309259642';

    // Тег персонажа — «#Имя_Фамилия_RCU», где имя совпадает с персонажем со страницы «Дедлайны».
    // Все остальные теги (#Др_RCU, #Mafia_RCU, #Преподаватели_RCU…) — служебные, они приглушены.
    const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е')
        .replace(/^#/, '').replace(/_rcu$/, '').replace(/[_\s-]+/g, ' ').trim();

    async function load() {
        const [rows, [characters, viewerId]] = await Promise.all([
            loadGviz(SHEET_ID, SHEET_GID),
            RCU.dataOf('deadlines').catch(() => [[], '']),   // без дедлайнов просто не будет подсветки
        ]);

        const byName = new Map(characters.map(c => [norm(c.name), c]));

        const posts = rows
            .filter(cell => cell('B')?.v && cell.text('C'))
            .map(cell => {
                const shown = cell.text('B');                  // «вс, 8 ноября в 14:00»
                const [day, time = ''] = shown.split(/\s+в\s+(?=\d)/);
                const tags = cell.text('C').split('//').map(t => t.trim()).filter(Boolean)
                    .map(t => ({ text: t, character: byName.get(norm(t)) || null }));
                return {
                    iso: gvizDateToISO(cell('B').v),
                    day: day.trim(),
                    time: time.trim(),
                    tags,
                    mine: !!viewerId && tags.some(t => t.character && t.character.playerId === viewerId),
                };
            });
        return posts;
    }

    function dayBadge(iso) {
        const n = daysUntil(iso);
        if (n === null) return '';
        if (n < 0) return '<span class="sc-when is-past">прошло</span>';
        if (n === 0) return '<span class="sc-when is-today">сегодня</span>';
        if (n === 1) return '<span class="sc-when is-soon">завтра</span>';
        return `<span class="sc-when">через ${n} ${plural(n, 'день', 'дня', 'дней')}</span>`;
    }

    function postHTML(p) {
        return `
            <div class="sc-post">
                <div class="sc-time">${esc(p.time) || '—'}</div>
                <ul class="sc-tags">
                    ${p.tags.map(t => `<li class="sc-tag${t.character ? '' : ' is-service'}">${esc(t.text)}</li>`).join('')}
                </ul>
            </div>`;
    }

    // Группируем по дню, сохраняя порядок таблицы
    function daysHTML(posts) {
        const days = [];
        posts.forEach(p => {
            let d = days.find(d => d.iso === p.iso && d.day === p.day);
            if (!d) days.push(d = { iso: p.iso, day: p.day, posts: [] });
            d.posts.push(p);
        });
        return days.map(d => `
            <section class="sc-day">
                <h2 class="dl-section-title sc-day-title">
                    <span>${esc(d.day)}</span>
                    ${dayBadge(d.iso)}
                </h2>
                ${d.posts.map(postHTML).join('')}
            </section>`).join('');
    }

    RCU.pages.schedule = {
        title: 'Расписание будущих постов',
        load,
        render(root, posts) {
            if (!posts.length) {
                root.innerHTML = '<p class="dl-status">Запланированных постов пока нет.</p>';
                return;
            }

            const mine = posts.filter(p => p.mine);
            root.innerHTML =
                (mine.length ? `
                    <section class="dl-section dl-section--mine sc-mine">
                        <h2 class="dl-section-title">Ваши посты</h2>
                        ${daysHTML(mine)}
                    </section>` : '') +
                daysHTML(posts);
        },
    };
})();
