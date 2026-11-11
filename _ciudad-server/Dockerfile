# Ciudad ICADEM · servidor de sesiones. Se construye desde la RAÍZ del repositorio
# (necesita ciudad/js, que comparte con el cliente). En Railway: Root Directory = "/" y
# RAILWAY_DOCKERFILE_PATH = _ciudad-server/Dockerfile.
FROM node:22-alpine
WORKDIR /app
COPY _ciudad-server/package*.json ./_ciudad-server/
RUN cd _ciudad-server && npm ci --omit=dev
COPY ciudad/js ./ciudad/js
COPY _ciudad-server ./_ciudad-server
ENV NODE_ENV=production CIUDAD_AUTH=firebase
EXPOSE 8787
CMD ["node", "_ciudad-server/server.js"]
