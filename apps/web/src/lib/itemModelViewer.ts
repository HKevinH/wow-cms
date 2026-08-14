/** A turntable for one item model.
 *
 *  Draws the GLB the model pipeline produced, straight from its bytes: the
 *  file is parsed here rather than handed to a glTF library, because what the
 *  pipeline writes is one mesh with one texture and reading that back is a
 *  hundred lines. Swapping in a full loader later is a change to this file
 *  alone — callers only ever hand it a canvas and a URL. */

const GLTF_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3 };
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

export interface Gltf {
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  accessors: { bufferView: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
  images: { bufferView: number }[];
}

export function parseGlb(bytes: Uint8Array): { gltf: Gltf; bin: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLTF_MAGIC) throw new Error('not a GLB');

  let cursor = 12;
  let gltf: Gltf | undefined;
  let bin: Uint8Array | undefined;
  while (cursor < view.byteLength) {
    const length = view.getUint32(cursor, true);
    const kind = view.getUint32(cursor + 4, true);
    const body = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (kind === CHUNK_JSON) gltf = JSON.parse(new TextDecoder().decode(body)) as Gltf;
    if (kind === CHUNK_BIN) bin = body;
    cursor += 8 + length;
  }
  if (!gltf || !bin) throw new Error('the GLB is missing a chunk');
  return { gltf, bin };
}

export function readAccessor(gltf: Gltf, bin: Uint8Array, index: number): Float32Array | Uint32Array {
  const accessor = gltf.accessors[index]!;
  const view = gltf.bufferViews[accessor.bufferView]!;
  const start = bin.byteOffset + (view.byteOffset ?? 0);
  const count = accessor.count * (COMPONENTS[accessor.type] ?? 1);
  if (accessor.componentType === FLOAT) return new Float32Array(bin.buffer, start, count);
  if (accessor.componentType === UNSIGNED_INT) return new Uint32Array(bin.buffer, start, count);
  throw new Error(`unsupported component type ${accessor.componentType}`);
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uProjection;
uniform mat4 uView;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vNormal = aNormal;
  vUv = aUv;
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uTexture;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(uTexture, vUv);
  if (texel.a < 0.35) discard;
  vec3 key = normalize(vec3(0.45, 0.75, 0.6));
  vec3 fill = normalize(vec3(-0.6, 0.15, 0.4));
  vec3 n = normalize(vNormal);
  float light = 0.34 + 0.62 * abs(dot(n, key)) + 0.18 * max(dot(n, fill), 0.0);
  gl_FragColor = vec4(texel.rgb * light, 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed to compile');
  }
  return shader;
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ]);
}

/** Scales the model to a unit size, spins it, then pushes it away from the
 *  camera — cheaper than moving a camera and enough for a turntable. */
function orbit(yaw: number, pitch: number, distance: number, centre: number[], scale: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const r = [
    cy * scale, sy * sp * scale, -sy * cp * scale,
    0, cp * scale, sp * scale,
    sy * scale, -cy * sp * scale, cy * cp * scale,
  ];
  return new Float32Array([
    r[0]!, r[1]!, r[2]!, 0,
    r[3]!, r[4]!, r[5]!, 0,
    r[6]!, r[7]!, r[8]!, 0,
    -(r[0]! * centre[0]! + r[3]! * centre[1]! + r[6]! * centre[2]!),
    -(r[1]! * centre[0]! + r[4]! * centre[1]! + r[7]! * centre[2]!),
    -(r[2]! * centre[0]! + r[5]! * centre[1]! + r[8]! * centre[2]!) - distance,
    1,
  ]);
}

export interface ViewerHandle {
  /** Releases the GL context, which browsers allow only a dozen or so of. */
  dispose(): void;
}

export async function mountItemModel(canvas: HTMLCanvasElement, url: string): Promise<ViewerHandle> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the model answered ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { gltf, bin } = parseGlb(bytes);

  const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
  if (!gl) throw new Error('this browser has no WebGL');

  const primitive = gltf.meshes[0]!.primitives[0]!;
  const positions = readAccessor(gltf, bin, primitive.attributes.POSITION!) as Float32Array;
  const normals = readAccessor(gltf, bin, primitive.attributes.NORMAL!) as Float32Array;
  const uvs = readAccessor(gltf, bin, primitive.attributes.TEXCOORD_0!) as Float32Array;
  const indices = readAccessor(gltf, bin, primitive.indices) as Uint32Array;

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffers: WebGLBuffer[] = [];
  const attribute = (name: string, data: Float32Array, size: number): void => {
    const buffer = gl.createBuffer()!;
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  attribute('aPosition', positions, 3);
  attribute('aNormal', normals, 3);
  attribute('aUv', uvs, 2);

  // WebGL 1 needs an extension for 32 bit indices; without it the mesh is
  // narrowed, which is safe for item art but not for anything large.
  const wide = 'drawBuffers' in gl || gl.getExtension('OES_element_index_uint') !== null;
  const indexData: Uint16Array | Uint32Array = wide ? indices : Uint16Array.from(indices);
  const indexBuffer = gl.createBuffer()!;
  buffers.push(indexBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);
  const indexType = wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

  // The texture rides inside the GLB, so it reaches the GPU without a second
  // request and without a URL for a content policy to object to.
  const imageView = gltf.bufferViews[gltf.images[0]!.bufferView]!;
  const offset = imageView.byteOffset ?? 0;
  // Copied out rather than passed as a view: a Blob wants a buffer it owns,
  // and the texture is small enough that the copy costs nothing worth saving.
  const png = new Uint8Array(bin.subarray(offset, offset + imageView.byteLength));
  const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  const uProjection = gl.getUniformLocation(program, 'uProjection');
  const uView = gl.getUniformLocation(program, 'uView');

  const accessor = gltf.accessors[primitive.attributes.POSITION!]!;
  const min = accessor.min ?? [0, 0, 0];
  const max = accessor.max ?? [0, 0, 0];
  const centre = min.map((low, axis) => (low + max[axis]!) / 2);
  const extent = Math.max(...max.map((high, axis) => high - min[axis]!)) || 1;
  const scale = 1 / extent;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let yaw = 0.6;
  let pitch = 0.25;
  let distance = 2.4;
  let spinning = !still.matches;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let frame = 0;

  const onPointerDown = (event: PointerEvent): void => {
    dragging = true;
    spinning = false;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return;
    yaw += (event.clientX - lastX) * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, pitch + (event.clientY - lastY) * 0.01));
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onPointerUp = (event: PointerEvent): void => {
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  };
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    distance = Math.max(1.3, Math.min(6, distance + event.deltaY * 0.002));
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') yaw -= 0.15;
    else if (event.key === 'ArrowRight') yaw += 0.15;
    else return;
    spinning = false;
    event.preventDefault();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);

  const draw = (): void => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (spinning) yaw += 0.006;
    gl.uniformMatrix4fv(uProjection, false, perspective(0.9, canvas.width / canvas.height || 1, 0.05, 60));
    gl.uniformMatrix4fv(uView, false, orbit(yaw, pitch, distance, centre, scale));
    gl.drawElements(gl.TRIANGLES, indexData.length, indexType, 0);
    frame = requestAnimationFrame(draw);
  };
  draw();

  return {
    dispose() {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKeyDown);
      buffers.forEach((buffer) => gl.deleteBuffer(buffer));
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
