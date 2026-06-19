import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useI18n } from '../lib/i18n';

interface CatalogModelViewerProps {
  modelUrl: string;
  label: string;
}

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
};

const isoCameraPosition = new THREE.Vector3(-2.8, 3.2, 2.4);
const viewTarget = new THREE.Vector3(0, 0, 0);

export function CatalogModelViewer({ modelUrl, label }: CatalogModelViewerProps) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    setStatus('loading');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafb);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.copy(isoCameraPosition);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 3.2;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.7;
    controls.noPan = true;
    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.12;
    controls.minDistance = 1.2;
    controls.maxDistance = 9;

    const resetView = () => {
      controls.target.copy(viewTarget);
      camera.position.copy(isoCameraPosition);
      camera.up.set(0, 0, 1);
      camera.lookAt(viewTarget);
      controls.update();
    };
    resetViewRef.current = resetView;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b2, 2.8));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xd7e7ff, 1.6);
    rimLight.position.set(-4, -2, 3);
    scene.add(rimLight);

    let frameId = 0;
    let activeModel: THREE.Object3D | null = null;
    let disposed = false;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(Math.floor(rect.width), 1);
      const height = Math.max(Math.floor(rect.height), 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }

        activeModel = gltf.scene;
        const material = new THREE.MeshStandardMaterial({
          color: 0x8f9aa4,
          metalness: 0.35,
          roughness: 0.42
        });
        activeModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = material;
          }
        });

        const box = new THREE.Box3().setFromObject(activeModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z, 1);
        const scale = 2.3 / maxSize;

        activeModel.scale.setScalar(scale);
        activeModel.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        scene.add(activeModel);

        resetView();
        setStatus('ready');
      },
      undefined,
      () => {
        if (!disposed) setStatus('error');
      }
    );

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resetViewRef.current = null;
      observer.disconnect();
      controls.dispose();
      if (activeModel) {
        scene.remove(activeModel);
        disposeObject(activeModel);
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelUrl]);

  return (
    <div className="catalog-model-viewer" aria-label={label}>
      <div ref={hostRef} className="catalog-model-canvas" />
      {status === 'ready' && (
        <button
          type="button"
          className="catalog-model-reset"
          aria-label={t('reset3d')}
          title={t('reset3d')}
          onClick={() => resetViewRef.current?.()}
        >
          <RotateCcw size={14} />
        </button>
      )}
      {status !== 'ready' && (
        <div className="catalog-model-status">
          <span>{status === 'error' ? '3D model unavailable' : 'Loading 3D model'}</span>
        </div>
      )}
    </div>
  );
}
