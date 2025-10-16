import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, collectionGroup } from "firebase/firestore";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { db } from "../../services/firebaseService";
import type { Invoice } from "../plotYangu/AddInvc";
import CyberPaymentModal from "./CeberTerminal";

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: any;
  currentUserId: string;
  onOpenPaymentModal: (invoice: Invoice) => void;
  onOpenPricingModal: (asset: any) => void;
  currentUser: any;
  currentTab: string;
}

const TerminalModal = ({ 
  isOpen, 
  onClose, 
  asset, 
  onOpenPaymentModal,
  onOpenPricingModal,
  currentUser,
  currentTab
}: TerminalModalProps) => {
  const [selectedOption, setSelectedOption] = useState('');
  const [selectedCyberOption, setSelectedCyberOption] = useState('');

  const [tenantId, setTenantId] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);
  const [showCyberPayment, setShowCyberPayment] = useState(false);
  const [foundAsset, setFoundAsset] = useState<any>(null);

  if (!isOpen) return null;

  const isCyberTab = currentTab === 'cyber';
  const isPlotTab = currentTab === 'plot';

  const resetForm = () => {
    setStep(1);
    setSelectedOption('');
    setSelectedCyberOption('');
    setTenantId('');
    setLoading(false);
    setError('');
    setFoundInvoice(null);
    setFoundAsset(null);
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

  const findTenantGlobal = async () => {
    if (!tenantId.trim()) {
      setError('Please enter a valid tenant ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use collection group to search across all tenants
      const tenantsCollectionGroup = collectionGroup(db, 'tenants');
      
      const tenantIdNum = parseInt(tenantId);
      const searchIds = isNaN(tenantIdNum) ? [tenantId] : [tenantId, tenantIdNum];
      
      const tenantQuery = query(tenantsCollectionGroup, where('localId', 'in', searchIds));
      const tenantSnapshot = await getDocs(tenantQuery);

      if (tenantSnapshot.empty) {
        setError(`No tenant found with ID: ${tenantId}`);
        setLoading(false);
        return;
      }

      const tenantDoc = tenantSnapshot.docs[0];
      const tenantData = tenantDoc.data();
      const tenantLocalId = tenantData.localId || tenantData.id;
      
      // Extract asset ID from the path (path format: users/{userId}/tenants/{tenantId})
      const pathParts = tenantDoc.ref.path.split('/');
      const extractedAssetId = pathParts[1];

      // Get latest unpaid invoice using collection group
      const invoicesCollectionGroup = collectionGroup(db, 'invoices');
      
      const tenantIdString = String(tenantLocalId);
      const tenantIdNumber = parseInt(tenantLocalId);
      const queryIds = isNaN(tenantIdNumber) ? [tenantIdString] : [tenantIdString, tenantIdNumber];
      
      const invoiceQuery = query(
        invoicesCollectionGroup,
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

      // Get property name from the extracted asset ID
      let propertyName = 'N/A';
      if (invoiceData.propertyId) {
        const propertyRef = doc(db, 'users', extractedAssetId, 'properties', invoiceData.propertyId.toString());
        const propertyDoc = await getDoc(propertyRef);
        if (propertyDoc.exists()) {
          propertyName = propertyDoc.data().name || 'N/A';
        }
      }

      // Get asset info to display
      const assetRef = doc(db, 'users', extractedAssetId);
      const assetDoc = await getDoc(assetRef);
      const assetData = assetDoc.exists() ? assetDoc.data() : { name: 'Unknown Asset', type: 'landlord' };
      
      // Prepare complete invoice object with asset info
      const completeInvoice: Invoice = {
        ...invoiceData,
        id: invoiceDoc.id,
        tenantName: tenantData.name || `Tenant ${tenantLocalId}`,
        propertyName: propertyName,
        assetId: extractedAssetId
      };

      setFoundAsset(assetData);
      setFoundInvoice(completeInvoice);
      setLoading(false);
      setStep(2);

    } catch (err: any) {
      console.error('Error finding tenant globally:', err);
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
      if (asset) {
        // Asset selected - use normal asset-specific search
        await findTenantAndInvoice();
      } else if (isPlotTab && !asset) {
        // Plot tab without asset - use global collection group search
        await findTenantGlobal();
      }
    } else if (!asset && isCyberTab) {
      // Cyber tab services - set the cyber option and open payment modal
      setSelectedCyberOption(selectedOption);
      setShowCyberPayment(true);
    }
  };

  const handlePayNow = () => {
    if (foundInvoice) {
      handleClose();
      onOpenPaymentModal(foundInvoice);
    }
  };

  const handleCyberPaymentClose = () => {
    setShowCyberPayment(false);
    handleClose();
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

          {foundAsset && !asset && (
            <div className="mb-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <div className="text-sm text-gray-400">Found Asset</div>
              <div className="font-semibold text-white">{foundAsset.name}</div>
              <div className="text-sm text-gray-400">{foundAsset.type === 'landlord' ? 'Landlord' : 'Agent'}</div>
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
                  {isCyberTab ? (
                    <>
                      <option value="printing">Printing Service</option>
                      <option value="scanning">Scanning Service</option>
                      <option value="photocopying">Photocopying Service</option>
                      <option value="binding">Binding Service</option>
                      <option value="digital">Government Service</option>
                      <option value="movies">Movie / Songs</option>
                      <option value="other">Other Service</option>
                    </>
                  ) : (
                    <>
                      {asset ? (
                        <>
                          <option value="rent">Rent Payment</option>
                          <option value="renewal">Subscription Renewal</option>
                        </>
                      ) : (
                        <option value="rent">Rent Payment (Global Search)</option>
                      )}
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
                    {!asset ? 'Search tenant across all properties' : "Enter the tenant's local ID number"}
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
        onClose={handleCyberPaymentClose}
        service={selectedCyberOption}
        currentUser={currentUser}
      />
    </>
  );
};

export default TerminalModal;