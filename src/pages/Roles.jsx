import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Shield, Plus, Trash2 } from 'lucide-react';

import LoadingSpinner from '../components/LoadingSpinner';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const rolesSnap = await getDocs(collection(db, 'roles'));
      setRoles(rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      toast.error("Failed to fetch custom roles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    
    try {
      setIsSaving(true);
      await addDoc(collection(db, 'roles'), {
        roleName: newRoleName.trim(),
        permissions: ['read:tasks', 'create:tasks'] // base permissions MVP
      });
      toast.success("Role created successfully!");
      setNewRoleName('');
      fetchRoles();
    } catch (error) {
      toast.error("Error creating role");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (id) => {
    if (!window.confirm("Are you sure you want to delete this custom role?")) return;
    try {
      setIsSaving(true);
      await deleteDoc(doc(db, 'roles', id));
      toast.success("Role deleted");
      fetchRoles();
    } catch (error) {
      toast.error("Error deleting role");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Custom Roles</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Add and manage custom organizational roles.</p>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color="var(--accent-primary)" /> Existing Roles
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <span style={{ fontWeight: '500' }}>Admin</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>System Default</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
              <span style={{ fontWeight: '500' }}>Software Engineer</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>System Default</span>
            </div>
            
            {roles.map(role => (
              <div key={role.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: '500' }}>{role.roleName}</span>
                <button 
                  onClick={() => handleDeleteRole(role.id)}
                  disabled={isSaving}
                  style={{ color: 'var(--danger)', padding: '0.25rem', opacity: isSaving ? 0.5 : 1 }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Create Role</h2>
          <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text"
              placeholder="e.g. Architect"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              required
              style={{
                padding: '0.75rem', 
                borderRadius: '6px', 
                border: '1px solid var(--border-color)', 
                background: 'var(--bg-tertiary)', 
                color: 'white',
              }}
            />
            <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', opacity: isSaving ? 0.7 : 1 }}>
              <Plus size={18} /> {isSaving ? 'Processing...' : 'Add Role'}
            </button>
          </form>
        </div>
      </div>
      )}
    </Layout>
  );
}
