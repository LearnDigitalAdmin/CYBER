import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import type { Shop, Expense } from '../../services/shopService';
import { recordExpense, getExpenses, deleteExpense, generateDateCode } from '../../services/shopService';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';

interface ExpensesEntryProps {
  shop: Shop;
}

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Supplies',
  'Staff Wages',
  'Maintenance',
  'Transportation',
  'Insurance',
  'Marketing',
  'Other',
];

const ExpensesEntry: React.FC<ExpensesEntryProps> = ({ shop }) => {
  const { firestoreUser } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
    category: 'Other',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
  });

  // Load expenses on mount
  useEffect(() => {
    loadExpenses();
  }, [shop.id]);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const expensesData = await getExpenses(shop.id, dateFilter.start, dateFilter.end);
      setExpenses(expensesData);
    } catch (err: any) {
      setError(err.message || 'Error loading expenses');
      console.error('Error loading expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    try {
      setIsSaving(true);
      await recordExpense(
        shop.id,
        formData.category,
        formData.amount,
        firestoreUser?.phone || 'unknown'
      );

      toast.success('Expense recorded successfully');

      // Reset form and reload
      setFormData({
        category: 'Other',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      await loadExpenses();
    } catch (err: any) {
      toast.error(err.message || 'Error recording expense');
      console.error('Error recording expense:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      setIsDeleting(expense.id);
      const dateCode = generateDateCode(new Date(expense.timestamp * 1000));
      await deleteExpense(shop.id, dateCode, expense.id);
      toast.success('Expense deleted successfully');
      await loadExpenses();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting expense');
      console.error('Error deleting expense:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-white">Expenses Record</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Record Expense
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

      {/* Add Expense Form */}
      {showForm && (
        <form onSubmit={handleAddExpense} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Amount (KES)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
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
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white rounded transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Expense'
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
              onClick={loadExpenses}
              disabled={isLoading}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white rounded transition-colors text-sm font-semibold disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Filter'}
            </button>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
          <p className="text-gray-400">No expenses recorded yet. Record your first expense to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-gray-400 mb-2">
            Total Expenses: <span className="font-semibold text-orange-400">{expenses.length}</span> | Total Amount:{' '}
            <span className="font-semibold text-orange-400">
              KES {expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900">
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{expense.category}</td>
                      <td className="px-4 py-3 text-orange-400 font-semibold">KES {expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(expense.timestamp * 1000).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteExpense(expense)}
                          disabled={isDeleting === expense.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                        >
                          {isDeleting === expense.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

export default ExpensesEntry;
