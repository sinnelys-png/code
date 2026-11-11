// Публичный сайт, страница «Общежитие»: интерактивная схема домиков.
// Домики 1–16 — внешний круг, 17–28 — внутренний. Схема на весь блок; наведение на домик
// показывает окошко с жильцами по комнатам, нажатие его закрепляет
// (колонки «Дом в общежитии» и «Комната» Техтаблицы).
(() => {
    const { esc } = RCU;

    const CX = 500, CY = 500;
    // группы домиков (цвета со схемы, приглушённые под стиль сайта)
    // синие — мужские, фиолетовые — смешанные, красные — женские
    const MIXED = [3, 6, 8, 9, 11, 14, 21, 22, 23, 24];
    const GROUP = (n) => MIXED.includes(n) ? 'violet'
        : ((n >= 1 && n <= 7) || (n >= 17 && n <= 20)) ? 'blue' : 'red';

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

    // колонка P «можно ли соседа»: «да» / «нет» / «уточняйте у автора»
    const neighborState = (v) => {
        const t = String(v || '').toLowerCase();
        if (/^да|можно/.test(t)) return 'yes';
        if (/^нет/.test(t)) return 'no';
        if (/уточн|автор/.test(t)) return 'ask';
        return '';
    };
    const NEIGHBOR_TEXT = { yes: 'можно подселиться', ask: 'уточняйте у автора', no: 'без соседей' };

    function mapSVG(residents) {
        const houses = housePositions().map(h => {
            const people = residents[h.n] || [];
            const count = people.length;
            const free = people.some(c => neighborState(c.neighbor) === 'yes');
            return `
                <g class="dm-house dm-${GROUP(h.n)}${count ? ' has-people' : ''}${free ? ' has-free' : ''}" data-house="${h.n}" tabindex="0" role="button"
                    aria-label="Дом ${h.n}: ${count ? `${count} ${RCU.plural(count, 'жилец', 'жильца', 'жильцов')}` : 'пусто'}${free ? ', можно подселиться' : ''}"
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

    // тип общежития по номеру дома
    const KIND = (n) => (GROUP(n) === 'blue' ? 'мужское общежитие' : GROUP(n) === 'violet' ? 'смешанное общежитие' : 'женское общежитие');
    const ROOMS = 3, PLACES = 2;   // в доме три комнаты по два места
    const SIGN = { yes: '+', no: '×', ask: '?' };

    // окошко дома: заголовок, тип, комнаты с квадратными аватарами; пустое место — пунктир
    function popupHTML(n, residents) {
        const people = residents[n] || [];
        const byRoom = {};
        people.forEach(c => { const r = Number(String(c.room).match(/\d+/)?.[0]) || 0; (byRoom[r] = byRoom[r] || []).push(c); });
        const last = Math.max(ROOMS, ...Object.keys(byRoom).map(Number));
        const rooms = [];
        for (let r = 1; r <= last; r++) rooms.push(r);
        if (byRoom[0]) rooms.push(0);                       // комната не указана
        const ava = (c) => `
            <button class="dm-ava pc-open-char" type="button" data-name="${esc(c.name)}" title="${esc(c.name)}">
                ${RCU.safeUrl(c.avatar) ? `<img src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span>${esc(c.name.charAt(0))}</span>`}
            </button>`;
        return `
            <h3 class="dm-pop-title">дом ${n}</h3>
            <div class="dm-pop-kind">${KIND(n)}</div>
            ${rooms.map(r => {
                const list = byRoom[r] || [];
                // один жилец — на свободном месте знак его отметки про соседа:
                // + можно подселиться, × без соседей, ? уточняйте у автора (текст — при наведении)
                const st = list.length === 1 ? neighborState(list[0].neighbor) : '';
                const empty = r ? Math.max(0, PLACES - list.length) : 0;
                const slot = (i) => (i === 0 && st)
                    ? `<span class="dm-ava dm-ava--empty dm-ava--${st}" title="${NEIGHBOR_TEXT[st]}" aria-label="${NEIGHBOR_TEXT[st]}" tabindex="0">${SIGN[st]}</span>`
                    : '<span class="dm-ava dm-ava--empty" aria-label="свободное место"></span>';
                return `
                    <div class="dm-room">
                        <div class="dm-room-title">${r ? `комната ${r}` : 'комната не указана'}</div>
                        <div class="dm-room-people">${list.map(ava).join('')}${Array.from({ length: empty }, (_, i) => slot(i)).join('')}</div>
                    </div>`;
            }).join('')}`;
    }

    let current = 0;

    RCU.pages.dorm = {
        title: 'Общежитие',
        fullBleed: true,      // схема на весь блок
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
                    ${d.hasTech ? '' : '<p class="pc-soon dm-note">Жильцы появятся, когда обновится скрипт данных (Техтаблица).</p>'}
                    <div class="dm-pop" role="dialog" aria-live="polite" hidden></div>
                </div>`;

            // окошко у домика: наведение показывает, нажатие закрепляет (повторное — открепляет)
            const wrap = root.querySelector('.dm-wrap');
            const pop = root.querySelector('.dm-pop');
            const svg = root.querySelector('.dm-map');
            let pinned = 0;
            const show = (n) => {
                current = n;
                root.querySelectorAll('.dm-house').forEach(h => h.classList.toggle('is-active', Number(h.dataset.house) === n));
                if (!n) { pop.hidden = true; return; }
                pop.innerHTML = popupHTML(n, residents);
                pop.hidden = false;
                pop.classList.toggle('is-pinned', pinned === n);
                // рядом с домиком: справа, если влезает, иначе слева; по высоте — в пределах блока
                const house = root.querySelector(`.dm-house[data-house="${n}"]`).getBoundingClientRect();
                const box = wrap.getBoundingClientRect();
                const w = pop.offsetWidth, h = pop.offsetHeight;
                let x = house.right - box.left + 10;
                if (x + w > box.width - 8) x = house.left - box.left - w - 10;
                x = Math.max(8, Math.min(x, box.width - w - 8));
                const y = Math.max(8, Math.min(house.top - box.top + house.height / 2 - h / 2, box.height - h - 8));
                pop.style.left = `${x}px`;
                pop.style.top = `${y}px`;
            };

            svg.addEventListener('mouseover', (e) => {
                const h = e.target.closest('.dm-house');
                if (pinned || !h) return;
                if (Number(h.dataset.house) !== current) show(Number(h.dataset.house));
            });
            svg.addEventListener('mouseleave', () => { if (!pinned) show(0); });
            svg.addEventListener('click', (e) => {
                const h = e.target.closest('.dm-house');
                if (!h) { pinned = 0; show(0); return; }
                const n = Number(h.dataset.house);
                pinned = pinned === n ? 0 : n;
                show(pinned || n);
                if (!pinned) pop.classList.remove('is-pinned');
            });
            svg.addEventListener('keydown', (e) => {
                const h = e.target.closest('.dm-house');
                if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pinned = Number(h.dataset.house); show(pinned); }
            });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pinned) { pinned = 0; show(0); } });
        },
    };
})();
