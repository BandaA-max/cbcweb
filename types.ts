


export interface ResourceFile {
  name: string;
  type: string;
  data: string; // base64 for images, or file name for other types
}

export interface LessonFormData {
  teacherName: string;
  subject: string;
  topic: string;
  grade: string;
  duration: string;
  competencies: string;
  standards: string;
  activities: string;
  teachingStrategies: string;
  resources: string;
  tone: 'Formal' | 'Creative' | 'Technical';
}

export interface LessonProgressionPlanRow {
  stage: string;
  duration: string;
  teacherRole: string;
  learnerActivity: string;
  assessmentCriteria: string;
}

export interface SavedPlan {
  id: number;
  title: string;
  savedAt: string;
  formData: LessonFormData;
  planData: LessonProgressionPlanRow[];
}
