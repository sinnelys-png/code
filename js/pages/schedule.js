// Страница «Расписание будущих постов»: колонки B (дата и время) и C (хэштеги).
(() => {
    const { esc, plural, daysUntil, gvizDateToISO, loadGviz } = RCU;

    const SHEET_ID = '1KTZmUktm284bdyGc_LfDpv9BVUDCqcEU8Av29s-NXVU';
    const SHEET_GID = '1309259642';

    async function load() {
        const rows = await loadGviz(SHEET_ID, SHEET_GID);
        return rows
            .filter(cell => cell('B')?.v && cell.text('C'))
            .map(cell => {
                const shown = cell.text('B');                  // «вс, 8 ноября в 14:00»
                const [day, time = ''] = shown.split(/\s+в\s+(?=\d)/);
                return {
                    iso: gvizDateToISO(cell('B').v),
                    sortKey: String(cell('B').v),
                    day: day.trim(),
                    time: time.trim(),
                    tags: cell.text('C').split('//').map(t => t.trim()).filter(Boolean),
                };
            });
    }

    function dayBadge(iso) {
        const n = daysUntil(iso);
        if (n === null) return '';
        if (n < 0) return '<span class="sc-when is-past">прошло</span>';
        if (n === 0) return '<span class="sc-when is-today">сегодня</span>';
        if (n === 1) return '<span class="sc-when is-soon">завтра</span>';
        return `<span class="sc-when">через ${n} ${plural(n, 'день', 'дня', 'дней')}</span>`;
    }

    RCU.pages.schedule = {
        title: 'Расписание будущих постов',
        load,
        render(root, posts) {
            if (!posts.length) {
                root.innerHTML = '<p class="dl-status">Запланированных постов пока нет.</p>';
                return;
            }

            // Группируем по дню, сохраняя порядок таблицы
            const days = [];
            posts.forEach(p => {
                let d = days.find(d => d.iso === p.iso && d.day === p.day);
                if (!d) days.push(d = { iso: p.iso, day: p.day, posts: [] });
                d.posts.push(p);
            });

            root.innerHTML = days.map(d => `
                <section class="sc-day">
                    <h2 class="dl-section-title sc-day-title">
                        <span>${esc(d.day)}</span>
                        ${dayBadge(d.iso)}
                    </h2>
                    ${d.posts.map(p => `
                        <div class="sc-post">
                            <div class="sc-time">${esc(p.time) || '—'}</div>
                            <ul class="sc-tags">
                                ${p.tags.map(t => `<li class="sc-tag">${esc(t)}</li>`).join('')}
                            </ul>
                        </div>`).join('')}
                </section>`).join('');
        },
    };
})();
