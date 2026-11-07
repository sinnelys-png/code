// Общий код всех страниц: фон-полосы, блики, анимации шапки и основного блока.

// ===== Анимации шапки и основного блока =====
  document.addEventListener("DOMContentLoaded", () => {
    // 1. НАХОДИМ ВСЕ НЕОБХОДИМЫЕ ЭЛЕМЕНТЫ
    const star = document.querySelector('.star-separator');
    const headerWrapper = document.querySelector('.header-center-wrapper');
    const mainBlock = document.querySelector('.main-inner-content');
    const scrollContainer = document.querySelector('.main-scroll-viewport');
    const menuLinks = document.querySelectorAll('header a');
    const logoContainer = document.querySelector('.logo-container');
    const strokeAnim1 = document.getElementById('stroke-anim-1');
    const strokeAnim2 = document.getElementById('stroke-anim-2');

    // 2. ОПРЕДЕЛЯЕМ: МОБИЛЬНОЕ ЛИ ЭТО УСТРОЙСТВО ИЛИ VK APP НА ТЕЛЕФОНЕ
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    if (isMobile) {
        // ==========================================================================
        // ЛОГИКА ДЛЯ ТЕЛЕФОНОВ: РЕДКАЯ ВОЛНА СВЕТА
        //  1) Текст меню + звёздочка + герб бликуют по очереди слева направо.
        //  2) Когда текст подходит к концу, по трём полосам бежит свет:
        //     полоса шапки и верхняя полоса блока — одновременно,
        //     нижняя полоса блока — чуть позже, «догоняет» их.
        // ==========================================================================

        /* НАСТРОЙКИ (в миллисекундах) */
        const FIRST_DELAY = 3000;    // первая волна после загрузки
        const PAUSE_MIN = 15000;     // пауза между волнами: от 15 ...
        const PAUSE_MAX = 25000;     // ... до 25 секунд (случайно)
        const TEXT_STEP = 220;       // задержка между соседними элементами меню
        const LINES_OVERLAP = 300;   // полосы стартуют за столько мс до блика последнего элемента
        const LINES_SWEEP = 1800;    // сколько свет бежит через весь экран
        const BOTTOM_LAG = 300;      // насколько нижняя полоса блока отстаёт от двух верхних
        const GLOW_R = 160;          // радиус светового пятна в пикселях экрана

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const bookmarkSvg = document.querySelector('.header-bookmark svg');
        const headerStrokeGrad = document.getElementById('header-global-stroke');
        const wait = (ms) => new Promise(r => setTimeout(r, ms));

        // Короткая вспышка одного элемента (классы is-mobile-pulsing описаны в CSS)
        function flash(el) {
            el.classList.remove('is-mobile-pulsing');
            void el.offsetWidth; // перезапуск анимации
            el.classList.add('is-mobile-pulsing');
            setTimeout(() => el.classList.remove('is-mobile-pulsing'), 1300);
        }

        // 1) Текст + герб: по очереди слева направо. Возвращает момент блика последнего элемента.
        function textWave() {
            const items = [...menuLinks, star, logoContainer]
                .filter(Boolean)
                .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
            items.forEach((el, i) => setTimeout(() => flash(el), i * TEXT_STEP));
            return (items.length - 1) * TEXT_STEP;
        }

        // 2) Три полосы одним светом
        function linesWave() {
            if (!bookmarkSvg || !headerStrokeGrad || !mainBlock) return Promise.resolve();
            const W = window.innerWidth;
            const sRect = bookmarkSvg.getBoundingClientRect();
            const mRect = mainBlock.getBoundingClientRect();
            const m = getComputedStyle(mainBlock).clipPath.match(/50% ([\d.]+)px/);
            const tri = m ? parseFloat(m[1]) : 60;
            const FROM = -GLOW_R, TO = W + GLOW_R;      // путь света в пикселях экрана
            const pos = (p) => FROM + (TO - FROM) * p;
            const vY = (x, w, depth) => depth * Math.max(0, 1 - Math.abs(x - w / 2) / (w / 2)); // y на «галочке»

            // Пятно одного размера на экране для всех трёх полос
            headerStrokeGrad.setAttribute('r', GLOW_R * 1010 / sRect.width);
            mainBlock.style.setProperty('--glow-r', `${GLOW_R}px`);

            const set = (name, v) => mainBlock.style.setProperty(name, v);
            const hideAll = () => {
                headerStrokeGrad.setAttribute('cx', '-9999');
                headerStrokeGrad.setAttribute('cy', '-9999');
                set('--mouse-x', '-999px'); set('--mouse-y', '-999px');
                set('--glow2-x', '-999px'); set('--glow2-y', '-999px');
            };

            return new Promise(resolve => {
                const t0 = performance.now();
                function frame(t) {
                    const pTop = (t - t0) / LINES_SWEEP;                 // шапка + верх блока
                    const pBottom = (t - t0 - BOTTOM_LAG) / LINES_SWEEP; // низ блока

                    if (pTop <= 1) {
                        const x = pos(pTop);
                        // полоса шапки (координаты SVG: 305 по краям, 405 в центре)
                        const xv = (x - sRect.left) * 1010 / sRect.width;
                        headerStrokeGrad.setAttribute('cx', xv);
                        headerStrokeGrad.setAttribute('cy', 305 + vY(xv, 1010, 100));
                        // верхняя полоса блока
                        const xm = x - mRect.left;
                        set('--mouse-x', `${xm}px`);
                        set('--mouse-y', `${vY(xm, mRect.width, tri)}px`);
                    } else {
                        headerStrokeGrad.setAttribute('cx', '-9999');
                        set('--mouse-x', '-999px');
                    }

                    if (pBottom >= 0 && pBottom <= 1) {
                        // нижняя полоса блока (7px у самого низа)
                        set('--glow2-x', `${pos(pBottom) - mRect.left}px`);
                        set('--glow2-y', `${mRect.height - 3.5}px`);
                    }

                    if (pBottom < 1) requestAnimationFrame(frame);
                    else { hideAll(); resolve(); }
                }
                requestAnimationFrame(frame);
            });
        }

        async function mobileWave() {
            if (!document.hidden) {           // в свёрнутой вкладке не тратим батарею
                const lastFlashAt = textWave();
                await wait(Math.max(0, lastFlashAt - LINES_OVERLAP));
                await linesWave();
            }
            setTimeout(mobileWave, PAUSE_MIN + Math.random() * (PAUSE_MAX - PAUSE_MIN));
        }

        if (!reduceMotion) setTimeout(mobileWave, FIRST_DELAY);

    } else {
        // ==========================================================================
        // ЛОГИКА ДЛЯ КОМПЬЮТЕРОВ: ИНТЕРАКТИВНОЕ СЛЕДОВАНИЕ ЗА МЫШЬЮ И БЛИКИ
        // ==========================================================================
        
        // Анимация вращения звёздочки
        if (star) {
            star.addEventListener('mouseenter', () => star.classList.add('is-spinning'));
            star.addEventListener('animationend', () => star.classList.remove('is-spinning'));
        }

        // Анимация перелива ссылок и герба при наведении
        const glareElements = document.querySelectorAll('header a, .logo-container');
        glareElements.forEach(element => {
            element.addEventListener('mouseenter', () => element.classList.add('is-glaring'));
            element.addEventListener('animationend', () => element.classList.remove('is-glaring'));
        });

        // Запуск блика по обводке шапки при наведении на хедер
        if (headerWrapper) {
            headerWrapper.addEventListener('mouseenter', () => {
                if (strokeAnim1 && strokeAnim2) {
                    strokeAnim1.beginElement();
                    strokeAnim2.beginElement();
                }
            });
        }

        // Глобальный сквозной прожектор обводок за указателем мыши
        // (SVG-атрибуты cx/cy не понимают CSS var(), поэтому двигаем градиент шапки вручную,
        //  переводя пиксели в координаты viewBox 1010x410)
        const bookmarkSvg = document.querySelector('.header-bookmark svg');
        const headerStrokeGrad = document.getElementById('header-global-stroke');
        window.addEventListener('mousemove', (e) => {
            if (bookmarkSvg && headerStrokeGrad) {
                const sRect = bookmarkSvg.getBoundingClientRect();
                headerStrokeGrad.setAttribute('cx', (e.clientX - sRect.left) * 1010 / sRect.width);
                headerStrokeGrad.setAttribute('cy', (e.clientY - sRect.top) * 410 / sRect.height);
            }
            if (headerWrapper) {
                const hRect = headerWrapper.getBoundingClientRect();
                headerWrapper.style.setProperty('--mouse-x', `${e.clientX - hRect.left}px`);
                headerWrapper.style.setProperty('--mouse-y', `${e.clientY - hRect.top}px`);
            }
            if (mainBlock) {
                const mRect = mainBlock.getBoundingClientRect();
                mainBlock.style.setProperty('--mouse-x', `${e.clientX - mRect.left}px`);
                mainBlock.style.setProperty('--mouse-y', `${e.clientY - mRect.top}px`);
            }
        });
    }

    // Восстанавливаем генерацию строгой диагональной сетки точек (работает только на ПК)
    const starsContainer = document.querySelector('.header-stars-container');
    const svgPath = document.querySelector('.star-tracker-path polygon');
    
    if (!isMobile && starsContainer && svgPath) {
        const step = 20; 
        const rect = starsContainer.getBoundingClientRect();
        const cols = Math.ceil(rect.width / step);
        const rows = Math.ceil(rect.height / step);
        const svgOwner = document.querySelector('.star-tracker-path');
        const testPoint = svgOwner.createSVGPoint();

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const posX = c * step + (r % 2 === 0 ? 0 : step / 2);
                const posY = r * step;
                testPoint.x = (posX / rect.width) * 1010;
                testPoint.y = (posY / rect.height) * 410;

                if (svgPath.isPointInFill(testPoint)) {
                    const dot = document.createElement('div');
                    dot.classList.add('mini-dot');
                    dot.style.left = `${posX}px`;
                    dot.style.top = `${posY}px`;
                    starsContainer.appendChild(dot);
                }
            }
        }

        const allDots = starsContainer.querySelectorAll('.mini-dot');
        window.addEventListener('mousemove', (e) => {
            const containerRect = starsContainer.getBoundingClientRect();
            const mX = e.clientX - containerRect.left;
            const mY = e.clientY - containerRect.top;

            allDots.forEach(dot => {
                if (Math.hypot(mX - parseFloat(dot.style.left), mY - parseFloat(dot.style.top)) < 55) {
                    dot.classList.add('is-ignited');
                    setTimeout(() => dot.classList.remove('is-ignited'), 50);
                }
            });
        });
    }
  });

// ===== Фоновые вертикальные полосы =====
(() => {
        const container = document.querySelector('.bg-stripes-container');
        const stripeWidth = 50;
        // Досоздаёт полосы, если окно стало шире (при сужении лишние просто уходят за край)
        function fillStripes() {
            const needed = Math.ceil(window.innerWidth / stripeWidth) + 1;
            for (let i = container.children.length; i < needed; i++) {
                const stripe = document.createElement('div');
                stripe.classList.add('single-stripe');
                if (i % 2 !== 0) {
                    stripe.classList.add('dark-static');
                }
                container.appendChild(stripe);
            }
        }
        fillStripes();
        window.addEventListener('resize', fillStripes);

        // живая коллекция — автоматически видит новые полосы
        const allStripes = container.children;

        window.addEventListener('mousemove', (e) => {
            const stripeIndex = Math.floor(e.clientX / stripeWidth);
            if (allStripes[stripeIndex]) {
                const activeStripe = allStripes[stripeIndex];
                if (!activeStripe.classList.contains('dark-static')) {
                    activeStripe.classList.add('is-lit');
                    setTimeout(() => {
                        activeStripe.classList.remove('is-lit');
                    }, 50);
                }
            }
        });
    
})();
