export const getFileType = (name: string): string => {
  return name.split('.').pop()?.toUpperCase() || '';
};

export const isValidFile = (
  file: File,
  acceptedFormats: string[] = ['JPEG', 'JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF'],
  maxFileSize: number = 10 * 1024 * 1024
): { valid: boolean; error?: string } => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();

  // منع ملفات PDF وملفات Excel وأي ملفات غير الصور نهائياً
  const forbiddenExtensions = ['pdf', 'xlsx', 'xls', 'xlsm', 'xlsb', 'csv', 'xltx', 'xltm'];
  const forbiddenMimes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ];

  if (forbiddenExtensions.includes(ext) || forbiddenMimes.some(m => mime.includes(m))) {
    return {
      valid: false,
      error: 'عذراً، غير مسموح برفع ملفات PDF أو Excel نهائياً. يُرجى رفع صور فقط (مثل JPG, PNG, WEBP).'
    };
  }

  const fileType = getFileType(file.name);
  const sanitizedAccepted = acceptedFormats
    .filter(f => !['PDF', 'XLSX', 'XLS', 'CSV'].includes(f.toUpperCase()));
  const acceptedFormatsLower = (sanitizedAccepted.length > 0 ? sanitizedAccepted : ['JPEG', 'JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF'])
    .map(f => f.toLowerCase());

  if (!acceptedFormatsLower.includes(fileType.toLowerCase())) {
    return {
      valid: false,
      error: 'صيغة الملف غير مدعومة. مسموح برفع الصور فقط: (JPG, PNG, WEBP, إلخ)'
    };
  }

  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `حجم الملف أكبر من ${(maxFileSize / (1024 * 1024)).toFixed(0)} ميجابايت`
    };
  }

  return { valid: true };
};

export const checkImageBlankness = (file: File): Promise<{ isBlank: boolean; reason?: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const size = 32;
        canvas.width = size;
        canvas.height = size;

        if (!ctx) return resolve({ isBlank: false });

        ctx.drawImage(img, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size).data;

        let totalBrightness = 0;
        let minBrightness = 255;
        let maxBrightness = 0;
        const pixelCount = imgData.length / 4;

        for (let i = 0; i < imgData.length; i += 4) {
          const b = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
          totalBrightness += b;
          if (b < minBrightness) minBrightness = b;
          if (b > maxBrightness) maxBrightness = b;
        }

        const avgBrightness = totalBrightness / pixelCount;

        if (avgBrightness < 15 && maxBrightness < 40) {
          return resolve({
            isBlank: true,
            reason: 'الصورة مظلمة أو سوداء تماماً ولا يمكن قراءتها، يرجى تشغيل الإضاءة أو إعادة التقاط الصورة بوضوح.'
          });
        }

        if (avgBrightness > 245 && minBrightness > 225) {
          return resolve({
            isBlank: true,
            reason: 'الصورة بيضاء أو فارغة تماماً، يرجى التأكد من اختيار الصورة أو الإيصال الصحيح.'
          });
        }

        resolve({ isBlank: false });
      } catch {
        resolve({ isBlank: false });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ isBlank: false });
    };

    img.src = url;
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
