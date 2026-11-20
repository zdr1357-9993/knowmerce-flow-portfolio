# 로컬 실행

Node 22.13 이상, package.json의 pnpm 버전을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm dev
```

공개 홈은 로그인 없이 예시 데이터로 체험합니다. 데이터는 브라우저에만 저장됩니다.
실제 계정 API를 시험하려면 별도의 로컬 D1과 테스트 계정을 준비해야 합니다.
`pnpm exec wrangler d1 migrations apply DB --local`로 로컬 스키마를 준비합니다.
검토 로그인 설정은 REVIEW_LOGIN_ID, REVIEW_PASSWORD_HASH, REVIEW_PASSWORD_SALT를 사용하는 코드와 API를 확인해 구성합니다.
비밀값은 직접 생성한 `.dev.vars`에만 두고 Git에 추가하지 않습니다.
`tests/accounts-integration.mjs`는 TEST_BASE, TEST_ADMIN_LOGIN, TEST_ADMIN_PASSWORD가 필요하며 로컬 서버만 허용합니다.
실제 인증 통합 테스트는 기본 자동 검사에 포함되지 않습니다.

배포하려면 wrangler.jsonc의 자리표시자를 본인의 D1 리소스로 바꾸고 환경을 구성하세요.
GitHub 자동 검사는 배포하지 않습니다.
