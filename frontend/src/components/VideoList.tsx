import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, Clock, CheckCircle, XCircle, Loader, RefreshCw, Play } from 'lucide-react';
import { getClientId } from '../utils/user';

interface Video {
    id: string;
    original_bucket: string;
    original_object_key: string;
    status: string;
    created_at: string;
    client_job_id: string;
    downloadUrl?: string;
}

const VideoList: React.FC = () => {
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [checkingId, setCheckingId] = useState<string | null>(null);

    const fetchVideos = async () => {
        try {
            const response = await axios.get('/api/v1/videos');
            if (response.data && response.data.video) {
                const clientId = getClientId();
                // Sort by newest first
                const userVideos = response.data.video
                    .filter((v: Video) => v.client_job_id === clientId)
                    .sort((a: Video, b: Video) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setVideos(userVideos);
            }
        } catch (error) {
            console.error('Failed to fetch videos:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchVideos();
    };

    const checkStatus = async (videoId: string) => {
        setCheckingId(videoId);
        try {
            const response = await axios.get(`/api/v1/videos/${videoId}`);
            if (response.data && response.data.video) {
                const updatedVideo = response.data.video;
                setVideos(prev => prev.map(v => v.id === videoId ? { ...v, ...updatedVideo } : v));

                if (updatedVideo.downloadUrl) {
                    window.open(updatedVideo.downloadUrl, '_blank');
                } else if (updatedVideo.status === 'COMPLETED') {
                    // If completed but no URL in initial response, it might be in the message or handled differently
                    // But based on API, it returns downloadUrl if completed.
                    alert('Video is completed but download URL is missing. Try refreshing.');
                } else {
                    alert(`Current status: ${updatedVideo.status}`);
                }
            }
        } catch (error) {
            console.error('Failed to check status:', error);
            alert('Failed to check status');
        } finally {
            setCheckingId(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle size={20} color="#10b981" />;
            case 'PROCESSING':
            case 'UPLOADED':
                return <Loader size={20} className="animate-spin" color="#3b82f6" />;
            case 'FAILED':
            case 'QUEUE_FAILED':
                return <XCircle size={20} color="#ef4444" />;
            default:
                return <Clock size={20} color="#f59e0b" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'rgba(16, 185, 129, 0.1)';
            case 'PROCESSING':
            case 'UPLOADED': return 'rgba(59, 130, 246, 0.1)';
            case 'FAILED':
            case 'QUEUE_FAILED': return 'rgba(239, 68, 68, 0.1)';
            default: return 'rgba(245, 158, 11, 0.1)';
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
                <Loader size={48} className="animate-spin" color="var(--primary-color)" />
            </div>
        );
    }

    return (
        <div className="container animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', margin: 0 }}>My Videos</h2>
                <button
                    onClick={handleRefresh}
                    className="btn btn-secondary"
                    disabled={refreshing}
                >
                    <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {videos.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <Play size={40} color="var(--primary-color)" />
                    </div>
                    <h3 style={{ marginBottom: '0.5rem' }}>No projects yet</h3>
                    <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Start by creating your first video project!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {videos.map((video) => (
                        <div key={video.id} className="glass-panel" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '1.5rem',
                            transition: 'all 0.2s ease',
                            borderLeft: `4px solid ${video.status === 'COMPLETED' ? '#10b981' :
                                video.status === 'FAILED' || video.status === 'QUEUE_FAILED' ? '#ef4444' :
                                    '#3b82f6'
                                }`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{
                                    background: getStatusColor(video.status),
                                    padding: '1rem',
                                    borderRadius: '0.5rem',
                                }}>
                                    {getStatusIcon(video.status)}
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>
                                        {video.original_object_key.split('-').slice(1).join('-') || video.original_object_key}
                                    </h4>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                                        ID: {video.id} • {new Date(video.created_at).toLocaleString()}
                                    </p>
                                    <div style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: '#1e293b', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                        {video.status}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => checkStatus(video.id)}
                                    className="btn btn-secondary"
                                    disabled={checkingId === video.id}
                                >
                                    {checkingId === video.id ? (
                                        <Loader size={18} className="animate-spin" />
                                    ) : video.status === 'COMPLETED' ? (
                                        <Download size={18} />
                                    ) : (
                                        <RefreshCw size={18} />
                                    )}
                                    {video.status === 'COMPLETED' ? 'Download' : 'Check Status'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VideoList;
