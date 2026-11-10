// Общие помощники для страниц с таблицами + реестр страниц (RCU.pages).
window.RCU = (() => {
    /* ---------- Параметры запуска ВКонтакте ----------
       ВК открывает мини-приложение с параметрами в адресе (vk_user_id, sign и др.).
       Запоминаем их и убираем из адреса, чтобы они не показывались при наведении
       на ссылки и не попадали в скопированную ссылку. */
    const LAUNCH_KEY = 'rcu-launch';
    const launch = (() => {
        const params = new URLSearchParams(location.search);
        const own = [...params.keys()].filter(k => k.startsWith('vk_') || k === 'sign' || k === 'odr_enabled');
        if (own.length) {
            const saved = Object.fromEntries(own.map(k => [k, params.get(k)]));
            try { sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(saved)); } catch (e) { /* без хранилища */ }
            own.forEach(k => params.delete(k));
            const rest = params.toString();
            history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
            return saved;
        }
        try { return JSON.parse(sessionStorage.getItem(LAUNCH_KEY)) || {}; } catch (e) { return {}; }
    })();

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

    function link(url, text, cls = '') {
        const href = safeUrl(url);
        return href
            ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`
            : `<span class="${cls}">${esc(text)}</span>`;
    }

    function plural(n, one, few, many) {
        const n10 = Math.abs(n) % 10, n100 = Math.abs(n) % 100;
        if (n10 === 1 && n100 !== 11) return one;
        if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
        return many;
    }

    // Сколько дней от сегодня до даты "YYYY-MM-DD" (отрицательное — уже прошло)
    function daysUntil(iso) {
        if (!iso) return null;
        const [y, m, d] = iso.split('-').map(Number);
        const today = new Date();
        const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        return Math.round((Date.UTC(y, m - 1, d) - t0) / 86400000);
    }

    // "Date(2026,0,6,14,0,0)" из выгрузки Google → "2026-01-06"
    function gvizDateToISO(v) {
        const m = /Date\((\d+),(\d+),(\d+)/.exec(String(v || ''));
        if (!m) return '';
        return `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }

    /**
     * Публичная выгрузка листа Google Таблицы.
     * Возвращает массив строк, где cell('B') → { v: значение, f: как показано в таблице }.
     */
    async function loadGviz(sheetId, gid) {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}&headers=0`;
        const text = await (await fetch(url)).text();
        const data = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
        if (data.status !== 'ok') throw new Error('Google Таблица вернула ошибку');
        const ids = data.table.cols.map(c => c.id);
        return data.table.rows.map(row => {
            const cell = (letter) => row.c[ids.indexOf(letter)] || null;
            cell.text = (letter) => {
                const c = cell(letter);
                return c ? String(c.f ?? c.v ?? '').trim() : '';
            };
            return cell;
        });
    }

    // Любая внешняя ссылка на сайте открывается в новом окне — даже если её добавят без target
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a || !/^https?:/i.test(a.href) || a.origin === location.origin) return;
        a.target = '_blank';
        a.rel = 'noopener';
    }, true);

    // Кто открыл мини-приложение (VK ID). Запрашивается один раз на всю сессию.
    let viewerPromise = null;
    function getViewerId() {
        if (!viewerPromise) {
            viewerPromise = (async () => {
                try {
                    if (window.vkBridge) {
                        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000));
                        const user = await Promise.race([vkBridge.send('VKWebAppGetUserInfo'), timeout]);
                        if (user && user.id) return String(user.id);
                    }
                } catch (e) { /* открыто не во ВКонтакте */ }
                return launch.vk_user_id || '';
            })();
        }
        return viewerPromise;
    }

    /* ---------- Цвета факультетов (по галстукам) ----------
       main — основной цвет галстука, stripe — цвет полосок.
       Факультет узнаётся по ключевому слову в названии из техтаблицы. */
    const FACULTIES = [
        ['химико',      '#8e8a5c', '#e8dcc8'],   // Химико-биологический
        ['философ',     '#3b2620', '#d9b8a8'],   // Философии и социальных наук
        ['историко',    '#7a5a48', '#e6d2c0'],   // Историко-археологический
        ['художеств',   '#d9bfa8', '#8a6a58'],   // Художественного и театрального искусства
        ['журналист',   '#a04e44', '#e8b8ac'],   // Журналистики и международных отношений
        ['реклам',      '#efebd8', '#1a1a1a'],   // Рекламы и маркетинга
        ['механико',    '#9cb8c2', '#eef3f5'],   // Механико-математический
        ['экономич',    '#24402f', '#d8c8a0'],   // Экономический
        ['гостинич',    '#c4c4da', '#5a3a3a'],   // Гостиничного дела
        ['филолог',     '#e8d3a6', '#8a7058'],   // Филологический
        ['спортив',     '#9a5e40', '#efd8c8'],   // Спортивный
        ['музыкал',     '#6e2e48', '#e8b8c4'],   // Музыкальный
        ['юридич',      '#151515', '#d8d8d8'],   // Юридический
    ];

    // Контраст двух цветов (#rrggbb) по WCAG — чтобы акценты факультета были видны на фоне темы
    function luminance(hex) {
        const n = parseInt(String(hex).replace('#', ''), 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255]
            .map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    }
    function contrast(a, b) {
        const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
    }
    // фон карточек в тёмной и светлой теме
    const THEME_BG = { d: '#05304b', l: '#f7f1e6' };
    // из двух цветов факультета — тот, что контрастнее на фоне темы
    const accentOn = (bg, main, stripe) => (contrast(main, bg) >= contrast(stripe, bg) ? main : stripe);

    // Атрибуты для аватара: класс has-faculty, цвета в CSS-переменных и название в подсказке.
    // --fac-accent-d / --fac-accent-l — цвет акцентов (линии, полосы прокрутки) для тёмной и светлой темы
    function facultyAttrs(faculty) {
        const name = String(faculty || '').trim();
        const hit = name && FACULTIES.find(([key]) => name.toLowerCase().includes(key));
        if (!hit) return { cls: '', attrs: '' };
        return {
            cls: ' has-faculty',
            attrs: ` style="--fac-main:${hit[1]};--fac-stripe:${hit[2]};--fac-accent-d:${accentOn(THEME_BG.d, hit[1], hit[2])};--fac-accent-l:${accentOn(THEME_BG.l, hit[1], hit[2])}" title="${esc(name)}"`,
        };
    }

    /* ---------- Широкие заголовки ----------
       У Greengoth нет широкого начертания, поэтому заголовки в блоках растягиваем по ширине
       (transform: scaleX, стили — css/pages.css, .wide). Растянутый текст занимает больше места,
       чем «видит» вёрстка, поэтому справа добавляем отступ на ту же величину. */
    const WIDE = 1.15;
    const WIDE_SELECTOR = '.user-title, .pc-deck-name, .home-title, .dl-group-name';

    function widenHeadings(scope) {
        if (!scope) return;
        scope.querySelectorAll(WIDE_SELECTOR).forEach(el => {
            let target = el;
            if (el.tagName !== 'SPAN') {
                target = el.querySelector(':scope > .wide');
                if (!target) {
                    target = document.createElement('span');
                    target.className = 'wide';
                    while (el.firstChild) target.appendChild(el.firstChild);
                    el.appendChild(target);
                }
            } else {
                target.classList.add('wide');
            }
            target.style.marginRight = `${target.offsetWidth * (WIDE - 1)}px`;
        });
    }

    // Пересчитываем после загрузки шрифтов и при смене размера окна (меняется размер текста)
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => widenHeadings(document.getElementById('view')));
    }
    window.addEventListener('resize', () => widenHeadings(document.getElementById('view')));

    // Разделитель между блоком «Ваши …» и основным списком: ✦ —— ✦✦✦ —— ✦
    function dividerHTML() {
        return `
            <div class="star-divider" aria-hidden="true">
                <span class="sd-star">✦</span>
                <span class="sd-line"></span>
                <span class="sd-mid"><span class="sd-star">✦</span><span class="sd-star sd-big">✦</span><span class="sd-star">✦</span></span>
                <span class="sd-line"></span>
                <span class="sd-star">✦</span>
            </div>`;
    }

    // Песочные часы на время загрузки (стили — css/pages.css, блок «ЗАГРУЗКА»)
    let loaderId = 0;
    function loaderHTML(text = 'Загружаем таблицу…') {
        const id = 'hg' + (++loaderId); // уникальный id для clipPath, если часов несколько
        return `
            <div class="hg-loader" role="status" aria-live="polite">
                <svg class="hg" viewBox="0 0 60 100" aria-hidden="true">
                    <defs>
                        <clipPath id="${id}">
                            <path d="M15 11 C15 34 27 43 28.5 50 C27 57 15 66 15 89 L45 89 C45 66 33 57 31.5 50 C33 43 45 34 45 11 Z" />
                        </clipPath>
                    </defs>
                    <g class="hg-body">
                        <g clip-path="url(#${id})">
                            <rect class="hg-sand-top" x="10" y="20" width="40" height="30" />
                            <rect class="hg-sand-bottom" x="10" y="62" width="40" height="27" />
                            <line class="hg-stream" x1="30" y1="49" x2="30" y2="89" />
                        </g>
                        <path class="hg-glass" d="M15 11 C15 34 27 43 28.5 50 C27 57 15 66 15 89 L45 89 C45 66 33 57 31.5 50 C33 43 45 34 45 11 Z" />
                        <path class="hg-frame" d="M7 6 H53 M7 94 H53 M10 6 V94 M50 6 V94" />
                        <circle class="hg-knob" cx="10" cy="6" r="1.6" /><circle class="hg-knob" cx="50" cy="6" r="1.6" />
                        <circle class="hg-knob" cx="10" cy="94" r="1.6" /><circle class="hg-knob" cx="50" cy="94" r="1.6" />
                    </g>
                </svg>
                <p class="hg-text">${esc(text)}</p>
            </div>`;
    }

    // Данные страниц (каждая собирается один раз и доступна всем страницам)
    const loaded = {};

    /* ---------- Кэш таблиц в браузере ----------
       Свежие данные (моложе FRESH_MS) берутся из памяти браузера без запроса к Google.
       Постарше — сразу скачиваются новые (скрипт отдаёт их из своего кэша за секунду,
       а таблицы после записи сами просят его пересобрать ответ). Уже показанная страница
       никогда не перерисовывается сама — текст не мигает. Если Google не ответил,
       показываем то, что было сохранено. */
    const FRESH_MS = 2 * 60 * 1000;
    const CACHE_PREFIX = 'rcu-cache:';
    const inFlight = {};   // один запрос на ключ за сессию, даже если его просят несколько страниц

    function readCache(key) {
        try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + key)); } catch (e) { return null; }
    }

    function writeCache(key, data) {
        try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* нет места или запрещено */ }
    }

    // Когда были получены данные, которые сейчас на экране (по ключам кэша)
    const shownAt = {};

    function cached(key, fetcher) {
        if (inFlight[key]) return inFlight[key];
        const saved = readCache(key);
        const age = saved ? Date.now() - saved.t : Infinity;

        if (age < FRESH_MS) {
            shownAt[key] = saved.t;
            return (inFlight[key] = Promise.resolve(saved.data));
        }

        const fresh = fetcher().then(data => {
            writeCache(key, data);
            shownAt[key] = Date.now();
            window.dispatchEvent(new CustomEvent('rcu:fresh', { detail: key }));
            return data;
        });

        inFlight[key] = fresh.catch(err => {
            delete inFlight[key];
            if (saved) { shownAt[key] = saved.t; return saved.data; }   // Google не ответил — лучше старое, чем ничего
            throw err;
        });
        return inFlight[key];
    }

    /* ---------- Один запрос за всеми таблицами ----------
       Apps Script (apps-script/Code.gs) отдаёт дедлайны, расписание и активность одним ответом
       и сам держит его в кэше 5 минут, так что таблицы читаются не чаще раза в 5 минут. */
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw2SKzXGnOKCjchcWMT7XGT7XES0rh40Y-9qsY9wCmsO8_BH3hOTFc06WIN5ekLZUiu/exec';

    let bundleUpdated = 0;   // когда скрипт прочитал таблицы (поле updated в ответе)

    async function fetchBundle() {
        const data = await (await fetch(SCRIPT_URL)).json();
        if (data.error) throw new Error(data.error);
        return data;
    }

    function bundle() {
        return cached('bundle', fetchBundle).then(data => {
            const t = Date.parse(data.updated || '');
            if (t) bundleUpdated = t;
            return data;
        });
    }

    // Насколько свежи данные на экране: для ответа скрипта — когда он читал таблицы,
    // для запасных выгрузок — когда их скачали. Берём самые старые.
    function updatedAt() {
        const times = Object.entries(shownAt).map(([k, t]) => (k === 'bundle' && bundleUpdated) ? bundleUpdated : t);
        return times.length ? Math.min(...times) : 0;
    }

    // «обновлено 5 минут назад»
    function updatedText() {
        const t = updatedAt();
        if (!t) return '';
        const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
        if (min < 1) return 'обновлено только что';
        if (min < 60) return `обновлено ${min} ${plural(min, 'минуту', 'минуты', 'минут')} назад`;
        const h = Math.floor(min / 60);
        return `обновлено ${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
    }

    // «Потянуть вниз — обновить»: забыть всё скачанное (в памяти и в браузере),
    // чтобы страницы заново взяли данные у скрипта
    function resetData() {
        for (const k in inFlight) delete inFlight[k];
        for (const k in loaded) delete loaded[k];
        for (const k in shownAt) delete shownAt[k];
        try {
            Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k));
        } catch (e) { /* без хранилища */ }
        window.dispatchEvent(new CustomEvent('rcu:reset'));
    }

    function dataOf(name) {
        if (!loaded[name]) {
            loaded[name] = pages[name].load().catch(err => {
                delete loaded[name];          // при ошибке попробуем ещё раз при следующем заходе
                throw err;
            });
        }
        return loaded[name];
    }

    const pages = {};
    return { resetData, esc, safeUrl, link, plural, daysUntil, gvizDateToISO, loadGviz, getViewerId, loaderHTML, dividerHTML, facultyAttrs, scriptUrl: SCRIPT_URL, widenHeadings, cached, bundle, updatedText, dataOf, pages };
})();
