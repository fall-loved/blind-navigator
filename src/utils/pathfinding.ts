import {buildingMap} from "@/data/buildingMap.ts";

export function findShortestPath(startId: string, targetId: string): string[] | null {
    if (startId === targetId) return [startId];
    if (startId === 'street') return null;

    const queue: string[][] = [[startId]];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
        const path = queue.shift()!;
        const currentId = path[path.length - 1];
        const node = buildingMap[currentId];

        if (!node.edges) continue;

        for (let edge of node.edges) {
            if (!visited.has(edge.to)) {
                const newPath = [...path, edge.to];
                if (edge.to === targetId) return newPath;
                visited.add(edge.to);
                queue.push(newPath);
            }
        }
    }
    return null;
}

