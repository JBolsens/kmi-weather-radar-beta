class KmiRadarCard extends HTMLElement {
  static getConfigElement() { return document.createElement('kmi-radar-card-editor'); }
  static getStubConfig() { return { height: '500px', center: [51.0, 4.5], zoom: 8 }; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.config = {};
    this.map = null;
    this.radarLayer = null;
    this.frames = [];
    this.idx = 0;
    this.playing = true;
    this.timer = null;
    this.refreshTimer = null;
    this.latestSeen = null;
    this.libsPromise = null;
  }

  setConfig(config) {
    this.config = {
      height: '500px',
      center: [51.0, 4.5],
      zoom: 8,
      frame_count: 40,
      animation_speed: 700,
      refresh_interval: 120,
      show_controls: true,
      show_attribution: true,
      data_base: 'https://www.meteo.be/services/web2016/data/radar_zoomable',
      tile_url: 'https://tile.meteo.be/styles/Light-v10-nl/{z}/{x}/{y}.png',
      tile_attribution: '© OpenStreetMap | © KMI | Leaflet',
      leaflet_css: 'https://www.meteo.be/services/web2016/radar_zoomable/dist/leaflet-1.9.4/leaflet.css',
      leaflet_js: 'https://www.meteo.be/services/web2016/radar_zoomable/dist/leaflet-1.9.4/leaflet.js',
      pbf_js: 'https://www.meteo.be/services/web2016/radar_zoomable/dist/pbf.js',
      geobuf_js: 'https://www.meteo.be/services/web2016/radar_zoomable/dist/geobuf.js',
      ...config,
    };
    this.render();
  }

  connectedCallback() {
    this.init().catch((err) => this.showError(err));
  }

  disconnectedCallback() {
    clearInterval(this.timer);
    clearInterval(this.refreshTimer);
    this.timer = null;
    this.refreshTimer = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  getCardSize() { return 4; }

  render() {
    const controls = this.config.show_controls !== false ? `
      <div class="bar">
        <button id="rew" title="Vorige frame">⏪</button>
        <button id="play" title="Play/pause">⏸</button>
        <input id="slider" type="range" min="0" max="0" value="0" title="Tijdlijn">
        <span id="time">laden…</span>
      </div>` : `<span id="time" class="floating-time">laden…</span>`;

    this.shadowRoot.innerHTML = `
      <style>
        @import url('${this.config.leaflet_css}');
        :host{display:block}
        ha-card{overflow:hidden}
        #wrap{position:relative;height:${this.config.height};overflow:hidden;background:#eef2f3;border-radius:var(--ha-card-border-radius,12px)}
        #map{height:100%;width:100%;background:#eef2f3}
        .bar{position:absolute;left:10px;right:10px;bottom:10px;z-index:999;background:rgba(0,0,0,.60);color:white;padding:6px 10px;border-radius:10px;font-family:var(--paper-font-body1_-_font-family, sans-serif);font-size:13px;display:grid;grid-template-columns:auto auto minmax(70px,1fr) 125px;align-items:center;gap:7px;box-sizing:border-box}
        button{height:30px;min-width:34px;width:auto;background:#fff;border:0;border-radius:7px;font-size:14px;cursor:pointer;padding:3px 7px;line-height:1;color:#111}
        #time{text-align:right;white-space:nowrap;font-size:13px;font-weight:600;color:white;padding-right:8px}
        input[type=range]{width:100%;min-width:0;accent-color:var(--primary-color,#1e88e5)}
        .floating-time{position:absolute;right:10px;bottom:10px;z-index:999;background:rgba(0,0,0,.60);padding:6px 10px;border-radius:10px}
        .leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.75)}
        .error{padding:16px;color:var(--error-color,#db4437);font-family:sans-serif}
      </style>
      <ha-card>
        <div id="wrap">
          <div id="map"></div>
          ${controls}
        </div>
      </ha-card>`;
  }

  async init() {
    if (!this.config || this.map) return;
    await this.loadLibraries();

    const center = Array.isArray(this.config.center) ? this.config.center : [51.0, 4.5];
    this.map = L.map(this.shadowRoot.getElementById('map'), {
      zoomControl: false,
      attributionControl: this.config.show_attribution !== false,
    }).setView(center, Number(this.config.zoom || 8));

    L.tileLayer(this.config.tile_url, {
      maxZoom: 12,
      attribution: this.config.tile_attribution,
    }).addTo(this.map);

    this.wireControls();
    await this.loadFrames(true);
    this.startTimer();
    this.refreshTimer = setInterval(() => {
      this.loadFrames(false).catch((err) => console.warn('KMI radar refresh failed', err));
    }, Number(this.config.refresh_interval || 120) * 1000);
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Kan script niet laden: ${src}`));
      document.head.appendChild(script);
    });
  }

  async loadLibraries() {
    if (!this.libsPromise) {
      this.libsPromise = (async () => {
        await this.loadScript(this.config.leaflet_js);
        await this.loadScript(this.config.pbf_js);
        await this.loadScript(this.config.geobuf_js);
      })();
    }
    return this.libsPromise;
  }

  cacheUrl(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}cache=${Date.now()}`;
  }

  dataUrl(path) {
    return `${String(this.config.data_base).replace(/\/$/, '')}/${path}`;
  }

  async fetchText(url) {
    const res = await fetch(this.cacheUrl(url), { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    return res.text();
  }

  async fetchBuffer(url) {
    const res = await fetch(this.cacheUrl(url), { cache: 'no-store' });
    if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async readFrames() {
    let txt;
    if (String(this.config.data_base).includes('/local/')) {
      txt = await this.fetchText(this.dataUrl('files.txt'));
      return txt.trim().split('\n').filter(Boolean).reverse();
    }

    txt = await this.fetchText(this.dataUrl('animation-files.js'));
    const files = [...txt.matchAll(/geocontours-[^"]+?\.pbf/g)].map((m) => m[0]);
    return files.slice(0, Number(this.config.frame_count || 40)).reverse();
  }

  async loadFrames(forceLatest = false) {
    const newFrames = await this.readFrames();
    if (!newFrames.length) throw new Error('Geen radarframes gevonden');

    const newLatest = newFrames[newFrames.length - 1];
    if (!this.frames.length || newLatest !== this.latestSeen) {
      this.frames = newFrames;
      this.latestSeen = newLatest;
      const slider = this.shadowRoot.getElementById('slider');
      if (slider) slider.max = this.frames.length - 1;
      if (forceLatest || this.playing) {
        this.idx = this.frames.length - 1;
        await this.showFrame(this.idx);
      }
    }
  }

  async showFrame(newIdx) {
    if (!this.frames.length) return;
    this.idx = (newIdx + this.frames.length) % this.frames.length;
    const file = this.frames[this.idx];
    const buffer = await this.fetchBuffer(this.dataUrl(file));
    const geojson = geobuf.decode(new Pbf(new Uint8Array(buffer)));

    geojson.features.sort((a, b) => Number(a.properties.value || 0) - Number(b.properties.value || 0));

    if (this.radarLayer) this.map.removeLayer(this.radarLayer);
    this.radarLayer = L.geoJSON(geojson, {
      style: (feature) => {
        const v = Number(feature.properties.value || 0);
        return { stroke: false, fillColor: this.colorFor(v), fillOpacity: 0.68 };
      },
      onEachFeature: (feature, layer) => layer.bindTooltip(`waarde: ${feature.properties.value} mm/u`),
    }).addTo(this.map);

    const slider = this.shadowRoot.getElementById('slider');
    const timeEl = this.shadowRoot.getElementById('time');
    if (slider) slider.value = this.idx;
    if (timeEl) timeEl.textContent = this.fileToLabel(file);
  }

  wireControls() {
    const playBtn = this.shadowRoot.getElementById('play');
    const rewBtn = this.shadowRoot.getElementById('rew');
    const slider = this.shadowRoot.getElementById('slider');

    if (playBtn) {
      playBtn.onclick = () => {
        this.playing = !this.playing;
        playBtn.textContent = this.playing ? '⏸' : '▶️';
        if (this.playing) this.startTimer();
        else clearInterval(this.timer);
      };
    }

    if (rewBtn) rewBtn.onclick = () => this.showFrame(this.idx - 1).catch((err) => this.showError(err));

    if (slider) {
      slider.oninput = () => {
        clearInterval(this.timer);
        this.playing = false;
        if (playBtn) playBtn.textContent = '▶️';
        this.showFrame(Number(slider.value)).catch((err) => this.showError(err));
      };
    }
  }

  startTimer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.showFrame(this.idx + 1).catch((err) => this.showError(err));
    }, Number(this.config.animation_speed || 700));
  }

  fileToLabel(file) {
    const match = file.match(/geocontours-(\d{12})-/);
    if (!match) return file;
    const s = match[1];
    const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00Z`);
    return d.toLocaleString('nl-BE', {
      timeZone: 'Europe/Brussels',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  colorFor(v) {
    if (v >= 20) return '#ff0000';
    if (v >= 10) return '#ff8800';
    if (v >= 5) return '#ffff00';
    if (v >= 1) return '#00e5ff';
    if (v >= 0.3) return '#0099ff';
    if (v >= 0.1) return '#33bbff';
    if (v >= 0.05) return '#80ddff';
    return '#ccefff';
  }

  showError(err) {
    console.error('KMI Radar Card:', err);
    const timeEl = this.shadowRoot.getElementById('time');
    if (timeEl) timeEl.textContent = 'fout laden';
  }
}

customElements.define('kmi-radar-card', KmiRadarCard);
console.info('%cKMI Radar Card loaded', 'color:#1e88e5;font-weight:bold');
