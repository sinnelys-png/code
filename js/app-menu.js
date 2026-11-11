// Мини-приложение ВК (только index.html): в разделах вместо шапки — выдвижное меню слева.
// Закладка с › у левого края блока: наведение мыши или нажатие выдвигает панель
// (герб, под ним пункты меню через ✦). Стили — css/app-menu.css.
(() => {
    const html = document.documentElement;
    const ribbon = document.querySelector('.page-ribbon');
    const block = document.querySelector('.main-inner-content');
    const headerLinks = [...document.querySelectorAll('header a[href^="#"]')];
    const logo = document.querySelector('header .logo');
    if (!ribbon || !headerLinks.length) return;

    // панель собирается из пунктов шапки — меню всегда одинаковое
    const menu = document.createElement('nav');
    menu.className = 'app-menu';
    menu.setAttribute('aria-label', 'Меню');
    menu.innerHTML = `
        <a class="app-menu-logo logo-container" href="#" aria-label="На главную">${logo ? `<img class="logo" src="${logo.getAttribute('src')}" alt="">` : ''}</a>
        ${headerLinks.map(a => `<a class="app-menu-link" href="${a.getAttribute('href')}">${a.textContent.trim()}</a>`)
            .join('<span class="app-menu-sep star-separator" aria-hidden="true">✦</span>')}`;
    document.body.appendChild(menu);

    // наведение — как в шапке: блик по пунктам и гербу, звёздочка поворачивается (js/site.js)
    if (matchMedia('(hover: hover)').matches) {
        menu.querySelectorAll('.app-menu-link, .app-menu-logo').forEach(el => {
            el.addEventListener('mouseenter', () => el.classList.add('is-glaring'));
            el.addEventListener('animationend', () => el.classList.remove('is-glaring'));
        });
        menu.querySelectorAll('.app-menu-sep').forEach(st => {
            st.addEventListener('mouseenter', () => st.classList.add('is-spinning'));
            st.addEventListener('animationend', () => st.classList.remove('is-spinning'));
        });
    }

    // блок в разделах стоит по центру экрана: в разметке до него — отступы страницы и шапка
    const header = document.querySelector('header');
    function measureHeader() {
        const pad = parseFloat(getComputedStyle(document.documentElement).paddingTop) + parseFloat(getComputedStyle(document.body).paddingTop);
        html.style.setProperty('--app-hdr', `${pad + (header ? header.offsetHeight : 0)}px`);
    }
    measureHeader();
    window.addEventListener('resize', measureHeader);

    // лента теперь кнопка меню
    ribbon.setAttribute('role', 'button');
    ribbon.setAttribute('aria-label', 'Меню');
    ribbon.removeAttribute('aria-hidden');

    let closeTimer = 0;
    function setOpen(on) {
        clearTimeout(closeTimer);
        if (on) {
            // панель по высоте — как основной блок (сверху у ВК своя панель)
            const r = block.getBoundingClientRect();
            menu.style.setProperty('--am-top', `${Math.max(0, r.top)}px`);
            menu.style.setProperty('--am-h', `${r.height}px`);
        }
        html.classList.toggle('app-menu-open', on);
        ribbon.setAttribute('aria-expanded', String(on));
    }
    const isOpen = () => html.classList.contains('app-menu-open');

    // нажатие на ленту — открыть / закрыть (и не показывать шапку, как в site.html)
    ribbon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (html.classList.contains('is-section')) setOpen(!isOpen());
    });

    // мышь: навели на ленту — выезжает; увели с ленты и панели — прячется
    const hoverIn = (e) => { if (e.pointerType === 'mouse' && html.classList.contains('is-section')) setOpen(true); };
    const hoverOut = (e) => {
        if (e.pointerType !== 'mouse') return;
        const to = e.relatedTarget;
        if (to && (menu.contains(to) || ribbon.contains(to))) return;
        closeTimer = setTimeout(() => setOpen(false), 350);
    };
    ribbon.addEventListener('pointerenter', hoverIn);
    menu.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    ribbon.addEventListener('pointerleave', hoverOut);
    menu.addEventListener('pointerleave', hoverOut);

    // пункт меню, нажатие мимо панели, Escape — закрыть
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', (e) => {
        if (isOpen() && !menu.contains(e.target) && !ribbon.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setOpen(false); });

    // текущий раздел подсвечен; на главной меню закрыто
    function markCurrent() {
        const h = location.hash.split('/')[0] || '#';
        menu.querySelectorAll('.app-menu-link').forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === h));
        if (!location.hash.replace(/^#\/?/, '')) setOpen(false);
    }
    window.addEventListener('hashchange', markCurrent);
    window.addEventListener('resize', () => { if (isOpen()) setOpen(true); });
    markCurrent();
})();
