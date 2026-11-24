// Меню публичного сайта строится из одного списка — window.SITE_MENU в site.html.
// Пункт — [адрес, название] или [адрес, название, [[адрес, название], …]] (с лентой).
//
// Как раскладывается: пункты поровну слева и справа от герба (слева на один больше, если нечётно),
// между пунктами одной стороны — звёздочки. Под пунктом с лентой из-под шапки (как из-под крышки
// письма) свисает золотая лента-язычок со ссылками на разделы:
//   • на главной — всегда;
//   • в разделах — пока шапка выглянула (наведение на её кончик); спрятанной шапке ленты не видно.
// Ленты лежат между «крышкой» шапки (.header-bookmark) и меню, поэтому верх у них — под крышкой;
// где ссылкам начинаться (ниже края крышки), считается по её форме (layout ниже).
// Пункт в шапке подсвечен как текущий, если открыт любой раздел с его ленты.
// Подключается до js/site.js (там на пункты меню вешаются эффекты блика).
(() => {
    const items = window.SITE_MENU;
    const left = document.querySelector('.nav-left');
    const right = document.querySelector('.nav-right');
    const wrap = document.querySelector('.header-center-wrapper');
    if (!Array.isArray(items) || !left || !right || !wrap) return;

    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const tabOf = (x) => (Array.isArray(x[2]) && x[2].length ? x[2] : null);

    const top = ([href, title], i) => `<a class="nav-top" href="${esc(href)}" data-rib="${i}">${esc(title)}</a>`;
    const join = (list, from) => list.map((x, k) => top(x, from + k)).join('<span class="star-separator">✦</span>');
    const half = Math.ceil(items.length / 2);
    left.innerHTML = join(items.slice(0, half), 0);
    right.innerHTML = join(items.slice(half), half);

    // ленты — отдельным слоем под крышкой шапки
    const layer = document.createElement('div');
    layer.className = 'nav-ribbons';
    layer.innerHTML = items.map((x, i) => {
        const tab = tabOf(x);
        if (!tab) return '';
        return `
            <nav class="nav-rib" data-rib="${i}" aria-label="${esc(x[1])}">
                <div class="nav-rib-body">
                    <svg class="nav-rib-edge" aria-hidden="true"><path /></svg>
                    ${tab.map(([h, n]) => `<a class="nav-tab-link" href="${esc(h)}"><span>${esc(n)}</span></a>`).join('<span class="nav-rib-star" aria-hidden="true">✦</span>')}
                </div>
            </nav>`;
    }).join('');
    wrap.appendChild(layer);

    // где ленте висеть: под своим пунктом; ссылки — ниже края крышки (в SVG крышки 1010×410
    // края идут от (0, 305) к острию (505, 405) и обратно к (1010, 305))
    const bookmark = wrap.querySelector('.header-bookmark');
    function layout() {
        const wr = wrap.getBoundingClientRect();
        const br = bookmark ? bookmark.getBoundingClientRect() : null;
        const edge = (x) => {
            if (!br || !br.width) return wr.height;
            const t = Math.min(1, Math.abs(x - (br.left + br.width / 2)) / (br.width / 2));
            return br.top + br.height * (305 + 100 * (1 - t)) / 410 - wr.top;
        };
        layer.querySelectorAll('.nav-rib').forEach(rib => {
            const link = wrap.querySelector(`.nav-top[data-rib="${rib.dataset.rib}"]`);
            if (!link) return;
            const lr = link.getBoundingClientRect();
            const w = rib.offsetWidth;
            const x = Math.max(4, Math.min(lr.left + lr.width / 2 - wr.left - w / 2, wr.width - w - 4));
            rib.style.left = `${Math.round(x)}px`;
            // самая низкая точка края крышки над лентой + зазор (двойная обводка крышки)
            const y = Math.max(edge(wr.left + x), edge(wr.left + x + w));
            rib.style.setProperty('--rib-pad', `${Math.round(y + 14)}px`);
        });
        requestAnimationFrame(() => layer.querySelectorAll('.nav-rib-body').forEach(outline));
    }

    // внутренняя обводка ленты: по бокам и вдоль острия внизу, на одном отступе от края
    // (острие — 1.4rem, как в clip-path у .nav-rib-body; полоса 7px, от края 6px;
    //  на узком экране — 1.5px, как тонкая вторая полоска шапки, от края 5px)
    const narrow = window.matchMedia('(max-width: 768px)');
    function outline(body) {
        const svg = body.querySelector('.nav-rib-edge');
        const W = body.offsetWidth, H = body.offsetHeight;
        if (!svg || !W || !H) return;
        const T = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.4;
        const sw = narrow.matches ? 1.5 : 7;
        svg.querySelector('path').style.strokeWidth = String(sw);
        const d = (narrow.matches ? 5 : 6) + sw / 2;      // середина полосы — от края
        const s = T / (W / 2);                            // наклон краёв острия
        const k = d * Math.sqrt(1 + s * s);               // на столько выше проходит параллельная линия
        const yL = H - T + s * d - k, yTip = H - k;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.querySelector('path').setAttribute('d',
            `M${d} 0 V${yL.toFixed(1)} L${W / 2} ${yTip.toFixed(1)} L${W - d} ${yL.toFixed(1)} V0`);
    }
    const relayout = () => requestAnimationFrame(layout);
    relayout();
    if (document.fonts) document.fonts.ready.then(relayout);
    window.addEventListener('resize', relayout);
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(wrap);

    // фонарик: пятно света за мышью, как на полосках конверта (координаты — в системе каждой ленты)
    let lightFrame = 0, lastMove = null;
    window.addEventListener('mousemove', (e) => {
        lastMove = e;
        if (lightFrame) return;
        lightFrame = requestAnimationFrame(() => {
            lightFrame = 0;
            layer.querySelectorAll('.nav-rib-body').forEach(b => {
                const r = b.getBoundingClientRect();
                b.style.setProperty('--gx', `${lastMove.clientX - r.left}px`);
                b.style.setProperty('--gy', `${lastMove.clientY - r.top}px`);
            });
        });
    }, { passive: true });

    // ссылку на ленте нажали — фокус уходит
    layer.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) a.blur(); });

    // пункт в шапке — текущий, если открыт раздел с его ленты (после роутера, он ставит свои)
    const mark = () => {
        const page = '#' + decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/')[0];
        items.forEach((x, i) => {
            const tab = tabOf(x);
            const a = wrap.querySelector(`.nav-top[data-rib="${i}"]`);
            if (!tab || !a) return;
            const on = tab.some(([h]) => h === page);
            a.classList.toggle('is-current', on);
            if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
    };
    window.addEventListener('hashchange', () => setTimeout(mark, 0));
    setTimeout(mark, 0);

    // ссылки на разделы на главной — из того же списка (все разделы с лент, без повторов)
    const tpl = document.getElementById('home-template');
    const homeLinks = tpl && tpl.content.querySelector('.pub-home-links');
    if (homeLinks) {
        const seen = new Set();
        const all = items.flatMap(x => tabOf(x) || [[x[0], x[1]]]).filter(([h]) => !seen.has(h) && seen.add(h));
        homeLinks.innerHTML = all.map(([h, n]) => `<a href="${esc(h)}">${esc(n)}</a>`).join('');
    }
})();
