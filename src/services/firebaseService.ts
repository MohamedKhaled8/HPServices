import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { CLOUDINARY_CONFIG, UPLOAD_PRESET } from '../config/cloudinary';
import { StudentData, ServiceRequest, UploadedFile, BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig } from '../types';

// Auth Functions
export const registerUser = async (email: string, password: string, studentData: StudentData): Promise<FirebaseUser> => {
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save student data to Firestore
    const studentDataWithId = {
      ...studentData,
      id: user.uid,
      email: email,
      password: password, // Storing password as requested
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'students', user.uid), studentDataWithId);

    return user;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء التسجيل');
  }
};

export const loginUser = async (email: string, password: string): Promise<FirebaseUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    // تحسين رسائل الخطأ
    let errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'المستخدم غير موجود. يرجى التسجيل أولاً';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'كلمة المرور غير صحيحة';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'البريد الإلكتروني غير صحيح';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'تم تعطيل هذا الحساب';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'محاولات كثيرة. يرجى المحاولة لاحقاً';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'طريقة تسجيل الدخول غير مفعلة. يرجى تفعيل Email/Password في Firebase Console';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تسجيل الخروج');
  }
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Student Data Functions
export const getStudentData = async (userId: string): Promise<StudentData | null> => {
  try {
    const docRef = doc(db, 'students', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
    }
    return null;
  } catch (error: any) {
    // تحسين رسائل الخطأ
    let errorMessage = 'حدث خطأ أثناء جلب البيانات';
    
    if (error.code === 'permission-denied') {
      errorMessage = 'الأذونات مفقودة. يرجى التحقق من Firestore Security Rules';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error('Error getting student data:', error);
    throw new Error(errorMessage);
  }
};

export const updateStudentData = async (userId: string, data: Partial<StudentData>): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'students', userId),
      {
        ...data,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث البيانات');
  }
};

// Get all students (for admin view)
export const getAllStudents = async (): Promise<StudentData[]> => {
  try {
    const q = query(collection(db, 'students'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
    });
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب البيانات');
  }
};

// Real-time listener for all students
export const subscribeToAllStudents = (
  callback: (students: StudentData[]) => void,
  onError?: (error: any) => void
): (() => void) => {
  const q = query(collection(db, 'students'));
  
  return onSnapshot(q, (querySnapshot) => {
    const students: StudentData[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
    });
    console.log('subscribeToAllStudents: Found', students.length, 'students');
    callback(students);
  }, (error) => {
    console.error('Error in students subscription:', error);
    if (onError) {
      onError(error);
    }
  });
};

// Search for a student by any field
export const searchStudent = async (searchTerm: string): Promise<StudentData[]> => {
  try {
    const studentsRef = collection(db, 'students');
    const allStudents: StudentData[] = [];
    
    // If search term is empty, return empty array
    if (!searchTerm.trim()) {
      return [];
    }
    
    // Get all students (Firestore doesn't support full-text search easily)
    const querySnapshot = await getDocs(studentsRef);
    
    // Check if search term is a number (for national ID or phone)
    const isNumeric = /^\d+$/.test(searchTerm);
    const isNationalID = isNumeric && searchTerm.length <= 14;
    const searchLower = searchTerm.toLowerCase();
    const searchTrimmed = searchTerm.trim();
    
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const student = {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
      
      let matches = false;
      
      // Search in all fields
      // 1. Full Name Arabic
      if (student.fullNameArabic && student.fullNameArabic.toLowerCase().includes(searchLower)) {
        matches = true;
      }
      
      // 2. Full Name English
      if (student.vehicleNameEnglish && student.vehicleNameEnglish.toLowerCase().includes(searchLower)) {
        matches = true;
      }
      
      // 3. Email
      if (student.email && student.email.toLowerCase().includes(searchLower)) {
        matches = true;
      }
      
      // 4. WhatsApp Number
      if (student.whatsappNumber && student.whatsappNumber.includes(searchTrimmed)) {
        matches = true;
      }
      
      // 5. National ID - special handling
      if (student.nationalID) {
        if (isNationalID) {
          // If search term is less than 14 digits, it must be a prefix
          if (searchTrimmed.length < 14) {
            if (student.nationalID.startsWith(searchTrimmed)) {
              matches = true;
            }
          } else if (searchTrimmed.length === 14) {
            // Exact match for 14 digits
            if (student.nationalID === searchTrimmed) {
              matches = true;
            }
          }
        } else {
          // If not numeric, search as text
          if (student.nationalID.includes(searchTrimmed)) {
            matches = true;
          }
        }
      }
      
      // 6. Diploma Type
      if (student.diplomaType && student.diplomaType.toLowerCase().includes(searchLower)) {
        matches = true;
      }
      
      // 7. Track
      if (student.track && student.track.toLowerCase().includes(searchLower)) {
        matches = true;
      }
      
      // 8. Diploma Year
      if (student.diplomaYear && student.diplomaYear.includes(searchTrimmed)) {
        matches = true;
      }
      
      // 9. Course
      if (student.course && student.course.toLowerCase().includes(searchLower)) {
        matches = true;
      }
      
      // 10. Address fields
      if (student.address) {
        if (student.address.governorate && student.address.governorate.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.city && student.address.city.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.street && student.address.street.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.building && student.address.building.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.siteNumber && student.address.siteNumber.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.landmark && student.address.landmark.toLowerCase().includes(searchLower)) {
          matches = true;
        }
      }
      
      if (matches) {
        allStudents.push(student);
      }
    });
    
    return allStudents;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء البحث');
  }
};

// Validate file type (images only for security)
const isValidImageType = (fileType: string): boolean => {
  const allowedTypes = ['JPEG', 'JPG', 'PNG', 'PDF'];
  return allowedTypes.includes(fileType.toUpperCase());
};

// Calculate document size in bytes (for debugging)
const calculateDocumentSize = (obj: any): number => {
  return new Blob([JSON.stringify(obj)]).size;
};

// Upload file to Cloudinary using direct API call with optimizations
export const uploadFileToCloudinary = async (file: UploadedFile, studentId: string, serviceId: string): Promise<string> => {
  try {
    // Security: Validate file type (images only)
    if (!isValidImageType(file.type)) {
      throw new Error(`نوع الملف غير مدعوم. الصيغ المقبولة: JPEG, PNG, PDF`);
    }

    let fileToUpload: File | Blob;
    
    // If we have the actual file object, use it directly
    if (file.file) {
      fileToUpload = file.file;
    } else {
      // Otherwise, convert base64 to blob (fallback for old data)
      const response = await fetch(file.url);
      fileToUpload = await response.blob();
    }
    
    // Create a unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const publicId = `serviceRequests/${studentId}/${serviceId}/${timestamp}_${sanitizedFileName}`;
    
    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', UPLOAD_PRESET); // Unsigned preset - secure, no API secret needed
    formData.append('public_id', publicId);
    formData.append('folder', 'serviceRequests');
    
    // Note: eager and flags parameters are not allowed with unsigned upload preset
    // Transformations will be applied via URL parameters when serving images
    
    // Upload to Cloudinary using fetch
    const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || 'فشل رفع الملف إلى Cloudinary';
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Apply transformations via URL for images (not PDFs)
    // This allows optimization without using eager parameter (which is not allowed with unsigned preset)
    let optimizedUrl = data.secure_url;
    if (file.type.toUpperCase() !== 'PDF') {
      // Apply transformations via URL: auto format, auto quality, max width 1200px
      // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v123456789/transformations/public_id.ext
      // We'll insert transformations after /upload/
      const uploadIndex = optimizedUrl.indexOf('/upload/');
      if (uploadIndex > 0) {
        // Insert transformations after /upload/
        optimizedUrl = optimizedUrl.substring(0, uploadIndex + 8) + 'w_1200,c_limit,q_auto,f_auto/' + optimizedUrl.substring(uploadIndex + 8);
      }
    }
    
    return optimizedUrl;
  } catch (error: any) {
    console.error('Error uploading file to Cloudinary:', error);
    throw new Error(error.message || 'حدث خطأ أثناء رفع الملف');
  }
};

// Service Request Functions
export const addServiceRequest = async (request: ServiceRequest): Promise<string> => {
  try {
    // Each service has its own collection
    const collectionName = `serviceRequests_${request.serviceId}`;
    const requestRef = doc(collection(db, collectionName));
    
    // Upload files to Cloudinary and get URLs
    let documentUrls: Array<{ name: string; url: string; size: number; type: string }> = [];
    
    if (request.documents && request.documents.length > 0) {
      const uploadPromises = request.documents.map(async (file) => {
        try {
          const url = await uploadFileToCloudinary(file, request.studentId, request.serviceId);
          return {
            name: file.name,
            url: url, // Cloudinary URL (optimized)
            size: file.size,
            type: file.type
          };
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          throw error;
        }
      });
      
      documentUrls = await Promise.all(uploadPromises);
    }
    
    // Prepare request data with only links (no base64, no sensitive data)
    const requestData = {
      ...request,
      id: requestRef.id,
      documents: documentUrls, // Only URLs and metadata - no base64 data
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Debug: Calculate document size before saving
    const documentSize = calculateDocumentSize(requestData);
    const maxSize = 1024 * 1024; // 1 MB limit
    
    if (documentSize > maxSize) {
      console.warn(`Document size (${(documentSize / 1024).toFixed(2)} KB) is large. Consider splitting data.`);
      // Still save, but log warning
    }
    
    console.log(`Saving document with size: ${(documentSize / 1024).toFixed(2)} KB`);
    
    // Save request - only links, no base64, optimized and secure
    await setDoc(requestRef, requestData);
    return requestRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء إضافة الطلب');
  }
};

export const getServiceRequests = async (studentId?: string): Promise<ServiceRequest[]> => {
  try {
    let q;
    if (studentId) {
      q = query(collection(db, 'serviceRequests'), where('studentId', '==', studentId));
    } else {
      q = query(collection(db, 'serviceRequests'));
    }
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as ServiceRequest;
    });
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب الطلبات');
  }
};

// Real-time listener for service requests
export const subscribeToServiceRequests = (
  studentId: string | null,
  callback: (requests: ServiceRequest[]) => void
): (() => void) => {
  // Subscribe to all service collections and merge results
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const unsubscribes: (() => void)[] = [];
  const allRequests: ServiceRequest[] = [];
  
  serviceIds.forEach(serviceId => {
    const collectionName = `serviceRequests_${serviceId}`;
    let q;
    if (studentId) {
      q = query(collection(db, collectionName), where('studentId', '==', studentId));
    } else {
      q = query(collection(db, collectionName));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: ServiceRequest[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as ServiceRequest;
      });
      
      // Update allRequests array - remove old requests for this service and add new ones
      const filteredRequests = allRequests.filter(r => r.serviceId !== serviceId);
      allRequests.length = 0;
      allRequests.push(...filteredRequests, ...requests);
      
      // Call callback with merged results
      callback([...allRequests]);
    }, (error) => {
      console.error(`Error in service requests subscription for ${serviceId}:`, error);
    });
    
    unsubscribes.push(unsubscribe);
  });
  
  // Return function to unsubscribe from all
  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
};

// Admin Functions
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', userId));
    if (adminDoc.exists()) {
      const data = adminDoc.data();
      return data.isAdmin === true;
    }
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

export const getAllServiceRequests = async (): Promise<ServiceRequest[]> => {
  try {
    const q = query(collection(db, 'serviceRequests'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as ServiceRequest;
    });
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب الطلبات');
  }
};

export const subscribeToAllServiceRequests = (
  callback: (requests: ServiceRequest[]) => void
): (() => void) => {
  // Subscribe to all service collections and merge results
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const unsubscribes: (() => void)[] = [];
  const allRequests: ServiceRequest[] = [];
  
  serviceIds.forEach(serviceId => {
    const collectionName = `serviceRequests_${serviceId}`;
    const q = query(collection(db, collectionName));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: ServiceRequest[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as ServiceRequest;
      });
      
      // Update allRequests array
      const existingIndex = allRequests.findIndex(r => r.serviceId === serviceId);
      if (existingIndex >= 0) {
        // Remove old requests for this service
        allRequests.splice(existingIndex, allRequests.filter(r => r.serviceId === serviceId).length);
      }
      // Add new requests
      allRequests.push(...requests);
      
      // Call callback with merged results
      callback([...allRequests]);
    }, (error) => {
      console.error(`Error in service requests subscription for ${serviceId}:`, error);
    });
    
    unsubscribes.push(unsubscribe);
  });
  
  // Return function to unsubscribe from all
  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
};

export const updateServiceRequestStatus = async (
  requestId: string,
  status: 'pending' | 'completed' | 'rejected',
  serviceId: string
): Promise<void> => {
  try {
    const collectionName = `serviceRequests_${serviceId}`;
    await setDoc(
      doc(db, collectionName, requestId),
      {
        status,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث حالة الطلب');
  }
};

// Book Service Configuration
export const getBookServiceConfig = async (): Promise<BookServiceConfig | null> => {
  try {
    const docRef = doc(db, 'config', 'bookService');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as BookServiceConfig;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات الكتب');
  }
};

export const updateBookServiceConfig = async (config: BookServiceConfig): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'config', 'bookService'),
      {
        ...config,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات الكتب');
  }
};

// Fees Service Configuration
export const getFeesServiceConfig = async (): Promise<FeesServiceConfig | null> => {
  try {
    const docRef = doc(db, 'config', 'feesService');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FeesServiceConfig;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات المصروفات');
  }
};

export const updateFeesServiceConfig = async (config: FeesServiceConfig): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'config', 'feesService'),
      {
        ...config,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات المصروفات');
  }
};

// Assignments Service Configuration
export const getAssignmentsServiceConfig = async (): Promise<AssignmentsServiceConfig | null> => {
  try {
    const docRef = doc(db, 'config', 'assignmentsService');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as AssignmentsServiceConfig;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات التكليفات');
  }
};

export const updateAssignmentsServiceConfig = async (config: AssignmentsServiceConfig): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'config', 'assignmentsService'),
      {
        ...config,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات التكليفات');
  }
};

// Certificates Service Configuration
export const getCertificatesServiceConfig = async (): Promise<CertificatesServiceConfig | null> => {
  try {
    console.log('Fetching certificates config from Firebase...');
    const docRef = doc(db, 'config', 'certificatesService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as CertificatesServiceConfig;
      console.log('Certificates config loaded:', {
        hasCertificates: !!data.certificates,
        certificatesCount: data.certificates?.length || 0,
        certificates: data.certificates?.map(c => ({
          id: c.id,
          name: c.name,
          hasImage: !!c.imageUrl,
          imageLength: c.imageUrl?.length || 0
        }))
      });
      return data;
    } else {
      console.log('Certificates config document does not exist');
      return null;
    }
  } catch (error: any) {
    console.error('Error fetching certificates config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات الشهادات');
  }
};

export const updateCertificatesServiceConfig = async (config: CertificatesServiceConfig): Promise<void> => {
  try {
    // Clean the config to remove undefined values
    const cleanConfig = {
      certificates: config.certificates.map(c => ({
        id: c.id,
        name: c.name,
        price: c.price,
        imageUrl: c.imageUrl || '',
        description: c.description || '',
        fields: c.fields || []
      })),
      paymentMethods: config.paymentMethods
    };

    console.log('Saving certificates config to Firebase:', {
      hasCertificates: !!cleanConfig.certificates,
      certificatesCount: cleanConfig.certificates?.length || 0,
      certificates: cleanConfig.certificates?.map(c => ({
        id: c.id,
        name: c.name,
        hasImage: !!c.imageUrl,
        imageLength: c.imageUrl?.length || 0
      }))
    });

    await setDoc(
      doc(db, 'config', 'certificatesService'),
      {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      },
      { merge: false } // استخدام merge: false للتأكد من الكتابة الكاملة
    );

    console.log('Certificates config saved to Firebase successfully');
  } catch (error: any) {
    console.error('Error saving certificates config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات الشهادات');
  }
};

