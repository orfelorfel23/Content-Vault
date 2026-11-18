FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app

EXPOSE 3001
USER appuser
CMD ["node", "index.js"]
