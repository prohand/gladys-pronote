# -----------------------------------------------------------------------------
# Integration image.
#
# Gladys sandbox constraints ("the sandbox is the defense"):
#   - rootfs mounted READ-ONLY -> never write outside /data
#   - a single writable volume: /data (the PRONOTE session token and what was
#     already announced live there, see src/storage.js)
#   - runs as a non-root user
#   - multi-arch image (linux/amd64 + linux/arm64), see the build workflow
# -----------------------------------------------------------------------------

FROM node:24-alpine

# dumb-init: handles signals (SIGTERM) correctly for a graceful shutdown.
RUN apk add --no-cache dumb-init

WORKDIR /app

# Install the PROD dependencies first (better build cache). The postinstall
# script patches pawnote for the PRONOTE 2026.2 login (scripts/patch-pawnote.js).
COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm ci --omit=dev && npm cache clean --force

# Then the integration code.
COPY index.js ./
COPY src ./src
COPY gladys-assistant-integration.json ./

# PRONOTE writes local times without a zone. The configuration can change it
# (src/logging.js); this is the zone of most PRONOTE servers until it does.
ENV NODE_ENV=production TZ=Europe/Paris PRONOTE_DATA_DIR=/data

# The only writable location allowed at runtime.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

# Run as an unprivileged user (already present in the node image).
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
