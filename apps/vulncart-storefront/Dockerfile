# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim
WORKDIR /app
COPY apps/vulncart-storefront/ ./
ENV PORT=3100
EXPOSE 3100
USER node
CMD ["node", "server.js"]
