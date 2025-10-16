import { httpsCallable } from "firebase/functions";
import { Zap, X, Smartphone, AlertCircle, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { functions } from "../PricingPage";

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

    // Relaxed phone validation - accept 9-12 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 12) {
      setError('Phone number must be 9-12 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const chargeCustomer = httpsCallable(functions, 'chargeCustomer');
      console.log('DATA:', service, amount, phone, currentUser, service);
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
        <div className="relative bg-gradient-to-br from-cyan-500 via-cyan-600 to-gray-700 p-6 pb-20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          
          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Quick Charge</h3>
                <p className="text-white/90 text-sm capitalize">{service.replace('_', ' ')}</p>
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
                className="w-full pl-16 pr-4 py-4 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white text-lg font-semibold placeholder-gray-500 disabled:opacity-50"
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
                placeholder="254712345678 or 0712345678"
                className="w-full pl-12 pr-4 py-4 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white font-medium placeholder-gray-500 disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">Any format accepted (9-12 digits)</p>
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
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black rounded-xl hover:from-cyan-400 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed transition-all font-bold text-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 flex items-center justify-center gap-3 group"
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

export default CyberPaymentModal;