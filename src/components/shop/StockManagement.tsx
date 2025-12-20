import { useState, useEffect } from 'react';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import type { Shop, Stock } from '../../services/shopService';
import { addStock, getCurrentStock } from '../../services/shopService';
import { toast } from 'react-toastify';

interface StockManagementProps {
  shop: Shop;
}

const StockManagement: React.FC<StockManagementProps> = ({ shop }) => {
  const [stock, setStock] = useState<Stock>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    productName: '',
    quantity: 0,
    unit: 'pieces',
    date: new Date().toISOString().split('T')[0],
  });

  // Load stock on mount
  useEffect(() => {
    loadStock();
  }, [shop.id]);

  const loadStock = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const currentStock = await getCurrentStock(shop.id);
      setStock(currentStock);
    } catch (err: any) {
      setError(err.message || 'Error loading stock');
      console.error('Error loading stock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    try {
      setIsSaving(true);
      await addStock(
        shop.id,
        formData.productName.trim(),
        formData.quantity,
        formData.unit
      );

      toast.success('Stock added successfully');

      // Reset form and reload
      setFormData({
        productName: '',
        quantity: 0,
        unit: 'pieces',
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      await loadStock();
    } catch (err: any) {
      toast.error(err.message || 'Error adding stock');
      console.error('Error adding stock:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Current Stock</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Stock
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

      {/* Add Stock Form */}
      {showForm && (
        <form onSubmit={handleAddStock} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Product Name"
              value={formData.productName}
              onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />

            <input
              type="number"
              placeholder="Quantity"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              disabled={isSaving}
              min="1"
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />

            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              <option value="pieces">Pieces</option>
              <option value="kg">KG</option>
              <option value="liters">Liters</option>
              <option value="boxes">Boxes</option>
              <option value="bags">Bags</option>
              <option value="units">Units</option>
            </select>

            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Stock'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Stock List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : Object.keys(stock).length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-400">No stock items yet. Add your first item to get started.</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Quantity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Unit</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stock).map(([productName, details]) => (
                  <tr key={productName} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{productName}</td>
                    <td className="px-4 py-3 text-gray-300">{details.quantity}</td>
                    <td className="px-4 py-3 text-gray-300">{details.unit}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {details.lastUpdated ? new Date(details.lastUpdated * 1000).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
