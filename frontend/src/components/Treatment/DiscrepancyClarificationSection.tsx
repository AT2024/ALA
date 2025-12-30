import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export interface DiscrepancyCategory {
  checked: boolean;
  amount: number;
  comment: string;
}

export interface DiscrepancyOther extends DiscrepancyCategory {
  description: string;
}

export interface DiscrepancyClarificationData {
  lost: DiscrepancyCategory;
  retrievedToSite: DiscrepancyCategory;
  removalFailure: DiscrepancyCategory;
  other: DiscrepancyOther;
}

interface DiscrepancyClarificationSectionProps {
  sourcesNotRemoved: number;
  onUpdate: (data: DiscrepancyClarificationData) => void;
}

interface CategoryRowProps {
  label: string;
  category: DiscrepancyCategory | DiscrepancyOther;
  setCategory: (cat: DiscrepancyCategory | DiscrepancyOther) => void;
  showDescription?: boolean;
}

// Moved outside parent component to prevent re-creation on each render
const CategoryRow = ({
  label,
  category,
  setCategory,
  showDescription = false,
}: CategoryRowProps) => (
  <div className={`p-3 rounded-lg border ${category.checked ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
    <label className="flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={category.checked}
        onChange={(e) => setCategory({ ...category, checked: e.target.checked })}
        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
      />
      <span className="ml-2 text-sm font-medium text-gray-900">{label}</span>
    </label>

    {category.checked && (
      <div className="mt-3 pl-6 space-y-2">
        {showDescription && (
          <input
            type="text"
            value={(category as DiscrepancyOther).description || ''}
            onChange={(e) => setCategory({ ...category, description: e.target.value })}
            placeholder="Specify..."
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        )}
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount</label>
            <input
              type="number"
              min="0"
              value={category.amount}
              onChange={(e) => setCategory({ ...category, amount: parseInt(e.target.value) || 0 })}
              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Comment</label>
            <input
              type="text"
              value={category.comment}
              onChange={(e) => setCategory({ ...category, comment: e.target.value })}
              placeholder="Add comment..."
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>
    )}
  </div>
);

const emptyCategory = (): DiscrepancyCategory => ({
  checked: false,
  amount: 0,
  comment: '',
});

const emptyOther = (): DiscrepancyOther => ({
  checked: false,
  amount: 0,
  comment: '',
  description: '',
});

const DiscrepancyClarificationSection = ({
  sourcesNotRemoved,
  onUpdate,
}: DiscrepancyClarificationSectionProps) => {
  const [lost, setLost] = useState<DiscrepancyCategory>(emptyCategory());
  const [retrievedToSite, setRetrievedToSite] = useState<DiscrepancyCategory>(emptyCategory());
  const [removalFailure, setRemovalFailure] = useState<DiscrepancyCategory>(emptyCategory());
  const [other, setOther] = useState<DiscrepancyOther>(emptyOther());

  // Calculate total
  const totalClarified =
    (lost.checked ? lost.amount : 0) +
    (retrievedToSite.checked ? retrievedToSite.amount : 0) +
    (removalFailure.checked ? removalFailure.amount : 0) +
    (other.checked ? other.amount : 0);

  const isValid = totalClarified === sourcesNotRemoved;

  // Notify parent
  useEffect(() => {
    onUpdate({ lost, retrievedToSite, removalFailure, other });
  }, [lost, retrievedToSite, removalFailure, other]);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4 space-y-4">
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-800">Discrepancy Details</h3>
          <p className="text-sm text-amber-700">
            {sourcesNotRemoved} source{sourcesNotRemoved !== 1 ? 's' : ''} not removed. Please clarify below.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <CategoryRow label="Lost" category={lost} setCategory={(cat) => setLost(cat as DiscrepancyCategory)} />
        <CategoryRow label="Retrieved to site" category={retrievedToSite} setCategory={(cat) => setRetrievedToSite(cat as DiscrepancyCategory)} />
        <CategoryRow label="Removal failure (remained in tissue)" category={removalFailure} setCategory={(cat) => setRemovalFailure(cat as DiscrepancyCategory)} />
        <CategoryRow label="Other" category={other} setCategory={(cat) => setOther(cat as DiscrepancyOther)} showDescription />
      </div>

      {/* Validation */}
      <div className={`flex items-center gap-2 p-3 rounded-md ${
        isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        <span className="text-sm font-medium">
          Total clarified: {totalClarified} / {sourcesNotRemoved}
        </span>
        {!isValid && (
          <span className="text-sm">
            - Must equal {sourcesNotRemoved}
          </span>
        )}
      </div>
    </div>
  );
};

export default DiscrepancyClarificationSection;
