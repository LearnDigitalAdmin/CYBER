import { Building2, Printer, DollarSign, Download } from "lucide-react";
import { useState } from "react";

const incomeData = {
  today: {
    plotYangu: 12500,
    cyber: 4800,
    total: 17300
  },
  week: {
    plotYangu: 67800,
    cyber: 23400,
    total: 91200
  },
  month: {
    plotYangu: 178000,
    cyber: 89500,
    total: 267500
  },
  dailyBreakdown: [
    { date: '08 Oct', plotYangu: 8500, cyber: 3200 },
    { date: '09 Oct', plotYangu: 12300, cyber: 4100 },
    { date: '10 Oct', plotYangu: 15600, cyber: 5800 },
    { date: '11 Oct', plotYangu: 9800, cyber: 3900 },
    { date: '12 Oct', plotYangu: 14200, cyber: 4600 },
    { date: '13 Oct', plotYangu: 16200, cyber: 5500 },
    { date: '14 Oct', plotYangu: 12500, cyber: 4800 }
  ]
};

// StatCard Component
const StatCard = ({ icon, value, trend, color, label = '' }: { icon: any; value: any; trend: any; color: any; label?: any }) => {
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

// IncomeTab Component
const IncomeTab = () => {
  const [period, setPeriod] = useState('today');

  const currentData = period === 'today' ? incomeData.today : 
                     period === 'week' ? incomeData.week : 
                     incomeData.month;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg w-fit border border-gray-700/50">
        {['today', 'week', 'month'].map((p) => (
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
          value={`KES ${currentData.plotYangu.toLocaleString()}`}
          trend={`${period}`}
          color="cyan"
        />
        <StatCard
          icon={<Printer className="w-5 h-5" />}
          label="Cyber Services"
          value={`KES ${currentData.cyber.toLocaleString()}`}
          trend={`${period}`}
          color="violet"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Income"
          value={`KES ${currentData.total.toLocaleString()}`}
          trend="+15%"
          color="emerald"
        />
      </div>

      {/* Income Breakdown Chart */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold mb-6 text-white">Daily Income Breakdown</h3>
        <div className="h-80 flex items-end justify-between gap-3">
          {incomeData.dailyBreakdown.map((data, idx) => {
            const maxValue = Math.max(...incomeData.dailyBreakdown.map(d => d.plotYangu + d.cyber));
            const totalHeight = ((data.plotYangu + data.cyber) / maxValue) * 100;
            const plotHeight = (data.plotYangu / (data.plotYangu + data.cyber)) * 100;
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative rounded-t-lg overflow-hidden shadow-lg" style={{ height: `${totalHeight}%` }}>
                  <div 
                    className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-500 to-cyan-400 shadow-cyan-500/20"
                    style={{ height: `${plotHeight}%` }}
                  ></div>
                  <div 
                    className="absolute top-0 w-full bg-gradient-to-t from-violet-500 to-violet-400 shadow-violet-500/20"
                    style={{ height: `${100 - plotHeight}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400 font-medium">{data.date}</span>
              </div>
            );
          })}
        </div>
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
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors text-sm font-medium shadow-lg shadow-cyan-500/20">
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-700">
            <span className="font-medium text-gray-400">Plot Yangu Revenue</span>
            <span className="font-semibold text-white">KES {currentData.plotYangu.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-700">
            <span className="font-medium text-gray-400">Cyber Services Revenue</span>
            <span className="font-semibold text-white">KES {currentData.cyber.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-4 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-lg px-4 border border-emerald-500/30">
            <span className="font-bold text-white text-lg">Total Revenue</span>
            <span className="font-bold text-emerald-400 text-xl">KES {currentData.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div className="text-sm text-gray-400 mb-1">Avg. Daily Income</div>
            <div className="text-xl font-bold text-cyan-400">
              KES {Math.round(currentData.total / (period === 'today' ? 1 : period === 'week' ? 7 : 30)).toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-violet-500/10 rounded-lg border border-violet-500/30">
            <div className="text-sm text-gray-400 mb-1">Growth Rate</div>
            <div className="text-xl font-bold text-violet-400">+23%</div>
          </div>
          <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
            <div className="text-sm text-gray-400 mb-1">Projected Monthly</div>
            <div className="text-xl font-bold text-emerald-400">
              KES {Math.round((currentData.total / (period === 'today' ? 1 : period === 'week' ? 7 : 30)) * 30).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default IncomeTab;