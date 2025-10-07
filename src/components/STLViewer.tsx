import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import JSZip from 'jszip';

interface ModelViewerProps {
  url: string;
  filename: string;
}

export default function ModelViewer({ url, filename }: ModelViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  // Detect file type
  const getFileType = (filename: string) => {
    const extension = filename.toLowerCase().split('.').pop();
    return extension;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = isExpanded ? 500 : 250;

    // 3MF Loader implementation
    const load3MF = async (url: string): Promise<THREE.BufferGeometry> => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      // 3MF files have a 3D/3dmodel.model file with the mesh data
      const modelFile = zipContent.file('3D/3dmodel.model');
      if (!modelFile) {
        throw new Error('Invalid 3MF file: missing 3dmodel.model');
      }
      
      const xmlText = await modelFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Parse mesh data from XML
      const vertices: number[] = [];
      const indices: number[] = [];
      
      // Get all vertices
      const vertexElements = xmlDoc.querySelectorAll('vertex');
      vertexElements.forEach((vertex) => {
        const x = parseFloat(vertex.getAttribute('x') || '0');
        const y = parseFloat(vertex.getAttribute('y') || '0');
        const z = parseFloat(vertex.getAttribute('z') || '0');
        vertices.push(x, y, z);
      });
      
      // Get all triangles
      const triangleElements = xmlDoc.querySelectorAll('triangle');
      triangleElements.forEach((triangle) => {
        const v1 = parseInt(triangle.getAttribute('v1') || '0');
        const v2 = parseInt(triangle.getAttribute('v2') || '0');
        const v3 = parseInt(triangle.getAttribute('v3') || '0');
        indices.push(v1, v2, v3);
      });
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      
      return geometry;
    };

    // Generic 3D model loader
    const loadModel = async (url: string, filename: string): Promise<THREE.BufferGeometry> => {
      const fileType = getFileType(filename);
      
      switch (fileType) {
        case 'stl':
          return loadSTL(url);
        case '3mf':
          return load3MF(url);
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }
    };

    // STL Loader implementation
    const loadSTL = async (url: string): Promise<THREE.BufferGeometry> => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch STL file');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const dataView = new DataView(arrayBuffer);
      
      // Check if it's binary STL (starts with solid but has binary structure)
      const isBinary = arrayBuffer.byteLength > 80 && dataView.getUint32(80, true) * 50 + 84 === arrayBuffer.byteLength;
      
      if (isBinary) {
        return parseBinarySTL(arrayBuffer);
      } else {
        return parseAsciiSTL(new TextDecoder().decode(arrayBuffer));
      }
    };

    const parseBinarySTL = (arrayBuffer: ArrayBuffer): THREE.BufferGeometry => {
      const dataView = new DataView(arrayBuffer);
      const faces = dataView.getUint32(80, true);
      
      const vertices: number[] = [];
      const normals: number[] = [];
      
      let offset = 84;
      for (let i = 0; i < faces; i++) {
        // Normal vector
        const nx = dataView.getFloat32(offset, true);
        const ny = dataView.getFloat32(offset + 4, true);
        const nz = dataView.getFloat32(offset + 8, true);
        offset += 12;
        
        // Three vertices
        for (let j = 0; j < 3; j++) {
          const x = dataView.getFloat32(offset, true);
          const y = dataView.getFloat32(offset + 4, true);
          const z = dataView.getFloat32(offset + 8, true);
          
          vertices.push(x, y, z);
          normals.push(nx, ny, nz);
          offset += 12;
        }
        
        offset += 2; // Skip attribute byte count
      }
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      
      return geometry;
    };

    const parseAsciiSTL = (text: string): THREE.BufferGeometry => {
      const vertices: number[] = [];
      const normals: number[] = [];
      
      const lines = text.split('\n');
      let currentNormal = [0, 0, 0];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('facet normal')) {
          const parts = line.split(/\s+/);
          currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
        } else if (line.startsWith('vertex')) {
          const parts = line.split(/\s+/);
          vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
          normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
        }
      }
      
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      
      return geometry;
    };

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
    scene.add(gridHelper);

    container.appendChild(renderer.domElement);

    // Load model
    loadModel(url, filename)
      .then((geometry) => {
        // Center and scale the geometry
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;

        geometry.translate(-center.x, -center.y, -center.z);
        geometry.scale(scale, scale, scale);

        // Create material and mesh
        const material = new THREE.MeshPhongMaterial({ 
          color: 0x8b5cf6,
          shininess: 30
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        meshRef.current = mesh;

        handleLoad();
      })
      .catch((error) => {
        console.error('Error loading 3D model:', error);
        handleError();
      });

    // Mouse controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const rotationSpeed = 0.005;

    const onMouseDown = (event: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging || !meshRef.current) return;

      const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
      };

      meshRef.current.rotation.y += deltaMove.x * rotationSpeed;
      meshRef.current.rotation.x += deltaMove.y * rotationSpeed;

      previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      if (!camera) return;

      const zoomSpeed = 0.1;
      const factor = 1 + (event.deltaY > 0 ? zoomSpeed : -zoomSpeed);
      
      camera.position.multiplyScalar(factor);
      camera.position.clampLength(1, 50);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, [url, filename, isExpanded]);

  // Handle resize when expanded/collapsed
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = isExpanded ? 500 : 250;
    
    rendererRef.current.setSize(width, height);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }, [isExpanded]);

  if (error) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="font-medium">{filename}</span>
          <span className="text-sm text-muted-foreground">(STL Model)</span>
        </div>
        <div className="text-sm text-red-500 mb-2">Failed to load 3D model</div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Download STL file
        </a>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="font-medium text-sm">{filename}</span>
          <span className="text-xs text-muted-foreground">(3D Model)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              )}
            </svg>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </a>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="relative"
        style={{ height: isExpanded ? '500px' : '250px' }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Loading 3D model...</span>
            </div>
          </div>
        )}
      </div>
      
      {!loading && !error && (
        <div className="p-2 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground">
            💡 Click and drag to rotate • Scroll to zoom
          </div>
        </div>
      )}
    </div>
  );
}