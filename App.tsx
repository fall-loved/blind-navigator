import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useCustomPedometer } from '@/hooks/useCustomPedometer';
import { useBuildingMap } from '@/hooks/useBuildingMap';
import { parseVoiceCommand, matchNodeOnMap } from '@/utils/intentParser';
import * as Speech from 'expo-speech';
import { findShortestPath, RouteStep } from '@/utils/pathfinder';
import { useCompass } from '@/hooks/useCompass';
import {buildNavGraph} from "@/utils/mapEngine.ts";

const STEP_LENGTH = 0.65; // Длина шага (м)
const TOLERANCE_ZONE = 1.5; // Зона "на месте" (м)
const MAX_OVERSHOOT = 2.5; // Перелет: если прошли на 2.5м больше, чем нужно

const getAngleDiff = (angle1: number, angle2: number) => {
    let diff = Math.abs(angle1 - angle2);
    return diff > 180 ? 360 - diff : diff;
};

export default function App() {
    const {mapData, currentNodeId, checkInAtLocation} = useBuildingMap();
    const currentHeading = useCompass();

    const [inputText, setInputText] = useState('');
    const [lastResponse, setLastResponse] = useState('Навигатор запущен. Жду команду.');

    const [activeRoute, setActiveRoute] = useState<RouteStep[] | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // ЕДИНАЯ переменная дистанции
    const [walkedDistance, setWalkedDistance] = useState(0);

    const [isWrongDirection, setIsWrongDirection] = useState(false);
    const [isOvershot, setIsOvershot] = useState(false);
    const [arrivalAnnounced, setArrivalAnnounced] = useState(false);



    const speak = (text: string) => {
        setLastResponse(text);
        Speech.stop();
        Speech.speak(text, {language: 'ru-RU', rate: 0.9});
    };

    // === ОБРАБОТЧИК ФИЗИЧЕСКОГО ШАГА (ВЕКТОР) ===
    const handleStep = () => {
        if (!activeRoute) return;
        const currentLeg = activeRoute[currentStepIndex];
        if (!currentLeg) return;

        let delta = STEP_LENGTH;

        if (currentLeg.bearing !== undefined) {
            const angleDiff = getAngleDiff(currentHeading, currentLeg.bearing);
            const projection = Math.cos(angleDiff * (Math.PI / 180));
            delta = STEP_LENGTH * projection;
        }

        setWalkedDistance(prev => {
            const newDist = prev + delta;
            return newDist < 0 ? 0 : newDist;
        });
    };

    useCustomPedometer(activeRoute !== null, handleStep);

    // === ЕДИНСТВЕННЫЙ БЛОК АНАЛИЗА ДВИЖЕНИЯ ===
    useEffect(() => {
        if (!activeRoute || activeRoute.length === 0) return;
        const currentLeg = activeRoute[currentStepIndex];
        if (!currentLeg) return;

        // 1. ПРОВЕРКА КОМПАСА
        if (currentLeg.bearing !== undefined) {
            const angleDiff = getAngleDiff(currentHeading, currentLeg.bearing);
            if (angleDiff > 45 && !isWrongDirection) {
                setIsWrongDirection(true);
                speak(`Сбились с курса. Повернитесь, азимут должен быть ${currentLeg.bearing} градусов.`);
            } else if (angleDiff <= 45 && isWrongDirection) {
                setIsWrongDirection(false);
                speak('Курс верный.');
            }
        }

        // 2. ПРОВЕРКА ДИСТАНЦИИ
        if (walkedDistance >= currentLeg.distance - TOLERANCE_ZONE && walkedDistance <= currentLeg.distance + MAX_OVERSHOOT) {
            if (isOvershot) setIsOvershot(false);

            if (!arrivalAnnounced) {
                const sideHint = currentLeg.side ? `, ищите дверь ${currentLeg.side}` : "";
                speak(`Вы почти у цели${sideHint}.`);
                setArrivalAnnounced(true);
            }
        }
        // 3. ПЕРЕЛЕТ
        else if (walkedDistance > currentLeg.distance + MAX_OVERSHOOT) {
            if (!isOvershot) {
                setIsOvershot(true);
                setArrivalAnnounced(false);
                const overshotMeters = walkedDistance - currentLeg.distance;
                speak(`Осторожно, перелет! Вы прошли лишние ${overshotMeters.toFixed(1)} метра. Развернитесь и идите обратно.`);
            }
        }

    }, [currentHeading, walkedDistance, activeRoute, currentStepIndex, isWrongDirection, isOvershot, arrivalAnnounced]);

    const handleConfirmArrival = async () => {
        if (!activeRoute) return;
        const step = activeRoute[currentStepIndex];

        await checkInAtLocation(step.toNodeId);

        if (currentStepIndex + 1 < activeRoute.length) {
            const nextStep = activeRoute[currentStepIndex + 1];
            speak(`Вы достигли: ${step.toNodeName}. Следующий шаг: ${nextStep.instruction}`);
            setCurrentStepIndex(prev => prev + 1);
            setWalkedDistance(0); // ИСПРАВЛЕНО: Сбрасываем дистанцию
            setIsWrongDirection(false);
            setIsOvershot(false);
            setArrivalAnnounced(false);
        } else {
            speak(`Вы достигли конечной цели: ${step.toNodeName}. Маршрут завершен.`);
            setActiveRoute(null);
            setCurrentStepIndex(0);
            setWalkedDistance(0); // ИСПРАВЛЕНО
        }
    };

    const handleCommand = async (rawText: string) => {
        if (!rawText.trim() || !mapData) return;
        const intent = parseVoiceCommand(rawText);

        if (intent.type === 'WHERE_AM_I') {
            if (currentNodeId) speak(`Вы находитесь у: ${mapData[currentNodeId].name}`);
            else speak('Я пока не знаю вашу позицию.');
        } else if (intent.type === 'CHECK_IN' && intent.payload) {
            const destId = matchNodeOnMap(intent.payload, mapData);
            if (destId) {
                setActiveRoute(null);
                speak(`Принято. Вы у: ${mapData[destId].name}.`);
                await checkInAtLocation(destId);
            } else speak(`Я не поняла локацию "${intent.payload}".`);
        } else if (intent.type === 'NAVIGATE_TO' && intent.payload) {
            if (!currentNodeId) {
                speak('Где вы находитесь?');
                return;
            }
            const destId = matchNodeOnMap(intent.payload, mapData);
            if (destId) {
                const route = findShortestPath(mapData, currentNodeId, destId);
                if (route && route.length > 0) {
                    setActiveRoute(route);
                    setCurrentStepIndex(0);
                    setWalkedDistance(0); // ИСПРАВЛЕНО
                    setIsWrongDirection(false);
                    setIsOvershot(false);
                    setArrivalAnnounced(false);
                    speak(`Маршрут построен. Идем к: ${mapData[destId].name}. Инструкция: ${route[0].instruction}`);
                } else speak('Не могу найти путь к этой точке.');
            } else speak(`Не нашла пункт назначения "${intent.payload}".`);
        }
        setInputText('');
    };

    if (!mapData) return <View style={styles.center}><Text>Загрузка...</Text></View>;

    const currentLeg = activeRoute ? activeRoute[currentStepIndex] : null;

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>🧭 Боевой Навигатор</Text>

            <View style={{backgroundColor: '#fff9c4', padding: 10, borderRadius: 8, marginBottom: 15}}>
                <Text style={{fontWeight: 'bold', color: '#f57f17'}}>🔧 Статус железа:</Text>
                <Text>Компас: {currentHeading}° {currentHeading === 0 ? '(Возможно, мертв)' : '(Работает)'}</Text>
                {/* ИСПРАВЛЕНО: Выводим пройденную дистанцию напрямую */}
                <Text>Пройдено по вектору: {walkedDistance.toFixed(1)} м</Text>

                {activeRoute && currentLeg && (
                    <View
                        style={[styles.routeBox, isWrongDirection && styles.routeError, isOvershot && styles.routeWarning]}>
                        <Text style={styles.routeHeader}>ВЕДЕНИЕ ({currentStepIndex + 1}/{activeRoute.length})</Text>
                        <Text style={styles.routeTarget}>Цель: {currentLeg.toNodeName}</Text>
                        <Text style={styles.routeInstruction}>{currentLeg.instruction}</Text>

                        <View style={styles.progressRow}>
                            <Text style={styles.progressText}>Ожидаемый курс: {currentLeg.bearing}°</Text>
                        </View>
                        <View style={styles.progressRow}>
                            {/* ИСПРАВЛЕНО */}
                            <Text style={styles.progressText}>Пройдено: {walkedDistance.toFixed(1)} м
                                из {currentLeg.distance.toFixed(1)} м</Text>
                        </View>

                        {walkedDistance >= currentLeg.distance - TOLERANCE_ZONE && (
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmArrival}>
                                <Text style={styles.confirmBtnText}>Я НАШЕЛ(А) {currentLeg.toNodeName.toUpperCase()}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>

            <View style={styles.chatBox}>
                <Text style={styles.chatLabel}>🤖 Ассистент:</Text>
                <Text style={[styles.chatResponse, (isWrongDirection || isOvershot) && styles.chatAlert]}>{lastResponse}</Text>
            </View>

            <View style={styles.inputContainer}>
                <TextInput style={styles.input} value={inputText} onChangeText={setInputText}
                           onSubmitEditing={() => handleCommand(inputText)}/>
                <TouchableOpacity style={styles.sendBtn} onPress={() => handleCommand(inputText)}><Text
                    style={styles.sendBtnText}>➤</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => handleCommand('Я у двери')}><Text
                    style={styles.quickBtnText}>📍 Я у двери</Text></TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => handleCommand('К 27')}><Text
                    style={styles.quickBtnText}>К 27</Text></TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5', padding: 15 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, color: '#1a1a1a' },
    dashboard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15 },
    statusText: { fontSize: 16, fontWeight: 'bold', color: '#0056b3', marginBottom: 5 },
    routeBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 2, borderColor: 'transparent' },
    routeError: { backgroundColor: '#ffebee', borderColor: '#f44336' },
    routeWarning: { backgroundColor: '#fff3e0', borderColor: '#ff9800' },
    routeHeader: { fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 5 },
    routeTarget: { fontSize: 15, fontWeight: '600', color: '#1b5e20' },
    routeInstruction: { fontSize: 14, fontStyle: 'italic', color: '#333', marginVertical: 5 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    progressText: { fontSize: 13, color: '#555', fontWeight: 'bold' },
    confirmBtn: { backgroundColor: '#4caf50', padding: 12, borderRadius: 6, marginTop: 15, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    chatBox: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#bbdefb' },
    chatLabel: { fontSize: 13, color: '#1976d2', fontWeight: 'bold', marginBottom: 5 },
    chatResponse: { fontSize: 16, color: '#0d47a1' },
    chatAlert: { color: '#d32f2f', fontWeight: 'bold' },
    inputContainer: { flexDirection: 'row', marginBottom: 20 },
    input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 25, paddingHorizontal: 15, fontSize: 16, height: 50 },
    sendBtn: { backgroundColor: '#007bff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sendBtnText: { color: '#fff', fontSize: 20 },
    quickScroll: { flexGrow: 0, height: 50 },
    quickBtn: { backgroundColor: '#6c757d', paddingHorizontal: 15, borderRadius: 20, marginRight: 10, justifyContent: 'center', height: 40 },
    quickBtnText: { color: '#fff', fontWeight: 'bold' }
});