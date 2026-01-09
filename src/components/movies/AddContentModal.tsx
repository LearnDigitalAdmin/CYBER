import { useState } from 'react';
import { X, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { moviesService } from '../../services/moviesService';
import { useAuth } from '../../context/authContext';
import { toast } from 'react-toastify';

interface AddContentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'manual' | 'ai';

const AddContentModal = ({ onClose, onSuccess }: AddContentModalProps) => {
  const { firestoreUser } = useAuth();
  const [mode, setMode] = useState<Mode>('manual');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Manual mode state
  const [manualForm, setManualForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    type: 'movie' as 'movie' | 'series' | 'music',
    category: '',
    description: '',
    trailer: '',
    rating: '',
    seasons: 1,
    poster: null as File | null 
  });
  const [seasonEpisodes, setSeasonEpisodes] = useState<{ [key: number]: number }>({});
  const [posterPreview, setPosterPreview] = useState<string | null>(null);

  // AI mode state
  const [aiForm, setAiForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    type: 'movie' as 'movie' | 'series',
    poster: null as File | null
  });
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiPosterPreview, setAiPosterPreview] = useState<string | null>(null);

  const handleManualPosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = moviesService.validateImage(file);
    if (error) {
      toast.error(error);
      return;
    }

    setManualForm({ ...manualForm, poster: file });
    const reader = new FileReader();
    reader.onloadend = () => {
      setPosterPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAiPosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = moviesService.validateImage(file);
    if (error) {
      toast.error(error);
      return;
    }

    setAiForm({ ...aiForm, poster: file });
    const reader = new FileReader();
    reader.onloadend = () => {
      setAiPosterPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestoreUser?.pId) return;

    try {
      setLoading(true);

      const seasons = manualForm.type === 'series' 
        ? Array.from({ length: manualForm.seasons }, (_, i) => ({
            season: i + 1,
            episodes: seasonEpisodes[i + 1] || 0
          }))
        : undefined;

      await moviesService.addContent(
        firestoreUser.uid,
        {
          ...manualForm,
          poster: manualForm.poster || undefined,
          seasons
        },
        (progress) => setUploadProgress(progress)
      );

      toast.success('Content added successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error adding content:', error);
      toast.error(error.message || 'Failed to add content');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleAiFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestoreUser?.pId) return;

    try {
      setAiLoading(true);
      const result = await moviesService.fetchAIContent(
        aiForm.title,
        aiForm.year,
        aiForm.type
      );
      setAiResult(result);
      toast.success('Content data fetched successfully!');
    } catch (error: any) {
      console.error('Error fetching AI content:', error);
      toast.error(error.message || 'Failed to fetch content data');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiConfirm = async () => {
    if (!firestoreUser?.pId || !aiResult) return;

    try {
      setLoading(true);

      await moviesService.addContent(
        firestoreUser.uid,
        {
          title: aiResult.title,
          year: aiResult.year,
          type: aiResult.type,
          category: aiResult.category,
          description: aiResult.description,
          trailer: aiResult.trailer,
          rating: aiResult.rating,
          seasons: aiResult.seasons,
          poster: aiForm.poster || undefined
        },
        (progress) => setUploadProgress(progress)
      );

      toast.success('Content added successfully via AI!');
      onSuccess();
    } catch (error: any) {
      console.error('Error confirming AI content:', error);
      toast.error(error.message || 'Failed to add content');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const resetAiMode = () => {
    setAiResult(null);
    setAiForm({
      title: '',
      year: new Date().getFullYear(),
      type: 'movie',
      poster: null
    });
    setAiPosterPreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Add Content</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setMode('manual')}
              className={`p-4 rounded-lg border-2 transition-all ${
                mode === 'manual'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <ImageIcon className="w-5 h-5 text-cyan-900" />
                <span className="font-semibold text-green-900">Manual Entry</span>
              </div>
              <div className="text-xs text-gray-400">Enter details yourself</div>
            </button>

            <button
              onClick={() => setMode('ai')}
              className={`p-4 rounded-lg border-2 transition-all ${
                mode === 'ai'
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold text-yellow-900">AI Powered</span>
                <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs rounded-full font-bold">
                  PREMIUM
                </span>
              </div>
              <div className="text-xs text-gray-400">Auto-fetch from AI</div>
            </button>
          </div>

          {/* Manual Mode */}
          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
                  <input
                    type="text"
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Year *</label>
                  <input
                    type="number"
                    value={manualForm.year}
                    onChange={(e) => setManualForm({ ...manualForm, year: parseInt(e.target.value) })}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    required
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Poster Image (JPG, JPEG, PNG)</label>
                <div
                  onClick={() => document.getElementById('posterUpload')?.click()}
                  className="border-2 border-dashed border-gray-700 hover:border-cyan-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
                >
                  <input
                    type="file"
                    id="posterUpload"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleManualPosterUpload}
                    className="hidden"
                    required
                  />
                  {posterPreview ? (
                    <div className="flex items-center gap-4">
                      <img src={posterPreview} alt="Preview" className="w-24 h-36 object-cover rounded-lg" />
                      <div className="text-left">
                        <div className="font-medium text-white">{manualForm.poster?.name}</div>
                        <div className="text-sm text-gray-400">
                          {manualForm.poster && (manualForm.poster.size / 1024).toFixed(2)} KB
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <div className="text-gray-400">Click to upload poster</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">YouTube Trailer Link</label>
                <input
                  type="text"
                  value={manualForm.trailer}
                  onChange={(e) => setManualForm({ ...manualForm, trailer: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  placeholder="https://youtube.com/watch?v=... or video ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Type *</label>
                <select
                  value={manualForm.type}
                  onChange={(e) => setManualForm({ ...manualForm, type: e.target.value as any })}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                  <option value="music">Music</option>
                </select>
              </div>

              {manualForm.type === 'series' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Number of Seasons *</label>
                  <input
                    type="number"
                    value={manualForm.seasons}
                    onChange={(e) => setManualForm({ ...manualForm, seasons: parseInt(e.target.value) })}
                    min="1"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  />
                  
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium text-gray-400">Episodes per Season:</h4>
                    {Array.from({ length: manualForm.seasons }, (_, i) => i + 1).map(season => (
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
                  value={manualForm.category}
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., Action, Drama, Sci-Fi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Rating</label>
                <input
                  type="text"
                  value={manualForm.rating}
                  onChange={(e) => setManualForm({ ...manualForm, rating: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., 8.5/10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  value={manualForm.description}
                  onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Adding Content...
                  </>
                ) : (
                  'Add Content'
                )}
              </button>
            </form>
          )}

          {/* AI Mode */}
          {mode === 'ai' && (
            <div>
              {!aiResult ? (
                <form onSubmit={handleAiFetch} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
                      <input
                        type="text"
                        value={aiForm.title}
                        onChange={(e) => setAiForm({ ...aiForm, title: e.target.value })}
                        required
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500"
                        placeholder="Enter title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Year *</label>
                      <input
                        type="number"
                        value={aiForm.year}
                        onChange={(e) => setAiForm({ ...aiForm, year: parseInt(e.target.value) })}
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        required
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Type *</label>
                    <select
                      value={aiForm.type}
                      onChange={(e) => setAiForm({ ...aiForm, type: e.target.value as any })}
                      required
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Poster Image</label>
                    <div
                      onClick={() => document.getElementById('aiPosterUpload')?.click()}
                      className="border-2 border-dashed border-gray-700 hover:border-violet-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
                    >
                      <input
                        type="file"
                        id="aiPosterUpload"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleAiPosterUpload}
                        className="hidden"
                        required
                      />
                      {aiPosterPreview ? (
                        <div className="flex items-center gap-4">
                          <img src={aiPosterPreview} alt="Preview" className="w-24 h-36 object-cover rounded-lg" />
                          <div className="text-left">
                            <div className="font-medium text-white">{aiForm.poster?.name}</div>
                            <div className="text-sm text-gray-400">
                              {aiForm.poster && (aiForm.poster.size / 1024).toFixed(2)} KB
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                          <div className="text-gray-400">Click to upload poster (optional)</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Fetching from AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Fetch from AI
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white">Review AI Results</h3>
                  
                  <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                    <div>
                      <div className="text-sm text-gray-400">Title</div>
                      <div className="text-white font-medium">{aiResult.title}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Year</div>
                        <div className="text-white font-medium">{aiResult.year}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Type</div>
                        <div className="text-white font-medium capitalize">{aiResult.type}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Category</div>
                      <div className="text-white font-medium">{aiResult.category}</div>
                    </div>
                    {aiResult.rating && (
                      <div>
                        <div className="text-sm text-gray-400">Rating</div>
                        <div className="text-white font-medium">{aiResult.rating}</div>
                      </div>
                    )}
                    {aiResult.seasons && aiResult.seasons.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Seasons</div>
                        <div className="space-y-1">
                          {aiResult.seasons.map((s: any) => (
                            <div key={s.season} className="text-sm text-white">
                              • Season {s.season}: {s.episodes} episodes
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-400">Description</div>
                      <div className="text-white text-sm leading-relaxed">{aiResult.description}</div>
                    </div>
                    {aiResult.trailer && (
                      <div>
                        <div className="text-sm text-gray-400">Trailer</div>
                        <div className="text-green-400 text-sm">✓ Found</div>
                      </div>
                    )}
                  </div>

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Uploading...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-violet-500 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleAiConfirm}
                      disabled={loading}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        '✓ Confirm & Add'
                      )}
                    </button>
                    <button
                      onClick={resetAiMode}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
                    >
                      ✗ Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddContentModal;