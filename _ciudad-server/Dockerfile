# Ciudad ICADEM · servidor de sesiones (multijugador).
# Se construye desde la RAÍZ del repositorio porque comparte módulos con el juego (ciudad/js).
# En Railway: Root Directory vacío (raíz) y variable RAILWAY_DOCKERFILE_PATH=_ciudad-server/Dockerfile.
FROM node:22-alpine
WORKDIR /app
COPY _ciudad-server/package.json _ciudad-server/package-lock.json ./_ciudad-server/
RUN cd _ciudad-server && npm ci --omit=dev && npm cache clean --force
COPY ciudad/js ./ciudad/js
COPY _ciudad-server ./_ciudad-server
# Valores fijos de este servicio. Los secretos y la configuración van en las variables de Railway.
ENV NODE_ENV=production CIUDAD_AUTH=firebase CIUDAD_TRUST_PROXY=1
USER node
CMD ["node", "_ciudad-server/server.js"]
