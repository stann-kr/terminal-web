import next from "eslint-config-next";

/**
 * ESLint flat config — Next 16 모던 방식.
 * `next lint`는 Next 16에서 제거됨 → eslint-config-next의 flat export를 직접 사용
 * (구 FlatCompat 래핑은 ESLint 9에서 순환 구조 에러 발생).
 *
 * react-hooks 신규 순수성 규칙(purity/set-state-in-effect/immutability)은
 * 실시간 CRT 터미널 미학(렌더 중 Date.now/Math.random — 라이브 클락·디코드)과
 * 충돌하므로 error→warn 완화. 진짜 에러는 게이트로 계속 차단.
 */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", ".open-next/**", ".wrangler/**", "migrations/**", ".docs/**", ".design-archive/**"],
  },
  ...next,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
