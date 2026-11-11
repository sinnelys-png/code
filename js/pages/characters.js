// Публичный сайт, страница «Персонажи»: картотеки по ролям, по одной на экране.
// Стопка раскрывается в столбец; карточка в центре по нажатию открывает большую.
// Большую карточку открывают и другие страницы: RCU.openCharacter(имя).
(() => {
    const { esc, safeUrl } = RCU;

    const ROLES = [
        ['студент', 'студенты'],
        ['преподаватель', 'преподаватели'],
        ['персонал', 'персонал'],
    ];

    let data = null;   // { characters, byName, facultyInfo }

    /* ---------- Части карточек ---------- */

    // квадратный аватар без рамки факультета, как в прототипе (цвет факультета — полоса сверху карточки)
    function avatar(c, cls = '') {
        return safeUrl(c.avatar)
            ? `<img class="pc-ava ${cls}" src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : `<div class="pc-ava pc-ava--empty ${cls}">${esc(c.name.charAt(0))}</div>`;
    }

    // «Факультет художественного и театрального искусства» → «художественного и театрального искусства»
    const shortFaculty = (f) => String(f || '').replace(/^факультет\s+/i, '').replace(/\s+факультет$/i, '').toLowerCase();

    const facStyle = (c) => {
        const fac = RCU.facultyAttrs(c.faculty, c.role);
        const m = fac.attrs.match(/style="([^"]*)"/);
        return m ? ` style="${m[1]}"` : '';
    };

    /* ---------- Предмет в родительном падеже ----------
       «повышение спортивного мастерства» → «преподаватель повышения спортивного мастерства».
       Склоняются прилагательные в начале и первое существительное, остальное — как есть.
       Аббревиатуры (ДПИ) не склоняются; должности («Заведующий кафедрой…») выводятся как есть. */
    const POST_WORDS = /^(заведующ|декан|руководител|заместител|старш|главн|ведущ|проректор|ректор|куратор)/i;

    function genitiveWord(w, isAdj) {
        if (/^[A-ZА-ЯЁ]{2,}$/.test(w)) return w;                 // аббревиатура
        const lw = w.toLowerCase();
        if (isAdj) {
            return lw.replace(/(ое|ий|ый|ой)$/, 'ого').replace(/ая$/, 'ой').replace(/яя$/, 'ей').replace(/ее$/, 'его');
        }
        if (/ие$/.test(lw)) return lw.replace(/ие$/, 'ия');
        if (/ия$/.test(lw)) return lw.replace(/ия$/, 'ии');
        if (/ье$/.test(lw)) return lw.replace(/ье$/, 'ья');
        if (/ь$/.test(lw)) return lw.replace(/ь$/, 'и');
        if (/о$/.test(lw)) return lw.replace(/о$/, 'а');
        if (/[гкхжшчщ]а$/.test(lw)) return lw.replace(/а$/, 'и');
        if (/а$/.test(lw)) return lw.replace(/а$/, 'ы');
        if (/я$/.test(lw)) return lw.replace(/я$/, 'и');
        if (/[бвгджзклмнпрстфхцчшщ]$/.test(lw)) return lw + 'а';
        return lw;
    }

    function teacherRole(subject) {
        const s = String(subject || '').trim();
        if (!s) return 'преподаватель';
        if (POST_WORDS.test(s)) return s.charAt(0).toLowerCase() + s.slice(1);
        const words = s.split(/\s+/);
        const out = [];
        let done = false;
        for (const w of words) {
            if (done) { out.push(/^[A-ZА-ЯЁ]{2,}$/.test(w) ? w : w.toLowerCase()); continue; }
            const adj = /(ое|ий|ый|ой|ая|яя|ее)$/i.test(w) && words.length > 1;
            out.push(genitiveWord(w, adj));
            if (!adj) done = true;
        }
        return `преподаватель ${out.join(' ')}`;
    }

    const lowerFirst = (s) => (/^[A-ZА-ЯЁ]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

    // короткие названия факультетов для ярлычков (как в меню таблицы факультетов)
    const FAC_SHORT = [
        ['химико', 'хим-био'], ['историко', 'ист-арх'], ['журналист', 'журфак'], ['механико', 'мех-мат'],
        ['гостинич', 'гостин'], ['спортив', 'спорт'], ['философ', 'фил-соц'], ['художеств', 'худ-театр'],
        ['реклам', 'реклама'], ['экономич', 'эконом'], ['филолог', 'филфак'], ['музыкал', 'музыка'], ['юридич', 'юрфак'],
    ];
    const facShort = (f) => {
        const t = String(f || '').toLowerCase();
        const hit = FAC_SHORT.find(([k]) => t.includes(k));
        return hit ? hit[1] : (t ? t.slice(0, 8) : '—');
    };

    // на язычке — первая буква имени (при любой сортировке)
    function tabText(c) {
        return c.name.charAt(0);
    }

    function smallCard(c, sortBy = 'name', tabLabel = null) {
        const course = c.course ? `${c.course}` : '—';
        const row = (k, v, cls = '') => `<span class="pc-row"><span class="pc-k">${k}</span><span class="pc-v ${cls}">${esc(v || '—')}</span></span>`;
        let rows;
        if (c.role === 'персонал') rows = row('должн.', lowerFirst(c.post || ''));
        else if (c.role === 'преподаватель') rows = row('фак.', shortFaculty(c.faculty), 'pc-fac') + row('предм.', lowerFirst(c.subject || ''), 'pc-fac');
        else rows = row('курс', course) + row('фак.', shortFaculty(c.faculty), 'pc-fac');
        return `
            <button class="pc-card" type="button" data-name="${esc(c.name)}"${facStyle(c)}>
                <span class="pc-card-tab">${esc(tabLabel ?? tabText(c, sortBy))}</span>
                ${tabLabel != null ? `<span class="pc-card-face"${safeUrl(c.avatar) ? ` style="background-image:url('${esc(c.avatar)}')"` : ''}></span>` : ''}
                ${avatar(c, 'pc-card-avatar')}
                <span class="pc-card-info">
                    <span class="pc-row"><span class="pc-k">имя</span><span class="pc-v pc-name">${esc(c.name)}</span></span>
                    ${rows}
                </span>
            </button>`;
    }

    function stat(label, value) {
        return `<div class="pc-stat"><div class="pc-k">${esc(label)}</div><div class="pc-v">${value ? esc(value) : '<span class="pc-none">—</span>'}</div></div>`;
    }

    // лента-закладка: снаружи основной цвет факультета, внутренняя линия — второй
    const RIBBON = `
        <svg class="pc-ribbon" viewBox="0 0 60 140" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <radialGradient id="pc-ribbon-glow" class="pc-ribbon-glow" gradientUnits="userSpaceOnUse" cx="-999" cy="-999" r="90">
                    <stop offset="0%" class="pc-ribbon-glow-core" />
                    <stop offset="50%" class="pc-ribbon-glow-mid" />
                    <stop offset="100%" class="pc-ribbon-glow-edge" />
                </radialGradient>
            </defs>
            <path class="pc-ribbon-body" d="M0 0 H60 V140 L30 104 L0 140 Z" />
            <path class="pc-ribbon-line" d="M10 0 V107.7 L30 83.7 L50 107.7 V0" />
        </svg>`;
    RCU.ribbonHTML = RIBBON;     // та же лента у карточек факультетов

    // статус комнаты: сосед уже есть / можно подселиться / нельзя / спросить автора (колонка P)
    function roomStatus(c) {
        if (!c.house) return null;
        const mates = c.room
            ? data.characters.filter(x => x.name !== c.name && String(x.house) === String(c.house) && String(x.room) === String(c.room))
            : [];
        if (mates.length) {
            const names = mates.map(m => `<button class="pc-link" type="button" data-name="${esc(m.name)}">${esc(m.name)}</button>`);
            return { cls: 'mate', html: `${mates.length > 1 ? 'соседи' : 'сосед'}: ${names.join(', ')}` };
        }
        const t = String(c.neighbor || '').toLowerCase();
        if (/^да|можно/.test(t)) return { cls: 'yes', text: 'можно стать соседом' };
        if (/^нет/.test(t)) return { cls: 'no', text: 'нельзя стать соседом' };
        if (/уточн|автор|спрос/.test(t)) return { cls: 'ask', text: 'спрашивайте у автора, можно ли стать соседом' };
        return null;
    }

    function homeStat(c) {
        const home = c.house ? `д. ${c.house}${c.room ? `, к. ${c.room}` : ''}` : '';
        if (!home) return stat('проживает', '');
        const st = roomStatus(c);
        const star = st ? `<span class="pc-room"><button class="pc-room-star pc-room-star--${st.cls}" type="button" aria-expanded="false" aria-label="Статус комнаты">✦</button><span class="pc-room-info">${st.html || esc(st.text)}</span></span>` : '';
        return `<div class="pc-stat"><div class="pc-k">проживает</div><div class="pc-v">${esc(home)}${star}</div></div>`;
    }

    function bigCard(c) {
        const a = anketaOf(c);
        const tabs = [
            ['альбом', c.albumUrl],
            ['тема', c.topicUrl],
        ].filter(([, u]) => safeUrl(u))
            .map(([t, u]) => `<a class="pc-tab" href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`).join('')
            // «отвечающий» ведёт на его страницу на сайте (js/pages/player.js), а не сразу во ВК
            + (c.playerKey && RCU.playerHref
                ? `<a class="pc-tab" href="${RCU.playerHref(c.playerKey)}">отвечающий</a>`
                : safeUrl(c.playerUrl) ? `<a class="pc-tab" href="${esc(c.playerUrl)}" target="_blank" rel="noopener">отвечающий</a>` : '');

        // дуэт — ✦ справа от имени, имя партнёра во всплывающей подсказке (как сосед по комнате)
        const duetName = c.duet
            ? (data.byName.has(c.duet)
                ? `<button class="pc-link" type="button" data-name="${esc(c.duet)}">${esc(c.duet)}</button>`
                : esc(c.duet))
            : '';
        const duetStar = duetName
            ? `<span class="pc-room"><button class="pc-room-star pc-room-star--duet" type="button" aria-expanded="false" aria-label="Дуэт">✦</button><span class="pc-room-info">дуэт: ${duetName}</span></span>`
            : '';
        const extras = [
            c.posts.length ? `<div class="pc-k">должности</div><div class="pc-v">${c.posts.map(esc).join('; ')}</div>` : '',
            c.extra ? `<div class="pc-k">доп. предметы</div><div class="pc-v">${esc(c.extra)}</div>` : '',
        ].join('');

        return `
            <article class="pc-big pc-ticket"${facStyle(c)}>
                <nav class="pc-tabs"><span class="pc-tab-own" aria-hidden="true"></span>${tabs}</nav>
                <div class="pc-top">
                    ${RIBBON}
                    <div class="pc-room-pop" role="status" hidden></div>
                    <div class="pc-seg pc-seg--head">
                        <button class="pc-close" type="button" data-close aria-label="Закрыть">×</button>
                        <div class="pc-head">
                            <span class="pc-ava-frame">${avatar(c, 'pc-big-avatar')}</span>
                            <div class="pc-head-info">
                                <div class="pc-k">имя</div>
                                <h2 class="pc-big-name">${esc(c.name)}${duetStar}</h2>
                                ${c.role === 'студент'
                                    ? `<div class="pc-k">курс</div><div class="pc-v">${esc(c.course || '—')}</div>`
                                    : c.role === 'преподаватель'
                                        ? `<div class="pc-k">роль</div><div class="pc-v">${esc(teacherRole(c.subject))}</div>`
                                        : c.role === 'персонал'
                                            ? `<div class="pc-k">должность</div><div class="pc-v">${esc(lowerFirst(c.post || '') || '—')}</div>`
                                            : `<div class="pc-k">роль</div><div class="pc-v">${esc(c.role || '—')}</div>`}
                                ${c.role === 'персонал' ? '' : (c.faculty
                                    ? `<a class="pc-v pc-big-fac pc-fac-link" href="#faculties/${encodeURIComponent(slug(c.faculty))}">${esc(c.faculty.toLowerCase())}</a>`
                                    : '<div class="pc-v pc-big-fac">—</div>')}
                                ${extras}
                            </div>
                        </div>
                    </div>
                    <section class="pc-seg pc-stats">
                        ${stat('возраст', a && a.age)}
                        ${homeStat(c)}
                        ${stat('вид', a && a.species && String(a.species).toLowerCase())}
                        ${stat('рост', (a && a.height) || (c.height ? `${c.height}${/^\d+$/.test(c.height) ? ' см' : ''}` : ''))}
                        ${stat('вес', a && a.weight)}
                    </section>
                </div>
                ${anketaHTML(c, a)}
                <div class="pc-seam-star" aria-hidden="true"><span class="pc-seam-dot">✦</span></div>
                <div class="pc-seg pc-seg--foot"></div>
            </article>`;
    }

    /* ---------- Анкета (колонка X Техтаблицы) ---------- */

    let anketaTexts = null;      // { имя: текст анкеты }
    let anketaPromise = null;

    function loadAnketas() {
        anketaPromise = anketaPromise || RCU.cached('anketas', async () => {
            const r = await (await fetch(`${RCU.scriptUrl}?part=anketas`)).json();
            return r.anketas || {};
        }).then(t => (anketaTexts = t)).catch(() => (anketaTexts = {}));
        return anketaPromise;
    }

    // анкета персонажа; у дуэта с общей анкетой она может лежать только в строке партнёра
    function anketaOf(c) {
        if (!anketaTexts || !RCU.parseAnketa) return null;
        let text = anketaTexts[c.name];
        if (!text && c.duet && anketaTexts[c.duet]) {
            const first = c.name.split(/\s+/)[0].toLowerCase();
            if (anketaTexts[c.duet].toLowerCase().includes(first)) text = anketaTexts[c.duet];
        }
        try { return text ? RCU.parseAnketa(text, c.name, c.duet) : null; } catch (e) { return null; }
    }

    function anketaHTML(c, a) {
        if (!a) {
            return `
                <section class="pc-seg pc-text">
                    <h3 class="pc-section-title">биография</h3>
                    <p class="pc-soon">${anketaTexts ? 'Анкеты пока нет в таблице.' : 'Загружаем анкету…'}</p>
                </section>`;
        }
        const paras = (list) => list.map(p => `<p>${esc(p)}</p>`).join('');
        const info = a.interaction ? `<span><span class="pc-k">взаимодействия</span> ${esc(String(a.interaction).trim().replace(/[A-Za-zА-Яа-яЁё]/, ch => ch.toLowerCase()))}</span>` : '';
        return `
            ${info ? `<section class="pc-seg pc-interaction">${info}</section>` : ''}
            <section class="pc-seg pc-text">
                <h3 class="pc-section-title">биография</h3>
                <div class="pc-scroll pc-scroll--bio">
                    ${a.bio.length ? paras(a.bio) : '<p class="pc-soon">Биографии нет в анкете.</p>'}
                    ${a.character.length ? `<h4 class="pc-subtitle">характер</h4>${paras(a.character)}` : ''}
                </div>
            </section>
            ${a.facts.length ? `
                <section class="pc-seg pc-text pc-seg--facts">
                    <h3 class="pc-section-title">интересные факты</h3>
                    <div class="pc-scroll pc-scroll--facts">
                        <ul class="pc-facts">${a.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
                    </div>
                </section>` : ''}`;
    }

    /* ---------- Окно большой карточки ---------- */

    const modal = document.querySelector('.pc-modal');
    const modalBody = modal && modal.querySelector('.pc-modal-body');
    let lastFocus = null;

    // по каким анкетам листать стрелками, если не по группе картотеки (например, состав факультета)
    let pageContext = null;

    // dir: 0 — открытие (карточка вырастает и раскладывается), ±1 — листание (старая уезжает вбок);
    // context — список имён для листания (без него листание по группе картотеки)
    function openCharacter(name, dir = 0, context = null) {
        if (!modal || !data || !data.byName.has(name)) return;
        if (context) pageContext = context;
        else if (!dir) pageContext = null;
        const wasHidden = modal.hidden || !modal.classList.contains('is-shown');
        if (modal.hidden) lastFocus = document.activeElement;
        const unfold = wasHidden || !modalBody.querySelector('.pc-ticket');
        const render = () => {
            modalBody.innerHTML = bigCard(data.byName.get(name));
            fitStats(modalBody);
        };
        // переход из одной открытой карточки в другую (стрелки, ссылка на дуэт или соседа)
        if (unfold) render();
        else swapCard(dir || 1, render);
        modalBody.scrollTop = 0;
        modalBody.dataset.name = name;
        delete modalBody.dataset.fac;
        updatePager(name);
        setCardHash(name);
        // анкеты грузятся отдельно — когда придут, перерисуем открытую карточку
        if (!anketaTexts) loadAnketas().then(() => {
            if (!modal.hidden && modalBody.dataset.name === name && modalBody.querySelector('.pc-big:not(.fc-big)')) {
                render();
            }
        });
        modal.hidden = false;
        document.documentElement.classList.add('pc-open');
        if (unfold) unfoldCard(name);
        requestAnimationFrame(() => modal.classList.add('is-shown'));
        modalBody.querySelector('.pc-close').focus({ preventScroll: true });
    }

    const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';          // мягкое замедление в конце
    const EASE_MOVE = 'cubic-bezier(0.45, 0, 0.25, 1)';     // плавный разгон и остановка

    // копия элемента поверх окна, на месте оригинала (её можно увести за край окна — ничего не обрежет)
    function ghostOf(el, cls) {
        const r = el.getBoundingClientRect();
        const ghost = el.cloneNode(true);
        ghost.classList.add(cls);
        ghost.removeAttribute('id');
        Object.assign(ghost.style, {
            position: 'fixed', left: `${r.left}px`, top: `${r.top}px`,
            width: `${r.width}px`, height: `${r.height}px`, right: 'auto', margin: '0', maxHeight: 'none',
        });
        const cs = getComputedStyle(el);
        ['--fac-main', '--fac-stripe', '--card-bg', '--seam'].forEach(v => {
            const value = cs.getPropertyValue(v);
            if (value) ghost.style.setProperty(v, value);
        });
        modal.appendChild(ghost);
        return { ghost, rect: r };
    }

    /* ---------- Смена карточки: старая уезжает вбок, новая выезжает на её место ----------
       dir > 0 — вперёд (старая уходит влево, новая приходит справа). Используют и факультеты. */
    function swapCard(dir, render) {
        const old = modalBody.querySelector('.pc-ticket');
        if (!old || !old.animate || reduceMotion()) { render(); return; }
        modal.querySelectorAll('.pc-card-ghost').forEach(g => g.remove());
        const { ghost, rect } = ghostOf(old, 'pc-card-ghost');
        render();
        modalBody.scrollTop = 0;
        const card = modalBody.querySelector('.pc-ticket');
        const dist = innerWidth / 2 + rect.width / 2 + 40;
        const timing = { duration: 620, easing: EASE_MOVE };
        ghost.animate([
            { transform: 'none', opacity: 1 },
            { transform: `translateX(${-dir * dist}px)`, opacity: 0.4 },
        ], { ...timing, fill: 'forwards' }).finished.then(() => ghost.remove(), () => ghost.remove());
        if (!card) return;
        // новая карточка тоже въезжает копией поверх окна: само окно не меняется
        // (иначе пришлось бы снимать с него обрезку, и карточка «сужалась» бы в конце)
        card.style.visibility = 'hidden';
        requestAnimationFrame(() => {                 // после подгонки шрифта параметров
            if (!card.isConnected) return;
            const incoming = ghostOf(card, 'pc-card-ghost').ghost;
            incoming.style.visibility = 'visible';
            const done = () => { incoming.remove(); card.style.visibility = ''; };
            incoming.animate([
                { transform: `translateX(${dir * dist}px)`, opacity: 0.4 },
                { transform: 'none', opacity: 1 },
            ], { ...timing, fill: 'forwards' }).finished.then(done, done);
        });
    }
    RCU.swapCard = swapCard;

    /* ---------- Анимация открытия ----------
       1) маленькая карточка увеличивается до шапки большой (без ленты и вкладок) посередине экрана;
       2) шапка плавно уезжает вверх на своё место, а блоки под ней раскладываются вниз — строго
          по очереди, каждый следующий начинает раскрываться, когда предыдущий почти раскрыт;
       3) лента откидывается из-за верхнего края блока и ложится на место, как закладка;
       4) слева друг за другом выезжают вкладки. */
    const GROW = 560;     // рост шапки из маленькой карточки
    const PART = 340;     // раскладывание одного блока
    const UNIT = 250;     // через сколько начинает раскладываться следующий блок
    const DROP = 820;     // появление ленты

    // srcEl — маленькая карточка, из которой «вырастает» большая (если не задана — ищем по имени)
    function unfoldCard(name, srcEl) {
        const card = modalBody.querySelector('.pc-ticket');
        if (!card || !card.animate || reduceMotion()) return;
        const head = card.querySelector('.pc-seg--head');
        const ribbon = card.querySelector('.pc-ribbon');
        const tabs = [...card.querySelectorAll('.pc-tabs > *')];
        const seam = card.querySelector(':scope > .pc-seam-star');
        const lowers = [card.querySelector('.pc-top > .pc-seg:not(.pc-seg--head)'),
            ...[...card.children].filter(el => el.matches('.pc-seg'))].filter(Boolean);

        const h = head.getBoundingClientRect();
        // откуда растём: маленькая карточка на экране (если видна) или центр экрана
        const src = (srcEl ? [srcEl] : [...document.querySelectorAll('.pc-card[data-name]')]
            .filter(el => el.dataset.name === name && !el.closest('.pc-modal')))
            .map(el => el.getBoundingClientRect())
            .find(r => r.width && r.bottom > 0 && r.top < innerHeight);
        const midY = innerHeight / 2;
        const dy = midY - (h.top + h.height / 2);             // шапка сначала стоит посередине экрана
        const s = src ? Math.min(1, src.width / h.width) : 0.6;
        const sx = src ? (src.left + src.width / 2) - (h.left + h.width / 2) : 0;
        const sy = src ? (src.top + src.height / 2) - midY : 0;

        const start = GROW * 0.9;                                    // блоки начинают раскладываться
        const blocks = (lowers.length - 1) * UNIT + PART;            // все блоки разложены
        const opened = start + blocks;

        // вся карточка: стоит ниже на dy, а пока раскладываются блоки — плавно уезжает вверх
        card.animate([
            { transform: `translateY(${dy}px)`, easing: 'linear' },
            { transform: `translateY(${dy}px)`, offset: start / opened, easing: EASE_MOVE },
            { transform: 'none' },
        ], { duration: opened, fill: 'backwards' });

        // шапка: из маленькой карточки — в полный размер
        head.animate([
            { transform: `translate(${sx}px, ${sy}px) scale(${s})`, opacity: 0.85 },
            { transform: 'none', opacity: 1 },
        ], { duration: GROW, easing: EASE, fill: 'backwards' });

        // блоки — по очереди, сверху вниз
        lowers.forEach((el, i) => el.animate([
            { transform: 'perspective(1600px) rotateX(-90deg)', opacity: 0 },
            { opacity: 1, offset: 0.25 },
            { transform: 'none', opacity: 1 },
        ], { duration: PART, delay: start + i * UNIT, easing: 'cubic-bezier(0.25, 0.6, 0.35, 1)', fill: 'backwards' }));
        if (seam) seam.animate([{ opacity: 0 }, { opacity: 1 }],
            { duration: 300, delay: opened - 120, fill: 'backwards' });

        // лента: из-за верхнего края блока поворачивается к нам и ложится на карточку
        // (ось поворота — верхний край ленты), в конце чуть «качнувшись»
        if (ribbon) ribbon.animate([
            { transform: 'perspective(700px) rotateX(-100deg)', opacity: 0 },
            { opacity: 1, offset: 0.25 },
            { transform: 'perspective(700px) rotateX(7deg)', offset: 0.72 },
            { transform: 'none', opacity: 1 },
        ], { duration: DROP, delay: opened - 60, easing: 'cubic-bezier(0.3, 0.6, 0.35, 1)', fill: 'backwards' });

        // вкладки слева, друг за другом
        tabs.forEach((el, i) => el.animate([
            { transform: 'translateX(-1.2rem)', opacity: 0 },
            { transform: 'none', opacity: 1 },
        ], { duration: 420, delay: opened + DROP * 0.75 + i * 130, easing: EASE, fill: 'backwards' }));
    }
    RCU.unfoldCard = unfoldCard;


    /* ---------- Листание анкет стрелками ----------
       Только внутри своей группы (студенты / преподаватели / персонал), в порядке
       текущей сортировки картотеки. На краях группы стрелка гаснет. */
    function pageList(name) {
        const c = data.byName.get(name);
        // открыта из карточки факультета — только этот факультет, в порядке таблицы факультетов
        if (pageContext && pageContext.includes(name)) {
            return pageContext.map(n => data.byName.get(n)).filter(Boolean);
        }
        const g = file.groups.find(x => x.list.some(y => y.name === name));
        // картотека отсортирована по факультету — листаем только факультет этого персонажа
        if (g && sortState[g.title] === 'faculty' && RCU.facultyOrderOf) {
            const order = RCU.facultyOrderOf(data, c.faculty);
            const inGroup = new Set(g.list.map(x => x.name));
            if (order) {
                const list = order.filter(n => inGroup.has(n)).map(n => data.byName.get(n));
                if (list.some(x => x.name === name)) return list;
            }
        }
        if (g) return sorted(g.list, sortState[g.title] || 'name');
        return sorted(data.characters.filter(x => x.role === c.role), 'name');
    }

    function updatePager(name) {
        if (!pager.prev) return;
        const list = pageList(name);
        const i = list.findIndex(c => c.name === name);
        pager.prev.disabled = i <= 0;
        pager.next.disabled = i < 0 || i >= list.length - 1;
    }

    function pageBy(dir) {
        // открыт факультет — листаем факультеты
        if (modalBody.dataset.fac != null && !modal.hidden) { if (RCU.pageFaculty) RCU.pageFaculty(dir); return; }
        const name = modalBody.dataset.name;
        if (!name || modal.hidden || !modalBody.querySelector('.pc-ticket:not(.fc-big)')) return;
        const list = pageList(name);
        const next = list[list.findIndex(c => c.name === name) + dir];
        if (!next) return;
        openCharacter(next.name, dir);
        // картотека за окном выдвигает ту же карточку
        if (file.root && document.body.contains(file.root)) liftCard(next.name, true);
    }

    // анкеты заранее — чтобы карточка не перерисовывалась посреди анимации открытия
    if (modal) setTimeout(loadAnketas, 1200);

    const pager = {};
    RCU.setPager = (hasPrev, hasNext) => {
        if (!pager.prev) return;
        pager.prev.disabled = !hasPrev;
        pager.next.disabled = !hasNext;
    };
    if (modal) {
        modal.insertAdjacentHTML('beforeend', `
            <button class="pc-arrow pc-arrow-prev pc-pager pc-pager--prev" type="button" aria-label="Предыдущая анкета"><span></span></button>
            <button class="pc-arrow pc-arrow-next pc-pager pc-pager--next" type="button" aria-label="Следующая анкета"><span></span></button>`);
        pager.prev = modal.querySelector('.pc-pager--prev');
        pager.next = modal.querySelector('.pc-pager--next');
        pager.prev.addEventListener('click', (e) => { e.stopPropagation(); pageBy(-1); });
        pager.next.addEventListener('click', (e) => { e.stopPropagation(); pageBy(1); });
        document.addEventListener('keydown', (e) => {
            if (modal.hidden || e.target.closest('input, textarea')) return;
            if (e.key === 'ArrowLeft') pageBy(-1);
            if (e.key === 'ArrowRight') pageBy(1);
        });
    }

    const slug = (name) => name.replace(/\s+/g, '_');
    const unslug = (s) => String(s || '').replace(/_/g, ' ').trim();

    function setCardHash(name) {
        if (!/^#characters/.test(location.hash)) return;           // только на странице персонажей
        const h = name ? `#characters/${encodeURIComponent(slug(name))}` : '#characters';
        if (location.hash !== h) history.replaceState(history.state, '', h);
    }

    /* ---------- Подсказка со статусом комнаты ----------
       На ПК открывается при наведении на звёздочку (и не гаснет, пока мышь на подсказке —
       чтобы можно было нажать на имя соседа), на телефоне — по нажатию. */
    let popTimer = 0;
    function setRoomPop(star, open) {
        clearTimeout(popTimer);
        const pop = modal && modal.querySelector('.pc-room-pop');
        modal.querySelectorAll('.pc-room-star').forEach(b => b.setAttribute('aria-expanded', String(b === star && open)));
        if (!pop) return;
        pop.hidden = !open;
        if (!open) return;
        const box = pop.parentElement.getBoundingClientRect();
        const r = star.getBoundingClientRect();
        pop.innerHTML = star.nextElementSibling.innerHTML;
        pop.style.top = `${r.bottom - box.top + 6}px`;
        pop.style.left = `${Math.min(Math.max(r.left + r.width / 2 - box.left, 115), box.width - 115)}px`;
    }

    if (modal && window.matchMedia('(hover: hover)').matches) {
        modal.addEventListener('mouseover', (e) => {
            const star = e.target.closest('.pc-room-star');
            if (star) setRoomPop(star, true);
            else if (e.target.closest('.pc-room-pop')) clearTimeout(popTimer);
        });
        modal.addEventListener('mouseout', (e) => {
            const from = e.target.closest('.pc-room-star, .pc-room-pop');
            const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.pc-room-star, .pc-room-pop');
            if (from && !to) popTimer = setTimeout(() => setRoomPop(null, false), 300);
        });
    }

    // параметр не помещается в 3 строки (длинный вид) — уменьшаем шрифт
    function fitStats(root) {
        const fit = () => root.querySelectorAll('.pc-stat .pc-v').forEach(v => {
            v.style.fontSize = '';
            let size = parseFloat(getComputedStyle(v).fontSize);
            const lines = () => v.scrollHeight / parseFloat(getComputedStyle(v).lineHeight);
            while (lines() > 3.2 && size > 10) {
                size -= 0.5;
                v.style.fontSize = `${size}px`;
            }
        });
        requestAnimationFrame(fit);
        if (document.fonts) document.fonts.ready.then(fit);     // Montserrat шире запасного шрифта
    }

    function closeCharacter() {
        if (!modal || modal.hidden) return;
        setCardHash('');
        modal.classList.remove('is-shown');
        document.documentElement.classList.remove('pc-open');
        setTimeout(() => {
            if (modal.classList.contains('is-shown')) return;
            modal.hidden = true; modalBody.innerHTML = ''; delete modalBody.dataset.name;
        }, 250);
        if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) { closeCharacter(); return; }
            // звёздочка у «проживает» — статус комнаты
            const star = e.target.closest('.pc-room-star');
            if (star) { setRoomPop(star, star.getAttribute('aria-expanded') !== 'true'); return; }
            if (!e.target.closest('.pc-room-pop')) setRoomPop(null, false);
            const link = e.target.closest('.pc-link[data-name]');
            if (link) {
                // имя в карточке факультета — дальше листаем состав этого факультета
                const fac = modalBody.dataset.fac;
                const context = fac != null && RCU.facultyOrderAt ? RCU.facultyOrderAt(Number(fac)) : null;
                openCharacter(link.dataset.name, 0, context && context.includes(link.dataset.name) ? context : null);
            }
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCharacter(); });
        window.addEventListener('hashchange', closeCharacter);
    }

    // клики по маленьким карточкам на любой странице
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.pc-card[data-name], .pc-open-char[data-name]');
        // в картотеке нажатия обрабатывает она сама (центрирование / открытие)
        if (!card || e.target.closest('.pc-modal') || e.target.closest('.pc-file')) return;
        // карточки в списке с data-names (например, на странице отвечающего) — листаем по этому списку
        const list = card.closest('[data-names]');
        let context = null;
        try { context = list ? JSON.parse(list.dataset.names) : null; } catch (err) { context = null; }
        openCharacter(card.dataset.name, 0, context);
    });

    /* ---------- Картотека с ярлычками: одна группа на экране ----------
       Группы (студенты / преподаватели / персонал) — отдельные «экраны», между ними
       стрелки слева и справа. Внутри группы карточки разбиты на пачки до CHUNK штук:
       по имени — соседние буквы вместе (буква, где больше CHUNK, делится), по факультету
       или курсу — свой факультет / курс. Под карточками — ярлычки пачек; нажатие на
       ярлычок показывает его пачку. Карточки пачки стоят друг за другом, как в картотеке;
       наведение поднимает карточку целиком, нажатие открывает анкету (на сенсорном
       экране первое касание поднимает, второе открывает). */

    const CHUNK = 15;        // сколько карточек в пачке, не больше
    const MIN_STEP = 24;     // самый маленький шаг между карточками, px
    const MAX_STEP = 0.62;   // самый большой — доля высоты карточки

    const file = {
        groups: [],          // [{ title, list, sorts, view }]
        gi: 0,               // текущая группа
        root: null,
        busy: false,         // идёт перелистывание групп
        chunks: [],          // пачки текущей группы: [{ label, list }]
        ci: 0,               // открытая пачка
    };

    const group = () => file.groups[file.gi];
    function cardsEl() { return file.root && file.root.querySelector('.pc-file'); }

    // разбить отсортированный список на пачки до CHUNK карточек
    function makeChunks(list, by) {
        const keyOf = (c) => (by === 'faculty' ? facShort(c.faculty)
            : by === 'course' ? (c.course ? `${c.course} курс` : 'без курса')
            : c.name.charAt(0).toUpperCase());
        // подряд идущие одинаковые ключи
        const runs = [];
        list.forEach(c => {
            const k = keyOf(c);
            const last = runs[runs.length - 1];
            if (last && last.key === k) last.list.push(c); else runs.push({ key: k, list: [c] });
        });
        // ключ, где больше CHUNK, — на равные части
        const parts = [];
        runs.forEach(r => {
            const n = Math.ceil(r.list.length / CHUNK);
            const size = Math.ceil(r.list.length / n);
            for (let i = 0; i < n; i++) parts.push({ keys: [r.key], list: r.list.slice(i * size, (i + 1) * size), part: n > 1 ? i + 1 : 0 });
        });
        // по имени соседние буквы складываем вместе, пока влезает; факультеты и курсы — каждый отдельно
        const chunks = [];
        parts.forEach(pt => {
            const last = chunks[chunks.length - 1];
            if (by === 'name' && last && !last.part && !pt.part && last.list.length + pt.list.length <= CHUNK) {
                last.keys.push(...pt.keys);
                last.list.push(...pt.list);
            } else chunks.push({ keys: [...pt.keys], list: [...pt.list], part: pt.part });
        });
        return chunks.map(ch => {
            let label = ch.keys.length > 1 ? `${ch.keys[0]}–${ch.keys[ch.keys.length - 1]}` : ch.keys[0];
            if (ch.part) {
                // часть большой буквы — по первым двум буквам первого и последнего имени
                label = by === 'name'
                    ? `${ch.list[0].name.slice(0, 2)}–${ch.list[ch.list.length - 1].name.slice(0, 2)}`
                    : `${label} · ${ch.part}`;
            }
            return { label, list: ch.list };
        });
    }

    function layout() {
        const box = cardsEl();
        if (!box) return;
        const cards = [...box.querySelectorAll('.pc-file-card')];
        const n = cards.length;
        if (!n) return;
        let H = 0;
        cards.forEach(el => { H = Math.max(H, el.offsetHeight); });
        if (!H) return;
        const avail = box.clientHeight;
        // помещается целиком — пачка от самого верха, а поднятая задняя карточка может зайти
        // на заголовок над картотекой; не помещается — прокрутка и место сверху под подъём
        const fitAll = n > 1 ? (avail - 8 - H - 8) / (n - 1) : H;
        const fits = fitAll >= MIN_STEP;
        const top0 = fits ? 8 : Math.round(H * 0.55);
        const fit = n > 1 ? (avail - top0 - H - 8) / (n - 1) : H;
        const step = Math.round(Math.max(MIN_STEP, Math.min(H * MAX_STEP, fit)));
        box.classList.toggle('is-fit', fits);
        cards.forEach((el, i) => {
            el.style.top = `${top0 + i * step}px`;
            el.style.zIndex = String(i + 1);
            el.style.setProperty('--lift', `${i < n - 1 ? Math.max(0, H - step + 4) : 0}px`);
            el.style.setProperty('--i', String(i));
        });
        const end = box.querySelector('.pc-file-end');
        if (end) end.style.top = `${top0 + (n - 1) * step + H + 8}px`;
        file.geom = { top0, step, n };
    }

    // показать пачку (dir — откуда въезжает: 1 справа, -1 слева, 0 — без анимации)
    function showChunk(ci, dir = 0) {
        const box = cardsEl();
        if (!box || !file.chunks[ci]) return;
        file.ci = ci;
        const by = sortState[group().title] || 'name';
        // язычок сдвигается по букве: первая (по алфавиту) буква пачки — у левого края,
        // следующая — чуть дальше и т. д.
        const list = file.chunks[ci].list;
        const letters = [...new Set(list.map(c => c.name.charAt(0).toUpperCase()))].sort((a, b) => a.localeCompare(b, 'ru'));
        box.innerHTML = list.map(c => `<div class="pc-file-card" style="--tab-i:${letters.indexOf(c.name.charAt(0).toUpperCase()) % 9}">${smallCard(c, by)}</div>`).join('')
            + '<div class="pc-file-end" aria-hidden="true"></div>';
        box.scrollTop = 0;
        layout();
        if (dir) {
            box.classList.remove('is-entering-next', 'is-entering-prev');
            void box.offsetWidth;
            box.classList.add(dir > 0 ? 'is-entering-next' : 'is-entering-prev');
        }
        file.root.querySelectorAll('.pc-chunk-tab').forEach((t, i) => {
            t.classList.toggle('is-current', i === ci);
            t.setAttribute('aria-selected', String(i === ci));
        });
    }

    // поднять карточку (наведение, поиск, листание стрелками в анкете, касание на телефоне)
    function liftCard(name, scroll) {
        const box = cardsEl();
        if (!box) return;
        box.querySelectorAll('.pc-file-card.is-lifted').forEach(el => el.classList.remove('is-lifted'));
        if (!name) return;
        // карточка из другой пачки — сначала открыть её пачку
        const ci = file.chunks.findIndex(ch => ch.list.some(c => c.name === name));
        if (ci >= 0 && ci !== file.ci) showChunk(ci, ci > file.ci ? 1 : -1);
        const card = box.querySelector(`.pc-card[data-name="${CSS.escape(name)}"]`);
        const item = card && card.closest('.pc-file-card');
        if (!item) return;
        item.classList.add('is-lifted');
        if (scroll && box.scrollHeight > box.clientHeight) {
            const top = parseFloat(item.style.top) || 0;
            box.scrollTo({ top: Math.max(0, top - box.clientHeight / 2), behavior: 'smooth' });
        }
    }

    /* ---------- Сортировка: студенты — имя / факультет / курс, преподаватели — имя / факультет ---------- */
    const SORTS = { name: 'имя', faculty: 'факультет', course: 'курс' };
    const sortState = {};   // выбранная сортировка для каждой группы (по названию)

    const byNameCmp = (a, b) => a.name.localeCompare(b.name, 'ru');
    function sorted(list, by) {
        const l = [...list];
        if (by === 'faculty') return l.sort((a, b) => facShort(a.faculty).localeCompare(facShort(b.faculty), 'ru') || byNameCmp(a, b));
        if (by === 'course') return l.sort((a, b) => ((Number(a.course) || 99) - (Number(b.course) || 99)) || byNameCmp(a, b));
        return l.sort(byNameCmp);
    }

    function renderSortBar() {
        const g = group();
        const bar = file.root.querySelector('.pc-sort');
        const options = g.sorts || [];
        bar.hidden = options.length < 2;
        const current = sortState[g.title] || 'name';
        bar.innerHTML = options.map(k => `
            <button class="pc-sort-btn${k === current ? ' is-current' : ''}" type="button" data-sort="${k}" aria-pressed="${k === current}">${SORTS[k]}</button>`).join('');
    }

    function renderGroup(dir = 0) {
        const g = group();
        const by = sortState[g.title] || 'name';
        const list = sorted(g.list, by);
        g.view = list;
        const stage = file.root.querySelector('.pc-stage');
        stage.querySelector('.pc-deck-name').textContent = g.title;
        // соседние группы по бокам от названия
        const n = file.groups.length;
        const side = (sel, dir) => {
            const b = stage.querySelector(sel);
            b.hidden = n < 2;
            b.querySelector('.pc-deck-side-name').textContent = file.groups[(file.gi + dir + n) % n].title;
        };
        side('.pc-deck-side--prev', -1);
        side('.pc-deck-side--next', 1);
        stage.querySelector('.pc-deck-count').textContent = `${g.list.length} ${RCU.plural(g.list.length, 'персонаж', 'персонажа', 'персонажей')}`;
        renderSortBar();
        file.chunks = makeChunks(list, by);
        stage.querySelector('.pc-chunk-tabs').innerHTML = file.chunks.map((ch, i) => `
            <button class="pc-chunk-tab" type="button" role="tab" data-ci="${i}" title="${ch.list.length} ${RCU.plural(ch.list.length, 'персонаж', 'персонажа', 'персонажей')}">${esc(ch.label)}</button>`).join('');
        showChunk(0, dir);
        file.root.querySelectorAll('.pc-dot').forEach((d, i) => d.classList.toggle('is-current', i === file.gi));
        RCU.widenHeadings(stage);
        measure();
        layout();
    }

    async function switchGroup(dir) {
        if (file.busy || file.groups.length < 2) return;
        file.busy = true;
        const stage = file.root.querySelector('.pc-stage');
        stage.classList.add(dir > 0 ? 'is-leaving-left' : 'is-leaving-right');
        await new Promise(r => setTimeout(r, 220));
        file.gi = (file.gi + dir + file.groups.length) % file.groups.length;
        renderGroup();
        stage.classList.remove('is-leaving-left', 'is-leaving-right');
        stage.classList.add(dir > 0 ? 'is-entering-right' : 'is-entering-left');
        void stage.offsetWidth;
        stage.classList.remove('is-entering-right', 'is-entering-left');
        await new Promise(r => setTimeout(r, 260));
        file.busy = false;
    }

    // высота экрана — видимая часть основного блока (без строки поиска)
    function measure() {
        if (!file.root) return;
        const scroller = document.querySelector('.main-scroll-viewport');
        const screen = file.root.querySelector('.pc-screen');
        if (scroller && screen) {
            const cs = getComputedStyle(scroller);
            // поиск теперь в строке с сортировкой — отдельно его высоту не вычитаем
            const h = scroller.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 24;
            screen.style.height = `${Math.max(320, h)}px`;
        }
    }

    // перейти к персонажу: нужная группа, его карточка выдвинута и видна; при open — открыть анкету
    async function goTo(name, open) {
        const gi = file.groups.findIndex(g => g.list.some(c => c.name === name));
        if (gi < 0 || file.busy) return false;
        if (gi !== file.gi) {
            file.gi = gi;
            renderGroup();
        }
        liftCard(name, true);
        if (open) openCharacter(name);
        return true;
    }

    const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

    function bindSearch(root) {
        const input = root.querySelector('.pc-search-input');
        const list = root.querySelector('.pc-search-list');
        let found = [], foundPlayers = [];
        const close = () => { list.hidden = true; list.innerHTML = ''; };
        // отвечающий находится по имени, ссылке на ВК или VK ID
        // запрос как набран и в другой раскладке («fpfkbz» → «азалия»)
        let qs = [];
        const has = (s) => qs.some(q => norm(s).includes(q));
        const playerMatches = (p, q) => has(p.name) || has(p.url)
            || (!!p.id && /\d/.test(q) && p.id.includes(q.replace(/^id/, '')));
        const show = () => {
            const q = norm(input.value).trim();
            qs = RCU.queryVariants(input.value);
            if (!q) { close(); return; }
            foundPlayers = data.players ? [...data.players.values()].filter(p => playerMatches(p, q)).slice(0, 3) : [];
            const ofPlayer = new Set(foundPlayers.flatMap(p => p.characters.map(c => c.name)));
            found = data.characters.filter(c => has(c.name) || has(c.faculty)
                || has(c.subject) || has(c.post) || ofPlayer.has(c.name)).slice(0, 8);
            const players = foundPlayers.map((p, i) => `
                    <li><button class="pc-search-item pc-search-item--player" type="button" data-p="${i}">
                        <span class="pc-search-name">${esc(p.name)}</span>
                        <span class="pc-search-meta">отвечающий</span>
                    </button></li>`).join('');
            const chars = found.map((c, i) => `
                    <li><button class="pc-search-item" type="button" data-i="${i}">
                        <span class="pc-search-name">${esc(c.name)}</span>
                        <span class="pc-search-meta">${esc(c.role === 'персонал' ? c.post : shortFaculty(c.faculty))}</span>
                    </button></li>`).join('');
            list.innerHTML = (players + chars) || '<li class="pc-search-none">никого не нашлось</li>';
            list.hidden = false;
        };
        // значок лупы раскрывает строку поиска (она сдвигает кнопки сортировки влево)
        const box = root.querySelector('.pc-search');
        const btn = root.querySelector('.pc-search-btn');
        const setOpen = (on) => {
            box.classList.toggle('is-open', on);
            btn.setAttribute('aria-expanded', String(on));
            input.tabIndex = on ? 0 : -1;
            if (on) setTimeout(() => input.focus(), 50);
            else { input.value = ''; close(); }
        };
        btn.addEventListener('click', () => setOpen(!box.classList.contains('is-open')));
        input.addEventListener('blur', () => setTimeout(() => {
            if (!input.value && !box.contains(document.activeElement)) setOpen(false);
        }, 150));
        input.addEventListener('input', show);
        input.addEventListener('focus', show);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && foundPlayers[0]) { e.preventDefault(); close(); location.hash = RCU.playerHref(foundPlayers[0].key); return; }
            if (e.key === 'Enter' && found[0]) { e.preventDefault(); goTo(found[0].name, true); close(); input.blur(); }
            if (e.key === 'Escape') { close(); input.blur(); }
        });
        list.addEventListener('click', (e) => {
            const b = e.target.closest('.pc-search-item');
            if (!b) return;
            if (b.dataset.p != null) { const p = foundPlayers[Number(b.dataset.p)]; close(); location.hash = RCU.playerHref(p.key); return; }
            goTo(found[Number(b.dataset.i)].name, true);
            close();
        });
        document.addEventListener('click', (e) => { if (!e.target.closest('.pc-search')) close(); });
    }

    async function setSort(by) {
        const g = group();
        if (file.busy || (sortState[g.title] || 'name') === by) return;
        sortState[g.title] = by;
        renderGroup();
    }

    function bindFile(root) {
        const box = root.querySelector('.pc-file');
        root.querySelector('.pc-sort').addEventListener('click', (e) => {
            const b = e.target.closest('.pc-sort-btn');
            if (b) setSort(b.dataset.sort);
        });

        // по бокам от названия — соседние группы со стрелками
        root.querySelector('.pc-deck-side--prev').addEventListener('click', () => switchGroup(-1));
        root.querySelector('.pc-deck-side--next').addEventListener('click', () => switchGroup(1));

        // ярлычки пачек
        root.querySelector('.pc-chunk-tabs').addEventListener('click', (e) => {
            const t = e.target.closest('.pc-chunk-tab');
            if (!t) return;
            const ci = Number(t.dataset.ci);
            if (ci !== file.ci) showChunk(ci, ci > file.ci ? 1 : -1);
        });

        // Нажатие открывает анкету — с одного касания.
        // Палец, который ведут по стопке, перебирает карточки, как мышь (см. pick);
        // после такого проведения отпускание ничего не открывает — поднятая карточка
        // остаётся, по ней можно нажать.
        let swiped = false, startX = 0, startY = 0;
        box.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch') return;
            swiped = false; startX = e.clientX; startY = e.clientY;
        });
        box.addEventListener('click', (e) => {
            if (swiped) { swiped = false; return; }
            const item = e.target.closest('.pc-file-card');
            if (!item) { liftCard(null); return; }
            openCharacter(item.querySelector('.pc-card').dataset.name);
        });
        // Наведение (мышь или палец). Карточку выбираем по неподвижной разметке, а не по :hover:
        // поднятая карточка уходит из-под указателя, и иначе соседние начинали бы дёргаться.
        // Пока указатель над уже поднятой карточкой — она остаётся, до неё можно дотянуться.
        let lastY = null;
        const pick = (e) => {
            if (!file.geom) return;
            const goingUp = lastY != null && e.clientY < lastY;
            lastY = e.clientY;
            if (e.pointerType === 'touch') {
                if (!e.buttons && e.type === 'pointermove') return;
                if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) swiped = true;
                if (!swiped) return;   // просто касание — его обработает click
            } else if (e.pointerType !== 'mouse') return;
            const cur = box.querySelector('.pc-file-card.is-lifted');
            // ведут вверх — выбираем по раскладке (иначе поднятая карточка закрывает те, что выше);
            // вниз или на месте — поднятая остаётся, пока указатель на ней
            if (cur && !goingUp) {
                const r = cur.getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
            }
            const cards = box.querySelectorAll('.pc-file-card');
            const ref = [...cards].find(x => !x.classList.contains('is-lifted')) || cards[0];
            const rest = ref && ref.getBoundingClientRect();
            if (!rest || e.clientX < rest.left || e.clientX > rest.right) { liftCard(null); return; }
            const { top0, step, n } = file.geom;
            const y = e.clientY - box.getBoundingClientRect().top + box.scrollTop;
            if (y < top0) { liftCard(null); return; }
            const item = cards[Math.max(0, Math.min(n - 1, Math.floor((y - top0) / step)))];
            if (!item.classList.contains('is-lifted')) liftCard(item.querySelector('.pc-card').dataset.name);
        };
        box.addEventListener('pointermove', pick);
        box.addEventListener('mouseleave', () => liftCard(null));
    }

    // стрелки клавиатуры ←→ — группы
    document.addEventListener('keydown', (e) => {
        if (!file.root || !document.body.contains(file.root) || (modal && !modal.hidden)) return;
        if (e.target.closest && e.target.closest('input, textarea')) return;
        if (e.key === 'ArrowLeft') switchGroup(-1);
        else if (e.key === 'ArrowRight') switchGroup(1);
    });
    window.addEventListener('resize', () => { measure(); layout(); });

    RCU.openCharacter = (name) => openCharacter(name);
    RCU.smallCharacterCard = (c) => smallCard(c);
    RCU.setPublicData = (d) => { data = d; };

    RCU.pages.characters = {
        title: 'Персонажи',
        load: () => RCU.publicData(),
        render(root, d) {
            data = d;
            const SORTS_OF = { 'студент': ['name', 'faculty', 'course'], 'преподаватель': ['name', 'faculty'] };
            const groups = ROLES.map(([role, title]) => ({ title, list: d.characters.filter(c => c.role === role), sorts: SORTS_OF[role] || [] }));
            const other = d.characters.filter(c => !ROLES.some(([r]) => r === c.role));
            if (other.length) groups.push({ title: 'остальные', list: other });
            file.groups = groups.filter(g => g.list.length);
            file.gi = Math.min(file.gi, Math.max(0, file.groups.length - 1));
            file.busy = false;
            file.root = root;
            loadAnketas();
            if (!file.groups.length) { root.innerHTML = '<p class="dl-status">Персонажей пока нет.</p>'; return; }

            root.innerHTML = `
                <div class="pc-screen">
                    <div class="pc-stage">
                        <div class="pc-deck-head">
                            <button class="pc-deck-side pc-deck-side--prev" type="button" aria-label="Предыдущая группа">
                                <span class="pc-deck-arrow" aria-hidden="true"></span><span class="pc-deck-side-name"></span>
                            </button>
                            <h2 class="pc-deck-title"><span class="pc-deck-name"></span></h2>
                            <button class="pc-deck-side pc-deck-side--next" type="button" aria-label="Следующая группа">
                                <span class="pc-deck-side-name"></span><span class="pc-deck-arrow" aria-hidden="true"></span>
                            </button>
                        </div>
                        <div class="pc-deck-count"></div>
                        <div class="pc-tools">
                            <div class="pc-sort" role="group" aria-label="Сортировка"></div>
                            <div class="pc-search">
                                <input class="dl-search-input pc-search-input" type="search" autocomplete="off"
                                    placeholder="имя, факультет, отвечающий" aria-label="Поиск персонажа" tabindex="-1">
                                <button class="pc-search-btn" type="button" aria-label="Поиск" aria-expanded="false"></button>
                                <ul class="pc-search-list" hidden></ul>
                            </div>
                        </div>
                        <div class="pc-file"></div>
                        <div class="pc-chunk-tabs" role="tablist" aria-label="Пачки карточек"></div>
                        <div class="pc-dots">${file.groups.map(g => `<span class="pc-dot" title="${esc(g.title)}"></span>`).join('')}</div>
                    </div>
                </div>`;
            bindFile(root);
            bindSearch(root);
            renderGroup();
            // адрес вида #characters/Аден_Кингсли — сразу открыть его карточку
            const wanted = unslug(RCU.routeParam);
            if (wanted && d.byName.has(wanted)) setTimeout(() => goTo(wanted, true), 400);
            // после загрузки шрифтов и картинок и после того, как блок раздела
            // принял форму прямоугольника (≈0,7 с), высота экрана и карточек меняется
            requestAnimationFrame(() => { measure(); layout(); });
            // высота карточек меняется после загрузки шрифта (длинные факультеты переносятся)
            if (document.fonts) document.fonts.ready.then(() => { measure(); layout(); });
            if (window.ResizeObserver) {
                if (file.observer) file.observer.disconnect();
                file.observer = new ResizeObserver(() => layout());
                file.observer.observe(root.querySelector('.pc-file'));
            }
            setTimeout(() => { measure(); layout(); }, 800);
            setTimeout(() => { measure(); layout(); }, 3800);   // после заставки при первом открытии
        },
    };
})();
