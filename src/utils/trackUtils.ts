
export const ACADEMIC_COLLEGES = [
    'آداب',
    'دار علوم',
    'دراسات اسلاميه',
    'اصول دين',
    'السن',
    'علوم',
    'لغات و ترجمة',
    'تربية', // Often considered academic, adding for safety if present
    'بنات'  // Faculty of Girls (Ain Shams) often academic
];

export const TRACK_TWO_DEPARTMENTS = {
    studies: ['عربي', 'شريعة', 'اصول دين'],
    arabic: ['دراسات', 'تاريخ', 'جغرافيا'],
    science: ['رياضيات'],
    math: ['علوم', 'كيمياء', 'فيزياء', 'بيولوجي'],
    english: ['انجليزي']
};

export const GOOD_GRADES = [
    'امتياز مع مرتبه الشرف',
    'امتياز',
    'جيد جدا',
    'جيد مرتفع',
    'جيد'
];

export const ACCEPTABLE_GRADE = 'مقبول';

export const HIGH_INSTITUTE_KEYWORD = 'معهد';

export const calculateTrack = (college: string | undefined, department: string | undefined, grade: string | undefined): string | null => {
    if (!college || !department || !grade) {
        return null;
    }

    // Normalize inputs just in case
    const normCollege = college.trim();
    const normDept = department.trim();
    const normGrade = grade.trim();

    // Rule 2: High Institute + Acceptable -> Track 1
    if (normCollege.includes(HIGH_INSTITUTE_KEYWORD) && normGrade === ACCEPTABLE_GRADE) {
        return 'الأولى';
    }

    // Rule 3: Academic + Good or higher -> Track 3
    const isAcademic = ACADEMIC_COLLEGES.some(c => normCollege.includes(c));
    const isGoodOrHigher = GOOD_GRADES.includes(normGrade);

    if (isAcademic && isGoodOrHigher) {
        return 'الثالثة';
    }

    // Rule 4: Acceptable + Specific Departments -> Track 2
    if (normGrade === ACCEPTABLE_GRADE) {
        // Check Track 2 Mappings
        const allTrack2Depts = [
            ...TRACK_TWO_DEPARTMENTS.studies,
            ...TRACK_TWO_DEPARTMENTS.arabic,
            ...TRACK_TWO_DEPARTMENTS.science,
            ...TRACK_TWO_DEPARTMENTS.math,
            ...TRACK_TWO_DEPARTMENTS.english
        ];

        if (allTrack2Depts.some(d => normDept.includes(d))) {
            return 'الثانية';
        }
    }

    // Rule 5: Else -> Track 1
    return 'الأولى';
};

export const getAvailableTracks = (calculatedTrack: string | null): string[] => {
    if (!calculatedTrack) return ['الأولى', 'الثانية', 'الثالثة'];

    // Allow editing from current to lower ONLY
    // Order: الأولى (Low) < الثانية < الثالثة (High)
    if (calculatedTrack === 'الثالثة') return ['الثالثة', 'الثانية', 'الأولى'];
    if (calculatedTrack === 'الثانية') return ['الثانية', 'الأولى'];
    return ['الأولى'];
};
