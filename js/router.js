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

    function currentPage() {
        const name = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
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
        // мышь: навели на кончик — шапка выезжает; увели с шапки — прячется
        tip.addEventListener('mouseenter', (e) => { if (e.pointerType !== 'touch') setPeek(true); });
        header.addEventListener('mouseleave', () => {
            if (!html.classList.contains('header-peek')) return;
            peekTimer = setTimeout(() => setPeek(false), 350);
        });
        header.addEventListener('mouseenter', () => clearTimeout(peekTimer));
        // палец: нажатие мимо шапки или по пункту меню — шапка прячется
        document.addEventListener('click', (e) => {
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
            p.title = 'Сайт берёт данные из таблиц с небольшой задержкой';
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

        setRibbon(name ? RCU.pages[name].title : '');
        setSectionMode(!!name);
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
                addUpdated(root);
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

    // В фоне пришли обновлённые таблицы — тихо перерисовываем открытый раздел,
    // сохраняя прокрутку и раскрытые вкладки
    window.addEventListener('rcu:updated', async () => {
        const name = currentPage();
        if (!name) { renderHome(navToken); return; }
        const root = view.querySelector('.page-root');
        if (!root) return;
        const token = navToken;
        try {
            const data = await dataOf(name);
            if (token !== navToken) return;
            const label = (s) => (s.querySelector('.dl-group-name') || s).textContent.trim();
            const openGroups = [...root.querySelectorAll('details[open] > summary')].map(label);
            const scrollTop = scroller ? scroller.scrollTop : 0;
            RCU.pages[name].render(root, data);
            addUpdated(root);
            root.querySelectorAll('details > summary').forEach(s => {
                if (openGroups.includes(label(s))) s.parentElement.open = true;
            });
            if (scroller) scroller.scrollTop = scrollTop;
        } catch (err) {
            console.warn('Не удалось обновить раздел:', err);
        }
    });

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
