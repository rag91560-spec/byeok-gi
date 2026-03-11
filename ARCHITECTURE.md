# Game Translator Architecture

## 라우팅 맵

```
/ (page.tsx)                     → 홈/게임 목록 (스캔, 검색)
├── /library (page.tsx)          → 게임 라이브러리 (그리드)
│   └── /library/[id] (page.tsx) → 게임 상세 (번역/적용/롤백)
│       ├── /flow (page.tsx)     → 게임 파일 구조 플로우 (@xyflow)
│       └── /strings (page.tsx)  → 번역 문자열 관리 (페이지네이션)
├── /translate (page.tsx)        → 번역 작업 (진행률, SSE)
├── /play/[id] (page.tsx)        → HTML 게임 실행 (Electron 별도 창)
├── /presets (page.tsx)          → 번역 프리셋 관리
├── /memory (page.tsx)           → 번역 메모리 (TM)
├── /download (page.tsx)         → AI 모델 다운로드
├── /models (page.tsx)           → AI 모델 관리
├── /settings (page.tsx)        → 앱 설정 (API키, 언어, 테마)
└── /admin (page.tsx)           → 관리자 패널 (동기화)
```

## 컴포넌트 카탈로그

### UI 컴포넌트 (`components/ui/`)
| 컴포넌트 | 파일 | 패턴 | 용도 |
|---------|------|------|------|
| Button | `button.tsx` | CVA variants | 범용 버튼 (variant, size) |
| Card | `card.tsx` | CVA | 콘텐츠 카드 래퍼 |
| GlowBorder | `glow-border.tsx` | hover 효과 | 카드 글로우 보더 |
| FlowNode | `flow-node.tsx` | @xyflow | 파일 구조 노드 |
| Paywall | `paywall.tsx` | 모달 | 라이선스 결제 벽 |

### 도메인 컴포넌트 (`components/game-detail/`)
| 컴포넌트 | 파일 | 용도 |
|---------|------|------|
| GameHeroBanner | `GameHeroBanner.tsx` | 게임 정보 헤더 (커버, 제목, 엔진) |
| TranslationPanel | `TranslationPanel.tsx` | 번역 시작/적용/롤백 UI |
| EmulatorPanel | `EmulatorPanel.tsx` | Android 에뮬레이터 제어 |
| CoverSearchModal | `CoverSearchModal.tsx` | 커버 아트 검색/선택 (VNDB, DLsite) |
| ChipButton | `ChipButton.tsx` | 소형 액션 버튼 |

### 레이아웃 & 기타
| 컴포넌트 | 파일 | 용도 |
|---------|------|------|
| Sidebar | `layout/Sidebar.tsx` | 사이드바 네비게이션 |
| ReviewPanel | `review-panel.tsx` | 번역 검수 UI |
| ExportImportButtons | `export-import-buttons.tsx` | 프로젝트 I/O |
| SyncWorker | `SyncWorker.tsx` | 백그라운드 라이선스 동기화 |
| UpdateBanner | `UpdateBanner.tsx` | 앱 업데이트 알림 |

## Electron IPC 흐름

```
┌─────────────────────────────────────────────────┐
│ Renderer (Next.js)                              │
│                                                 │
│  window.electronAPI.method()                    │
│       │                                         │
│       ▼ contextBridge (preload.js)              │
├─────────────────────────────────────────────────┤
│ Main Process (main.js)                          │
│                                                 │
│  ipcMain.handle('channel', handler)             │
│       │                                         │
│       ├── getAppVersion → package.json version  │
│       ├── checkForUpdates → electron-updater    │
│       ├── downloadUpdate → autoUpdater          │
│       ├── installUpdate → quitAndInstall()      │
│       ├── selectApkFile → dialog.showOpenDialog │
│       ├── selectApkFolder → dialog (directory)  │
│       ├── selectSubtitleFiles → dialog (multi)  │
│       ├── openHtmlGame → new BrowserWindow      │
│       ├── closeHtmlGame → gameWindows.get().close│
│       └── showConfirm → dialog.showMessageBox   │
│                                                 │
│  이벤트 (Main → Renderer):                     │
│  ├── update-available → onUpdateAvailable       │
│  ├── update-progress → onUpdateProgress         │
│  └── update-downloaded → onUpdateDownloaded     │
└─────────────────────────────────────────────────┘
```

## 데이터 흐름

### 게임 스캔 → 번역 → 적용
```
1. 사용자가 폴더 선택
   └→ api.games.scan(path) → POST /games/scan
      └→ engine_bridge.detect_engine() → 엔진 감지
         └→ DB에 게임 등록 → 게임 목록 갱신

2. 번역 시작
   └→ api.translate.start(id, options) → POST /games/{id}/translate
      └→ job_manager → 비동기 작업 생성
         └→ SSE /games/{id}/translate/status → 실시간 진행률
            └→ useTranslationProgress(id) → EventSource 구독

3. 번역 적용
   └→ api.translate.apply(id) → POST /games/{id}/translate/apply
      └→ engine_bridge → 원본 백업 → 번역 파일 적용
         └→ 롤백 가능: api.translate.rollback(id)
```

### API 프록시 구조
```
Next.js (:3100)          FastAPI (:8000)
───────────────          ──────────────
/api/* ──proxy──→        /* (직접 라우팅)
next.config.ts           server.py
rewrites()               app = FastAPI()
```

## 백엔드 모듈 관계

```
server.py (진입점)
├── routers/
│   ├── games.py ──→ engine_bridge.py ──→ [ue_translator 코어]
│   ├── translate.py ──→ job_manager.py ──→ sse_utils.py
│   ├── covers.py ──→ cover_fetcher.py
│   ├── qa.py ──→ qa_engine.py
│   ├── glossary.py ──→ glossary_analyzer.py
│   ├── settings.py ──→ license.py
│   ├── sync.py ──→ license.py
│   ├── memory.py (TM)
│   ├── models.py (AI 모델)
│   ├── android.py ──→ android_manager.py
│   └── export_import.py ──→ project_io.py
├── db.py (SQLite)
├── models.py (Pydantic)
└── context_builder.py, structure_parser.py
```

## 핵심 의존성
| 패키지 | 버전 | 용도 |
|--------|------|------|
| next | 16.x | 프레임워크 |
| react | 19.x | UI 라이브러리 |
| tailwindcss | 4.x | CSS 유틸리티 |
| electron | 35.x | 데스크톱 래퍼 |
| @xyflow/react | - | 플로우 차트 (파일 구조) |
| class-variance-authority | - | 컴포넌트 variants |
| lucide-react | - | 아이콘 |
| electron-updater | 6.x | 자동 업데이트 |
