import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", ".wrangler/**"],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);
