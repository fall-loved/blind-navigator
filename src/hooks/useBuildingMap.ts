import { useState, useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Pedometer } from 'expo-sensors';
import { defaultBuildingMap } from '@/data/buildingMap';
import { BuildingMap } from '../types';

const MAP_FILE_URI = FileSystem.documentDirectory + 'dynamic_map.json';
const STEP_LENGTH = 0.65;
const ALPHA = 0.2;

export const useBuildingMap = () => {
    const [mapData, setMapData] = useState<BuildingMap | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

    const stepCount = useRef(0);
    const pedometerSub = useRef<any>(null);

    useEffect(() => {
        const initMap = async () => {
            try {
                const fileInfo = await FileSystem.getInfoAsync(MAP_FILE_URI);
                if (fileInfo.exists) {
                    const jsonString = await FileSystem.readAsStringAsync(MAP_FILE_URI);
                    setMapData(JSON.parse(jsonString));
                    console.log('Карта загружена из памяти телефона');
                } else {
                    setMapData(defaultBuildingMap);
                    console.log('Используется стартовый шаблон карты');
                }
            } catch (e) {
                console.error('Ошибка загрузки карты', e);
                setMapData(defaultBuildingMap);
            }
        };
        initMap().then(r => r);

        Pedometer.requestPermissionsAsync().then(r => r);

        return () => stopPedometer();
    }, []);

    const saveMap = async (newMap: BuildingMap) => {
        try {
            await FileSystem.writeAsStringAsync(MAP_FILE_URI, JSON.stringify(newMap, null, 2));
            setMapData(newMap);
        } catch (e) {
            console.error('Ошибка сохранения', e);
        }
    };

    const startPedometer = () => {
        stepCount.current = 0;
        pedometerSub.current = Pedometer.watchStepCount(result => {
            stepCount.current = result.steps;
        });
    };

    const stopPedometer = () => {
        if (pedometerSub.current) {
            pedometerSub.current.remove();
            pedometerSub.current = null;
        }
    };

    // ==========================================
    // ГЛАВНАЯ ФУНКЦИЯ: Пользователь сообщает, где он находится
    // ==========================================
    const checkInAtLocation = async (nodeId: string) => {
        if (!mapData) return;

        if (!mapData[nodeId]) {
            console.log(`Локация с ID "${nodeId}" не найдена в графе.`);
            return;
        }

        const targetNodeKey = nodeId;

        if (!currentNodeId) {
            setCurrentNodeId(targetNodeKey);
            startPedometer();
            console.log(`Вы у: ${mapData[targetNodeKey].name}. Начинаем считать шаги.`);
            return;
        }

        if (currentNodeId !== targetNodeKey) {
            stopPedometer();

            const measuredDistance = stepCount.current * STEP_LENGTH;
            console.log(`Пройдено шагов: ${stepCount.current} (~${measuredDistance.toFixed(1)} м)`);

            const updatedMap = { ...mapData };
            const startNode = updatedMap[currentNodeId];
            const endNode = updatedMap[targetNodeKey];

            const forwardEdge = startNode.edges?.find(e => e.to === targetNodeKey);
            if (forwardEdge) {
                forwardEdge.distance = (forwardEdge.distance * (1 - ALPHA)) + (measuredDistance * ALPHA);
            }

            const backwardEdge = endNode.edges?.find(e => e.to === currentNodeId);
            if (backwardEdge) {
                backwardEdge.distance = (backwardEdge.distance * (1 - ALPHA)) + (measuredDistance * ALPHA);
            }

            if (forwardEdge || backwardEdge) {
                console.log(`Дистанция между ${startNode.name} и ${endNode.name} обновлена!`);
                await saveMap(updatedMap);
            } else {
                console.log(`⚠️ Прямого коридора между ${startNode.name} и ${endNode.name} не найдено.`);
            }

            setCurrentNodeId(targetNodeKey);
            startPedometer();
        }
    };

    return {
        mapData,
        currentNodeId,
        checkInAtLocation,
    };
};