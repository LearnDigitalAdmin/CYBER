import { useState, useEffect } from 'react';
import { X, Home, Loader2, Trash2, AlertCircle, Users } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseService';
import { assetsService, type Asset, type Property, type Tenant } from '../../services/Assets';

interface ViewPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
  property: Property;
  onSuccess: () => void;
}

const ViewPropertyModal: React.FC<ViewPropertyModalProps> = ({
  isOpen,
  onClose,
  asset,
  property,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [deletingTenant, setDeletingTenant] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTenants();
    }
  }, [isOpen, property]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const tenantsData = await assetsService.getTenantsByProperty(asset.id, property.id);
      setTenants(tenantsData);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    setTenantToDelete(tenant);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;

    setDeletingTenant(tenantToDelete.id.toString());
    setError('');

    try {
      // Delete from Firestore
      const tenantRef = doc(db, 'users', asset.id, 'tenants', tenantToDelete.id.toString());
      await deleteDoc(tenantRef);

      // Reload tenants
      await loadTenants();
      onSuccess();
      setShowDeleteConfirm(false);
      setTenantToDelete(null);
    } catch (error) {
      console.error('Error deleting tenant:', error);
      setError('Failed to delete tenant. Please try again.');
    } finally {
      setDeletingTenant(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Home className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{property.name}</h3>
                <p className="text-sm text-gray-400">{property.address || 'No address provided'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Property Details */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-800/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-700/30 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Owner</p>
              <p className="text-sm font-medium text-white">{asset.name}</p>
            </div>
            <div className="bg-gray-700/30 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Max Units</p>
              <p className="text-sm font-medium text-white">{property.maxUnits} units</p>
            </div>
            <div className="bg-gray-700/30 p-3 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Commission Rate</p>
              <p className="text-sm font-medium text-white">{property.agentCommissionRate}%</p>
            </div>
          </div>
          {property.description && (
            <div className="mt-4 p-3 bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-white">{property.description}</p>
            </div>
          )}
        </div>

        {/* Tenants Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h4 className="text-lg font-semibold text-white">Tenants ({tenants.length}/{property.maxUnits})</h4>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No tenants in this property</p>
              <p className="text-sm text-gray-500 mt-1">Add tenants to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Unit</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Contact</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Rent</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-medium text-white">{tenant.name}</div>
                        <div className="text-xs text-gray-500">ID: {tenant.id}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-300">{tenant.unitNumber || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-300">{tenant.phone || '-'}</div>
                        {tenant.email && (
                          <div className="text-xs text-gray-500">{tenant.email}</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-medium text-white">KES {tenant.rentAmount.toLocaleString()}</div>
                        {tenant.standingFees > 0 && (
                          <div className="text-xs text-gray-500">+{tenant.standingFees} fees</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          tenant.isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                        }`}>
                          {tenant.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleDeleteTenant(tenant)}
                            disabled={Number(deletingTenant) === tenant.id}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete tenant"
                          >
                            {Number(deletingTenant) === tenant.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && tenantToDelete && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete Tenant?</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete <strong className="text-white">{tenantToDelete.name}</strong> from this property? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTenantToDelete(null);
                }}
                disabled={deletingTenant !== null}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingTenant !== null}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                {deletingTenant ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Tenant'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewPropertyModal;