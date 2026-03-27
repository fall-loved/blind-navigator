import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Speech from 'expo-speech';
import { useBuildingMap } from './useBuildingMap';
import { useCompass } from './useCompass';
import { useCustomPedometer } from './useCustomPedometer';
import { parseVoiceCommand, matchNodeOnMap } from '@/utils/intentParser';
import { findShortestPath, RouteStep } from '@/utils/pathfinder';

const STEP_LENGTH = 0.65;
const TOLERANCE_ZONE = 1.0;

const getRelativeDirectionText = (currentHeading: number, targetBearing: number) => {
    let diff = targetBearing - currentHeading;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;

    if (Math.abs(diff) <= 20) return 'прямо';
    if (diff > 20 && diff <= 60) return 'немного правее';
    if (diff > 60 && diff <= 120) return 'направо';
    if (diff > 120 || diff < -120) return 'кругом (развернитесь)';
    if (diff < -20 && diff >= -60) return 'немного левее';
    if (diff < -60 && diff >= -120) return 'налево';
    return 'прямо';
};

const getTurnText = (prevBearing: number, nextBearing: number) => {
    let diff = nextBearing - prevBearing;
    while (diff <= -180) diff += 360;
    while (diff > 180) diff -= 360;

    if (Math.abs(diff) <= 25) return 'Продолжайте идти прямо';
    if (diff > 25 && diff <= 110) return 'Поверните направо';
    if (diff > 110 || diff < -110) return 'Развернитесь';
    if (diff < -25 && diff >= -110) return 'Поверните налево';
    return 'Идите прямо';
};

const getAngleDiff = (angle1: number, angle2: number) => {
    let diff = Math.abs(angle1 - angle2);
    return diff > 180 ? 360 - diff : diff;
};

export const useNavigator = () => {
    const { mapData, mapWalls, currentNodeId, checkInAtLocation } = useBuildingMap();
    const currentHeading = useCompass();

    const [isSimMode, setIsSimMode] = useState(true);
    const [simHeading, setSimHeading] = useState(0);
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

    const [lastResponse, setLastResponse] = useState('Навигатор запущен. Жду команду.');
    const [activeRoute, setActiveRoute] = useState<RouteStep[] | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const [finalDestId, setFinalDestId] = useState<string | null>(null);
    const [useElevator, setUseElevator] = useState(false);

    const [isWrongDirection, setIsWrongDirection] = useState(false);
    const [arrivalAnnounced, setArrivalAnnounced] = useState(false);
    const [viewFloor, setViewFloor] = useState(1);

    const effectiveHeading = isSimMode ? simHeading : currentHeading;

    const speak = useCallback((text: string) => {
        setLastResponse(text);
        Speech.stop();
        Speech.speak(text, { language: 'ru-RU', rate: 0.95 });
    }, []);

    useEffect(() => {
        if (currentNodeId && mapData && mapData[currentNodeId]) {
            setCurrentPos({ x: mapData[currentNodeId].x, y: mapData[currentNodeId].y });
            setViewFloor(mapData[currentNodeId].floor);
        }
    }, [currentNodeId, mapData]);

    const handleStep = useCallback(() => {
        const activeHeading = isSimMode ? simHeading : currentHeading;
        setCurrentPos(prev => {
            const dx = STEP_LENGTH * Math.sin(activeHeading * (Math.PI / 180));
            const dy = STEP_LENGTH * Math.cos(activeHeading * (Math.PI / 180));
            return { x: prev.x + dx, y: prev.y + dy };
        });
    }, [isSimMode, simHeading, currentHeading]);

    useCustomPedometer(activeRoute !== null && !isSimMode, handleStep);

    useEffect(() => {
        if (!activeRoute || activeRoute.length === 0 || !mapData) return;
        const currentLeg = activeRoute[currentStepIndex];
        if (!currentLeg) return;

        const targetNode = mapData[currentLeg.toNodeId];
        if (!targetNode) return;

        const dist = Math.hypot(currentPos.x - targetNode.x, currentPos.y - targetNode.y);

        if (dist <= TOLERANCE_ZONE) {
            if (currentStepIndex < activeRoute.length - 1) {
                const nextLeg = activeRoute[currentStepIndex + 1];
                const turnText = getTurnText(currentLeg.bearing, nextLeg.bearing);
                const distanceText = Math.round(nextLeg.distance);

                const isGenericNode = nextLeg.toNodeName.toLowerCase().includes('точка') || nextLeg.toNodeName.toLowerCase().includes('waypoint');
                const prompt = isGenericNode
                    ? `${turnText} и пройдите ${distanceText} метров.`
                    : `${turnText}. Ваша цель, ${nextLeg.toNodeName}, через ${distanceText} метров.`;

                speak(prompt);
                setCurrentStepIndex(prev => prev + 1);
            } else {
                if (!arrivalAnnounced) {
                    setArrivalAnnounced(true);
                    if (currentLeg.toNodeId.includes('лестница') || currentLeg.toNodeId.toLowerCase().includes('лифт')) {
                        checkInAtLocation(currentLeg.toNodeId);
                    } else {
                        const sideText = currentLeg.side && currentLeg.side !== 'прямо' ? `Дверь ${currentLeg.side}.` : '';
                        speak(`Вы достигли цели. ${sideText}`);
                        setActiveRoute(null);
                        setFinalDestId(null);
                    }
                }
            }
        }
    }, [currentPos, activeRoute, currentStepIndex, mapData, arrivalAnnounced, checkInAtLocation, speak]);

    useEffect(() => {
        if (!activeRoute || activeRoute.length === 0 || !mapData) return;
        const currentLeg = activeRoute[currentStepIndex];
        if (!currentLeg) return;

        if (currentLeg.distance > 5 && currentLeg.bearing !== undefined) {
            const angleDiff = getAngleDiff(effectiveHeading, currentLeg.bearing);
            if (angleDiff > 45 && !isWrongDirection) {
                setIsWrongDirection(true);
                speak(`Сбились с курса. Возьмите ${getRelativeDirectionText(effectiveHeading, currentLeg.bearing)}.`);
            } else if (angleDiff <= 45 && isWrongDirection) {
                setIsWrongDirection(false);
            }
        }
    }, [effectiveHeading, activeRoute, currentStepIndex, mapData, isWrongDirection, speak]);

    const startNavigation = useCallback((startId: string, destId: string, wantsElevator: boolean, isFallback: boolean = false) => {
        if (!mapData) return;
        const startNode = mapData[startId];
        const destNode = mapData[destId];

        setUseElevator(wantsElevator);
        setFinalDestId(destId);

        let targetIdForCurrentFloor = destId;

        if (startNode.floor !== destNode.floor) {
            const keyword = wantsElevator ? 'лифт' : 'лестница';
            const portals = Object.values(mapData).filter(n => n.floor === startNode.floor && n.name.toLowerCase().includes(keyword));

            if (portals.length === 0) {
                if (!isFallback) {
                    speak(`На ${startNode.floor} этаже не найдено ${keyword}. Ищу альтернативный путь.`);
                    startNavigation(startId, destId, !wantsElevator, true);
                } else {
                    speak(`Не удалось найти переходы на ${startNode.floor} этаже.`);
                    setActiveRoute(null);
                }
                return;
            }

            let minDist = Infinity;
            let bestPortalId = portals[0].id;
            for (const p of portals) {
                const dist = Math.hypot(startNode.x - p.x, startNode.y - p.y);
                if (dist < minDist) { minDist = dist; bestPortalId = p.id; }
            }
            targetIdForCurrentFloor = bestPortalId;
        }

        if (startId === targetIdForCurrentFloor) {
            if (startNode.floor !== destNode.floor) {
                speak(`Вы уже у перехода. Поднимитесь на ${destNode.floor} этаж.`);
            } else {
                speak(`Вы уже находитесь в пункте назначения.`);
            }
            return;
        }

        const route = findShortestPath(mapData, startId, targetIdForCurrentFloor, wantsElevator);

        if (route && route.length > 0) {
            setActiveRoute(route);
            setCurrentStepIndex(0);
            setIsWrongDirection(false);
            setArrivalAnnounced(false);
            if(isSimMode) setSimHeading(route[0].bearing || 0);

            const firstLeg = route[0];
            const isGenericNode = firstLeg.toNodeName.toLowerCase().includes('точка') || firstLeg.toNodeName.toLowerCase().includes('waypoint');

            let startInstruction = '';
            if (isGenericNode) {
                startInstruction = `Идите прямо ${Math.round(firstLeg.distance)} метров.`;
            } else {
                const sideText = route.length === 1 && firstLeg.side && firstLeg.side !== 'прямо' ? `Дверь будет ${firstLeg.side}.` : '';
                startInstruction = `Идите прямо к ${firstLeg.toNodeName}. ${sideText}`;
            }

            speak(`Маршрут построен. ${startInstruction}`);
        } else {
            if (!isFallback && startNode.floor !== destNode.floor) {
                speak(`Путь к ${wantsElevator ? 'лифту' : 'лестнице'} заблокирован. Пробую другой маршрут.`);
                startNavigation(startId, destId, !wantsElevator, true);
            } else {
                speak('Путь не найден. Возможно, точки не соединены на карте.');
                setActiveRoute(null);
            }
        }
    }, [mapData, isSimMode, speak]);

    const handleCommand = useCallback(async (rawText: string) => {
        if (!rawText.trim() || !mapData) return;
        const raw = rawText.toLowerCase();

        if (raw.includes('отмен') || raw.includes('стоп') || raw.includes('заверш')) {
            setActiveRoute(null);
            setFinalDestId(null);
            speak('Маршрут отменен.');
            return;
        }

        const intent = parseVoiceCommand(rawText);

        if (intent.type === 'WHERE_AM_I') {
            let bestNode = null;
            let minDist = Infinity;
            for (const key in mapData) {
                const node = mapData[key];
                // ИГНОРИРУЕМ ПУТЕВЫЕ ТОЧКИ! Ищем только двери, лестницы и реальные ориентиры
                if (node.floor === viewFloor && !node.name.toLowerCase().includes('точка') && !node.name.toLowerCase().includes('waypoint')) {
                    const dist = Math.hypot(currentPos.x - node.x, currentPos.y - node.y);
                    if (dist < minDist) { minDist = dist; bestNode = node; }
                }
            }
            if (bestNode) {
                if (minDist <= 1.5) speak(`Вы находитесь прямо у: ${bestNode.name}.`);
                else speak(`Ближайший ориентир: ${bestNode.name}, примерно в ${Math.round(minDist)} метрах.`);
            } else speak('Я пока не знаю позицию.');

        } else if (intent.type === 'CHECK_IN' && intent.payload) {
            const isNear = raw.match(/\b(у|возле|около|рядом)\b/) !== null;

            const cleanPayload = intent.payload.replace(/\b(у|возле|около|рядом с|рядом)\b/gi, '').trim();
            const destId = matchNodeOnMap(cleanPayload || intent.payload, mapData);

            if (destId) {
                let teleportId = destId;
                const targetNode = mapData[destId];

                if (isNear) {
                    const connectedEdges = targetNode.edges || [];
                    for (const edgeId of connectedEdges) {
                        if (mapData[edgeId] && mapData[edgeId].type !== 'room') {
                            teleportId = edgeId;
                            break;
                        }
                    }
                }

                setActiveRoute(null);
                setFinalDestId(null);
                speak(`Позиция обновлена: ${isNear ? 'возле ' : 'в '}${targetNode.name}.`);
                await checkInAtLocation(teleportId);
                setCurrentPos({ x: mapData[teleportId].x, y: mapData[teleportId].y }); // Обновляем радар
            } else speak(`Не поняла локацию "${intent.payload}".`);

        } else if (intent.type === 'NAVIGATE_TO' && intent.payload) {
            let bestStartId = currentNodeId;
            let minDist = Infinity;
            for (const key in mapData) {
                if (mapData[key].floor === viewFloor) {
                    const dist = Math.hypot(currentPos.x - mapData[key].x, currentPos.y - mapData[key].y);
                    if (dist < minDist) { minDist = dist; bestStartId = key; }
                }
            }

            if (!bestStartId) {
                speak('Где вы находитесь? Нажмите "Старт" или скажите ориентир.');
                return;
            }

            const wantsElevator = raw.includes('лифт');
            const cleanPayload = intent.payload.replace(/\b(на|через)\b\s*лифт[а-я]*/gi, '').trim();

            const destId = matchNodeOnMap(cleanPayload, mapData);
            if (destId) {
                startNavigation(bestStartId, destId, wantsElevator);
            } else speak(`Не нашла пункт назначения.`);
        }
    }, [mapData, currentNodeId, currentPos, viewFloor, startNavigation, checkInAtLocation, speak]);

    const currentFloor = viewFloor;

    const portalNearby = useMemo(() => {
        if (!mapData) return null;
        let bestPortal = null;
        let minPortalDist = 1.2;

        for (const key in mapData) {
            const node = mapData[key];
            if (node.floor === currentFloor && (node.name.toLowerCase().includes('лестница') || node.name.toLowerCase().includes('лифт'))) {
                const dist = Math.hypot(currentPos.x - node.x, currentPos.y - node.y);
                if (dist <= minPortalDist) {
                    minPortalDist = dist;
                    bestPortal = node;
                }
            }
        }
        return bestPortal;
    }, [mapData, currentPos, currentFloor]);

    const availableFloors = useMemo(() => {
        const floors: number[] = [];
        if (portalNearby && mapData) {
            const basePortalId = portalNearby.id.substring(portalNearby.id.indexOf('_') + 1);
            const portalName = portalNearby.name.toLowerCase();

            for (const key in mapData) {
                const node = mapData[key];
                if (node.floor !== currentFloor) {
                    if (key === `f${node.floor}_${basePortalId}` ||
                        (portalName.includes('лифт') && node.name.toLowerCase().includes('лифт'))) {
                        if (!floors.includes(node.floor)) floors.push(node.floor);
                    }
                }
            }
        }
        return floors.sort();
    }, [portalNearby, mapData, currentFloor]);

    const handleFloorTransition = useCallback(async (targetFloor: number) => {
        if (!portalNearby || !mapData) return;

        const basePortalId = portalNearby.id.substring(portalNearby.id.indexOf('_') + 1);
        const expectedTargetId = `f${targetFloor}_${basePortalId}`;
        let targetNodeId = null;

        if (mapData[expectedTargetId]) {
            targetNodeId = expectedTargetId;
        } else {
            const portalName = portalNearby.name.toLowerCase();
            for (const key in mapData) {
                if (mapData[key].floor === targetFloor && portalName.includes('лифт') && mapData[key].name.toLowerCase().includes('лифт')) {
                    targetNodeId = key;
                    break;
                }
            }
        }

        if (targetNodeId) {
            await checkInAtLocation(targetNodeId);
            setCurrentPos({ x: mapData[targetNodeId].x, y: mapData[targetNodeId].y });
            speak(`Вы на ${targetFloor} этаже.`);
            setViewFloor(targetFloor);

            if (finalDestId && finalDestId !== targetNodeId) {
                setTimeout(() => {
                    startNavigation(targetNodeId, finalDestId, useElevator);
                }, 1500);
            } else {
                setActiveRoute(null);
                setFinalDestId(null);
            }
        } else {
            speak(`Ошибка связи этажей.`);
        }
    }, [portalNearby, mapData, finalDestId, useElevator, checkInAtLocation, speak, setViewFloor, startNavigation]);

    const currentLeg = activeRoute ? activeRoute[currentStepIndex] : null;
    let distanceToTarget = 0;
    if (currentLeg && mapData && mapData[currentLeg.toNodeId]) {
        distanceToTarget = Math.hypot(currentPos.x - mapData[currentLeg.toNodeId].x, currentPos.y - mapData[currentLeg.toNodeId].y);
    }

    return {
        mapData, mapWalls, currentNodeId, currentPos, currentFloor, viewFloor, setViewFloor, effectiveHeading,
        activeRoute, currentStepIndex, currentLeg, distanceToTarget, isWrongDirection,
        portalNearby, availableFloors, handleFloorTransition,
        lastResponse, handleCommand, speak, checkInAtLocation, setActiveRoute, setFinalDestId,
        isSimMode, setIsSimMode, setSimHeading, handleStep
    };
};