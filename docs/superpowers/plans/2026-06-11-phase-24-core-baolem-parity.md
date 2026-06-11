# Phase 24 P0 Core Baolem Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three core product loops to match the observed `baolem.com` capability model: 爆款素材 -> 提示词库 -> 智能创作.

**Architecture:** Keep the existing Next.js App Router, Prisma services, and DB worker architecture. Do not copy protected assets or exact private implementation from `baolem.com`; reproduce product capabilities and user flow using our existing design system, services, and mock/real AI adapter boundary.

**Tech Stack:** Next.js App Router, React client components, Prisma/PostgreSQL, Vitest, Playwright, existing AI worker and OpenAI-compatible provider.

---

## Scope

### In Scope

- 爆款素材 page becomes a multi-tab material center: 对标号, 爆文文章, 今日热搜, 爆文拆解, 如何找对标.
- 提示词库 emphasizes material feeding: selected/imported articles or source links -> track prompt generation -> saved prompt.
- 智能创作 becomes an article production console: article list/table, grouped status, creation drawer, prompt selection, material links, image mode.
- Fix any broken current Phase 23 files, including mojibake user-visible strings and TypeScript/JSX issues.
- Preserve worker-first job execution. No default production `setImmediate`.

### Out of Scope

- Real payment, real WeChat authorization, real payout.
- Real third-party material API integration such as 次幂数据. Keep adapter/UI placeholder.
- Direct cloning of `baolem.com` copyrighted copy, images, QR codes, or brand assets.
- Full public template marketplace.

---

## Files

### Expected Modifications

- `app/(dashboard)/materials/client.tsx`: material center tabs and layout.
- `components/feature/materials/TrackDeconstruction.tsx`: repair and upgrade import/select/generate UI.
- `components/feature/materials/AccountList.tsx`, `ArticleList.tsx`, `HotTopicList.tsx`: align labels/actions where needed.
- `app/(dashboard)/prompts/client.tsx`, `components/feature/prompts/*`: expose material-fed prompt generation clearly.
- `app/(dashboard)/writing/client.tsx`, `components/feature/writing/*`: article production console and creation flow.
- `lib/services/material-import.service.ts`, `lib/services/material-track-prompt.service.ts`, `lib/services/prompt-generation.service.ts`: keep validation and generated prompt metadata correct.
- `lib/ui/labels.ts`: status/source labels.
- `tests/material-track-prompt.test.ts`, `tests/browser*.spec.ts`: update and add focused coverage.

### Expected Created Files

- Optional focused components if needed:
  - `components/feature/materials/BenchmarkGuide.tsx`
  - `components/feature/materials/MaterialCenterTabs.tsx`
  - `components/feature/writing/WritingConsole.tsx`

---

## Task 1: Stabilize Current Workspace

**Files:**
- Inspect: all dirty files from `git status --short`
- Modify only files needed for Phase 24

- [ ] Run:

```powershell
git status --short
npm run lint
npx tsc --noEmit
```

- [ ] Identify whether current failures are from existing uncommitted work or new edits.
- [ ] Do not revert user/previous-agent work. Repair broken TypeScript/JSX and visible mojibake in files touched for Phase 24.
- [ ] Expected result before deeper work: project can typecheck or has a short, concrete list of blockers.

---

## Task 2: 爆款素材 Multi-Tab Center

**Files:**
- Modify: `app/(dashboard)/materials/client.tsx`
- Modify: `components/feature/materials/TrackDeconstruction.tsx`
- Modify: material subcomponents only if needed

- [ ] Add tabs with these exact user-facing names:
  - `对标号`
  - `爆文文章`
  - `今日热搜`
  - `爆文拆解`
  - `如何找对标`

- [ ] Map existing data:
  - `对标号` uses existing account ranking data.
  - `爆文文章` uses existing material article data.
  - `今日热搜` uses existing hot topic data.
  - `爆文拆解` uses imported article and track prompt generation.
  - `如何找对标` is a concise method card, not a long marketing page.

- [ ] Required actions visible where supported:
  - 收藏
  - 复制标题
  - 复制链接
  - 查看原文
  - 导出

- [ ] Where an action is not implemented or requires future provider work, show a Chinese disabled state or placeholder such as `接口预留，暂未配置`.

- [ ] Preserve current Playwright selectors where practical, or update tests after UI changes.

---

## Task 3: 爆文拆解 Repair and Upgrade

**Files:**
- Modify: `components/feature/materials/TrackDeconstruction.tsx`
- Modify: `lib/services/material-import.service.ts`
- Modify: `app/api/material/articles/import/route.ts`
- Modify: `app/api/material/track-prompts/generate/route.ts`

- [ ] Fix all user-visible mojibake strings.
- [ ] Keep paste/url import minimum full content length at `300` characters.
- [ ] Keep duplicate import as 409, validation as 400, internal error as 500.
- [ ] UI must show:
  - paste full article
  - article URL fetch
  - third-party API placeholder
  - selected article count `已选择 x/10`
  - `至少选择 3 篇` validation
  - prompt group selector loaded from `/api/prompts/groups`
  - generated prompt success link to `/prompts`

- [ ] Track prompt job must create a private prompt with:
  - `sourceType: "material_track_generated"`
  - `visibility: "private"`
  - config containing article IDs and analysis summary.

---

## Task 4: 提示词库 Material-Fed Workflow

**Files:**
- Modify: `app/(dashboard)/prompts/client.tsx`
- Modify: `components/feature/prompts/GenerateForm.tsx`
- Modify: `components/feature/prompts/PromptList.tsx`
- Modify: `lib/ui/labels.ts`

- [ ] Make the primary generation story explicit: `投喂爆文素材，生成专属提示词`.
- [ ] Prompt cards must show source labels:
  - `手动创建`
  - `智能生成`
  - `爆文拆解生成`
- [ ] Prompt detail/card should surface source article count or source links when available.
- [ ] Failure status must be Chinese and specific enough for users, not raw technical messages.
- [ ] Keep edit/copy/delete/group operations working.

---

## Task 5: 智能创作 Production Console

**Files:**
- Modify: `app/(dashboard)/writing/client.tsx`
- Modify: `components/feature/writing/CreateForm.tsx`
- Modify: `components/feature/writing/ArticleList.tsx`

- [ ] Page should read as article production console, not just a form:
  - article list/table or dense cards
  - title
  - group
  - generation status
  - push status
  - updated time
  - action buttons

- [ ] Creation form/drawer must support:
  - article title
  - prompt selection
  - optional source/material links
  - image mode: `智能配图`, `原文采集`, `不插图`
  - generated article saved to article list

- [ ] Use current mock/real AI services. Do not add new worker architecture.
- [ ] Keep formatter link and official-account push placeholder visible when article exists.

---

## Task 6: Tests and Verification

**Files:**
- Modify: `tests/material-track-prompt.test.ts`
- Modify/add: Playwright tests only where selectors changed or new P0 flow needs coverage.

- [ ] `npm run lint` must return 0 errors and ideally 0 warnings.
- [ ] `npx tsc --noEmit` must pass.
- [ ] `npm run test` must pass.
- [ ] `npm run build` must pass.
- [ ] Run:

```powershell
npx playwright test tests/browser.spec.ts tests/browser-console.spec.ts tests/browser-interaction.spec.ts --workers=1
```

- [ ] Add or update screenshots for:
  - `screenshots/materials.png`
  - `screenshots/prompts.png`
  - `screenshots/writing.png`

---

## Self-Review Checklist

- [ ] 爆款素材 has the five-tab product structure.
- [ ] 提示词库 makes material feeding the main story.
- [ ] 智能创作 reads like an article production console.
- [ ] No default production `setImmediate`.
- [ ] No user-visible mojibake.
- [ ] No raw English status keys in user-facing UI.
- [ ] No native `alert()` or `confirm()` in user-facing paths.
- [ ] Tests pass locally or any local Prisma dev instability is clearly separated from code failures.
