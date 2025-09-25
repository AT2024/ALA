import { useNavigate, useLocation } from 'react-router-dom';
import { useTreatment } from '@/context/TreatmentContext';

export const useWorkflowNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { procedureType } = useTreatment();

  // Define separate workflows for each procedure type
  const WORKFLOWS = {
    insertion: [
      '/treatment/select',
      '/treatment/scan',
      '/treatment/applicator',
      '/treatment/list'
    ],
    removal: [
      '/treatment/select',
      '/treatment/removal'
    ]
  } as const;

  // Navigate while preserving procedure type in URL
  const navigateWithType = (path: string, type?: 'insertion' | 'removal') => {
    const procedureToUse = type || procedureType || 'insertion';
    navigate(`${path}?type=${procedureToUse}`);
  };

  // Workflow-aware back navigation
  const navigateBack = () => {
    const currentType = new URLSearchParams(location.search).get('type') as 'insertion' | 'removal' | null;
    const typeToUse = currentType || procedureType || 'insertion';
    const workflow = WORKFLOWS[typeToUse as keyof typeof WORKFLOWS] || WORKFLOWS.insertion;
    const currentIndex = workflow.indexOf(location.pathname as any);

    if (currentIndex > 0) {
      navigateWithType(workflow[currentIndex - 1]);
    } else {
      navigate('/procedure-type');
    }
  };

  // Workflow-aware next navigation
  const navigateNext = () => {
    const currentType = new URLSearchParams(location.search).get('type') as 'insertion' | 'removal' | null;
    const typeToUse = currentType || procedureType || 'insertion';
    const workflow = WORKFLOWS[typeToUse as keyof typeof WORKFLOWS] || WORKFLOWS.insertion;
    const currentIndex = workflow.indexOf(location.pathname as any);

    if (currentIndex >= 0 && currentIndex < workflow.length - 1) {
      navigateWithType(workflow[currentIndex + 1]);
    }
  };

  // Get current workflow steps
  const getCurrentWorkflow = () => {
    const currentType = new URLSearchParams(location.search).get('type') as 'insertion' | 'removal' | null;
    const typeToUse = currentType || procedureType || 'insertion';
    return WORKFLOWS[typeToUse as keyof typeof WORKFLOWS] || WORKFLOWS.insertion;
  };

  // Get current step info
  const getCurrentStepInfo = () => {
    const workflow = getCurrentWorkflow();
    const currentIndex = workflow.indexOf(location.pathname as any);
    const currentType = new URLSearchParams(location.search).get('type') || procedureType;

    return {
      currentStep: currentIndex >= 0 ? currentIndex + 1 : 0,
      totalSteps: workflow.length,
      procedureType: currentType,
      isInWorkflow: currentIndex >= 0
    };
  };

  return {
    navigateWithType,
    navigateBack,
    navigateNext,
    getCurrentWorkflow,
    getCurrentStepInfo
  };
};