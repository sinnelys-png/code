// Переключение страниц без перезагрузки сайта.
// Адреса: index.html#deadlines, #activity, #schedule; пустой адрес — главная.
// Шапка, фон и анимации остаются на месте, меняется только содержимое основного блока.
(() => {
    const view = document.getElementById('view');
    const scroller = document.querySelector('.main-scroll-viewport');
    const homeHTML = document.getElementById('home-template').innerHTML;
    const navLinks = document.querySelectorAll('header a[href^="#"]');
    const logo = document.querySelector('.logo-container');
    const ribbon = document.querySelector('.page-ribbon');
    const ribbonText = ribbon && ribbon.querySelector('.page-ribbon-text');

    const { dataOf } = RCU;
    let navToken = 0;    // чтобы медленный ответ старой страницы не перерисовал новую

    // «#characters/Аден_Кингсли» → страница characters, параметр «Аден_Кингсли» (RCU.routeParam)
    function currentPage() {
        const [name, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
        RCU.routeParam = rest.join('/');
        return RCU.pages[name] ? name : '';
    }

    // Лента с названием: уезжает под клапан шапки, меняет надпись и выезжает обратно.
    // Длина ленты сама подстраивается под длину названия.
    let ribbonToken = 0;
    async function setRibbon(title) {
        if (!ribbon) return;
        const token = ++ribbonToken;
        if (ribbonText.textContent === title && !ribbon.classList.contains('is-hidden')) return;
        if (!ribbon.classList.contains('is-hidden')) {
            ribbon.classList.add('is-hidden');
            await new Promise(r => setTimeout(r, 380));
            if (token !== ribbonToken) return;
        }
        ribbonText.textContent = title;
        if (title) {
            void ribbon.offsetHeight;          // новая длина применяется, пока лента спрятана
            ribbon.classList.remove('is-hidden');
        }
    }

    // Проявление текста снизу вверх, как при первом открытии
    function enter(el) {
        el.classList.remove('is-entering');
        void el.offsetWidth;
        el.classList.add('is-entering');
    }

    // Сводка на главной (js/pages/home.js)
    async function renderHome(token) {
        const dash = view.querySelector('.home-dash');
        if (!dash || !RCU.home) return;
        await RCU.home.render(dash, view.querySelector('.home-title'));
        addUpdated(dash);
        RCU.widenHeadings(view);
        if (token === navToken) enter(dash);
    }

    /* ---------- Разделы: шапка прячется до кончика (css/sections.css) ---------- */
    const html = document.documentElement;
    const header = document.querySelector('header');
    const tip = document.querySelector('.header-tip');
    let peekTimer = 0;

    function setPeek(on) {
        clearTimeout(peekTimer);
        html.classList.toggle('header-peek', on);
        if (tip) {
            tip.setAttribute('aria-expanded', String(on));
            tip.setAttribute('aria-label', on ? 'Скрыть меню' : 'Показать меню');
        }
    }

    function setSectionMode(on) {
        const changed = html.classList.contains('is-section') !== on;
        html.classList.toggle('is-section', on);
        setPeek(false);
        // после смены формы блока пересчитываем цвет фона закреплённых заголовков
        if (changed) setTimeout(updateStickyBg, 750);
    }

    if (tip && header) {
        tip.addEventListener('click', () => setPeek(!html.classList.contains('header-peek')));
        // мышь: навели на кончик — шапка выезжает; увели с шапки — прячется.
        // pointerenter, а не mouseenter: у mouseenter нет pointerType, и на телефоне касание
        // сначала «наводило» (шапка выезжала), а следом click тут же её прятал — нужно было два касания
        tip.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setPeek(true); });
        header.addEventListener('mouseleave', () => {
            if (!html.classList.contains('header-peek')) return;
            peekTimer = setTimeout(() => setPeek(false), 350);
        });
        header.addEventListener('mouseenter', () => clearTimeout(peekTimer));
        // мышь у верхнего края страницы (выше основного блока) — тоже показываем шапку
        const block = document.querySelector('.main-content-block');
        document.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse' || !html.classList.contains('is-section')
                || html.classList.contains('intro') || html.classList.contains('header-peek')) return;
            const top = block ? block.getBoundingClientRect().top : 0;
            if (e.clientY <= top + 4) setPeek(true);
        }, { passive: true });

        document.addEventListener('click', (e) => {
            // нажатие на ленту с названием раздела показывает / прячет шапку
            if (e.target.closest('.page-ribbon') && html.classList.contains('is-section')) {
                setPeek(!html.classList.contains('header-peek'));
                return;
            }
            // палец: нажатие мимо шапки или по пункту меню — шапка прячется
            if (!html.classList.contains('header-peek')) return;
            if (!e.target.closest('header') || e.target.closest('header a')) setPeek(false);
        });
    }

    /* ---------- «обновлено N минут назад» внизу раздела ---------- */
    function addUpdated(root) {
        let p = root.querySelector(':scope > .page-updated');
        if (!p) {
            p = document.createElement('p');
            p.className = 'page-updated';
            root.appendChild(p);
        }
        p.textContent = RCU.updatedText();
    }

    function tickUpdated() {
        view.querySelectorAll('.page-updated').forEach(p => { p.textContent = RCU.updatedText(); });
    }
    setInterval(tickUpdated, 30000);
    window.addEventListener('rcu:fresh', () => setTimeout(tickUpdated, 0));

    async function show() {
        const name = currentPage();
        const token = ++navToken;

        navLinks.forEach(a => {
            const on = a.getAttribute('href') === '#' + name;
            a.classList.toggle('is-current', on);
            if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });

        // настройки страницы: ribbon: false — без закладки с названием,
        // updated: true — внизу «обновлено N минут назад» (по умолчанию нет; есть только
        // на главной мини-приложения и у активности), fullBleed: true — содержимое на весь блок
        const opts = name ? RCU.pages[name] : {};
        setRibbon(name && opts.ribbon !== false ? opts.title : '');
        setSectionMode(!!name);
        html.classList.toggle('is-full-bleed', !!opts.fullBleed);
        view.classList.add('is-leaving');
        await new Promise(r => setTimeout(r, 150));
        if (token !== navToken) return;

        if (!name) {
            view.innerHTML = homeHTML;
            enter(view);
            document.title = 'ROYAL CROSSBREED UNIVERSITY';
            renderHome(token);
        } else {
            const page = RCU.pages[name];
            document.title = `${page.title} — ROYAL CROSSBREED UNIVERSITY`;
            view.innerHTML = `
                <h1 class="page-title visually-hidden">${RCU.esc(page.title)}</h1>
                <div class="page-root">${RCU.loaderHTML()}</div>`;
            const root = view.querySelector('.page-root');
            view.classList.remove('is-leaving');   // показываем «Загружаем…», пока ждём данные
            view.classList.remove('is-entering');
            try {
                const data = await dataOf(name);
                if (token !== navToken) return;
                page.render(root, data);
                if (page.updated === true) addUpdated(root);
                RCU.widenHeadings(root);
                enter(root);
            } catch (err) {
                console.error(err);
                if (token === navToken) {
                    root.innerHTML = '<p class="dl-status">Не удалось загрузить таблицу. Попробуйте ещё раз чуть позже.</p>';
                }
            }
        }

        if (scroller) scroller.scrollTop = 0;
        view.classList.remove('is-leaving');
    }

    window.addEventListener('hashchange', show);

    /* ---------- Потянуть вниз — обновить (палец) ----------
       Встроенный жест браузера здесь не срабатывает: страница неподвижна, листается
       только область внутри блока (а в ВК он и вовсе выключен). Поэтому свой:
       в самом верху области тянем содержимое вниз — появляется ✦, дотянули до
       готовности — отпускаем, и раздел заново скачивает данные (без кэша браузера).
       Не мешает тем, кто сам ловит палец (стопка карточек, граф, карта — touch-action). */
    (() => {
        if (!scroller) return;
        const READY = 64, MAX = 96;
        const holder = scroller.parentElement;
        const ind = document.createElement('div');
        ind.className = 'pull-indicator';
        ind.setAttribute('aria-hidden', 'true');
        ind.innerHTML = '<span class="pull-star">✦</span>';
        holder.appendChild(ind);

        let state = '', startX = 0, startY = 0, pull = 0;

        // палец на элементе, который сам листается или сам ловит касания
        function busy(el) {
            for (; el && el !== scroller; el = el.parentElement) {
                const cs = getComputedStyle(el);
                if (cs.touchAction === 'none' || cs.touchAction === 'pan-x') return true;
                if (el.scrollTop > 0 && /auto|scroll/.test(cs.overflowY)) return true;
            }
            return false;
        }

        function set(p, animate) {
            pull = p;
            const t = animate ? 'transform 0.3s ease, opacity 0.3s ease' : 'none';
            view.style.transition = t;
            ind.style.transition = t;
            view.style.transform = p ? `translateY(${p}px)` : '';
            ind.style.top = `${scroller.offsetTop}px`;
            ind.style.opacity = String(Math.min(1, p / READY));
            ind.style.transform = `translate(-50%, ${p / 2 - 12}px) rotate(${p * 3}deg)`;
            ind.classList.toggle('is-ready', p >= READY);
        }

        scroller.addEventListener('touchstart', (e) => {
            state = '';
            if (e.touches.length !== 1 || scroller.scrollTop > 0 || html.classList.contains('intro') || busy(e.target)) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            state = 'maybe';
        }, { passive: true });

        scroller.addEventListener('touchmove', (e) => {
            if (!state) return;
            const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
            if (state === 'maybe') {
                if (dy < -6 || Math.abs(dx) > Math.max(8, dy)) { state = ''; return; }   // листают вверх или вбок
                if (dy < 8) return;
                if (scroller.scrollTop > 0) { state = ''; return; }
                state = 'pull';
            }
            e.preventDefault();
            set(Math.max(0, Math.min(MAX, (dy - 8) * 0.5)));
        }, { passive: false });

        function release() {
            if (state !== 'pull') { state = ''; return; }
            state = '';
            const go = pull >= READY;
            set(0, true);
            if (go) {
                RCU.resetData();
                show();
            }
        }
        scroller.addEventListener('touchend', release);
        scroller.addEventListener('touchcancel', () => { if (state === 'pull') { state = ''; set(0, true); } });
    })();

    // Закреплённые заголовки (вкладки, даты) закрашиваются цветом блока на высоте
    // верхнего края области прокрутки: блок — градиент от #002F4A сверху к #001929 снизу.
    function updateStickyBg() {
        const block = document.querySelector('.main-inner-content');
        if (!block || !scroller) return;
        const b = block.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, (scroller.getBoundingClientRect().top - b.top) / b.height));
        const mix = (from, to) => Math.round(from + (to - from) * t);
        scroller.style.setProperty('--sticky-bg', `rgb(${mix(0, 0)}, ${mix(47, 25)}, ${mix(74, 41)})`);
    }
    // Отмечаем заголовки, которые сейчас прилипли к верху области прокрутки
    let stuckFrame = 0;
    function markStuck() {
        stuckFrame = 0;
        if (!scroller) return;
        const top = scroller.getBoundingClientRect().top;
        view.querySelectorAll('.dl-group > summary, .sc-day-title, .dl-toolbar, .dl-mine-title').forEach(h => {
            const offset = parseFloat(getComputedStyle(h).top) || 0;   // заголовки вкладок липнут под поиском
            const stuck = scroller.scrollTop > 0 && Math.abs(h.getBoundingClientRect().top - top - offset) < 1.5;
            h.classList.toggle('is-stuck', stuck);
        });
    }
    if (scroller) scroller.addEventListener('scroll', () => {
        if (!stuckFrame) stuckFrame = requestAnimationFrame(markStuck);
    }, { passive: true });

    updateStickyBg();
    setTimeout(updateStickyBg, 3700);   // после заставки (во время неё блок сдвинут)
    window.addEventListener('resize', updateStickyBg);

    // Герб ведёт на главную
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.setAttribute('role', 'link');
        logo.setAttribute('aria-label', 'На главную');
        logo.addEventListener('click', () => {
            if (location.hash) location.hash = '';
        });
    }

    show().then(() => {
        // Остальные таблицы подгружаем заранее в фоне — переключение будет мгновенным
        const preload = () => Object.keys(RCU.pages).forEach(n => dataOf(n).catch(() => {}));
        if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 3000 });
        else setTimeout(preload, 1500);
    });
})();
