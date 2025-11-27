import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video, Home } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const location = useLocation();

    return (
        <div className="min-h-screen flex flex-col">
            <nav style={{
                borderBottom: '1px solid var(--glass-border)',
                padding: '1rem 2rem',
                background: 'rgba(15, 23, 42, 0.8)',
                backdropFilter: 'blur(8px)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div className="container" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
                        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', padding: '0.5rem', borderRadius: '0.5rem', display: 'flex' }}>
                            <Video size={24} color="white" />
                        </div>
                        <span>VideoEditor</span>
                    </Link>

                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <Link
                            to="/"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                textDecoration: 'none',
                                color: location.pathname === '/' ? 'white' : '#94a3b8',
                                fontWeight: 500
                            }}
                        >
                            <Home size={18} />
                            Home
                        </Link>

                    </div>
                </div>
            </nav>

            <main style={{ flex: 1 }}>
                {children}
            </main>

            <footer style={{ padding: '2rem', textAlign: 'center', color: '#64748b', borderTop: '1px solid var(--glass-border)' }}>
                <p>© 2025 VideoEditor. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default Layout;
