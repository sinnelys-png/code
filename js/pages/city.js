// Публичный сайт, страница «Город» — прототип карты.
// Карта растянута на весь основной блок (лишнее обрезается поровну по краям, как background-size: cover).
// Описания мест — на видимых затемнённых боковых частях; если там слишком тесно (узкий экран),
// описания идут списком под картой. Закладки с названием и «обновлено …» у страницы нет.
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

    // раскладка «на весь блок»: картинка покрывает рамку, боковые панели — на видимых тёмных краях
    const MIN_SIDE = 150;      // уже — описания уходят в список под картой
    function fit(root) {
        const map = root.querySelector('.ct-map');
        const inner = root.querySelector('.ct-inner');
        if (!map || !inner) return;
        const W = map.clientWidth, H = map.clientHeight;
        if (!W || !H) return;
        const scale = Math.max(W / IMG_W, H / IMG_H);
        const w = IMG_W * scale, h = IMG_H * scale;
        const left = (W - w) / 2, top = (H - h) / 2;
        Object.assign(inner.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px` });
        // видимая ширина тёмных частей слева и справа
        const darkL = left + BAND_L * scale;
        const darkR = W - (left + BAND_R * scale);
        const wide = Math.min(darkL, darkR) >= MIN_SIDE;
        map.classList.toggle('has-sides', wide);
        root.querySelector('.ct-side--left').style.width = `${Math.max(0, darkL - 14)}px`;
        root.querySelector('.ct-side--right').style.width = `${Math.max(0, darkR - 14)}px`;
    }

    let fitRoot = null, fitObserver = null;
    window.addEventListener('resize', () => { if (fitRoot && fitRoot.isConnected) fit(fitRoot); });

    function setActive(root, id, scroll) {
        root.querySelectorAll('.ct-spot, .ct-card').forEach(el => el.classList.toggle('is-active', el.dataset.id === id));
        if (!scroll) return;
        // карточка в видимой части: в боковой панели (широкий экран) или в списке под картой
        const visible = [...root.querySelectorAll(`.ct-card[data-id="${id}"]`)].find(el => el.offsetParent);
        if (visible) visible.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    RCU.pages.city = {
        title: 'Город',
        ribbon: false,        // без закладки «город»
        updated: false,       // без «обновлено N минут назад»
        fullBleed: true,      // карта на весь основной блок
        load: async () => null,
        render(root) {
            const side = (s) => PLACES.filter(p => p.side === s).map(card).join('');
            root.innerHTML = `
                <div class="ct-map">
                    <div class="ct-inner">
                        <img class="ct-img" src="img/city-map.webp" alt="Карта города" width="${IMG_W}" height="${IMG_H}">
                        ${PLACES.map(p => `
                            <button class="ct-spot" type="button" data-id="${p.id}" style="left:${pct(p.x, IMG_W)};top:${pct(p.y, IMG_H)}" aria-label="${esc(p.name)}">
                                <span class="ct-spot-dot">✦</span>
                                <span class="ct-spot-label">${esc(p.name)}</span>
                            </button>`).join('')}
                    </div>
                    <aside class="ct-side ct-side--left">${side('left')}</aside>
                    <aside class="ct-side ct-side--right">${side('right')}</aside>
                </div>
                <div class="ct-list">${PLACES.map(card).join('')}</div>`;
            fitRoot = root;
            fit(root);
            // блок раздела меняет форму и высоту (заставка, переход в раздел) —
            // пересчитываем при любом изменении размера рамки карты
            if (window.ResizeObserver) {
                if (fitObserver) fitObserver.disconnect();
                fitObserver = new ResizeObserver(() => fit(root));
                fitObserver.observe(root.querySelector('.ct-map'));
            } else {
                setTimeout(() => fit(root), 800);
            }

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
