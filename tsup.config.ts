import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    api: "src/api.ts",
    clients: "src/clients.ts",
    walletSigner: "src/walletSigner.ts",
    pmOrderCheck: "src/pmOrderCheck.ts",
    pmOrder: "src/pmOrder.ts",
  },
  format: ["esm"],
  target: "node18",
  clean: true,
  splitting: false,
  sourcemap: false,
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
});
