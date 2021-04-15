import React, { useContext, useEffect, useRef } from 'react';
import { MapContext } from 'react-map-gl';
import * as THREE from 'three';

const ThreeboxTest = () => {
  const { map, viewport } = useContext(MapContext);
  const ref = useRef();
  // const {longitude, latitude} = props;
  const latitude = 48.5853;
  const longitude = 7.7327;
  const [x, y] = viewport.project([longitude, latitude]);
  const markerStyle = {
    position: 'absolute',
    background: 'transparent',
    left: x,
    top: y,
  };

  useEffect(() => {
    // === THREE.JS CODE START ===
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // document.body.appendChild( renderer.domElement );
    ref.current.appendChild(renderer.domElement);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    camera.position.z = 5;
    renderer.render(scene, camera);
    // === THREE.JS EXAMPLE CODE END ===
  }, []);

  return (
    <div style={markerStyle} ref={ref}>
      ({latitude}, {longitude})
    </div>
  );
};

export default ThreeboxTest;
