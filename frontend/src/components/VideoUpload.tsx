import React, { useCallback, useState } from 'react';
import { Upload, FileVideo, X } from 'lucide-react';

interface VideoUploadProps {
    onFileSelect: (file: File) => void;
    selectedFile: File | null;
    onClear: () => void;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onFileSelect, selectedFile, onClear }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('video/')) {
                onFileSelect(file);
            } else {
                alert('Please upload a video file');
            }
        }
    }, [onFileSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <div className="glass-panel" style={{ textAlign: 'center' }}>
            {!selectedFile ? (
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    style={{
                        border: `2px dashed ${isDragging ? 'var(--primary-color)' : '#334155'}`,
                        borderRadius: '1rem',
                        padding: '3rem 2rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.05)' : 'transparent'
                    }}
                    onClick={() => document.getElementById('file-upload')?.click()}
                >
                    <input
                        type="file"
                        id="file-upload"
                        accept="video/*"
                        onChange={handleChange}
                        style={{ display: 'none' }}
                    />
                    <div style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <Upload size={32} color="var(--accent-color)" />
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Upload your video</h3>
                    <p style={{ color: '#94a3b8', margin: 0 }}>Drag and drop or click to browse</p>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#1e293b',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            padding: '0.75rem',
                            borderRadius: '0.5rem'
                        }}>
                            <FileVideo size={24} color="var(--primary-color)" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500 }}>{selectedFile.name}</p>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClear}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '0.25rem'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default VideoUpload;
