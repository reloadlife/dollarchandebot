/** Amber pool behind the price board. Straight alpha, premultiplied in the shader. */
export const amberField = `
struct Params { time: f32 }
@group(0) @binding(0) var<uniform> params: Params;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = (uv - vec2f(0.5, 0.52)) * vec2f(1.05, 1.45);
  let ring = abs(length(p) - 0.46);
  let band = smoothstep(0.2, 0.02, ring);
  let t = params.time;
  let sweep = sin(atan2(p.y, p.x) * 2.0 + t * 0.28);
  let glow = smoothstep(0.9, 0.05, length(p));
  let spark = smoothstep(0.15, 0.9, sweep) * band;
  let alpha = clamp(band * 0.2 + spark * 0.3 + glow * 0.1, 0.0, 0.48);
  let col = mix(vec3f(0.55, 0.2, 0.04), vec3f(1.0, 0.72, 0.28), spark);
  return vec4f(col * alpha, alpha);
}
`;
