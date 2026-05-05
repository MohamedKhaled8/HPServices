FROM node:18-slim

# تثبيت مكتبات النظام اللازمة لتشغيل Chrome/Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ثبّت اعتماديات خدمة الأتمتة فقط (لتسريع البناء وتقليل الحجم)
COPY backend_service/package*.json ./backend_service/
RUN cd backend_service && npm install

# انسخ ملفات خدمة الأتمتة
COPY backend_service/server.js backend_service/automationCrypto.js ./backend_service/

# تثبيت متصفحات Playwright وتوابعها
RUN cd backend_service && npx playwright install --with-deps chromium

EXPOSE 7860
ENV PORT=7860

CMD ["node", "backend_service/server.js"]
