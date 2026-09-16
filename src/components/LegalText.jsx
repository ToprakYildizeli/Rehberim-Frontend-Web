import { useMemo } from 'react';
import { parseMarkdown } from '../lib/markdown';
import s from './legalText.module.css';

/**
 * Hukuki metni biçimli basar (16 Eyl 2026).
 *
 * Gövde API'den Markdown olarak geliyor; önceden `<pre>` içinde ham
 * basılıyordu ve kullanıcı `**kalın**`, `##`, tablo borularını görüyordu.
 * Çözümleme `lib/markdown.js` içinde ve **veri** döndürüyor; burada React
 * elementi kuruluyor — `dangerouslySetInnerHTML` yok, dolayısıyla metinden
 * HTML enjekte edilmesi mümkün değil.
 *
 * Bağlantılar yeni sekmede ve `rel="noreferrer"`: metin kendi sitemizden
 * geliyor ama hedef dış bir adres olabilir.
 */

function Spans({ spans }) {
  return spans.map((span, i) => {
    const key = `${i}-${span.text.slice(0, 8)}`;
    if (span.href) {
      return (
        <a key={key} href={span.href} target="_blank" rel="noreferrer">
          {span.text}
        </a>
      );
    }
    if (span.bold) return <strong key={key}>{span.text}</strong>;
    if (span.code) return <code key={key} className={s.code}>{span.text}</code>;
    return <span key={key}>{span.text}</span>;
  });
}

function Block({ block }) {
  switch (block.type) {
    case 'heading': {
      // Metnin kendi h1'i pencere başlığıyla çakışır; bir kademe küçültülüyor.
      const Tag = `h${Math.min(block.level + 1, 6)}`;
      return <Tag className={s[`h${Math.min(block.level, 3)}`]}><Spans spans={block.spans} /></Tag>;
    }
    case 'paragraph':
      return <p className={s.p}><Spans spans={block.spans} /></p>;
    case 'list':
      return (
        <ul className={s.ul}>
          {block.items.map((item, i) => (
            <li key={`li-${i}`}><Spans spans={item} /></li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote className={s.quote}>
          {block.blocks.map((inner, i) => <Block key={`q-${i}`} block={inner} />)}
        </blockquote>
      );
    case 'table':
      return (
        // Tablolar dar pencerede taşıyor; kendi içinde yatay kayıyor.
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={`th-${i}`}><Spans spans={cell} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={`tr-${r}`}>
                  {row.map((cell, c) => (
                    <td key={`td-${c}`}><Spans spans={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'rule':
      return <hr className={s.rule} />;
    default:
      return null;
  }
}

export default function LegalText({ body, className }) {
  const blocks = useMemo(() => parseMarkdown(body), [body]);
  return (
    <div className={className ? `${s.root} ${className}` : s.root}>
      {blocks.map((block, i) => <Block key={`b-${i}`} block={block} />)}
    </div>
  );
}
