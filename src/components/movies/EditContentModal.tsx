import { useState, useEffect } from 'react';
import { X, Loader2, Image as ImageIcon } from 'lucide-react';
import { moviesService, type MovieContent } from '../../services/moviesService';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';

interface EditContentModalProps {
  content: MovieContent;
  onClose: () => void;
  onSuccess: () => void;
}

const EditContentModal = ({ content, onClose, onSuccess }: EditContentModalProps) => {
  const { firestoreUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    title: content.title,
    year: content.year,
    type: content.type,
    category: content.category,
    description: content.description || '',
    trailer: content.trailer || '',
    rating: content.rating || '',
    seasons: content.seasons?.length || 1,
    poster: null as File | null,
    posterUrl: content.poster || ''
  });
  
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [key: number]: number }>({});
  const [posterPreview, setPosterPreview] = useState<string | null>(content.poster || null);

  useEffect(() => {
    // Initialize season episodes
    if (content.seasons) {
      const episodes: { [key: number]: number } = {};
      content.seasons.forEach(s => {
        episodes[s.season] = s.episodes;
      });
      setSeasonEpisodes(episodes);
    }
  }, [content]);

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = moviesService.validateImage(file);
    if (error) {
      toast.error(error);
      return;
    }

    setFormData({ ...formData, poster: file, posterUrl: '' });
    const reader = new FileReader();
    reader.onloadend = () => {
      setPosterPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestoreUser?.pId) return;

    try {
      setLoading(true);

      const updates: any = {
        title: formData.title,
        year: formData.year,
        category: formData.category,
        description: formData.description,
        trailer: formData.trailer,
        rating: formData.rating
      };

      if (formData.type === 'series') {
        updates.seasons = Array.from({ length: formData.seasons }, (_, i) => ({
          season: i + 1,
          episodes: seasonEpisodes[i + 1] || 0
        }));
      }

      if (formData.poster) {
        updates.poster = formData.poster;
      } else if (formData.posterUrl) {
        updates.posterUrl = formData.posterUrl;
      }

      await moviesService.updateContent(
        firestoreUser.uid,
        content.id,
        updates,
        (progress) => setUploadProgress(progress)
      );

      toast.success('Content updated successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating content:', error);
      toast.error(error.message || 'Failed to update content');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Edit Content</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Year *</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Poster Image</label>
              <div
                onClick={() => document.getElementById('editPosterUpload')?.click()}
                className="border-2 border-dashed border-gray-700 hover:border-cyan-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
              >
                <input
                  type="file"
                  id="editPosterUpload"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handlePosterUpload}
                  className="hidden"
                />
                {posterPreview ? (
                  <div className="flex items-center gap-4">
                    <img src={posterPreview} alt="Preview" className="w-24 h-36 object-cover rounded-lg" />
                    <div className="text-left">
                      <div className="font-medium text-white">
                        {formData.poster?.name || 'Current poster'}
                      </div>
                      {formData.poster && (
                        <div className="text-sm text-gray-400">
                          {(formData.poster.size / 1024).toFixed(2)} KB
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <div className="text-gray-400">Click to upload new poster</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">YouTube Trailer Link</label>
              <input
                type="text"
                value={formData.trailer}
                onChange={(e) => setFormData({ ...formData, trailer: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                placeholder="https://youtube.com/watch?v=... or video ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
              <div className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 capitalize">
                {formData.type}
              </div>
            </div>

            {formData.type === 'series' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Number of Seasons *</label>
                <input
                  type="number"
                  value={formData.seasons}
                  onChange={(e) => setFormData({ ...formData, seasons: parseInt(e.target.value) })}
                  min="1"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                />
                
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-400">Episodes per Season:</h4>
                  {Array.from({ length: formData.seasons }, (_, i) => i + 1).map(season => (
                    <div key={season} className="flex items-center gap-2">
                      <label className="w-24 text-sm text-gray-400">Season {season}:</label>
                      <input
                        type="number"
                        value={seasonEpisodes[season] || ''}
                        onChange={(e) => setSeasonEpisodes({ ...seasonEpisodes, [season]: parseInt(e.target.value) || 0 })}
                        placeholder="Number of episodes"
                        min="1"
                        required
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Category *</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Action, Drama, Sci-Fi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Rating</label>
              <input
                type="text"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., 8.5/10"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 resize-none"
                placeholder="Enter description"
              />
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Content'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditContentModal;