import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="app-container">
      <div className="mobile-only" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '1rem', 
        borderBottom: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 900
      }}>
        <button onClick={() => setIsMobileMenuOpen(true)} style={{ color: 'var(--text-primary)' }}>
          <Menu size={24} />
        </button>
        <span style={{ marginLeft: '1rem', fontWeight: 'bold', fontSize: '1.25rem' }}>
          WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
        </span>
      </div>
      
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
