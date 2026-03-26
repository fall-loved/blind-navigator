import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Switch, Dimensions, PanResponder } from 'react-native';
import Svg, { Line, Circle, Polyline, G, Text as SvgText, Image as SvgImage } from 'react-native-svg';
import * as Speech from 'expo-speech';


// --- НАШИ МОДУЛИ ---
import { useCustomPedometer } from '@/hooks/useCustomPedometer';
import { useBuildingMap } from '@/hooks/useBuildingMap';
import { parseVoiceCommand, matchNodeOnMap } from '@/utils/intentParser';
import { findShortestPath, RouteStep } from '@/utils/pathfinder';
import { useCompass } from '@/hooks/useCompass';
import { NavNode } from '@/utils/mapEngine'; // Убедитесь, что MapEngine экспортирует NavNode

// --- КОНСТАНТЫ ---
const STEP_LENGTH = 0.65; // м
const TOLERANCE_ZONE = 1.8; // м (увеличил для удобства симуляции)
const SCREEN_WIDTH = Dimensions.get('window').width;

const getAngleDiff = (angle1: number, angle2: number) => {
    let diff = Math.abs(angle1 - angle2);
    return diff > 180 ? 360 - diff : diff;
};

// =========================================================================
// КOМПОНЕНТ ОТОБРАЖЕНИЯ КАРТЫ (Интерактивный)
// =========================================================================
const FloorMap = ({ mapData, activeRoute, currentNodeId, userPos, userHeading }: {
    mapData: Record<string, NavNode> | null;
    activeRoute: RouteStep[] | null;
    currentNodeId: string | null;
    userPos: { x: number; y: number };
    userHeading: number;
}) => {
    // --- СОСТОЯНИЯ ДЛЯ ЖЕСТОВ (PAN & ZOOM) ---
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const lastPan = useRef({ x: 0, y: 0 });

    // Обработчик перетаскивания карты пальцем
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (evt, gestureState) => {
                setPan({
                    x: lastPan.current.x + gestureState.dx,
                    y: lastPan.current.y + gestureState.dy
                });
            },
            onPanResponderRelease: () => {
                lastPan.current = pan;
            }
        })
    ).current;

    const bounds = useMemo(() => {
        if (!mapData) return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const id in mapData) {
            const node = mapData[id];
            minX = Math.min(minX, node.x); minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x); maxY = Math.max(maxY, node.y);
        }
        const padding = 5;
        if (minX === Infinity) return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
        return {
            minX: minX - padding, minY: minY - padding,
            maxX: maxX + padding, maxY: maxY + padding,
            width: maxX - minX + padding*2, height: maxY - minY + padding*2
        };
    }, [mapData]);

    if (!mapData) return null;

    // Базовый масштаб, чтобы карта влезла в экран
    const baseScale = SCREEN_WIDTH / bounds.width;
    const mapHeight = 350; // Фиксируем высоту окна карты, чтобы она не "уезжала" вверх экрана

    // Перевод метров в локальные координаты SVG
    const toPx = (mx: number, my: number) => ({
        x: (mx - bounds.minX) * baseScale,
        y: (bounds.maxY - my) * baseScale // Инверсия Y для правильного отображения
    });

    const userPx = toPx(userPos.x, userPos.y);

    let routePoints = "";
    if (activeRoute && activeRoute.length > 0) {
        const startNode = (currentNodeId && mapData[currentNodeId]) ? mapData[currentNodeId] : userPos;
        const startPx = toPx(startNode.x, startNode.y);
        routePoints = `${startPx.x},${startPx.y}`;
        activeRoute.forEach(step => {
            const n = mapData[step.toNodeId];
            if (n) {
                const p = toPx(n.x, n.y);
                routePoints += ` ${p.x},${p.y}`;
            }
        });
    }

    // Определяем текущий этаж для подстановки нужной картинки фона
    const currentFloor = currentNodeId && mapData[currentNodeId] ? mapData[currentNodeId].floor : 1;

    // ВНИМАНИЕ: Здесь вы можете прописать пути к вашим реальным картинкам из папки assets!
    // const bgImage = currentFloor === 1 ? require('@/assets/floor1.jpg') : require('@/assets/floor2.jpg');

    return (
        <View style={{ height: mapHeight, backgroundColor: '#e0e0e0', overflow: 'hidden' }}>

            {/* КНОПКИ ЗУМА */}
            <View style={{ position: 'absolute', right: 10, top: 10, zIndex: 10, flexDirection: 'column' }}>
                <TouchableOpacity onPress={() => setZoom(z => z * 1.3)} style={styles.zoomBtn}><Text style={styles.zoomText}>+</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setZoom(z => z / 1.3)} style={styles.zoomBtn}><Text style={styles.zoomText}>−</Text></TouchableOpacity>
            </View>

            {/* ОБЛАСТЬ С ЖЕСТАМИ */}
            <View {...panResponder.panHandlers} style={{ flex: 1 }}>
                <Svg width="100%" height="100%">
                    {/* ГРУППА ТРАНСФОРМАЦИИ (Двигает и масштабирует всю карту разом) */}
                    <G transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

                        {/* ФОНОВАЯ КАРТИНКА (Раскомментируйте, когда добавите картинки в assets) */}
                        {/* <SvgImage
                            x="0" y="0"
                            width={bounds.width * baseScale}
                            height={bounds.height * baseScale}
                            preserveAspectRatio="xMidYMid slice"
                            href={bgImage}
                            opacity="0.4"
                        />
                        */}

                        {/* СЕТКА КОРИДОРОВ */}
                        {Object.values(mapData).map(node => (
                            node.edges.map(edgeId => {
                                if (!mapData[edgeId] || mapData[edgeId].floor !== node.floor) return null;
                                const p1 = toPx(node.x, node.y);
                                const p2 = toPx(mapData[edgeId].x, mapData[edgeId].y);
                                return <Line key={`${node.id}-${edgeId}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff" strokeWidth="2" />;
                            })
                        ))}

                        {/* МАРШРУТ */}
                        {routePoints !== "" && (
                            <Polyline points={routePoints} fill="none" stroke="#FF9800" strokeWidth="5" strokeLinecap="round" opacity={0.8} />
                        )}

                        {/* ТОЧКИ (Узлы) */}
                        {Object.values(mapData).map(node => {
                            if (node.floor !== currentFloor) return null; // Рисуем точки только текущего этажа
                            const p = toPx(node.x, node.y);
                            const isTarget = activeRoute?.some(s => s.toNodeId === node.id);
                            return (
                                <G key={node.id}>
                                    <Circle cx={p.x} cy={p.y} r={isTarget ? 7 : 4}
                                            fill={node.type === 'room' ? '#E91E63' : '#2196F3'}
                                            stroke={node.id === currentNodeId ? '#00FF00' : 'none'} strokeWidth="2" />
                                    {node.type === 'room' && (
                                        <SvgText x={p.x + 8} y={p.y - 8} fontSize="12" fill="#111" fontWeight="bold">
                                            {node.name.replace('Аудитория ', '')}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        })}

                        {/* СИНИЙ ЧЕЛОВЕЧЕК */}
                        <G x={userPx.x} y={userPx.y} rotation={userHeading}>
                            <Circle cx="0" cy="0" r="10" fill="#2979FF" stroke="#fff" strokeWidth="3" />
                            <Polyline points="-5,2 0,-8 5,2" fill="white" />
                        </G>

                    </G>
                </Svg>
            </View>
        </View>
    );
};

// =========================================================================
// ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ
// =========================================================================
export default function App() {
    const { mapData, currentNodeId, checkInAtLocation } = useBuildingMap();
    const currentHeading = useCompass();

    // === СОСТОЯНИЕ ТЕСТЕРА (СИМУЛЯТОРА) ===
    const [isSimMode, setIsSimMode] = useState(true); // ПО УМОЛЧАНИЮ ВКЛЮЧЕНО
    const [simHeading, setSimHeading] = useState(0); // Азимут тестера
    // Текущая физическая позиция (метров)
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

    const [inputText, setInputText] = useState('');
    const [lastResponse, setLastResponse] = useState('Навигатор запущен (режим симулятора).');

    const [activeRoute, setActiveRoute] = useState<RouteStep[] | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const [isWrongDirection, setIsWrongDirection] = useState(false);
    const [arrivalAnnounced, setArrivalAnnounced] = useState(false);

    // Выбираем, откуда брать компас
    const effectiveHeading = isSimMode ? simHeading : currentHeading;

    const speak = (text: string) => {
        setLastResponse(text);
        Speech.stop();
        Speech.speak(text, { language: 'ru-RU', rate: 0.9 });
    };

    // Обновляем позицию при чек-ине
    useEffect(() => {
        if (currentNodeId && mapData && mapData[currentNodeId]) {
            setCurrentPos({ x: mapData[currentNodeId].x, y: mapData[currentNodeId].y });
        }
    }, [currentNodeId, mapData]);

    // === ОБРАБОТКА ШАГА (ВЕКТОР) ===
    const handleStep = () => {
        let deltaD = STEP_LENGTH;

        // Если есть маршрут, проецируем шаг на вектор цели
        if (activeRoute && activeRoute[currentStepIndex]) {
            const currentLeg = activeRoute[currentStepIndex];
            if (currentLeg.distance > 0 && currentLeg.bearing !== undefined) {

                // В симуляторе мы заставляем компас быть "чистым", чтобы шаг точно зачелся
                const headingToUse = isSimMode ? currentLeg.bearing : currentHeading;
                const angleDiff = getAngleDiff(headingToUse, currentLeg.bearing);
                const projection = Math.cos(angleDiff * (Math.PI / 180));

                deltaD = STEP_LENGTH * projection;

                // В симуляторе мы реально двигаем точку по 2D-плоскости!
                if (isSimMode) {
                    setCurrentPos(prev => ({
                        x: prev.x + STEP_LENGTH * Math.sin(simHeading * (Math.PI / 180)),
                        y: prev.y + STEP_LENGTH * Math.cos(simHeading * (Math.PI / 180))
                    }));
                }
            }
        }
        // *Примечание: Удалили walkedDistance. Алгоритм теперь считает дистанцию от currentPos!
    };

    // Слушаем датчик шагомера (только в физическом режиме)
    useCustomPedometer(activeRoute !== null && !isSimMode, handleStep);

    // === ЛОГИКА АНАЛИЗА ДВИЖЕНИЯ ===
    useEffect(() => {
        if (!activeRoute || activeRoute.length === 0 || !mapData) return;
        const currentLeg = activeRoute[currentStepIndex];
        if (!currentLeg) return;
        const legTargetNode = mapData[currentLeg.toNodeId];
        if (!legTargetNode) return;

        // 1. Проверка курса (если не на лестнице и идем далеко)
        if (currentLeg.distance > 5 && currentLeg.bearing !== undefined) {
            const angleDiff = getAngleDiff(effectiveHeading, currentLeg.bearing);
            if (angleDiff > 50 && !isWrongDirection) {
                setIsWrongDirection(true);
                speak(`Курс неверный. Развернитесь на азимут ${currentLeg.bearing}.`);
            } else if (angleDiff <= 50 && isWrongDirection) {
                setIsWrongDirection(false);
                speak('Курс верный.');
            }
        }

        // 2. Проверка дистанции (ТЕПЕРЬ ПО КООРДИНАТАМ!)
        const realDistanceToTarget = Math.hypot(currentPos.x - legTargetNode.x, currentPos.y - legTargetNode.y);

        if (realDistanceToTarget <= TOLERANCE_ZONE) {
            if (!arrivalAnnounced) {
                speak(`Прибыли. Это дверь ${currentLeg.toNodeName}. Нажмите "Я ДОШЕЛ"`);
                setArrivalAnnounced(true);
            }
        }
    }, [effectiveHeading, currentPos, activeRoute, currentStepIndex, mapData, isWrongDirection, arrivalAnnounced]);

    const handleConfirmArrival = async () => {
        if (!activeRoute) return;
        const step = activeRoute[currentStepIndex];

        await checkInAtLocation(step.toNodeId);

        if (currentStepIndex + 1 < activeRoute.length) {
            speak(`Ок. Следующий шаг: ${activeRoute[currentStepIndex + 1].instruction}`);
            setCurrentStepIndex(prev => prev + 1);
            setIsWrongDirection(false);
            setArrivalAnnounced(false);
        } else {
            speak(`Отлично. Маршрут завершен. Вы у двери: ${step.toNodeName}.`);
            setActiveRoute(null);
            setCurrentStepIndex(0);
        }
    };

    const handleCommand = async (rawText: string) => {
        if (!rawText.trim() || !mapData) return;
        const intent = parseVoiceCommand(rawText);

        if (intent.type === 'WHERE_AM_I') {
            if (currentNodeId) speak(`Вы находитесь у: ${mapData[currentNodeId].name}, ${mapData[currentNodeId].floor} этаж.`);
            else speak('Я пока не знаю вашу позицию.');
        } else if (intent.type === 'CHECK_IN' && intent.payload) {
            const destId = matchNodeOnMap(intent.payload, mapData);
            if (destId) {
                setActiveRoute(null);
                speak(`Позиция обновлена: ${mapData[destId].name}.`);
                await checkInAtLocation(destId);
            } else speak(`Я не поняла локацию "${intent.payload}".`);
        } else if (intent.type === 'NAVIGATE_TO' && intent.payload) {
            if (!currentNodeId) {
                speak('Где вы находитесь? Скажите "Я у двери 101".');
                return;
            }
            const destId = matchNodeOnMap(intent.payload, mapData);
            if (destId) {
                const route = findShortestPath(mapData, currentNodeId, destId);
                if (route && route.length > 0) {
                    setActiveRoute(route);
                    setCurrentStepIndex(0);
                    setIsWrongDirection(false);
                    setArrivalAnnounced(false);

                    // Поворачиваем симулятора в сторону старта
                    if(isSimMode) setSimHeading(route[0].bearing || 0);

                    speak(`Пошли к: ${mapData[destId].name}. ${route[0].instruction}`);
                } else speak('Путь заблокирован.');
            } else speak(`Не нашла пункт назначения.`);
        }
        setInputText('');
    };

    if (!mapData) return <View style={styles.center}><Text>Постройка 3D здания...</Text></View>;

    const currentLeg = activeRoute ? activeRoute[currentStepIndex] : null;
    const currentFloor = currentNodeId && mapData[currentNodeId] ? mapData[currentNodeId].floor : '?';

    // Математика: Дистанция до текущей цели
    let distanceToTarget = 0;
    if (currentLeg && mapData[currentLeg.toNodeId]) {
        distanceToTarget = Math.hypot(currentPos.x - mapData[currentLeg.toNodeId].x, currentPos.y - mapData[currentLeg.toNodeId].y);
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Отрисовка КАРТЫ (SVG) */}
            <FloorMap mapData={mapData} activeRoute={activeRoute} currentNodeId={currentNodeId} userPos={currentPos} userHeading={effectiveHeading} />

            <ScrollView style={styles.content}>
                <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 }}>
                    <Text>Телеметрия: Этаж {currentFloor}, X: {currentPos.x.toFixed(1)}, Y: {currentPos.y.toFixed(1)}, Азимут: {effectiveHeading}°</Text>

                    {activeRoute && currentLeg && (
                        <View style={[styles.routeBox, isWrongDirection && styles.routeError]}>
                            <Text style={styles.routeHeader}>ВЕДЕНИЕ (Шаг {currentStepIndex + 1}/{activeRoute.length})</Text>
                            <Text style={styles.routeTarget}>К: {currentLeg.toNodeName}</Text>
                            <Text style={styles.routeInstruction}>{currentLeg.instruction}</Text>
                            <Text style={styles.progressText}>
                                Ожидаемый курс: {currentLeg.bearing}°. Осталось: {distanceToTarget.toFixed(1)} м
                            </Text>
                            {distanceToTarget <= TOLERANCE_ZONE && (
                                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmArrival}>
                                    <Text style={styles.confirmBtnText}>Я ДОШЕЛ(А)</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
                <View style={styles.chatBox}>
                    <Text style={[styles.chatResponse, isWrongDirection && styles.chatAlert]}>{lastResponse}</Text>
                </View>
            </ScrollView>

            {/* ПАНЕЛЬ ТЕСТЕРА (СИМУЛЯТОР) */}
            <View style={styles.testerPanel}>
                <Text style={{ fontSize: 12, fontWeight: 'bold' }}>🔧 ТЕСТЕР:</Text>
                <View style={styles.simControls}>
                    <TouchableOpacity style={styles.simBtn} onPress={() => setSimHeading(prev => (prev - 10 + 360) % 360)}><Text>↺ 10°</Text></TouchableOpacity>

                    <TouchableOpacity style={[styles.simBtn, { backgroundColor: '#FF9800' }]} onPress={handleStep}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>ШАГ ▶</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.simBtn} onPress={() => setSimHeading(prev => (prev + 10) % 360)}><Text>↻ 10°</Text></TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5 }}>
                    <Text style={{ fontSize: 12 }}>Физические датчики:</Text>
                    <Switch value={!isSimMode} onValueChange={(val) => setIsSimMode(!val)} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                    <Text style={{ fontSize: 12 }}>ВКЛ</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', margin: 10 },
    content: { flex: 1, padding: 15 },
    routeBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 2, borderColor: 'transparent' },
    routeError: { backgroundColor: '#ffebee', borderColor: '#f44336' },
    routeHeader: { fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 5 },
    routeTarget: { fontSize: 15, fontWeight: '600', color: '#1b5e20' },
    routeInstruction: { fontSize: 14, fontStyle: 'italic', color: '#333', marginVertical: 5 },
    progressText: { fontSize: 13, color: '#555', fontWeight: 'bold', marginTop: 5 },
    confirmBtn: { backgroundColor: '#4caf50', padding: 12, borderRadius: 6, marginTop: 15, alignItems: 'center' },
    confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    chatBox: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 12, marginBottom: 15 },
    chatResponse: { fontSize: 16, color: '#0d47a1' },
    chatAlert: { color: '#d32f2f', fontWeight: 'bold' },
    testerPanel: { backgroundColor: '#fff9c4', padding: 10, borderTopWidth: 1, borderColor: '#fbc02d' },
    simControls: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 5 },
    simBtn: { backgroundColor: '#fff', padding: 10, borderRadius: 6, width: 90, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
    simBtnText: { fontWeight: 'bold' },
    quickScroll: { flexGrow: 0, height: 50 },
    quickBtn: { backgroundColor: '#6c757d', paddingHorizontal: 15, borderRadius: 20, marginRight: 10, justifyContent: 'center', height: 40 },
    quickBtnText: { color: '#fff', fontWeight: 'bold' },
    zoomBtn: { backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
    zoomText: { fontSize: 24, fontWeight: 'bold', color: '#333', lineHeight: 28 },
});