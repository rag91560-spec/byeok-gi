import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "build/**",
      "build-staging/**",
      "dist/**",
      "dist-electron/**",
      "dist-electron2/**",
      "electron/**",
      "marketing/**",
      "node_modules/**",
      "scripts/**",
      "marketing/profiles/**",
    ],
  },
  {
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]

export default config
