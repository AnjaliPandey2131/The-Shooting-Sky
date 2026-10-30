/* -------------------------------------------------------------
   Background Layers Scaffolding
   Provides reusable, independent parallax layer classes.
   Each layer implements `update(dt)` and `draw(ctx, cameraOffset, regionName)`.
   Region colour palettes are read from CSS custom properties.
   ------------------------------------------------------------- */

// Helper to fetch CSS variable values
function getCssVar(name, fallback) {
  const root = getComputedStyle(document.documentElement);
  return root.getPropertyValue(name).trim() || fallback;
}

// Base class for a generic layer
export class BackgroundLayer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  // Override in subclasses
  update(dt) {}
  // cameraOffset is a simple numeric x offset for horizontal scrolling
  draw(ctx, cameraOffset = 0, regionName = 'earth') {}
}

// ------------------- Layer A: Distant Starfield -------------------
export class StarfieldLayer extends BackgroundLayer {
  constructor(width, height) {
    super(width, height);
    this.stars = this._generateStars(200, 0.2, 1.2, 0.2, 0.6);
    this.parallax = 0.2; // slower than camera motion
  }
  _generateStars(count, minR, maxR, minSpeed, maxSpeed) {
    return Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: minR + Math.random() * (maxR - minR),
      speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
      alpha: 0.12 + Math.random() * 0.3,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }
  update(dt) {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > this.height) s.y -= this.height;
    }
  }
  draw(ctx, cameraOffset = 0) {
    ctx.save();
    ctx.translate(-cameraOffset * this.parallax, 0);
    ctx.fillStyle = '#d9e8ff';
    for (const s of this.stars) {
      const tw = 0.85 + Math.sin(s.twinkle + performance.now() * 0.001) * 0.15;
      ctx.globalAlpha = s.alpha * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ------------------- Layer B: Nebula / Clouds -------------------
export class NebulaLayer extends BackgroundLayer {
  constructor(width, height) {
    super(width, height);
    this.clouds = [
      { x: width * 0.22, y: height * 0.34, radius: 270, color: '57, 48, 145', alpha: 0.11, driftX: 1, driftY: 1 },
      { x: width * 0.73, y: height * 0.56, radius: 320, color: '25, 92, 139', alpha: 0.08, driftX: -0.55, driftY: -1 },
      { x: width * 0.48, y: height * 0.12, radius: 210, color: '120, 47, 111', alpha: 0.045, driftX: 0.35, driftY: -0.5 },
    ];
    this.time = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.parallax = 0.4;
  }
  update(dt) {
    this.time += dt;
  }
  draw(ctx, cameraOffset = 0) {
    const driftX = Math.sin(this.time * 0.035 + this.phase) * 35;
    const driftY = Math.cos(this.time * 0.028 + this.phase) * 18;
    ctx.save();
    ctx.translate(-cameraOffset * this.parallax, 0);
    for (const cloud of this.clouds) {
      const x = cloud.x + driftX * cloud.driftX;
      const y = cloud.y + driftY * cloud.driftY;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, cloud.radius);
      grad.addColorStop(0, `rgba(${cloud.color}, ${cloud.alpha})`);
      grad.addColorStop(1, `rgba(${cloud.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - cloud.radius, y - cloud.radius, cloud.radius * 2, cloud.radius * 2);
    }
    ctx.restore();
  }
}

// ------------------- Layer C: Planetary Scenery -------------------
export class PlanetLayer extends BackgroundLayer {
  constructor(width, height) {
    super(width, height);
    this.planetX = width * (0.73 + Math.random() * 0.12);
    this.planetY = height * (0.18 + Math.random() * 0.12);
    this.phase = Math.random() * Math.PI * 2;
    this.parallax = 0.6;
    this.planet = this._createPlanet(150, '#315f9d', '#77a9d8');
    this.moon = this._createPlanet(74, '#765ba3', '#ae92d4');
  }
  _createPlanet(size, baseColor, lightColor) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const radius = size * 0.39;
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, radius * 0.65, center, center, size * 0.49);
    glow.addColorStop(0, `${lightColor}00`);
    glow.addColorStop(0.78, `${lightColor}18`);
    glow.addColorStop(1, `${lightColor}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    const atmosphere = ctx.createRadialGradient(
      center - radius * 0.2, center - radius * 0.25, radius * 0.1,
      center, center, radius * 1.12
    );
    atmosphere.addColorStop(0, `${lightColor}72`);
    atmosphere.addColorStop(0.82, `${lightColor}38`);
    atmosphere.addColorStop(1, `${lightColor}00`);
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(center, center, radius * 1.12, 0, Math.PI * 2);
    ctx.fill();
    const surface = ctx.createRadialGradient(
      center - radius * 0.38, center - radius * 0.42, radius * 0.04,
      center + radius * 0.12, center + radius * 0.18, radius * 1.2
    );
    surface.addColorStop(0, lightColor);
    surface.addColorStop(0.5, baseColor);
    surface.addColorStop(1, '#080b19');
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = lightColor;
    for (let i = 0; i < 5; i++) {
      const bandY = center - radius + i * radius * 0.43;
      ctx.fillRect(center - radius, bandY, radius * 2, radius * 0.12);
    }
    ctx.restore();
    return canvas;
  }
  update(dt) {
    this.time = (this.time || 0) + dt;
  }
  draw(ctx, cameraOffset = 0, regionName = 'earth') {
    const drift = Math.sin(this.time * 0.012 + this.phase) * 11;
    ctx.save();
    ctx.translate(-cameraOffset * this.parallax, 0);
    // Determine planet visual based on region
    const cfg = this._regionConfig(regionName);
    // Cache per‑region planet canvas
    if (!this._regionPlanet) this._regionPlanet = {};
    if (!this._regionPlanet[regionName]) {
      this._regionPlanet[regionName] = this._createPlanet(cfg.size, cfg.baseColor, cfg.lightColor);
    }
    const planetCanvas = this._regionPlanet[regionName];
    ctx.globalAlpha = 0.56;
    ctx.drawImage(planetCanvas, this.planetX + drift - 75, this.planetY - 75);
    // Moon remains generic; could also be region‑specific
    ctx.globalAlpha = 0.22;
    ctx.drawImage(this.moon, this.width * 0.13 - 37, this.height * 0.49 + drift * 0.35 - 37);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Planet visual configuration per region
  _regionConfig(name) {
    const map = {
      earth:   { size: 150, baseColor: '#315f9d', lightColor: '#77a9d8' },
      mars:    { size: 130, baseColor: '#b04c2a', lightColor: '#ffa45b' },
      jupiter:{ size: 180, baseColor: '#8b5e3c', lightColor: '#d9c08b' },
      nebula: { size: 140, baseColor: '#5a2e8e', lightColor: '#9d5bff' },
      blackhole:{ size: 200, baseColor: '#222222', lightColor: '#444444' }
    };
    return map[name] || map['earth'];
  }
}

// ------------------- Layer D: Intermediate Debris -------------------
export class DebrisLayer extends BackgroundLayer {
  constructor(width, height) {
    super(width, height);
    this.particles = this._generateStars(40, 0.5, 1.5, 30, 70);
    this.parallax = 0.8;
  }
  _generateStars(count, minR, maxR, minSpeed, maxSpeed) {
    return Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: minR + Math.random() * (maxR - minR),
      speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
      alpha: 0.2 + Math.random() * 0.4,
    }));
  }
  update(dt) {
    for (const p of this.particles) {
      p.x -= p.speed * dt;
      if (p.x < -10) p.x = this.width + 10;
    }
  }
  draw(ctx, cameraOffset = 0) {
    ctx.save();
    ctx.translate(-cameraOffset * this.parallax, 0);
    ctx.fillStyle = '#a8dfff';
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ------------------- Layer E: Near‑Camera Particles -------------------
export class NearParticleLayer extends BackgroundLayer {
  constructor(width, height) {
    super(width, height);
    this.streaks = [];
    this.timer = 4 + Math.random() * 4;
    this.parallax = 1.0; // moves with camera (no offset)
  }
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.streaks.push({
        x: Math.random() * this.width * 0.72,
        y: Math.random() * this.height * 0.55,
        speed: 90 + Math.random() * 35,
        length: 18 + Math.random() * 16,
        alpha: 0.12 + Math.random() * 0.08,
      });
      this.timer = 9 + Math.random() * 8;
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.x += s.speed * dt;
      if (s.x - s.length > this.width || s.y > this.height) this.streaks.splice(i, 1);
    }
  }
  draw(ctx, cameraOffset = 0) {
    ctx.save();
    ctx.translate(-cameraOffset * this.parallax, 0);
    for (const s of this.streaks) {
      const grad = ctx.createLinearGradient(s.x - s.length, s.y, s.x, s.y);
      grad.addColorStop(0, 'rgba(144, 207, 255, 0)');
      grad.addColorStop(1, `rgba(190, 226, 255, ${s.alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x - s.length, s.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------- Layer F: Ambient Lighting -------------------
export class AmbientLightingLayer extends BackgroundLayer {
  constructor(width, height) {
    super(width, height);
    this.parallax = 0; // static overlay
  }
  // regionName like 'earth', 'mars', etc.
  getGradient(ctx, regionName) {
    const start = getCssVar(`--region-${regionName}-start`, '#080d20');
    const end = getCssVar(`--region-${regionName}-end`, '#090b18');
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, start);
    grad.addColorStop(1, end);
    return grad;
  }
  draw(ctx, cameraOffset = 0, regionName = 'earth') {
    ctx.save();
    ctx.fillStyle = this.getGradient(ctx, regionName);
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}

// Helper to instantiate layers in the desired rendering order
export function createBackgroundLayers(width, height) {
  return [
    new AmbientLightingLayer(width, height), // base colour gradient
    new StarfieldLayer(width, height),
    new NebulaLayer(width, height),
    new PlanetLayer(width, height),
    new DebrisLayer(width, height),
    new NearParticleLayer(width, height),
    new BlackHoleLayer(width, height), // renders only in black‑hole region
  ];
}

// ------------------- Layer G: Black Hole -------------------
export class BlackHoleLayer extends BackgroundLayer {
    constructor(width, height) {
        super(width, height);
        this.parallax = 0.9; // moves slightly with camera for depth
        this.time = 0;
    }
    update(dt) { this.time += dt; }
    draw(ctx, cameraOffset = 0, regionName = '') {
        if (regionName !== 'blackhole') return; // only visible in black‑hole stage
        const cx = this.width / 2;
        const cy = this.height / 2;
        const maxR = Math.min(this.width, this.height) * 0.25;
        // Accretion ring gradient
        const ring = ctx.createRadialGradient(cx, cy, maxR * 0.7, cx, cy, maxR);
        ring.addColorStop(0, 'rgba(255,200,100,0.3)');
        ring.addColorStop(0.5, 'rgba(255,150,50,0.15)');
        ring.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.translate(-cameraOffset * this.parallax, 0);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        ctx.fill();
        // Central dark sink
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * 0.5, 0, Math.PI * 2);
        ctx.fill();
        // Light halo to suggest gravitational lensing
        const halo = ctx.createRadialGradient(cx, cy, maxR * 0.5, cx, cy, maxR * 1.2);
        halo.addColorStop(0, 'rgba(255,255,255,0.15)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    }
}
