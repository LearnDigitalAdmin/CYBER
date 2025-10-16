import { Building2, Printer, DollarSign, Download, AlertCircle, Loader } from "lucide-react";
import { useState, useEffect } from "react";
import { cyberService, type IncomeData } from "../../services/Cyber";
import { useAuth } from "../../context/authContext"; // Adjust path as needed

interface BarData {
  date: string;
  plotYangu: number;
  cyber: number;
  total: number;
}

const StatCard = ({ 
  icon, 
  value, 
  trend, 
  color, 
  label = '' 
}: { 
  icon: any; 
  value: any; 
  trend: any; 
  color: any; 
  label?: any 
}) => {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500 to-cyan-600',
    emerald: 'from-emerald-500 to-emerald-600',
    violet: 'from-violet-500 to-violet-600',
    amber: 'from-amber-500 to-amber-600'
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5 hover:border-cyan-500/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 bg-gradient-to-br ${colorClasses[color]} rounded-lg text-white shadow-lg`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
          {trend}
        </span>
      </div>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
};

const IncomeTab = () => {
  const { currentUser } = useAuth();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [incomeData, setIncomeData] = useState<IncomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<BarData[]>([]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setError("User not authenticated");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = cyberService.subscribeToIncomeData(
      currentUser.uid,
      period,
      (data) => {
        setIncomeData(data);
        setError(null);
        generateDailyBreakdown(data, period);
        setLoading(false);
      },
      (err) => {
        console.error("Income data error:", err);
        setError("Failed to load income data");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [period, currentUser?.uid]);

  const generateDailyBreakdown = (data: IncomeData, period: 'today' | 'week' | 'month') => {
    const breakdown: BarData[] = [];
    const today = new Date();
    let daysToShow = 1;

    if (period === 'week') daysToShow = 7;
    if (period === 'month') daysToShow = 30;

    // Create array of dates
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

      // Filter records by date
      const cyberForDate = data.records.cyber.filter(r => {
        const rDate = r.paidAt?.toDate() || new Date();
        return rDate.toDateString() === date.toDateString();
      });

      const plotForDate = data.records.plot.filter(r => {
        const rDate = r.paidAt?.toDate() || new Date();
        return rDate.toDateString() === date.toDateString();
      });

      const cyberAmount = cyberForDate.reduce((sum, r) => sum + (r.agentNetIncome || 0), 0);
      const plotAmount = plotForDate.reduce((sum, r) => sum + (r.agentCommission || 0), 0);

      breakdown.push({
        date: dateStr,
        plotYangu: plotAmount,
        cyber: cyberAmount,
        total: plotAmount + cyberAmount
      });
    }

    setDailyBreakdown(breakdown);
  };

  const handleDownloadReport = () => {
    if (!incomeData) return;

    const csv = generateCSV(incomeData, period);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `income-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const generateCSV = (data: IncomeData, period: string): string => {
    let csv = `Income Report - ${period.toUpperCase()}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;

    csv += `SUMMARY\n`;
    csv += `Plot Yangu Revenue,KES ${data.plotIncome.toFixed(2)}\n`;
    csv += `Cyber Services Revenue,KES ${data.cyberIncome.toFixed(2)}\n`;
    csv += `Total Revenue,KES ${data.totalIncome.toFixed(2)}\n\n`;

    csv += `PLOT YANGU TRANSACTIONS\n`;
    csv += `Reference,Plan,Amount,Commission,Status,Date\n`;
    data.records.plot.forEach(r => {
      const date = r.paidAt?.toDate().toLocaleString() || 'N/A';
      csv += `${r.reference},"${r.planName}",${r.grossAmount.toFixed(2)},${r.agentCommission.toFixed(2)},${r.status},${date}\n`;
    });

    csv += `\nCYBER SERVICES TRANSACTIONS\n`;
    csv += `Reference,Service,Gross Amount,Net Income,Status,Date\n`;
    data.records.cyber.forEach(r => {
      const date = r.paidAt?.toDate().toLocaleString() || 'N/A';
      csv += `${r.reference},"${r.service}",${r.grossAmount.toFixed(2)},${r.agentNetIncome.toFixed(2)},${r.status},${date}\n`;
    });

    return csv;
  };

  if (loading && !incomeData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 text-cyan-500 animate-spin" />
          <p className="text-gray-400">Loading income data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <span className="text-red-400">{error}</span>
      </div>
    );
  }

  if (!incomeData) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No income data available</p>
      </div>
    );
  }

  const avgDailyIncome = period === 'today' 
    ? incomeData.totalIncome 
    : incomeData.totalIncome / (period === 'week' ? 7 : 30);

  const projectedMonthly = (incomeData.totalIncome / (period === 'today' ? 1 : period === 'week' ? 7 : 30)) * 30;

  const maxBarValue = Math.max(...dailyBreakdown.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg w-fit border border-gray-700/50">
        {(['today', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
              period === p 
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Income Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          label="Plot Yangu Income"
          value={`KES ${incomeData.plotIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`}
          trend={`${incomeData.plotCount} transactions`}
          color="cyan"
        />
        <StatCard
          icon={<Printer className="w-5 h-5" />}
          label="Cyber Services"
          value={`KES ${incomeData.cyberIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`}
          trend={`${incomeData.cyberCount} transactions`}
          color="violet"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Income"
          value={`KES ${incomeData.totalIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`}
          trend={`${incomeData.plotCount + incomeData.cyberCount} total`}
          color="emerald"
        />
      </div>

      {/* Income Breakdown Chart */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold mb-6 text-white">Daily Income Breakdown</h3>
        
        {dailyBreakdown.some(d => d.total > 0) ? (
          <div className="h-80 flex items-end justify-between gap-3">
            {dailyBreakdown.map((data, idx) => {
              const totalHeight = (data.total / maxBarValue) * 100 || 5; // Minimum height for visibility
              const plotHeight = data.total > 0 ? (data.plotYangu / data.total) * 100 : 0;
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full relative rounded-t-lg overflow-hidden shadow-lg bg-gray-700/30 transition-all hover:shadow-xl" 
                    style={{ height: `${totalHeight}%`, minHeight: '8px' }}
                  >
                    {data.total > 0 && (
                      <>
                        <div 
                          className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-500 to-cyan-400 shadow-cyan-500/20"
                          style={{ height: `${plotHeight}%` }}
                        ></div>
                        <div 
                          className="absolute top-0 w-full bg-gradient-to-t from-violet-500 to-violet-400 shadow-violet-500/20"
                          style={{ height: `${100 - plotHeight}%` }}
                        ></div>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{data.date}</span>
                  {data.total > 0 && (
                    <span className="text-xs text-gray-500">KES {data.total.toLocaleString('en-KE', { maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-400">
            <p>No income data for this period</p>
          </div>
        )}
        
        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyan-500 rounded shadow-sm shadow-cyan-500/50"></div>
            <span className="text-gray-400">Plot Yangu</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-violet-500 rounded shadow-sm shadow-violet-500/50"></div>
            <span className="text-gray-400">Cyber Services</span>
          </div>
        </div>
      </div>

      {/* Income Statement */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-semibold text-white">Income Statement ({period})</h3>
          <button 
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors text-sm font-medium shadow-lg shadow-cyan-500/20"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-700">
            <span className="font-medium text-gray-400">Plot Yangu Revenue</span>
            <span className="font-semibold text-white">KES {incomeData.plotIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-700">
            <span className="font-medium text-gray-400">Cyber Services Revenue</span>
            <span className="font-semibold text-white">KES {incomeData.cyberIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center py-4 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-lg px-4 border border-emerald-500/30">
            <span className="font-bold text-white text-lg">Total Revenue</span>
            <span className="font-bold text-emerald-400 text-xl">KES {incomeData.totalIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div className="text-sm text-gray-400 mb-1">Avg. Daily Income</div>
            <div className="text-xl font-bold text-cyan-400">
              KES {avgDailyIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 bg-violet-500/10 rounded-lg border border-violet-500/30">
            <div className="text-sm text-gray-400 mb-1">Total Transactions</div>
            <div className="text-xl font-bold text-violet-400">
              {incomeData.plotCount + incomeData.cyberCount}
            </div>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
            <div className="text-sm text-gray-400 mb-1">Projected Monthly</div>
            <div className="text-xl font-bold text-emerald-400">
              KES {projectedMonthly.toLocaleString('en-KE', { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      {(incomeData.records.plot.length > 0 || incomeData.records.cyber.length > 0) && (
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
          
          {/* Plot Yangu Transactions */}
          {incomeData.records.plot.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Plot Yangu
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {incomeData.records.plot.slice(0, 5).map((record) => (
                  <div key={record.reference} className="flex justify-between items-center py-2 px-3 bg-gray-700/20 rounded border border-gray-700/50 text-sm">
                    <div>
                      <p className="font-medium text-gray-200">{record.planName}</p>
                      <p className="text-xs text-gray-500">{record.reference}</p>
                    </div>
                    <p className="font-semibold text-cyan-400">KES {record.agentCommission.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cyber Services Transactions */}
          {incomeData.records.cyber.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Cyber Services
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {incomeData.records.cyber.slice(0, 5).map((record) => (
                  <div key={record.reference} className="flex justify-between items-center py-2 px-3 bg-gray-700/20 rounded border border-gray-700/50 text-sm">
                    <div>
                      <p className="font-medium text-gray-200">{record.service}</p>
                      <p className="text-xs text-gray-500">{record.reference}</p>
                    </div>
                    <p className="font-semibold text-violet-400">KES {record.agentNetIncome.toLocaleString('en-KE', { maximumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncomeTab;