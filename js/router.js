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

    async function show() {
        const name = currentPage();
        const token = ++navToken;

        navLinks.forEach(a => {
            const on = a.getAttribute('href') === '#' + name;
            a.classList.toggle('is-current', on);
            if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });

        setRibbon(name ? RCU.pages[name].title : '');
        view.classList.add('is-leaving');
        await new Promise(r => setTimeout(r, 150));
        if (token !== navToken) return;

        if (!name) {
            view.innerHTML = homeHTML;
            enter(view);
            document.title = 'ROYAL CROSSBREED UNIVERSITY';
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
        view.querySelectorAll('.dl-group > summary, .sc-day-title').forEach(h => {
            const stuck = scroller.scrollTop > 0 && Math.abs(h.getBoundingClientRect().top - top) < 1.5;
            h.classList.toggle('is-stuck', stuck);
        });
    }
    if (scroller) scroller.addEventListener('scroll', () => {
        if (!stuckFrame) stuckFrame = requestAnimationFrame(markStuck);
    }, { passive: true });

    updateStickyBg();
    setTimeout(updateStickyBg, 3200);   // после заставки (во время неё блок сдвинут)
    window.addEventListener('resize', updateStickyBg);

    // В фоне пришли обновлённые таблицы — тихо перерисовываем открытый раздел,
    // сохраняя прокрутку и раскрытые вкладки
    window.addEventListener('rcu:updated', async () => {
        const name = currentPage();
        const root = view.querySelector('.page-root');
        if (!name || !root) return;
        const token = navToken;
        try {
            const data = await dataOf(name);
            if (token !== navToken) return;
            const label = (s) => (s.querySelector('.dl-group-name') || s).textContent.trim();
            const openGroups = [...root.querySelectorAll('details[open] > summary')].map(label);
            const scrollTop = scroller ? scroller.scrollTop : 0;
            RCU.pages[name].render(root, data);
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
