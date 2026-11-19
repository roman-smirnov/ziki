const DURATION = 3;
const STILL_DURATION = 1.2;
const COLORS = ['#ffcf61', '#f25483', '#59daca', '#aa8aef', '#ff9d61', '#fff3ce'];
const STREAMER_CUES = [0, .10, .20];
const BURSTS = [
  { at: .33, x: .19, y: .27 },
  { at: .64, x: .81, y: .30 },
  { at: 1.02, x: .49, y: .20 },
  { at: 1.40, x: .31, y: .43 },
  { at: 1.76, x: .69, y: .41 },
].map((cue, burst) => ({
  ...cue,
  rays: Array.from({ length: 27 }, (_, ray) => {
    const angle = ray / 27 * Math.PI * 2 + burst * .37;
    return { x: Math.cos(angle), y: Math.sin(angle), color: COLORS[(ray + burst * 2) % COLORS.length] };
  }),
}));

// Adapt Dabi's seeded fountains and late shower to the height of the garden view.
const CONFETTI = (() => {
  let seed = 20260926;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: 144 }, (_, index) => {
    const ribbon = index % 9 === 0;
    const shower = index >= 108;
    const delay = shower ? .72 + random() * .44
      : ribbon ? STREAMER_CUES[(index / 9) % STREAMER_CUES.length]
      : random() * .32;
    return {
      ribbon, shower, delay, side: index % 2 === 0 ? 1 : -1,
      spread: .16 + random() * .64, rise: .48 + random() * .4, peak: .61 + random() * .39,
      phase: random() * Math.PI * 2, spin: (random() - .5) * 7,
      size: .55 + random() * .57, color: COLORS[index % COLORS.length],
    };
  });
})();

function drawFireworks(ctx: CanvasRenderingContext2D, time: number, width: number, height: number) {
  const radius = Math.min(width, height) * .165;
  ctx.lineCap = 'round';
  for (const { at, x, y, rays } of BURSTS) {
    const age = time - at;
    if (age < 0 || age >= 1.05) continue;
    const progress = 1 - Math.exp(-4 * age);
    const fall = age * age * radius * .29;
    ctx.save();
    ctx.translate(x * width, y * height);
    ctx.globalAlpha = (1 - age / 1.05) ** .72 * Math.min(1, age / .09);
    for (const [index, ray] of rays.entries()) {
      const long = index % 3 === 0;
      const reach = radius * (long ? 1 : .68);
      const tip = reach * progress;
      const tail = reach * Math.max(0, progress - .16);
      const tipX = ray.x * tip, tipY = ray.y * tip + fall;
      ctx.strokeStyle = ctx.fillStyle = ray.color;
      ctx.lineWidth = long ? 2.5 : 1.65;
      ctx.beginPath();
      ctx.moveTo(ray.x * tail, ray.y * tail + fall * .65);
      ctx.quadraticCurveTo(ray.x * (tip + tail) / 2, ray.y * (tip + tail) / 2 + fall * .77, tipX, tipY);
      ctx.stroke();
      ctx.beginPath();
      const spark = long ? 2.35 : 1.15;
      if (long) {
        ctx.moveTo(tipX - spark, tipY);
        ctx.lineTo(tipX, tipY - spark * 1.45);
        ctx.lineTo(tipX + spark, tipY);
        ctx.lineTo(tipX, tipY + spark * 1.45);
        ctx.closePath();
      } else ctx.arc(tipX, tipY, spark, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawConfetti(ctx: CanvasRenderingContext2D, time: number, width: number, height: number, still: boolean) {
  const unit = Math.max(4, Math.min(width, height) * .018);
  const fade = Math.min(1, ((still ? STILL_DURATION : DURATION) - time) / .55);
  const count = still ? 24 : CONFETTI.length;
  for (let index = 0; index < count; index++) {
    const piece = CONFETTI[index];
    const age = time - piece.delay;
    if (!still && age < 0) continue;
    const origin = piece.side > 0 ? .045 : .955;
    let x = origin + piece.side * piece.spread * .27;
    let y = .20 + index / count * .62;
    if (!still) {
      const lift = 1 - (1 - Math.min(1, age / piece.peak)) ** 3;
      const fall = Math.max(0, age - piece.peak);
      const flutter = Math.sin(age * 5 + piece.phase) - Math.sin(piece.phase);
      x = piece.shower ? .09 + piece.spread + flutter * .022
        : origin + piece.side * piece.spread * (1 - Math.exp(-2.6 * age)) + flutter * .014 * Math.min(1, age);
      y = piece.shower ? -.05 + age * (.35 + .14 * piece.rise)
        : .96 - piece.rise * lift + .10 * fall + .15 * fall * fall;
    }
    const size = unit * piece.size;
    ctx.save();
    ctx.translate(x * width, y * height);
    ctx.rotate(piece.phase + (still ? 0 : age * piece.spin));
    ctx.globalAlpha = fade * (still ? 1 : Math.min(1, (age + .025) / .1));
    ctx.fillStyle = ctx.strokeStyle = piece.color;
    ctx.beginPath();
    if (piece.ribbon) {
      ctx.lineWidth = size * .34;
      ctx.lineCap = 'round';
      for (let step = 0; step <= 12; step++) {
        const t = step / 12;
        const curl = Math.sin(t * Math.PI * 3 + piece.phase) * size * .62;
        const length = (t - .5) * size * 4.7;
        if (step === 0) ctx.moveTo(curl, length);
        else ctx.lineTo(curl, length);
      }
      ctx.stroke();
    } else {
      if (!still) ctx.scale(.28 + Math.abs(Math.cos(age * 7 + piece.phase)) * .72, 1);
      if (index % 3 === 0) ctx.arc(0, 0, size * .47, 0, Math.PI * 2);
      else ctx.roundRect(-size * .42, -size * .62, size * .84, size * 1.24, size * .20);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function celebrateGarden(
  anchor: HTMLElement,
  isReduced: () => boolean,
) {
  if (document.hidden) return;
  const canvas = document.createElement('canvas');
  const surface = canvas.getContext('2d');
  if (!surface) return;
  const context = surface;
  canvas.className = 'victory-celebration';
  canvas.setAttribute('aria-hidden', 'true');
  anchor.append(canvas);

  let width = 1, height = 1;
  function resize() {
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  let still = isReduced();
  let start: number | undefined;
  let request: number;
  function finish() {
    cancelAnimationFrame(request);
    observer.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    canvas.remove();
  }
  function visibility() { if (document.hidden) finish(); }
  function render(now: number) {
    start ??= now;
    const time = (now - start) / 1000;
    still ||= isReduced();
    if (time >= (still ? STILL_DURATION : DURATION)) {
      finish();
      return;
    }
    context.clearRect(0, 0, width, height);
    if (!still) drawFireworks(context, time, width, height);
    drawConfetti(context, time, width, height, still);
    request = requestAnimationFrame(render);
  }
  document.addEventListener('visibilitychange', visibility);
  request = requestAnimationFrame(render);
  return finish;
}
