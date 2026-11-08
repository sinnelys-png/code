// Публичный сайт, страница «Город» — прототип карты.
// На широком экране карта видна целиком, а на затемнённых боковых частях — описания мест.
// На узком экране видна только светлая середина карты, описания идут списком под ней.
// Места и тексты пока заполнены для примера — их можно править в списке PLACES.
(() => {
    const { esc } = RCU;

    // Светлая (незатемнённая) часть картинки: от 402 до 878 px из 1280 по ширине
    const IMG_W = 1280, IMG_H = 831, BAND_L = 402, BAND_R = 878;

    // x, y — где на картинке стоит отметка (в пикселях исходной картинки 1280×831);
    // side — в какой боковой части экрана показывать описание на широком экране
    const PLACES = [
        {
            id: 'university', name: 'Университет RCU', x: 632, y: 176, side: 'left',
            text: 'Главный корпус университета на вершине холма. Здесь проходят лекции, заседает совет факультетов и работает библиотека.',
            hours: 'пн–сб, 8:00–20:00',
            staff: 'преподаватели, секретарь, библиотекарь',
        },
        {
            id: 'quarter', name: 'Жилой квартал', x: 490, y: 410, side: 'left',
            text: 'Тихие улицы с домами горожан. Описание скоро появится.',
            hours: '—',
            staff: '—',
        },
        {
            id: 'gate', name: 'Въезд в город', x: 620, y: 735, side: 'left',
            text: 'Дорога через лес и пропускной пункт. Описание скоро появится.',
            hours: 'круглосуточно',
            staff: 'охрана',
        },
        {
            id: 'dorm', name: 'Общежитие', x: 640, y: 428, side: 'right',
            text: 'Двадцать восемь домиков вокруг газона. Подробная схема — в разделе «общежитие».',
            hours: 'круглосуточно, тишина с 23:00',
            staff: 'ночной охранник, уборщик', link: '#dorm',
        },
        {
            id: 'market', name: 'Торговая улица', x: 775, y: 400, side: 'right',
            text: 'Кафе, лавки и мастерские. Описание скоро появится.',
            hours: 'ежедневно, 9:00–22:00',
            staff: '—',
        },
    ];

    const pct = (v, total) => `${(v / total * 100).toFixed(3)}%`;

    function card(p) {
        return `
            <article class="ct-card" data-id="${p.id}">
                <h3 class="ct-card-title">${esc(p.name)}</h3>
                <p class="ct-card-text">${esc(p.text)}</p>
                <dl class="ct-card-meta">
                    <div><dt>часы работы</dt><dd>${esc(p.hours || '—')}</dd></div>
                    <div><dt>работают</dt><dd>${esc(p.staff || '—')}</dd></div>
                </dl>
                ${p.link ? `<a class="pc-link ct-card-link" href="${p.link}">подробнее →</a>` : ''}
            </article>`;
    }

    function setActive(root, id, scroll) {
        root.querySelectorAll('.ct-spot, .ct-card').forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
        if (!scroll) return;
        // карточка в видимой части: в боковой панели (широкий экран) или в списке под картой
        const visible = [...root.querySelectorAll(`.ct-card[data-id="${id}"]`)].find(el => el.offsetParent);
        if (visible) visible.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    RCU.pages.city = {
        title: 'Город',
        load: async () => null,
        render(root) {
            const side = (s) => PLACES.filter(p => p.side === s).map(card).join('');
            root.innerHTML = `
                <div class="ct-map" style="--band-l:${BAND_L / IMG_W};--band-r:${BAND_R / IMG_W};--img-ratio:${IMG_W / IMG_H}">
                    <div class="ct-inner">
                        <img class="ct-img" src="img/city-map.webp" alt="Карта города" width="${IMG_W}" height="${IMG_H}">
                        ${PLACES.map(p => `
                            <button class="ct-spot" type="button" data-id="${p.id}" style="left:${pct(p.x, IMG_W)};top:${pct(p.y, IMG_H)}" aria-label="${esc(p.name)}">
                                <span class="ct-spot-dot">✦</span>
                                <span class="ct-spot-label">${esc(p.name)}</span>
                            </button>`).join('')}
                        <aside class="ct-side ct-side--left">${side('left')}</aside>
                        <aside class="ct-side ct-side--right">${side('right')}</aside>
                    </div>
                </div>
                <div class="ct-list">${PLACES.map(card).join('')}</div>`;

            root.querySelectorAll('.ct-spot').forEach(b => {
                b.addEventListener('click', () => setActive(root, b.dataset.id, true));
                b.addEventListener('mouseenter', () => setActive(root, b.dataset.id, false));
            });
            root.querySelectorAll('.ct-card').forEach(c => {
                c.addEventListener('mouseenter', () => setActive(root, c.dataset.id, false));
            });
        },
    };
})();
