FROM node:18-slim

# تثبيت مكتبات النظام اللازمة لتشغيل Chrome/Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 librandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# إعداد مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع
COPY package*.json ./
COPY server.js ./

# تثبيت المكتبات
RUN npm install

# تثبيت متصفحات Playwright وتوابعها
RUN npx playwright install --with-deps chromium

# فتح البورت 7860 (هذا هو البورت الرسمي لـ Hugging Face)
EXPOSE 7860

# تغيير بورت السيرفر ليعمل على 7860 عبر متغير البيئة
ENV PORT=7860

# تشغيل السيرفر
CMD ["node", "server.js"]
