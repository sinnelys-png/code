// Публичный сайт, страница «Университет» — карта кампуса.
// Карта широкая, из трёх частей (план 4000×1000): слева 5 корпус (1500×1000), посередине главный
// двор с корпусами 1–2 и 3–4, стадионом сверху и парковкой снизу (1000×1000), справа 6 корпус
// в саду (1500×1000). В кадре — одна часть (сначала двор), между частями — кнопки над картой,
// проходы в корпусах и свайп; можно посмотреть и весь кампус сразу.
// Каждый факультет — участок своего корпуса цвета факультета (кто где — CAMPUS ниже);
// нажатие на участок открывает этот факультет на странице «Факультеты».
// Список факультетов, подписи и цвета берутся у страницы факультетов (RCU.facultyKit).
(() => {
    const { esc } = RCU;
    const kit = () => RCU.facultyKit || { shortLabel: (f) => f.title, facBright: () => '' };
    const shortLabel = (f) => kit().shortLabel(f);
    const facBright = (f) => kit().facBright(f);

    // где какой факультет: участки корпусов в координатах плана — [часть названия, x1, y1, x2, y2]
    const CAMPUS = [
        // корпуса 1–2 (двор, слева): крыло вдоль верха и крыло вдоль левого края
        ['химико', 1660, 160, 1780, 250], ['механико', 1780, 160, 1900, 250],
        ['философ', 1560, 250, 1660, 450], ['историко', 1560, 550, 1660, 750],
        // корпуса 3–4 (двор, справа); нижнее крыло — 4 корпус, там директор и персонал
        ['журналист', 2100, 160, 2220, 250], ['реклам', 2220, 160, 2340, 250],
        ['экономич', 2340, 250, 2440, 450], ['юридич', 2340, 550, 2440, 750],
        ['персонал', 2100, 750, 2340, 840],
        // 5 корпус (слева, литой)
        ['художеств', 260, 330, 560, 780], ['музыкал', 560, 330, 860, 780], ['филолог', 860, 330, 1160, 780],
        // 6 корпус (справа, в саду)
        ['гостинич', 3080, 340, 3310, 660], ['спортив', 3310, 340, 3540, 660],
    ];
    // факультет, которого нет в списке, — на свободное место перед 5 корпусом
    const SPARE = [[300, 840, 460, 940], [540, 840, 700, 940], [780, 840, 940, 940], [1000, 840, 1160, 940]].map(r => ['', ...r]);

    const zoneOf = (f, spare) => {
        const title = String(f.staff ? 'персонал' : f.title || '').toLowerCase();
        return CAMPUS.find(([key]) => title.includes(key)) || SPARE[spare.n++ % SPARE.length];
    };

    // части карты (viewBox) и какая сейчас в кадре
    const VIEWS = { left: [0, 0, 1500, 1000], center: [1500, 0, 1000, 1000], right: [2500, 0, 1500, 1000], all: [0, 0, 4000, 1000] };
    const VIEW_ORDER = ['left', 'center', 'right'];
    const MAP_NAV = [['left', '5 корпус'], ['center', 'корпуса 1–4'], ['right', '6 корпус'], ['all', 'весь кампус']];
    const viewOfX = (x) => (x < 1500 ? 'left' : x < 2500 ? 'center' : 'right');
    let mapView = 'center';

    function campusSVG(list) {
        const R = (x1, y1, x2, y2) => `M${x1} ${y1} H${x2} V${y2} H${x1} Z`;
        const B = (d) => `<path class="fc-map-bld" d="${d}" />`;
        const T = (x, y, txt, extra = '') => `<text class="fc-map-label fc-map-label--small" x="${x}" y="${y}"${extra}>${txt}</text>`;
        const num = (x, y, n) => `<text class="fc-map-num" x="${x}" y="${y}">${n}</text>${T(x, y + 24, 'корпус')}`;
        const go = (view, title, inner) => `<g class="fc-go" data-go="${view}" role="button" tabindex="0" aria-label="${title}"><title>${title}</title>${inner}</g>`;
        // переход на другую страницу (общежитие, город): подпись с невидимой площадкой под нажатие
        const link = (href, title, x, y, label, slide) => `<g class="fc-go fc-go--page" data-href="${href}" data-slide="${slide}" role="link" tabindex="0" aria-label="${title}"><title>${title}</title><rect class="fc-go-hit" x="${x}" y="${y}" width="190" height="100" />${T(x + 95, y + 58, label, ' style="font-size:26px"')}</g>`;
        const tree = (x, y, r = 26) => `<circle class="fc-map-tree" cx="${x}" cy="${y}" r="${r}" />`;

        const spare = { n: 0 };
        const zones = list.map(({ f }, pos) => {
            const [, x1, y1, x2, y2] = zoneOf(f, spare);
            const w = x2 - x1, h = y2 - y1, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
            const fs = Math.round(Math.max(20, Math.min(44, w / 5, h / 3.5)));
            const name = esc(f.staff ? 'Персонал' : f.title);
            return `
                <g class="fc-zone" data-pos="${pos}" data-view="${viewOfX(cx)}" role="button" tabindex="0" aria-label="${name}" style="--zone:${facBright(f) || 'var(--gold-55)'}">
                    <title>${name}</title>
                    <rect class="fc-zone-area" x="${x1 + 5}" y="${y1 + 5}" width="${w - 10}" height="${h - 10}" rx="4" />
                    <text class="fc-zone-label" x="${cx}" y="${Math.round(cy + fs * 0.35)}" style="font-size:${fs}px">${esc(shortLabel(f))}</text>
                </g>`;
        }).join('');

        return `
            <svg class="fc-map" viewBox="${VIEWS[mapView].join(' ')}">
                <!-- ===== слева: 5 корпус ===== -->
                <rect class="fc-map-ground" x="10" y="10" width="1480" height="980" rx="6" />
                <rect class="fc-map-road" x="1160" y="475" width="400" height="50" />
                ${[1240, 1320, 1400].map(x => tree(x, 430, 18) + tree(x, 570, 18)).join('')}
                ${B(R(260, 220, 1160, 780))}
                <text class="fc-map-num" x="650" y="305" style="font-size:80px">5</text>${T(695, 300, 'корпус', ' style="text-anchor:start;font-size:32px"')}
                ${go('center', 'к корпусам 1–4', T(1470, 455, 'корпуса 1–4 →', ' style="text-anchor:end;font-size:32px"'))}

                <!-- ===== посередине: главный двор ===== -->
                <rect class="fc-map-ground" x="1510" y="10" width="980" height="980" rx="6" />
                <!-- стадион сверху, за ним — общежитие -->
                <rect class="fc-map-yard" x="1720" y="30" width="560" height="100" rx="50" />
                <rect class="fc-map-ring" x="1755" y="52" width="490" height="56" rx="28" />
                ${T(2000, 88, 'стадион')}
                ${link('#dorm', 'в общежитие', 2290, 25, 'общежитие ↑', 'up')}
                <!-- парковка снизу, за ней — город -->
                <rect class="fc-map-yard" x="1750" y="870" width="500" height="100" rx="4" />
                ${Array.from({ length: 11 }, (_, k) => `<line class="fc-map-line" x1="${1790 + k * 42}" y1="928" x2="${1790 + k * 42}" y2="970" />`).join('')}
                ${T(2000, 908, 'парковка')}
                ${link('#city', 'в город', 2290, 875, 'город ↓', 'down')}
                <!-- корпуса 1–2 и 3–4 -->
                ${B('M1560 160 H1900 V250 H1660 V750 H1900 V840 H1560 Z')}
                ${B('M2440 160 H2100 V250 H2340 V750 H2100 V840 H2440 Z')}
                ${num(1610, 214, 2)}${num(1610, 804, 1)}${num(2390, 214, 3)}${num(2390, 804, 4)}
                <!-- проходы: из 1–2 к 5 корпусу, из 3–4 к 6 -->
                <rect class="fc-map-road" x="1490" y="475" width="70" height="50" />
                <rect class="fc-map-road" x="2440" y="475" width="70" height="50" />
                ${go('left', 'к 5 корпусу', `<rect class="fc-go-hit" x="1560" y="455" width="240" height="90" /><rect class="fc-map-hall" x="1565" y="455" width="90" height="90" /><text class="fc-go-arrow" x="1610" y="514">←</text>${T(1675, 507, '5 корпус', ' style="text-anchor:start"')}`)}
                ${go('right', 'к 6 корпусу', `<rect class="fc-go-hit" x="2200" y="455" width="240" height="90" /><rect class="fc-map-hall" x="2345" y="455" width="90" height="90" /><text class="fc-go-arrow" x="2390" y="514">→</text>${T(2325, 507, '6 корпус', ' style="text-anchor:end"')}`)}
                <!-- двор: площадки-треугольники и фонтан -->
                <path class="fc-map-yard" d="M1720 300 H1880 L1720 430 Z" />
                <path class="fc-map-yard" d="M2280 300 H2120 L2280 430 Z" />
                <path class="fc-map-yard" d="M1720 700 H1880 L1720 570 Z" />
                <path class="fc-map-yard" d="M2280 700 H2120 L2280 570 Z" />
                <circle class="fc-map-ring" cx="2000" cy="500" r="110" />
                <circle class="fc-map-ring" cx="2000" cy="500" r="86" />
                <circle class="fc-map-water" cx="2000" cy="500" r="46" />
                ${T(2000, 507, 'фонтан')}
                ${T(1800, 288, 'беседка')}${T(2200, 288, 'кладовая')}
                ${T(1800, 730, 'спорт. площадка')}${T(2200, 730, 'зона отдыха')}

                <!-- ===== справа: 6 корпус в саду ===== -->
                <rect class="fc-map-ground" x="2510" y="10" width="1480" height="980" rx="6" />
                <rect class="fc-map-road" x="2490" y="475" width="160" height="50" />
                <rect class="fc-map-garden" x="2620" y="110" width="1260" height="780" rx="80" />
                <rect class="fc-map-path" x="2900" y="280" width="700" height="440" rx="30" />
                <line class="fc-map-path" x1="2650" y1="500" x2="2900" y2="500" />
                ${[[2700, 180], [2800, 240], [2720, 330], [2790, 400], [2700, 640], [2790, 720], [2720, 830], [2900, 170], [3050, 200],
                    [3200, 165], [3380, 205], [3530, 175], [3680, 175], [3800, 250], [3760, 370], [3820, 480], [3700, 560], [3810, 650],
                    [3750, 800], [3600, 830], [3450, 790], [3280, 830], [3120, 790], [2960, 820], [2850, 610]].map(([x, y]) => tree(x, y)).join('')}
                ${T(3250, 262, 'сад', ' style="font-size:32px"')}
                ${B(R(2960, 340, 3540, 660))}
                <text class="fc-map-num" x="3020" y="510" style="font-size:72px">6</text>${T(3020, 545, 'корпус', ' style="font-size:26px"')}
                ${go('center', 'к корпусам 1–4', T(2530, 455, '← корпуса 1–4', ' style="text-anchor:start;font-size:32px"'))}

                <!-- факультеты -->
                ${zones}
            </svg>`;
    }

    function campusHTML(list) {
        return `
            <div class="uv-campus">
                <div class="fc-map-nav">${MAP_NAV.map(([v, label]) => `
                    <button type="button" class="fc-map-go${v === mapView ? ' is-on' : ''}" data-go="${v}" aria-pressed="${v === mapView}">${label}</button>`).join('')}
                </div>
                ${campusSVG(list)}
            </div>`;
    }

    // переход между частями карты: viewBox плавно переезжает; кадр — всегда квадрат, части поуже встают по центру
    function setView(car, name) {
        const svg = car.querySelector('.fc-map');
        if (!svg || !VIEWS[name]) return;
        mapView = name;
        car.querySelectorAll('.fc-map-go').forEach(b => {
            b.classList.toggle('is-on', b.dataset.go === name);
            b.setAttribute('aria-pressed', String(b.dataset.go === name));
        });
        const from = svg.getAttribute('viewBox').split(/\s+/).map(Number), to = VIEWS[name];
        cancelAnimationFrame(svg._vb || 0);
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { svg.setAttribute('viewBox', to.join(' ')); return; }
        const t0 = performance.now(), D = 650;
        const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
        const step = (now) => {
            const p = Math.min(1, (now - t0) / D), e = ease(p);
            svg.setAttribute('viewBox', from.map((a, k) => (a + (to[k] - a) * e).toFixed(1)).join(' '));
            if (p < 1) svg._vb = requestAnimationFrame(step);
        };
        svg._vb = requestAnimationFrame(step);
    }

    function wireCampus(car, list) {
        if (!car) return;
        let swiped = false;
        const pick = (e) => {
            if (swiped) return;
            const page = e.target.closest('[data-href]');
            if (page) { location.hash = page.dataset.href; return; }
            const go = e.target.closest('[data-go]');
            if (go) { setView(car, go.dataset.go); return; }
            const zone = e.target.closest('.fc-zone');
            const hit = zone && list[Number(zone.dataset.pos)];
            if (!hit) return;
            zone.classList.add('is-picked');
            location.hash = `#faculties/${String(hit.f.title || '').trim().replace(/\s+/g, '_')}`;
        };
        car.addEventListener('click', pick);
        car.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'BUTTON') return;       // у кнопок нажатие и так приходит кликом
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); }
        });
        // участок в другой части карты получил фокус (Tab) — карта переезжает к нему
        car.addEventListener('focusin', (e) => {
            const z = e.target.closest && e.target.closest('.fc-zone');
            if (z && mapView !== 'all' && z.dataset.view !== mapView) setView(car, z.dataset.view);
        });
        // свайп пальцем по карте — в соседнюю часть
        const svg = car.querySelector('.fc-map');
        let sx = null, sy = 0;
        svg.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
        svg.addEventListener('pointercancel', () => { sx = null; });
        svg.addEventListener('pointerup', (e) => {
            if (sx === null) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            sx = null;
            if (mapView === 'all' || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            const next = VIEW_ORDER[VIEW_ORDER.indexOf(mapView) + (dx < 0 ? 1 : -1)];
            swiped = true;
            setTimeout(() => { swiped = false; }, 350);
            if (next) setView(car, next);
        });
    }

    RCU.pages.university = {
        title: 'Университет',
        load: () => RCU.publicData(),
        render(root, d) {
            if (RCU.setPublicData) RCU.setPublicData(d);
            const list = RCU.facultyKit ? RCU.facultyKit.list(d) : [];
            root.innerHTML = campusHTML(list);
            wireCampus(root.querySelector('.uv-campus'), list);
        },
    };
})();
