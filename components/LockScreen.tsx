import React, { useState, useEffect } from 'react';
import { MOCK_STAFF } from '../constants';

interface LockScreenProps {
    onUnlock: (userId: string) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    // Animation state for keypad presses
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const handleKeyPress = (key: string) => {
        setActiveKey(key);
        setTimeout(() => setActiveKey(null), 150);

        if (key === 'backspace') {
            setPin(prev => prev.slice(0, -1));
            return;
        }

        if (pin.length < 4) {
            setPin(prev => prev + key);
        }
    };

    useEffect(() => {
        if (pin.length === 4) {
            // Validate PIN (Mock validation: Allow any 4 digits)
            if (selectedUser) {
                setTimeout(() => {
                    onUnlock(selectedUser);
                }, 300);
            } else {
                // Should not happen if UI is correct, but safe guard
                setError(true);
                setTimeout(() => {
                    setPin('');
                    setError(false);
                }, 500);
            }
        }
    }, [pin, selectedUser, onUnlock]);


    // Keypad numbers
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900 text-white overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/30 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/30 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">

                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/50 mx-auto mb-6 transform hover:rotate-12 transition-transform duration-500">
                        <span className="material-icons-round text-3xl">restaurant</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Culinex OS</h1>
                    <p className="text-gray-400">Select your profile to login</p>
                </div>

                {/* User Selection Carousel */}
                <div className="w-full flex justify-center gap-6 mb-8 overflow-x-auto pb-4 px-4 scrollbar-hide">
                    {MOCK_STAFF.map(user => (
                        <button
                            key={user.id}
                            onClick={() => { setSelectedUser(user.id); setPin(''); setError(false); }}
                            className={`flex flex-col items-center gap-3 transition-all duration-300 group ${selectedUser === user.id ? 'scale-110 opacity-100' : 'opacity-50 hover:opacity-80 hover:scale-105'
                                }`}
                        >
                            <div className={`w-20 h-20 rounded-full overflow-hidden border-4 transition-all shadow-xl ${selectedUser === user.id ? 'border-primary shadow-primary/50' : 'border-transparent group-hover:border-gray-600'
                                }`}>
                                <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                            </div>
                            <span className={`text-sm font-semibold whitespace-nowrap ${selectedUser === user.id ? 'text-white' : 'text-gray-400'}`}>
                                {user.name.split(' ')[0]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* PIN Entry Area (Only show if user selected) */}
                {selectedUser && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-500 fill-mode-forwards">
                        {/* PIN Dots */}
                        <div className={`flex gap-4 mb-8 ${error ? 'animate-shake' : ''}`}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-primary scale-110 shadow-lg shadow-primary/50' : 'bg-gray-700'
                                    }`}></div>
                            ))}
                        </div>

                        {/* Keypad */}
                        <div className="grid grid-cols-3 gap-6">
                            {keys.map((key, idx) => {
                                if (key === '') return <div key={idx}></div>;

                                const isBackspace = key === 'backspace';

                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleKeyPress(key)}
                                        className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold transition-all duration-150 ${isBackspace
                                                ? 'text-red-400 hover:bg-red-500/10'
                                                : 'bg-gray-800/50 hover:bg-gray-700 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600'
                                            } ${activeKey === key ? 'scale-90 bg-gray-600' : 'scale-100 hover:scale-105 active:scale-95'}`}
                                    >
                                        {isBackspace ? (
                                            <span className="material-icons-round">backspace</span>
                                        ) : (
                                            key
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
