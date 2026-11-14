# Imagem de DESENVOLVIMENTO (Vite com hot reload).
# Em produção o front é publicado como site estático (ex.: Vercel) a partir de `npm run build`.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
