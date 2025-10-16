import { useState } from 'react';
import { 
  Building2, DollarSign, 
  Download, 
  Printer, BarChart3,
  X,
  Loader2,
  AlertCircle,
  Smartphone,
  Receipt,
  Banknote,
  CheckCircle,
  MessageCircle,
  CreditCard,
  Zap,
  ArrowRight} from 'lucide-react';
import PlotTab from '../components/plotYangu/PlotTab';
import PaymentModal from '../components/PaymentModal';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, type Invoice } from '../services/firebaseService';
import { useAuth } from '../context/authContext';
import PricingModal from '../components/PricingPage';
import { PaymentSuccessHandler, type Transaction } from '../services/PaymentsSuccess';
import { toast } from 'react-toastify';
import CyberTab from '../components/cyber/CyberTab';
import { Paystack } from '../services/paystackService';
import { Screening } from '../services/Screening';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebaseService';

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

interface CyberPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: string;
  currentUser: any;
}

const CyberPaymentModal = ({ isOpen, onClose, service, currentUser }: CyberPaymentModalProps) => {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCharge = async () => {
    if (!amount || !phone) {
      setError('Please fill in all fields');
      return;
    }

    if (parseFloat(amount) < 10) {
      setError('Minimum amount is KES 10');
      return;
    }

    if (!/^254\d{9}$/.test(phone)) {
      setError('Phone number must be in format 254XXXXXXXXX');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const chargeCustomer = httpsCallable(functions, 'chargeCustomer');
      const result = await chargeCustomer({
        amount: parseFloat(amount),
        phone: phone,
        pId: currentUser.pId,
        uid: currentUser.uid,
        id: currentUser.id,
        service: service
      });

      console.log('Charge result:', result.data);

      setSuccess(true);
      toast.success('Payment request sent! Check your phone.');
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setAmount('');
        setPhone('');
      }, 2000);

    } catch (err: any) {
      console.error('Charge error:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Beautiful Header */}
        <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 pb-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          
          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Quick Charge</h3>
                <p className="text-violet-100 text-sm">{service}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mt-6 flex items-center gap-2 text-white/90 text-sm">
            <Smartphone className="w-4 h-4" />
            <span>M-Pesa Payment</span>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-5 -mt-14 relative z-10">
          {/* Amount Card */}
          <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-600/50 p-5 shadow-xl">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (KES)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-semibold">
                KES
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                disabled={loading || success}
                placeholder="0.00"
                className="w-full pl-16 pr-4 py-4 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-white text-lg font-semibold placeholder-gray-500 disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Minimum: KES 10</p>
          </div>

          {/* Phone Card */}
          <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-600/50 p-5 shadow-xl">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              M-Pesa Phone Number
            </label>
            <div className="relative">
              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                disabled={loading || success}
                placeholder="254712345678"
                className="w-full pl-12 pr-4 py-4 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-white font-medium placeholder-gray-500 disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Format: 254XXXXXXXXX</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30 flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-400">{error}</div>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-400">Payment request sent successfully!</div>
            </div>
          )}

          {/* Charge Button */}
          <button
            onClick={handleCharge}
            disabled={loading || success || !amount || !phone}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 flex items-center justify-center gap-3 group"
          >
            {loading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Processing...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-6 h-6" />
                <span>Payment Sent!</span>
              </>
            ) : (
              <>
                <span>Charge Customer</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {/* Info */}
          <div className="text-center text-xs text-gray-400 pt-2">
            Customer will receive M-Pesa prompt on their phone
          </div>
        </div>
      </div>
    </div>
  );
};

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
  currentUserId: string;
  onOpenPaymentModal: (invoice: Invoice) => void;
  onOpenPricingModal: (asset: any) => void;
  currentUser: any;
}

const TerminalModal = ({ 
  isOpen, 
  onClose, 
  asset, 
  onOpenPaymentModal,
  onOpenPricingModal,
  currentUser
}: TerminalModalProps) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);
  const [showCyberPayment, setShowCyberPayment] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setStep(1);
    setSelectedOption('');
    setTenantId('');
    setLoading(false);
    setError('');
    setFoundInvoice(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const findTenantAndInvoice = async () => {
    if (!asset || !tenantId.trim()) {
      setError('Please enter a valid tenant ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get tenant from asset's tenants subcollection
      const tenantsRef = collection(db, 'users', asset.id, 'tenants');
      
      // Try to query with both string and number formats
      const tenantIdNum = parseInt(tenantId);
      const searchIds = isNaN(tenantIdNum) ? [tenantId] : [tenantId, tenantIdNum];
      
      const tenantQuery = query(tenantsRef, where('localId', 'in', searchIds));
      const tenantSnapshot = await getDocs(tenantQuery);

      if (tenantSnapshot.empty) {
        setError(`No tenant found with ID: ${tenantId}`);
        setLoading(false);
        return;
      }

      const tenantDoc = tenantSnapshot.docs[0];
      const tenantData = tenantDoc.data();
      const tenantLocalId = tenantData.localId || tenantData.id;

      // Get latest unpaid invoice for this tenant - query with both formats
      const invoicesRef = collection(db, 'users', asset.id, 'invoices');
      
      // Convert tenantLocalId to both string and number for querying
      const tenantIdString = String(tenantLocalId);
      const tenantIdNumber = parseInt(tenantLocalId);
      const queryIds = isNaN(tenantIdNumber) ? [tenantIdString] : [tenantIdString, tenantIdNumber];
      
      const invoiceQuery = query(
        invoicesRef,
        where('tenantId', 'in', queryIds),
        where('isPaid', '==', false),
        orderBy('dueDate', 'desc'),
        limit(1)
      );

      const invoiceSnapshot = await getDocs(invoiceQuery);

      if (invoiceSnapshot.empty) {
        setError(`No unpaid invoices found for tenant ID: ${tenantId}`);
        setLoading(false);
        return;
      }

      const invoiceDoc = invoiceSnapshot.docs[0];
      const invoiceData = invoiceDoc.data() as Invoice;

      // Get property name
      let propertyName = 'N/A';
      if (invoiceData.propertyId) {
        const propertyRef = doc(db, 'users', asset.id, 'properties', invoiceData.propertyId.toString());
        const propertyDoc = await getDoc(propertyRef);
        if (propertyDoc.exists()) {
          propertyName = propertyDoc.data().name || 'N/A';
        }
      }

      // Prepare complete invoice object
      const completeInvoice: Invoice = {
        ...invoiceData,
        id: invoiceDoc.id,
        tenantName: tenantData.name || `Tenant ${tenantLocalId}`,
        propertyName: propertyName,
        assetId: asset.id
      };

      setFoundInvoice(completeInvoice);
      setLoading(false);
      setStep(2);

    } catch (err: any) {
      console.error('Error finding tenant/invoice:', err);
      setError(err.message || 'Failed to find tenant or invoice. Please try again.');
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (selectedOption === 'renewal') {
      // Open pricing modal for subscription renewal
      handleClose();
      onOpenPricingModal(asset);
    } else if (selectedOption === 'rent') {
      await findTenantAndInvoice();
    } else if (!asset) {
      // Cyber services - open payment modal
      handleClose();
      setShowCyberPayment(true);
    }
  };

  const handlePayNow = () => {
    if (foundInvoice) {
      handleClose();
      onOpenPaymentModal(foundInvoice);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <div
          className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Payment Terminal</h3>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {asset && (
            <div className="mb-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <div className="text-sm text-gray-400">Selected Asset</div>
              <div className="font-semibold text-white">{asset.name}</div>
              <div className="text-sm text-gray-400">{asset.type === 'landlord' ? 'Landlord' : 'Agent'}</div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 rounded-lg border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-400">{error}</div>
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
                  onChange={(e) => {
                    setSelectedOption(e.target.value);
                    setError('');
                  }}
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
                    onChange={(e) => {
                      setTenantId(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter tenant ID number"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the tenant's local ID number
                  </p>
                </div>
              )}

              <button
                onClick={handleContinue}
                disabled={!selectedOption || (selectedOption === 'rent' && !tenantId.trim()) || loading}
                className="w-full py-3 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          )}

          {step === 2 && foundInvoice && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30 space-y-3">
                <h4 className="font-semibold text-white">Invoice Found</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tenant:</span>
                    <span className="text-white font-medium">{foundInvoice.tenantName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Property:</span>
                    <span className="text-white font-medium">{foundInvoice.propertyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Billing Month:</span>
                    <span className="text-white font-medium">{foundInvoice.billingMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Due Date:</span>
                    <span className="text-white font-medium">{foundInvoice.dueDate}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-blue-500/30">
                    <span className="text-gray-400">Total Amount:</span>
                    <span className="text-white font-bold">
                      KES {foundInvoice.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount Paid:</span>
                    <span className="text-green-400 font-semibold">
                      KES {foundInvoice.amountPaid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-blue-500/30">
                    <span className="text-gray-400">Outstanding:</span>
                    <span className="text-red-400 font-bold">
                      KES {(foundInvoice.totalAmount - foundInvoice.amountPaid).toLocaleString()}
                    </span>
                  </div>
                  {foundInvoice.arrears > 0 && (
                    <div className="flex justify-between text-orange-400">
                      <span>Previous Arrears:</span>
                      <span className="font-semibold">KES {foundInvoice.arrears.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="py-3 bg-transparent border-2 border-gray-600 text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white hover:border-gray-500 transition-all font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handlePayNow}
                  className="py-3 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors font-semibold shadow-lg shadow-cyan-500/20"
                >
                  Pay Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cyber Payment Modal */}
      <CyberPaymentModal
        isOpen={showCyberPayment}
        onClose={() => setShowCyberPayment(false)}
        service={selectedOption}
        currentUser={currentUser}
      />
    </>
  );
};

const getInitials = (name: string): string => {
  if (!name) return 'CO';
  
  const words = name.trim().split(/\s+/);
  
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  } else {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
};

type PaymentMode = 'mobile_money' | 'bank' | 'paybill' | 'till';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('plot');
  const [showTerminal, setShowTerminal] = useState(false);
  
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<PaymentMode>('mobile_money');
  const [savingPaymentInfo, setSavingPaymentInfo] = useState(false);

  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  const [paybillNumber, setPaybillNumber] = useState('');
  const [paybillAccountName, setPaybillAccountName] = useState('');

  const [tillNumber, setTillNumber] = useState('');
  const [tillBusinessName, setTillBusinessName] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [settlementBank, setSettlementBank] = useState<'mpesa' | 'airtel-ke'>('mpesa');
  const [accountNumber, setAccountNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPaymentSettings, setShowPaymentSettings] = useState(false);

  const { firestoreUser, loading } = useAuth(); 
  
  if (loading || !firestoreUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading user profile...</p>
        </div>
      </div>
    );
  }

  const paymentModes = [
    {
      id: 'mobile_money' as PaymentMode,
      name: 'Mobile Money',
      description: 'M-Pesa & Airtel Money',
      icon: Smartphone,
      color: 'bg-green-500',
      available: true
    },
    {
      id: 'bank' as PaymentMode,
      name: 'Bank Account',
      description: 'Direct bank transfer',
      icon: Building2,
      color: 'bg-blue-500',
      available: true
    },
    {
      id: 'paybill' as PaymentMode,
      name: 'Paybill',
      description: 'M-Pesa Paybill',
      icon: Receipt,
      color: 'bg-purple-500',
      available: true
    },
    {
      id: 'till' as PaymentMode,
      name: 'Buy Goods (Till)',
      description: 'M-Pesa Till Number',
      icon: Banknote,
      color: 'bg-orange-500',
      available: true
    }
  ];

  const handleRequestSetup = () => {
    if (!firestoreUser) return;

    let isValid = false;

    switch (selectedPaymentMode) {
      case 'bank':
        isValid = !!(bankName && bankAccountNumber && bankAccountName);
        break;
      case 'paybill':
        isValid = !!(paybillNumber && paybillAccountName);
        break;
      case 'till':
        isValid = !!(tillNumber && tillBusinessName);
        break;
    }

    if (!isValid) {
      alert('Please fill in all required fields');
      return;
    }

    const message = generateWhatsAppMessage();
    const whatsappNumber = '254791286165';
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const generateWhatsAppMessage = () => {
    if (!firestoreUser) return '';

    let message = `*🏢 Plot Yangu Payment Setup Request*\n\n`;
    message += `*Agent Details:*\n`;
    message += `• Name: ${firestoreUser.name}\n`;
    message += `• Email: ${firestoreUser.email}\n`;
    message += `• Phone: ${firestoreUser.phone}\n`;
    message += `• Agent ID: ${firestoreUser.id}\n\n`;

    switch (selectedPaymentMode) {
      case 'bank':
        message += `*Payment Method:* Bank Account\n\n`;
        message += `*Bank Details:*\n`;
        message += `• Bank Name: ${bankName}\n`;
        message += `• Account Number: ${bankAccountNumber}\n`;
        message += `• Account Name: ${bankAccountName}\n`;
        message += `• Branch: ${bankBranch || 'N/A'}\n`;
        break;

      case 'paybill':
        message += `*Payment Method:* Paybill\n\n`;
        message += `*Paybill Details:*\n`;
        message += `• Paybill Number: ${paybillNumber}\n`;
        message += `• Account Name: ${paybillAccountName}\n`;
        break;

      case 'till':
        message += `*Payment Method:* Buy Goods (Till)\n\n`;
        message += `*Till Details:*\n`;
        message += `• Till Number: ${tillNumber}\n`;
        message += `• Business Name: ${tillBusinessName}\n`;
        break;

      default:
        return '';
    }

    message += `\n_Please setup my payment account for automated settlements._`;

    return encodeURIComponent(message);
  };

  const handleSavePaymentInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firestoreUser) return;

    try {
      setSavingPaymentInfo(true);
      
      await Paystack.setupPaymentAccount({
        businessName,
        settlementBank,
        accountNumber,
        email,
        name,
        phone,
        userId: firestoreUser.uid,
        pId: firestoreUser.pId
      });
      
      setShowPaymentSettings(false);
      alert('Payment account setup successfully!');
      
    } catch (err: any) {
      alert(err.message || 'Failed to setup payment account');
    } finally {
      setSavingPaymentInfo(false);
    }
  };

  const handlePricingModalClose = (planSelected?: string) => {
    setShowPricingModal(false);
    console.log('Plan selected from profile:', planSelected);
  };

  const handleOpenTerminal = (asset: any) => {
    setSelectedAsset(asset);
    setShowTerminal(true);
  };

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handleOpenPricingModal = (asset: any) => {
    console.log('Opening pricing modal for asset:', asset);
    setSelectedAsset(asset);
    setShowPricingModal(true);
  };

  const handlePaymentSuccess = async (transaction: Transaction) => {
    try {
      await PaymentSuccessHandler.handlePaymentSuccess(
        transaction,
        firestoreUser.uid
      );

      await Screening.performFullScreeningMining(transaction.agentId);
      
      toast.success('Payment processed successfully!');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const tabs = [
    { id: 'plot', label: 'Plot Yangu', icon: <Building2 className="w-4 h-4" /> },
    { id: 'cyber', label: 'Cyber Services', icon: <Printer className="w-4 h-4" /> },
    { id: 'income', label: 'Income', icon: <BarChart3 className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      <header className="fixed top-0 left-0 right-0 bg-gray-900/30 backdrop-blur-md border-b border-gray-700/30 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-shrink-0">
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Cogvana <span className="text-cyan-400">Cyber</span>
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">Dashboard Overview</p>
            </div>
            <div onClick={() => setShowPaymentSettings(!showPaymentSettings)} className="flex items-center gap-2 sm:gap-3 cursor-pointer">
              <div className="text-right">
                <div className="text-xs sm:text-sm font-medium text-white">
                  {firestoreUser?.pId || 'COG-0000-12345'}
                </div>
                <div className="text-xs text-gray-400 hidden sm:block">
                  {firestoreUser?.name || 'Cyber Operator'}
                </div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-cyan-500 to-violet-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold shadow-lg shadow-cyan-500/30 flex-shrink-0">
                {getInitials(firestoreUser?.name || 'Cyber Operator')}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-gray-900/30 backdrop-blur-md border-b border-gray-800/50 fixed top-[73px] sm:top-[81px] left-0 right-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-[120px] sm:pt-[128px] pb-24 sm:pb-8">
        {activeTab === 'plot' && <PlotTab onOpenTerminal={handleOpenTerminal} />}
        {activeTab === 'cyber' && <CyberTab onOpenTerminal={handleOpenTerminal} />}
        {activeTab === 'income' && <IncomeTab />}
      </main>

      <button
        onClick={() => handleOpenTerminal(null)}
        className="fixed bottom-6 right-6 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-full shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-110 transition-all duration-300 flex items-center justify-center z-40 group"
        title="Open Payment Terminal"
      >
        <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 group-hover:rotate-12 transition-transform" />
      </button>

      {showPaymentSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentSettings(false)}>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Payment Account Settings</h2>
              <button
                onClick={() => setShowPaymentSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {firestoreUser?.paymentInfo?.accountId ? (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-900 font-semibold">Payment Account Active</p>
                    <p className="text-green-700 text-sm mt-1">
                      Subaccount Code: {firestoreUser?.paymentInfo.accountId}
                    </p>
                    <p className="text-green-700 text-sm">
                      Commission Rate: {firestoreUser?.paymentInfo.split}%
                    </p>
                    <p className="text-green-700 text-sm">
                      Settlement Bank: {firestoreUser?.paymentInfo.settlementBank.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  No payment account configured. Setup your account details to receive payments via split settlement.
                </p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Select Payment Method</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {paymentModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedPaymentMode(mode.id)}
                    disabled={!mode.available}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      selectedPaymentMode === mode.id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    } ${!mode.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`${mode.color} p-2 rounded-lg`}>
                        <mode.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">{mode.name}</p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">{mode.description}</p>
                      </div>
                      {selectedPaymentMode === mode.id && (
                        <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedPaymentMode === 'mobile_money' && (
              <form onSubmit={handleSavePaymentInfo} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-900 font-semibold text-sm">Automated Setup Available</p>
                      <p className="text-blue-700 text-xs mt-1">
                        Mobile money accounts can be setup automatically via Paystack integration.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Your Business Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Settlement Bank
                  </label>
                  <select
                    value={settlementBank}
                    onChange={(e) => setSettlementBank(e.target.value as 'mpesa' | 'airtel-ke')}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="mpesa">M-Pesa</option>
                    <option value="airtel-ke">Airtel Money (Kenya)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number / Phone Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="254712345678"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your M-Pesa/Airtel Money registered phone number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="254712345678"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPaymentInfo}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPaymentInfo ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Setting up account...
                    </span>
                  ) : (
                    firestoreUser?.paymentInfo?.accountId ? 'Update Payment Account' : 'Setup Payment Account'
                  )}
                </button>
              </form>
            )}

            {selectedPaymentMode === 'bank' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-900 font-semibold text-sm">Free Setup via WhatsApp</p>
                      <p className="text-blue-700 text-xs mt-1">
                        Submit your bank details and our team will set up your account for free within 24 hours.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Equity Bank, KCB, Co-operative Bank"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Your bank account number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Holder Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Name as it appears on the account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch (Optional)
                  </label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Nairobi CBD Branch"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRequestSetup}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Request Setup via WhatsApp</span>
                </button>
              </div>
            )}

            {selectedPaymentMode === 'paybill' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-900 font-semibold text-sm">Free Setup via WhatsApp</p>
                      <p className="text-blue-700 text-xs mt-1">
                        Submit your paybill details and our team will configure automated settlements for free.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paybill Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paybillNumber}
                    onChange={(e) => setPaybillNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 123456"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your M-Pesa Paybill business number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Name / Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paybillAccountName}
                    onChange={(e) => setPaybillAccountName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Business name registered with the paybill"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRequestSetup}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Request Setup via WhatsApp</span>
                </button>
              </div>
            )}

            {selectedPaymentMode === 'till' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-900 font-semibold text-sm">Free Setup via WhatsApp</p>
                      <p className="text-blue-700 text-xs mt-1">
                        Submit your till details and we'll integrate it with automated payment splits.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Till Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tillNumber}
                    onChange={(e) => setTillNumber(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 123456"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your M-Pesa Buy Goods till number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tillBusinessName}
                    onChange={(e) => setTillBusinessName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Business name registered with the till"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRequestSetup}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Request Setup via WhatsApp</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <TerminalModal
        isOpen={showTerminal}
        onClose={() => {
          setShowTerminal(false);
          setSelectedAsset(null);
        }}
        asset={selectedAsset}
        currentUserId={firestoreUser.id}
        onOpenPaymentModal={handleOpenPaymentModal}
        onOpenPricingModal={handleOpenPricingModal}
        currentUser={firestoreUser}
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

      {showPricingModal && selectedAsset && (
        <PricingModal
          isOpen={showPricingModal}
          onClose={handlePricingModalClose}
          canDismiss={true}
          currentPlan={selectedAsset?.tier || 'free'}
          asset={selectedAsset}
          cyber={firestoreUser}
        />
      )}
    </div>
  );
};

export default Dashboard;