// Публичный сайт, страница «Студенческая активность» — пока заглушка.
(() => {
    RCU.pages['student-activity'] = {
        title: 'Студенческая активность',
        load: async () => null,
        render(root) {
            root.innerHTML = `
                <div class="pub-soon">
                    <h2 class="dl-section-title pub-soon-title"><span>студенческая активность</span></h2>
                    <p class="pc-soon">Раздел скоро появится.</p>
                </div>`;
        },
    };
})();
