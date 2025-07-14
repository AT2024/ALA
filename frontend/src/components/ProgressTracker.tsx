import React from 'react';
import { useTreatment } from '@/context/TreatmentContext';

const ProgressTracker = () => {
  const { currentTreatment, progressStats, getApplicatorProgress, getSeedProgress } = useTreatment();

  if (!currentTreatment) {
    return null;
  }

  const applicatorProgress = getApplicatorProgress();
  const seedProgress = getSeedProgress();

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
          current={applicatorProgress.used}
          total={applicatorProgress.total}
          label="Applicators Used"
          color="bg-blue-500"
        />

        {/* Seed Progress */}
        <ProgressBar
          current={seedProgress.inserted}
          total={seedProgress.total}
          label="Seeds Inserted"
          color="bg-green-500"
        />

        {/* Usage Type Distribution */}
        {applicatorProgress.used > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Usage Type Distribution</h4>
            <div className="grid grid-cols-1 gap-2">
              <UsageTypeIndicator 
                type="Full Use" 
                count={progressStats.usageTypeDistribution.full}
                color="bg-green-400"
              />
              <UsageTypeIndicator 
                type="Faulty" 
                count={progressStats.usageTypeDistribution.faulty}
                color="bg-yellow-400"
              />
              <UsageTypeIndicator 
                type="No Use" 
                count={progressStats.usageTypeDistribution.none}
                color="bg-red-400"
              />
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
              <p className="text-gray-500">Applicators Left</p>
              <p className="font-medium text-lg">{progressStats.applicatorsRemaining}</p>
            </div>
            <div>
              <p className="text-gray-500">Total Inserted</p>
              <p className="font-medium text-lg">{progressStats.insertedSeeds}</p>
            </div>
          </div>
        </div>

        {/* Treatment Info */}
        <div className="text-xs text-gray-500 border-t pt-3">
          <p>Patient: {currentTreatment.subjectId}</p>
          <p>Type: {currentTreatment.type}</p>
          <p>Site: {currentTreatment.site}</p>
          <p>Expected Seeds: {currentTreatment.seedQuantity || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;