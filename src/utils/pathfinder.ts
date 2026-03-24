import { BuildingMap, Edge } from '../types';

export interface RouteStep {
    toNodeId: string;
    toNodeName: string;
    instruction: string;
    distance: number;
    bearing?: number;
    side?: 'слева' | 'справа' | 'прямо'; // <-- СЮДА
}

export const findShortestPath = (
    mapData: BuildingMap,
    startId: string,
    endId: string
): RouteStep[] | null => {
    const distances: Record<string, number> = {};
    const previous: Record<string, { nodeId: string; edge: Edge } | null> = {};
    const unvisited = new Set<string>(Object.keys(mapData));

    // 1. Инициализация: расстояния до всех узлов равны бесконечности, кроме стартового
    for (const key of unvisited) {
        distances[key] = Infinity;
        previous[key] = null;
    }
    distances[startId] = 0;

    // 2. Основной цикл алгоритма Дейкстры
    while (unvisited.size > 0) {
        // Ищем непосещенный узел с минимальным известным расстоянием
        let currentId: string | null = null;
        let minDistance = Infinity;

        for (const nodeId of unvisited) {
            if (distances[nodeId] < minDistance) {
                minDistance = distances[nodeId];
                currentId = nodeId;
            }
        }

        // Если пути больше нет или мы дошли до цели — останавливаем поиск
        if (currentId === null || currentId === endId) break;

        unvisited.delete(currentId);
        const currentNode = mapData[currentId];

        // Проверяем всех соседей текущего узла
        if (currentNode.edges) {
            for (const edge of currentNode.edges) {
                if (unvisited.has(edge.to)) {
                    // Вычисляем новое расстояние через текущий узел
                    const altDistance = distances[currentId] + edge.distance;

                    // Если нашли путь короче — запоминаем его
                    if (altDistance < distances[edge.to]) {
                        distances[edge.to] = altDistance;
                        previous[edge.to] = { nodeId: currentId, edge: edge };
                    }
                }
            }
        }
    }

    // 3. Если путь не найден (узлы изолированы)
    if (distances[endId] === Infinity) return null;

    // 4. Восстанавливаем маршрут с конца в начало, собирая инструкции
    const path: RouteStep[] = [];
    let currId = endId;

    while (currId !== startId) {
        const prev = previous[currId];
        if (!prev) return null;

        path.unshift({
            toNodeId: currId,
            toNodeName: mapData[currId].name,
            instruction: prev.edge.instruction,
            distance: Math.round(prev.edge.distance),
            bearing: prev.edge.bearing,
            side: prev.edge.side
        });

        currId = prev.nodeId;
    }

    return path;
};