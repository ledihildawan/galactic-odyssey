// Vertex Shader
attribute vec2 a_pos;
attribute vec2 a_vel;
attribute float a_life;
attribute float a_size;
attribute vec3 a_color;
varying float v_life;
varying vec3 v_color;
uniform vec2 u_res;
void main(){
  vec2 clipSpace=(a_pos/u_res)*2.0-1.0;
  gl_Position=vec4(clipSpace.x,-clipSpace.y,0,1);
  float speed=length(a_vel);
  gl_PointSize=a_size*a_life*(1.0+speed*0.05);
  v_life=a_life;
  v_color=a_color;
}
// --- VERTEX END ---

// Fragment Shader
precision mediump float;
varying float v_life;
varying vec3 v_color;
uniform float u_isLight;
void main(){
  float d=distance(gl_PointCoord,vec2(0.5));
  if(d>0.5) discard;
  float intensity=(u_isLight>0.5)?1.8:2.5;
  float glow=pow(1.0-(d*2.0),intensity);
  gl_FragColor=vec4(v_color,glow*v_life);
}
// --- FRAGMENT END ---
