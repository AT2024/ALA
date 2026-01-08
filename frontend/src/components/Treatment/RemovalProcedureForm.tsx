import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import DiscrepancyClarificationSection, { DiscrepancyClarificationData } from './DiscrepancyClarificationSection';

interface RemovalProcedureFormProps {
  totalSourcesRemoved: number;
  insertedSources: number;
  onUpdate: (data: RemovalProcedureFormData) => void;
  topGeneralComment?: string;
  onTopGeneralCommentChange?: (comment: string) => void;
}

export interface RemovalProcedureFormData {
  removalDate: string;
  allSourcesSameDate: boolean | null;
  additionalRemovalDate?: string;
  reasonNotSameDate?: string;
  topGeneralComments?: string;
  removalGeneralComments?: string;
  discrepancyClarification?: DiscrepancyClarificationData;
}

const RemovalProcedureForm = ({
  totalSourcesRemoved,
  insertedSources,
  onUpdate,
  topGeneralComment = '',
  onTopGeneralCommentChange,
}: RemovalProcedureFormProps) => {
  const [removalDate, setRemovalDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [allSourcesSameDate, setAllSourcesSameDate] = useState<boolean | null>(null);
  const [additionalRemovalDate, setAdditionalRemovalDate] = useState<string>('');
  const [reasonNotSameDate, setReasonNotSameDate] = useState<string>('');
  const [generalComments, setGeneralComments] = useState<string>('');
  const [discrepancyClarification, setDiscrepancyClarification] = useState<DiscrepancyClarificationData | null>(null);

  // Auto-calculated values
  const sourcesNotRemoved = insertedSources - totalSourcesRemoved;
  const isRemovedEqualInserted = totalSourcesRemoved === insertedSources;

  // Notify parent of changes
  useEffect(() => {
    onUpdate({
      removalDate,
      allSourcesSameDate,
      additionalRemovalDate: !allSourcesSameDate ? additionalRemovalDate : undefined,
      reasonNotSameDate: !allSourcesSameDate ? reasonNotSameDate : undefined,
      topGeneralComments: topGeneralComment || undefined,
      removalGeneralComments: generalComments || undefined,
      discrepancyClarification: !isRemovedEqualInserted ? discrepancyClarification || undefined : undefined,
    });
  }, [removalDate, allSourcesSameDate, additionalRemovalDate, reasonNotSameDate, topGeneralComment, generalComments, discrepancyClarification, isRemovedEqualInserted]);

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
      <h2 className="text-lg font-medium">Removal Procedure Form</h2>

      {/* General Notes (Top) */}
      {onTopGeneralCommentChange && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <label className="block text-sm font-medium text-primary mb-1">
            General Notes
          </label>
          <textarea
            value={topGeneralComment}
            onChange={(e) => onTopGeneralCommentChange(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-primary/30 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Enter any general notes about the removal procedure..."
          />
        </div>
      )}

      {/* 1. Date of removal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          1. Date of removal procedure <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={removalDate}
          onChange={(e) => setRemovalDate(e.target.value)}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* 2. Total sources removed (AUTO) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          2. Total number of sources removed
        </label>
        <div className="px-3 py-2 bg-gray-100 rounded-md text-sm font-medium w-fit">
          {totalSourcesRemoved} <span className="text-gray-500">(auto-calculated)</span>
        </div>
      </div>

      {/* 3. All sources removed same date? */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          3. Were all sources removed on the same date? <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          <label className={`flex items-center p-3 rounded-lg border cursor-pointer ${
            allSourcesSameDate === true ? 'border-green-500 bg-green-50' : 'border-gray-200'
          }`}>
            <input
              type="radio"
              name="allSourcesSameDate"
              checked={allSourcesSameDate === true}
              onChange={() => setAllSourcesSameDate(true)}
              className="h-4 w-4 text-green-600 focus:ring-green-500"
            />
            <span className="ml-2 text-sm font-medium">Yes</span>
          </label>
          <label className={`flex items-center p-3 rounded-lg border cursor-pointer ${
            allSourcesSameDate === false ? 'border-red-500 bg-red-50' : 'border-gray-200'
          }`}>
            <input
              type="radio"
              name="allSourcesSameDate"
              checked={allSourcesSameDate === false}
              onChange={() => setAllSourcesSameDate(false)}
              className="h-4 w-4 text-red-600 focus:ring-red-500"
            />
            <span className="ml-2 text-sm font-medium">No</span>
          </label>
        </div>
      </div>

      {/* Conditional: If not same date */}
      {allSourcesSameDate === false && (
        <div className="pl-4 border-l-2 border-amber-300 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional removal date
            </label>
            <input
              type="date"
              value={additionalRemovalDate}
              onChange={(e) => setAdditionalRemovalDate(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason not all removed on same date
            </label>
            <textarea
              value={reasonNotSameDate}
              onChange={(e) => setReasonNotSameDate(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Please specify the reason..."
            />
          </div>
        </div>
      )}

      {/* 4. Removed = Inserted? (AUTO) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          4. Is the number of removed sources equal to the number of sources inserted?
        </label>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-md w-fit ${
          isRemovedEqualInserted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {isRemovedEqualInserted ? (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              <span className="font-medium">Yes ({totalSourcesRemoved} = {insertedSources})</span>
            </>
          ) : (
            <>
              <XCircleIcon className="w-5 h-5" />
              <span className="font-medium">No ({totalSourcesRemoved} ≠ {insertedSources})</span>
              <span className="text-sm">- {sourcesNotRemoved} sources not removed</span>
            </>
          )}
        </div>
      </div>

      {/* Discrepancy Clarification - shown when removed ≠ inserted */}
      {!isRemovedEqualInserted && (
        <DiscrepancyClarificationSection
          sourcesNotRemoved={sourcesNotRemoved}
          onUpdate={setDiscrepancyClarification}
        />
      )}

      {/* General Comments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          General comments
        </label>
        <textarea
          value={generalComments}
          onChange={(e) => setGeneralComments(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Add any general comments about the removal procedure..."
        />
      </div>
    </div>
  );
};

export default RemovalProcedureForm;
