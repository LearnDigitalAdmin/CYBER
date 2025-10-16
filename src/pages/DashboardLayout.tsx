import { useState } from 'react';
import { 
  Building2, 
  Printer, BarChart3,
  X,
  Loader2,
  AlertCircle,
  Smartphone,
  Receipt,
  Banknote,
  CheckCircle,
  MessageCircle,
  CreditCard} from 'lucide-react';
import PlotTab from '../components/plotYangu/PlotTab';
import PaymentModal from '../components/PaymentModal';
import { type Invoice } from '../services/firebaseService';
import { useAuth } from '../context/authContext';
import PricingModal from '../components/PricingPage';
import { PaymentSuccessHandler, type Transaction } from '../services/PaymentsSuccess';
import { toast } from 'react-toastify';
import CyberTab from '../components/cyber/CyberTab';
import { Paystack } from '../services/paystackService';
import { Screening } from '../services/Screening';
import TerminalModal from '../components/global/Terminal';
import IncomeTab from '../components/income/IncomeTab';



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