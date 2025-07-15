
"use client";

import type { User, UserProfileData, RotaDocument, RotaSpecificScheduleMetadata } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUserProfile: (updatedData: Partial<UserProfileData>) => Promise<void>;
  addRotaDocument: (rotaDocument: RotaDocument) => Promise<void>;
  updateRotaDocument: (rotaDocument: RotaDocument) => Promise<void>;
  deleteRotaDocument: (rotaId: string) => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initializeNewUserInFirestore = async (firebaseUser: FirebaseUser, email: string) => {
    const newUser: User = {
        id: firebaseUser.uid,
        email,
        isProfileComplete: false,
        rotas: [],
    };
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as User;
                 if (typeof userData.isProfileComplete === 'undefined') {
                    userData.isProfileComplete = false;
                }
                if (!userData.rotas) {
                    userData.rotas = [];
                }
                setUser(userData);
            } else {
                // This case handles if a user exists in Auth but not in Firestore.
                const newUser = await initializeNewUserInFirestore(firebaseUser, firebaseUser.email!);
                setUser(newUser);
            }
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const allowedPublicPaths = ['/login', '/signup', '/about'];

    if (user) {
      if (!user.isProfileComplete && pathname !== '/profile/setup' && !allowedPublicPaths.includes(pathname)) {
        router.push('/profile/setup');
      } else if (user.isProfileComplete && (pathname === '/login' || pathname === '/signup')) {
        router.push('/');
      }
    } else { 
      if (!allowedPublicPaths.includes(pathname) && pathname !== '/profile/setup') { 
        router.push('/about');
      }
    }
  }, [user, loading, router, pathname]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle setting the user and redirecting.
  };

  const signup = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await initializeNewUserInFirestore(userCredential.user, email);
    // onAuthStateChanged will handle setting the user and redirecting.
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    router.push('/about');
  };

  const updateUserProfile = async (updatedData: Partial<UserProfileData>) => {
    if (!user) throw new Error("User not authenticated");
    const userDocRef = doc(db, 'users', user.id);
    await updateDoc(userDocRef, updatedData);
    setUser(prevUser => prevUser ? { ...prevUser, ...updatedData } : null);
  };

  const addRotaDocument = async (rotaDocument: RotaDocument) => {
    if (!user) throw new Error("User not authenticated");
    const userDocRef = doc(db, 'users', user.id);
    await updateDoc(userDocRef, {
        rotas: arrayUnion(rotaDocument)
    });
    setUser(prevUser => {
        if (!prevUser) return null;
        const updatedRotas = [...(prevUser.rotas || []), rotaDocument];
        return { ...prevUser, rotas: updatedRotas };
    });
  };

  const updateRotaDocument = async (updatedRotaDoc: RotaDocument) => {
    if (!user || !user.rotas) throw new Error("User or rotas not found");

    const userDocRef = doc(db, 'users', user.id);
    // To update an item in an array, we must read, modify, and write the whole array.
    const currentRotas = user.rotas || [];
    const updatedRotas = currentRotas.map(rota => rota.id === updatedRotaDoc.id ? updatedRotaDoc : rota);
    
    await updateDoc(userDocRef, { rotas: updatedRotas });

    setUser(prevUser => {
        if (!prevUser) return null;
        return { ...prevUser, rotas: updatedRotas };
    });
  };

  const deleteRotaDocument = async (rotaId: string) => {
    if (!user || !user.rotas) throw new Error("User or rotas not found");
    const userDocRef = doc(db, 'users', user.id);
    
    const rotaToDelete = user.rotas.find(r => r.id === rotaId);
    if (!rotaToDelete) return; // Rota not found, do nothing.

    await updateDoc(userDocRef, {
        rotas: arrayRemove(rotaToDelete)
    });

    setUser(prevUser => {
        if (!prevUser) return null;
        const newRotas = prevUser.rotas.filter(r => r.id !== rotaId);
        return { ...prevUser, rotas: newRotas };
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUserProfile, addRotaDocument, updateRotaDocument, deleteRotaDocument, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
