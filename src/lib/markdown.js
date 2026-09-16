/**
 * Hukuki metinler için küçük Markdown çözümleyici (16 Eyl 2026).
 *
 * Metinler API'den **Markdown** olarak geliyor (`format: "markdown"`) çünkü üç
 * istemci birden okuyor: Flutter tarafı da aynı gövdeyi kendi işleyicisiyle
 * basacak. Web'de gövde ham basıldığında kullanıcı `**kalın**`, `##` ve tablo
 * borularını görüyordu — bu modül o işaretleri çözüyor.
 *
 * **Neden hazır bir paket değil:** projede bağımlılık listesi bilerek dar
 * (`.env` okuyucusu ve iCalendar desteği de elle yazıldı). Buradaki ihtiyaç
 * bilinen ve kapalı bir alt küme: başlık, paragraf, kalın, madde listesi,
 * tablo, alıntı, ayırıcı. Genel amaçlı bir işleyici hem 30 KB hem de HTML
 * enjeksiyon yüzeyi getirirdi; bu çözümleyici **HTML üretmiyor**, veri
 * döndürüyor — basan bileşen React elementi kuruyor, `dangerouslySetInnerHTML`
 * hiç yok.
 *
 * Çıktı: blok dizisi. Her blok `{ type, ... }`:
 *   { type: 'heading', level, spans }
 *   { type: 'paragraph', spans }
 *   { type: 'list', items: spans[] }
 *   { type: 'quote', blocks }          // alıntı içinde paragraf/liste olabilir
 *   { type: 'table', head: spans[], rows: spans[][] }
 *   { type: 'rule' }
 *
 * `spans` satır içi parçalar: `{ text }`, `{ text, bold: true }`,
 * `{ text, code: true }`, `{ text, href }`.
 */

const HEADING = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM = /^[-*]\s+(.+)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const TABLE_ROW = /^\|(.+)\|\s*$/;
// Ayırıcı satır: |---|:--:|---| gibi. Tablo başlığını gövdeden ayırır.
const TABLE_SEP = /^\|[\s:|-]+\|\s*$/;

/** `| a | b |` → ['a', 'b'] */
function cells(line) {
  return line.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
}

/**
 * Satır içi biçimleme. Sıra önemli: bağlantı kalından önce aranıyor, yoksa
 * `[**a**](x)` bozuk çıkar.
 *
 * ⚠️ Köşeli parantez tek başına **bağlantı değildir**: metinlerde
 * `[Unvan / ad soyad]`, `[kvkk@rehberim.xyz]` gibi doldurulmayı bekleyen
 * alanlar var ve bunlar olduğu gibi görünmeli. Bu yüzden kalıp parantezi
 * ZORUNLU tutuyor: `[metin](adres)`.
 */
export function parseInline(text) {
  const spans = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    if (match[1] !== undefined) spans.push({ text: match[1], href: match[2] });
    else if (match[3] !== undefined) spans.push({ text: match[3], bold: true });
    else spans.push({ text: match[4], code: true });
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length > 0 ? spans : [{ text: '' }];
}

/** Markdown gövdesini blok dizisine çevirir. */
export function parseMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  // Paragraf ve liste maddeleri satır sonunda kırılmıyor: Markdown'da tek
  // satır sonu boşluk sayılır, metinler de 79 kolona sarılmış durumda.
  const joinParagraph = (parts) => parts.join(' ').replace(/\s+/g, ' ').trim();

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') { i += 1; continue; }

    if (RULE.test(trimmed)) { blocks.push({ type: 'rule' }); i += 1; continue; }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        spans: parseInline(heading[2].trim()),
      });
      i += 1;
      continue;
    }

    // Tablo: en az bir satır + ayırıcı. Ayırıcı yoksa sıradan paragraf sayılır.
    if (TABLE_ROW.test(trimmed) && i + 1 < lines.length
        && TABLE_SEP.test(lines[i + 1].trim())) {
      const head = cells(trimmed).map(parseInline);
      i += 2;
      const rows = [];
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
        rows.push(cells(lines[i].trim()).map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', head, rows });
      continue;
    }

    if (QUOTE.test(trimmed)) {
      const inner = [];
      while (i < lines.length && QUOTE.test(lines[i].trim())) {
        inner.push(QUOTE.exec(lines[i].trim())[1]);
        i += 1;
      }
      // Alıntının içi tekrar çözümleniyor: uyarı blokları kalın metin ve
      // madde listesi içeriyor.
      blocks.push({ type: 'quote', blocks: parseMarkdown(inner.join('\n')) });
      continue;
    }

    if (LIST_ITEM.test(trimmed)) {
      const items = [];
      while (i < lines.length && LIST_ITEM.test(lines[i].trim())) {
        const parts = [LIST_ITEM.exec(lines[i].trim())[1]];
        i += 1;
        // Girintili devam satırları aynı maddeye ait.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])
               && !LIST_ITEM.test(lines[i].trim())) {
          parts.push(lines[i].trim());
          i += 1;
        }
        items.push(parseInline(joinParagraph(parts)));
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const parts = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrim = cur.trim();
      if (curTrim === '' || HEADING.test(curTrim) || LIST_ITEM.test(curTrim)
          || QUOTE.test(curTrim) || RULE.test(curTrim) || TABLE_ROW.test(curTrim)) break;
      parts.push(curTrim);
      i += 1;
    }
    blocks.push({ type: 'paragraph', spans: parseInline(joinParagraph(parts)) });
  }

  return blocks;
}
