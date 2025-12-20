import { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import type { Shop } from '../../services/shopService';
import { generateAndStoreForm } from '../../services/formService';
import { toast } from 'react-toastify';

interface FormGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: Shop;
  cyberDetails: {
   // name: string;
    pId: string;
    email?: string;
    phone: string;
    shopName: string;
  };
}

type FormType = 'sales' | 'expenses' | 'stock';

const FormGeneratorModal: React.FC<FormGeneratorModalProps> = ({
  isOpen,
  onClose,
  shop,
  cyberDetails,
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatingForm, setGeneratingForm] = useState<FormType | null>(null);

  const handleGenerateForm = async (formType: FormType) => {
    setGenerating(true);
    setError(null);
    setSuccess(false);
    setGeneratingForm(formType);

    try {
      const url = await generateAndStoreForm(
        shop.id,
        formType,
        {
          shopName: shop.shopName,
          ownerName: shop.ownerName,
          shopId: shop.id,
        },
        {
          cyberName: cyberDetails.shopName,// || cyberDetails.name,
          cyberPId: cyberDetails.pId,
          cyberEmail: cyberDetails.email,
          cyberPhone: cyberDetails.phone,
        }
      );

      setSuccess(true);
      toast.success(`${formType.charAt(0).toUpperCase() + formType.slice(1)} form generated successfully!`);

      // Auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${shop.shopName}-${formType}-form.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Close after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate form');
      toast.error('Failed to generate form');
      console.error('Form generation error:', err);
    } finally {
      setGenerating(false);
      setGeneratingForm(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Generate Forms</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shop Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Shop</p>
          <p className="text-white font-semibold">{shop.shopName}</p>
          <p className="text-xs text-gray-500 mt-1">Owner: {shop.ownerName}</p>
        </div>

        {/* Cyber Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <p className="text-sm text-gray-400 mb-1">Your Cyber</p>
          <p className="text-white font-semibold">{cyberDetails.shopName}</p>
          <p className="text-xs text-gray-500 mt-1">{cyberDetails.pId}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-700/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-900/20 border border-green-700/50 text-green-400 px-4 py-3 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm">Form generated and downloading...</p>
            </div>
          </div>
        )}

        {/* Form Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleGenerateForm('sales')}
            disabled={generating}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            {generatingForm === 'sales' && generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Sales Form...
              </>
            ) : (
              <>📄 Sales Form</>
            )}
          </button>

          <button
            onClick={() => handleGenerateForm('expenses')}
            disabled={generating}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            {generatingForm === 'expenses' && generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Expenses Form...
              </>
            ) : (
              <>📄 Expenses Form</>
            )}
          </button>

          <button
            onClick={() => handleGenerateForm('stock')}
            disabled={generating}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            {generatingForm === 'stock' && generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Stock Form...
              </>
            ) : (
              <>📄 Stock Form</>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 text-xs text-gray-400">
          <p>✓ Forms are generated once and cached for future downloads</p>
          <p className="mt-1">✓ Generated forms are stored securely in cloud storage</p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default FormGeneratorModal;
