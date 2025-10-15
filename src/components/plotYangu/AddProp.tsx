import { useState } from 'react';
import { X, AlertCircle, Loader2, Home } from 'lucide-react';
import { assetsService, type Asset, type PropertyInput } from '../../services/Assets';

type LimitNumber = number | -1;

const USER_LIMITS: Record<string, {
  properties: LimitNumber;
  tenantsPerProperty: LimitNumber;
  totalTenants: LimitNumber;
  storage: boolean;
}> = {
  free: { properties: 1, tenantsPerProperty: 5, totalTenants: 5, storage: false },
  low: { properties: 3, tenantsPerProperty: 10, totalTenants: 30, storage: false },
  business: { properties: 9, tenantsPerProperty: 14, totalTenants: 126, storage: true },
  solo: { properties: 1, tenantsPerProperty: 20, totalTenants: 20, storage: true },
  pro: { properties: 16, tenantsPerProperty: 20, totalTenants: 300, storage: true },
  enterprise: { properties: -1, tenantsPerProperty: -1, totalTenants: -1, storage: true }
};

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  onSuccess: () => void;
}

const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<PropertyInput>({
    userId: asset.id,
    name: '',
    address: '',
    description: '',
    agentCommissionRate: 0,
    maxUnits: 1
  });

  if (!isOpen) return null;

  const limits = USER_LIMITS[asset.tier] || USER_LIMITS.free;
  const maxUnitsAllowed = limits.tenantsPerProperty === -1 ? 999 : limits.tenantsPerProperty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate max units against tier limits
    if (formData.maxUnits && formData.maxUnits > maxUnitsAllowed) {
      setError(`Maximum ${maxUnitsAllowed} units allowed for ${asset.tier} tier`);
      return;
    }

    setLoading(true);

    try {
      // Check if asset has reached property limit
      const currentProperties = await assetsService.getPropertiesByAsset(asset.id);
      if (limits.properties !== -1 && currentProperties.length >= limits.properties) {
        throw new Error(`Maximum ${limits.properties} properties allowed for ${asset.tier} tier`);
      }

      await assetsService.createProperty(formData);
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        userId: asset.id,
        name: '',
        address: '',
        description: '',
        agentCommissionRate: 0,
        maxUnits: 1
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Home className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Add Property for {asset.name}</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Property Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              placeholder="e.g., Greenview Apartments"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              placeholder="Property address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              placeholder="Property details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Agent Commission (%)</label>
              <input
                type="number"
                value={formData.agentCommissionRate}
                onChange={(e) => setFormData(prev => ({ ...prev, agentCommissionRate: Number(e.target.value) }))}
                min="0"
                max="100"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Units * (Max: {maxUnitsAllowed})
              </label>
              <input
                type="number"
                value={formData.maxUnits}
                onChange={(e) => setFormData(prev => ({ ...prev, maxUnits: Number(e.target.value) }))}
                min="1"
                max={maxUnitsAllowed}
                required
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
              />
            </div>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
            <p className="text-sm text-cyan-400">
              <strong>{asset.tier.toUpperCase()} Tier:</strong> {limits.properties === -1 ? 'Unlimited' : limits.properties} properties, 
              up to {limits.tenantsPerProperty === -1 ? 'unlimited' : limits.tenantsPerProperty} tenants per property
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-transparent border-2 border-gray-600 text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white hover:border-gray-500 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 transition-colors font-semibold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Creating...</> : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPropertyModal;