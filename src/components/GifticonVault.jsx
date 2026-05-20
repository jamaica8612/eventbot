import { useEffect, useMemo, useState } from 'react';
import {
  addGifticonFamilyMember,
  createGifticon,
  createGifticonFamily,
  deleteGifticonPermanently,
  loadGifticonFamily,
  loadGifticons,
  markGifticonUsed,
  removeGifticonFamilyMember,
  restoreGifticonActive,
  restoreGifticonFromTrash,
  trashGifticon,
} from '../storage/supabaseEventStorage.js';
import { formatDate } from '../utils/format.js';

const gifticonFilters = [
  { value: 'active', label: '사용가능' },
  { value: 'used', label: '사용완료' },
  { value: 'trash', label: '휴지통' },
];

const emptyForm = {
  title: '',
  expiresAt: '',
  memo: '',
  barcodeValue: '',
  imageDataUrl: '',
};

export function GifticonVault({ onClose, onNotice }) {
  const [family, setFamily] = useState(null);
  const [gifticons, setGifticons] = useState([]);
  const [filter, setFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [familyName, setFamilyName] = useState('우리 가족 기프티콘');
  const [memberEmail, setMemberEmail] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [barcodeNotice, setBarcodeNotice] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [undoGifticonId, setUndoGifticonId] = useState('');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    loadGifticonFamily()
      .then((loadedFamily) => {
        if (!isMounted) return;
        setFamily(loadedFamily);
      })
      .catch((error) => showNotice(onNotice, 'warning', error.message))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [onNotice]);

  useEffect(() => {
    if (!family) return;
    refreshGifticons(filter);
  }, [family, filter]);

  const counts = useMemo(
    () => ({
      active: filter === 'active' ? gifticons.length : null,
      used: filter === 'used' ? gifticons.length : null,
      trash: filter === 'trash' ? gifticons.length : null,
    }),
    [filter, gifticons.length],
  );

  async function refreshGifticons(nextFilter = filter) {
    setIsLoading(true);
    try {
      setGifticons(await loadGifticons(nextFilter));
    } catch (error) {
      showNotice(onNotice, 'warning', error.message || '기프티콘을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateFamily(event) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const created = await createGifticonFamily(familyName);
      setFamily(created);
      showNotice(onNotice, 'success', '기프티콘 공유함을 만들었습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    if (!memberEmail.trim()) return;
    setIsSaving(true);
    try {
      setFamily(await addGifticonFamilyMember(memberEmail));
      setMemberEmail('');
      showNotice(onNotice, 'success', '가족을 공유함에 추가했습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!window.confirm('이 가족을 공유함에서 제거할까요?')) return;
    setIsSaving(true);
    try {
      setFamily(await removeGifticonFamilyMember(memberId));
      showNotice(onNotice, 'success', '가족을 제거했습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBarcodeNotice('바코드를 확인하는 중입니다.');
    try {
      const [imageDataUrl, barcodeValue] = await Promise.all([
        readFileAsDataUrl(file),
        decodeBarcodeFromFile(file),
      ]);
      setForm((current) => ({
        ...current,
        imageDataUrl,
        barcodeValue: barcodeValue || current.barcodeValue,
      }));
      setBarcodeNotice(
        barcodeValue ? '바코드/QR 번호를 자동으로 읽었습니다.' : '자동 인식 실패. 번호는 직접 입력해도 됩니다.',
      );
    } catch (error) {
      setBarcodeNotice(error.message || '이미지를 읽지 못했습니다.');
    }
  }

  async function handleCreateGifticon(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      showNotice(onNotice, 'warning', '상품명을 입력해주세요.');
      return;
    }
    if (!form.imageDataUrl) {
      showNotice(onNotice, 'warning', '기프티콘 이미지를 등록해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await createGifticon(form);
      setForm(emptyForm);
      setBarcodeNotice('');
      await refreshGifticons('active');
      setFilter('active');
      showNotice(onNotice, 'success', '기프티콘을 공유함에 등록했습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkUsed(gifticonId) {
    setIsSaving(true);
    try {
      await markGifticonUsed(gifticonId);
      setUndoGifticonId(gifticonId);
      await refreshGifticons(filter);
      showNotice(onNotice, 'success', '사용완료로 옮겼습니다. 필요하면 되돌릴 수 있어요.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRestoreActive(gifticonId) {
    setIsSaving(true);
    try {
      await restoreGifticonActive(gifticonId);
      setUndoGifticonId('');
      await refreshGifticons(filter);
      showNotice(onNotice, 'success', '사용가능으로 되돌렸습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTrash(gifticonId) {
    if (!window.confirm('휴지통으로 보낼까요?')) return;
    setIsSaving(true);
    try {
      await trashGifticon(gifticonId);
      await refreshGifticons(filter);
      showNotice(onNotice, 'success', '휴지통으로 보냈습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRestoreTrash(gifticonId) {
    setIsSaving(true);
    try {
      await restoreGifticonFromTrash(gifticonId);
      await refreshGifticons(filter);
      showNotice(onNotice, 'success', '휴지통에서 복구했습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePermanentDelete(gifticonId) {
    if (!window.confirm('완전히 삭제할까요? 이미지는 복구할 수 없습니다.')) return;
    setIsSaving(true);
    try {
      await deleteGifticonPermanently(gifticonId);
      await refreshGifticons(filter);
      showNotice(onNotice, 'success', '완전히 삭제했습니다.');
    } catch (error) {
      showNotice(onNotice, 'warning', error.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !family) {
    return (
      <section className="gifticon-vault">
        <GifticonHeader onClose={onClose} />
        <p className="empty-message">기프티콘 공유함을 불러오는 중입니다.</p>
      </section>
    );
  }

  if (!family) {
    return (
      <section className="gifticon-vault">
        <GifticonHeader onClose={onClose} />
        <form className="gifticon-empty-card" onSubmit={handleCreateFamily}>
          <span>가족 공유함</span>
          <strong>함께 볼 기프티콘 보관함을 만들어보세요.</strong>
          <input
            value={familyName}
            onChange={(event) => setFamilyName(event.target.value)}
            placeholder="공유함 이름"
          />
          <button type="submit" disabled={isSaving}>
            공유함 만들기
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="gifticon-vault">
      <GifticonHeader family={family} onClose={onClose} />

      <div className="gifticon-family-panel">
        <div>
          <span>가족</span>
          <strong>{family.members.length}명</strong>
        </div>
        {family.isOwner ? (
          <form onSubmit={handleAddMember}>
            <input
              type="email"
              value={memberEmail}
              onChange={(event) => setMemberEmail(event.target.value)}
              placeholder="가족 이메일"
            />
            <button type="submit" disabled={isSaving}>
              추가
            </button>
          </form>
        ) : null}
      </div>

      <div className="gifticon-member-list">
        {family.members.map((member) => (
          <span key={member.id}>
            {member.displayName || member.email}
            {member.role === 'owner' ? ' · 방장' : ''}
            {family.isOwner && member.role !== 'owner' ? (
              <button type="button" onClick={() => handleRemoveMember(member.id)}>
                제거
              </button>
            ) : null}
          </span>
        ))}
      </div>

      <form className="gifticon-form" onSubmit={handleCreateGifticon}>
        <label>
          <span>이미지</span>
          <input type="file" accept="image/*" onChange={handleImageChange} />
        </label>
        {form.imageDataUrl ? (
          <button type="button" className="gifticon-image-preview" onClick={() => setPreviewImage(form.imageDataUrl)}>
            <img src={form.imageDataUrl} alt="등록할 기프티콘" />
          </button>
        ) : null}
        <label>
          <span>상품명</span>
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="예: 스타벅스 아메리카노"
          />
        </label>
        <label>
          <span>사용기한</span>
          <input
            type="date"
            value={form.expiresAt}
            onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
          />
        </label>
        <label>
          <span>바코드/QR</span>
          <input
            value={form.barcodeValue}
            onChange={(event) => setForm((current) => ({ ...current, barcodeValue: event.target.value }))}
            placeholder="자동 인식 실패 시 직접 입력"
          />
        </label>
        <label className="gifticon-form-wide">
          <span>메모</span>
          <input
            value={form.memo}
            onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
            placeholder="사용처, 받은 사람 등"
          />
        </label>
        {barcodeNotice ? <p className="gifticon-form-note">{barcodeNotice}</p> : null}
        <button type="submit" disabled={isSaving}>
          공유함에 등록
        </button>
      </form>

      <div className="filter-chips gifticon-filters" aria-label="기프티콘 보기">
        {gifticonFilters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? 'is-active' : ''}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            {counts[item.value] == null ? null : <strong>{counts[item.value]}</strong>}
          </button>
        ))}
      </div>

      {undoGifticonId ? (
        <div className="gifticon-undo">
          <span>방금 사용완료 처리했습니다.</span>
          <button type="button" onClick={() => handleRestoreActive(undoGifticonId)}>
            되돌리기
          </button>
        </div>
      ) : null}

      <div className="gifticon-list">
        {isLoading ? (
          <p className="empty-message">기프티콘을 불러오는 중입니다.</p>
        ) : gifticons.length > 0 ? (
          gifticons.map((gifticon) => (
            <GifticonCard
              key={gifticon.id}
              gifticon={gifticon}
              filter={filter}
              onPreview={setPreviewImage}
              onUse={handleMarkUsed}
              onRestoreActive={handleRestoreActive}
              onTrash={handleTrash}
              onRestoreTrash={handleRestoreTrash}
              onPermanentDelete={handlePermanentDelete}
            />
          ))
        ) : (
          <p className="empty-message">이 보기에는 기프티콘이 없습니다.</p>
        )}
      </div>

      {previewImage ? (
        <button type="button" className="gifticon-lightbox" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="기프티콘 확대 보기" />
        </button>
      ) : null}
    </section>
  );
}

function GifticonHeader({ family, onClose }) {
  return (
    <div className="gifticon-header">
      <div>
        <p className="section-label">기프티콘 공유함</p>
        <h3>{family?.name ?? '가족 공유함'}</h3>
      </div>
      <button type="button" onClick={onClose}>
        응모함으로
      </button>
    </div>
  );
}

function GifticonCard({
  gifticon,
  filter,
  onPreview,
  onUse,
  onRestoreActive,
  onTrash,
  onRestoreTrash,
  onPermanentDelete,
}) {
  const expiry = getExpiryStatus(gifticon.expiresAt);
  return (
    <article className={`gifticon-card gifticon-${gifticon.status} gifticon-expiry-${expiry.kind}`}>
      <button type="button" className="gifticon-thumb" onClick={() => onPreview(gifticon.imageUrl)}>
        <img src={gifticon.imageUrl} alt={`${gifticon.title} 기프티콘`} loading="lazy" />
      </button>
      <div className="gifticon-main">
        <div className="gifticon-title-row">
          <strong>{gifticon.title}</strong>
          <span>{expiry.label}</span>
        </div>
        <p>{gifticon.expiresAt ? formatDate(gifticon.expiresAt) : '사용기한 없음'}</p>
        {gifticon.barcodeValue ? <code>{gifticon.barcodeValue}</code> : null}
        {gifticon.memo ? <p>{gifticon.memo}</p> : null}
        {gifticon.usedAt ? (
          <p className="gifticon-used-meta">
            {gifticon.usedByLabel || '가족'} · {formatDate(gifticon.usedAt)} 사용완료
          </p>
        ) : null}
      </div>
      <div className="gifticon-actions">
        {filter === 'active' ? (
          <button type="button" className="is-primary" onClick={() => onUse(gifticon.id)}>
            사용완료
          </button>
        ) : null}
        {filter === 'used' ? (
          <button type="button" onClick={() => onRestoreActive(gifticon.id)}>
            사용가능으로
          </button>
        ) : null}
        {filter === 'trash' ? (
          <>
            {gifticon.canRestoreTrash ? (
              <button type="button" onClick={() => onRestoreTrash(gifticon.id)}>
                복구
              </button>
            ) : null}
            {gifticon.canDeletePermanently ? (
              <button type="button" className="is-danger" onClick={() => onPermanentDelete(gifticon.id)}>
                완전삭제
              </button>
            ) : null}
          </>
        ) : gifticon.canDelete ? (
          <button type="button" onClick={() => onTrash(gifticon.id)}>
            휴지통
          </button>
        ) : null}
      </div>
    </article>
  );
}

function getExpiryStatus(value) {
  if (!value) return { kind: 'none', label: '기한 없음' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiresAt = new Date(`${value}T00:00:00`);
  const diffDays = Math.round((expiresAt.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { kind: 'expired', label: '만료' };
  if (diffDays === 0) return { kind: 'today', label: '오늘 만료' };
  if (diffDays <= 7) return { kind: 'soon', label: `D-${diffDays}` };
  return { kind: 'normal', label: `D-${diffDays}` };
}

function showNotice(onNotice, type, message) {
  onNotice?.({ type, message });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

async function decodeBarcodeFromFile(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(objectUrl);
    return typeof result.getText === 'function' ? result.getText() : String(result.text ?? '');
  } catch {
    return '';
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
