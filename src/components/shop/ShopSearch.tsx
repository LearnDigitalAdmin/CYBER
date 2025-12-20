import React, { useState } from 'react';
import { Search, AlertCircle, Loader2 } from 'lucide-react';

interface ShopSearchProps {
  onSearch: (shopId: string) => void;
  isLoading: boolean;
}

const ShopSearch: React.FC<ShopSearchProps> = ({ onSearch, isLoading }) => {
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchInput.trim()) {
      setError('Please enter a Shop ID or National ID');
      return;
    }

    setError(null);
    onSearch(searchInput.trim());
  };

  return (
    <div className="space-y-4">
      {/* Search Card */}
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-white mb-2">Find Your Shop</h3>
          <p className="text-sm text-gray-400">Search using Shop ID or Owner's National ID</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setError(null);
              }}
              placeholder="Enter Shop ID or National ID..."
              disabled={isLoading}
              className="w-full pl-12 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !searchInput.trim()}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-600/50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search Shop</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Help Card */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-400 mb-2 text-sm">How to find your Shop ID</h4>
        <ul className="text-xs text-blue-300 space-y-1">
          <li>• Shop ID: The unique identifier given when the shop was registered</li>
          <li>• National ID: The owner's national identification number</li>
          <li>• You can use either one to search</li>
        </ul>
      </div>
    </div>
  );
};

export default ShopSearch;
