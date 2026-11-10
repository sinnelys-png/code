// Страница отвечающего: #player/id123456 (ссылка «отвечающий» в анкете, поиск по персонажам).
// Аватар, имя, статус (активен — есть актуальные персонажи, иначе неактивен), ссылки на ВК и блоги,
// день рождения и описание (если есть в таблице); ниже — «актуальные персонажи» и «архив».
// Отдельного пункта меню пока нет. Данные собирает buildPlayers в js/pages/public-data.js.
(() => {
    const { esc, safeUrl } = RCU;

    RCU.playerHref = (key) => `#player/${encodeURIComponent(key)}`;

    function avatarHTML(p) {
        return safeUrl(p.avatar)
            ? `<img class="pl-ava" src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`
            : `<div class="pl-ava pl-ava--empty" aria-hidden="true">${esc((p.name || '?').charAt(0))}</div>`;
    }

    function linksHTML(p) {
        const links = [];
        if (safeUrl(p.url)) links.push(`<a class="pl-link" href="${esc(p.url)}" target="_blank" rel="noopener">страница вк</a>`);
        (p.blogs || []).forEach(b => {
            const url = typeof b === 'string' ? b : b.url;
            const title = (typeof b === 'string' ? '' : b.title) || 'блог';
            if (safeUrl(url)) links.push(`<a class="pl-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`);
        });
        return links.length ? `<div class="pl-links">${links.join('')}</div>` : '';
    }

    // сворачиваемая вкладка, как «студенты» в дедлайнах; data-names — по ним листается анкета
    function group(title, list, open) {
        return `
            <details class="dl-section dl-group pl-group"${open ? ' open' : ''}>
                <summary class="dl-section-title">
                    <span class="dl-group-name">${esc(title)}</span>
                    <span class="dl-group-count">${list.length}</span>
                    <span class="dl-chevron" aria-hidden="true"></span>
                </summary>
                <div class="dl-group-body">
                    <div class="pl-cards" data-names="${esc(JSON.stringify(list.map(c => c.name)))}">
                        ${list.map(c => `<div class="pl-card">${RCU.smallCharacterCard(c)}</div>`).join('')}
                    </div>
                </div>
            </details>`;
    }

    RCU.pages.player = {
        title: 'Отвечающий',
        load: () => RCU.publicData(),
        render(root, d) {
            if (RCU.setPublicData) RCU.setPublicData(d);
            const key = decodeURIComponent(RCU.routeParam || '');
            const p = d.players && d.players.get(key);
            if (!p) {
                root.innerHTML = '<p class="dl-status">Такого отвечающего не нашлось.</p>';
                return;
            }
            const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
            root.innerHTML = `
                <section class="pl-head">
                    ${avatarHTML(p)}
                    <div class="pl-info">
                        <h2 class="pl-name">${esc(p.name)}</h2>
                        <span class="pl-status pl-status--${p.active ? 'on' : 'off'}">${p.active ? 'активен' : 'неактивен'}</span>
                        ${p.birthday ? `<div class="pl-row"><span class="pc-k">день рождения</span> ${esc(p.birthday)}</div>` : ''}
                        ${linksHTML(p)}
                    </div>
                </section>
                ${p.about ? `<p class="pl-about">${esc(p.about)}</p>` : ''}
                ${group('актуальные персонажи', [...p.current].sort(byName), true)}
                ${p.archive.length ? group('архив', [...p.archive].sort(byName), false) : ''}`;
        },
    };
})();
