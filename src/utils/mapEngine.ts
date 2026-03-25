// Импортируем наши сырые карты
import floor1 from '@/data/maps/floor1.json';
import floor2 from '@/data/maps/floor2.json';
import floor3 from '@/data/maps/floor3.json';

export interface NavNode {
    id: string;
    name: string;
    type: 'room' | 'waypoint';
    floor: number;
    x: number;
    y: number;
    edges: string[]; // ID связанных точек
}

export interface Wall {
    x1: number; y1: number;
    x2: number; y2: number;
}

// Математика: пересекаются ли два отрезка (линия пути и стена)
const linesIntersect = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean => {
    const det = (x2 - x1) * (y4 - y3) - (x4 - x3) * (y2 - y1);
    if (det === 0) return false; // Параллельны
    const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / det;
    const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / det;
    // Оставляем небольшой запас (0.01 и 0.99), чтобы лучи могли скользить по краям стен
    return (0.01 < lambda && lambda < 0.99) && (0.01 < gamma && gamma < 0.99);
};

// Функция выравнивания и масштабирования этажа
const normalizeFloor = (floorData: any, floorNumber: number, targetDistance: number | null = null) => {
    const nodes: Record<string, NavNode> = {};
    const walls: Wall[] = [];

    const mainStair = floorData.nodes['room_Главная_лестница'];
    const farStair = floorData.nodes['room_Дальняя_лестница'];

    if (!mainStair || !farStair) {
        console.error(`Ошибка: На этаже ${floorNumber} нет Главной или Дальней лестницы!`);
        return { nodes, walls, distance: 0 };
    }

    // 1. СДВИГ: Делаем Главную лестницу центром координат (0,0)
    const offsetX = mainStair.x;
    const offsetY = mainStair.y;

    let currentDistance = Math.hypot(farStair.x - offsetX, farStair.y - offsetY);

    // 2. МАСШТАБ: Если передан targetDistance (от 1 этажа), вычисляем коэффициент
    const scaleFactor = targetDistance ? (targetDistance / currentDistance) : 1;

    // Нормализуем узлы
    for (const key in floorData.nodes) {
        const n = floorData.nodes[key];
        nodes[`f${floorNumber}_${n.id}`] = {
            id: `f${floorNumber}_${n.id}`, // Уникальный ID с номером этажа
            name: n.name,
            type: n.type,
            floor: floorNumber,
            x: (n.x - offsetX) * scaleFactor,
            y: (n.y - offsetY) * scaleFactor,
            edges: [] // Заполним позже
        };
    }

    // Нормализуем стены
    for (const w of floorData.walls) {
        walls.push({
            x1: (w.x1 - offsetX) * scaleFactor, y1: (w.y1 - offsetY) * scaleFactor,
            x2: (w.x2 - offsetX) * scaleFactor, y2: (w.y2 - offsetY) * scaleFactor
        });
    }

    return { nodes, walls, distance: currentDistance * scaleFactor };
};

export const buildNavGraph = (): Record<string, NavNode> => {
    let globalNodes: Record<string, NavNode> = {};
    const floorsWalls: Record<number, Wall[]> = {};

    console.log("🛠 Начинаю сборку и калибровку здания...");

    // 1. Калибруем 1 этаж (он будет нашим эталоном)
    const floor1Data = normalizeFloor(floor1, 1);
    globalNodes = { ...globalNodes, ...floor1Data.nodes };
    floorsWalls[1] = floor1Data.walls;
    const baseDistance = floor1Data.distance; // Расстояние 1 этажа (~57.5м)

    // 2. Подгоняем 2 и 3 этажи под эталон первого
    const floor2Data = normalizeFloor(floor2, 2, baseDistance);
    globalNodes = { ...globalNodes, ...floor2Data.nodes };
    floorsWalls[2] = floor2Data.walls;

    const floor3Data = normalizeFloor(floor3, 3, baseDistance);
    globalNodes = { ...globalNodes, ...floor3Data.nodes };
    floorsWalls[3] = floor3Data.walls;

    // 3. АВТОМАТИЧЕСКАЯ ПРОКЛАДКА МАРШРУТОВ (Raycasting)
    console.log("🔍 Прокладываю коридоры (проверка стен)...");
    const nodeKeys = Object.keys(globalNodes);

    for (let i = 0; i < nodeKeys.length; i++) {
        for (let j = i + 1; j < nodeKeys.length; j++) {
            const nodeA = globalNodes[nodeKeys[i]];
            const nodeB = globalNodes[nodeKeys[j]];

            // Точки на разных этажах не соединяем сквозь потолок
            if (nodeA.floor !== nodeB.floor) continue;

            // Комнаты не соединяем напрямую друг с другом (только через waypoints)
            if (nodeA.type === 'room' && nodeB.type === 'room') continue;

            const dist = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);

            // Защита: не соединяем точки, которые слишком далеко (чтобы лучи не летели через всё здание)
            if (dist > 15) continue;

            // Трассировка луча: проверяем каждую стену на ЭТОМ этаже
            let hitWall = false;
            for (const wall of floorsWalls[nodeA.floor]) {
                if (linesIntersect(nodeA.x, nodeA.y, nodeB.x, nodeB.y, wall.x1, wall.y1, wall.x2, wall.y2)) {
                    hitWall = true;
                    break;
                }
            }

            // Если путь свободен — соединяем!
            if (!hitWall) {
                nodeA.edges.push(nodeB.id);
                nodeB.edges.push(nodeA.id);
            }
        }
    }

    // 4. СВЯЗЫВАЕМ ЭТАЖИ (Лестницы и Лифты)
    console.log("🔗 Соединяю этажи лестницами...");
    const portals = ['room_Главная_лестница', 'room_Центральная_лестница', 'room_Дальняя_лестница', 'room_Лифт'];

    portals.forEach(portalName => {
        // Связь 1 -> 2 этаж
        if (globalNodes[`f1_${portalName}`] && globalNodes[`f2_${portalName}`]) {
            globalNodes[`f1_${portalName}`].edges.push(`f2_${portalName}`);
            globalNodes[`f2_${portalName}`].edges.push(`f1_${portalName}`);
        }
        // Связь 2 -> 3 этаж
        if (globalNodes[`f2_${portalName}`] && globalNodes[`f3_${portalName}`]) {
            globalNodes[`f2_${portalName}`].edges.push(`f3_${portalName}`);
            globalNodes[`f3_${portalName}`].edges.push(`f2_${portalName}`);
        }
    });

    console.log(`✅ Здание успешно построено! Всего узлов: ${nodeKeys.length}`);
    return globalNodes;
};