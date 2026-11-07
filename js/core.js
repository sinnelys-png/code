// Общие помощники для страниц с таблицами + реестр страниц (RCU.pages).
window.RCU = (() => {
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
                return new URLSearchParams(location.search).get('vk_user_id') || '';
            })();
        }
        return viewerPromise;
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

    return { esc, safeUrl, link, plural, daysUntil, gvizDateToISO, loadGviz, getViewerId, loaderHTML, pages: {} };
})();
