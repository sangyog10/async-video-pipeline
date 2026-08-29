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
    const [progress, setProgress] = useState<number>(0);
    const [queueLength, setQueueLength] = useState<number>(0);


    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollErrors = useRef(0);

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
        setProgress(0);
        setQueueLength(0);
        pollErrors.current = 0;

        pollInterval.current = setInterval(async () => {
            try {
                const response = await axios.get(`/api/v1/videos/${videoId}`);
                const data = response.data;

                if (data.video) {
                    const status = data.video.status;
                    setVideoStatus(status);
                    if (data.video.progress !== undefined && data.video.progress !== null) {
                        setProgress(data.video.progress);
                    }
                    if (data.video.queueLength !== undefined) {
                        setQueueLength(data.video.queueLength);
                    }

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
                pollErrors.current = 0;
            } catch (err: any) {
                pollErrors.current += 1;
                console.error('Polling error:', err);
                // Stop polling after repeated failures (e.g. rate limited) and
                // surface the error instead of spinning silently forever.
                if (pollErrors.current >= 3) {
                    if (pollInterval.current) clearInterval(pollInterval.current);
                    setPolling(false);
                    setError(err.response?.data?.message || 'Lost connection to the server while processing. Please check back later.');
                }
            }
        }, 5000);
    };

    const handleProcess = async () => {
        if (!selectedFile || !selectedAction) return;

        setLoading(true);
        setError(null);
        setResult(null);
        setVideoStatus(null);
        setDownloadUrl(null);
        if (pollInterval.current) clearInterval(pollInterval.current);

        try {
            // Step 1: Get Presigned URL
            const presignedResponse = await axios.post('/api/v1/videos/presigned-url', {
                fileName: selectedFile.name,
                fileType: selectedFile.type
            });

            const { url, key, bucket } = presignedResponse.data;

            // Step 2: Upload to S3
            await axios.put(url, selectedFile, {
                headers: {
                    'Content-Type': selectedFile.type
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setProgress(percentCompleted);
                    }
                }
            });

            // Step 3: Trigger Processing
            let endpoint = '';

            switch (selectedAction) {
                case 'extract-audio':
                    endpoint = '/api/v1/videos/extract-audio';
                    break;
                case 'resize':
                    endpoint = '/api/v1/videos/resize';
                    break;
                case 'compress':
                    endpoint = '/api/v1/videos/compress';
                    break;
                case 'create-thumbnail':
                    endpoint = '/api/v1/videos/create-thumbnail';
                    break;
            }

            const payload: any = {
                clientId: getClientId(),
                bucket,
                key,
                fileName: selectedFile.name
            };

            if (selectedAction === 'resize') {
                payload.width = width;
                payload.height = height;
            } else if (selectedAction === 'compress') {
                payload.compression = compression;
                payload.preset = preset;
            } else if (selectedAction === 'create-thumbnail') {
                payload.timestamp = timestamp;
            }

            const processResponse = await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            setResult(processResponse.data);
            if (processResponse.data.result && processResponse.data.result.id) {
                startPolling(processResponse.data.result.id);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Something went wrong');
            setLoading(false); // Ensure loading is set to false on error
        }
        // Note: setLoading(false) is NOT called in success path here because startPolling takes over?
        // No, startPolling sets polling to true. loading should be false.
        // In the original code, setLoading(false) was in finally block.
        // But here, if we start polling, we might want to show "Processing..." which uses `polling` state.
        // The UI shows "Uploading..." if `loading` is true.
        // So we should set loading to false after upload and request is done.
        setLoading(false);
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
                                            ) : videoStatus === 'UPLOADED' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#f59e0b', marginBottom: '1rem' }}>
                                                    <Loader className="animate-spin" size={48} />
                                                    <div>
                                                        <span style={{ fontWeight: 'bold', fontSize: '1.25rem', display: 'block', marginBottom: '0.25rem' }}>In Queue</span>
                                                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Position in queue: {queueLength}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#3b82f6', marginBottom: '1rem' }}>
                                                    <Loader className="animate-spin" size={48} />
                                                    <div style={{ width: '100%', maxWidth: '300px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontWeight: 'bold' }}>Processing...</span>
                                                            <span style={{ fontWeight: 'bold' }}>{progress}%</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }}></div>
                                                        </div>
                                                        <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem', textAlign: 'center' }}>
                                                            This may take a few moments depending on the file size.
                                                        </p>
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
