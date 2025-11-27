import React, { useState, useEffect, useRef } from 'react';
import VideoUpload from '../components/VideoUpload';
import ActionCards from '../components/ActionCards';
import axios from 'axios';
import { Loader, Download, CheckCircle, XCircle } from 'lucide-react';
import { getClientId } from '../utils/user';


const Home: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [polling, setPolling] = useState(false);
    const [videoStatus, setVideoStatus] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);



    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Additional inputs
    const [width, setWidth] = useState<number>(1280);
    const [height, setHeight] = useState<number>(720);
    const [compression, setCompression] = useState<number>(28);
    const [preset, setPreset] = useState<string>('slow');
    const [timestamp, setTimestamp] = useState<number>(1);

    useEffect(() => {
        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, []);

    const startPolling = (videoId: string) => {
        setPolling(true);
        setVideoStatus('PROCESSING');

        pollInterval.current = setInterval(async () => {
            try {
                const response = await axios.get(`/api/v1/videos/${videoId}`);
                const data = response.data;

                if (data.video) {
                    const status = data.video.status;
                    setVideoStatus(status);

                    if (status === 'COMPLETED') {
                        setDownloadUrl(data.video.downloadUrl);
                        setPolling(false);
                        if (pollInterval.current) clearInterval(pollInterval.current);
                    } else if (status === 'FAILED' || status === 'QUEUE_FAILED') {
                        setPolling(false);
                        if (pollInterval.current) clearInterval(pollInterval.current);
                        setError('Video processing failed. Please try again.');
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 2000);
    };

    const handleProcess = async () => {
        if (!selectedFile || !selectedAction) return;

        setLoading(true);
        setError(null);
        setResult(null);
        setVideoStatus(null);
        setDownloadUrl(null);
        if (pollInterval.current) clearInterval(pollInterval.current);

        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('clientId', getClientId());

        try {
            let endpoint = '';

            switch (selectedAction) {
                case 'extract-audio':
                    endpoint = '/api/v1/videos/extract-audio';
                    break;
                case 'resize':
                    endpoint = '/api/v1/videos/resize';
                    formData.append('width', width.toString());
                    formData.append('height', height.toString());
                    break;
                case 'compress':
                    endpoint = '/api/v1/videos/compress';
                    formData.append('compression', compression.toString());
                    formData.append('preset', preset);
                    break;
                case 'create-thumbnail':
                    endpoint = '/api/v1/videos/create-thumbnail';
                    formData.append('timestamp', timestamp.toString());
                    break;
            }

            const response = await axios.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setResult(response.data);
            if (response.data.result && response.data.result.id) {
                startPolling(response.data.result.id);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };



    const resetFlow = () => {
        setSelectedAction(null);
        setSelectedFile(null);
        setResult(null);
        setError(null);
        setVideoStatus(null);
        setDownloadUrl(null);
        if (pollInterval.current) clearInterval(pollInterval.current);
    };

    return (
        <div className="container animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h1 style={{
                    fontSize: '3.5rem',
                    fontWeight: 800,
                    marginBottom: '1rem',
                    background: 'linear-gradient(to right, #6366f1, #a855f7, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Video Editor
                </h1>
                <p style={{ fontSize: '1.25rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
                    Professional video editing tools directly in your browser. Select a feature to get started.
                </p>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {!selectedAction ? (
                    <div className="animate-fade-in">
                        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Choose a Feature</h2>
                        <ActionCards
                            selectedAction={selectedAction}
                            onSelectAction={setSelectedAction}
                        />


                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <button
                            onClick={resetFlow}
                            className="btn btn-secondary"
                            style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            ← Back to Features
                        </button>

                        <div className="glass-panel" style={{ marginBottom: '2rem', padding: '1.5rem', borderLeft: '4px solid #6366f1' }}>
                            <h3 style={{ margin: 0 }}>
                                {selectedAction === 'extract-audio' && 'Extract Audio'}
                                {selectedAction === 'resize' && 'Resize Video'}
                                {selectedAction === 'compress' && 'Compress Video'}
                                {selectedAction === 'create-thumbnail' && 'Create Thumbnail'}
                            </h3>
                            <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8' }}>
                                Upload your video below to start processing.
                            </p>
                        </div>

                        <VideoUpload
                            selectedFile={selectedFile}
                            onFileSelect={setSelectedFile}
                            onClear={() => {
                                setSelectedFile(null);
                                setResult(null);
                                setError(null);
                                setVideoStatus(null);
                                setDownloadUrl(null);
                                if (pollInterval.current) clearInterval(pollInterval.current);
                            }}
                        />

                        {selectedFile && (
                            <div className="glass-panel animate-fade-in" style={{ marginTop: '2rem' }}>
                                <h3 style={{ marginBottom: '1.5rem' }}>Configure Settings</h3>

                                {selectedAction === 'resize' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="input-group">
                                            <label className="label">Width (px)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                value={width}
                                                onChange={(e) => setWidth(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="label">Height (px)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                value={height}
                                                onChange={(e) => setHeight(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedAction === 'compress' && (
                                    <div className="input-group">
                                        <label className="label" style={{ marginBottom: '1rem', display: 'block' }}>Compression Quality</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                            {[
                                                { name: 'Standard', crf: 28, preset: 'slow', desc: 'Visible compression, decent size reduction.' },
                                                { name: 'High', crf: 32, preset: 'slow', desc: 'Significant size reduction, softer image.' },
                                                { name: 'Extreme', crf: 36, preset: 'veryslow', desc: 'Tiny file, noticeable quality loss.' }
                                            ].map((option) => (
                                                <div
                                                    key={option.name}
                                                    onClick={() => {
                                                        setCompression(option.crf);
                                                        setPreset(option.preset);
                                                    }}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: '0.5rem',
                                                        border: `2px solid ${compression === option.crf ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'}`,
                                                        background: compression === option.crf ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{option.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{option.desc}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedAction === 'create-thumbnail' && (
                                    <div className="input-group">
                                        <label className="label">Timestamp (seconds)</label>
                                        <input
                                            type="number"
                                            className="input"
                                            value={timestamp}
                                            onChange={(e) => setTimestamp(Number(e.target.value))}
                                        />
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', marginTop: '1rem' }}
                                    onClick={handleProcess}
                                    disabled={loading || polling}
                                >
                                    {loading ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Uploading...
                                        </>
                                    ) : polling ? (
                                        <>
                                            <Loader className="animate-spin" size={20} />
                                            Processing...
                                        </>
                                    ) : (
                                        'Start Processing'
                                    )}
                                </button>

                                {error && (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '1rem',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        borderRadius: '0.5rem',
                                        color: '#ef4444'
                                    }}>
                                        {error}
                                    </div>
                                )}

                                {result && (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '1.5rem',
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '0.5rem',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            {videoStatus === 'COMPLETED' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '0.5rem' }}>
                                                    <CheckCircle size={24} />
                                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Processing Complete!</span>
                                                </div>
                                            ) : videoStatus === 'FAILED' || videoStatus === 'QUEUE_FAILED' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#ef4444', marginBottom: '0.5rem' }}>
                                                    <XCircle size={24} />
                                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Processing Failed</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#3b82f6', marginBottom: '1rem' }}>
                                                    <Loader className="animate-spin" size={48} />
                                                    <div>
                                                        <span style={{ fontWeight: 'bold', fontSize: '1.25rem', display: 'block', marginBottom: '0.25rem' }}>Processing Video...</span>
                                                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>This may take a few moments depending on the file size.</span>
                                                    </div>
                                                </div>
                                            )}
                                            <p style={{ color: '#94a3b8', margin: 0 }}>Video ID: {result.result.id}</p>
                                        </div>

                                        {downloadUrl && (
                                            <a
                                                href={downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-primary"
                                                style={{ textDecoration: 'none', display: 'inline-flex', marginTop: '0.5rem' }}
                                            >
                                                <Download size={20} />
                                                Download Result
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>

    );
};

export default Home;
