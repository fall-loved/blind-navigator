import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useState, useEffect } from 'react';
import {parseVoiceCommand} from "@/utils/intentParser.ts";

export const useVoiceAssistant = (onCommand: (command: string, payload?: string) => void) => {
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
            processText(text);
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        console.log('Ошибка микрофона:', event.error);
        speak('Ошибка микрофона. Коснитесь экрана и попробуйте снова.');
    });

    const speak = (text: string) => {
        Speech.stop().then(r => r);
        Speech.speak(text, { language: 'ru-RU', rate: 0.9 });
    };

    const startListening = () => {
        setTranscript('');
        speak('Слушаю');

        setTimeout(() => {
            ExpoSpeechRecognitionModule.start({
                lang: 'ru-RU',
                interimResults: true,
                maxAlternatives: 1,
            });
        }, 800);
    };

    const processText = (text: string) => {
        const intent = parseVoiceCommand(text);

        if (intent.type === 'WHERE_AM_I') {
            onCommand('WHERE_AM_I');
        } else if (intent.type === 'CHECK_IN' && intent.payload) {
            onCommand('CHECK_IN', intent.payload);
        } else {
            speak('Команда не распознана. Спросите "Где я?" или скажите "Я у аудитории 101".');
        }
    };

    return { isListening, transcript, startListening, speak };
};