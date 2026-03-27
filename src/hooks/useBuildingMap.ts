import { useState, useEffect } from 'react';
import { buildNavGraph, NavNode, Wall } from '@/utils/mapEngine';

export const useBuildingMap = () => {
    const [mapData, setMapData] = useState<Record<string, NavNode> | null>(null);
    const [mapWalls, setMapWalls] = useState<Record<number, Wall[]> | null>(null);
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);

    useEffect(() => {
        try {
            const { nodes, walls } = buildNavGraph();
            setMapData(nodes);
            setMapWalls(walls);
        } catch (error) {
            console.error("Ошибка при сборке карты:", error);
        }
    }, []);

    const checkInAtLocation = async (nodeId: string) => {
        if (mapData && mapData[nodeId]) {
            setCurrentNodeId(nodeId);
        }
    };

    return { mapData, mapWalls, currentNodeId, checkInAtLocation };
};