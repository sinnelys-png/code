// Публичный сайт, страница «Город» — пока заглушка.
(() => {
    RCU.pages.city = {
        title: 'Город',
        load: async () => null,
        render(root) {
            root.innerHTML = `
                <div class="pub-soon">
                    <h2 class="dl-section-title pub-soon-title"><span>город</span></h2>
                    <p class="pc-soon">Раздел скоро появится.</p>
                </div>`;
        },
    };
})();
