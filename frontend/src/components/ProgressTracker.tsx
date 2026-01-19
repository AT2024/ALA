import { useTreatment } from '@/context/TreatmentContext';

const ProgressTracker = () => {
  const {
    currentTreatment,
    progressStats,
    getActualTotalSeeds,
    getActualInsertedSeeds,
    getApplicatorSummary,
    isPancreasOrProstate
  } = useTreatment();

  if (!currentTreatment) {
    return null;
  }
  const actualTotalSeeds = getActualTotalSeeds();
  const actualInsertedSeeds = getActualInsertedSeeds();

  const ProgressBar = ({ current, total, label, color = 'bg-blue-500' }: {
    current: number;
    total: number;
    label: string;
    color?: string;
  }) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">{current} / {total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 text-right">
          {percentage.toFixed(1)}% Complete
        </div>
      </div>
    );
  };

  const UsageTypeIndicator = ({ type, count, color }: {
    type: string;
    count: number;
    color: string;
  }) => (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm text-gray-700">{type}: {count}</span>
    </div>
  );


  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-medium mb-4">Treatment Progress</h3>
      
      <div className="space-y-6">
        {/* Applicator Progress */}
        <ProgressBar
          current={progressStats.usedApplicators}
          total={progressStats.totalApplicators}
          label="Applicators Processed"
          color="bg-blue-500"
        />

        {/* Source Progress - Now shows actual total sources */}
        <ProgressBar
          current={actualInsertedSeeds}
          total={actualTotalSeeds}
          label="Sources Inserted"
          color="bg-green-500"
        />

        {/* Show actual total sources info */}
        {actualTotalSeeds > 0 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Total Sources Available:</span> {actualTotalSeeds} sources
              {progressStats.totalApplicators > 0 && (
                <span className="block text-xs text-blue-600 mt-1">
                  From {progressStats.totalApplicators} applicators
                </span>
              )}
            </p>
          </div>
        )}

        {/* Status Distribution - Uses 8-state workflow status labels */}
        {progressStats.usedApplicators > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Status Distribution</h4>
            <div className="grid grid-cols-1 gap-2">
              {/* Show all 8 statuses with count > 0 */}
              {progressStats.usageTypeDistribution.sealed > 0 && (
                <UsageTypeIndicator type="SEALED" count={progressStats.usageTypeDistribution.sealed} color="bg-gray-400" />
              )}
              {progressStats.usageTypeDistribution.opened > 0 && (
                <UsageTypeIndicator type="OPENED" count={progressStats.usageTypeDistribution.opened} color="bg-blue-400" />
              )}
              {progressStats.usageTypeDistribution.loaded > 0 && (
                <UsageTypeIndicator type="LOADED" count={progressStats.usageTypeDistribution.loaded} color="bg-purple-400" />
              )}
              {progressStats.usageTypeDistribution.inserted > 0 && (
                <UsageTypeIndicator type="INSERTED" count={progressStats.usageTypeDistribution.inserted} color="bg-green-500" />
              )}
              {progressStats.usageTypeDistribution.faulty > 0 && (
                <UsageTypeIndicator type="FAULTY" count={progressStats.usageTypeDistribution.faulty} color="bg-red-500" />
              )}
              {progressStats.usageTypeDistribution.disposed > 0 && (
                <UsageTypeIndicator type="DISPOSED" count={progressStats.usageTypeDistribution.disposed} color="bg-gray-600" />
              )}
              {progressStats.usageTypeDistribution.discharged > 0 && (
                <UsageTypeIndicator type="DISCHARGED" count={progressStats.usageTypeDistribution.discharged} color="bg-yellow-500" />
              )}
              {progressStats.usageTypeDistribution.deploymentFailure > 0 && (
                <UsageTypeIndicator type="DEPLOYMENT FAILURE" count={progressStats.usageTypeDistribution.deploymentFailure} color="bg-orange-500" />
              )}
            </div>
          </div>
        )}

        {/* Applicator Summary Table */}
        {getApplicatorSummary().length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Applicator Summary</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Inserted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Available
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Loaded
                    </th>
                    {/* Only show Package column for Pancreas/Prostate procedures */}
                    {isPancreasOrProstate() && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Package
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {getApplicatorSummary().map((item) => (
                    <tr key={item.seedQuantity}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {item.seedQuantity} source{item.seedQuantity !== 1 ? 's' : ''}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {item.inserted}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {item.available}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {item.loaded}
                      </td>
                      {/* Only show Package cell for Pancreas/Prostate procedures */}
                      {isPancreasOrProstate() && (
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {Math.floor(item.packaged / 4)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Completion Stats */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Completion</p>
              <p className="font-medium text-lg">{progressStats.completionPercentage}%</p>
            </div>
            <div>
              <p className="text-gray-500">Sources Remaining</p>
              <p className="font-medium text-lg">{progressStats.seedsRemaining}</p>
            </div>
            <div>
              <p className="text-gray-500">Applicators Available</p>
              <p className="font-medium text-lg">{progressStats.applicatorsRemaining}</p>
            </div>
            <div>
              <p className="text-gray-500">Sources Inserted</p>
              <p className="font-medium text-lg">{actualInsertedSeeds}</p>
            </div>
          </div>
        </div>

        {/* Treatment Info */}
        <div className="text-xs text-gray-500 border-t pt-3">
          <p>
            Patient: {currentTreatment.patientName ? (
              <span>{currentTreatment.patientName}</span>
            ) : (
              <span className="text-amber-600" title="Patient name not available from Priority">
                {currentTreatment.subjectId}
              </span>
            )}
          </p>
          <p>Type: {currentTreatment.type}</p>
          <p>Site: {currentTreatment.site}</p>
          <p>Expected Sources: {actualTotalSeeds || 'N/A'}</p>
          <p>Actual Total Sources: {actualInsertedSeeds || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;