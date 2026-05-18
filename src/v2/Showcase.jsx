import './tokens.css';
import './showcase.css';
import {
  Button, IconButton, Badge, Tag, Pill, Card, Avatar, Input, Stack, Inline, Divider,
} from './components/primitives.jsx';

const COLOR_GROUPS = [
  {
    name: 'Neutral',
    items: [
      ['--c-bg', '페이지 배경'],
      ['--c-surface', '카드'],
      ['--c-surface-2', '입력/필드'],
      ['--c-surface-3', 'hover'],
      ['--c-text', '본문 강조'],
      ['--c-text-mid', '본문'],
      ['--c-text-mute', '보조'],
      ['--c-text-faint', '플레이스홀더'],
    ],
  },
  {
    name: 'Brand (Indigo) · CTA / 링크 / 포커스',
    items: [
      ['--c-brand', 'brand'],
      ['--c-brand-strong', 'hover'],
      ['--c-brand-soft', 'soft bg'],
    ],
  },
  {
    name: 'Success (Green) · 당첨 / 수령 / 완료',
    items: [
      ['--c-success', 'success'],
      ['--c-success-strong', 'strong'],
      ['--c-success-soft', 'soft bg'],
    ],
  },
  {
    name: 'Warning (Amber) · 임시저장 / 내일마감',
    items: [
      ['--c-warn', 'warn'],
      ['--c-warn-soft', 'soft bg'],
    ],
  },
  {
    name: 'Danger (Red) · 오늘마감 / 제외 / 미당첨',
    items: [
      ['--c-danger', 'danger'],
      ['--c-danger-soft', 'soft bg'],
    ],
  },
  {
    name: 'Info (Blue)',
    items: [
      ['--c-info', 'info'],
      ['--c-info-soft', 'soft bg'],
    ],
  },
];

const FS_SCALE = [
  ['--fs-xs', 'xs · 11', 'caption, kbd'],
  ['--fs-sm', 'sm · 12', 'meta, badge'],
  ['--fs-base', 'base · 14', '본문'],
  ['--fs-md', 'md · 15', '리스트 제목'],
  ['--fs-lg', 'lg · 17', '카드 제목'],
  ['--fs-xl', 'xl · 20', 'H2'],
  ['--fs-2xl', '2xl · 24', 'page title'],
  ['--fs-3xl', '3xl · 30', 'H1'],
  ['--fs-4xl', '4xl · 38', 'hero'],
];

const SP_SCALE = [1,2,3,4,5,6,7,8,9,10,11];

const RADIUS = [
  ['--r-sm', 'sm · 4', 'tag, kbd'],
  ['--r-md', 'md · 8', 'button, input'],
  ['--r-lg', 'lg · 12', 'card'],
  ['--r-xl', 'xl · 16', 'sheet'],
  ['--r-2xl', '2xl · 22', 'phone, modal'],
  ['--r-full', 'full', 'pill, badge'],
];

function Section({ id, title, sub, children }) {
  return (
    <section id={id} className="sc-section">
      <header className="sc-section-head">
        <h2 className="v2-h2">{title}</h2>
        {sub && <p className="v2-muted" style={{ margin: '4px 0 0' }}>{sub}</p>}
      </header>
      <div className="sc-section-body">{children}</div>
    </section>
  );
}

export default function Showcase() {
  return (
    <div className="v2 sc-root">
      <aside className="sc-nav">
        <div className="sc-brand">
          <span className="sc-brand-mark">v2</span>
          <span>EventBot Showcase</span>
        </div>
        <nav className="sc-toc">
          <div className="v2-eyebrow" style={{ padding: '12px 12px 6px' }}>Foundations</div>
          <a href="#colors">색상</a>
          <a href="#typography">타이포그래피</a>
          <a href="#spacing">간격</a>
          <a href="#radius">라운드</a>
          <div className="v2-eyebrow" style={{ padding: '16px 12px 6px' }}>Primitives</div>
          <a href="#buttons">Button</a>
          <a href="#badges">Badge / Tag</a>
          <a href="#pills">Pill</a>
          <a href="#cards">Card</a>
          <a href="#avatars">Avatar</a>
          <a href="#inputs">Input</a>
        </nav>
        <div className="sc-footnote">
          02 (PC 인박스) + 06 (모바일 바텀시트) 하이브리드 기반.<br />
          기존 <code>src/</code>는 건드리지 않음.
        </div>
      </aside>

      <main className="sc-main">
        <header className="sc-hero">
          <span className="v2-eyebrow">EventBot · Design System v2</span>
          <h1 className="v2-h1" style={{ marginTop: 6 }}>공통 쓰고이 (Foundations &amp; Primitives)</h1>
          <p className="v2-muted" style={{ maxWidth: 720, marginTop: 8 }}>
            모든 화면이 의존할 토큰과 기본 컴포넌트. 이게 정해지면 PC 인박스(02)와 모바일(06) 구현이 같은 언어로 붙는다.
          </p>
          <div style={{ marginTop: 14 }}>
            <a href="/v2-shell.html" className="v2-btn v2-btn--primary v2-btn--sm" style={{ textDecoration: 'none' }}>
              → App Shell 보기 (/v2-shell.html)
            </a>
          </div>
        </header>

        {/* ---------------- Colors ---------------- */}
        <Section id="colors" title="🎨 색상" sub="다크 우선. 시맨틱 토큰을 먼저 쓰고, 가공된 표면(surface)은 깊이 표현용.">
          {COLOR_GROUPS.map(group => (
            <div key={group.name} className="sc-color-group">
              <div className="v2-eyebrow">{group.name}</div>
              <div className="sc-color-grid">
                {group.items.map(([token, label]) => (
                  <div key={token} className="sc-swatch">
                    <div className="sc-swatch-color" style={{ background: `var(${token})` }} />
                    <div className="sc-swatch-meta">
                      <code>{token}</code>
                      <span className="v2-muted">{label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* ---------------- Typography ---------------- */}
        <Section id="typography" title="🔤 타이포그래피" sub="Pretendard. 본문 14px, 카드 제목 15–17px, H1 30px.">
          <table className="sc-table">
            <thead>
              <tr><th>토큰</th><th>샘플</th><th>용도</th></tr>
            </thead>
            <tbody>
              {FS_SCALE.map(([token, label, use]) => (
                <tr key={token}>
                  <td><code>{token}</code></td>
                  <td><span style={{ fontSize: `var(${token})`, letterSpacing: 'var(--tracking-tight)' }}>응모대기 신라면 블랙 댓글 이벤트 — 1000명 추첨</span></td>
                  <td className="v2-muted">{label} · {use}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Divider />

          <div className="sc-weights">
            <div className="v2-eyebrow">Weights</div>
            <Inline size="lg" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 400 }}>Regular 400</span>
              <span style={{ fontWeight: 500 }}>Medium 500</span>
              <span style={{ fontWeight: 600 }}>Semibold 600</span>
              <span style={{ fontWeight: 700 }}>Bold 700</span>
              <span style={{ fontWeight: 800 }}>Black 800</span>
            </Inline>
          </div>
        </Section>

        {/* ---------------- Spacing ---------------- */}
        <Section id="spacing" title="📏 간격" sub="4px 베이스 스케일. 모든 padding/gap이 여기서 출발.">
          <div className="sc-sp-grid">
            {SP_SCALE.map(n => (
              <div key={n} className="sc-sp-row">
                <code>--sp-{n}</code>
                <div className="sc-sp-bar"><div style={{ width: `var(--sp-${n})` }} /></div>
                <span className="v2-muted v2-num">{[0,4,8,12,16,20,24,32,40,48,64,80][n]}px</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- Radius ---------------- */}
        <Section id="radius" title="◯ 라운드">
          <div className="sc-radius-grid">
            {RADIUS.map(([token, label, use]) => (
              <div key={token} className="sc-radius-item">
                <div className="sc-radius-shape" style={{ borderRadius: `var(${token})` }} />
                <code>{token}</code>
                <span className="v2-muted">{label} · {use}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- Buttons ---------------- */}
        <Section id="buttons" title="🔘 Button" sub="기본 44px(터치). sm 32 / lg 52. variant 6개, ghost/outline 포함.">
          <div className="v2-eyebrow">Variants</div>
          <Inline size="lg" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            <Button>Default</Button>
            <Button variant="primary">Primary CTA</Button>
            <Button variant="success">✔ 당첨으로 표시</Button>
            <Button variant="danger">제외</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Outline</Button>
          </Inline>

          <div className="v2-eyebrow">Sizes</div>
          <Inline size="lg" style={{ alignItems: 'center', marginBottom: 16 }}>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary">Default</Button>
            <Button variant="primary" size="lg">Large CTA</Button>
          </Inline>

          <div className="v2-eyebrow">With keyboard shortcut (02 인박스용)</div>
          <Inline size="lg" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
            <Button variant="primary">참여하기 ↗</Button>
            <Button kbd="E">참여완료</Button>
            <Button kbd="L">임시저장</Button>
            <Button variant="ghost" kbd="⌫">제외</Button>
          </Inline>

          <div className="v2-eyebrow">Block (06 바텀시트용)</div>
          <Stack style={{ maxWidth: 360, marginTop: 8 }}>
            <Button variant="primary" size="lg" block>응모하러 가기 ↗</Button>
            <Button size="lg" block>✔ 참여완료로 표시</Button>
            <Button variant="ghost" size="lg" block>🔖 임시저장</Button>
          </Stack>

          <Divider />

          <div className="v2-eyebrow">Icon Button</div>
          <Inline size="lg" style={{ marginTop: 8 }}>
            <IconButton>🔍</IconButton>
            <IconButton>⚙</IconButton>
            <IconButton>↻</IconButton>
            <IconButton size="sm">✕</IconButton>
          </Inline>

          <div className="v2-eyebrow" style={{ marginTop: 16 }}>Disabled</div>
          <Inline size="lg" style={{ marginTop: 8 }}>
            <Button variant="primary" disabled>응모 마감</Button>
            <Button disabled>저장불가</Button>
          </Inline>
        </Section>

        {/* ---------------- Badge / Tag ---------------- */}
        <Section id="badges" title="🏷 Badge & Tag" sub="Badge = 카운트/알림. Tag = 시맨틱 라벨(상태).">
          <div className="v2-eyebrow">Badge (count)</div>
          <Inline size="lg" style={{ marginTop: 8, marginBottom: 16 }}>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <IconButton>📥</IconButton>
              <Badge className="sc-badge-overlay">5</Badge>
            </span>
            <Badge variant="brand">12</Badge>
            <Badge variant="success">8</Badge>
            <Badge variant="warn">!</Badge>
            <Badge variant="neutral">99+</Badge>
            <Badge dot variant="success" />
          </Inline>

          <div className="v2-eyebrow">Tag (semantic)</div>
          <Inline size="lg" style={{ marginTop: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <Tag>대기</Tag>
            <Tag variant="brand">응모중</Tag>
            <Tag variant="warn">임시저장</Tag>
            <Tag variant="danger">오늘마감</Tag>
            <Tag variant="success">🏆 당첨</Tag>
            <Tag variant="success">📦 수령완료</Tag>
            <Tag variant="info">📷 인스타그램</Tag>
            <Tag variant="outline">미수령</Tag>
          </Inline>

          <div className="v2-eyebrow">실제 사용 — 카드 위</div>
          <Card variant="urgent" style={{ maxWidth: 480, marginTop: 8 }}>
            <Inline style={{ marginBottom: 8 }}>
              <Tag variant="danger">오늘 23:59</Tag>
              <Tag variant="info">📷 인스타그램</Tag>
              <Tag>1,000명</Tag>
            </Inline>
            <h3 className="v2-h3">신라면 블랙 출시 기념 댓글 이벤트</h3>
            <p className="v2-muted" style={{ margin: '4px 0 0' }}>@nongshim_kr · 경품 2만원</p>
          </Card>
        </Section>

        {/* ---------------- Pill ---------------- */}
        <Section id="pills" title="🟣 Pill (필터/탭)" sub="필터 칩, 정렬 탭에 사용. on/off 상태.">
          <Inline size="lg" style={{ flexWrap: 'wrap' }}>
            <Pill on>전체</Pill>
            <Pill>🔥 오늘마감</Pill>
            <Pill>💎 고액 ↑</Pill>
            <Pill>🎯 당첨률 ↑</Pill>
            <Pill>📷 인스타그램</Pill>
            <Pill>▶️ 유튜브</Pill>
            <Pill>💬 카카오톡</Pill>
          </Inline>
        </Section>

        {/* ---------------- Card ---------------- */}
        <Section id="cards" title="🟦 Card" sub="기본 / interactive / 색상 액센트(brand·urgent·success) 4가지.">
          <div className="sc-card-grid">
            <Card>
              <h3 className="v2-h3">기본 카드</h3>
              <p className="v2-muted" style={{ margin: '6px 0 0' }}>변형 없음. 패널·정보 블록용.</p>
            </Card>

            <Card interactive>
              <h3 className="v2-h3">Interactive ✨</h3>
              <p className="v2-muted" style={{ margin: '6px 0 0' }}>hover에 살짝 떠오름. 리스트 행/링크 카드.</p>
            </Card>

            <Card variant="accent">
              <h3 className="v2-h3">Brand accent</h3>
              <p className="v2-muted" style={{ margin: '6px 0 0' }}>왼쪽 세로 인디고 라인. 선택된 항목 표시.</p>
            </Card>

            <Card variant="urgent">
              <h3 className="v2-h3">Urgent</h3>
              <p className="v2-muted" style={{ margin: '6px 0 0' }}>오늘마감 카드. 빨간 라인.</p>
            </Card>

            <Card variant="success">
              <h3 className="v2-h3">Success</h3>
              <p className="v2-muted" style={{ margin: '6px 0 0' }}>당첨/수령완료. 녹색 라인.</p>
            </Card>
          </div>
        </Section>

        {/* ---------------- Avatar ---------------- */}
        <Section id="avatars" title="🟢 Avatar">
          <Inline size="lg">
            <Avatar size="sm">J</Avatar>
            <Avatar>JM</Avatar>
            <Avatar size="lg">정민</Avatar>
            <Avatar square>📷</Avatar>
            <Avatar square size="lg">▶️</Avatar>
          </Inline>
        </Section>

        {/* ---------------- Input ---------------- */}
        <Section id="inputs" title="📝 Input">
          <Stack style={{ maxWidth: 420 }}>
            <Input placeholder="이벤트 검색..." />
            <Input placeholder="포커스 시 인디고 링" defaultValue="신라면 블랙" />
            <Input placeholder="비활성" disabled />
          </Stack>
        </Section>

        <footer className="sc-footer">
          <Divider />
          <p className="v2-muted">
            다음 단계 → <b>02 인박스 레이아웃</b>(좌 폴더 / 중 리스트 / 우 디테일)과 <b>06 모바일 셸</b>(하단 네비 + 바텀시트)을 이 토큰 위에 올려 만든다.
          </p>
        </footer>
      </main>
    </div>
  );
}
