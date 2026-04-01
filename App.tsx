import React, {useEffect, useState} from 'react';
import { View, Text, TouchableOpacity, SafeAreaView} from 'react-native';
import { useNavigator } from '@/hooks/useNavigator';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { styles } from '@/styles';
import {Audio} from "expo-av";
import {Pedometer} from "expo-sensors";

export default function App() {
    const nav = useNavigator();
    const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

    const voice = useVoiceAssistant((text) => {
        nav.handleCommand(text);
    });

    useEffect(() => {
        async function requestPermissions() {
            try {
                const audioStatus = await Audio.requestPermissionsAsync();

                const pedometerStatus = await Pedometer.requestPermissionsAsync();

                if (
                    audioStatus.status === 'granted' &&
                    pedometerStatus.status === 'granted'
                ) {
                    setHasPermissions(true);
                } else {
                    setHasPermissions(false);
                }
            } catch (error) {
                console.error("Ошибка при запросе разрешений:", error);
                setHasPermissions(false);
            }
        }

        requestPermissions();
    }, []);

    if (hasPermissions === null) {
        return <View><Text>Инициализация систем...</Text></View>;
    }

    if (hasPermissions === false) {
        return <View><Text>Приложению требуются разрешения для работы!</Text></View>;
    }

    if (!nav.mapData) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Инициализация карты...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* ИНФО-ПАНЕЛЬ ДЛЯ ЭКРАННЫХ ДИКТОРОВ */}
            <View
                style={styles.statusBox}
                accessible={true}
                accessibilityLabel={`Последнее сообщение ассистента: ${nav.lastResponse}`}
            >
                <Text style={styles.statusText} numberOfLines={4}>{nav.lastResponse}</Text>
            </View>

            {/* ТРАНСКРИПЦИЯ (Чтобы видеть, что понял микрофон) */}
            <View style={styles.transcriptBox}>
                <Text style={styles.transcriptText}>
                    {voice.transcript ? `"${voice.transcript}"` : ''}
                </Text>
            </View>

            {/* ГЛАВНАЯ КНОПКА МИКРОФОНА */}
            <TouchableOpacity
                style={[styles.micButton, voice.isListening && styles.micButtonActive]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={voice.isListening ? "Слушаю вас" : "Нажмите, чтобы сказать команду"}
                accessibilityHint="Дважды коснитесь, чтобы продиктовать маршрут"
                onPress={voice.startListening}
            >
                <Text style={styles.micButtonSubText}>{voice.isListening ? 'СЛУШАЮ...' : 'ГОВОРИТЕ'}</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}