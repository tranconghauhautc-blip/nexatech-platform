# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim
WORKDIR /app
COPY apps/vulncart-admin/ ./
ENV PORT=3200
EXPOSE 3200
USER node
CMD ["node", "server.js"]
