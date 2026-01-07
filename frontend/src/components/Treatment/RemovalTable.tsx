import { MinusIcon } from '@heroicons/react/24/outline';
import { ApplicatorGroup } from '@/context/TreatmentContext';

interface RemovalTableProps {
  applicatorGroups: ApplicatorGroup[];
  individualSeedsRemoved: number;
  maxIndividualSeeds: number;
  totalSources: number;
  totalRemoved: number;
  onRemoveFromGroup: (group: ApplicatorGroup) => void;
  onRemoveIndividualSeed: () => void;
  onResetIndividualSeeds: () => void;
  groupComments: Record<number, string>;
  onGroupCommentChange: (seedCount: number, comment: string) => void;
  individualSeedComment: string;
  onIndividualSeedCommentChange: (comment: string) => void;
}

const RemovalTable = ({
  applicatorGroups,
  individualSeedsRemoved,
  maxIndividualSeeds,
  totalSources,
  totalRemoved,
  onRemoveFromGroup,
  onRemoveIndividualSeed,
  onResetIndividualSeeds,
  groupComments,
  onGroupCommentChange,
  individualSeedComment,
  onIndividualSeedCommentChange,
}: RemovalTableProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium text-gray-700">Applicator Removal Tracking</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Group
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Total Sources
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Removed
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Progress
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Comment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {/* Applicator Groups */}
            {applicatorGroups.map((group) => {
              const groupTotalSources = group.totalApplicators * group.seedCount;
              const groupRemovedSources = group.removedApplicators * group.seedCount;
              const progress = group.totalApplicators > 0
                ? Math.round((group.removedApplicators / group.totalApplicators) * 100)
                : 0;
              const isComplete = group.removedApplicators >= group.totalApplicators;

              return (
                <tr key={group.seedCount} className={isComplete ? 'bg-green-50' : ''}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {group.totalApplicators} applicator{group.totalApplicators !== 1 ? 's' : ''} x {group.seedCount} source{group.seedCount !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                    {groupTotalSources}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                    {groupRemovedSources}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isComplete ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onRemoveFromGroup(group)}
                      disabled={isComplete}
                      className="rounded-full p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isComplete ? 'All applicators removed' : 'Remove one applicator'}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <textarea
                      value={groupComments[group.seedCount] || ''}
                      onChange={(e) => onGroupCommentChange(group.seedCount, e.target.value)}
                      rows={2}
                      className="w-full min-w-[150px] rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Add comment..."
                    />
                  </td>
                </tr>
              );
            })}

            {/* Individual Seeds Row */}
            {maxIndividualSeeds > 0 && (
              <tr className={individualSeedsRemoved >= maxIndividualSeeds ? 'bg-green-50' : ''}>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Individual sources
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                  {maxIndividualSeeds}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                  {individualSeedsRemoved}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          individualSeedsRemoved >= maxIndividualSeeds ? 'bg-green-600' : 'bg-orange-500'
                        }`}
                        style={{ width: `${maxIndividualSeeds > 0 ? (individualSeedsRemoved / maxIndividualSeeds) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10">
                      {maxIndividualSeeds > 0 ? Math.round((individualSeedsRemoved / maxIndividualSeeds) * 100) : 0}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={onRemoveIndividualSeed}
                    disabled={individualSeedsRemoved >= maxIndividualSeeds}
                    className="rounded-full p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={individualSeedsRemoved >= maxIndividualSeeds ? 'All individual sources removed' : 'Remove one individual source'}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                </td>
                <td className="px-4 py-4">
                  <textarea
                    value={individualSeedComment}
                    onChange={(e) => onIndividualSeedCommentChange(e.target.value)}
                    rows={2}
                    className="w-full min-w-[150px] rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Add comment..."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <div className={`text-sm font-medium ${
          totalRemoved === totalSources ? 'text-green-600' : 'text-gray-700'
        }`}>
          Total: {totalRemoved} / {totalSources} sources removed
        </div>
        {individualSeedsRemoved > 0 && (
          <button
            onClick={onResetIndividualSeeds}
            className="text-xs text-orange-600 hover:text-orange-800 underline"
          >
            Reset individual sources
          </button>
        )}
      </div>
    </div>
  );
};

export default RemovalTable;
