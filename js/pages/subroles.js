// Публичный сайт, страницы «Подроли» и «Клубы и активности» — пока заглушки.
// Подроли персонажей потом станут и фильтром «подроль» в графе отношений (js/pages/relations.js).
(() => {
    const page = {
        title: 'Подроли',
        load: async () => null,
        render(root) {
            root.innerHTML = `
                <div class="pub-soon">
                    <h2 class="dl-section-title pub-soon-title"><span>подроли</span></h2>
                    <p class="pc-soon">Раздел скоро появится.</p>
                </div>`;
        },
    };
    RCU.pages.subroles = page;
    // «Клубы и активности» (меню → университет) — тоже пока заглушка
    RCU.pages.clubs = {
        title: 'Клубы и активности',
        load: async () => null,
        render(root) {
            root.innerHTML = `
                <div class="pub-soon">
                    <h2 class="dl-section-title pub-soon-title"><span>клубы и активности</span></h2>
                    <p class="pc-soon">Раздел скоро появится.</p>
                </div>`;
        },
    };
    RCU.pages['student-activity'] = page;     // старые ссылки #student-activity ведут сюда же
})();
