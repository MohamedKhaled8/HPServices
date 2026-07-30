import sys
import os
import json
import re

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": "Image file does not exist: " + image_path}))
        sys.exit(1)

    # -----------------------------------------------------------------------
    # 1. If PDF: convert first page to PNG using PyMuPDF
    # -----------------------------------------------------------------------
    temp_png_path = None
    if image_path.lower().endswith('.pdf'):
        try:
            # pyrefly: ignore [missing-import]
            import fitz  # PyMuPDF
            doc = fitz.open(image_path)
            if len(doc) == 0:
                print(json.dumps({"error": "PDF is empty (no pages)."}))
                sys.exit(1)
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=200)
            temp_png_path = image_path + "_p1.png"
            pix.save(temp_png_path)
            doc.close()
            image_path = temp_png_path
        except ImportError:
            print(json.dumps({
                "error": "لقراءة PDF يرجى تثبيت pymupdf: pip install pymupdf"
            }))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"error": "فشل تحويل PDF: " + str(e)}))
            sys.exit(1)

    # -----------------------------------------------------------------------
    # 2. OCR with Tesseract via pytesseract (very lightweight, no GPU needed)
    # -----------------------------------------------------------------------
    try:
        # pyrefly: ignore [missing-import]
        from PIL import Image
        # pyrefly: ignore [missing-import]
        import pytesseract
        # Configure Tesseract path for Windows
        import platform
        if platform.system() == 'Windows':
            tesseract_candidates = [
                r'C:\Program Files\Tesseract-OCR\tesseract.exe',
                r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
                r'C:\Users\Mohamed Khaled\AppData\Local\Programs\Tesseract-OCR\tesseract.exe',
            ]
            for candidate in tesseract_candidates:
                if os.path.exists(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break
    except ImportError as e:
        print(json.dumps({
            "error": f"مكتبة مفقودة: {str(e)}. تثبيت: pip install pytesseract pillow. ملاحظة: تأكد من تثبيت برنامج Tesseract OCR على النظام وإضافة المسار لـ PYTHONPATH."
        }))
        if temp_png_path and os.path.exists(temp_png_path):
            os.remove(temp_png_path)
        sys.exit(0)

    try:
        img = Image.open(image_path)

        # Try Arabic + English OCR
        # Tesseract language codes: ara = Arabic, eng = English
        # Falls back to eng-only if Arabic data not installed
        try:
            raw_text = pytesseract.image_to_string(img, lang='ara+eng', config='--oem 1 --psm 6')
        except Exception:
            raw_text = pytesseract.image_to_string(img, lang='eng', config='--oem 1 --psm 6')

        raw_text = raw_text.strip()
        raw_text_lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    except Exception as e:
        if temp_png_path and os.path.exists(temp_png_path):
            os.remove(temp_png_path)
        print(json.dumps({"error": "فشل التعرف الضوئي (OCR): " + str(e)}))
        sys.exit(0)
    finally:
        if temp_png_path and os.path.exists(temp_png_path):
            try:
                os.remove(temp_png_path)
            except Exception:
                pass

    # -----------------------------------------------------------------------
    # 3. Heuristic field extraction
    # -----------------------------------------------------------------------
    document_type = "مستند غير محدد"
    fields = []

    # Detect document type from text
    combined = " ".join(raw_text_lines)
    if any(k in combined for k in ["بطاقة", "الرقم القومي", "شخصية", "قومية"]):
        document_type = "بطاقة رقم قومي"
    elif any(k in combined for k in ["ميلاد", "شهادة الميلاد"]):
        document_type = "شهادة ميلاد"
    elif any(k in combined for k in ["تخرج", "بكالوريوس", "ليسانس", "الدرجة العلمية", "درجة"]):
        document_type = "شهادة تخرج"
    elif any(k in combined for k in ["جواز", "passport", "Passport"]):
        document_type = "جواز سفر"

    # Extract Egyptian National ID (exactly 14 digits)
    nid_match = re.search(r'\b([23]\d{13})\b', combined)
    if nid_match:
        nid = nid_match.group(1)
        fields.append({"label": "الرقم القومي", "value": nid})
        # Derive birth date from NID
        try:
            century = "19" if nid[0] == "2" else "20"
            birth_date = f"{century}{nid[1:3]}/{nid[3:5]}/{nid[5:7]}"
            fields.append({"label": "تاريخ الميلاد", "value": birth_date})
        except Exception:
            pass

    # Extract name: label-based first
    name_found = False
    for line in raw_text_lines:
        if re.search(r'الاسم|الاسم الكامل|الاسم الرباعي', line):
            name_val = re.sub(r'الاسم الرباعي|الاسم الكامل|الاسم', '', line)
            name_val = re.sub(r'[:|\-]', '', name_val).strip()
            if len(name_val.split()) >= 2:
                fields.append({"label": "الاسم الكامل", "value": name_val})
                name_found = True
                break

    # Fallback: look for a line with 3-5 pure Arabic words
    if not name_found:
        stop_words = ["جمهورية", "مصر", "وزارة", "كلية", "جامعة", "شهادة", "الرقم", "العربية"]
        for line in raw_text_lines:
            words = line.split()
            is_arabic = all(re.match(r'^[\u0600-\u06FF]+$', w) for w in words)
            if 3 <= len(words) <= 5 and is_arabic:
                if not any(sw in line for sw in stop_words):
                    fields.append({"label": "الاسم الكامل", "value": line})
                    break

    # Output
    output = {
        "documentType": document_type,
        "confidence": "جيدة (Tesseract OCR محلي)",
        "fields": fields,
        "rawText": raw_text
    }
    print(json.dumps(output, ensure_ascii=False))

if __name__ == "__main__":
    main()
