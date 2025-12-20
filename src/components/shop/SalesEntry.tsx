import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import type { Shop, Sale } from '../../services/shopService';
import { recordSale, getSales, deleteSale, generateDateCode } from '../../services/shopService';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';

interface SalesEntryProps {
  shop: Shop;
}

const SalesEntry: React.FC<SalesEntryProps> = ({ shop }) => {
  const { firestoreUser } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Form state
  const [formData, setFormData] = useState({
    productName: '',
    quantity: 0,
    unit: 'pieces',
    pricePerUnit: 0,
    date: new Date().toISOString().split('T')[0],
  });

  // Load sales on mount
  useEffect(() => {
    loadSales();
  }, [shop.id]);

  const loadSales = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const salesData = await getSales(shop.id, dateFilter.start, dateFilter.end);
      setSales(salesData);
    } catch (err: any) {
      setError(err.message || 'Error loading sales');
      console.error('Error loading sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (formData.pricePerUnit <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    try {
      setIsSaving(true);
      await recordSale(
        shop.id,
        formData.productName.trim(),
        formData.quantity,
        formData.unit,
        formData.pricePerUnit,
        firestoreUser?.phone || 'unknown'
      );

      toast.success('Sale recorded successfully');

      // Reset form and reload
      setFormData({
        productName: '',
        quantity: 0,
        unit: 'pieces',
        pricePerUnit: 0,
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      await loadSales();
    } catch (err: any) {
      toast.error(err.message || 'Error recording sale');
      console.error('Error recording sale:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    if (!confirm('Are you sure you want to delete this sale?')) return;

    try {
      setIsDeleting(sale.id);
      const dateCode = generateDateCode(new Date(sale.timestamp * 1000));
      await deleteSale(shop.id, dateCode, sale.id);
      toast.success('Sale deleted successfully');
      await loadSales();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting sale');
      console.error('Error deleting sale:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-white">Sales Record</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Sale
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

      {/* Add Sale Form */}
      {showForm && (
        <form onSubmit={handleAddSale} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
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
              type="number"
              placeholder="Price per Unit (KES)"
              value={formData.pricePerUnit}
              onChange={(e) => setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || 0 })}
              disabled={isSaving}
              min="0"
              step="0.01"
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />

            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />

            <div className="flex items-center py-2 px-4 bg-gray-900/50 rounded border border-gray-600">
              <span className="text-gray-400 text-sm">Total: </span>
              <span className="ml-2 text-lg font-semibold text-cyan-400">
                KES {(formData.quantity * formData.pricePerUnit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Sale'
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

      {/* Date Filter */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2">From Date</label>
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">To Date</label>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={loadSales}
              disabled={isLoading}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white rounded transition-colors text-sm font-semibold disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Filter'}
            </button>
          </div>
        </div>
      </div>

      {/* Sales List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : sales.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-400">No sales recorded yet. Record your first sale to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-400 mb-2">
            Total Sales: <span className="font-semibold text-cyan-400">{sales.length}</span> | Total Amount:{' '}
            <span className="font-semibold text-cyan-400">
              KES {sales.reduce((sum, s) => sum + s.totalPrice, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900">
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Product</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Qty</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Price</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{sale.productName}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {sale.quantity} {sale.unit}
                      </td>
                      <td className="px-4 py-3 text-gray-300">KES {sale.pricePerUnit.toFixed(2)}</td>
                      <td className="px-4 py-3 text-cyan-400 font-semibold">KES {sale.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(sale.timestamp * 1000).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteSale(sale)}
                          disabled={isDeleting === sale.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                        >
                          {isDeleting === sale.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesEntry;
