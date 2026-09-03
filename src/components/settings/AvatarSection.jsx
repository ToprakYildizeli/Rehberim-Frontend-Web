import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar, Button } from '../ui';
import { removeAvatar, uploadAvatar } from '../../api/auth';
import s from './settings.module.css';

/**
 * Profil fotoğrafı — Profil sekmesindeki kimlik kartının sol tarafı.
 *
 * Sunucu kısıtları (JPG/PNG/WEBP/GIF, ≤2 MB) burada **tekrar edilmiyor**;
 * dosya doğrudan gönderilip hata mesajı sunucudan gösteriliyor. İki yerde
 * tutulan kural zamanla ayrışır ve asıl doğrulama zaten sunucuda.
 *
 * Yükleme sonrası dönen kullanıcı objesi `onChange` ile oturuma yazılır —
 * üst bardaki avatar da aynı anda güncellensin diye.
 */
export default function AvatarSection({ user, onChange }) {
  const [busy, setBusy] = useState(null);      // 'upload' | 'remove' | null
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.username || '';

  async function run(action, kind) {
    setBusy(kind);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      const data = err?.response?.data;
      const first = data && !data.detail ? Object.values(data).flat()[0] : data?.detail;
      setError(first ?? 'Fotoğraf güncellenemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  function pick(event) {
    const file = event.target.files?.[0];
    // Aynı dosya arka arkaya seçilebilsin diye input sıfırlanır.
    event.target.value = '';
    if (file) run(() => uploadAvatar(file), 'upload');
  }

  return (
    <div className={s.avatarBlock}>
      <Avatar name={name} src={user?.avatar} size="xl" className={s.avatarBig} />

      <div className={s.avatarActions}>
        <Button variant="soft" size="sm" onClick={() => fileRef.current?.click()}
                disabled={busy !== null}>
          <Camera size={14} /> {busy === 'upload' ? 'Yükleniyor…' : 'Fotoğraf seç'}
        </Button>
        {user?.avatar && (
          <Button variant="ghost" size="sm" onClick={() => run(removeAvatar, 'remove')}
                  disabled={busy !== null}>
            <Trash2 size={14} /> {busy === 'remove' ? 'Kaldırılıyor…' : 'Kaldır'}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className={s.fileInput}
          onChange={pick}
        />
      </div>

      <p className={s.avatarHint}>JPG, PNG, WEBP veya GIF · en fazla 2 MB</p>
      {error && <p className={s.error}>{error}</p>}
    </div>
  );
}
