FROM node:18-alpine

WORKDIR /app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server.js"]
