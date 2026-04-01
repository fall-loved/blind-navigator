import React, {useEffect, useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Switch } from 'react-native';
import FloorMap from '@/components/FloorMap';
import { useNavigator } from '@/hooks/useNavigator';
import {Audio} from "expo-av";
import {Pedometer} from "expo-sensors";

export default function App() {
    const nav = useNavigator();
    const [inputText, setInputText] = useState('');
    const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);

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

    if (!nav.mapData) return <View style={styles.center}><Text>Постройка 3D здания...</Text></View>;


    return (
        <SafeAreaView style={styles.container}>
            {/* ПЕРЕКЛЮЧАТЕЛЬ ЭТАЖЕЙ */}
            <View style={styles.floorTabs}>
                {[1, 2, 3].map(f => (
                    <TouchableOpacity key={f} style={[styles.tab, nav.viewFloor === f && styles.activeTab]} onPress={() => nav.setViewFloor(f)}>
                        <Text style={[styles.tabText, nav.viewFloor === f && styles.activeTabText]}>{f} этаж</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Отрисовка КАРТЫ */}
            <FloorMap
                mapData={nav.mapData}
                mapWalls={nav.mapWalls}
                activeRoute={nav.activeRoute}
                currentNodeId={nav.currentNodeId}
                userPos={nav.currentPos}
                userHeading={nav.effectiveHeading}
                viewFloor={nav.viewFloor}
                onNodePress={async (nodeId) => {
                    await nav.checkInAtLocation(nodeId);
                    nav.speak(`Телепортация: ${nav.mapData![nodeId].name}`);
                    nav.setActiveRoute(null);
                    nav.setFinalDestId(null);
                }}
            />

            <ScrollView style={styles.content}>
                {/* ТЕЛЕМЕТРИЯ И ВЕДЕНИЕ */}
                <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 15 }}>
                    {/* ОБНОВЛЕННАЯ СТРОКА ТЕЛЕМЕТРИИ С PITCH И ROLL */}
                    <Text style={{fontSize: 12, color: '#666', marginBottom: 4}}>
                        📍 Этаж {nav.currentFloor} | X: {nav.currentPos.x.toFixed(1)} Y: {nav.currentPos.y.toFixed(1)}
                    </Text>
                    <Text style={{fontSize: 12, color: '#1976d2', fontWeight: 'bold', marginBottom: 8}}>
                        🧭 Азимут: {nav.effectiveHeading}° | Pitch: {nav.pitch}° | Roll: {nav.roll}°
                    </Text>

                    {/* АЛЕРТ КРИТИЧЕСКОГО НАКЛОНА */}
                    {Math.abs(nav.pitch) > 70 && (
                        <View style={{ backgroundColor: '#ff9800', padding: 8, borderRadius: 6, marginBottom: 10 }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                                ⚠️ Телефон сильно наклонен! Точность компаса может быть снижена.
                            </Text>
                        </View>
                    )}

                    {nav.activeRoute && nav.currentLeg && (
                        <View style={[styles.routeBox, nav.isWrongDirection && styles.routeError]}>
                            <Text style={styles.routeHeader}>ВЕДЕНИЕ ({nav.currentStepIndex + 1}/{nav.activeRoute.length})</Text>
                            <Text style={styles.routeTarget}>К: {nav.currentLeg.toNodeName}</Text>
                            <Text style={styles.routeInstruction}>{nav.currentLeg.instruction}</Text>
                            <Text style={styles.progressText}>Ожидаемый курс: {nav.currentLeg.bearing}°. Осталось: {nav.distanceToTarget.toFixed(1)} м</Text>
                        </View>
                    )}
                </View>

                {/* ПАНЕЛЬ ПОРТАЛА (ЛЕСТНИЦА/ЛИФТ) */}
                {nav.availableFloors.length > 0 && nav.currentNodeId && (
                    <View style={styles.portalBox}>
                        <Text style={styles.portalHeader}>⚠️ ПЕРЕХОД МЕЖДУ ЭТАЖАМИ</Text>
                        <Text style={styles.portalText}>{nav.mapData[nav.currentNodeId].name}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
                            {nav.availableFloors.map(f => (
                                <TouchableOpacity key={f} style={styles.portalBtn} onPress={() => nav.handleFloorTransition(f)}>
                                    <Text style={styles.portalBtnText}>Я на {f} этаже</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ЧАТ АССИСТЕНТА */}
                <View style={styles.chatBox}>
                    <Text style={[styles.chatResponse, nav.isWrongDirection && styles.chatAlert]}>{nav.lastResponse}</Text>
                </View>

                {/* ПОЛЕ ВВОДА */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={() => { nav.handleCommand(inputText); setInputText(''); }}
                        placeholder="Например: Идем к 302..."
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={() => { nav.handleCommand(inputText); setInputText(''); }}>
                        <Text style={styles.sendBtnText}>➤</Text>
                    </TouchableOpacity>
                </View>

                {/* БЫСТРЫЕ КНОПКИ ТЕСТОВ */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => nav.handleCommand('Я у Вход')}>
                        <Text style={styles.quickBtnText}>📍 Старт (Вход 1 эт)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.quickBtn, {backgroundColor: '#1976d2'}]} onPress={() => nav.handleCommand('К 302')}>
                        <Text style={styles.quickBtnText}>К 302 (Лестница)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.quickBtn, {backgroundColor: '#ff9800'}]} onPress={() => nav.handleCommand('К 302 на лифте')}>
                        <Text style={styles.quickBtnText}>К 302 (Лифт)</Text>
                    </TouchableOpacity>
                </ScrollView>
            </ScrollView>

            {/* ПАНЕЛЬ СИМУЛЯТОРА */}
            <View style={styles.testerPanel}>
                <Text style={{ fontSize: 12, fontWeight: 'bold' }}>🔧 ТЕСТЕР:</Text>
                <View style={styles.simControls}>
                    <TouchableOpacity style={styles.simBtn} onPress={() => nav.setSimHeading(prev => (prev - 10 + 360) % 360)}><Text>↺ 10°</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.simBtn, { backgroundColor: '#FF9800' }]} onPress={nav.handleStep}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>ШАГ ▶</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.simBtn} onPress={() => nav.setSimHeading(prev => (prev + 10) % 360)}><Text>↻ 10°</Text></TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 5 }}>
                    <Text style={{ fontSize: 12 }}>Физические датчики:</Text>
                    <Switch value={!nav.isSimMode} onValueChange={(val) => nav.setIsSimMode(!val)} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                    <Text style={{ fontSize: 12 }}>ВКЛ</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, padding: 15 },
    routeBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 2, borderColor: 'transparent' },
    routeError: { backgroundColor: '#ffebee', borderColor: '#f44336' },
    routeHeader: { fontSize: 12, fontWeight: 'bold', color: '#2e7d32', marginBottom: 5 },
    routeTarget: { fontSize: 15, fontWeight: '600', color: '#1b5e20' },
    routeInstruction: { fontSize: 14, fontStyle: 'italic', color: '#333', marginVertical: 5 },
    progressText: { fontSize: 13, color: '#555', fontWeight: 'bold', marginTop: 5 },
    chatBox: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 12, marginBottom: 15 },
    chatResponse: { fontSize: 16, color: '#0d47a1' },
    chatAlert: { color: '#d32f2f', fontWeight: 'bold' },
    testerPanel: { backgroundColor: '#fff9c4', padding: 10, borderTopWidth: 1, borderColor: '#fbc02d' },
    simControls: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 5 },
    simBtn: { backgroundColor: '#fff', padding: 10, borderRadius: 6, width: 90, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
    floorTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#ccc' },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f5f5f5' },
    activeTab: { backgroundColor: '#e3f2fd', borderBottomWidth: 3, borderColor: '#1976d2' },
    tabText: { fontSize: 16, color: '#666', fontWeight: '500' },
    activeTabText: { color: '#1976d2', fontWeight: 'bold' },
    portalBox: { backgroundColor: '#ffe082', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 2, borderColor: '#ffb300' },
    portalHeader: { fontSize: 12, fontWeight: 'bold', color: '#e65100', marginBottom: 5, textAlign: 'center' },
    portalText: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },
    portalBtn: { backgroundColor: '#ff9800', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, elevation: 2 },
    portalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    inputContainer: { flexDirection: 'row', marginBottom: 15 },
    input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 25, paddingHorizontal: 15, fontSize: 16, height: 50 },
    sendBtn: { backgroundColor: '#007bff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sendBtnText: { color: '#fff', fontSize: 20 },
    quickScroll: { flexGrow: 0, height: 50, marginBottom: 15 },
    quickBtn: { backgroundColor: '#6c757d', paddingHorizontal: 15, borderRadius: 20, marginRight: 10, justifyContent: 'center', height: 40 },
    quickBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});