// Страница отвечающего: #player/id123456 (ссылка «отвечающий» в анкете, поиск по персонажам).
// Аватар, имя, статус (активен — есть актуальные персонажи, иначе неактивен), ссылки на ВК и блоги,
// день рождения и описание (если есть в таблице); ниже — две стопки: «действующие персонажи» и «архив».
// Отдельного пункта меню пока нет. Данные собирает buildPlayers в js/pages/public-data.js.
(() => {
    const { esc, safeUrl } = RCU;

    RCU.playerHref = (key) => `#player/${encodeURIComponent(key)}`;

    // «назад»: туда, откуда пришли по сайту; если страницу открыли сразу по ссылке — в картотеку
    let moves = 0;
    window.addEventListener('hashchange', () => { moves++; });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.pl-back')) return;
        if (moves > 0) history.back();
        else location.hash = '#characters';
    });

    function avatarHTML(p) {
        return safeUrl(p.avatar)
            ? `<img class="pl-ava" src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`
            : `<div class="pl-ava pl-ava--empty" aria-hidden="true">${esc((p.name || '?').charAt(0))}</div>`;
    }

    function linksHTML(p) {
        const links = [];
        if (safeUrl(p.url)) links.push(`<a class="pl-link" href="${esc(p.url)}" target="_blank" rel="noopener">страница вк</a>`);
        (p.blogs || []).forEach(b => {
            const url = typeof b === 'string' ? b : b.url;
            const title = (typeof b === 'string' ? '' : b.title) || 'блог';
            if (safeUrl(url)) links.push(`<a class="pl-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>`);
        });
        return links.length ? `<div class="pl-links">${links.join('')}</div>` : '';
    }

    // стопка карточек, как в картотеке; заголовок — как «студенты» там же: название и число.
    // data-names — по ним листается анкета, открытая из стопки
    function stack(title, list) {
        if (!list.length) return '';
        return `
            <section class="pl-stack">
                <h3 class="pc-deck-title">${esc(title)}</h3>
                <div class="pc-deck-count">${list.length} ${RCU.plural(list.length, 'персонаж', 'персонажа', 'персонажей')}</div>
                <div class="pl-stack-cards" data-names="${esc(JSON.stringify(list.map(c => c.key || c.name)))}">
                    ${list.map(c => `<div class="pc-file-card">${RCU.smallCharacterCard(c)}</div>`).join('')}
                </div>
            </section>`;
    }

    /* ---------- Стопки: раскладка и подъём карточек ----------
       Карточки стоят друг за другом, наведение поднимает карточку целиком
       (как в картотеке, js/pages/characters.js), нажатие открывает анкету. */
    const STEP = 0.62;   // шаг между карточками — доля высоты карточки
    function layoutStack(box) {
        const cards = [...box.querySelectorAll('.pc-file-card')];
        if (!cards.length) return;
        const H = Math.max(...cards.map(el => el.offsetHeight));
        if (!H) return;
        const step = cards.length > 1 ? Math.round(H * STEP) : H;
        const lift = Math.max(0, Math.min(H - step - 6, Math.round(H * 0.45)));
        cards.forEach((el, i) => {
            el.style.top = `${i * step}px`;
            el.style.zIndex = String(i + 1);
            el.style.setProperty('--lift', `${i < cards.length - 1 ? lift : 0}px`);
        });
        box.style.height = `${(cards.length - 1) * step + H}px`;
        box.geom = { step, n: cards.length };
    }

    function liftIn(box, item) {
        box.querySelectorAll('.pc-file-card.is-lifted').forEach(el => { if (el !== item) el.classList.remove('is-lifted'); });
        if (item) item.classList.add('is-lifted');
    }

    // поднять карточку по имени (null — опустить все): так анкета, свёрнутая сюда, «ложится» в свою карточку
    RCU.playerLift = (name) => {
        document.querySelectorAll('.pl-stack-cards').forEach(box => {
            const card = name && box.querySelector(`.pc-card[data-name="${CSS.escape(name)}"]`);
            liftIn(box, card ? card.closest('.pc-file-card') : null);
        });
    };

    function wireStack(box) {
        let lastY = null;
        const anketaOn = () => { const m = document.querySelector('.pc-modal'); return m && !m.hidden; };
        box.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' || !box.geom || anketaOn()) return;
            const goingUp = lastY != null && e.clientY < lastY;
            lastY = e.clientY;
            const cur = box.querySelector('.pc-file-card.is-lifted');
            // ведут вниз или стоят — поднятая остаётся, пока указатель на ней
            if (cur && !goingUp) {
                const r = cur.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
            }
            const cards = box.querySelectorAll('.pc-file-card');
            const y = e.clientY - box.getBoundingClientRect().top;
            const i = Math.max(0, Math.min(box.geom.n - 1, Math.floor(y / box.geom.step)));
            liftIn(box, cards[i]);
        });
        box.addEventListener('mouseleave', () => { if (!anketaOn()) liftIn(box, null); });
    }

    let resizeBound = false;
    function setupStacks(root) {
        const boxes = [...root.querySelectorAll('.pl-stack-cards')];
        boxes.forEach(box => { layoutStack(box); wireStack(box); });
        // шрифты дорисовались — высота карточек могла измениться
        if (document.fonts) document.fonts.ready.then(() => boxes.forEach(layoutStack));
        if (!resizeBound) {
            resizeBound = true;
            window.addEventListener('resize', () => document.querySelectorAll('.pl-stack-cards').forEach(layoutStack));
        }
    }

    RCU.pages.player = {
        title: 'Отвечающий',
        load: () => RCU.publicData(),
        render(root, d) {
            if (RCU.setPublicData) RCU.setPublicData(d);
            const key = decodeURIComponent(RCU.routeParam || '');
            const p = d.players && d.players.get(key);
            if (!p) {
                root.innerHTML = '<p class="dl-status">Такого отвечающего не нашлось.</p>';
                return;
            }
            const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
            // две стопки рядом: действующие и архив; если одна пуста — оставшаяся посередине
            root.innerHTML = `
                <div class="pl-page">
                    <button class="pl-back" type="button"><span class="pl-back-arrow" aria-hidden="true"></span>назад</button>
                    <section class="pl-head">
                        ${avatarHTML(p)}
                        <div class="pl-info">
                            <h2 class="pl-name">${esc(p.name)}</h2>
                            <span class="pl-status pl-status--${p.active ? 'on' : 'off'}">${p.active ? 'активен' : 'неактивен'}</span>
                            ${p.birthday ? `<div class="pl-row"><span class="pc-k">день рождения</span> ${esc(p.birthday)}</div>` : ''}
                            ${linksHTML(p)}
                        </div>
                    </section>
                    ${p.about ? `<p class="pl-about">${esc(p.about)}</p>` : ''}
                    <div class="pl-stacks">
                        ${stack('действующие персонажи', [...p.current].sort(byName))}
                        ${stack('архив', [...p.archive].sort(byName))}
                    </div>
                </div>`;
            setupStacks(root);
        },
    };
})();
