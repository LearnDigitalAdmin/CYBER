import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Download, TrendingUp, TrendingDown } from 'lucide-react';
import type { Shop } from '../../services/shopService';
import { getDailySummary, getSummaries, parseDateCode } from '../../services/shopService';
import { toast } from 'react-toastify';

interface ReportsViewProps {
  shop: Shop;
}

interface DailySummaryView {
  shopId: string;
  date: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  transactionCount: number;
}

const ReportsView: React.FC<ReportsViewProps> = ({ shop }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DailySummaryView | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [rangeSummary, setRangeSummary] = useState<{
    totalSales: number;
    totalExpenses: number;
    profit: number;
    days: DailySummaryView[];
  } | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'range'>('daily');

  const loadDailySummary = async (date: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getDailySummary(shop.id, date);
      setSummary({
        shopId: data.shopId,
        date: data.date,
        totalSales: data.totalSales,
        totalExpenses: data.totalExpenses,
        profit: data.profit,
        transactionCount: data.transactionCount,
      });
    } catch (err: any) {
      setError(err.message || 'Error loading summary');
      console.error('Error loading summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRangeSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get daily summaries directly from the service
      const dailySummaries = await getSummaries(shop.id, dateRange.start, dateRange.end);

      // Convert dateCode format to date string format for display
      const days = dailySummaries.map((summary) => ({
        shopId: summary.shopId,
        date: parseDateCode(summary.dateCode).toISOString().split('T')[0],
        totalSales: summary.totalSales,
        totalExpenses: summary.totalExpenses,
        profit: summary.profit,
        transactionCount: summary.transactionCount,
      }));

      const totalSales = days.reduce((sum, d) => sum + d.totalSales, 0);
      const totalExpenses = days.reduce((sum, d) => sum + d.totalExpenses, 0);

      setRangeSummary({
        totalSales,
        totalExpenses,
        profit: totalSales - totalExpenses,
        days,
      });
    } catch (err: any) {
      setError(err.message || 'Error loading summary');
      console.error('Error loading summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'daily') {
      loadDailySummary(selectedDate);
    } else {
      loadRangeSummary();
    }
  }, [shop.id]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    loadDailySummary(date);
  };

  const downloadReport = () => {
    if (viewMode === 'daily' && !summary) {
      toast.error('No data to download');
      return;
    }

    if (viewMode === 'range' && !rangeSummary) {
      toast.error('No data to download');
      return;
    }

    // Simple CSV generation
    if (viewMode === 'daily' && summary) {
      const csv = `Shop Report - Daily\nDate: ${summary.date}\nShop: ${shop.shopName}\n\nSales,${summary.totalSales}\nExpenses,${summary.totalExpenses}\nProfit,${summary.profit}\nTransactions,${summary.transactionCount}`;
      downloadCSV(csv, `daily-report-${summary.date}.csv`);
    } else if (viewMode === 'range' && rangeSummary) {
      const csv = `Shop Report - Range\nPeriod: ${dateRange.start} to ${dateRange.end}\nShop: ${shop.shopName}\n\nTotal Sales,${rangeSummary.totalSales}\nTotal Expenses,${rangeSummary.totalExpenses}\nTotal Profit,${rangeSummary.profit}\n\nDaily Breakdown\nDate,Sales,Expenses,Profit`;
      const rows = rangeSummary.days.map((d) => `${d.date},${d.totalSales},${d.totalExpenses},${d.profit}`).join('\n');
      downloadCSV(csv + '\n' + rows, `range-report-${dateRange.start}-to-${dateRange.end}.csv`);
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Report downloaded');
  };

  return (
    <div className="space-y-4">
      {/* View Mode Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => {
            setViewMode('daily');
            handleDateChange(selectedDate);
          }}
          className={`px-4 py-2 border-b-2 transition-colors ${
            viewMode === 'daily' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Daily Report
        </button>
        <button
          onClick={() => {
            setViewMode('range');
            loadRangeSummary();
          }}
          className={`px-4 py-2 border-b-2 transition-colors ${
            viewMode === 'range' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Range Report
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Error</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Daily Report View */}
      {viewMode === 'daily' && (
        <>
          {/* Date Selector */}
          <div className="flex gap-2 items-end flex-col sm:flex-row">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <button
              onClick={downloadReport}
              disabled={!summary}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white rounded transition-colors disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* Daily Summary Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sales */}
              <div className="bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-blue-400 uppercase tracking-wider">Total Sales</p>
                    <p className="text-2xl font-bold text-white mt-2">KES {summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-400" />
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-gradient-to-br from-orange-900/20 to-orange-900/10 border border-orange-700/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-orange-400 uppercase tracking-wider">Total Expenses</p>
                    <p className="text-2xl font-bold text-white mt-2">KES {summary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-orange-400" />
                </div>
              </div>

              {/* Profit */}
              <div className={`bg-gradient-to-br ${summary.profit >= 0 ? 'from-green-900/20 to-green-900/10 border-green-700/50' : 'from-red-900/20 to-red-900/10 border-red-700/50'} border rounded-lg p-4`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className={`text-xs uppercase tracking-wider ${summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>Profit</p>
                    <p className={`text-2xl font-bold mt-2 ${summary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      KES {summary.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="bg-gradient-to-br from-purple-900/20 to-purple-900/10 border border-purple-700/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-purple-400 uppercase tracking-wider">Transactions</p>
                    <p className="text-2xl font-bold text-white mt-2">{summary.transactionCount}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-400">No data for this date</p>
            </div>
          )}
        </>
      )}

      {/* Range Report View */}
      {viewMode === 'range' && (
        <>
          {/* Date Range Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-2">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={loadRangeSummary}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white rounded transition-colors text-sm font-semibold disabled:cursor-not-allowed"
              >
                {isLoading ? 'Loading...' : 'Load'}
              </button>
              <button
                onClick={downloadReport}
                disabled={!rangeSummary}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white rounded transition-colors disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Range Summary Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : rangeSummary ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Sales */}
                <div className="bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-700/50 rounded-lg p-4">
                  <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">Total Sales</p>
                  <p className="text-2xl font-bold text-white">KES {rangeSummary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>

                {/* Total Expenses */}
                <div className="bg-gradient-to-br from-orange-900/20 to-orange-900/10 border border-orange-700/50 rounded-lg p-4">
                  <p className="text-xs text-orange-400 uppercase tracking-wider mb-2">Total Expenses</p>
                  <p className="text-2xl font-bold text-white">KES {rangeSummary.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>

                {/* Total Profit */}
                <div className={`bg-gradient-to-br ${rangeSummary.profit >= 0 ? 'from-green-900/20 to-green-900/10 border-green-700/50' : 'from-red-900/20 to-red-900/10 border-red-700/50'} border rounded-lg p-4`}>
                  <p className={`text-xs uppercase tracking-wider mb-2 ${rangeSummary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>Total Profit</p>
                  <p className={`text-2xl font-bold ${rangeSummary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    KES {rangeSummary.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 bg-gray-900">
                        <th className="px-4 py-3 text-left font-semibold text-gray-300">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-300">Sales</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-300">Expenses</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-300">Profit</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-300">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeSummary.days.map((day) => (
                        <tr key={day.date} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{new Date(day.date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-blue-400">KES {day.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-orange-400">KES {day.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className={`px-4 py-3 font-semibold ${day.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            KES {day.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-gray-300">{day.transactionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
              <p className="text-gray-400">Load a date range to view reports</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsView;
