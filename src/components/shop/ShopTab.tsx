import { useState, useEffect } from 'react';
import {
  BarChart3,
  Package,
  TrendingUp,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';
import type { Shop } from '../../services/shopService';
import { getShop } from '../../services/shopService';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/authContext';
import ShopSearch from './ShopSearch';
import StockManagement from './StockManagement';
import SalesEntry from './SalesEntry';
import ExpensesEntry from './ExpensesEntry';
import ReportsView from './ReportsView';
import FormGeneratorModal from './FormGeneratorModal';

type TabType = 'search' | 'stock' | 'sales' | 'expenses' | 'reports';

interface CyberDetails {
  //name: string;
  shopName: string;
  pId: string;
  email?: string;
  phone: string;
}

const ShopTab = () => {
  const { firestoreUser } = useAuth();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [cyberDetails, setCyberDetails] = useState<CyberDetails | null>(null);

  // Build cyber details from auth context
  useEffect(() => {
    if (firestoreUser) {
      const details: CyberDetails = {
        //name: firestoreUser.name || 'Cyber Officer',
        shopName: firestoreUser.shopName || firestoreUser.name,
        pId: firestoreUser.pId || '',
        email: firestoreUser.email || firestoreUser.shopEmail,
        phone: firestoreUser.phone || '',
      };
      setCyberDetails(details);
    }
  }, [firestoreUser]);

  const handleShopSearch = async (shopId: string) => {
    try {
      setIsSearching(true);
      setError(null);
      const shop = await getShop(shopId);

      if (!shop) {
        setError('Shop not found. Please check the Shop ID or National ID.');
        setSelectedShop(null);
        return;
      }

      setSelectedShop(shop);
      setActiveTab('stock');
      toast.success(`Shop found: ${shop.shopName}`);
    } catch (err: any) {
      setError(err.message || 'Error searching for shop');
      setSelectedShop(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCloseShop = () => {
    setSelectedShop(null);
    setActiveTab('search');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-4 sm:p-6 border border-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Shop Management</h2>
            <p className="text-sm text-gray-400">Manage shop operations and records</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {selectedShop && (
              <>
                <button
                  onClick={() => setShowFormModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Generate Forms
                </button>
                <button
                  onClick={handleCloseShop}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Close Shop
                </button>
              </>
            )}
          </div>
        </div>
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

      {/* Main Content */}
      {!selectedShop ? (
        <ShopSearch onSearch={handleShopSearch} isLoading={isSearching} />
      ) : (
        <>
          {/* Shop Info Card */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Shop Name</p>
                <p className="text-lg font-semibold text-white mt-1">{selectedShop.shopName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Owner</p>
                <p className="text-lg font-semibold text-white mt-1">{selectedShop.ownerName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">ID</p>
                <p className="text-sm font-mono text-cyan-400 mt-1">{selectedShop.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Phone</p>
                <p className="text-lg font-semibold text-white mt-1">{selectedShop.phone}</p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex overflow-x-auto gap-2 pb-2">
            {[
              { id: 'stock', label: 'Stock', icon: Package },
              { id: 'sales', label: 'Sales', icon: TrendingUp },
              { id: 'expenses', label: 'Expenses', icon: FileText },
              { id: 'reports', label: 'Reports', icon: BarChart3 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'stock' && <StockManagement shop={selectedShop} />}
            {activeTab === 'sales' && <SalesEntry shop={selectedShop} />}
            {activeTab === 'expenses' && <ExpensesEntry shop={selectedShop} />}
            {activeTab === 'reports' && <ReportsView shop={selectedShop} />}
          </div>
        </>
      )}

      {/* Form Generator Modal */}
      {selectedShop && cyberDetails && (
        <FormGeneratorModal
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          shop={selectedShop}
          cyberDetails={cyberDetails}
        />
      )}
    </div>
  );
};

export default ShopTab;
