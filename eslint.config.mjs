import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      ".next-novels-dev/**",
      ".next-electron-dev/**",
      ".next-electron-dev-*/**",
      ".venv*/**",
      ".omx/**",
      ".tmp*/**",
      "build/**",
      "build-staging/**",
      "data/**",
      "dist/**",
      "dist-electron/**",
      "dist-electron2/**",
      "electron/**",
      "extracted/**",
      "logs/**",
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
