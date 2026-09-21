import type { LucideIcon } from 'lucide-react';
import {
  Newspaper,
  ClipboardList,
  BarChart2,
  Package,
  CreditCard,
  FileCheck,
  Award,
  Zap,
  Search,
  GraduationCap,
  Settings,
  Image,
  Users,
  MessageSquare,
  Bot,
  Brain,
  Database
} from 'lucide-react';

export type AdminTabId =
  | 'requests'
  | 'books'
  | 'fees'
  | 'certificates'
  | 'digitalTransformation'
  | 'digitalTransformationCodes'
  | 'electronicPaymentCodes'
  | 'finalReview'
  | 'graduationProject'
  | 'users'
  | 'news'
  | 'statistics'
  | 'services'
  | 'backgrounds'
  | 'whatsapp'
  | 'backup'
  | 'botTraining'
  | 'adminAssistant';

export type AdminNavItemId = AdminTabId | 'assignments';

export interface AdminNavItem {
  id: AdminNavItemId;
  label: string;
  icon: LucideIcon;
  kind: 'tab' | 'external';
}

export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

const ADMIN_NAVIGATION: AdminNavGroup[] = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    items: [
      { id: 'news', label: 'آخر الأخبار', icon: Newspaper, kind: 'tab' },
      { id: 'requests', label: 'جميع الطلبات', icon: ClipboardList, kind: 'tab' },
      { id: 'statistics', label: 'الإحصائيات والتقارير', icon: BarChart2, kind: 'tab' }
    ]
  },
  {
    id: 'services',
    label: 'الخدمات',
    items: [
      { id: 'books', label: 'كتب', icon: Package, kind: 'tab' },
      { id: 'fees', label: 'مصروفات', icon: CreditCard, kind: 'tab' },
      { id: 'assignments', label: 'تكليف', icon: FileCheck, kind: 'external' },
      { id: 'certificates', label: 'اونلاين', icon: Award, kind: 'tab' },
      { id: 'digitalTransformation', label: 'تحول', icon: Zap, kind: 'tab' },
      { id: 'digitalTransformationCodes', label: 'كود تحول', icon: Zap, kind: 'tab' },
      { id: 'electronicPaymentCodes', label: 'اكواد مصاريف', icon: CreditCard, kind: 'tab' },
      { id: 'finalReview', label: 'مراجعة', icon: Search, kind: 'tab' },
      { id: 'graduationProject', label: 'مشروع', icon: GraduationCap, kind: 'tab' },
      { id: 'services', label: 'إدارة الخدمات', icon: Settings, kind: 'tab' },
      { id: 'backgrounds', label: 'صور الخلفية', icon: Image, kind: 'tab' }
    ]
  },
  {
    id: 'users',
    label: 'المستخدمين',
    items: [
      { id: 'users', label: 'المستخدمين', icon: Users, kind: 'tab' }
    ]
  },
  {
    id: 'tools',
    label: 'الأدوات',
    items: [
      { id: 'whatsapp', label: 'الواتساب', icon: MessageSquare, kind: 'tab' },
      { id: 'adminAssistant', label: 'المساعد الذكي للاستعلامات', icon: Bot, kind: 'tab' },
      { id: 'botTraining', label: 'تدريب الشات بوت', icon: Brain, kind: 'tab' }
    ]
  },
  {
    id: 'system',
    label: 'النظام',
    items: [
      { id: 'backup', label: 'النسخ الاحتياطي والأرشيف', icon: Database, kind: 'tab' }
    ]
  }
];

export function getAdminNavigation(options: { showAssignments: boolean }): AdminNavGroup[] {
  return ADMIN_NAVIGATION
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.id !== 'assignments' || options.showAssignments)
    }))
    .filter((group) => group.items.length > 0);
}

export function findAdminNavGroupId(itemId: AdminNavItemId, groups: AdminNavGroup[]): string | undefined {
  return groups.find((group) => group.items.some((item) => item.id === itemId))?.id;
}

export const ADMIN_SIDEBAR_COLLAPSED_KEY = 'adminSidebarCollapsedV2';
export const ADMIN_NAV_OPEN_GROUPS_KEY = 'adminNavOpenGroups';
