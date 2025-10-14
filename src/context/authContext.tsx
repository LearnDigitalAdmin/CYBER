// hooks/useAuth.tsx
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '../services/firebaseService';
import { query, collection, where, limit, getDocs } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  firestoreUser: any | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('🔵 [AuthProvider] Component rendered');
  console.log('🔵 [AuthProvider] Current State:', {
    currentUser: currentUser?.uid || 'null',
    currentUserEmail: currentUser?.email || 'null',
    firestoreUser: firestoreUser || 'null',
    loading
  });

  const fetchFirestoreUser = async (email: string, phoneNumber?: string | null) => {
    console.log('📥 [fetchFirestoreUser] Starting fetch');
    console.log('📥 [fetchFirestoreUser] Email:', email);
    console.log('📥 [fetchFirestoreUser] Phone:', phoneNumber || 'null');
    
    try {
      let usersQuery;
      
      // Query by email if available
      if (email) {
        console.log('📥 [fetchFirestoreUser] Querying by email:', email.toLowerCase().trim());
        usersQuery = query(
          collection(db, 'users'),
          where('email', '==', email.toLowerCase().trim()),
          limit(1)
        );
      } 
      // Query by phone if email not available
      else if (phoneNumber) {
        console.log('📥 [fetchFirestoreUser] Querying by phone:', phoneNumber);
        usersQuery = query(
          collection(db, 'users'),
          where('phoneNumber', '==', phoneNumber),
          limit(1)
        );
      } else {
        console.error('❌ [fetchFirestoreUser] No email or phone number provided');
        return;
      }
      
      console.log('📥 [fetchFirestoreUser] Executing query...');
      const querySnapshot = await getDocs(usersQuery);
      console.log('📥 [fetchFirestoreUser] Query complete. Empty:', querySnapshot.empty);
      console.log('📥 [fetchFirestoreUser] Documents found:', querySnapshot.size);
      
      if (querySnapshot.empty) {
        console.warn('⚠️ [fetchFirestoreUser] User not found in Firestore');
        console.warn('⚠️ [fetchFirestoreUser] Searched for:', { email, phoneNumber });
        setFirestoreUser(null);
      } else {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        console.log('✅ [fetchFirestoreUser] Fetched user data:', userData);
        console.log('✅ [fetchFirestoreUser] Document ID:', userDoc.id);
        
        // Include the document ID in the user data
        setFirestoreUser({ ...userData, id: userDoc.id });
      }
    } catch (error) {
      console.error('❌ [fetchFirestoreUser] Error:', error);
      console.error('❌ [fetchFirestoreUser] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  };

  const refreshUser = async () => {
    console.log('🔄 [refreshUser] Called');
    if (currentUser) {
      console.log('🔄 [refreshUser] Refreshing user data');
      console.log('🔄 [refreshUser] User email:', currentUser.email);
      console.log('🔄 [refreshUser] User phone:', currentUser.phoneNumber);
      await fetchFirestoreUser(currentUser.email || '', currentUser.phoneNumber);
      console.log('🔄 [refreshUser] User data refresh complete');
    } else {
      console.warn('⚠️ [refreshUser] No current user to refresh');
    }
  };

  useEffect(() => {
    console.log('🎬 [useEffect] Auth state listener initializing');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 [onAuthStateChanged] Auth state changed');
      console.log('🔐 [onAuthStateChanged] Firebase User:', {
        uid: firebaseUser?.uid || 'null',
        email: firebaseUser?.email || 'null',
        phoneNumber: firebaseUser?.phoneNumber || 'null',
        emailVerified: firebaseUser?.emailVerified || false,
        isAnonymous: firebaseUser?.isAnonymous || false,
        metadata: {
          creationTime: firebaseUser?.metadata.creationTime,
          lastSignInTime: firebaseUser?.metadata.lastSignInTime
        }
      });
      
      setCurrentUser(firebaseUser);
      console.log('🔐 [onAuthStateChanged] currentUser state updated');
      
      if (firebaseUser) {
        console.log('🔐 [onAuthStateChanged] User is authenticated, fetching Firestore data...');
        
        // Use email or phone number to query Firestore
        if (firebaseUser.email) {
          console.log('🔐 [onAuthStateChanged] Fetching by email:', firebaseUser.email);
          await fetchFirestoreUser(firebaseUser.email, firebaseUser.phoneNumber);
        } else if (firebaseUser.phoneNumber) {
          console.log('🔐 [onAuthStateChanged] Fetching by phone:', firebaseUser.phoneNumber);
          await fetchFirestoreUser('', firebaseUser.phoneNumber);
        } else {
          console.error('❌ [onAuthStateChanged] No email or phone number available!');
        }
      } else {
        console.log('🔐 [onAuthStateChanged] User is not authenticated, clearing Firestore data');
        setFirestoreUser(null);
      }
      
      setLoading(false);
      console.log('🔐 [onAuthStateChanged] Loading state set to false');
    });

    return () => {
      console.log('🛑 [useEffect] Auth state listener cleanup');
      unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    firestoreUser,
    loading,
    refreshUser
  };

  console.log('📦 [AuthProvider] Context value:', {
    hasCurrentUser: !!currentUser,
    hasFirestoreUser: !!firestoreUser,
    loading,
    currentUserEmail: currentUser?.email || 'N/A',
    currentUserPhone: currentUser?.phoneNumber || 'N/A',
    firestoreUserKeys: firestoreUser ? Object.keys(firestoreUser) : [],
    firestoreUserId: firestoreUser?.id || 'N/A'
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  console.log('🎣 [useAuth] Hook called');
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    console.error('❌ [useAuth] Hook used outside of AuthProvider!');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  console.log('🎣 [useAuth] Context retrieved:', {
    hasCurrentUser: !!context.currentUser,
    hasFirestoreUser: !!context.firestoreUser,
    loading: context.loading,
    firestoreUserId: context.firestoreUser?.id || 'N/A'
  });
  
  return context;
};