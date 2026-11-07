/**
 * Выдача листа «Дедлайн» в виде JSON для страницы deadlines.html.
 *
 * КАК ПОДКЛЮЧИТЬ (один раз):
 *  1. Откройте таблицу → Расширения → Apps Script.
 *  2. Сотрите всё в файле Code.gs и вставьте этот код целиком. Сохраните (Ctrl+S).
 *  3. Нажмите «Начать развертывание» → «Новое развертывание».
 *     Тип: «Веб-приложение».
 *     Запуск от имени: «От моего имени».
 *     У кого есть доступ: «Все».
 *  4. Разрешите доступ к таблице, когда Google спросит.
 *  5. Скопируйте «URL веб-приложения» (заканчивается на /exec)
 *     и вставьте его в js/deadlines.js в строку APPS_SCRIPT_URL.
 *
 * Если потом поменяете этот код — «Начать развертывание» → «Управление развертываниями» →
 * карандаш → Версия: «Новая версия» → «Развернуть». Ссылка при этом не меняется.
 */

const SHEET_GID = 236702218;   // лист «Дедлайн» (число после gid= в адресе таблицы)
const CACHE_SECONDS = 300;     // как часто обновлять данные (5 минут)

// Номера колонок (A = 1)
const COL = {
  avatar: 1,    // A  — =IMAGE("...")
  name: 2,      // B  — =HYPERLINK(...)
  duet: 3,      // C
  role: 4,      // D
  player: 5,    // E  — =HYPERLINK(...)
  deadline: 10, // J
  noSub: 12,    // L  — ответы без подроли
  activeSub: 13,// M  — актуальная подроль
  status: 16,   // P  — «в отложке/предложке»
  queue: 17,    // Q  — подроли в порядке очереди
  topicId: 28,  // AB — id обсуждения
  playerId: 29, // AC — id отвечающего
};

function doGet() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('deadlines');
  if (cached) return json_(cached);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().find(s => s.getSheetId() === SHEET_GID);
  if (!sheet) return json_(JSON.stringify({ error: 'Лист не найден' }));

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
      queue: d[COL.queue - 1].split('\n').map(s => s.trim()).filter(Boolean),
    });
  }

  const out = JSON.stringify({ updated: new Date().toISOString(), rows: rows });
  try { cache.put('deadlines', out, CACHE_SECONDS); } catch (e) { /* слишком большой ответ — просто без кэша */ }
  return json_(out);
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
