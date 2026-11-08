FROM node:22-alpine
WORKDIR /app
# ffmpeg: turns browser voice recordings into WhatsApp voice notes. git: needed once by npm to fetch the WhatsApp library.
RUN apk add --no-cache ffmpeg git
COPY package.json ./
# These packages are only for "link your phone number" (QR code). If they cannot be installed the rest of the app still runs.
RUN npm install --omit=dev --no-audit --no-fund || echo "WARNING: WhatsApp link packages not installed"
COPY . .
ENV PORT=3000 DATA_FILE=/app/data/db.json
EXPOSE 3000
CMD ["node", "server.js"]
