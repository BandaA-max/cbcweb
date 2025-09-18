import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LessonFormData, LessonProgressionPlanRow, ResourceFile, SavedPlan } from './types';
import { generateLessonProgressionPlan } from './services/geminiService';
import { LessonForm } from './components/LessonForm';
import { LessonPlan } from './components/LessonTable';
import { HelpModal } from './components/HelpModal';
import { Icon } from './components/Icon';
import CorePrinciplesPage from './components/CorePrinciplesPage';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { UserProfilePage } from './components/UserProfilePage';

interface CurrentUser {
  name: string;
  email: string;
  generationCount: number;
}

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [formData, setFormData] = useState<LessonFormData>({
    teacherName: 'Mr. A. Banda',
    subject: 'Biology',
    topic: 'Photosynthesis',
    grade: 'Form 2',
    duration: '40',
    competencies: 'Learners should be able to explain the process of photosynthesis and its importance to life.',
    standards: 'By the end of the lesson, learners should be able to state the requirements for photosynthesis and write down its chemical equation.',
    activities: 'Observing a plant, watching a short video, drawing a diagram of the photosynthesis process, group discussions.',
    teachingStrategies: 'Question and Answer, Demonstration, Group Work',
    resources: 'Live potted plant, video clip, chart with diagram, notebooks.',
    tone: 'Formal',
  });
  const [planData, setPlanData] = useState<LessonProgressionPlanRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'generator' | 'principles'>('generator');
  const [resourceFile, setResourceFile] = useState<ResourceFile | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [isSavedPlansOpen, setIsSavedPlansOpen] = useState<boolean>(false);
  const savedPlansRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for an active session on component mount
    const userSessionEmail = localStorage.getItem('lesson_pro_session');
    if (userSessionEmail) {
      setIsAuthenticated(true);
      const users = JSON.parse(localStorage.getItem('lesson_pro_users') || '[]');
      const userData = users.find((u: any) => u.email === userSessionEmail);
       if (userData) {
        setCurrentUser({
          name: userData.name,
          email: userData.email,
          generationCount: userData.generationCount || 0,
        });
        setFormData(prev => ({ ...prev, teacherName: userData.name }));
      }
    }
     // Load saved plans from local storage
    const storedPlans = localStorage.getItem('saved_lesson_plans');
    if (storedPlans) {
      setSavedPlans(JSON.parse(storedPlans));
    }
  }, []);

  // Effect to handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (savedPlansRef.current && !savedPlansRef.current.contains(event.target as Node)) {
        setIsSavedPlansOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [savedPlansRef]);


  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const base64String = (loadEvent.target?.result as string).split(',')[1];
          if (base64String) {
            setResourceFile({
              name: file.name,
              type: file.type,
              data: base64String,
            });
          }
        };
        reader.readAsDataURL(file);
      } else {
        setResourceFile({
          name: file.name,
          type: file.type,
          data: file.name, // For non-images, data is just the name for the prompt
        });
      }
    }
    e.target.value = ''; // Reset input to allow re-selection of the same file
  }, []);

  const handleRemoveFile = useCallback(() => {
    setResourceFile(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (currentUser && currentUser.generationCount >= 2) {
      alert("You have reached your limit of 2 free lesson plans. Please upgrade your account to continue.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPlanData([]);
    try {
      const result = await generateLessonProgressionPlan(formData, resourceFile);
      setPlanData(result);

      if (currentUser) {
        const usersJSON = localStorage.getItem('lesson_pro_users');
        if (usersJSON) {
          const users = JSON.parse(usersJSON);
          const userIndex = users.findIndex((u: any) => u.email === currentUser.email);
          if (userIndex > -1) {
            const newCount = (users[userIndex].generationCount || 0) + 1;
            users[userIndex].generationCount = newCount;
            localStorage.setItem('lesson_pro_users', JSON.stringify(users));
            setCurrentUser(prevUser => prevUser ? { ...prevUser, generationCount: newCount } : null);
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, resourceFile, currentUser]);

  const handleLoginSuccess = (email: string) => {
    localStorage.setItem('lesson_pro_session', email);
    setIsAuthenticated(true);
    const users = JSON.parse(localStorage.getItem('lesson_pro_users') || '[]');
    const userData = users.find((u: any) => u.email === email);
    if (userData) {
      setCurrentUser({
        name: userData.name,
        email: userData.email,
        generationCount: userData.generationCount || 0,
      });
      setFormData(prev => ({...prev, teacherName: userData.name}));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lesson_pro_session');
    setIsAuthenticated(false);
    setShowLogin(false);
    setCurrentUser(null);
  };

   const handleSaveCurrentPlan = useCallback(() => {
    if (planData.length === 0) {
        alert("Cannot save an empty lesson plan.");
        return;
    }
    
    const newPlan: SavedPlan = {
      id: Date.now(),
      title: formData.topic || 'Untitled Plan',
      savedAt: new Date().toISOString(),
      formData,
      planData,
    };

    setSavedPlans(prevPlans => {
      const updatedPlans = [newPlan, ...prevPlans];
      localStorage.setItem('saved_lesson_plans', JSON.stringify(updatedPlans));
      return updatedPlans;
    });
  }, [formData, planData]);

  const handleLoadPlan = useCallback((id: number) => {
    const planToLoad = savedPlans.find(p => p.id === id);
    if (planToLoad) {
      setFormData(planToLoad.formData);
      setPlanData(planToLoad.planData);
      setIsSavedPlansOpen(false);
      setError(null);
    }
  }, [savedPlans]);

  const handleDeletePlan = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (window.confirm("Are you sure you want to delete this saved plan?")) {
      setSavedPlans(prevPlans => {
        const updatedPlans = prevPlans.filter(p => p.id !== id);
        localStorage.setItem('saved_lesson_plans', JSON.stringify(updatedPlans));
        return updatedPlans;
      });
    }
  }, []);

  const renderPage = () => {
    if (currentPage === 'principles') {
      return <CorePrinciplesPage onBack={() => setCurrentPage('generator')} />;
    }

    return (
      <div className="animate-fade-in">
        <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
                CBC Lesson Pro
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-600">
                Generate 5E model lesson plans aligned with Zambia's Competency-Based Curriculum.
            </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-12">
          <div className="lg:col-span-4">
            <LessonForm
              formData={formData}
              onFormChange={handleFormChange}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              resourceFile={resourceFile}
              onFileChange={handleFileChange}
              onRemoveFile={handleRemoveFile}
            />
          </div>
          <div className="lg:col-span-8">
            <LessonPlan
              data={planData}
              formData={formData}
              isLoading={isLoading}
              error={error}
              onRegenerate={handleSubmit}
              onSavePlan={handleSaveCurrentPlan}
            />
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    if (showLogin) {
      return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }
    return <LandingPage onNavigateToLogin={() => setShowLogin(true)} />;
  }

  const isExpired = currentUser && currentUser.generationCount >= 2;

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shadow-inner-custom">
                 <Icon name="logo" className="w-6 h-6 text-white"/>
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">CBC Lesson Pro</div>
            </div>
            <div className="flex items-center space-x-2">
               {!isExpired && (
                <button
                  onClick={() => setCurrentPage('principles')}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                >
                  <Icon name="book" className="w-5 h-5"/>
                  <span className="hidden sm:inline text-sm font-semibold">CBC Principles</span>
                </button>
               )}

               {!isExpired && (
                  <div className="relative" ref={savedPlansRef}>
                    <button
                      onClick={() => setIsSavedPlansOpen(prev => !prev)}
                      className="flex items-center space-x-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <Icon name="save" className="w-5 h-5"/>
                      <span className="hidden sm:inline text-sm font-semibold">Saved Plans</span>
                      {savedPlans.length > 0 && <span className="ml-1 text-xs bg-green-600 text-white rounded-full px-1.5 py-0.5">{savedPlans.length}</span>}
                    </button>

                    {isSavedPlansOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 z-30 animate-fade-in">
                        <div className="p-3 border-b font-semibold text-slate-800 text-sm">Saved Lesson Plans</div>
                        <ul className="py-1 max-h-80 overflow-y-auto">
                          {savedPlans.length > 0 ? (
                            savedPlans.map(plan => (
                              <li key={plan.id}>
                                <a
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); handleLoadPlan(plan.id); }}
                                  className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                >
                                  <div className="flex flex-col truncate">
                                    <span className="font-medium truncate">{plan.title}</span>
                                    <span className="text-xs text-slate-500">
                                      {new Date(plan.savedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => handleDeletePlan(plan.id, e)}
                                    className="ml-2 p-1.5 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 flex-shrink-0"
                                    title="Delete plan"
                                  >
                                    <Icon name="trash" className="w-4 h-4"/>
                                  </button>
                                </a>
                              </li>
                            ))
                          ) : (
                            <li className="px-4 py-3 text-sm text-slate-500 text-center">No saved plans yet.</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
               )}

              {!isExpired && (
                <button
                  onClick={() => setIsHelpModalOpen(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <Icon name="help" className="w-5 h-5"/>
                  <span className="hidden sm:inline text-sm font-semibold">5E Guide</span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 bg-transparent text-slate-600 rounded-lg hover:bg-slate-100 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Icon name="logout" className="w-5 h-5"/>
                <span className="hidden sm:inline text-sm font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        {isExpired && currentUser ? (
          <UserProfilePage user={currentUser} />
        ) : (
          renderPage()
        )}
      </main>

      <footer className="text-center py-5 bg-slate-800 text-slate-400 text-sm mt-8">
        <p>Developed by Banda Augustine - MSC CS, BaED ICT, DipEd Sci.</p>
        <p>&copy; {new Date().getFullYear()} SchoolPagesZM. All rights reserved.</p>
      </footer>

      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
    </div>
  );
};
