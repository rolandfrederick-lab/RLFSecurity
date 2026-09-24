// Animated "Silk" background (after React Bits' Silk), drawn with plain WebGL.
// Usage: <canvas data-silk data-color="#7a6421" data-speed="5" data-scale="1"
//                data-noise="1.5" data-rotation="0"></canvas>
(function () {
  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform vec3 uColor;',
    'uniform float uSpeed;',
    'uniform float uScale;',
    'uniform float uRotation;',
    'uniform float uNoiseIntensity;',
    'const float e = 2.71828182845904523536;',
    'float noise(vec2 texCoord) {',
    '  float G = e;',
    '  vec2 r = (G * sin(G * texCoord));',
    '  return fract(r.x * r.y * (1.0 + texCoord.x));',
    '}',
    'vec2 rotateUvs(vec2 uv, float angle) {',
    '  float c = cos(angle);',
    '  float s = sin(angle);',
    '  return mat2(c, -s, s, c) * uv;',
    '}',
    'void main() {',
    '  float rnd = noise(gl_FragCoord.xy);',
    '  vec2 uv = rotateUvs(vUv * uScale, uRotation);',
    '  vec2 tex = uv * uScale;',
    '  float tOffset = uSpeed * uTime;',
    '  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);',
    '  float pattern = 0.6 + 0.4 * sin(5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) +',
    '                  sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));',
    '  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;',
    '  col.a = 1.0;',
    '  gl_FragColor = col;',
    '}'
  ].join('\n');

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16) / 255; });
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  function start(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    function u(name) { return gl.getUniformLocation(prog, name); }
    var d = canvas.dataset;
    var c = hexToRgb(d.color || '#7a6421');
    gl.uniform3f(u('uColor'), c[0], c[1], c[2]);
    gl.uniform1f(u('uSpeed'), parseFloat(d.speed || 5));
    gl.uniform1f(u('uScale'), parseFloat(d.scale || 1));
    gl.uniform1f(u('uNoiseIntensity'), parseFloat(d.noise || 1.5));
    gl.uniform1f(u('uRotation'), parseFloat(d.rotation || 0));
    var uTime = u('uTime');

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(canvas.clientWidth * dpr);
      var h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    var time = 0;
    var last = null;
    var visible = true;

    function draw() {
      resize();
      gl.uniform1f(uTime, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now) {
      if (last !== null) time += 0.1 * Math.min((now - last) / 1000, 0.1);
      last = now;
      draw();
      if (visible && !document.hidden) requestAnimationFrame(frame);
      else last = null;
    }

    // Respect visitors who turn off motion: draw one still frame.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw();
      window.addEventListener('resize', draw);
      canvas.classList.add('ready');
      return;
    }

    function resume() {
      if (visible && !document.hidden && last === null) requestAnimationFrame(frame);
    }

    // Pause when the section is off screen or the tab is hidden.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        resume();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', resume);

    canvas.classList.add('ready');
    requestAnimationFrame(frame);
  }

  var canvases = document.querySelectorAll('canvas[data-silk]');
  for (var i = 0; i < canvases.length; i++) start(canvases[i]);
})();
