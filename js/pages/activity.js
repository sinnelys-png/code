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

    async function load() {
        const [rows, viewerId] = await Promise.all([loadGviz(SHEET_ID, SHEET_GID), getViewerId()]);
        const people = rows
            .filter(cell => typeof cell('A')?.v === 'number' && cell.text('C'))
            .map(cell => {
                const id = cell('B')?.v != null ? String(Math.round(cell('B').v)) : '';
                return {
                    place: cell('A').v,
                    name: cell.text('C'),
                    url: id ? PROFILE_PREFIX + id : '',
                    id,
                    sum: cell.text('D') || '0',
                    sumNum: Number(cell('D')?.v) || 0,
                    stats: STATS.map(([col]) => cell.text(col) || '0'),
                    statNums: STATS.map(([col]) => Number(cell(col)?.v) || 0),
                };
            })
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

            const summary = me ? `
                <div class="ac-me">
                    <span class="ac-me-label">Ваше место</span>
                    <span class="ac-me-place">${esc(me.place)}</span>
                    <span class="ac-me-sum">${esc(me.sum)} ${plural(me.sumNum, 'балл', 'балла', 'баллов')}</span>
                </div>` : '';

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
