// Генератор хэштегов для поста (мини-приложение, #tags). Повторяет лист-генератор
// в таблице дедлайнов: персонаж, соавторы (коллаб), разделитель, отметки поста
// и текст ссылки на тему персонажа. В меню не выводится — ссылка есть на главной.
(() => {
    const { esc } = RCU;

    const MARKS = ['Сюжет', 'Ивент', 'Коллаб', 'Флешмоб', 'Бутылочка', 'Активность'];
    const SEPARATORS = [[' // ', '//'], [' | ', '|'], [' ✦ ', '✦'], [' ', 'пробел'], ['\n', 'перенос строки'], ['custom', 'свой']];

    // «Феликс-Лэйтон Бёрнс» → «#Феликс_Лэйтон_Бёрнс_RCU» (как в тегах расписания)
    const tagOf = (text) => '#' + String(text).trim().replace(/[\s\-–—]+/g, '_') + '_RCU';

    let state = null;

    function result() {
        const { main, coauthors, sep, custom, marks, linkText, byName } = state;
        const separator = sep === 'custom' ? custom : sep;
        const tags = [];
        if (main) tags.push(tagOf(main));
        coauthors.forEach(n => { if (n !== main) tags.push(tagOf(n)); });
        MARKS.forEach(m => { if (marks.has(m)) tags.push(tagOf(m)); });
        let text = tags.join(separator);
        const topic = main && byName.get(main) && byName.get(main).topicUrl;
        if (topic && linkText.trim()) text += `\n\n[${topic}|${linkText.trim()}]`;
        return text;
    }

    function update(root) {
        root.querySelector('.tg-result').value = result();
        root.querySelector('.tg-coauthors').innerHTML = state.coauthors.map(n => `
            <span class="tg-chip">${esc(n)}<button class="tg-chip-x" type="button" data-remove="${esc(n)}" aria-label="Убрать">×</button></span>`).join('');
        root.querySelector('.tg-custom').hidden = state.sep !== 'custom';
        root.querySelectorAll('.tg-mark').forEach(b => b.setAttribute('aria-pressed', String(state.marks.has(b.dataset.mark))));
        root.querySelectorAll('.tg-sep').forEach(b => b.setAttribute('aria-pressed', String(state.sep === b.dataset.sep)));
    }

    RCU.pages.tags = {
        title: 'Хэштеги',
        load: () => RCU.dataOf('deadlines'),
        render(root, [rows, viewerId]) {
            const byName = new Map(rows.map(r => [r.name, r]));
            const names = [...byName.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
            const mine = viewerId ? rows.filter(r => r.playerId === viewerId).map(r => r.name) : [];
            state = { main: mine.length === 1 ? mine[0] : '', coauthors: [], sep: ' // ', custom: '', marks: new Set(), linkText: 'Задать вопрос персонажу', byName };

            const options = names.map(n => `<option value="${esc(n)}"></option>`).join('');
            root.innerHTML = `
                <datalist id="tg-names">${options}</datalist>
                <div class="tg-form">
                    <label class="tg-field">
                        <span class="tg-label">ваш персонаж</span>
                        <input class="dl-search-input tg-input tg-main" list="tg-names" autocomplete="off"
                            placeholder="начните набирать имя" value="${esc(state.main)}">
                    </label>
                    ${mine.length > 1 ? `<div class="tg-mine">${mine.map(n => `<button class="tg-pick" type="button" data-pick="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}

                    <label class="tg-field">
                        <span class="tg-label">соавторы (если коллаб)</span>
                        <input class="dl-search-input tg-input tg-co" list="tg-names" autocomplete="off" placeholder="имя соавтора, Enter — добавить">
                    </label>
                    <div class="tg-coauthors"></div>

                    <div class="tg-field">
                        <span class="tg-label">разделитель</span>
                        <div class="tg-buttons">
                            ${SEPARATORS.map(([v, t]) => `<button class="tg-toggle tg-sep" type="button" data-sep="${esc(v)}" aria-pressed="false">${esc(t)}</button>`).join('')}
                            <input class="dl-search-input tg-input tg-custom" placeholder="свой символ" hidden>
                        </div>
                    </div>

                    <div class="tg-field">
                        <span class="tg-label">пост</span>
                        <div class="tg-buttons">
                            ${MARKS.map(m => `<button class="tg-toggle tg-mark" type="button" data-mark="${esc(m)}" aria-pressed="false">${esc(m.toLowerCase())}</button>`).join('')}
                        </div>
                    </div>

                    <label class="tg-field">
                        <span class="tg-label">текст ссылки на тему (только для основного персонажа)</span>
                        <input class="dl-search-input tg-input tg-link" value="${esc(state.linkText)}">
                    </label>

                    <div class="tg-field">
                        <span class="tg-label">готово — скопируйте в пост</span>
                        <textarea class="tg-result" rows="4" readonly></textarea>
                        <button class="tg-toggle tg-copy" type="button">скопировать</button>
                    </div>
                </div>`;

            const main = root.querySelector('.tg-main');
            const co = root.querySelector('.tg-co');
            const addCo = () => {
                const n = co.value.trim();
                if (byName.has(n) && !state.coauthors.includes(n)) {
                    state.coauthors.push(n);
                    state.marks.add('Коллаб');
                }
                co.value = '';
                update(root);
            };
            main.addEventListener('input', () => { state.main = byName.has(main.value.trim()) ? main.value.trim() : ''; update(root); });
            co.addEventListener('change', addCo);
            co.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCo(); } });
            root.querySelector('.tg-link').addEventListener('input', (e) => { state.linkText = e.target.value; update(root); });
            root.querySelector('.tg-custom').addEventListener('input', (e) => { state.custom = e.target.value; update(root); });
            root.querySelector('.tg-form').addEventListener('click', async (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                if (b.dataset.pick) { state.main = b.dataset.pick; main.value = b.dataset.pick; }
                else if (b.dataset.remove) {
                    state.coauthors = state.coauthors.filter(n => n !== b.dataset.remove);
                    if (!state.coauthors.length) state.marks.delete('Коллаб');
                }
                else if (b.dataset.sep != null) state.sep = b.dataset.sep;
                else if (b.dataset.mark) state.marks.has(b.dataset.mark) ? state.marks.delete(b.dataset.mark) : state.marks.add(b.dataset.mark);
                else if (b.classList.contains('tg-copy')) {
                    const area = root.querySelector('.tg-result');
                    try { await navigator.clipboard.writeText(area.value); }
                    catch (err) { area.select(); document.execCommand('copy'); }
                    b.textContent = 'скопировано';
                    setTimeout(() => { b.textContent = 'скопировать'; }, 1500);
                    return;
                }
                update(root);
            });
            update(root);
        },
    };
})();
