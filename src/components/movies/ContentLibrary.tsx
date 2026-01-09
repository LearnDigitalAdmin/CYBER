import { useState, useEffect } from 'react';
import { 
  Plus, 
  Film, 
  Tv, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  X,
  Play,
  Calendar,
  Star
} from 'lucide-react';
import { moviesService, type MovieContent } from '../../services/moviesService';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';
import AddContentModal from './AddContentModal';
import EditContentModal from './EditContentModal';

const ContentLibrary = () => {
  const { firestoreUser } = useAuth();
  const [content, setContent] = useState<MovieContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series' | 'music'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<MovieContent | null>(null);

  useEffect(() => {
    loadContent();
  }, [firestoreUser?.pId]);

  const loadContent = async () => {
    if (!firestoreUser?.pId) return;

    try {
      setLoading(true);
      const data = await moviesService.getContentLibrary(firestoreUser.uid);
      setContent(data);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content library');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      await moviesService.deleteContent(firestoreUser!.uid, contentId);
      toast.success('Content deleted successfully');
      loadContent();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const handleOpenAddModal = () => {
    setShowDetailsModal(false);
    setSelectedContent(null);
    setShowAddModal(true);
  };

  const openDetailsModal = (item: MovieContent) => {
    setSelectedContent(item);
    setShowDetailsModal(true);
  };

  const openEditModal = (item: MovieContent) => {
    setSelectedContent(item);
    setShowEditModal(true);
  };

  const filteredContent = content.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-white">Content Library</h3>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Content
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm text-white placeholder-gray-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm text-white"
        >
          <option value="all">All Types</option>
          <option value="movie">Movies</option>
          <option value="series">Series</option>
          <option value="music">Music</option>
        </select>
      </div>

      {/* Content Grid */}
      {filteredContent.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
          <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No content found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredContent.map((item) => (
            <div
              key={item.id}
              className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden hover:border-cyan-500/50 transition-all cursor-pointer group"
              onClick={() => openDetailsModal(item)}
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden">
                {item.poster ? (
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-gray-600">
                      {item.title.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Type Badge */}
                <div className="absolute top-2 right-2">
                  {item.type === 'movie' ? (
                    <Film className="w-5 h-5 text-cyan-400" />
                  ) : item.type === 'series' ? (
                    <Tv className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Play className="w-5 h-5 text-pink-400" />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h4 className="font-semibold text-white text-sm mb-1 truncate">
                  {item.title}
                </h4>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{item.year}</span>
                  <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 capitalize">
                    {item.type}
                  </span>
                </div>
              </div>

              {/* Actions on Hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(item);
                  }}
                  className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteContent(item.id);
                  }}
                  className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedContent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              {/* Close Button */}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {/* Backdrop */}
              <div className="h-64 bg-gradient-to-b from-gray-800 to-gray-900 relative overflow-hidden">
                {selectedContent.poster && (
                  <img
                    src={selectedContent.poster}
                    alt={selectedContent.title}
                    className="w-full h-full object-cover opacity-30 blur-sm"
                  />
                )}
              </div>

              {/* Content */}
              <div className="p-6 -mt-32 relative z-10">
                <div className="flex gap-6">
                  {/* Poster */}
                  <div className="w-48 flex-shrink-0">
                    <div className="aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700">
                      {selectedContent.poster ? (
                        <img
                          src={selectedContent.poster}
                          alt={selectedContent.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl font-bold text-gray-600">
                            {selectedContent.title.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {selectedContent.title}
                    </h2>
                    
                    <div className="flex items-center gap-4 mb-4">
                      <span className="flex items-center gap-1 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {selectedContent.year}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 capitalize text-sm">
                        {selectedContent.type}
                      </span>
                      {selectedContent.rating && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-current" />
                          {selectedContent.rating}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-1">Category</h3>
                        <p className="text-white">{selectedContent.category}</p>
                      </div>

                      {selectedContent.description && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-400 mb-1">Description</h3>
                          <p className="text-gray-300 leading-relaxed">{selectedContent.description}</p>
                        </div>
                      )}

                      {selectedContent.seasons && selectedContent.seasons.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-400 mb-2">Seasons</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedContent.seasons.map((season) => (
                              <div
                                key={season.season}
                                className="px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
                              >
                                <div className="text-xs text-gray-400">Season {season.season}</div>
                                <div className="text-sm text-white font-semibold">{season.episodes} Episodes</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedContent.trailer && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-400 mb-2">Trailer</h3>
                          <div className="aspect-video bg-black rounded-lg overflow-hidden">
                            <iframe
                              src={`https://www.youtube.com/embed/${selectedContent.trailer}`}
                              title="Trailer"
                              className="w-full h-full"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          openEditModal(selectedContent);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleDeleteContent(selectedContent.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal - Will be separate component */}
      {showAddModal && (
        <AddContentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadContent();
          }}
        />
      )}

      {/* Edit Modal - Will be separate component */}
      {showEditModal && selectedContent && (
        <EditContentModal
          content={selectedContent}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadContent();
          }}
        />
      )}
    </div>
  );
};

export default ContentLibrary;