# Imagem de DESENVOLVIMENTO (Vite com hot reload).
# Em produção (Railway) o front usa o Dockerfile.prod: build estático + Caddy (ver backend/docs/deploy-railway.md).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
