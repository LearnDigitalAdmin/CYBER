import { useState, useEffect } from 'react';
import {
  FileText, Download, Trash2, Search,
  Clock, Printer, File, ArrowUpRight,
  ChevronLeft, ChevronRight, Loader2,
  AlertCircle
} from 'lucide-react';
import { cyberService, type Upload, type DailyData } from '../../services/Cyber';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';

// StatCard Component
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

// Main CyberTab Component
const CyberTab = ({ }: { onOpenTerminal: (asset?: any) => void }) => {
  const { firestoreUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  
  // Action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [, setBusinessName] = useState('');
  const [, setSettlementBank] = useState<'mpesa' | 'airtel-ke'>('mpesa');
  const [, setAccountNumber] = useState('');
  const [, setEmail] = useState('');
  const [, setName] = useState('');
  const [, setPhone] = useState('');

  

  // Subscribe to real-time updates
  useEffect(() => {
    if (!firestoreUser?.uid) return;
    if (firestoreUser.paymentInfo) {
          setBusinessName(firestoreUser.paymentInfo.businessName || '');
          setSettlementBank(firestoreUser.paymentInfo.settlementBank as 'mpesa' | 'airtel-ke' || 'mpesa');
          setAccountNumber(firestoreUser.paymentInfo.accountNumber || '');
          setEmail(firestoreUser.paymentInfo.email || firestoreUser.email);
          setName(firestoreUser.paymentInfo.name || firestoreUser.name);
          setPhone(firestoreUser.paymentInfo.phone || firestoreUser.phone);
        } else {
          // Set defaults from agent data
          setEmail(firestoreUser.email);
          setName(firestoreUser.name);
          setPhone(firestoreUser.phone);
        }

    setLoading(true);
    setError('');

    const unsubscribe = cyberService.subscribeToUploads(
      firestoreUser.uid,
      selectedDate,
      (data) => {
        setDailyData(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestoreUser?.uid, selectedDate]);

  // Filter uploads
  const filteredUploads = dailyData?.uploads.filter(upload => {
    const matchesSearch = 
      upload.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      upload.phone.includes(searchTerm) ||
      upload.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = serviceFilter === 'all' || upload.type === serviceFilter;
    
    return matchesSearch && matchesFilter;
  }) || [];

  // Get unique service types for filter
  const serviceTypes = Array.from(
    new Set(dailyData?.uploads.map(u => u.type) || [])
  ).sort();

  // Date navigation
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    
    // Don't allow future dates
    if (newDate > new Date()) {
      toast.warning('Cannot view future dates');
      return;
    }
    
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  // Download handler
  const handleDownload = async (upload: Upload) => {
    try {
      setDownloadingId(upload.id);
      await cyberService.downloadAndComplete(
        firestoreUser.uid,
        upload.id,
        upload.files
      );
      toast.success('Files downloaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download files');
    } finally {
      setDownloadingId(null);
    }
  };

  // Delete handler
  const handleDelete = async (upload: Upload) => {
    if (!window.confirm(`Delete upload for ${upload.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(upload.id);
      await cyberService.deleteUpload(
        firestoreUser.uid,
        upload.id,
        upload.files
      );
      toast.success('Upload deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete upload');
    } finally {
      setDeletingId(null);
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  if (loading && !dailyData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const stats = dailyData?.stats || {
    totalUploads: 0,
    totalFiles: 0,
    completed: 0,
    pending: 0
  };

  return (
    <div className="space-y-6">
      {/* Date Navigator */}
      <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4">
        <button
          onClick={() => navigateDate('prev')}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">
            {formatDate(selectedDate)}
          </h3>
          {!isToday() && (
            <button
              onClick={goToToday}
              className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        
        <button
          onClick={() => navigateDate('next')}
          disabled={isToday()}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Total Uploads"
          value={stats.totalUploads}
          trend="Active"
          color="cyan"
        />
        <StatCard
          icon={<File className="w-5 h-5" />}
          label="Total Files"
          value={stats.totalFiles}
          trend={`${stats.totalFiles} files`}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Completed"
          value={stats.completed}
          trend="Done"
          color="violet"
        />
        <StatCard
          icon={<ArrowUpRight className="w-5 h-5" />}
          label="Pending"
          value={stats.pending}
          trend="In Progress"
          color="amber"
        />
      </div>

      {/* Services Overview */}
      {dailyData?.services && dailyData.services.length > 0 && (
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4 text-white">
            Services Summary ({isToday() ? 'Today' : formatDate(selectedDate)})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dailyData.services.map((service, idx) => (
              <div
                key={idx}
                className="p-4 bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-lg border border-gray-700/50 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <Printer className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-medium text-gray-400">
                    {service.count} orders
                  </span>
                </div>
                <div className="font-semibold text-white">{service.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  KES {service.revenue.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploads Table */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-semibold text-white">File Uploads</h3>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone, service..."
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
              {serviceTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredUploads.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">
              {searchTerm || serviceFilter !== 'all' 
                ? 'No uploads match your filters' 
                : 'No uploads for this date'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                    Customer
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
                    Files
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                    Contact
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                    Service
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                    Time
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
                    Status
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUploads.map((upload) => (
                  <tr 
                    key={upload.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-white">{upload.name}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-md text-xs font-medium border border-cyan-500/30">
                        <File className="w-3 h-3" />
                        {upload.files.length}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-400">
                      {upload.phone}
                    </td>
                    <td className="py-4 px-4 text-sm text-white">{upload.type}</td>
                    <td className="py-4 px-4 text-sm text-gray-400">{upload.time}</td>
                    <td className="py-4 px-4 text-center">
                      <span 
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          upload.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {upload.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownload(upload)}
                          disabled={downloadingId === upload.id}
                          className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors border border-transparent hover:border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download files"
                        >
                          {downloadingId === upload.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(upload)}
                          disabled={deletingId === upload.id}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete upload"
                        >
                          {deletingId === upload.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CyberTab;


