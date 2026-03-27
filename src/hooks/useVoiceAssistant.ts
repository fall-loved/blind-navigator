import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useState, useEffect } from 'react';

export const useVoiceAssistant = (onCommand: (text: string) => void) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');

    useEffect(() => {
        ExpoSpeechRecognitionModule.requestPermissionsAsync().then(r => r);
    }, []);

    useSpeechRecognitionEvent('start', () => setIsListening(true));
    useSpeechRecognitionEvent('end', () => setIsListening(false));

    useSpeechRecognitionEvent('result', (event) => {
        const text = event.results[0]?.transcript || '';
        setTranscript(text);

        if (event.isFinal) {
            onCommand(text);
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        console.error('Ошибка микрофона:', event.error);
        Speech.speak('Ошибка микрофона. Коснитесь экрана и попробуйте снова.', { language: 'ru-RU' });
    });

    const startListening = () => {
        setTranscript('');
        Speech.speak('Слушаю', { language: 'ru-RU' });

        setTimeout(() => {
            ExpoSpeechRecognitionModule.start({
                lang: 'ru-RU',
                interimResults: true,
                maxAlternatives: 1,
            });
        }, 800);
    };

    return { isListening, transcript, startListening };
};