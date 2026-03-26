import { NavNode } from './mapEngine';

export interface RouteStep {
    toNodeId: string;
    toNodeName: string;
    instruction: string;
    distance: number;
    bearing: number;
    side?: 'слева' | 'справа' | 'прямо';
}

// Математика: вычисляем расстояние и азимут между двумя (X, Y)
const calculateEdgeData = (nodeA: NavNode, nodeB: NavNode) => {
    // Если переход между этажами
    if (nodeA.floor !== nodeB.floor) {
        return { distance: 5, bearing: 0, side: 'прямо' as const }; // Примерно 5 метров по лестнице
    }

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const distance = Math.hypot(dx, dy);

    // Азимут: 0 это Север (ось Y)
    let bearing = Math.atan2(dx, dy) * (180 / Math.PI);
    if (bearing < 0) bearing += 360;

    return {
        distance: Math.round(distance * 10) / 10,
        bearing: Math.round(bearing),
        side: 'прямо' as const
    };
};

// Алгоритм Дейкстры для нашей новой карты
export const findShortestPath = (graph: Record<string, NavNode>, startId: string, endId: string): RouteStep[] | null => {
    const distances: Record<string, number> = {};
    const previous: Record<string, string | null> = {};
    const unvisited = new Set<string>();

    for (const nodeId in graph) {
        distances[nodeId] = Infinity;
        previous[nodeId] = null;
        unvisited.add(nodeId);
    }
    distances[startId] = 0;

    while (unvisited.size > 0) {
        let currNode: string | null = null;
        let minDistance = Infinity;

        for (const nodeId of unvisited) {
            if (distances[nodeId] < minDistance) {
                minDistance = distances[nodeId];
                currNode = nodeId;
            }
        }

        if (currNode === null || currNode === endId) break;
        unvisited.delete(currNode);

        const neighbors = graph[currNode].edges || [];
        for (const neighborId of neighbors) {
            if (!unvisited.has(neighborId) || !graph[neighborId]) continue;

            const edgeData = calculateEdgeData(graph[currNode], graph[neighborId]);
            // Штраф за смену этажа, чтобы алгоритм не прыгал по лестницам просто так
            const floorPenalty = graph[currNode].floor !== graph[neighborId].floor ? 15 : 0;

            const alt = distances[currNode] + edgeData.distance + floorPenalty;
            if (alt < distances[neighborId]) {
                distances[neighborId] = alt;
                previous[neighborId] = currNode;
            }
        }
    }

    if (previous[endId] === null && startId !== endId) return null; // Путь не найден

    const path: RouteStep[] = [];
    let curr = endId;

    while (curr !== startId) {
        const prev = previous[curr]!;
        const edgeData = calculateEdgeData(graph[prev], graph[curr]);

        let instruction = `Идите к: ${graph[curr].name}`;
        if (graph[prev].floor !== graph[curr].floor) {
            instruction = graph[curr].floor > graph[prev].floor
                ? `Поднимитесь на ${graph[curr].floor} этаж`
                : `Спуститесь на ${graph[curr].floor} этаж`;
        }

        path.unshift({
            toNodeId: curr,
            toNodeName: graph[curr].name,
            instruction,
            distance: edgeData.distance,
            bearing: edgeData.bearing,
            side: edgeData.side
        });
        curr = prev;
    }

    return path;
};