import { useState, useEffect, useRef } from 'react';
import { Magnetometer, Accelerometer } from 'expo-sensors';

export const useCompass = () => {
    const [orientation, setOrientation] = useState({ heading: 0, pitch: 0, roll: 0 });

    const gravity = useRef({ x: 0, y: 0, z: 1 });

    useEffect(() => {
        Magnetometer.setUpdateInterval(200);
        Accelerometer.setUpdateInterval(200);

        const accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
            gravity.current = { x, y, z };
        });

        const magSubscription = Magnetometer.addListener((magData) => {
            const { x: ax, y: ay, z: az } = gravity.current;
            const { x: mx, y: my, z: mz } = magData;

            const roll = Math.atan2(ax, Math.sqrt(ay * ay + az * az));
            const pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az));

            const cosRoll = Math.cos(roll);
            const sinRoll = Math.sin(roll);
            const cosPitch = Math.cos(pitch);
            const sinPitch = Math.sin(pitch);

            const Xh = mx * cosPitch + my * sinRoll * sinPitch + mz * cosRoll * sinPitch;
            const Yh = my * cosRoll - mz * sinRoll;

            let mathAngle = Math.atan2(Yh, Xh) * (180 / Math.PI);
            let compassHeading = Math.round((90 - mathAngle + 360) % 360);

            const rollDeg = Math.round(roll * (180 / Math.PI));
            const pitchDeg = Math.round(pitch * (180 / Math.PI));

            setOrientation({
                heading: compassHeading,
                pitch: pitchDeg,
                roll: rollDeg
            });
        });

        return () => {
            accelSubscription.remove();
            magSubscription.remove();
        };
    }, []);

    return orientation;
};