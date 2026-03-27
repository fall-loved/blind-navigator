import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { useNavigator } from '@/hooks/useNavigator';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { styles } from '@/styles';

export default function App() {
    const nav = useNavigator();
    const [inputText, setInputText] = useState('');

    const voice = useVoiceAssistant((text) => {
        nav.handleCommand(text);
    });

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
                <Text style={styles.micButtonText}>{voice.isListening ? '👂' : '🎙️'}</Text>
                <Text style={styles.micButtonSubText}>{voice.isListening ? 'СЛУШАЮ...' : 'ГОВОРИТЕ'}</Text>
            </TouchableOpacity>

            {/* ВРЕМЕННОЕ ПОЛЕ ВВОДА ДЛЯ ТЕСТОВ */}
            <View style={styles.devInputContainer}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={() => { nav.handleCommand(inputText); setInputText(''); }}
                    placeholder="Ручной ввод..."
                    placeholderTextColor="#666"
                />
                <TouchableOpacity style={styles.sendBtn} onPress={() => { nav.handleCommand(inputText); setInputText(''); }}>
                    <Text style={styles.sendBtnText}>➤</Text>
                </TouchableOpacity>
            </View>

            {/* ПАНЕЛЬ ПОРТАЛОВ */}
            {nav.availableFloors.length > 0 && nav.portalNearby && (
                <View style={styles.portalOverlay}>
                    <Text style={styles.portalHeader}>ВЫ У ПЕРЕХОДА</Text>
                    <Text style={styles.portalName}>{nav.portalNearby.name}</Text>

                    <View style={styles.portalBtnContainer}>
                        {nav.availableFloors.map(f => (
                            <TouchableOpacity
                                key={f}
                                style={styles.portalBtn}
                                onPress={() => nav.handleFloorTransition(f)}
                                accessible={true}
                                accessibilityLabel={`Подтвердить переход на ${f} этаж`}
                            >
                                <Text style={styles.portalBtnText}>{f} этаж</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}