# Game Translator v1.2.5

Next.js 16 + React 19 + TS5 + Tailwind v4 + Electron 35 + Python FastAPI(:8000). 상세 → `ARCHITECTURE.md`

## 구조
`app/` pages | `components/ui/` CVA | `components/game-detail/` 도메인 | `hooks/` (use-api, use-locale, use-theme) | `lib/` (api.ts, types.ts, i18n.ts) | `backend/` FastAPI (routers/ 11개) | `electron/` (main.js, preload.js)

## 컨벤션
- CSS Variables(`--background`, `--foreground`, `--accent`, `--card`, `--border`, `--radius`) + Tailwind. `cn()` 유틸. 색상 하드코딩 금지
- 상태: 커스텀 훅. Redux/Zustand 없음 | 컴포넌트: CVA variants | API: `api.games.scan()` 패턴
- i18n: `use-locale.ts` (ko 기본, en 폴백) | 테마: dark 기본, system 감지
- 커밋: `feat:/fix:/refactor:/ui:/backend:/build:` + 변경 이유

## 명령어
```bash
npm run dev / build / lint / electron:dev / electron:build / electron:pack
```

## 규칙
- 새 페이지: `app/<name>/page.tsx` + `"use client"` 필수
- 새 UI: `components/ui/` CVA 패턴 | 도메인: `components/<domain>/`
- API 추가: `lib/api.ts` 메서드 + `backend/routers/` 엔드포인트 + `lib/types.ts` 타입
- 에러: API catch → toast. 라이선스 만료 → Paywall
- 커밋 전 `npm run lint && npm run build` 통과 필수
- 시크릿 하드코딩 금지
