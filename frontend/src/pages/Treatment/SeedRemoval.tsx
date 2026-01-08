import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useTreatment, ApplicatorGroup } from '@/context/TreatmentContext';
import { treatmentService, Applicator } from '@/services/treatmentService';
import IndividualSeedReasonModal from '@/components/Dialogs/IndividualSeedReasonModal';
import RemovalProcedureForm, { RemovalProcedureFormData } from '@/components/Treatment/RemovalProcedureForm';
import RemovalTable from '@/components/Treatment/RemovalTable';
import SignatureModal from '@/components/Dialogs/SignatureModal';

// Type for individual source removal notes
interface IndividualSeedNote {
  reason: string;
  timestamp: string;
  count: number;
}

const SeedRemoval = () => {
  const navigate = useNavigate();
  const {
    currentTreatment,
    applicators,
    setApplicators,
    updateApplicator,
    totalSeeds,
    getApplicatorGroups,
    getRemovalProgress,
    setIndividualSeedsRemoved,
    getIndividualSeedsRemoved
  } = useTreatment();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [individualSeedNotes, setIndividualSeedNotes] = useState<IndividualSeedNote[]>([]);
  const [removalProcedureData, setRemovalProcedureData] = useState<RemovalProcedureFormData | null>(null);
  const [topGeneralComment, setTopGeneralComment] = useState('');
  const [groupComments, setGroupComments] = useState<Record<number, string>>({});
  const [individualSeedComment, setIndividualSeedComment] = useState('');

  // Get data from context methods
  const applicatorGroups = getApplicatorGroups();
  const removalProgress = getRemovalProgress();
  const individualSeedsRemoved = getIndividualSeedsRemoved();
  const daysSinceInsertion = currentTreatment?.daysSinceInsertion || 0;

  // Destructure removal progress for easier access
  const {
    totalSeeds: progressTotalSeeds,
    effectiveTotalSeeds,
    effectiveRemovedSeeds
  } = removalProgress;

  useEffect(() => {
    if (!currentTreatment) {
      navigate('/treatment/select');
      return;
    }

    if (currentTreatment.type !== 'removal') {
      navigate('/treatment/select');
      return;
    }

    // If no applicators in state, fetch them from the server
    if (applicators.length === 0) {
      fetchApplicators();
    }
  }, [currentTreatment, applicators.length]);

  const fetchApplicators = async () => {
    if (!currentTreatment) return;

    setLoading(true);
    setError(null);

    try {
      const data = await treatmentService.getApplicators(currentTreatment.id);

      // Update the context with the fetched applicators
      if (data && data.length > 0) {
        setApplicators(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch applicators');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRemoval = async (applicator: Applicator) => {
    if (!currentTreatment) return;

    try {
      const updatedApplicator = {
        ...applicator,
        isRemoved: !applicator.isRemoved,
        removalTime: !applicator.isRemoved ? new Date().toISOString() : null,
      };

      // Update in backend
      await treatmentService.updateApplicator(
        currentTreatment.id,
        applicator.id,
        updatedApplicator
      );

      // Update in state
      updateApplicator(applicator.id, updatedApplicator);
    } catch (err: any) {
      setError(err.message || 'Failed to update applicator');
    }
  };

  const handleRemoveApplicatorGroup = async (group: ApplicatorGroup) => {
    if (!currentTreatment) return;

    try {
      // Find the first non-removed applicator in the group and mark it as removed
      const nextApplicatorToRemove = group.applicators.find(app => !app.isRemoved);
      if (nextApplicatorToRemove) {
        await handleToggleRemoval(nextApplicatorToRemove);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove applicator from group');
    }
  };

  const handleRemoveIndividualSeed = () => {
    setShowReasonModal(true);
  };

  const handleReasonConfirm = (reason: string) => {
    const note: IndividualSeedNote = {
      reason,
      timestamp: new Date().toISOString(),
      count: 1,
    };
    setIndividualSeedNotes(prev => [...prev, note]);
    setIndividualSeedsRemoved(individualSeedsRemoved + 1);
    setShowReasonModal(false);
  };

  const handleResetIndividualSeeds = () => {
    setIndividualSeedsRemoved(0);
    setIndividualSeedNotes([]);
  };

  const handleGroupCommentChange = (seedCount: number, comment: string) => {
    setGroupComments(prev => ({ ...prev, [seedCount]: comment }));
  };

  const handleCompleteTreatment = async () => {
    if (!currentTreatment || !removalProcedureData) {
      setError('Please fill in the removal procedure form');
      return;
    }

    // Validate required fields
    if (!removalProcedureData.removalDate) {
      setError('Please select a removal date');
      return;
    }
    if (removalProcedureData.allSourcesSameDate === null) {
      setError('Please indicate if all sources were removed on the same date');
      return;
    }

    // Validate discrepancy clarification if there's a mismatch
    const insertedSources = currentTreatment.seedQuantity || totalSeeds;
    if (effectiveRemovedSeeds !== insertedSources) {
      if (!removalProcedureData.discrepancyClarification) {
        setError('Please clarify the discrepancy between removed and inserted sources');
        return;
      }

      // Validate that discrepancy amounts sum correctly
      const clarification = removalProcedureData.discrepancyClarification;
      const totalClarified =
        (clarification.lost.checked ? clarification.lost.amount : 0) +
        (clarification.retrievedToSite.checked ? clarification.retrievedToSite.amount : 0) +
        (clarification.removalFailure.checked ? clarification.removalFailure.amount : 0) +
        (clarification.other.checked ? clarification.other.amount : 0);

      const sourcesNotRemoved = insertedSources - effectiveRemovedSeeds;
      if (totalClarified !== sourcesNotRemoved) {
        setError(`Discrepancy clarification total (${totalClarified}) must equal sources not removed (${sourcesNotRemoved})`);
        return;
      }
    }

    setIsCompleting(true);
    setError(null);

    try {
      // Save removal procedure data first
      await treatmentService.updateRemovalProcedure(currentTreatment.id, {
        removalDate: removalProcedureData.removalDate,
        allSourcesSameDate: removalProcedureData.allSourcesSameDate ?? false,
        additionalRemovalDate: removalProcedureData.additionalRemovalDate,
        reasonNotSameDate: removalProcedureData.reasonNotSameDate,
        discrepancyClarification: removalProcedureData.discrepancyClarification,
        individualSeedsRemoved: individualSeedsRemoved,
        individualSeedNotes: individualSeedNotes,
        topGeneralComments: removalProcedureData.topGeneralComments,
        removalGeneralComments: removalProcedureData.removalGeneralComments,
        groupComments: groupComments,
        individualSeedComment: individualSeedComment,
      });

      // Show signature modal for finalization
      setShowSignatureModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save removal procedure data');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSignatureSuccess = () => {
    setShowSignatureModal(false);
    navigate('/treatment/select');
  };

  if (!currentTreatment) {
    return (
      <Layout title='Source Removal' showBackButton>
        <div className='flex items-center justify-center py-10'>
          <p>No treatment selected. Please select a treatment first.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title='Source Removal' showBackButton backPath='/treatment/select'>
      <div className='space-y-6'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Treatment Information</h2>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
            <div>
              <p className='text-sm text-gray-500'>Patient ID</p>
              {currentTreatment.patientName ? (
                <p className='font-medium'>{currentTreatment.patientName}</p>
              ) : (
                <p className='font-medium text-amber-600' title="Using order number (patient name not available)">
                  Order: {currentTreatment.subjectId}
                </p>
              )}
            </div>
            <div>
              <p className='text-sm text-gray-500'>Date of Insertion</p>
              <p className='font-medium'>{new Date(currentTreatment.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Total Sources</p>
              <p className='font-medium'>{currentTreatment.seedQuantity || totalSeeds}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Total Activity</p>
              <p className='font-medium'>
                {currentTreatment.activityPerSeed && currentTreatment.seedQuantity
                  ? (currentTreatment.activityPerSeed * currentTreatment.seedQuantity).toFixed(1)
                  : 'N/A'} mCi
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Surgeon</p>
              <p className='font-medium'>{currentTreatment.surgeon || 'N/A'}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Site</p>
              <p className='font-medium'>{currentTreatment.site}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Days Since Insertion</p>
              <p className='font-medium text-primary'>{daysSinceInsertion} days</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Type</p>
              <p className='font-medium capitalize'>{currentTreatment.type}</p>
            </div>
          </div>

          {daysSinceInsertion > 0 && (
            <div className='mt-4 rounded-md bg-primary/10 p-3'>
              <p className='text-sm text-primary'>
                <span className='font-medium'>Note:</span> Sources have been in place for {daysSinceInsertion} day{daysSinceInsertion !== 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </div>

        {error && <div className='rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='text-lg font-medium mb-4'>Source Removal Tracking</h2>

          {loading && (
            <div className='flex justify-center py-8'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
            </div>
          )}

          {!loading && (
            <RemovalTable
              applicatorGroups={applicatorGroups}
              individualSeedsRemoved={individualSeedsRemoved}
              maxIndividualSeeds={currentTreatment.seedQuantity || progressTotalSeeds}
              totalSources={effectiveTotalSeeds}
              totalRemoved={effectiveRemovedSeeds}
              onRemoveFromGroup={handleRemoveApplicatorGroup}
              onRemoveIndividualSeed={handleRemoveIndividualSeed}
              onResetIndividualSeeds={handleResetIndividualSeeds}
              groupComments={groupComments}
              onGroupCommentChange={handleGroupCommentChange}
              individualSeedComment={individualSeedComment}
              onIndividualSeedCommentChange={setIndividualSeedComment}
            />
          )}
        </div>

        {/* Removal Procedure Form - Summary at bottom after seed tracking */}
        <RemovalProcedureForm
          totalSourcesRemoved={effectiveRemovedSeeds}
          insertedSources={currentTreatment?.seedQuantity || totalSeeds}
          onUpdate={setRemovalProcedureData}
          topGeneralComment={topGeneralComment}
          onTopGeneralCommentChange={setTopGeneralComment}
        />

        {/* Complete Treatment Button */}
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='flex items-center justify-between'>
            <div
              className={`text-lg font-medium ${
                effectiveRemovedSeeds === effectiveTotalSeeds ? 'text-green-600' : 'text-red-600'
              }`}>
              Total: {effectiveRemovedSeeds} / {effectiveTotalSeeds} Sources Removed
            </div>
            <button
              onClick={handleCompleteTreatment}
              disabled={isCompleting || loading}
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50'>
              {isCompleting
                ? 'Completing...'
                : effectiveRemovedSeeds === effectiveTotalSeeds
                  ? 'Complete Treatment'
                  : 'Complete with Missing Sources'}
            </button>
          </div>
        </div>
      </div>

      {/* Individual Source Reason Modal */}
      <IndividualSeedReasonModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={handleReasonConfirm}
      />

      {/* Signature Modal for Treatment Finalization */}
      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        treatmentId={currentTreatment?.id || ''}
        treatmentSite={currentTreatment?.site || ''}
        onSuccess={handleSignatureSuccess}
      />
    </Layout>
  );
};

export default SeedRemoval;
