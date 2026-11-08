import { useState, useEffect } from 'react';
import {
  AssignmentsServiceConfig,
  AssignmentItem,
} from '../../../types';
import { classifyAssignment } from '../../../utils/assignmentClassifier';
import {
  getAssignmentsServiceConfig,
  updateAssignmentsServiceConfig,
} from '../../../services/firebaseService';

interface UseAssignmentsConfigOptions {
  setAssignmentsMessage: (msg: string | null) => void;
}

export const useAssignmentsConfig = ({
  setAssignmentsMessage,
}: UseAssignmentsConfigOptions) => {
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig>({
    serviceName: 'حل وتسليم تكليفات',
    assignments: [],
    paymentMethods: {
      instaPay: 'raoufpk97@instapay',
      cashWallet: '01050889591'
    }
  });
  const [newAssignmentName, setNewAssignmentName] = useState<string>('');
  const [newAssignmentPrice, setNewAssignmentPrice] = useState<string>('');
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editAssignmentName, setEditAssignmentName] = useState<string>('');
  const [editAssignmentPrice, setEditAssignmentPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load assignments config
  useEffect(() => {
    const loadAssignmentsConfig = async () => {
      try {
        const config = await getAssignmentsServiceConfig();
        if (config) {
          setAssignmentsConfig(config);
        }
      } catch (error) {
        console.error('Error loading assignments config:', error);
      }
    };
    loadAssignmentsConfig();
  }, []);

  const handleSaveAssignmentsConfig = async () => {
    if (!assignmentsConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(assignmentsConfig);
      setAssignmentsMessage('تم حفظ إعدادات التكليفات بنجاح');
      setTimeout(() => setAssignmentsMessage(null), 3000);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssignmentName.trim() || !newAssignmentPrice || !assignmentsConfig) return;
    const price = parseFloat(newAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      setAssignmentsMessage('يرجى إدخال سعر صحيح');
      return;
    }
    const cleanName = newAssignmentName.trim();
    const inferredType = classifyAssignment({ name: cleanName, price });

    const newAssignment: AssignmentItem = {
      id: `assignment_${Date.now()}`,
      name: cleanName,
      price: price,
      deliveryType: inferredType
    };
    const updatedConfig: AssignmentsServiceConfig = {
      ...assignmentsConfig,
      assignments: [...assignmentsConfig.assignments, newAssignment]
    };
    setAssignmentsConfig(updatedConfig);
    setNewAssignmentName('');
    setNewAssignmentPrice('');

    // حفظ فوري في قاعدة البيانات حتى لا يضيع التكليف عند إعادة التحميل
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(updatedConfig);
      setAssignmentsMessage('تم إضافة وحفظ التكليف بنجاح ✅');
      setTimeout(() => setAssignmentsMessage(null), 3500);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء حفظ التكليف');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!assignmentsConfig) return;
    const target = assignmentsConfig.assignments.find(a => a.id === id);
    if (!window.confirm(`هل أنت متأكد من حذف تكليف "${target?.name || ''}"؟`)) return;

    const updatedConfig: AssignmentsServiceConfig = {
      ...assignmentsConfig,
      assignments: assignmentsConfig.assignments.filter(a => a.id !== id)
    };
    setAssignmentsConfig(updatedConfig);

    // حفظ فوري في قاعدة البيانات
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(updatedConfig);
      setAssignmentsMessage('تم حذف التكليف وحفظ التغييرات بنجاح ✅');
      setTimeout(() => setAssignmentsMessage(null), 3500);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء حفظ التغييرات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditAssignment = (assignment: AssignmentItem) => {
    setEditingAssignmentId(assignment.id);
    setEditAssignmentName(assignment.name);
    setEditAssignmentPrice(String(assignment.price));
  };

  const handleCancelEditAssignment = () => {
    setEditingAssignmentId(null);
    setEditAssignmentName('');
    setEditAssignmentPrice('');
  };

  const handleSaveEditAssignment = async () => {
    if (!editingAssignmentId || !assignmentsConfig) return;
    if (!editAssignmentName.trim()) {
      setAssignmentsMessage('يرجى إدخال اسم التكليف');
      return;
    }
    const price = parseFloat(editAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      setAssignmentsMessage('يرجى إدخال سعر صحيح');
      return;
    }

    const cleanName = editAssignmentName.trim();
    const inferredType = classifyAssignment({ name: cleanName, price });

    const updatedAssignments = assignmentsConfig.assignments.map(a =>
      a.id === editingAssignmentId
        ? { ...a, name: cleanName, price: price, deliveryType: inferredType }
        : a
    );
    const updatedConfig: AssignmentsServiceConfig = {
      ...assignmentsConfig,
      assignments: updatedAssignments
    };

    setAssignmentsConfig(updatedConfig);
    setEditingAssignmentId(null);

    // حفظ فوري للتعديل في قاعدة البيانات
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(updatedConfig);
      setAssignmentsMessage('تم تعديل وحفظ بيانات وسعر التكليف بنجاح ✅');
      setTimeout(() => setAssignmentsMessage(null), 3500);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء حفظ التعديل');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    assignmentsConfig,
    setAssignmentsConfig,
    newAssignmentName,
    setNewAssignmentName,
    newAssignmentPrice,
    setNewAssignmentPrice,
    editingAssignmentId,
    setEditingAssignmentId,
    editAssignmentName,
    setEditAssignmentName,
    editAssignmentPrice,
    setEditAssignmentPrice,
    isSaving,
    handleSaveAssignmentsConfig,
    handleAddAssignment,
    handleRemoveAssignment,
    handleStartEditAssignment,
    handleCancelEditAssignment,
    handleSaveEditAssignment,
  };
};
