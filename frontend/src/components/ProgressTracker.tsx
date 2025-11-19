import { useTreatment } from '@/context/TreatmentContext';

const ProgressTracker = () => {
  const {
    currentTreatment,
    progressStats,
    getActualTotalSeeds,
    getActualInsertedSeeds,
    getApplicatorTypeBreakdown
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

  const ApplicatorTypeIndicator = ({ seedCount, used, total }: {
    seedCount: number;
    used: number;
    total: number;
  }) => (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-purple-400" />
      <span className="text-sm text-gray-700">
        Applicator {seedCount} seeds: {used > 0 ? `${used}/${total} used` : total}
      </span>
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

        {/* Seed Progress - Now shows actual total seeds */}
        <ProgressBar
          current={actualInsertedSeeds}
          total={actualTotalSeeds}
          label="Seeds Inserted"
          color="bg-green-500"
        />

        {/* Show actual total seeds info */}
        {actualTotalSeeds > 0 && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Total Seeds Available:</span> {actualTotalSeeds} seeds
              {progressStats.totalApplicators > 0 && (
                <span className="block text-xs text-blue-600 mt-1">
                  From {progressStats.totalApplicators} applicators
                </span>
              )}
            </p>
          </div>
        )}

        {/* Usage Type Distribution - Updated to use status-based colors */}
        {progressStats.usedApplicators > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Usage Type Distribution</h4>
            <div className="grid grid-cols-1 gap-2">
              <UsageTypeIndicator
                type="Full Use (INSERTED)"
                count={progressStats.usageTypeDistribution.full}
                color="bg-green-400"
              />
              <UsageTypeIndicator
                type="Faulty (FAULTY/DISPOSED)"
                count={progressStats.usageTypeDistribution.faulty}
                color="bg-gray-700"
              />
              <UsageTypeIndicator
                type="No Use (SEALED)"
                count={progressStats.usageTypeDistribution.none}
                color="bg-gray-400"
              />
            </div>
          </div>
        )}

        {/* Applicator Type Breakdown */}
        {getApplicatorTypeBreakdown().length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Available Applicators by Type</h4>
            <div className="grid grid-cols-1 gap-2">
              {getApplicatorTypeBreakdown().map(({ seedCount, used, total }) => (
                <ApplicatorTypeIndicator
                  key={seedCount}
                  seedCount={seedCount}
                  used={used}
                  total={total}
                />
              ))}
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
              <p className="text-gray-500">Seeds Remaining</p>
              <p className="font-medium text-lg">{progressStats.seedsRemaining}</p>
            </div>
            <div>
              <p className="text-gray-500">Applicators Available</p>
              <p className="font-medium text-lg">{progressStats.applicatorsRemaining}</p>
            </div>
            <div>
              <p className="text-gray-500">Seeds Inserted</p>
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
              <span className="text-amber-600" title="Using order number (patient name not available)">
                Order: {currentTreatment.subjectId}
              </span>
            )}
          </p>
          <p>Type: {currentTreatment.type}</p>
          <p>Site: {currentTreatment.site}</p>
          <p>Expected Seeds: {actualTotalSeeds || 'N/A'}</p>
          <p>Actual Total Seeds: {actualInsertedSeeds || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;