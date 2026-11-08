// Страница «Активность»: итоговый рейтинг.
// Колонки: A место, C имя, D сумма, E лайки, I комментарии, N вопросы, S доп. баллы.
// Колонка B (VK ID) не выводится — по ней подсвечивается строка того, кто смотрит.
(() => {
    const { esc, link, plural, loadGviz, getViewerId } = RCU;

    const SHEET_ID = '1P3xjGhIAfUgq1savZwkf7bkBy0uhG8nV2i0iaiEDlNw';
    const SHEET_GID = '712278003';
    const PROFILE_PREFIX = 'https://vk.ru/id';

    // Столбцы со счётчиками: [колонка в таблице, подпись]
    const STATS = [
        ['E', 'лайки'],
        ['I', 'комментарии'],
        ['N', 'вопросы'],
        ['S', 'доп. баллы'],
    ];

    // Строки рейтинга в том виде, в каком их отдаёт Apps Script; публичная выгрузка — запасной вариант
    async function gvizRows() {
        const rows = await loadGviz(SHEET_ID, SHEET_GID);
        return rows
            .filter(cell => typeof cell('A')?.v === 'number' && cell.text('C'))
            .map(cell => ({
                place: cell('A').v,
                id: cell('B')?.v != null ? String(Math.round(cell('B').v)) : '',
                name: cell.text('C'),
                sum: cell.text('D') || '0',
                sumNum: Number(cell('D')?.v) || 0,
                stats: STATS.map(([col]) => cell.text(col) || '0'),
                statNums: STATS.map(([col]) => Number(cell(col)?.v) || 0),
            }));
    }

    async function sheetRows() {
        try {
            const data = await RCU.bundle();
            if (Array.isArray(data.activity)) return data.activity;
        } catch (e) { /* скрипт недоступен */ }
        return RCU.cached('activity', gvizRows);
    }

    async function load() {
        const [rows, viewerId] = await Promise.all([sheetRows(), getViewerId()]);
        const people = rows
            .map(p => ({ ...p, url: p.id ? PROFILE_PREFIX + p.id : '' }))
            // С нулевой суммой показываем только тех, у кого есть что-то в остальных столбцах —
            // это победитель прошлого месяца, ему ставим корону
            .filter(p => p.sumNum !== 0 || p.statNums.some(n => n !== 0))
            .map(p => ({ ...p, winner: p.sumNum === 0 }));
        return { people, viewerId };
    }

    const CROWN = `<button class="ac-crown" type="button" data-tip="победитель прошлого месяца" aria-label="Победитель прошлого месяца">👑</button>`;

    // На телефоне наведения нет — подсказка открывается касанием
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.ac-crown');
        document.querySelectorAll('.ac-crown.is-open').forEach(b => { if (b !== btn) b.classList.remove('is-open'); });
        if (btn) btn.classList.toggle('is-open');
    });

    function row(p, isMe) {
        const medal = p.place <= 3 ? ` is-top is-top-${p.place}` : '';
        return `
            <div class="ac-row${medal}${isMe ? ' is-me' : ''}" role="row">
                <div class="ac-place" role="cell">${esc(p.place)}</div>
                <div class="ac-name" role="cell">${link(p.url, p.name, 'ac-name-link')}${p.winner ? CROWN : ''}</div>
                <div class="ac-sum" role="cell">${esc(p.sum)}</div>
                ${p.stats.map((v, i) => `
                    <div class="ac-stat${/^0+$/.test(v) ? ' is-zero' : ''}" role="cell" data-label="${esc(STATS[i][1])}">${esc(v)}</div>`).join('')}
            </div>`;
    }

    RCU.pages.activity = {
        title: 'Активность',
        load,
        render(root, { people, viewerId }) {
            const me = viewerId ? people.find(p => p.id === viewerId) : null;

            let summary = '';
            if (me && me.winner) {
                summary = `<h2 class="user-title is-long">Вы победили в прошлом месяце, поэтому не попадаете в рейтинг этого</h2>`;
            } else if (me) {
                summary = `<h2 class="user-title">Вы на ${esc(me.place)} месте (${esc(me.sum)} ${plural(me.sumNum, 'балл', 'балла', 'баллов')})</h2>`;
            }
            if (summary) summary += RCU.dividerHTML();

            root.innerHTML = `
                ${summary}
                <div class="ac-table" role="table" aria-label="Рейтинг активности">
                    <div class="ac-row ac-head" role="row">
                        <div class="ac-place" role="columnheader">место</div>
                        <div class="ac-name" role="columnheader">имя</div>
                        <div class="ac-sum" role="columnheader">сумма</div>
                        ${STATS.map(([, label]) => `<div class="ac-stat" role="columnheader">${esc(label)}</div>`).join('')}
                    </div>
                    ${people.map(p => row(p, me && p.id === me.id)).join('')}
                </div>`;
        },
    };
})();
