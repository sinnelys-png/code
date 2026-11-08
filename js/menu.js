// Меню публичного сайта строится из одного списка — window.SITE_MENU в site.html.
// Чтобы добавить раздел: дописать строку в список и подключить страницу (js/pages/…).
//
// Как раскладывается:
//   • до 6 пунктов — поровну слева и справа от герба (справа на один больше, если нечётно);
//   • больше 6 — первые 5 в шапке, остальные в выпадающем «ещё ▾» справа.
// Подключается до js/site.js (там на пункты меню вешаются эффекты блика).
(() => {
    const items = window.SITE_MENU;
    const left = document.querySelector('.nav-left');
    const right = document.querySelector('.nav-right');
    if (!Array.isArray(items) || !left || !right) return;

    const MAX_IN_HEADER = 6;
    const visible = items.length > MAX_IN_HEADER ? items.slice(0, MAX_IN_HEADER - 1) : items;
    const more = items.length > MAX_IN_HEADER ? items.slice(MAX_IN_HEADER - 1) : [];

    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const link = ([href, title]) => `<a href="${esc(href)}">${esc(title)}</a>`;
    const join = (list) => list.map(link).join('<span class="star-separator">✦</span>');

    const half = Math.floor(visible.length / 2);
    left.innerHTML = join(visible.slice(0, half));
    right.innerHTML = join(visible.slice(half)) + (more.length ? `
        <span class="star-separator">✦</span>
        <div class="nav-more">
            <button class="nav-more-btn" type="button" aria-expanded="false">ещё ▾</button>
            <div class="nav-more-list" hidden>${more.map(link).join('')}</div>
        </div>` : '');

    // выпадающий список «ещё»
    const btn = right.querySelector('.nav-more-btn');
    if (btn) {
        const list = right.querySelector('.nav-more-list');
        const set = (open) => { list.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
        btn.addEventListener('click', (e) => { e.stopPropagation(); set(list.hidden); });
        document.addEventListener('click', () => set(false));
    }

    // ссылки на разделы на главной — из того же списка
    const tpl = document.getElementById('home-template');
    const homeLinks = tpl && tpl.content.querySelector('.pub-home-links');
    if (homeLinks) homeLinks.innerHTML = items.map(link).join('');

    // много пунктов — длинные названия могут переноситься на две строки
    if (visible.length > 4) document.querySelector('header').classList.add('has-many-items');
})();
