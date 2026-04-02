import { useState, useEffect, useRef } from 'react';
import { Magnetometer, Accelerometer, Gyroscope } from 'expo-sensors';

const ALPHA = 0.95;
const UPDATE_INTERVAL_MS = 50;

const snapHeading = (heading: number, snapResolution = 45, tolerance = 15) => {
    const nearestAxis = Math.round(heading / snapResolution) * snapResolution;

    let diff = Math.abs(heading - nearestAxis);
    if (diff > 180) diff = 360 - diff;

    if (diff <= tolerance) {
        return nearestAxis % 360;
    }

    return heading;
};

export const useOrientation = () => {
    const [orientation, setOrientation] = useState({ heading: 0, pitch: 0, roll: 0 });

    const gravity = useRef({ x: 0, y: 0, z: 1 });
    const lastHeading = useRef<number | null>(null);
    const lastUpdate = useRef<number>(Date.now());
    const magHeading = useRef<number>(0);

    useEffect(() => {
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
        Magnetometer.setUpdateInterval(UPDATE_INTERVAL_MS);
        Gyroscope.setUpdateInterval(UPDATE_INTERVAL_MS);

        const accelSub = Accelerometer.addListener(({ x, y, z }) => {
            gravity.current = { x, y, z };
        });

        const magSub = Magnetometer.addListener((magData) => {
            const { x: ax, y: ay, z: az } = gravity.current;
            const { x: mx, y: my, z: mz } = magData;

            const roll = Math.atan2(ax, Math.sqrt(ay * ay + az * az));
            const pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az));

            const Xh = mx * Math.cos(pitch) + my * Math.sin(roll) * Math.sin(pitch) + mz * Math.cos(roll) * Math.sin(pitch);
            const Yh = my * Math.cos(roll) - mz * Math.sin(roll);

            let mathAngle = Math.atan2(Yh, Xh) * (180 / Math.PI);
            magHeading.current = (90 - mathAngle + 360) % 360;
        });

        const gyroSub = Gyroscope.addListener(({ x: gx, y: gy, z: gz }) => {
            const now = Date.now();
            const dt = (now - lastUpdate.current) / 1000;
            lastUpdate.current = now;

            const { x: ax, y: ay, z: az } = gravity.current;
            const norm = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
            const gX = ax / norm;
            const gY = ay / norm;
            const gZ = az / norm;

            const omegaVertical = (gx * gX + gy * gY + gz * gZ);

            const gyroDelta = omegaVertical * (180 / Math.PI) * dt;

            if (lastHeading.current === null) {
                lastHeading.current = magHeading.current;
            }

            let newHeading = lastHeading.current - gyroDelta;
            newHeading = (newHeading + 360) % 360;

            let diff = magHeading.current - newHeading;
            if (diff < -180) diff += 360;
            if (diff > 180) diff -= 360;

            let filteredHeading = newHeading + (1 - ALPHA) * diff;
            filteredHeading = (filteredHeading + 360) % 360;

            lastHeading.current = filteredHeading;

            const snappedHeading = snapHeading(filteredHeading, 45, 12);

            setOrientation(prev => {
                const newPitch = Math.round(Math.asin(gY) * (180 / Math.PI));
                const newRoll = Math.round(Math.asin(gX) * (180 / Math.PI));

                if (Math.abs(prev.heading - snappedHeading) > 0 ||
                    Math.abs(prev.pitch - newPitch) > 2) {
                    return {
                        heading: Math.round(snappedHeading),
                        pitch: newPitch,
                        roll: newRoll
                    };
                }
                return prev;
            });
        });

        return () => {
            accelSub.remove();
            magSub.remove();
            gyroSub.remove();
        };
    }, []);

    return orientation;
};