import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [signupRequest, setSignupRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  async function fetchUserProfile(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserProfile({ id: userDoc.id, ...userDoc.data() });
        setSignupRequest(null);
      } else {
        setUserProfile(null);
        const requestDoc = await getDoc(doc(db, 'signup_requests', uid));
        if (requestDoc.exists()) {
          setSignupRequest({ id: requestDoc.id, ...requestDoc.data() });
        } else {
          setSignupRequest(null);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  }

  /**
   * Register a new user.
   * Writes to signup_requests (NOT users) — awaiting admin approval.
   * @param {string} email
   * @param {string} password
   * @param {string} name
   * @param {string} role  — the role selected during registration
   */
  async function signup(email, password, name, role) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const requestData = {
      name,
      email,
      role,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'signup_requests', user.uid), requestData);
    setSignupRequest({ id: user.uid, ...requestData });
    setUserProfile(null);
    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    setSignupRequest(null);
    return signOut(auth);
  }

  async function refreshUserProfile() {
    if (currentUser) {
      await fetchUserProfile(currentUser.uid);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsFetchingProfile(true);
        // TEMPORARY SETUP: Automatically create the MTA record for the main user
        await fetchUserProfile(user.uid);
        setIsFetchingProfile(false);
      } else {
        setUserProfile(null);
        setSignupRequest(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const isPendingApproval = !userProfile && signupRequest?.status === 'pending';
  const isRejected = !userProfile && signupRequest?.status === 'rejected';

  const value = {
    currentUser,
    userProfile,
    signupRequest,
    isPendingApproval,
    isRejected,
    signup,
    login,
    logout,
    loading,
    isFetchingProfile,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
