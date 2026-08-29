import React from 'react';
import { Music, Maximize, Minimize, Image, Scissors } from 'lucide-react';

interface ActionCardsProps {
    onSelectAction: (action: string) => void;
    selectedAction: string | null;
}

const ActionCards: React.FC<ActionCardsProps> = ({ onSelectAction, selectedAction }) => {
    const actions = [
        {
            id: 'extract-audio',
            title: 'Extract Audio',
            description: 'Convert video to audio file',
            icon: Music
        },
        {
            id: 'resize',
            title: 'Resize Video',
            description: 'Change video dimensions',
            icon: Maximize
        },
        {
            id: 'compress',
            title: 'Compress Video',
            description: 'Reduce file size',
            icon: Minimize
        },
        {
            id: 'create-thumbnail',
            title: 'Create Thumbnail',
            description: 'Extract image from video',
            icon: Image
        },
        {
            id: 'trim',
            title: 'Trim Video',
            description: 'Cut video to a time range',
            icon: Scissors
        }
    ];

    return (
        <div className="grid-cards">
            {actions.map((action) => {
                const Icon = action.icon;
                const isSelected = selectedAction === action.id;

                return (
                    <div
                        key={action.id}
                        className="card"
                        onClick={() => onSelectAction(action.id)}
                        style={{
                            borderColor: isSelected ? 'var(--primary-color)' : undefined,
                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : undefined
                        }}
                    >
                        <div className="card-icon">
                            <Icon size={32} />
                        </div>
                        <h3>{action.title}</h3>
                        <p>{action.description}</p>
                    </div>
                );
            })}
        </div>
    );
};

export default ActionCards;
