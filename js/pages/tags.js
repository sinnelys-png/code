// Генератор хэштегов для поста (мини-приложение, #tags). Повторяет лист-генератор
// в таблице дедлайнов: персонаж, персонажи соавторов, разделитель, дополнительные теги
// и текст ссылки на тему персонажа. В меню не выводится — ссылка есть на главной.
(() => {
    const { esc } = RCU;

    // дополнительные теги: название, тег, описание (показывается под кнопками, когда тег выбран)
    const MARKS = [
        ['Сюжет', 'ответ содержит сюжет персонажа'],
        ['Ивент', 'ответ в рамках ивента'],
        ['Флешмоб', 'ответ в рамках флешмоба'],
        ['Коллаб', 'ответ сделан совместными усилиями с другим отвечающим; тег не ставится, если персонажи находятся в дуэте'],
        ['Игровая', 'ответ в рамках игровой'],
        ['Активность', 'ответ содержит подроль персонажа'],
        ['Прочее', 'ответ без использования новых иллюстраций — коллажи, бинго и т. д. (не засчитывается в дедлайн)'],
    ];
    // разделители: [значение, подпись]; «свой» — символ с пробелами, «свой с переносом» — с переносами строк
    const SEPARATORS = [[' // ', '//'], [' | ', '|'], [' ✦ ', '✦'], [' ', 'пробел'], ['\n', 'перенос строки'],
        ['custom', 'свой'], ['custom-nl', 'свой с переносом']];

    // «Феликс-Лэйтон Бёрнс» → «#Феликс_Лэйтон_Бёрнс_RCU» (как в тегах расписания)
    const tagOf = (text) => '#' + String(text).trim().replace(/[\s\-–—]+/g, '_') + '_RCU';

    let state = null;

    // актуальная подроль персонажа; «[актуальная подроль у дуэта]» — берём у дуэта
    function subroleOf(name) {
        const row = state.byName.get(name);
        if (!row) return '';
        let sub = String(row.activeSub || '');
        if (/у\s+дуэта/i.test(sub) && row.duet && state.byName.get(row.duet)) sub = String(state.byName.get(row.duet).activeSub || '');
        return /^-*$/.test(sub.trim()) ? '' : sub.trim();
    }

    function separator() {
        const { sep, custom } = state;
        if (sep === 'custom') return ` ${custom.trim()} `;
        if (sep === 'custom-nl') return `\n${custom.trim()}\n`;
        return sep;
    }

    function result() {
        const { main, coauthors, marks, linkText, withLink, byName } = state;
        const people = [main, ...coauthors.filter(n => n !== main)].filter(Boolean);
        const tags = people.map(tagOf);
        // роль любого из персонажей: преподаватель — #Преподаватель_RCU, персонал — #Персонал_RCU
        const roles = people.map(n => String((byName.get(n) || {}).role || '').toLowerCase());
        if (roles.some(r => r.includes('преподав'))) tags.push(tagOf('Преподаватель'));
        if (roles.some(r => r.includes('персонал'))) tags.push(tagOf('Персонал'));
        MARKS.forEach(([m]) => {
            if (!marks.has(m)) return;
            if (m === 'Сюжет') people.forEach(n => tags.push(tagOf(`Сюжет ${n}`)));      // #Сюжет_Имя_Фамилия_RCU
            else if (m === 'Активность') {
                // подроль-клуб — тег клуба вместо #Активность_RCU (#Литературный_клуб_RCU)
                let plain = !people.length;
                people.forEach(n => {
                    const sub = subroleOf(n);
                    if (/клуб|club/i.test(sub)) tags.push(tagOf(sub)); else plain = true;
                });
                if (plain) tags.push(tagOf('Активность'));
            } else tags.push(tagOf(m));
        });
        let text = [...new Set(tags)].join(separator());
        const topic = main && byName.get(main) && byName.get(main).topicUrl;
        // ссылка на тему: галочка снята — без ссылки; текст пустой — просто адрес темы
        if (topic && withLink) text += linkText.trim() ? `\n\n[${topic}|${linkText.trim()}]` : `\n\n${topic}`;
        return text;
    }

    // персонажи состоят в дуэте (в любую сторону)
    const inDuet = (a, b) => {
        const ra = state.byName.get(a), rb = state.byName.get(b);
        return !!a && !!b && ((ra && ra.duet === b) || (rb && rb.duet === a));
    };
    const peopleCount = () => (state.main ? 1 : 0) + state.coauthors.filter(n => n !== state.main).length;
    // больше двух персонажей и флешмоб или ивент — общий пост, не коллаб
    const groupEvent = () => peopleCount() > 2 && (state.marks.has('Флешмоб') || state.marks.has('Ивент'));

    // как только условие наступило — снимаем «коллаб»; включить его обратно можно вручную
    function applyRules() {
        const group = groupEvent();
        if (group && !state.groupWas) state.marks.delete('Коллаб');
        state.groupWas = group;
    }

    function update(root) {
        applyRules();
        root.querySelector('.tg-result').value = result();
        root.querySelector('.tg-coauthors').innerHTML = state.coauthors.map(n => `
            <span class="tg-chip">${esc(n)}<button class="tg-chip-x" type="button" data-remove="${esc(n)}" aria-label="Убрать">×</button></span>`).join('');
        root.querySelector('.tg-custom').hidden = !/^custom/.test(state.sep);
        root.querySelectorAll('.tg-mark').forEach(b => b.setAttribute('aria-pressed', String(state.marks.has(b.dataset.mark))));
        root.querySelectorAll('.tg-sep').forEach(b => b.setAttribute('aria-pressed', String(state.sep === b.dataset.sep)));
        // описания выбранных тегов — под кнопками
        root.querySelector('.tg-notes').innerHTML = MARKS.filter(([m]) => state.marks.has(m))
            .map(([m, note]) => `<li><span class="tg-note-name">${esc(m.toLowerCase())}</span> — ${esc(note)}</li>`).join('');
    }

    RCU.pages.tags = {
        title: 'Хэштеги',
        load: () => RCU.dataOf('deadlines'),
        render(root, [rows, viewerId]) {
            const byName = new Map(rows.map(r => [r.name, r]));
            const names = [...byName.keys()].sort((a, b) => a.localeCompare(b, 'ru'));
            const mine = viewerId ? rows.filter(r => r.playerId === viewerId).map(r => r.name) : [];
            state = { main: mine.length === 1 ? mine[0] : '', coauthors: [], sep: ' // ', custom: '', marks: new Set(), linkText: 'Задать вопрос персонажу', withLink: true, byName, groupWas: false };

            // подсказки имён — свой список прямо под полем (встроенный список браузера
            // уезжал вбок и подсвечивал поле белым как автозаполнение)
            root.innerHTML = `
                <div class="tg-form">
                    <div class="tg-field">
                        <span class="tg-label">ваш персонаж</span>
                        <div class="tg-suggest">
                            <input class="dl-search-input tg-input tg-main" autocomplete="off"
                                placeholder="начните набирать имя" value="${esc(state.main)}">
                            <ul class="tg-list" hidden></ul>
                        </div>
                        ${mine.length > 1 ? `<div class="tg-mine">${mine.map(n => `<button class="tg-pick" type="button" data-pick="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
                    </div>

                    <div class="tg-field">
                        <span class="tg-label">персонажи соавторов</span>
                        <div class="tg-suggest">
                            <input class="dl-search-input tg-input tg-co" autocomplete="off" placeholder="начните набирать имя">
                            <ul class="tg-list" hidden></ul>
                        </div>
                        <div class="tg-coauthors"></div>
                    </div>

                    <div class="tg-field">
                        <span class="tg-label">разделитель</span>
                        <div class="tg-buttons">
                            ${SEPARATORS.map(([v, t]) => `<button class="tg-toggle tg-sep" type="button" data-sep="${esc(v)}" aria-pressed="false">${esc(t)}</button>`).join('')}
                            <input class="dl-search-input tg-input tg-custom" placeholder="символ" hidden>
                        </div>
                    </div>

                    <div class="tg-field">
                        <span class="tg-label">дополнительные теги</span>
                        <div class="tg-buttons">
                            ${MARKS.map(([m]) => `<button class="tg-toggle tg-mark" type="button" data-mark="${esc(m)}" aria-pressed="false">${esc(m.toLowerCase())}</button>`).join('')}
                        </div>
                        <ul class="tg-notes"></ul>
                    </div>

                    <div class="tg-field">
                        <span class="tg-label">текст ссылки на тему (только для основного персонажа)</span>
                        <div class="tg-link-row">
                            <label class="tg-check" title="Добавлять ссылку на тему">
                                <input class="tg-with-link" type="checkbox" checked aria-label="Добавлять ссылку на тему">
                                <span class="tg-check-box" aria-hidden="true"></span>
                            </label>
                            <input class="dl-search-input tg-input tg-link" value="${esc(state.linkText)}" placeholder="без текста — просто ссылка">
                        </div>
                    </div>

                    <div class="tg-field">
                        <textarea class="tg-result" rows="5" readonly aria-label="Готовые хэштеги"></textarea>
                        <div class="tg-copy-row">
                            <button class="tg-toggle tg-copy" type="button">скопировать</button>
                            <span class="tg-copied" role="status" aria-live="polite"></span>
                        </div>
                    </div>
                </div>`;

            const main = root.querySelector('.tg-main');
            const co = root.querySelector('.tg-co');

            // список имён под полем: набираешь — фильтруется, нажатие выбирает
            const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
            function suggest(input, onPick) {
                const list = input.parentElement.querySelector('.tg-list');
                const hide = () => { list.hidden = true; };
                const show = () => {
                    const q = norm(input.value).trim();
                    const found = q ? names.filter(n => norm(n).includes(q)).slice(0, 8) : [];
                    list.innerHTML = found.map(n => `<li><button class="tg-list-item" type="button" data-name="${esc(n)}">${esc(n)}</button></li>`).join('');
                    list.hidden = !found.length;
                };
                input.addEventListener('input', show);
                input.addEventListener('focus', show);
                input.addEventListener('blur', () => setTimeout(hide, 150));
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const first = list.querySelector('.tg-list-item');
                        if (first && !list.hidden) { onPick(first.dataset.name); hide(); }
                    }
                    if (e.key === 'Escape') hide();
                });
                list.addEventListener('mousedown', (e) => e.preventDefault());   // поле не теряет фокус
                list.addEventListener('click', (e) => {
                    const b = e.target.closest('.tg-list-item');
                    if (b) { onPick(b.dataset.name); hide(); }
                });
            }

            const addCo = (n) => {
                n = String(n || '').trim();
                if (byName.has(n) && !state.coauthors.includes(n)) {
                    state.coauthors.push(n);
                    // коллаб ставится сам, только если персонажи не в дуэте и это не общий ивент / флешмоб
                    if (!inDuet(state.main, n) && !groupEvent()) state.marks.add('Коллаб');
                }
                co.value = '';
                update(root);
            };
            main.addEventListener('input', () => { state.main = byName.has(main.value.trim()) ? main.value.trim() : ''; update(root); });
            suggest(main, (n) => { main.value = n; state.main = n; update(root); });
            suggest(co, (n) => addCo(n));
            root.querySelector('.tg-link').addEventListener('input', (e) => { state.linkText = e.target.value; update(root); });
            root.querySelector('.tg-with-link').addEventListener('change', (e) => {
                state.withLink = e.target.checked;
                root.querySelector('.tg-link').disabled = !state.withLink;
                update(root);
            });
            root.querySelector('.tg-custom').addEventListener('input', (e) => { state.custom = e.target.value; update(root); });
            root.querySelector('.tg-form').addEventListener('click', async (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                if (b.dataset.pick) { state.main = b.dataset.pick; main.value = b.dataset.pick; }
                else if (b.dataset.remove) {
                    state.coauthors = state.coauthors.filter(n => n !== b.dataset.remove);
                    if (!state.coauthors.length) state.marks.delete('Коллаб');
                }
                else if (b.dataset.sep != null) {
                    state.sep = b.dataset.sep;
                    if (/^custom/.test(state.sep)) setTimeout(() => root.querySelector('.tg-custom').focus(), 0);
                }
                else if (b.dataset.mark) state.marks.has(b.dataset.mark) ? state.marks.delete(b.dataset.mark) : state.marks.add(b.dataset.mark);
                else if (b.classList.contains('tg-copy')) {
                    const area = root.querySelector('.tg-result');
                    try { await navigator.clipboard.writeText(area.value); }
                    catch (err) { area.select(); document.execCommand('copy'); }
                    // сообщение «скопировано» рядом с кнопкой, само гаснет
                    const msg = root.querySelector('.tg-copied');
                    msg.textContent = 'скопировано';
                    msg.classList.add('is-shown');
                    clearTimeout(msg.timer);
                    msg.timer = setTimeout(() => msg.classList.remove('is-shown'), 1600);
                    return;
                }
                update(root);
            });
            // нажатие на поле с готовыми тегами выделяет весь текст
            const area = root.querySelector('.tg-result');
            area.addEventListener('click', () => area.select());
            area.addEventListener('focus', () => area.select());
            update(root);
        },
    };
})();
