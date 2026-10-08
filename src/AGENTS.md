# 클라이언트 지침

## 모듈 맥락

`src`는 React 워크벤치, 클라이언트 생성 상태, `react-live` 미리보기를 담당한다. Vite 프록시를 통해 Bun 서버가 제공하는 상대 `/api` 엔드포인트를 사용한다.

## 제약과 패턴

- 공급자 및 생성 컴포넌트 타입은 `src/types`에 유지한다. 프레젠테이션 컴포넌트에서 공급자 동작을 분기하지 말고 선택한 공급자를 생성 훅에 전달한다. 근거: `src/App.tsx:3-5`, `src/App.tsx:39-42`, `src/hooks/useComponentGenerator.ts:2,18`.
- 생성 요청은 `useComponentGenerator` 훅을 통해 수행한다. 이 훅이 로딩, 오류, 삽입, 삭제, 전체 삭제 상태를 소유한다. 근거: `src/hooks/useComponentGenerator.ts:13-59`.
- 생성 코드는 `noInline`이 설정된 `LiveProvider`에 전달한다. 서버 출력은 마지막 `render(...)` 호출을 요구한다. 근거: `src/components/LivePreview.tsx:9-13`, `../server/generator.ts:13-23`.
- API 또는 파싱 오류에도 로딩 상태가 해제되도록 생성 로직의 `try`/`catch`/`finally` 상태 처리를 보존한다. 근거: `src/hooks/useComponentGenerator.ts:18-48`.
- 빈 API 키 속성은 전송하지 않는다. 훅이 조건부로 포함해야 서버가 설정된 환경 변수 키를 선택할 수 있다. 근거: `src/hooks/useComponentGenerator.ts:23-27`, `../server/index.ts:64-65`.

## 테스트 전략

- 전체 테스트는 `bun run test`로 실행한다. 프롬프트 입력 경계만 확인할 때는 `bunx vitest run src/components/PromptInput.test.tsx`를 사용한다.
- `PromptInput`을 수정할 때는 빈 프롬프트, 활성화된 제출, 콜백 전달값, 로딩 상태 레이블 테스트를 유지한다. 근거: `components/PromptInput.test.tsx:6-30`.

## 로컬 핵심 규칙

- 빈 프롬프트와 로딩 상태 검사는 제출 핸들러와 버튼 상태 모두에 유지한다. 하나를 제거하면 기존 방어 경로가 우회된다. 근거: `components/PromptInput.tsx:20-24`, `components/PromptInput.tsx:50-59`.
- 생성 컴포넌트는 최신 항목이 앞에 오도록 유지하고, 카드 렌더링 전 고유한 클라이언트 ID를 부여한다. 근거: `hooks/useComponentGenerator.ts:35-42`.
