FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY lib ./lib
COPY public ./public
# стартовые данные (Тахтапул): попадут в пустой том при первом запуске
COPY data/projects ./seed-data/projects
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data", "/app/sites"]
CMD ["node", "server.js"]
