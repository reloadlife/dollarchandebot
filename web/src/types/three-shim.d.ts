/** three@0.186 publishes a JS build with no declarations. The hero only uses this surface. */
declare module "three" {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    setScalar(value: number): this;
  }
  export class Euler {
    x: number;
    y: number;
    z: number;
  }
  export class Object3D {
    rotation: Euler;
    position: Vector3;
    scale: Vector3;
    add(...objects: Object3D[]): this;
  }
  export class Group extends Object3D {}
  export class Scene extends Object3D {
    environment: Texture | null;
  }
  export class Camera extends Object3D {}
  export class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    fov: number;
    aspect: number;
    lookAt(x: number, y: number, z: number): void;
    updateProjectionMatrix(): void;
  }
  export class BufferGeometry {
    dispose(): void;
  }
  export class TorusGeometry extends BufferGeometry {
    constructor(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number);
  }
  export class OctahedronGeometry extends BufferGeometry {
    constructor(radius?: number, detail?: number);
  }
  export class Material {
    dispose(): void;
  }
  export class MeshPhysicalMaterial extends Material {
    constructor(parameters?: object);
  }
  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
    geometry: BufferGeometry;
  }
  export class HemisphereLight extends Object3D {
    constructor(skyColor?: number, groundColor?: number, intensity?: number);
  }
  export class DirectionalLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }
  export class PointLight extends Object3D {
    constructor(color?: number, intensity?: number, distance?: number);
  }
  export class Texture {
    dispose(): void;
  }
  export class WebGLRenderer {
    constructor(parameters?: { canvas?: HTMLCanvasElement; alpha?: boolean; antialias?: boolean });
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;
    setClearColor(color: number, alpha?: number): void;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
  }
  export class PMREMGenerator {
    constructor(renderer: WebGLRenderer);
    fromScene(scene: Scene, sigma?: number): { texture: Texture };
    dispose(): void;
  }
  export const SRGBColorSpace: string;
  export const ACESFilmicToneMapping: number;
}

declare module "three/addons/environments/RoomEnvironment.js" {
  import { Scene } from "three";
  export class RoomEnvironment extends Scene {}
}
