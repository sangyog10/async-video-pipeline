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


    const eventSource = useRef<EventSource | null>(null);
    const sseErrors = useRef(0);

    // Additional inputs
    const [width, setWidth] = useState<number>(1280);
    const [height, setHeight] = useState<number>(720);
    const [compression, setCompression] = useState<number>(28);
    const [preset, setPreset] = useState<string>('slow');
    const [timestamp, setTimestamp] = useState<number>(1);
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(30);
    const [gifFps, setGifFps] = useState<number>(10);
    const [gifWidth, setGifWidth] = useState<number>(480);
    const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
    const [watermarkPosition, setWatermarkPosition] = useState<string>('bottom-right');
    const [watermarkOpacity, setWatermarkOpacity] = useState<number>(1);
    const [watermarkWidth, setWatermarkWidth] = useState<number>(200);

    useEffect(() => {
        return () => {
            if (eventSource.current) {
                eventSource.current.close();
            }
        };
    }, []);

    const closeEventSource = () => {
        if (eventSource.current) {
            eventSource.current.close();
            eventSource.current = null;
        }
    };

    const handleStatusEvent = (data: any) => {
        const status = data?.status;
        setVideoStatus(status);
        if (data?.progress !== undefined && data?.progress !== null) {
            setProgress(data.progress);
        }
        if (data?.queueLength !== undefined) {
            setQueueLength(data.queueLength);
        }

        if (status === 'COMPLETED') {
            setDownloadUrl(data.downloadUrl);
            setPolling(false);
            closeEventSource();
        } else if (status === 'FAILED' || status === 'QUEUE_FAILED') {
            setPolling(false);
            closeEventSource();
            setError('Video processing failed. Please try again.');
        }
    };

    const startStatusUpdates = (videoId: string) => {
        setPolling(true);
        setVideoStatus('PROCESSING');
        setProgress(0);
        setQueueLength(0);
        sseErrors.current = 0;

        closeEventSource();

        const es = new EventSource(`/api/v1/videos/${videoId}/stream`);
        eventSource.current = es;

        es.addEventListener('snapshot', (e) => handleStatusEvent(JSON.parse((e as MessageEvent).data)));
        es.addEventListener('progress', (e) => {
            const data = JSON.parse((e as MessageEvent).data);
            if (data?.progress !== undefined) setProgress(data.progress);
        });
        es.addEventListener('completed', (e) => handleStatusEvent(JSON.parse((e as MessageEvent).data)));
        es.addEventListener('failed', (e) => handleStatusEvent(JSON.parse((e as MessageEvent).data)));

        es.onerror = async () => {
            // EventSource auto-reconnects; only give up after repeated failures
            sseErrors.current += 1;
            if (sseErrors.current >= 3) {
                es.close();
                eventSource.current = null;
                setPolling(false);
                try {
                    const response = await axios.get(`/api/v1/videos/${videoId}`);
                    const data = response.data.video;
                    if (data?.status === 'COMPLETED') {
                        handleStatusEvent(data);
                    } else {
                        setError('Lost connection to the server while processing. Please check back later.');
                    }
                } catch {
                    setError('Lost connection to the server while processing. Please check back later.');
                }
            }
        };
    };

    const handleProcess = async () => {
        if (!selectedFile || !selectedAction) return;

        if (selectedAction === 'add-watermark' && !watermarkFile) {
            setError('Please upload a watermark image');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setVideoStatus(null);
        setDownloadUrl(null);
        closeEventSource();

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

            // Step 2b: Upload watermark image (add-watermark only)
            let watermarkBucket = '';
            let watermarkKey = '';
            if (selectedAction === 'add-watermark' && watermarkFile) {
                const wmPresigned = await axios.post('/api/v1/videos/presigned-url', {
                    fileName: watermarkFile.name,
                    fileType: watermarkFile.type
                });

                await axios.put(wmPresigned.data.url, watermarkFile, {
                    headers: {
                        'Content-Type': watermarkFile.type
                    },
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setProgress(percentCompleted);
                        }
                    }
                });

                watermarkBucket = wmPresigned.data.bucket;
                watermarkKey = wmPresigned.data.key;
            }

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
                case 'trim':
                    endpoint = '/api/v1/videos/trim';
                    break;
                case 'create-gif':
                    endpoint = '/api/v1/videos/create-gif';
                    break;
                case 'add-watermark':
                    endpoint = '/api/v1/videos/add-watermark';
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
            } else if (selectedAction === 'trim') {
                payload.startTime = startTime;
                payload.endTime = endTime;
            } else if (selectedAction === 'create-gif') {
                payload.fps = gifFps;
                payload.width = gifWidth;
            } else if (selectedAction === 'add-watermark') {
                payload.watermarkBucket = watermarkBucket;
                payload.watermarkKey = watermarkKey;
                payload.position = watermarkPosition;
                payload.opacity = watermarkOpacity;
                if (watermarkWidth > 0) payload.watermarkWidth = watermarkWidth;
            }

            const processResponse = await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            setResult(processResponse.data);
            if (processResponse.data.result && processResponse.data.result.id) {
                startStatusUpdates(processResponse.data.result.id);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Something went wrong');
            setLoading(false); // Ensure loading is set to false on error
        }
        // Note: setLoading(false) is NOT called in success path here because startStatusUpdates takes over?
        // No, startStatusUpdates sets polling to true. loading should be false.
        // In the original code, setLoading(false) was in finally block.
        // But here, if we start polling, we might want to show "Processing..." which uses `polling` state.
        // The UI shows "Uploading..." if `loading` is true.
        // So we should set loading to false after upload and request is done.
        setLoading(false);
    };



    const resetFlow = () => {
        setSelectedAction(null);
        setSelectedFile(null);
        setWatermarkFile(null);
        setWatermarkPosition('bottom-right');
        setWatermarkOpacity(1);
        setResult(null);
        setError(null);
        setVideoStatus(null);
        setDownloadUrl(null);
        closeEventSource();
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
                                {selectedAction === 'trim' && 'Trim Video'}
                                {selectedAction === 'create-gif' && 'Create GIF'}
                                {selectedAction === 'add-watermark' && 'Add Watermark'}
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
                                setWatermarkFile(null);
                                setResult(null);
                                setError(null);
                                setVideoStatus(null);
                                setDownloadUrl(null);
                                closeEventSource();
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

                                {selectedAction === 'trim' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="input-group">
                                            <label className="label">Start Time (seconds)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                min={0}
                                                value={startTime}
                                                onChange={(e) => setStartTime(Math.max(0, Number(e.target.value)))}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="label">End Time (seconds)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                min={0}
                                                value={endTime}
                                                onChange={(e) => setEndTime(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedAction === 'create-gif' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="input-group">
                                            <label className="label">Frame Rate (fps)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                min={1}
                                                max={60}
                                                value={gifFps}
                                                onChange={(e) => setGifFps(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="label">Width (px)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                min={1}
                                                max={1920}
                                                value={gifWidth}
                                                onChange={(e) => setGifWidth(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedAction === 'add-watermark' && (
                                    <div>
                                        <div className="input-group">
                                            <label className="label">Watermark Image</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setWatermarkFile(e.target.files[0]);
                                                    }
                                                }}
                                            />
                                            {watermarkFile && (
                                                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                                    {watermarkFile.name} ({(watermarkFile.size / (1024 * 1024)).toFixed(2)} MB)
                                                </p>
                                            )}
                                        </div>

                                        <div className="input-group" style={{ marginTop: '1rem' }}>
                                            <label className="label">Position</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                                                {['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].map((pos) => (
                                                    <button
                                                        key={pos}
                                                        type="button"
                                                        onClick={() => setWatermarkPosition(pos)}
                                                        style={{
                                                            padding: '0.5rem',
                                                            borderRadius: '0.5rem',
                                                            border: `2px solid ${watermarkPosition === pos ? '#6366f1' : 'rgba(255, 255, 255, 0.1)'}`,
                                                            background: watermarkPosition === pos ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                            color: '#e2e8f0',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        {pos}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                            <div className="input-group">
                                                <label className="label">Opacity ({watermarkOpacity.toFixed(2)})</label>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.05}
                                                    value={watermarkOpacity}
                                                    onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                            <div className="input-group">
                                                <label className="label">Width (px)</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    min={1}
                                                    max={1920}
                                                    value={watermarkWidth}
                                                    onChange={(e) => setWatermarkWidth(Number(e.target.value))}
                                                />
                                            </div>
                                        </div>
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
