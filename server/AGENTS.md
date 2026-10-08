# API 지침

## 모듈 맥락

`server`는 Anthropic과 Google 생성 요청을 위한 Bun API 프록시다. 환경 변수 기반 키를 보호하고, 클라이언트 미리보기용 생성 코드를 정규화하며, 순서 기반 Google 모델 폴백을 제공한다.

## 제약과 패턴

- 엔드포인트 계약이 변경되지 않는 한 Bun 네이티브 `Bun.serve`와 표준 `fetch`를 사용하며 공급자 SDK를 추가하지 않는다. 근거: `index.ts:68-82`, `index.ts:98-109`, `index.ts:138-220`.
- API 키 조회는 `resolveApiKey` 내부에 유지하고, `/api/config`에서는 키 사용 가능 여부만 반환한다. 근거: `index.ts:59-65`, `index.ts:147-156`.
- `OPTIONS`와 오류 응답을 포함한 모든 라우트 경로에 CORS 헤더를 보존한다. 근거: `index.ts:51-55`, `index.ts:141-143`, `index.ts:169-180`, `index.ts:190-217`.
- 출력 정리는 순수 헬퍼에 유지하며 `stripCodeFences`를 `ensureRenderCall`보다 먼저 적용한다. 근거: `generator.ts:5-23`, `index.ts:188`.
- `GOOGLE_MODELS`의 폴백 순서를 유지한다. `withModelFallback`은 첫 성공에서 즉시 반환하고 모든 모델이 실패한 경우에만 마지막 오류를 던져야 한다. 근거: `index.ts:4-5`, `index.ts:134-135`, `fallback.ts:7-19`.

## 테스트 전략

- 전체 테스트는 `bun run test`로 실행한다. 서버 헬퍼만 확인할 때는 `bunx vitest run server`를 사용한다.
- 파싱 및 폴백 동작은 순수 함수로 테스트하며 단위 테스트에서 `Bun.serve`를 시작하지 않는다. 근거: `generator.ts:1-2`, `generator.test.ts:1-29`, `fallback.test.ts:1-38`.

## 로컬 핵심 규칙

- `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, 해석된 요청 키를 직렬화, 반환, 로그 기록하지 않는다. 근거: `index.ts:59-65`, `index.ts:147-156`.
- 일반 `500` 응답보다 먼저 과부하(`503`)와 요청 제한(`429`)에 대한 공급자별 오류 매핑을 보존한다. 근거: `index.ts:191-211`.
- 생성 프롬프트와 정규화기는 하나의 계약이다. 양쪽과 테스트를 함께 갱신하지 않은 채 import, TypeScript 문법, CSS import, 누락된 `render(...)` 동작을 허용하지 않는다. 근거: `index.ts:9-20`, `generator.ts:13-23`, `generator.test.ts:16-29`.
