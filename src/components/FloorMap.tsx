import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Line, Circle, Polyline, G, Text as SvgText } from 'react-native-svg';

import { NavNode, Wall } from '@/utils/mapEngine';
import { RouteStep } from '@/utils/pathfinder';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface FloorMapProps {
    mapData: Record<string, NavNode> | null;
    mapWalls: Record<number, Wall[]> | null;
    activeRoute: RouteStep[] | null;
    currentNodeId: string | null;
    userPos: { x: number; y: number };
    userHeading: number;
    viewFloor: number;
    onNodePress: (nodeId: string) => void;
}

export default function FloorMap({ mapData, mapWalls, activeRoute, currentNodeId, userPos, userHeading, viewFloor, onNodePress }: FloorMapProps) {

    const [zoom, setZoom] = useState(1);
    const scrollYRef = useRef<ScrollView>(null);
    const scrollXRef = useRef<ScrollView>(null);
    const prevFloorRef = useRef<number | null>(null);

    const bounds = useMemo(() => {
        if (!mapData) return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const id in mapData) {
            const node = mapData[id];
            minX = Math.min(minX, node.x); minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x); maxY = Math.max(maxY, node.y);
        }
        const padding = 5;
        if (minX === Infinity) return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
        return {
            minX: minX - padding, minY: minY - padding,
            maxX: maxX + padding, maxY: maxY + padding,
            width: maxX - minX + padding*2, height: maxY - minY + padding*2
        };
    }, [mapData]);

    const currentScale = 25 * zoom;
    const mapWidth = bounds.width * currentScale;
    const mapHeight = bounds.height * currentScale;

    const currentFloor = currentNodeId && mapData && mapData[currentNodeId] ? mapData[currentNodeId].floor : 1;

    const userPx = useMemo(() => ({
        x: (userPos.x - bounds.minX) * currentScale,
        y: mapHeight - (userPos.y - bounds.minY) * currentScale
    }), [userPos.x, userPos.y, bounds.minX, bounds.minY, currentScale, mapHeight]);

    const centerOnUser = useCallback(() => {
        scrollYRef.current?.scrollTo({ y: userPx.y - 175, animated: true });
        scrollXRef.current?.scrollTo({ x: userPx.x - SCREEN_WIDTH / 2, animated: true });
    }, [userPx.x, userPx.y]);

    useEffect(() => {
        if (prevFloorRef.current !== currentFloor) {
            const timer = setTimeout(centerOnUser, 300);
            prevFloorRef.current = currentFloor;
            return () => clearTimeout(timer);
        }
    }, [currentFloor, centerOnUser]);

    if (!mapData) return null;

    const toPx = (mx: number, my: number) => ({
        x: (mx - bounds.minX) * currentScale,
        y: mapHeight - (my - bounds.minY) * currentScale
    });

    let routePoints = "";
    if (activeRoute && activeRoute.length > 0) {
        const startNode = (currentNodeId && mapData[currentNodeId]) ? mapData[currentNodeId] : userPos;
        const startPx = toPx(startNode.x, startNode.y);
        routePoints = `${startPx.x},${startPx.y}`;
        activeRoute.forEach(step => {
            const n = mapData[step.toNodeId];
            if (n) {
                const p = toPx(n.x, n.y);
                routePoints += ` ${p.x},${p.y}`;
            }
        });
    }

    return (
        <View style={{ height: 350, backgroundColor: '#e0e0e0' }}>
            <View style={{ position: 'absolute', right: 10, top: 10, zIndex: 10 }}>
                <TouchableOpacity onPress={() => setZoom(z => z * 1.3)} style={styles.zoomBtn}><Text style={styles.zoomText}>+</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setZoom(z => z / 1.3)} style={styles.zoomBtn}><Text style={styles.zoomText}>−</Text></TouchableOpacity>
                <TouchableOpacity onPress={centerOnUser} style={[styles.zoomBtn, { marginTop: 15 }]}><Text style={{ fontSize: 18 }}>🎯</Text></TouchableOpacity>
            </View>

            <ScrollView ref={scrollYRef} style={{ flex: 1 }}>
                <ScrollView ref={scrollXRef} horizontal style={{ flex: 1 }}>
                    <Svg width={mapWidth} height={mapHeight}>

                        {/* 1. СТЕНЫ ЗДАНИЯ */}
                        {mapWalls && mapWalls[viewFloor]?.map((wall, index) => {
                            const p1 = toPx(wall.x1, wall.y1);
                            const p2 = toPx(wall.x2, wall.y2);
                            return <Line key={`wall-${index}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#424242" strokeWidth="4" strokeLinecap="round" />;
                        })}

                        {/* 2. АКТИВНЫЙ МАРШРУТ */}
                        {routePoints !== "" && (
                            <Polyline points={routePoints} fill="none" stroke="#FF9800" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
                        )}

                        {/* 3. ТОЧКИ (Кликабельные) */}
                        {Object.values(mapData).map(node => {
                            if (node.floor !== viewFloor) return null;
                            const p = toPx(node.x, node.y);
                            const isTarget = activeRoute?.some(s => s.toNodeId === node.id);
                            return (
                                <G key={node.id} onPress={() => onNodePress(node.id)}>
                                    <Circle cx={p.x} cy={p.y} r="25" fill="transparent" />
                                    <Circle cx={p.x} cy={p.y} r={isTarget ? 8 : 5}
                                            fill={node.type === 'room' ? '#E91E63' : '#2196F3'}
                                            stroke={node.id === currentNodeId ? '#00FF00' : '#fff'} strokeWidth="2" />
                                    {node.type === 'room' && (
                                        <SvgText x={p.x + 10} y={p.y - 10} fontSize="14" fill="#111" fontWeight="bold">
                                            {node.name.replace('Аудитория ', '')}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        })}

                        {/* 4. СИНИЙ ЧЕЛОВЕЧЕК */}
                        {currentFloor === viewFloor && (
                            <G x={userPx.x} y={userPx.y} rotation={userHeading}>
                                <Circle cx="0" cy="0" r="12" fill="#2979FF" stroke="#fff" strokeWidth="3" />
                                <Polyline points="-6,3 0,-10 6,3" fill="white" />
                            </G>
                        )}
                    </Svg>
                </ScrollView>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    zoomBtn: { backgroundColor: '#fff', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
    zoomText: { fontSize: 24, fontWeight: 'bold', color: '#333', lineHeight: 28 }
});