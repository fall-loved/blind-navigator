import { useState, useEffect } from 'react';
import { buildNavGraph, NavNode } from '@/utils/mapEngine'; // Убедитесь, что путь правильный

export const useBuildingMap = () => {
    const [mapData, setMapData] = useState<Record<string, NavNode> | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

    useEffect(() => {
        // Как только приложение запускается, мы просим движок сгенерировать карту
        try {
            console.log("Вызов генератора карты...");
            const generatedMap = buildNavGraph();
            setMapData(generatedMap);
        } catch (error) {
            console.error("Ошибка при сборке карты:", error);
        }
    }, []);

    // Функция для ручного/автоматического подтверждения позиции
    const checkInAtLocation = async (nodeId: string) => {
        if (mapData && mapData[nodeId]) {
            setCurrentNodeId(nodeId);
        } else {
            console.warn(`Попытка отметиться в несуществующей точке: ${nodeId}`);
        }
    };

    return { mapData, currentNodeId, checkInAtLocation };
};