import React, { useEffect } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useBuildingMap } from '@/hooks/useBuildingMap';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';

export default function App_old() {
    const { mapData, currentNodeId, checkInAtLocation } = useBuildingMap();

    const handleCommand = async (command: string, payload?: string) => {
        if (command === 'WHERE_AM_I') {
            if (currentNodeId && mapData) {
                speak(`Вы находитесь у: ${mapData[currentNodeId].name}`);
            } else {
                speak('Я пока не знаю вашу позицию. Скажите, у какой вы аудитории.');
            }
        } else if (command === 'CHECK_IN' && payload) {
            const targetNodeKey = Object.keys(mapData || {}).find(
                key => mapData![key].name.toLowerCase() === payload.toLowerCase()
            );

            if (targetNodeKey && mapData) {
                speak(`Принято. ${mapData[targetNodeKey].name}. Включаю шагомер.`);
                await checkInAtLocation(payload); // Передаем данные в вашу систему SLAM
            } else {
                speak(`Я не нашла локацию "${payload}" на карте здания.`);
            }
        }
    };

    const { isListening, transcript, startListening, speak } = useVoiceAssistant(handleCommand);

    useEffect(() => {
        if (mapData) {
            speak('Навигатор запущен. Коснитесь экрана и скажите, где вы находитесь.');
        }
    }, [mapData]);

    if (!mapData) return <Text>Загрузка карты...</Text>;

    return (
        <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1 }}>
                {/* Весь экран — это одна большая кнопка */}
                <TouchableOpacity
                    style={[styles.container, isListening ? styles.listening : styles.idle]}
                    onPress={startListening}
                    activeOpacity={0.8}
                >
                    <Text style={styles.title}>
                        {isListening ? 'Слушаю вас...' : 'Коснитесь экрана,\nчтобы сказать команду'}
                    </Text>

                    <Text style={styles.transcript}>
                        {transcript}
                    </Text>

                    <Text style={styles.status}>
                        Текущая позиция:{'\n'}
                        {currentNodeId ? mapData[currentNodeId].name : 'Неизвестно'}
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    idle: { backgroundColor: '#f0f0f0' },
    listening: { backgroundColor: '#ffecec' }, // Экран слегка краснеет, когда идет запись
    title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
    transcript: { fontSize: 20, color: '#555', fontStyle: 'italic', marginBottom: 40, textAlign: 'center' },
    status: { fontSize: 18, color: '#0066cc', textAlign: 'center' }
});