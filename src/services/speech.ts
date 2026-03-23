import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

export const speak = (text: string, isActive: boolean = true) => {
    if (!isActive) return;

    Speech.stop().then(r => r);
    Speech.speak(text, {
        language: 'ru-RU',
        rate: Platform.OS === 'android' ? 1.0 : 0.9,
        pitch: 1.0,
    });
};

export const stopSpeaking = () => {
    Speech.stop().then(r => r);
};