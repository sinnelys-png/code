/**
 * Данные для сайта одним ответом: дедлайны, расписание будущих постов и активность.
 *
 * Это ОТДЕЛЬНЫЙ проект Apps Script (не привязанный к таблице): его видите и меняете
 * только вы. Читатели и редакторы таблиц до него не доберутся, а таблицы он открывает по ID.
 *
 * КАК ПОДКЛЮЧИТЬ (один раз):
 *  1. Откройте https://script.google.com → «Создать проект». Назовите, например, «RCU — сайт».
 *  2. Сотрите всё в файле Code.gs, вставьте этот код целиком и сохраните (Ctrl+S).
 *  3. Вверху выберите функцию setupWarmup → «Выполнить». Google спросит разрешения
 *     (чтение таблиц и запуск по расписанию) — разрешите. Появится триггер warmCache.
 *  4. «Начать развертывание» → «Новое развертывание» → тип «Веб-приложение»,
 *     запуск «От моего имени», доступ «Все» → «Развернуть».
 *  5. Скопируйте «URL веб-приложения» (заканчивается на /exec) — его нужно вписать
 *     в js/core.js в строку SCRIPT_URL.
 *
 * Если потом поменяете код — «Управление развертываниями» → карандаш →
 * «Новая версия» → «Развернуть». Ссылка при этом не меняется.
 *
 * ПРОГРЕВ: триггер warmCache каждые 5 минут заранее перечитывает таблицы и кладёт
 * готовый ответ в кэш, поэтому сайт получает его мгновенно. Отключить — функция removeWarmup.
 */

// Таблица с дедлайнами и расписанием (длинный код из её адреса между /d/ и /edit)
const DEADLINES_SHEET_ID = '1KTZmUktm284bdyGc_LfDpv9BVUDCqcEU8Av29s-NXVU';
// Техтаблица (закрытая): B — имя персонажа, J — факультет
const FACULTY_SHEET_ID = '1SaM0adTpbqMs-fiN8Yub2FaeJfWTo4odAt2ScREUSg0';
const FACULTY_GID = 0;
// Лист [бронь] в Техтаблице
const BRON_GID = 2050639534;
// Лист игровой (должники) в Техтаблице
const DEBTS_GID = 1875298653;
// Таблица факультетов (структура: предметы, преподаватели, декан, нпс, студенты по курсам, факультативы)
const FACULTY_INFO_SHEET_ID = '1Rs16v2rZ_PwRoVF-gNBU0fW4sdw_r5eZ2JjcbEyJ17s';
const FACULTY_INFO_GID = 1846439865;

// Ответ живёт в кэше 10 минут, а прогрев обновляет его каждые 5 —
// так кэш никогда не успевает остыть, а данные не старше 5 минут.
// (Без прогрева данные просто обновляются при первом заходе после истечения кэша.)
const CACHE_SECONDS = 600;
const WARMUP_MINUTES = 5;
// Ночью прогрев не нужен: в эти часы (по времени таблицы) триггер сразу завершается,
// почти не расходуя дневной лимит триггеров (90 минут в сутки на аккаунт).
// Первый утренний посетитель один раз подождёт, пока скрипт прочитает таблицы.
const WARMUP_NIGHT_FROM = 2;   // с 02:00
const WARMUP_NIGHT_TO = 9;     // до 09:00
const CACHE_KEY = 'site-v8';

// Лист «Дедлайн» в этой же таблице (число после gid= в адресе)
const SHEET_GID = 236702218;
// Лист «Расписание будущих постов» в этой же таблице
const SCHEDULE_GID = 1309259642;
// Таблица активности (отдельный файл) и её лист
const ACTIVITY_SHEET_ID = '1P3xjGhIAfUgq1savZwkf7bkBy0uhG8nV2i0iaiEDlNw';
const ACTIVITY_GID = 712278003;

// Номера колонок листа «Дедлайн» (A = 1)
const COL = {
  avatar: 1,    // A  — =IMAGE("...")
  name: 2,      // B  — =HYPERLINK(...)
  duet: 3,      // C
  role: 4,      // D
  player: 5,    // E  — =HYPERLINK(...)
  labels: 8,    // H  — метки: админ, новичок, отпуск, отсрочка…
  deadline: 10, // J
  noSub: 12,    // L  — ответы без подроли
  activeSub: 13,// M  — актуальная подроль
  status: 16,   // P  — «в отложке/предложке»
  queue: 17,    // Q  — подроли в порядке очереди
  topicId: 28,  // AB — id обсуждения
  playerId: 29, // AC — id отвечающего
};

// Колонки счётчиков в таблице активности: E лайки, I комментарии, N вопросы, S доп. баллы
const ACTIVITY_STATS = [5, 9, 14, 19];

function doGet(e) {
  // ?part=anketas — тексты анкет (колонка X Техтаблицы), только для публичного сайта:
  // они большие, поэтому отдаются отдельно и не грузятся в мини-приложение ВК
  if (e && e.parameter && e.parameter.part === 'anketas') {
    const cachedA = cacheGet_(ANKETAS_KEY);
    if (cachedA) return json_(cachedA);
    return json_(buildAnketas_());
  }
  // ?part=relations — граф отношений (таблица взаимоотношений), тоже только для публичного сайта
  if (e && e.parameter && e.parameter.part === 'relations') {
    const cachedR = cacheGet_(RELATIONS_KEY);
    if (cachedR) return json_(cachedR);
    return json_(buildRelations_());
  }
  const cached = cacheGet_(CACHE_KEY);
  if (cached) return json_(cached);
  return json_(build_());
}

/* ---------- Граф отношений ----------
   Лист «Взаимоотношения»: в строке 3 — имена (по колонкам), в строке 1 — факультеты
   (название стоит над первым персонажем факультета), в строке 5 — курсы, в строке 6 — должности.
   Строки персонажей повторяют порядок колонок со сдвигом: строка = колонка + RELATIONS_SHIFT.
   Ячейка «строка А × колонка Б» — отношение А к Б: тип — цвет фона (легенда в B1:B10),
   текст — комментарий; «*» в начале — отношения ещё не обсуждались. */
const RELATIONS_SHEET_ID = '1iBnU0plvZVQOH9TEp85uMrnbaDMdsC5JJ5THJqlCy7k';
const RELATIONS_GID = 0;
const RELATIONS_KEY = 'relations-v1';
const RELATIONS_SHIFT = 11;

function buildRelations_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(RELATIONS_SHEET_ID), RELATIONS_GID);
  const range = sheet.getDataRange();
  const vals = range.getDisplayValues();
  const bgs = range.getBackgrounds();
  const cell = (r, c) => String((vals[r] || [])[c] || '').trim();

  // легенда: B1:B10 — название и цвет фона
  const legend = [];
  for (let r = 0; r < 10; r++) {
    if (cell(r, 1)) legend.push({ name: cell(r, 1), color: String(bgs[r][1]).toLowerCase() });
  }
  const rgb = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const legendRgb = legend.map(l => rgb(l.color));
  // ближайший цвет легенды (в таблице бывают почти такие же оттенки); белый и цвета факультетов — мимо
  const typeOf = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return -1;
    const [r, g, b] = rgb(hex);
    let best = -1, dist = 28;
    legendRgb.forEach(([lr, lg, lb], i) => {
      const d = Math.sqrt((r - lr) ** 2 + (g - lg) ** 2 + (b - lb) ** 2);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  };

  // люди — по колонкам строки 3
  const people = [];
  const colOf = {};
  let group = '';
  for (let c = 2; c < (vals[2] || []).length; c++) {
    if (cell(0, c)) group = cell(0, c);
    const name = cell(2, c);
    if (!name) continue;
    colOf[c] = people.length;
    people.push({ name: name, group: group, course: cell(4, c).replace(/\D+/g, ''), post: cell(5, c) });
  }

  // связи
  const links = [];
  Object.keys(colOf).forEach(cs => {
    const c = Number(cs);
    const r = c + RELATIONS_SHIFT - 1;          // индекс строки (с нуля)
    if (!vals[r]) return;
    Object.keys(colOf).forEach(ds => {
      const d = Number(ds);
      if (d === c) return;
      const type = typeOf(String(bgs[r][d]).toLowerCase());
      if (type < 0) return;
      const text = cell(r, d);
      const pending = text.startsWith('*') ? 1 : 0;
      const note = text.replace(/^\*\s*/, '');
      const link = [colOf[c], colOf[d], type, pending];
      if (note) link.push(note);
      links.push(link);
    });
  });

  const out = JSON.stringify({ updated: new Date().toISOString(), legend: legend, people: people, links: links });
  cachePut_(RELATIONS_KEY, out);
  return out;
}

const ANKETAS_KEY = 'anketas-v1';
const ANKETA_COL = 24;   // X — анкета персонажа

function buildAnketas_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(FACULTY_SHEET_ID), FACULTY_GID);
  const last = sheet.getLastRow();
  const names = sheet.getRange(1, 2, last, 1).getDisplayValues();
  const texts = sheet.getRange(1, ANKETA_COL, last, 1).getDisplayValues();
  const anketas = {};
  for (let i = 0; i < last; i++) {
    const name = String(names[i][0] || '').trim();
    const text = String(texts[i][0] || '').trim();
    if (name && text && name !== 'Имя персонажа') anketas[name] = text;
  }
  const out = JSON.stringify({ updated: new Date().toISOString(), anketas: anketas });
  cachePut_(ANKETAS_KEY, out);
  return out;
}

/** Запускается триггером каждые WARMUP_MINUTES минут: перечитывает таблицы заранее */
function warmCache() {
  const tz = book_().getSpreadsheetTimeZone();
  const hour = Number(Utilities.formatDate(new Date(), tz, 'H'));
  if (hour >= WARMUP_NIGHT_FROM && hour < WARMUP_NIGHT_TO) return;
  build_();
  try { buildAnketas_(); } catch (e) { /* анкет может не быть */ }
  try { buildRelations_(); } catch (e) { /* таблица отношений недоступна */ }
}

/** Один раз вручную: завести триггер прогрева (старые триггеры warmCache удаляются) */
function setupWarmup() {
  removeWarmup();
  ScriptApp.newTrigger('warmCache').timeBased().everyMinutes(WARMUP_MINUTES).create();
  warmCache();
}

/** Отключить прогрев */
function removeWarmup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'warmCache')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Для таблиц: «данные поменялись — пересобери ответ сайта сейчас», не дожидаясь прогрева.
 *
 * Вызывается из скрипта таблицы через библиотеку (никаких ссылок и ключей в коде таблицы):
 *  1. Здесь: «Развертывание» → «Новое развертывание» → тип «Библиотека» → «Развернуть»;
 *     в «Настройках проекта» скопируйте «Идентификатор скрипта».
 *  2. В скрипте таблицы: «Библиотеки» → «+» → вставьте идентификатор → «Найти»,
 *     версия — последняя, идентификатор — Site → «Добавить».
 *  3. В конце функции таблицы: try { Site.refresh(); } catch (e) { console.warn(e); }
 *
 * Кэш у библиотеки и веб-приложения общий (это один проект), поэтому сайт сразу получает
 * новый ответ. Таблицы читаются от имени того, чей триггер запустил функцию.
 * Если пересборка уже идёт (подряд пришло несколько ответов), ждём её и собираем ещё раз,
 * чтобы последние изменения точно попали в кэш.
 */
function refresh() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) return false;
  try {
    build_();
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Собирает ответ для сайта и кладёт его в кэш */
function build_() {
  const ss = book_();
  const out = { updated: new Date().toISOString() };

  // Каждая часть собирается отдельно: если одна сломается, остальные всё равно придут
  // (сайт для сломанной части сам возьмёт публичную выгрузку)
  out.rows = deadlines_(ss);
  try { out.schedule = schedule_(ss); } catch (e) { out.scheduleError = String(e); }
  try { out.activity = activity_(); } catch (e) { out.activityError = String(e); }
  try { out.faculties = faculties_(); } catch (e) { out.facultiesError = String(e); }
  try { out.tech = tech_(); } catch (e) { out.techError = String(e); }
  try { out.facultyInfo = facultyInfo_(); } catch (e) { out.facultyInfoError = String(e); }
  try { out.bron = bron_(); } catch (e) { out.bronError = String(e); }
  try { out.debts = debts_(); } catch (e) { out.debtsError = String(e); }

  const text = JSON.stringify(out);
  cachePut_(CACHE_KEY, text);
  return text;
}

/** Таблица с дедлайнами (открывается по ID — скрипт к ней не привязан) */
function book_() {
  return SpreadsheetApp.openById(DEADLINES_SHEET_ID);
}

function sheetByGid_(ss, gid) {
  const sheet = ss.getSheets().find(s => s.getSheetId() === gid);
  if (!sheet) throw new Error('Лист ' + gid + ' не найден');
  return sheet;
}

/** Лист «Дедлайн» */
function deadlines_(ss) {
  const sheet = sheetByGid_(ss, SHEET_GID);
  const range = sheet.getRange(1, 1, sheet.getLastRow(), COL.playerId);
  const values = range.getValues();
  const display = range.getDisplayValues();
  const formulas = range.getFormulas();
  const tz = ss.getSpreadsheetTimeZone();

  // Данные начинаются под строкой, где в колонке A написано «Персонаж»
  const headerIndex = display.findIndex(r => r[COL.avatar - 1].trim() === 'Персонаж');

  const rows = [];
  for (let i = headerIndex + 1; i < display.length; i++) {
    const d = display[i];
    const f = formulas[i];
    const name = d[COL.name - 1].trim();
    const role = d[COL.role - 1].trim();
    if (!name || !role) continue;

    const deadlineValue = values[i][COL.deadline - 1];

    rows.push({
      avatar: firstQuoted_(f[COL.avatar - 1]),
      name: name,
      topicUrl: linkOf_(f[COL.name - 1], values[i]),
      duet: d[COL.duet - 1].trim(),
      role: role,
      player: d[COL.player - 1].trim(),
      playerUrl: linkOf_(f[COL.player - 1], values[i]),
      playerId: String(d[COL.playerId - 1]).replace(/\D/g, ''),
      deadline: d[COL.deadline - 1].trim(),
      deadlineISO: deadlineValue instanceof Date
        ? Utilities.formatDate(deadlineValue, tz, 'yyyy-MM-dd') : '',
      noSub: d[COL.noSub - 1].trim(),
      activeSub: d[COL.activeSub - 1].trim(),
      status: d[COL.status - 1].trim(),
      labels: d[COL.labels - 1].trim(),
      queue: d[COL.queue - 1].split('\n').map(s => s.trim()).filter(Boolean),
    });
  }
  return rows;
}

/** Лист «Расписание будущих постов»: B — дата и время, C — теги */
function schedule_(ss) {
  const sheet = sheetByGid_(ss, SCHEDULE_GID);
  const range = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 3);
  const values = range.getValues();
  const display = range.getDisplayValues();
  const tz = ss.getSpreadsheetTimeZone();

  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const date = values[i][1];
    const tags = display[i][2].trim();
    if (!(date instanceof Date) || !tags) continue;
    rows.push({
      b: display[i][1].trim(),                              // «вс, 8 ноября в 14:00»
      iso: Utilities.formatDate(date, tz, 'yyyy-MM-dd'),
      c: tags,
    });
  }
  return rows;
}

/** Таблица активности: A место, B VK ID, C имя, D сумма, E/I/N/S счётчики */
function activity_() {
  const book = SpreadsheetApp.openById(ACTIVITY_SHEET_ID);
  const sheet = sheetByGid_(book, ACTIVITY_GID);
  const range = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 19);
  const values = range.getValues();
  const display = range.getDisplayValues();

  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const d = display[i];
    const name = d[2].trim();
    if (typeof v[0] !== 'number' || !name) continue;
    rows.push({
      place: v[0],
      id: typeof v[1] === 'number' ? String(Math.round(v[1])) : String(v[1]).replace(/\D/g, ''),
      name: name,
      sum: d[3].trim() || '0',
      sumNum: Number(v[3]) || 0,
      stats: ACTIVITY_STATS.map(c => d[c - 1].trim() || '0'),
      statNums: ACTIVITY_STATS.map(c => Number(v[c - 1]) || 0),
    });
  }
  return rows;
}

/** Техтаблица: { "Имя персонажа": "Факультет …" } */
function faculties_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(FACULTY_SHEET_ID), FACULTY_GID);
  const display = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 10).getDisplayValues();
  const out = {};
  display.forEach(r => {
    const name = r[1].trim();
    const faculty = r[9].trim();
    if (name && faculty && faculty !== 'Факультет' && name !== 'Имя персонажа') out[name] = faculty;
  });
  return out;
}

/**
 * Техтаблица целиком — для публичного сайта (персонажи, факультеты, общежитие).
 * Колонки ищутся по заголовкам (строка, где в B написано «Имя персонажа»),
 * поэтому порядок колонок в таблице можно менять. Безымянные колонки I и L
 * отдаются как есть (i, l).
 */
function tech_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(FACULTY_SHEET_ID), FACULTY_GID);
  const display = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 16)).getDisplayValues();
  let head = -1;
  for (let i = display.length - 1; i >= 0; i--) {
    if (display[i][1].trim() === 'Имя персонажа') { head = i; break; }
  }
  if (head < 0) throw new Error('Не найдена строка заголовков');
  const titles = display[head].map(t => t.trim().toLowerCase());
  const col = (name) => titles.indexOf(name);
  const C = {
    role: col('роль'), duet: col('дуэт'), player: col('отвечающий'), topic: col('обсуждение'),
    album: col('альбом'), faculty: col('факультет'), subrole: col('подроль'),
    extra: col('доп предметы'), house: col('дом в общежитии'), room: col('комната'), neighbor: col('можно соседа?'),
  };
  const url = (v) => { v = String(v || '').trim(); return v && !/^https?:\/\//i.test(v) && /^[\w.-]+\.\w+\//.test(v) ? 'https://' + v : v; };
  const get = (r, i) => (i >= 0 ? String(r[i] || '').trim() : '');

  const rows = [];
  for (let i = head + 1; i < display.length; i++) {
    const r = display[i];
    const name = r[1].trim();
    if (!name || name === 'Имя персонажа') continue;
    rows.push({
      name: name,
      role: get(r, C.role),
      duet: get(r, C.duet),
      playerUrl: url(get(r, C.player)),
      topicUrl: url(get(r, C.topic)),
      albumUrl: url(get(r, C.album)),
      faculty: get(r, C.faculty),
      subrole: get(r, C.subrole),
      extra: get(r, C.extra),
      house: get(r, C.house),
      room: get(r, C.room),
      neighbor: get(r, C.neighbor),
      i: get(r, 8),     // I — без заголовка
      l: get(r, 11),    // L — без заголовка
    });
  }
  return rows;
}

/**
 * Лист [бронь] Техтаблицы. Он «повёрнут»: в колонке B подписи строк (роль, факультет,
 * курс, предмет, должность, окончание брони…), каждая следующая колонка — один персонаж.
 * Бронь начинается с колонки, где в первой строке «[бронь]»; дуэт — две колонки подряд.
 * Брони с прошедшей датой окончания пропускаются. Тот же разбор — parseBron в js/pages/public-data.js.
 */
function bron_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(FACULTY_SHEET_ID), BRON_GID);
  const grid = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1)).getDisplayValues();
  const cell = (r, c) => String((grid[r] || [])[c] || '').trim();
  const width = grid[0].length;
  let lc = -1;
  for (let c = 0; c < width && lc < 0; c++) {
    const col = grid.map((_, r) => cell(r, c).toLowerCase());
    if (col.indexOf('роль') >= 0 && col.indexOf('факультет') >= 0) lc = c;
  }
  if (lc < 0) return [];
  const rowOf = (re) => grid.findIndex((_, r) => re.test(cell(r, lc).toLowerCase()));
  const R = {
    name: rowOf(/^имя$/), role: rowOf(/^роль/), faculty: rowOf(/^факультет/), course: rowOf(/^курс/),
    subject: rowOf(/^предмет/), post: rowOf(/^должност/), until: rowOf(/^окончание/),
  };
  const get = (key, c) => (R[key] >= 0 ? cell(R[key], c) : '');
  const toDate = (t) => {
    const m = String(t).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    return m ? new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
  };
  const now = new Date();
  const out = [];
  let until = null, inGroup = false;
  for (let c = lc + 1; c < width; c++) {
    if (/\[бронь\]/i.test(cell(0, c))) { inGroup = true; until = toDate(get('until', c)); }
    const role = get('role', c), faculty = get('faculty', c);
    if (!role && !faculty) { inGroup = false; continue; }
    if (!inGroup || (until && until < now)) continue;
    out.push({
      name: get('name', c), role: role, faculty: faculty,
      course: get('course', c), subject: get('subject', c), post: get('post', c),
      until: until ? until.toISOString() : '',
    });
  }
  return out;
}

/**
 * Должники игровой (лист игровой в Техтаблице) → { имя: ["блог 14.07.26", …] }.
 *  • колонка M («старые должники») — блоки: заголовок события с датой («блог 14.07.26»),
 *    под ним строки должников; имя должника — в колонке O той же строки
 *    (колонку P не смотрим), долг — ближайший заголовок в M выше;
 *  • ячейка J6 — текущие должники («@id… (Имя)»), их долг — название игры из A1.
 * Тот же разбор — parseDebts в js/pages/deadlines.js.
 */
function debts_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(FACULTY_SHEET_ID), DEBTS_GID);
  const v = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 6), Math.max(sheet.getLastColumn(), 15)).getDisplayValues();
  const cell = (r, c) => String((v[r] || [])[c] || '').replace(/\s+/g, ' ').trim();
  const out = {};
  const add = (name, what) => {
    name = String(name || '').trim();
    if (!name) return;
    out[name] = out[name] || [];
    if (what && out[name].indexOf(what) < 0) out[name].push(what);
  };
  let event = '';
  for (let r = 2; r < v.length; r++) {
    const m = cell(r, 12), o = cell(r, 14);
    if (m && !/^@id/i.test(m)) event = m;
    if (o) add(o, event);
  }
  const title = cell(0, 0);
  // J6 — ячейка под подписью «текущие должники:»
  let lab = -1;
  for (let r = 0; r < v.length && lab < 0; r++) if (/текущие должники/i.test(String(v[r][9] || ''))) lab = r;
  const j6 = String((v[lab >= 0 ? lab + 1 : 5] || [])[9] || '');
  const named = [];
  const re = /\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(j6))) named.push(m[1].trim());
  (named.length ? named : j6.split(/[\n,]/)).forEach(n => add(n, title));
  return out;
}

/**
 * Таблица факультетов. Каждый факультет — блок строк от названия до «✦✦✦»:
 *   C: название / «Возможные предметы…» / «Преподаватели» / «N/4 ролей занято» /
 *      предмет преподавателя (E — имя) / «Декан» (E) / «нпс» (E) /
 *      «Доп. предметы…» → предмет (E «куратор», F имя; E «студенты», F имена)
 *   J: «N курс», K: имена студентов этого курса (на следующих строках J может быть пустым)
 */
function facultyInfo_() {
  const sheet = sheetByGid_(SpreadsheetApp.openById(FACULTY_INFO_SHEET_ID), FACULTY_INFO_GID);
  const d = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 11).getDisplayValues();
  const C = 2, E = 4, F = 5, J = 9, K = 10;
  const clean = (v) => String(v || '').trim();
  const real = (v) => { v = clean(v); return v && !/^[—–-]+$/.test(v) ? v : ''; };

  const list = [];
  let f = null, mode = '', course = '', elective = null;
  for (let i = 0; i < d.length; i++) {
    const r = d[i];
    const c = clean(r[C]);
    if (/факультет|^персонал$/i.test(c) && !/^возможные|^доп\. предметы|деканом/i.test(c) && !f) {
      f = { title: c, subjects: '', roles: '', teachers: [], dean: '', npc: '', courses: [], electives: [] };
      mode = 'head'; course = ''; elective = null;
      continue;
    }
    if (!f) continue;
    if (c === '✦✦✦') { list.push(f); f = null; continue; }

    if (/^возможные предметы/i.test(c)) { f.subjects = c.replace(/^возможные предметы[^:]*:\s*/i, ''); continue; }
    if (/^преподаватели$/i.test(c)) { mode = 'teachers'; continue; }
    if (/ролей занято/i.test(c)) { f.roles = c; continue; }
    if (/^декан$/i.test(c)) { f.dean = real(r[E]); mode = 'dean'; }
    else if (/^нпс$/i.test(c)) { f.npc = real(r[E]); mode = 'npc'; }
    else if (/^доп\. предметы/i.test(c)) { mode = 'electives'; }
    else if (/^все имена/i.test(c)) { mode = 'end'; }
    else if (mode === 'teachers' && c) { if (real(r[E]) || real(c)) f.teachers.push({ subject: real(c), name: real(r[E]) }); }
    else if (mode === 'electives') {
      if (c) { elective = { subject: real(c), curator: '', students: [] }; f.electives.push(elective); }
      if (elective) {
        const what = clean(r[E]).toLowerCase();
        if (what === 'куратор') elective.curator = real(r[F]);
        else if (real(r[F])) elective.students.push(real(r[F]));
      }
    }

    // студенты по курсам — правая часть блока
    const m = clean(r[J]).match(/(\d+)\s*курс/i);
    if (m) course = Number(m[1]);
    const student = real(r[K]);
    if (student && course) {
      let g = f.courses.find(x => x.course === course);
      if (!g) f.courses.push(g = { course: course, students: [] });
      g.students.push(student);
    }
  }
  return list;
}

/* Кэш скрипта хранит не больше 100 КБ на ключ — длинный ответ кладём по кусочкам */
function cachePut_(key, text) {
  const cache = CacheService.getScriptCache();
  const size = 90000;
  const parts = {};
  let n = 0;
  for (let i = 0; i < text.length; i += size) parts[key + ':' + (n++)] = text.slice(i, i + size);
  parts[key] = String(n);
  try { cache.putAll(parts, CACHE_SECONDS); } catch (e) { /* не влезло — просто без кэша */ }
}

function cacheGet_(key) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key));
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  const parts = cache.getAll(keys);
  if (keys.some(k => parts[k] == null)) return null;
  return keys.map(k => parts[k]).join('');
}

/** Первая строка в кавычках из формулы: =IMAGE("url") → url */
function firstQuoted_(formula) {
  const m = String(formula).match(/"([^"]+)"/);
  return m ? m[1] : '';
}

/**
 * Ссылка из =HYPERLINK(...). Понимает оба вида:
 *   HYPERLINK("https://site/путь", "Текст")
 *   HYPERLINK("https://site/путь_"&AB8, "Текст")   ← подставляет значение ячейки
 */
function linkOf_(formula, rowValues) {
  const m = String(formula).match(/HYPERLINK\(\s*"([^"]*)"\s*(?:&\s*\$?([A-Z]+)\$?\d+)?/i);
  if (!m) return '';
  let url = m[1];
  if (m[2]) url += String(rowValues[colIndex_(m[2])] ?? '');
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

/** "AB" → 27 (индекс с нуля) */
function colIndex_(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function json_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
