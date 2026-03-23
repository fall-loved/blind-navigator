/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

// Нативные модули
import { Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as SpeechRecognition from 'expo-speech-recognition';

// Наши модули
import { Coordinates } from '@/types.ts';
import { buildingMap } from '@/data/buildingMap.ts';
import { getDistanceFromLatLonInKm } from '@/utils/geo.ts';
import { findShortestPath } from '@/utils/pathfinding.ts';
import { parseCommand } from '@/services/commands.ts';
import { speak, stopSpeaking } from '@/services/speech.ts';

// Стили
import { styles } from '@/styles.ts';

export default function App() {
    const [isActive, setIsActive] = useState<boolean>(false);

    const [currentLocation, setCurrentLocation] = useState<string>('street');
    const [targetLocation, setTargetLocation] = useState<string | null>(null);
    const [path, setPath] = useState<string[]>([]);
    const [pathIndex, setPathIndex] = useState<number>(0);

    const [isListening, setIsListening] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>('');
    const [customCommand, setCustomCommand] = useState<string>('');

    const [heading, setHeading] = useState<number>(0);
    const [gpsData, setGpsData] = useState<Coordinates>({ lat: 0, lng: 0, accuracy: 0 });
    const [distanceToEntrance, setDistanceToEntrance] = useState<number | null>(null);

    // --- 1. ЛОГИКА НАВИГАЦИИ (С правильными хуками) ---
    const handleSetLocation = useCallback((nodeId: string, customMessage: string | null = null) => {
        setCurrentLocation(nodeId);
        setTargetLocation(null);
        setPath([]);
        const node = buildingMap[nodeId];
        if (node) {
            speak(customMessage || `Локация: ${node.name}`, isActive);
        }
    }, [isActive]);

    const startNavigation = useCallback((targetId: string) => {
        if (currentLocation === 'street') {
            speak("Подойдите к зданию", isActive);
            return;
        }
        const newPath = findShortestPath(currentLocation, targetId);
        if (newPath) {
            setTargetLocation(targetId);
            setPath(newPath);
            setPathIndex(0);
            const edge = buildingMap[currentLocation].edges?.find(e => e.to === newPath[1]);
            speak(`Идём: ${buildingMap[targetId].name}. ${edge ? edge.instruction : ''}`, isActive);
        } else {
            speak("Маршрут не найден.", isActive);
        }
    }, [currentLocation, isActive]);

    const handleCommandExecution = useCallback((text: string) => {
        const result = parseCommand(text);

        switch (result.action) {
            case 'CANCEL':
                setTargetLocation(null);
                setPath([]);
                setPathIndex(0);
                speak("Отмена", isActive);
                break;
            case 'INFO':
                const desc = buildingMap[currentLocation]?.description || 'Неизвестная локация';
                speak(`${buildingMap[currentLocation]?.name}. ${desc}`, isActive);
                break;
            case 'SET_LOCATION':
                if (result.targetId) handleSetLocation(result.targetId);
                break;
            case 'NAVIGATE':
                if (result.targetId) startNavigation(result.targetId);
                break;
            default:
                speak("Не понял команду. Повторите.", isActive);
                break;
        }
    }, [currentLocation, handleSetLocation, startNavigation, isActive]);

    const moveToNextCheckpoint = () => {
        if (!targetLocation || pathIndex >= path.length - 1) return;
        const nextIndex = pathIndex + 1;
        const nextNodeId = path[nextIndex];

        setCurrentLocation(nextNodeId);
        setPathIndex(nextIndex);

        if (nextNodeId === targetLocation) {
            speak(`Цель достигнута. ${buildingMap[nextNodeId].description}`, isActive);
            setTargetLocation(null);
            setPath([]);
        } else {
            const edge = buildingMap[nextNodeId].edges?.find(e => e.to === path[nextIndex + 1]);
            speak(`${buildingMap[nextNodeId].name}. ${edge ? edge.instruction : ''}`, isActive);
        }
    };

    // --- 2. ЭМУЛЯЦИЯ КОМАНД ---
    const simulateVoiceCommand = (cmd: string) => {
        setTranscript(cmd);
        handleCommandExecution(cmd);
    };

    // --- 3. ДАТЧИКИ И GPS ---
    useEffect(() => {
        let magSubscription: any;
        let locSubscription: Location.LocationSubscription;

        const startSensors = async () => {
            Magnetometer.setUpdateInterval(500);
            magSubscription = Magnetometer.addListener(result => {
                let angle = Math.atan2(result.y, result.x) * (180 / Math.PI);
                if (angle < 0) angle += 360;
                setHeading(angle);
            });

            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Внимание', 'Нет доступа к GPS.');
                return;
            }

            locSubscription = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 2 },
                (loc) => setGpsData({ lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy || 0 })
            );
        };

        if (isActive) startSensors().then(r => r);

        return () => {
            if (magSubscription) magSubscription.remove();
            if (locSubscription) locSubscription.remove();
            stopSpeaking();
        };
    }, [isActive]);

    useEffect(() => {
        const entranceGPS = buildingMap.entrance?.gps;
        if (!entranceGPS || gpsData.lat === 0) return;

        const dist = getDistanceFromLatLonInKm(gpsData.lat, gpsData.lng, entranceGPS.lat, entranceGPS.lng);
        setDistanceToEntrance(Math.round(dist));

        if (currentLocation === 'street' && dist <= 20) {
            handleSetLocation('entrance', 'Вы подошли ко входу.');
        }
    }, [gpsData, currentLocation, handleSetLocation]);

    // --- 4. РАСПОЗНАВАНИЕ РЕЧИ (STT) ---
    const startListening = async () => {
        if (!isActive) return;
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                speak("Нет доступа к микрофону", isActive);
                return;
            }

            setIsListening(true);
            speak("Слушаю", isActive);

            // @ts-expect-error
            if (typeof SpeechRecognition.start === 'function') {
                // @ts-expect-error
                SpeechRecognition.start({ lang: 'ru-RU' });
            } else {
                setTimeout(() => setIsListening(false), 2000);
            }
        } catch (e) {
            console.error(e);
            setIsListening(false);
        }
    };

    useEffect(() => {
        // @ts-expect-error
        if (typeof SpeechRecognition.addListener === 'function') {
            // @ts-expect-error
            const resultListener = SpeechRecognition.addListener('result', (event: any) => {
                const command = event.results?.[0]?.transcript || '';
                setTranscript(command);
                handleCommandExecution(command);
                setIsListening(false);
            });
            return () => resultListener.remove();
        }
    }, [handleCommandExecution]);


    // --- 5. UI РЕНДЕР ---
    if (!isActive) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={[styles.container, { justifyContent: 'center' }]}>
                    <Text style={styles.header}>Навигатор (Dev Mode)</Text>
                    <TouchableOpacity style={styles.button} onPress={() => setIsActive(true)}>
                        <Text style={styles.buttonText}>СТАРТ</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                <Text style={styles.header}>Тестирование навигации</Text>

                <View style={styles.block}>
                    <Text style={styles.blockTitle}>СТАТУС:</Text>
                    <Text style={styles.status}>Место: {buildingMap[currentLocation]?.name}</Text>
                    <Text style={styles.status}>Цель: {targetLocation ? buildingMap[targetLocation]?.name : 'Нет'}</Text>
                </View>

                <ScrollView>
                    <View style={styles.block}>
                        <Text style={styles.blockTitle}>УПРАВЛЕНИЕ (STT)</Text>
                        <TouchableOpacity
                            style={[styles.button, isListening && { backgroundColor: 'red' }]}
                            onPress={startListening}
                            disabled={currentLocation === 'street'}
                        >
                            <Text style={styles.buttonText}>{isListening ? 'СЛУШАЮ...' : 'СКАЗАТЬ КОМАНДУ (Микрофон)'}</Text>
                        </TouchableOpacity>
                        <Text>Распознано: {transcript}</Text>

                        <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            <TextInput
                                style={styles.input}
                                value={customCommand}
                                onChangeText={setCustomCommand}
                                placeholder="Команда текстом"
                            />
                            <TouchableOpacity
                                style={[styles.button, { marginVertical: 0 }]}
                                onPress={() => { simulateVoiceCommand(customCommand); setCustomCommand(''); }}
                            >
                                <Text style={styles.buttonText}>ОК</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.block}>
                        <Text style={styles.blockTitle}>ДАТЧИКИ (PDR & GPS)</Text>
                        <Text>GPS: {gpsData.lat.toFixed(5)}, {gpsData.lng.toFixed(5)}</Text>
                        <Text>До входа: {distanceToEntrance ?? '?'} м</Text>
                        <Text>Азимут: {Math.round(heading)}°</Text>

                        {targetLocation && (
                            <TouchableOpacity style={[styles.button, { backgroundColor: 'green', marginTop: 10 }]} onPress={moveToNextCheckpoint}>
                                <Text style={styles.buttonText}>СИМУЛЯЦИЯ: ШАГ К СЛЕД. ТОЧКЕ</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.block}>
                        <Text style={styles.blockTitle}>БЫСТРЫЕ ТЕСТЫ (Без голоса)</Text>
                        <View style={styles.row}>
                            {Object.keys(buildingMap).filter(k => k !== 'street' && !k.startsWith('room_')).map(key => (
                                <TouchableOpacity key={key} style={[styles.button, { backgroundColor: 'gray' }]} onPress={() => handleSetLocation(key)}>
                                    <Text style={styles.buttonText}>Я тут: {buildingMap[key]?.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}