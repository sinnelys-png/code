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
const CACHE_KEY = 'site-v3';

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

function doGet() {
  const cached = cacheGet_(CACHE_KEY);
  if (cached) return json_(cached);
  return json_(build_());
}

/** Запускается триггером каждые WARMUP_MINUTES минут: перечитывает таблицы заранее */
function warmCache() {
  const tz = book_().getSpreadsheetTimeZone();
  const hour = Number(Utilities.formatDate(new Date(), tz, 'H'));
  if (hour >= WARMUP_NIGHT_FROM && hour < WARMUP_NIGHT_TO) return;
  build_();
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

/** Собирает ответ для сайта и кладёт его в кэш */
function build_() {
  const ss = book_();
  const out = { updated: new Date().toISOString() };

  // Каждая часть собирается отдельно: если одна сломается, остальные всё равно придут
  // (сайт для сломанной части сам возьмёт публичную выгрузку)
  out.rows = deadlines_(ss);
  try { out.schedule = schedule_(ss); } catch (e) { out.scheduleError = String(e); }
  try { out.activity = activity_(); } catch (e) { out.activityError = String(e); }

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
