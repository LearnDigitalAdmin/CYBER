import { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { assetsService, type Asset, type Property, type TenantInput } from '../../services/Assets';

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

interface AddTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  onSuccess: () => void;
}

const AddTenantModal: React.FC<AddTenantModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState<TenantInput>({
    id: 0,
    propertyId: 0,
    userId: asset.id,
    name: '',
    phone: '',
    email: '',
    unitNumber: '',
    rentAmount: 0,
    standingFees: 0,
    depositAmount: 0
  });

  useEffect(() => {
    if (isOpen) {
      loadProperties();
    }
  }, [isOpen]);

  const loadProperties = async () => {
    try {
      const props = await assetsService.getPropertiesByAsset(asset.id);
      setProperties(props);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  if (!isOpen) return null;

  const limits = USER_LIMITS[asset.tier] || USER_LIMITS.free;
  const selectedProperty = properties.find(p => p.id === formData.propertyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.propertyId) {
      setError('Please select a property');
      return;
    }

    if (!selectedProperty) {
      setError('Selected property not found');
      return;
    }

    setLoading(true);

    try {
      // Check total tenants across all properties
      const allTenants = await Promise.all(
        properties.map(p => assetsService.getTenantsByProperty(asset.id, p.id))
      );
      const totalTenants = allTenants.flat().length;

      if (limits.totalTenants !== -1 && totalTenants >= limits.totalTenants) {
        throw new Error(`Maximum ${limits.totalTenants} total tenants allowed for ${asset.tier} tier`);
      }

      // Check tenants per property
      const propertyTenants = await assetsService.getTenantsByProperty(asset.id, formData.propertyId);
      if (limits.tenantsPerProperty !== -1 && propertyTenants.length >= limits.tenantsPerProperty) {
        throw new Error(`Maximum ${limits.tenantsPerProperty} tenants per property for ${asset.tier} tier`);
      }

      // Check against property maxUnits
      if (propertyTenants.length >= selectedProperty.maxUnits) {
        throw new Error(`Property has reached maximum ${selectedProperty.maxUnits} units`);
      }

      await assetsService.createTenant(formData);
      onSuccess();
      onClose();
      
      // Reset form
      setFormData({
        id: 0,
        propertyId: 0,
        userId: asset.id,
        name: '',
        phone: '',
        email: '',
        unitNumber: '',
        rentAmount: 0,
        standingFees: 0,
        depositAmount: 0
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 border border-gray-700 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Add Tenant for {asset.name}</h3>
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
            <label className="block text-sm font-medium text-gray-400 mb-2">Select Property *</label>
            <select
              value={formData.propertyId}
              onChange={(e) => setFormData(prev => ({ ...prev, propertyId: Number(e.target.value) }))}
              required
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"
            >
              <option value="">Choose a property...</option>
              {properties.map(prop => (
                <option key={prop.id} value={prop.id}>
                  {prop.name} ({prop.address || 'No address'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">National ID *</label>
              <input
                type="number"
                value={formData.id}
                onChange={(e) => setFormData(prev => ({ ...prev, id: Number(e.target.value) }))}
                required
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="12345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="0712345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="tenant@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Unit Number</label>
              <input
                type="text"
                value={formData.unitNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, unitNumber: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                placeholder="A101"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Rent Amount *</label>
              <input
                type="number"
                value={formData.rentAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, rentAmount: Number(e.target.value) }))}
                required
                min="0"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Standing Fees</label>
              <input
                type="number"
                value={formData.standingFees}
                onChange={(e) => setFormData(prev => ({ ...prev, standingFees: Number(e.target.value) }))}
                min="0"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Deposit Amount</label>
              <input
                type="number"
                value={formData.depositAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: Number(e.target.value) }))}
                min="0"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                placeholder="5000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Lease Start</label>
              <input
                type="date"
                value={formData.leaseStart}
                onChange={(e) => setFormData(prev => ({ ...prev, leaseStart: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Lease End</label>
              <input
                type="date"
                value={formData.leaseEnd}
                onChange={(e) => setFormData(prev => ({ ...prev, leaseEnd: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
              />
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <p className="text-sm text-emerald-400">
              <strong>{asset.tier.toUpperCase()} Tier:</strong> {limits.totalTenants === -1 ? 'Unlimited' : limits.totalTenants} total tenants, 
              {limits.tenantsPerProperty === -1 ? ' unlimited' : ` ${limits.tenantsPerProperty}`} per property
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
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Creating...</> : 'Create Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTenantModal;