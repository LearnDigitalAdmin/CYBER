import { useState } from 'react';
import { 
  Building2, DollarSign, 
  FileText, Download, Trash2, Search, ArrowUpRight,
  Clock, Printer, File, BarChart3,
  CreditCard, X
} from 'lucide-react';
import PlotTab from '../components/plotYangu/PlotTab';
import PaymentModal from '../components/PaymentModal';


const cyberData = {
  uploads: [
    { id: 1, name: 'James Omondi', files: 3, phone: '0756789012', service: 'Printing', time: '09:15 AM', status: 'completed' },
    { id: 2, name: 'Grace Akinyi', files: 1, phone: '0767890123', service: 'File Returns', time: '09:45 AM', status: 'pending' },
    { id: 3, name: 'Peter Mwangi', files: 5, phone: '0778901234', service: 'Printing', time: '10:20 AM', status: 'completed' },
    { id: 4, name: 'Sarah Njeri', files: 2, phone: '0789012345', service: 'Scanning', time: '11:05 AM', status: 'completed' },
    { id: 5, name: 'David Otieno', files: 4, phone: '0790123456', service: 'Printing', time: '11:30 AM', status: 'pending' },
    { id: 6, name: 'Alice Wambui', files: 1, phone: '0701234567', service: 'File Returns', time: '12:15 PM', status: 'completed' }
  ],
  services: [
    { name: 'Printing', count: 45, revenue: 2250 },
    { name: 'Scanning', count: 23, revenue: 1150 },
    { name: 'File Returns', count: 18, revenue: 900 },
    { name: 'Photocopying', count: 67, revenue: 3350 }
  ]
};

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

// CyberTab Component
const CyberTab = ({ onOpenTerminal }: { onOpenTerminal: (asset?: any) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');

  const filteredUploads = cyberData.uploads.filter(upload => {
    const matchesSearch = upload.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         upload.phone.includes(searchTerm);
    const matchesFilter = serviceFilter === 'all' || upload.service === serviceFilter;
    return matchesSearch && matchesFilter;
  });

  const todayStats = {
    totalUploads: cyberData.uploads.length,
    totalFiles: cyberData.uploads.reduce((sum, u) => sum + u.files, 0),
    completed: cyberData.uploads.filter(u => u.status === 'completed').length,
    pending: cyberData.uploads.filter(u => u.status === 'pending').length
  };

  return (
    <div className="space-y-6">
      {/* Today's Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Today's Uploads"
          value={todayStats.totalUploads}
          trend="Active"
          color="cyan"
        />
        <StatCard
          icon={<File className="w-5 h-5" />}
          label="Total Files"
          value={todayStats.totalFiles}
          trend={`${todayStats.totalFiles} files`}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Completed"
          value={todayStats.completed}
          trend="Done"
          color="violet"
        />
        <StatCard
          icon={<ArrowUpRight className="w-5 h-5" />}
          label="Pending"
          value={todayStats.pending}
          trend="In Progress"
          color="amber"
        />
      </div>

      {/* Services Overview */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold mb-4 text-white">Services Summary (Today)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cyberData.services.map((service, idx) => (
            <div
              key={idx}
              className="p-4 bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-lg border border-gray-700/50 hover:border-cyan-500/50 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <Printer className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-medium text-gray-400">{service.count} orders</span>
              </div>
              <div className="font-semibold text-white">{service.name}</div>
              <div className="text-sm text-gray-400 mt-1">KES {service.revenue.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Uploads Table */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-semibold text-white">Today's File Uploads</h3>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search uploads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm text-white placeholder-gray-500"
              />
            </div>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm text-white"
            >
              <option value="all">All Services</option>
              <option value="Printing">Printing</option>
              <option value="Scanning">Scanning</option>
              <option value="File Returns">File Returns</option>
              <option value="Photocopying">Photocopying</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Customer</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Files</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Contact</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Service</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Time</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.map((upload) => (
                <tr key={upload.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-medium text-white">{upload.name}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-md text-xs font-medium border border-cyan-500/30">
                      <File className="w-3 h-3" />
                      {upload.files}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">{upload.phone}</td>
                  <td className="py-4 px-4 text-sm text-white">{upload.service}</td>
                  <td className="py-4 px-4 text-sm text-gray-400">{upload.time}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      upload.status === 'completed' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {upload.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors border border-transparent hover:border-cyan-500/30">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terminal Button */}
      <div className="max-w-md mx-auto">
        <button 
          onClick={() => onOpenTerminal(null)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-cyan-500 text-black rounded-xl hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/30 font-semibold"
        >
          <CreditCard className="w-5 h-5" />
          <span>Open Payment Terminal</span>
        </button>
      </div>
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

// Terminal Modal Component
const TerminalModal = ({ isOpen, onClose, asset }: { isOpen: boolean; onClose: () => void; asset: any }) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = () => {
    alert(`STK Push sent to ${phoneNumber} for KES ${amount}`);
    onClose();
    setStep(1);
    setSelectedOption('');
    setTenantId('');
    setPhoneNumber('');
    setAmount('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Payment Terminal</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {asset && (
          <div className="mb-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div className="text-sm text-gray-400">Selected Asset</div>
            <div className="font-semibold text-white">{asset.name}</div>
            <div className="text-sm text-gray-400">{asset.type}</div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Service
              </label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
              >
                <option value="">Choose an option...</option>
                {asset ? (
                  <>
                    <option value="rent">Rent Payment</option>
                    <option value="renewal">Subscription Renewal</option>
                  </>
                ) : (
                  <>
                    <option value="printing">Printing Service</option>
                    <option value="scanning">Scanning Service</option>
                    <option value="photocopying">Photocopying Service</option>
                    <option value="binding">Binding Service</option>
                    <option value="digital">Government Service</option>
                    <option value="movies">Movie / Songs</option>
                    <option value="other">Other Service</option>
                  </>
                )}
              </select>
            </div>

            {selectedOption === 'rent' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Enter tenant ID number"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                />
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!selectedOption}
              className="w-full py-3 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg shadow-cyan-500/20"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0712345678"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Amount (KES)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-3 bg-transparent border-2 border-gray-600 text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white hover:border-gray-500 transition-all font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!phoneNumber || !amount}
                className="py-3 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg shadow-cyan-500/20"
              >
                Send STK Push
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('plot');
  const [showTerminal, setShowTerminal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  //const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleOpenTerminal = (asset: any) => {
    setSelectedAsset(asset);
    setShowTerminal(true);
  };

  const tabs = [
    { id: 'plot', label: 'Plot Yangu', icon: <Building2 className="w-5 h-5" /> },
    { id: 'cyber', label: 'Cyber Services', icon: <Printer className="w-5 h-5" /> },
    { id: 'income', label: 'Income', icon: <BarChart3 className="w-5 h-5" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      {/* Header */}
      <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Cogvana <span className="text-cyan-400">Cyber</span></h1>
              <p className="text-sm text-gray-400">Dashboard Overview</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-white">COG-0000-12345</div>
                <div className="text-xs text-gray-400">Cyber Operator</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold shadow-lg shadow-cyan-500/30">
                CO
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800 sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'plot' && <PlotTab onOpenTerminal={handleOpenTerminal} />}
        {activeTab === 'cyber' && <CyberTab onOpenTerminal={handleOpenTerminal} />}
        {activeTab === 'income' && <IncomeTab />}
      </main>

      {/* Terminal Modal */}
      <TerminalModal
        isOpen={showTerminal}
        onClose={() => {
          setShowTerminal(false);
          setSelectedAsset(null);
        }}
        asset={selectedAsset}
      />

      {showPaymentModal && selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default Dashboard;