import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit as firestoreLimit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, functions } from './firebaseService';
import { httpsCallable } from 'firebase/functions';

// Types
export interface MovieContent {
  id: string;
  title: string;
  year: number;
  type: 'movie' | 'series' | 'music';
  category: string;
  description?: string;
  poster?: string;
  trailer?: string; // YouTube video ID or full URL
  seasons?: Array<{ season: number; episodes: number }>;
  rating?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  agentId: string;
}

export interface UserRequest {
  id: string;
  userId: string;
  userName: string;
  contentId: string;
  contentTitle: string;
  quality: '360p' | '720p' | '1080p' | '4K';
  plan: 'hustler' | 'jeshi' | 'legend' | 'bazuu' | 'lipa' | 'lipa-cash';
  watchDate: string;
  requestedDate: string;
  status: 'pending' | 'processing' | 'ready' | 'completed';
  cyberId: string;
  season?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DashboardStats {
  totalContent: number;
  pendingRequests: number;
  readyRequests: number;
  completedRequests: number;
  activeUsers: number;
  todayRevenue: number;
}

export interface AIContentData {
  title: string;
  year: number;
  type: 'movie' | 'series';
  description: string;
  category: string;
  rating?: string;
  seasons?: Array<{ season: number; episodes: number }>;
  trailer?: string;
}

class MoviesService {
  /**
   * Get next content ID
   */
  private async getNextContentId(agentId: string): Promise<number> {
    try {
      const moviesRef = collection(db, 'agents', agentId, 'movies');
      const q = query(moviesRef, orderBy('id', 'desc'), firestoreLimit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return 1;
      }
      
      const lastContent = snapshot.docs[0].data();
      const lastId = typeof lastContent.id === 'number' ? lastContent.id : parseInt(lastContent.id) || 0;
      return lastId + 1;
    } catch (error) {
      console.error('Error getting next content ID:', error);
      return 1;
    }
  }

  /**
   * Upload poster image
   */
  async uploadPoster(
    agentId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `movies/${agentId}/posters/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        
        const uploadTask = uploadBytes(storageRef, file);
        
        uploadTask.then(async (snapshot) => {
          const downloadURL = await getDownloadURL(snapshot.ref);
          if (onProgress) onProgress(100);
          resolve(downloadURL);
        }).catch((error) => {
          console.error('Upload error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Extract YouTube video ID from URL
   */
  extractYouTubeId(url: string): string {
    if (!url) return '';
    
    // If already just an ID
    if (url.length === 11 && !url.includes('/') && !url.includes('?')) {
      return url;
    }
    
    // Extract from full URL
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return url;
  }

  /**
   * Fetch content data from AI (Cloud Function)
   */
  async fetchAIContent(
    title: string,
    type: 'movie' | 'series',
    _user: any
  ): Promise<AIContentData> {
    try {
      // if (!user?.paid !== true) {
      //   throw new Error('User does not have an active paid plan');
      // }
      
      const generateMovieData = httpsCallable(functions, 'generateMovieData');
      const result: any = await generateMovieData({ title, type });
      
      if (!result.data.success) {
        throw new Error(result.data.message || 'Failed to fetch AI content data');
      }
      
      return result.data.data as AIContentData;
    } catch (error: any) {
      console.error('Error fetching AI content:', error);
      throw new Error(error.message || 'Failed to fetch content data from AI');
    }
  }

  /**
   * Add content (manual or AI)
   */
  async addContent(
    agentId: string,
    contentData: {
      title: string;
      year: number;
      type: 'movie' | 'series' | 'music';
      category: string;
      description?: string;
      poster?: File;
      posterUrl?: string;
      trailer?: string;
      seasons?: Array<{ season: number; episodes: number }>;
      rating?: string;
    },
    onProgress?: (progress: number) => void
  ): Promise<MovieContent> {
    try {
      const contentId = await this.getNextContentId(agentId);
      
      // Upload poster if provided
      let posterUrl = contentData.posterUrl || '';
      if (contentData.poster) {
        posterUrl = await this.uploadPoster(agentId, contentData.poster, onProgress);
      }
      
      // Extract YouTube ID from trailer
      const trailerVideoId = contentData.trailer 
        ? this.extractYouTubeId(contentData.trailer) 
        : '';
      
      const content: any = {
        id: contentId,
        title: contentData.title,
        year: contentData.year,
        type: contentData.type,
        category: contentData.category,
        description: contentData.description || '',
        poster: posterUrl,
        trailer: trailerVideoId,
        rating: contentData.rating || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        agentId
      };
      
      if (contentData.type === 'series' && contentData.seasons) {
        content.seasons = contentData.seasons;
      }
      
      const contentRef = doc(db, 'agents', agentId, 'movies', contentId.toString());
      await setDoc(contentRef, content);
      
      return { ...content, id: contentId.toString() } as MovieContent;
    } catch (error) {
      console.error('Error adding content:', error);
      throw error;
    }
  }

  /**
   * Get content library
   */
  async getContentLibrary(agentId: string): Promise<MovieContent[]> {
    try {
      const moviesRef = collection(db, 'agents', agentId, 'movies');
      const q = query(moviesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MovieContent));
    } catch (error) {
      console.error('Error fetching content library:', error);
      return [];
    }
  }

  /**
   * Get single content by ID
   */
  async getContentById(agentId: string, contentId: string | number): Promise<MovieContent | null> {
    try {
      // Ensure contentId is a string for Firestore operations
      const contentIdStr = String(contentId);
      
      const contentRef = doc(db, 'agents', agentId, 'movies', contentIdStr);
      const contentDoc = await getDoc(contentRef);
      
      if (contentDoc.exists()) {
        return { id: contentDoc.id, ...contentDoc.data() } as MovieContent;
      }
      return null;
    } catch (error) {
      console.error('Error fetching content:', error);
      return null;
    }
  }

  /**
   * Update content
   */
  async updateContent(
    agentId: string,
    contentId: string | number,
    updates: Partial<{
      title: string;
      year: number;
      category: string;
      description: string;
      poster: File;
      posterUrl: string;
      trailer: string;
      seasons: Array<{ season: number; episodes: number }>;
      rating: string;
    }>,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      // Ensure contentId is a string for Firestore operations
      const contentIdStr = String(contentId);
      
      const contentRef = doc(db, 'agents', agentId, 'movies', contentIdStr);
      const contentDoc = await getDoc(contentRef);
      
      if (!contentDoc.exists()) {
        throw new Error('Content not found');
      }
      
      const updateData: any = {
        updatedAt: Timestamp.now()
      };
      
      // Upload new poster if provided
      if (updates.poster) {
        updateData.poster = await this.uploadPoster(agentId, updates.poster, onProgress);
      } else if (updates.posterUrl) {
        updateData.poster = updates.posterUrl;
      }
      
      // Extract YouTube ID from trailer
      if (updates.trailer !== undefined) {
        updateData.trailer = updates.trailer ? this.extractYouTubeId(updates.trailer) : '';
      }
      
      // Add other fields
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.year !== undefined) updateData.year = updates.year;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.rating !== undefined) updateData.rating = updates.rating;
      if (updates.seasons !== undefined) updateData.seasons = updates.seasons;
      
      await updateDoc(contentRef, updateData);
    } catch (error) {
      console.error('Error updating content:', error);
      throw error;
    }
  }

  /**
   * Delete content
   */
  async deleteContent(agentId: string, contentId: string | number): Promise<void> {
    try {
      // Ensure contentId is a string for Firestore operations
      const contentIdStr = String(contentId);
      
      // Get content to delete poster
      const content = await this.getContentById(agentId, contentIdStr);
      
      if (content && content.poster) {
        try {
          // Only delete if it's a storage URL (contains 'firebasestorage')
          if (content.poster.includes('firebasestorage')) {
            const posterRef = ref(storage, content.poster);
            await deleteObject(posterRef);
          }
        } catch (error) {
          console.warn('Error deleting poster from storage:', error);
        }
      }
      
      const contentRef = doc(db, 'agents', agentId, 'movies', contentIdStr);
      await deleteDoc(contentRef);
    } catch (error) {
      console.error('Error deleting content:', error);
      throw error;
    }
  }

  /**
   * Get user requests
   */
  async getUserRequests(cyberId: string): Promise<UserRequest[]> {
    try {
      const requestsRef = collection(db, 'agents', cyberId, 'movie-requests');
      const q = query(requestsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserRequest));
    } catch (error) {
      console.error('Error fetching user requests:', error);
      return [];
    }
  }

  /**
   * Get requests by status
   */
  async getRequestsByStatus(
    cyberId: string,
    status: 'pending' | 'processing' | 'ready' | 'completed'
  ): Promise<UserRequest[]> {
    try {
      const requestsRef = collection(db, 'agents', cyberId, 'movie-requests');
      const q = query(
        requestsRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UserRequest));
    } catch (error) {
      console.error('Error fetching requests by status:', error);
      return [];
    }
  }

  /**
   * Update request status
   */
  async updateRequest(
    cyberId: string,
    requestId: string,
    updates: Partial<{
      status: 'pending' | 'processing' | 'ready' | 'completed';
      notes: string;
    }>
  ): Promise<void> {
    try {
      const requestRef = doc(db, 'agents', cyberId, 'movie-requests', requestId);
      await updateDoc(requestRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating request:', error);
      throw error;
    }
  }

  /**
   * Bulk update request statuses
   */
  async bulkUpdateRequests(
    cyberId: string,
    requestIds: string[],
    status: 'pending' | 'processing' | 'ready' | 'completed'
  ): Promise<void> {
    try {
      const updatePromises = requestIds.map(requestId =>
        this.updateRequest(cyberId, requestId, { status })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error bulk updating requests:', error);
      throw error;
    }
  }

  /**
   * Delete request
   */
  async deleteRequest(cyberId: string, requestId: string): Promise<void> {
    try {
      const requestRef = doc(db, 'agents', cyberId, 'movie-requests', requestId);
      await deleteDoc(requestRef);
    } catch (error) {
      console.error('Error deleting request:', error);
      throw error;
    }
  }

  /**
   * Bulk delete requests
   */
  async bulkDeleteRequests(cyberId: string, requestIds: string[]): Promise<void> {
    try {
      const deletePromises = requestIds.map(requestId =>
        this.deleteRequest(cyberId, requestId)
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error bulk deleting requests:', error);
      throw error;
    }
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(cyberId: string): Promise<DashboardStats> {
    try {
      const [content, requests] = await Promise.all([
        this.getContentLibrary(cyberId),
        this.getUserRequests(cyberId)
      ]);
      
      const activeRequests = requests.filter(r => r.status !== 'completed');
      
      // Calculate today's revenue (if plan prices are defined)
      const planPrices: Record<string, number> = {
        hustler: 50,
        jeshi: 100,
        legend: 150,
        bazuu: 200,
        lipa: 0,
        'lipa-cash': 0
      };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayRevenue = requests
        .filter(r => {
          const requestDate = r.createdAt.toDate();
          requestDate.setHours(0, 0, 0, 0);
          return requestDate.getTime() === today.getTime();
        })
        .reduce((sum, r) => sum + (planPrices[r.plan] || 0), 0);
      
      return {
        totalContent: content.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        readyRequests: requests.filter(r => r.status === 'ready').length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        activeUsers: new Set(activeRequests.map(r => r.userId)).size,
        todayRevenue
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalContent: 0,
        pendingRequests: 0,
        readyRequests: 0,
        completedRequests: 0,
        activeUsers: 0,
        todayRevenue: 0
      };
    }
  }

  /**
   * Search content by title
   */
  async searchContent(agentId: string, searchTerm: string): Promise<MovieContent[]> {
    try {
      const content = await this.getContentLibrary(agentId);
      const lowerSearch = searchTerm.toLowerCase();
      
      return content.filter(item =>
        item.title.toLowerCase().includes(lowerSearch) ||
        item.category.toLowerCase().includes(lowerSearch) ||
        item.description?.toLowerCase().includes(lowerSearch)
      );
    } catch (error) {
      console.error('Error searching content:', error);
      return [];
    }
  }

  /**
   * Filter content by type
   */
  async getContentByType(
    agentId: string,
    type: 'movie' | 'series' | 'music'
  ): Promise<MovieContent[]> {
    try {
      const moviesRef = collection(db, 'agents', agentId, 'movies');
      const q = query(
        moviesRef,
        where('type', '==', type),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MovieContent));
    } catch (error) {
      console.error('Error fetching content by type:', error);
      return [];
    }
  }

  /**
   * Filter content by category
   */
  async getContentByCategory(agentId: string, category: string): Promise<MovieContent[]> {
    try {
      const moviesRef = collection(db, 'agents', agentId, 'movies');
      const q = query(
        moviesRef,
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as MovieContent));
    } catch (error) {
      console.error('Error fetching content by category:', error);
      return [];
    }
  }

  /**
   * Validate image file
   */
  validateImage(file: File): string | null {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      return 'Only JPEG, PNG, and WebP images are allowed';
    }

    if (file.size > maxSize) {
      return 'Image must be less than 5MB';
    }

    return null;
  }

  /**
   * Validate YouTube URL
   */
  validateYouTubeUrl(url: string): boolean {
    if (!url) return true; // Empty is valid (optional field)
    
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{11}/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]{11}/,
      /^[a-zA-Z0-9_-]{11}$/ // Just the video ID
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * Get content statistics
   */
  async getContentStatistics(agentId: string): Promise<{
    totalMovies: number;
    totalSeries: number;
    totalMusic: number;
    categoriesCount: Record<string, number>;
    recentContent: MovieContent[];
  }> {
    try {
      const content = await this.getContentLibrary(agentId);
      
      const categoriesCount: Record<string, number> = {};
      content.forEach(item => {
        categoriesCount[item.category] = (categoriesCount[item.category] || 0) + 1;
      });
      
      return {
        totalMovies: content.filter(c => c.type === 'movie').length,
        totalSeries: content.filter(c => c.type === 'series').length,
        totalMusic: content.filter(c => c.type === 'music').length,
        categoriesCount,
        recentContent: content.slice(0, 5)
      };
    } catch (error) {
      console.error('Error fetching content statistics:', error);
      return {
        totalMovies: 0,
        totalSeries: 0,
        totalMusic: 0,
        categoriesCount: {},
        recentContent: []
      };
    }
  }
}

export const moviesService = new MoviesService();