import React, { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import {
  Upload, FileText, Image, Archive, X, Loader2, CheckCircle2,
  AlertCircle, Download, ChevronDown, Trash2, RotateCcw, Table2, Scan, Copy
} from 'lucide-react';
import {
  analyzeImage, fileToBase64, isSupportedFileType, isImageFile, getMimeType,
  ExtractedDocument
} from '../services/geminiService';
import * as XLSX from 'xlsx';
import '../styles/DataExtractionService.css';

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'image' | 'pdf' | 'zip';
  status: 'pending' | 'analyzing' | 'done' | 'error';
  errorMessage?: string;
  thumbnailUrl?: string;
}

const DataExtractionService: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [results, setResults] = useState<ExtractedDocument[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [dragOver, setDragOver] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [showCombinedTable, setShowCombinedTable] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const getFileType = (file: File): 'image' | 'pdf' | 'zip' => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'pdf';
    if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.endsWith('.zip')) return 'zip';
    return 'image';
  };

  const addFiles = useCallback(async (newFiles: File[]) => {
    const validFiles: FileItem[] = [];
    const imagesToAdd: FileItem[] = [];

    for (const file of newFiles) {
      if (!isSupportedFileType(file)) continue;

      const fileType = getFileType(file);

      if (fileType === 'zip') {
        // Extract images from ZIP
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.entries(zip.files);
          for (const [path, zipEntry] of entries) {
            if (zipEntry.dir) continue;
            if (!isImageFile({ name: path })) continue;
            const blob = await zipEntry.async('blob');
            const extractedFile = new File([blob], path.split('/').pop() || path, {
              type: getMimeType(path)
            });
            imagesToAdd.push({
              id: generateId(),
              file: extractedFile,
              name: extractedFile.name,
              size: extractedFile.size,
              type: 'image',
              status: 'pending'
            });
          }
        } catch (e) {
          console.error('Error extracting ZIP:', e);
        }
      } else if (fileType === 'pdf') {
        // PDF: send directly to Gemini (it supports PDF)
        validFiles.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: 'pdf',
          status: 'pending'
        });
      } else {
        // Image file
        const thumbnailUrl = URL.createObjectURL(file);
        validFiles.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: 'image',
          status: 'pending',
          thumbnailUrl
        });
      }
    }

    // Add thumbnail URLs for images extracted from ZIP
    for (const item of imagesToAdd) {
      item.thumbnailUrl = URL.createObjectURL(item.file);
    }

    setFiles(prev => [...prev, ...validFiles, ...imagesToAdd]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }, [addFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.thumbnailUrl) URL.revokeObjectURL(file.thumbnailUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach(f => {
      if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl);
    });
    setFiles([]);
    setResults([]);
    setExpandedCards(new Set());
    setShowCombinedTable(false);
  };

  const startAnalysis = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setIsAnalyzing(true);
    setProgress({ current: 0, total: pendingFiles.length, fileName: '' });
    const newResults: ExtractedDocument[] = [...results];

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileItem = pendingFiles[i];
      setProgress({ current: i + 1, total: pendingFiles.length, fileName: fileItem.name });

      // Update file status to analyzing
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'analyzing' as const } : f));

      try {
        const base64 = await fileToBase64(fileItem.file);
        const mimeType = fileItem.file.type || getMimeType(fileItem.name);
        const result = await analyzeImage(base64, mimeType);

        newResults.push({
          fileName: fileItem.name,
          documentType: result.documentType,
          fields: result.fields,
          rawText: result.rawText,
          confidence: result.confidence,
          thumbnailUrl: fileItem.thumbnailUrl
        });

        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'done' as const } : f));
      } catch (error: any) {
        console.error(`Error analyzing ${fileItem.name}:`, error);
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id ? { ...f, status: 'error' as const, errorMessage: error.message } : f
        ));
      }

      setResults([...newResults]);
    }

    setIsAnalyzing(false);
  };

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const getConfidenceClass = (confidence: string): string => {
    const c = confidence.toLowerCase();
    if (c.includes('عالية') || c.includes('high')) return 'high';
    if (c.includes('متوسطة') || c.includes('medium')) return 'medium';
    return 'low';
  };

  const getFieldValue = (doc: ExtractedDocument, label: string): string => {
    const field = doc.fields.find(f =>
      f.label.includes(label) || label.includes(f.label)
    );
    return field?.value || '-';
  };

  const downloadExcel = () => {
    if (results.length === 0) return;

    // Collect all unique field labels
    const allLabels = new Set<string>();
    results.forEach(doc => doc.fields.forEach(f => allLabels.add(f.label)));
    const labelsList = Array.from(allLabels);

    // Build rows
    const rows = results.map((doc, i) => {
      const row: Record<string, string> = {
        '#': String(i + 1),
        'اسم الملف': doc.fileName,
        'نوع المستند': doc.documentType,
        'الثقة': doc.confidence
      };
      labelsList.forEach(label => {
        row[label] = getFieldValue(doc, label);
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات المستخرجة');
    XLSX.writeFile(wb, `استخراج_البيانات_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`);
  };

  const copyAllData = () => {
    if (results.length === 0) return;
    const allLabels = new Set<string>();
    results.forEach(doc => doc.fields.forEach(f => allLabels.add(f.label)));
    const labelsList = Array.from(allLabels);

    let text = ['#', 'اسم الملف', 'نوع المستند', ...labelsList].join('\t') + '\n';
    results.forEach((doc, i) => {
      const values = [
        String(i + 1),
        doc.fileName,
        doc.documentType,
        ...labelsList.map(l => getFieldValue(doc, l))
      ];
      text += values.join('\t') + '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  // Combined table columns
  const combinedColumns = React.useMemo(() => {
    const allLabels = new Set<string>();
    results.forEach(doc => doc.fields.forEach(f => allLabels.add(f.label)));
    return Array.from(allLabels);
  }, [results]);

  const FileIcon = ({ type }: { type: string }) => {
    if (type === 'pdf') return <FileText size={22} />;
    if (type === 'zip') return <Archive size={22} />;
    return <Image size={22} />;
  };

  return (
    <div className="data-extraction-container">
      {/* Upload Zone */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="upload-zone-icon">
          <Upload size={36} />
        </div>
        <div className="upload-zone-title">ارفع الملفات هنا</div>
        <div className="upload-zone-subtitle">
          اسحب الملفات هنا أو اضغط للاختيار — بطاقات هوية، شهادات تخرج، شهادات ميلاد، أي مستندات
        </div>
        <div className="upload-zone-formats">
          <span className="format-badge">📷 صور JPG/PNG</span>
          <span className="format-badge">📄 PDF</span>
          <span className="format-badge">📦 ZIP</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.zip"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="extraction-files-list">
          {files.map(fileItem => (
            <div key={fileItem.id} className="extraction-file-item">
              <div className={`extraction-file-icon ${fileItem.type}-type`}>
                <FileIcon type={fileItem.type} />
              </div>
              <div className="extraction-file-info">
                <div className="extraction-file-name">{fileItem.name}</div>
                <div className="extraction-file-size">{formatFileSize(fileItem.size)}</div>
              </div>
              <div className={`extraction-file-status ${fileItem.status}`}>
                {fileItem.status === 'pending' && <><span>في الانتظار</span></>}
                {fileItem.status === 'analyzing' && <><Loader2 size={16} className="extraction-spinner" /><span>جاري التحليل...</span></>}
                {fileItem.status === 'done' && <><CheckCircle2 size={16} /><span>تم</span></>}
                {fileItem.status === 'error' && (
                  <>
                    <AlertCircle size={16} />
                    <span title={fileItem.errorMessage} style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                      خطأ: {fileItem.errorMessage || 'فشل التحليل'}
                    </span>
                  </>
                )}
              </div>
              {!isAnalyzing && (
                <button className="extraction-file-remove" onClick={() => removeFile(fileItem.id)}>
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {files.length > 0 && (
        <div className="extraction-actions">
          <button
            className="extraction-btn extraction-btn-primary"
            onClick={startAnalysis}
            disabled={isAnalyzing || files.filter(f => f.status === 'pending' || f.status === 'error').length === 0}
          >
            {isAnalyzing ? (
              <><Loader2 size={20} className="extraction-spinner" /> جاري التحليل...</>
            ) : (
              <><Scan size={20} /> بدء استخراج البيانات</>
            )}
          </button>

          {!isAnalyzing && (
            <>
              <button className="extraction-btn extraction-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} /> إضافة ملفات
              </button>
              <button className="extraction-btn extraction-btn-danger" onClick={clearAll}>
                <Trash2 size={18} /> مسح الكل
              </button>
            </>
          )}
        </div>
      )}

      {/* Progress */}
      {isAnalyzing && (
        <div className="extraction-progress-container">
          <div className="extraction-progress-header">
            <div className="extraction-progress-title">
              <Loader2 size={20} className="extraction-spinner" />
              جاري تحليل المستندات بالذكاء الاصطناعي...
            </div>
            <div className="extraction-progress-count">
              {progress.current} / {progress.total}
            </div>
          </div>
          <div className="extraction-progress-bar">
            <div
              className="extraction-progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="extraction-current-file">
            <FileText size={14} />
            {progress.fileName}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="extraction-results">
          <div className="extraction-results-header">
            <div className="extraction-results-title">
              <Table2 size={24} />
              نتائج الاستخراج
              <span className="extraction-results-count">{results.length} مستند</span>
            </div>
            <div className="extraction-results-actions">
              <button
                className="extraction-btn extraction-btn-secondary"
                onClick={() => setShowCombinedTable(prev => !prev)}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <Table2 size={16} />
                {showCombinedTable ? 'عرض كبطاقات' : 'عرض كجدول موحد'}
              </button>
              <button
                className="extraction-btn extraction-btn-secondary"
                onClick={copyAllData}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <Copy size={16} /> نسخ الكل
              </button>
              <button
                className="extraction-btn extraction-btn-primary"
                onClick={downloadExcel}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <Download size={16} /> تنزيل Excel
              </button>
            </div>
          </div>

          {/* Combined Table View */}
          {showCombinedTable ? (
            <div className="extraction-combined-table-wrapper">
              <table className="extraction-combined-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم الملف</th>
                    <th>نوع المستند</th>
                    {combinedColumns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((doc, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: '#64748b', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{doc.fileName}</td>
                      <td>
                        <span className="extraction-doc-type-badge" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                          {doc.documentType}
                        </span>
                      </td>
                      {combinedColumns.map(col => (
                        <td key={col}>{getFieldValue(doc, col)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card View */
            results.map((doc, index) => (
              <div key={index} className="extraction-result-card">
                <div className="extraction-result-card-header" onClick={() => toggleCard(index)}>
                  <div className="extraction-result-card-title">
                    {doc.thumbnailUrl && (
                      <img
                        src={doc.thumbnailUrl}
                        alt=""
                        style={{
                          width: 40, height: 40, borderRadius: 8,
                          objectFit: 'cover', border: '1px solid #e2e8f0'
                        }}
                      />
                    )}
                    <h3>{doc.fileName}</h3>
                    <span className="extraction-doc-type-badge">{doc.documentType}</span>
                    <span className={`extraction-confidence-badge ${getConfidenceClass(doc.confidence)}`}>
                      {doc.confidence}
                    </span>
                  </div>
                  <button
                    className={`extraction-result-toggle ${expandedCards.has(index) ? 'expanded' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleCard(index); }}
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>
                <div className={`extraction-result-card-body ${expandedCards.has(index) ? 'expanded' : ''}`}>
                  <table className="extraction-fields-table">
                    <thead>
                      <tr>
                        <th>البيان</th>
                        <th>القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.fields.map((field, fi) => (
                        <tr key={fi}>
                          <td className="extraction-field-label">{field.label}</td>
                          <td className="extraction-field-value">{field.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && results.length === 0 && (
        <div className="extraction-empty-state">
          <div className="extraction-empty-state-icon">
            <Scan size={40} />
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#64748b' }}>
            ارفع صور البطاقات والشهادات وهنستخرجلك البيانات تلقائياً
          </p>
        </div>
      )}

      {/* Copy Toast */}
      {copyToast && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: 'white', padding: '12px 24px', borderRadius: 12,
          fontWeight: 700, fontSize: '0.9rem', zIndex: 9999,
          boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
          animation: 'slideUp 0.3s ease-out'
        }}>
          ✅ تم نسخ البيانات بنجاح
        </div>
      )}

      {/* Retry button for failed files */}
      {!isAnalyzing && files.some(f => f.status === 'error') && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            className="extraction-btn extraction-btn-secondary"
            onClick={() => {
              setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'pending' as const } : f));
            }}
          >
            <RotateCcw size={16} /> إعادة محاولة الملفات الفاشلة
          </button>
        </div>
      )}
    </div>
  );
};

export default DataExtractionService;
