# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim
WORKDIR /app
COPY apps/vulncart-guide/ ./
ENV PORT=3300
EXPOSE 3300
USER node
CMD ["node", "server.js"]
