// Публичный сайт, страница «Подроли» — пока заглушка.
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
    RCU.pages['student-activity'] = page;     // старые ссылки #student-activity ведут сюда же
})();
