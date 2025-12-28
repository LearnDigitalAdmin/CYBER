// import { 
//   collection, 
//   doc, 
//   getDocs, 
//   addDoc, 
//   updateDoc, 
//   deleteDoc,
//   query,
//   where,
//   Timestamp 
// } from 'firebase/firestore';
// import { db } from './firebaseService';

// Types
export interface MovieContent {
  id: string;
  title: string;
  type: 'movie' | 'series';
  category: string;
  year?: number;
  seasons?: number;
  rating?: string;
  added?: string;
}

export interface UserRequest {
  id: string;
  userId: string;
  userName: string;
  contentId: string;
  quality: string;
  plan: 'hustler' | 'jeshi' | 'legend' | 'bazuu' | 'lipa';
  watchDate: string;
  requestedDate: string;
  status: 'pending' | 'ready' | 'completed';
  cyberId: string;
  season?: number;
  notes?: string;
}

export interface DashboardStats {
  totalRequests: number;
  pendingRequests: number;
  readyRequests: number;
  completedRequests: number;
  totalUsers: number;
  totalContent: number;
}

// Demo Data
const DEMO_CONTENT: MovieContent[] = [
  { id: '1', title: 'The Mandalorian', type: 'series', category: 'Sci-Fi', year: 2019, seasons: 3, rating: '8.7/10', added: '2024-01-15' },
  { id: '2', title: 'Inception', type: 'movie', category: 'Thriller', year: 2010, rating: '8.8/10', added: '2024-01-10' },
  { id: '3', title: 'Breaking Bad', type: 'series', category: 'Drama', year: 2008, seasons: 5, rating: '9.5/10', added: '2024-01-05' },
  { id: '4', title: 'The Dark Knight', type: 'movie', category: 'Action', year: 2008, rating: '9.0/10', added: '2024-01-20' },
  { id: '5', title: 'Stranger Things', type: 'series', category: 'Horror', year: 2016, seasons: 4, rating: '8.7/10', added: '2024-01-12' },
  { id: '6', title: 'Avatar', type: 'movie', category: 'Sci-Fi', year: 2009, rating: '7.8/10', added: '2024-01-18' },
  { id: '7', title: 'Game of Thrones', type: 'series', category: 'Fantasy', year: 2011, seasons: 8, rating: '9.3/10', added: '2024-01-08' },
  { id: '8', title: 'Interstellar', type: 'movie', category: 'Sci-Fi', year: 2014, rating: '8.6/10', added: '2024-01-14' }
];

const DEMO_REQUESTS: UserRequest[] = [
  {
    id: '1',
    userId: 'USER001',
    userName: 'John Doe',
    contentId: '1',
    quality: '1080p',
    plan: 'hustler',
    watchDate: '2024-02-15',
    requestedDate: '2024-02-10',
    status: 'pending',
    cyberId: 'COG-0001',
    season: 2
  },
  {
    id: '2',
    userId: 'USER002',
    userName: 'Jane Smith',
    contentId: '2',
    quality: '4K',
    plan: 'legend',
    watchDate: '2024-02-14',
    requestedDate: '2024-02-09',
    status: 'ready',
    cyberId: 'COG-0001'
  },
  {
    id: '3',
    userId: 'USER003',
    userName: 'Mike Johnson',
    contentId: '3',
    quality: '720p',
    plan: 'jeshi',
    watchDate: '2024-02-13',
    requestedDate: '2024-02-08',
    status: 'completed',
    cyberId: 'COG-0001',
    season: 5
  },
  {
    id: '4',
    userId: 'USER004',
    userName: 'Sarah Williams',
    contentId: '5',
    quality: '1080p',
    plan: 'legend',
    watchDate: '2024-02-16',
    requestedDate: '2024-02-11',
    status: 'pending',
    cyberId: 'COG-0001',
    season: 4
  },
  {
    id: '5',
    userId: 'USER005',
    userName: 'David Brown',
    contentId: '4',
    quality: '1080p',
    plan: 'hustler',
    watchDate: '2024-02-12',
    requestedDate: '2024-02-07',
    status: 'ready',
    cyberId: 'COG-0001'
  }
];

class MoviesService {
  // Content Library Management
  async getContentLibrary(_cyberId: string): Promise<MovieContent[]> {
    try {
      // For now, return demo data
      // In production, fetch from Firestore
      return DEMO_CONTENT;
    } catch (error) {
      console.error('Error fetching content library:', error);
      throw error;
    }
  }

  async addContent(_cyberId: string, content: Omit<MovieContent, 'id'>): Promise<MovieContent> {
    try {
      const newContent: MovieContent = {
        ...content,
        id: Date.now().toString(),
        added: new Date().toISOString().split('T')[0]
      };
      
      // In production, add to Firestore
      DEMO_CONTENT.push(newContent);
      return newContent;
    } catch (error) {
      console.error('Error adding content:', error);
      throw error;
    }
  }

  async updateContent(contentId: string, updates: Partial<MovieContent>): Promise<void> {
    try {
      const index = DEMO_CONTENT.findIndex(c => c.id === contentId);
      if (index !== -1) {
        DEMO_CONTENT[index] = { ...DEMO_CONTENT[index], ...updates };
      }
    } catch (error) {
      console.error('Error updating content:', error);
      throw error;
    }
  }

  async deleteContent(contentId: string): Promise<void> {
    try {
      const index = DEMO_CONTENT.findIndex(c => c.id === contentId);
      if (index !== -1) {
        DEMO_CONTENT.splice(index, 1);
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      throw error;
    }
  }

  // User Requests Management
  async getUserRequests(cyberId: string): Promise<UserRequest[]> {
    try {
      // For now, return demo data
      // In production, fetch from Firestore
      return DEMO_REQUESTS.filter(r => r.cyberId === cyberId);
    } catch (error) {
      console.error('Error fetching user requests:', error);
      throw error;
    }
  }

  async updateRequest(requestId: string, updates: Partial<UserRequest>): Promise<void> {
    try {
      const index = DEMO_REQUESTS.findIndex(r => r.id === requestId);
      if (index !== -1) {
        DEMO_REQUESTS[index] = { ...DEMO_REQUESTS[index], ...updates };
      }
    } catch (error) {
      console.error('Error updating request:', error);
      throw error;
    }
  }

  async deleteRequest(requestId: string): Promise<void> {
    try {
      const index = DEMO_REQUESTS.findIndex(r => r.id === requestId);
      if (index !== -1) {
        DEMO_REQUESTS.splice(index, 1);
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      throw error;
    }
  }

  // Dashboard Stats
  async getDashboardStats(cyberId: string): Promise<DashboardStats> {
    try {
      const requests = await this.getUserRequests(cyberId);
      
      return {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        readyRequests: requests.filter(r => r.status === 'ready').length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        totalUsers: new Set(requests.map(r => r.userId)).size,
        totalContent: DEMO_CONTENT.length
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  // Helper: Get content by ID
  getContentById(contentId: string): MovieContent | undefined {
    return DEMO_CONTENT.find(c => c.id === contentId);
  }
}

export const moviesService = new MoviesService();
