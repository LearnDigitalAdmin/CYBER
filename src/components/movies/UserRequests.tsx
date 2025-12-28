import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Edit2, 
  CheckCircle, 
  Trash2, 
  Loader2, 
  X} from 'lucide-react';
import { moviesService, type UserRequest } from '../../services/moviesService';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';

const UserRequests = () => {
  const { firestoreUser } = useAuth();
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'hustler' | 'jeshi' | 'legend' | 'bazuu' | 'lipa'>('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(null);

  // Edit form state
  const [editStatus, setEditStatus] = useState<'pending' | 'ready' | 'completed'>('pending');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    loadRequests();
  }, [firestoreUser?.pId]);

  const loadRequests = async () => {
    if (!firestoreUser?.pId) return;

    try {
      setLoading(true);
      const data = await moviesService.getUserRequests(firestoreUser.pId);
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request: UserRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const handleEditRequest = (request: UserRequest) => {
    setSelectedRequest(request);
    setEditStatus(request.status);
    setEditNotes(request.notes || '');
    setShowEditModal(true);
  };

  const handleUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await moviesService.updateRequest(selectedRequest.id, {
        status: editStatus,
        notes: editNotes
      });
      toast.success('Request updated successfully');
      setShowEditModal(false);
      setSelectedRequest(null);
      loadRequests();
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Failed to update request');
    }
  };

  const handleMarkComplete = async (requestId: string) => {
    try {
      await moviesService.updateRequest(requestId, { status: 'completed' });
      toast.success('Request marked as completed');
      loadRequests();
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.error('Failed to mark as complete');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      await moviesService.deleteRequest(requestId);
      toast.success('Request deleted successfully');
      loadRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getContentTitle = (contentId: string) => {
    const content = moviesService.getContentById(contentId);
    return content?.title || 'Unknown';
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getContentTitle(request.contentId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = planFilter === 'all' || request.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  // Count requests by plan
  const planCounts = {
    all: requests.filter(r => r.status !== 'completed').length,
    hustler: requests.filter(r => r.plan === 'hustler' && r.status !== 'completed').length,
    jeshi: requests.filter(r => r.plan === 'jeshi' && r.status !== 'completed').length,
    legend: requests.filter(r => r.plan === 'legend' && r.status !== 'completed').length,
    bazuu: requests.filter(r => r.plan === 'bazuu' && r.status !== 'completed').length,
    lipa: requests.filter(r => r.plan === 'lipa' && r.status !== 'completed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Users className="w-5 h-5 text-cyan-400" />
        User Requests
      </h3>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm text-white placeholder-gray-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as any)}
          className="px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm text-white"
        >
          <option value="all">All Plans ({planCounts.all})</option>
          <option value="hustler">Hustler ({planCounts.hustler})</option>
          <option value="jeshi">Jeshi ({planCounts.jeshi})</option>
          <option value="legend">Legend ({planCounts.legend})</option>
          <option value="bazuu">Bazuu ({planCounts.bazuu})</option>
          <option value="lipa">Lipa ({planCounts.lipa})</option>
        </select>
      </div>

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No requests found</p>
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Content</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Quality</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Watch Date</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr 
                    key={request.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => handleViewRequest(request)}
                  >
                    <td className="py-4 px-4">
                      <div className="font-medium text-white">{request.userName}</div>
                      <div className="text-xs text-gray-500">{request.userId}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-white">
                        {getContentTitle(request.contentId)}
                        {request.season && (
                          <span className="text-gray-400 ml-1">- S{request.season}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-300">{request.quality}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize bg-violet-500/10 text-violet-400 border border-violet-500/30">
                        {request.plan}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-400">
                      {formatDate(request.watchDate)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span 
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize ${
                          request.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                            : request.status === 'ready'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditRequest(request)}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {request.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkComplete(request.id)}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Mark Complete"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRequest(request.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Request Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Content</div>
                <div className="text-lg font-semibold text-white">
                  {getContentTitle(selectedRequest.contentId)}
                  {selectedRequest.season && ` - Season ${selectedRequest.season}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">User</div>
                  <div className="font-medium text-white">{selectedRequest.userName}</div>
                  <div className="text-sm text-gray-500">{selectedRequest.userId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Plan</div>
                  <div className="font-medium text-white capitalize">{selectedRequest.plan}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Quality</div>
                  <div className="font-medium text-white">{selectedRequest.quality}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Cyber ID</div>
                  <div className="font-medium text-white">{selectedRequest.cyberId}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Requested Date</div>
                  <div className="font-medium text-white">{formatDate(selectedRequest.requestedDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Watch Date</div>
                  <div className="font-medium text-white">{formatDate(selectedRequest.watchDate)}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <span 
                  className={`inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize ${
                    selectedRequest.status === 'completed' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : selectedRequest.status === 'ready'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                  }`}
                >
                  {selectedRequest.status}
                </span>
              </div>

              {selectedRequest.notes && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Notes</div>
                  <div className="p-3 bg-gray-800 rounded-lg text-white text-sm">
                    {selectedRequest.notes}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditRequest(selectedRequest);
                  }}
                  className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                >
                  Edit Request
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Edit Request</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="pending">Pending</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 resize-none"
                  placeholder="Add any notes or comments..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRequests;
