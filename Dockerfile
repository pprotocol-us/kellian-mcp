FROM node:22-slim
WORKDIR /app
COPY package.json tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm install --no-audit --no-fund && npm run build && npm prune --omit=dev
# Without KELLIAN_API_KEY the bridge serves the public reads (who's buying each
# side of a market, what moved, news); set it to use your own Kellian account.
ENTRYPOINT ["node", "dist/cli.js", "serve"]
