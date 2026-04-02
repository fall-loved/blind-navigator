import { NavNode } from './mapEngine';

export interface RouteStep {
    toNodeId: string;
    toNodeName: string;
    instruction: string;
    distance: number;
    bearing: number;
    side?: 'слева' | 'справа' | 'прямо';
}

const calculateEdgeData = (nodeA: NavNode, nodeB: NavNode): { distance: number; bearing: number; side: 'слева' | 'справа' | 'прямо' } => {
    if (nodeA.floor !== nodeB.floor) return { distance: 5, bearing: 0, side: 'прямо' };
    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const distance = Math.hypot(dx, dy);
    let bearing = Math.atan2(dx, dy) * (180 / Math.PI);
    if (bearing < 0) bearing += 360;

    return {
        distance: Math.round(distance * 10) / 10,
        bearing: Math.round(bearing),
        side: 'прямо'
    };
};

const getTurnAngle = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    const angle1 = Math.atan2(ay - by, ax - bx);
    const angle2 = Math.atan2(cy - by, cx - bx);

    let angle = Math.abs((angle1 - angle2) * (180 / Math.PI));
    if (angle > 180) angle = 360 - angle;

    return angle;
};

export const findShortestPath = (graph: Record<string, NavNode>, startId: string, endId: string, preferElevator: boolean = false): RouteStep[] | null => {
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
            let floorPenalty = 0;
            if (graph[currNode].floor !== graph[neighborId].floor) {
                floorPenalty += 15;
                const isElevator = graph[currNode].name.toLowerCase().includes('лифт');
                if (!preferElevator && isElevator) floorPenalty += 10000;
                if (preferElevator && !isElevator) floorPenalty += 10000;
            }

            let roomPenalty = 0;
            if (graph[neighborId].type === 'room' && neighborId !== endId && neighborId !== startId) {
                roomPenalty += 50;
            }

            let anglePenalty = 0;
            if (neighborId === endId && previous[currNode] !== null) {
                const prevNodeId = previous[currNode] as string;
                const nodeA = graph[prevNodeId];
                const nodeB = graph[currNode];
                const nodeC = graph[neighborId];

                if (nodeA && nodeB && nodeC && nodeA.floor === nodeB.floor && nodeB.floor === nodeC.floor) {
                    const turnAngle = getTurnAngle(nodeA.x, nodeA.y, nodeB.x, nodeB.y, nodeC.x, nodeC.y);
                    const deviationFrom90 = Math.abs(90 - turnAngle);

                    anglePenalty = deviationFrom90 * 1.5;
                }
            }

            const alt = distances[currNode] + edgeData.distance + floorPenalty + roomPenalty + anglePenalty;

            if (alt < distances[neighborId]) {
                distances[neighborId] = alt;
                previous[neighborId] = currNode;
            }
        }
    }

    if (previous[endId] === null && startId !== endId) return null;

    const path: RouteStep[] = [];
    let curr = endId;

    while (curr !== startId) {
        const prev = previous[curr]!;
        const edgeData = calculateEdgeData(graph[prev], graph[curr]);
        let instruction = `Идите к: ${graph[curr].name}`;

        if (curr === endId && graph[curr].type === 'room') {
            const prevOfPrev = previous[prev];
            if (prevOfPrev) {
                const corridorBearing = calculateEdgeData(graph[prevOfPrev], graph[prev]).bearing;
                let diff = edgeData.bearing - corridorBearing;
                while (diff <= -180) diff += 360;
                while (diff > 180) diff -= 360;

                if (diff > 20 && diff < 160) edgeData.side = 'справа';
                else if (diff < -20 && diff > -160) edgeData.side = 'слева';
                else edgeData.side = 'прямо';
            }
        }

        if (graph[prev].floor !== graph[curr].floor) {
            const action = graph[curr].name.toLowerCase().includes('лифт') ? 'Поезжайте' : (graph[curr].floor > graph[prev].floor ? 'Поднимитесь' : 'Спуститесь');
            instruction = `${action} на ${graph[curr].floor} этаж`;
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