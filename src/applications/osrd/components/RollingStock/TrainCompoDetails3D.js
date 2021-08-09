import React, { Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls, Environment } from '@react-three/drei';
import model3D from 'assets/3D/x72500.glb';

const Model = () => {
  const gltf = useLoader(GLTFLoader, model3D);
  return (
    <>
      <primitive object={gltf.scene} scale={10} />
    </>
  );
};

export default function TrainCompoDetails3D() {
  return (
    <div id="canvas-container">
      <Canvas>
        <Suspense fallback={null}>
          <Model />
          <OrbitControls />
          <Environment preset="dawn" />
        </Suspense>
      </Canvas>
    </div>
  );
}
