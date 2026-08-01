FROM node:22-alpine
WORKDIR /app
COPY apps/security-guide-portal/package.json ./package.json
COPY apps/security-guide-portal/src ./src
COPY apps/security-guide-portal/guides ./guides
COPY security-scenarios ./security-scenarios
RUN npm install bcryptjs@3.0.2 --omit=dev
ENV PORT=3200
EXPOSE 3200
CMD ["node", "src/main.cjs"]
