// Публичный сайт, страница «Общежитие»: интерактивная схема домиков.
// Домики 1–16 — внешний круг, 17–28 — внутренний. По наведению или нажатию на домик
// под схемой показываются жильцы (колонки «Дом в общежитии» и «Комната» Техтаблицы).
(() => {
    const { esc } = RCU;

    const CX = 500, CY = 500;
    // группы домиков (цвета со схемы, приглушённые под стиль сайта)
    const GROUP = (n) => ((n >= 1 && n <= 7) || (n >= 17 && n <= 20)) ? 'blue'
        : ((n >= 8 && n <= 9) || (n >= 21 && n <= 24)) ? 'violet' : 'red';

    function housePositions() {
        const list = [];
        const at = (n, r, deg) => {
            const a = deg * Math.PI / 180;
            list.push({ n, x: CX + r * Math.cos(a), y: CY - r * Math.sin(a), rot: 90 - deg });
        };
        for (let i = 0; i < 16; i++) at(i + 1, 445, 186 - i * (192 / 15));          // внешний круг
        for (let i = 0; i < 6; i++) at(17 + i, 290, 222 - i * 23);                   // внутренний, слева
        for (let i = 0; i < 6; i++) at(23 + i, 290, 73 - i * 23);                    // внутренний, справа
        return list;
    }

    // номер дома из ячейки: «18», «д. 18», «Дом 18» → 18
    const houseNo = (v) => { const m = String(v || '').match(/\d+/); return m ? Number(m[0]) : 0; };

    function mapSVG(residents) {
        const houses = housePositions().map(h => {
            const count = (residents[h.n] || []).length;
            return `
                <g class="dm-house dm-${GROUP(h.n)}${count ? ' has-people' : ''}" data-house="${h.n}" tabindex="0" role="button"
                    aria-label="Дом ${h.n}: ${count ? `${count} ${RCU.plural(count, 'жилец', 'жильца', 'жильцов')}` : 'пусто'}"
                    transform="translate(${h.x.toFixed(1)} ${h.y.toFixed(1)})">
                    <rect x="-24" y="-24" width="48" height="48" rx="4" transform="rotate(${h.rot.toFixed(1)})" />
                    <text class="dm-num" y="7">${h.n}</text>
                    ${count ? `<g class="dm-badge" transform="translate(22 -22)"><circle r="12" /><text y="4.5">${count}</text></g>` : ''}
                </g>`;
        }).join('');

        return `
            <svg class="dm-map" viewBox="0 0 1000 1090" role="img" aria-label="Схема общежития">
                <defs>
                    <clipPath id="dm-lawn-clip"><rect x="0" y="0" width="1000" height="${CY + 175}" /></clipPath>
                </defs>
                <!-- кольцевая дорога -->
                <circle class="dm-road" cx="${CX}" cy="${CY}" r="370" />
                <!-- выезд вниз -->
                <rect class="dm-road-fill" x="${CX - 42}" y="${CY + 330}" width="84" height="${1090 - CY - 330}" />
                <line class="dm-road-line" x1="${CX}" y1="${CY + 400}" x2="${CX}" y2="1090" />
                <!-- газон -->
                <circle class="dm-lawn" cx="${CX}" cy="${CY}" r="235" clip-path="url(#dm-lawn-clip)" />
                <!-- парковка -->
                <path class="dm-parking" d="M ${CX - 218} ${CY + 185} L ${CX + 218} ${CY + 185} A 218 150 0 0 1 ${CX - 218} ${CY + 185} Z" />
                ${[0, 1].map(row => {
                    const y = CY + 215 + row * 55;
                    const xs = Array.from({ length: 11 }, (_, i) => CX - 150 + i * 30);
                    return `<path class="dm-parking-lines" d="M ${CX - 150} ${y} H ${CX + 150} ${xs.map(x => `M ${x} ${y} v -18`).join(' ')}" />`;
                }).join('')}
                <!-- ворота -->
                <path class="dm-gate" d="M ${CX - 40} ${CY + 335} q 20 -18 38 0 M ${CX + 2} ${CY + 335} q 20 -18 38 0" />
                <!-- терминал, зоны курения, охрана -->
                <g class="dm-icon" transform="translate(${CX} ${CY - 300})"><rect x="-20" y="-20" width="40" height="40" rx="4" /><text y="7">£</text></g>
                <g class="dm-icon" transform="translate(${CX - 455} ${CY + 105})"><rect x="-20" y="-20" width="40" height="40" rx="4" /><path class="dm-ico" d="M -13 6 h 20 v 5 h -20 z M 9 6 h 4 v 5 h -4 z M -9 -1 q 3 -4 0 -8 M -4 -1 q 3 -4 0 -8" /></g>
                <g class="dm-icon" transform="translate(${CX + 455} ${CY + 105})"><rect x="-20" y="-20" width="40" height="40" rx="4" /><path class="dm-ico" d="M -13 6 h 20 v 5 h -20 z M 9 6 h 4 v 5 h -4 z M -9 -1 q 3 -4 0 -8 M -4 -1 q 3 -4 0 -8" /></g>
                <g class="dm-icon" transform="translate(${CX + 85} ${CY + 470})"><rect x="-20" y="-20" width="40" height="40" rx="4" /><path class="dm-ico" d="M -12 4 q 12 -18 24 0 z M -14 4 h 28 v 3 h -28 z" /></g>
                ${houses}
            </svg>`;
    }

    function panel(n, residents) {
        const people = residents[n] || [];
        if (!n) return '<p class="pc-soon">Наведите на домик или нажмите на него, чтобы увидеть жильцов.</p>';
        return `
            <h3 class="dl-section-title dm-panel-title">
                <span class="dl-group-name">дом ${n}</span>
                <span class="dl-group-count">${people.length}</span>
            </h3>
            ${people.length
                ? `<div class="dm-people">${people.map(c => `
                    <div class="dm-person">
                        ${RCU.smallCharacterCard(c)}
                        ${c.room ? `<span class="dm-room">комната ${esc(c.room)}</span>` : ''}
                    </div>`).join('')}</div>`
                : '<p class="pc-soon">Здесь пока никто не живёт.</p>'}`;
    }

    let current = 0;

    RCU.pages.dorm = {
        title: 'Общежитие',
        load: () => RCU.publicData(),
        render(root, d) {
            RCU.setPublicData(d);
            const residents = {};
            d.characters.forEach(c => {
                const n = houseNo(c.house);
                if (n) (residents[n] = residents[n] || []).push(c);
            });
            Object.values(residents).forEach(list => list.sort((a, b) =>
                (String(a.room).localeCompare(String(b.room), 'ru', { numeric: true })) || a.name.localeCompare(b.name, 'ru')));

            root.innerHTML = `
                <div class="dm-wrap">
                    ${mapSVG(residents)}
                    <ul class="dm-legend">
                        <li><svg class="dm-legend-icon" viewBox="-20 -20 40 40"><text y="7">£</text></svg> терминал</li>
                        <li><svg class="dm-legend-icon" viewBox="-20 -20 40 40">${'<path class="dm-ico" d="M -13 6 h 20 v 5 h -20 z M 9 6 h 4 v 5 h -4 z M -9 -1 q 3 -4 0 -8 M -4 -1 q 3 -4 0 -8" />'}</svg> зона курения</li>
                        <li><svg class="dm-legend-icon" viewBox="-20 -20 40 40">${'<path class="dm-ico" d="M -12 4 q 12 -18 24 0 z M -14 4 h 28 v 3 h -28 z" />'}</svg> охранная будка</li>
                    </ul>
                    ${d.hasTech ? '' : '<p class="pc-soon">Жильцы появятся, когда обновится скрипт данных (Техтаблица).</p>'}
                    <div class="dm-panel" aria-live="polite">${panel(current, residents)}</div>
                </div>`;

            const panelEl = root.querySelector('.dm-panel');
            const show = (n) => {
                current = n;
                root.querySelectorAll('.dm-house').forEach(h => h.classList.toggle('is-active', Number(h.dataset.house) === n));
                panelEl.innerHTML = panel(n, residents);
                RCU.widenHeadings(panelEl);
            };
            if (current) show(current);

            const svg = root.querySelector('.dm-map');
            svg.addEventListener('mouseover', (e) => {
                const h = e.target.closest('.dm-house');
                if (h && Number(h.dataset.house) !== current) show(Number(h.dataset.house));
            });
            svg.addEventListener('click', (e) => {
                const h = e.target.closest('.dm-house');
                if (h) show(Number(h.dataset.house));
            });
            svg.addEventListener('keydown', (e) => {
                const h = e.target.closest('.dm-house');
                if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(Number(h.dataset.house)); }
            });
        },
    };
})();
