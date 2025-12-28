import { useState, useEffect } from 'react';
import { 
  Film, 
  Clock, 
  CheckCircle, 
  Loader2,
  TrendingUp,
  Calendar,
  Eye
} from 'lucide-react';
import { moviesService, type DashboardStats, type UserRequest } from '../../services/moviesService';
import { useAuth } from '../../context/authContext';

const MoviesDashboard = () => {
  const { firestoreUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRequests, setRecentRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'ready' | 'completed'>('pending');

  useEffect(() => {
    loadDashboardData();
  }, [firestoreUser?.pId]);

  const loadDashboardData = async () => {
    if (!firestoreUser?.pId) return;

    try {
      setLoading(true);
      const [statsData, requestsData] = await Promise.all([
        moviesService.getDashboardStats(firestoreUser.pId),
        moviesService.getUserRequests(firestoreUser.pId)
      ]);

      setStats(statsData);
      setRecentRequests(requestsData.slice(0, 10)); // Get latest 10
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRequests = () => {
    return recentRequests.filter(r => r.status === activeTab);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getContentTitle = (contentId: string) => {
    const content = moviesService.getContentById(contentId);
    return content?.title || 'Unknown';
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5 hover:border-cyan-500/50 transition-all duration-300">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg text-white shadow-lg">
              <Film className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
              Total
            </span>
          </div>
          <div className="text-sm text-gray-400 mb-1">Content Library</div>
          <div className="text-2xl font-bold text-white">{stats?.totalContent || 0}</div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5 hover:border-orange-500/50 transition-all duration-300">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg text-white shadow-lg">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-orange-400 bg-orange-500/10 px-2 py-1 rounded-full border border-orange-500/30">
              {stats?.pendingRequests || 0}
            </span>
          </div>
          <div className="text-sm text-gray-400 mb-1">Pending Requests</div>
          <div className="text-2xl font-bold text-white">{stats?.pendingRequests || 0}</div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5 hover:border-blue-500/50 transition-all duration-300">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg text-white shadow-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/30">
              {stats?.readyRequests || 0}
            </span>
          </div>
          <div className="text-sm text-gray-400 mb-1">Ready to Watch</div>
          <div className="text-2xl font-bold text-white">{stats?.readyRequests || 0}</div>
        </div>

        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-5 hover:border-emerald-500/50 transition-all duration-300">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg text-white shadow-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
              {stats?.completedRequests || 0}
            </span>
          </div>
          <div className="text-sm text-gray-400 mb-1">Completed</div>
          <div className="text-2xl font-bold text-white">{stats?.completedRequests || 0}</div>
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Recent Requests
          </h3>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {(['pending', 'ready', 'completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-700">
                {recentRequests.filter(r => r.status === tab).length}
              </span>
            </button>
          ))}
        </div>

        {/* Requests Table */}
        {getFilteredRequests().length === 0 ? (
          <div className="text-center py-12">
            <Eye className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No {activeTab} requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Content</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Quality</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Plan</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Watch Date</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredRequests().map((request) => (
                  <tr 
                    key={request.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MoviesDashboard;
