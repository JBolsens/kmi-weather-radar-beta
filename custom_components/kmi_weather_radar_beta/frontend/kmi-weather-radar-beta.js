class KmiWeatherRadarBetaCard extends HTMLElement {
  setConfig(config) {
    this.config = {
      height: '500px',
      center: [51.0, 4.5],
      zoom: 8,
      max_frames: 40,
      refresh_interval: 120,
      animation_interval: 0.7,
      tile_url: 'https://tile.meteo.be/styles/Light-v10-nl/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap | © KMI | Leaflet',
      ...config,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this._frames = [];
    this._idx = 0;
    this._playing = true;
    this._animationTimer = null;
    this._refreshTimer = null;
    this._latestSeen = null;
    this._started = false;
    this._resizeObserver = null;
    this._loadingFrame = false;

    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._started && this.shadowRoot) {
      this._started = true;
      this.start().catch((e) => this.showError(e, true));
    }
  }

  disconnectedCallback() {
    this.stopAnimation();
    clearInterval(this._refreshTimer);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this._started = false;
  }

  getCardSize() {
    return 6;
  }

  secondsToMs(value, fallbackSeconds) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n * 1000 : fallbackSeconds * 1000;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="https://www.meteo.be/services/web2016/radar_zoomable/dist/leaflet-1.9.4/leaflet.css">
      <style>
        :host{display:block}
        ha-card{overflow:hidden}
        #wrap{position:relative;height:${this.config.height};background:#eef2f3;overflow:hidden;border-radius:var(--ha-card-border-radius,12px)}
        #map{height:100%;width:100%;z-index:0}
        .bar{position:absolute;left:10px;right:10px;bottom:10px;z-index:30;background:rgba(0,0,0,.60);color:white;padding:6px 10px;border-radius:10px;font-family:var(--primary-font-family, sans-serif);font-size:13px;display:grid;grid-template-columns:auto auto minmax(70px,1fr) 125px;align-items:center;gap:7px;box-sizing:border-box}
        button{height:30px;min-width:34px;width:auto;background:#fff;border:0;border-radius:7px;font-size:14px;cursor:pointer;padding:3px 7px;line-height:1;color:#111}
        #time{text-align:right;white-space:nowrap;font-size:13px;font-weight:600;color:white;padding-right:8px}
        input[type=range]{width:100%;min-width:0;accent-color:#1e88e5}
        .leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.75);margin-bottom:-2px}
        .error{position:absolute;top:10px;left:10px;right:10px;z-index:40;background:rgba(180,0,0,.85);color:white;padding:8px 10px;border-radius:8px;font-size:13px;display:none}
      </style>
      <ha-card>
        <div id="wrap">
          <div id="map"></div>
          <div class="error" id="error"></div>
          <div class="bar">
            <button id="rew" title="Previous frame">⏪</button>
            <button id="play" title="Play/Pause">⏸</button>
            <input id="slider" type="range" min="0" max="0" value="0">
            <span id="time">Loading…</span>
          </div>
        </div>
      </ha-card>
    `;
  }

  async start() {
    try {
      await this.loadLibraries();

      if (this.map) this.map.remove();

      const mapElement = this.shadowRoot.getElementById('map');
      this.map = L.map(mapElement, {
        zoomControl: false,
        attributionControl: true,
      }).setView(this.config.center, this.config.zoom);

      L.tileLayer(this.config.tile_url, {
        maxZoom: 12,
        attribution: this.config.attribution,
      }).addTo(this.map);

      this.slider = this.shadowRoot.getElementById('slider');
      this.playBtn = this.shadowRoot.getElementById('play');
      this.rewBtn = this.shadowRoot.getElementById('rew');
      this.timeEl = this.shadowRoot.getElementById('time');
      this.errorEl = this.shadowRoot.getElementById('error');

      this.playBtn.onclick = () => this.togglePlay();
      this.rewBtn.onclick = () => this.showFrame(this._idx - 1).catch((e) => this.showError(e));
      this.slider.oninput = () => {
        this.stopAnimation();
        this._playing = false;
        this.playBtn.textContent = '▶️';
        this.showFrame(Number(this.slider.value)).catch((e) => this.showError(e));
      };

      this.installResizeHandling();

      await this.loadFrames(true);
      this.startAnimation();

      clearInterval(this._refreshTimer);
      this._refreshTimer = setInterval(() => {
        this.loadFrames(false).catch((e) => this.showError(e));
      }, this.secondsToMs(this.config.refresh_interval ?? this.config.update_interval, 120));
    } catch (e) {
      this.showError(e, true);
      const timeEl = this.shadowRoot.getElementById('time');
      if (timeEl) timeEl.textContent = 'Load failed';
    }
  }

  installResizeHandling() {
    const wrap = this.shadowRoot.getElementById('wrap');
    const invalidate = () => {
      if (!this.map) return;
      requestAnimationFrame(() => {
        this.map.invalidateSize(false);
        setTimeout(() => this.map?.invalidateSize(false), 250);
      });
    };

    this.map.whenReady(invalidate);
    setTimeout(invalidate, 0);
    setTimeout(invalidate, 500);

    if ('ResizeObserver' in window && wrap) {
      if (this._resizeObserver) this._resizeObserver.disconnect();
      this._resizeObserver = new ResizeObserver(invalidate);
      this._resizeObserver.observe(wrap);
    }
  }

  async loadLibraries() {
    const scripts = [
      'https://www.meteo.be/services/web2016/radar_zoomable/dist/leaflet-1.9.4/leaflet.js',
      'https://www.meteo.be/services/web2016/radar_zoomable/dist/pbf.js',
      'https://www.meteo.be/services/web2016/radar_zoomable/dist/geobuf.js',
    ];
    for (const src of scripts) await this.loadScript(src);
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src === src);
      if (existing) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  authHeaders() {
    const token =
      this._hass?.auth?.data?.access_token ||
      this._hass?.connection?.options?.auth?.data?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async fetchApi(url, options = {}) {
    return fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options.headers || {}),
        ...this.authHeaders(),
      },
    });
  }

  async loadFrames(forceLatest = false) {
    if (!this._hass) throw new Error('Home Assistant context missing');
    const maxFrames = Math.max(1, Math.min(Number(this.config.max_frames) || 40, 80));
    const res = await this.fetchApi(`/api/kmi_weather_radar_beta/files?max=${maxFrames}&cache=${Date.now()}`);
    if (!res.ok) throw new Error(`Files API ${res.status}`);
    const data = await res.json();
    const newFrames = (data.files || []).slice().reverse();
    if (!newFrames.length) throw new Error('No radar frames received');
    const newLatest = newFrames[newFrames.length - 1];

    if (!this._frames.length || newLatest !== this._latestSeen) {
      this._frames = newFrames;
      this._latestSeen = newLatest;
      this.slider.max = this._frames.length - 1;
      if (forceLatest || this._playing) {
        this._idx = this._frames.length - 1;
        await this.showFrame(this._idx);
      }
    }
  }

  async showFrame(newIdx, retryAfterRefresh = true) {
    if (!this._frames.length || this._loadingFrame) return;
    this._loadingFrame = true;

    try {
      this._idx = (newIdx + this._frames.length) % this._frames.length;
      const file = this._frames[this._idx];

      const res = await this.fetchApi(`/api/kmi_weather_radar_beta/frame/${encodeURIComponent(file)}?cache=${Date.now()}`);
      if (!res.ok) {
        if ((res.status === 404 || res.status === 500) && retryAfterRefresh) {
          await this.loadFrames(true);
          return;
        }
        throw new Error(`${file} ${res.status}`);
      }

      const buffer = await res.arrayBuffer();
      const geojson = geobuf.decode(new Pbf(new Uint8Array(buffer)));
      geojson.features.sort((a, b) => Number(a.properties.value || 0) - Number(b.properties.value || 0));

      if (this.radarLayer) this.map.removeLayer(this.radarLayer);
      this.radarLayer = L.geoJSON(geojson, {
        style: (f) => {
          const v = Number(f.properties.value || 0);
          return { stroke: false, fillColor: this.colorFor(v), fillOpacity: 0.68 };
        },
        onEachFeature: (f, l) => l.bindTooltip(`Value: ${f.properties.value} mm/h`),
      }).addTo(this.map);

      this.slider.value = this._idx;
      this.timeEl.textContent = this.fileToLabel(file);
      this.hideError();
      this.map?.invalidateSize(false);
    } finally {
      this._loadingFrame = false;
    }
  }

  startAnimation() {
    this.stopAnimation();

    const tick = async () => {
      if (!this._playing) return;
      try {
        await this.showFrame(this._idx + 1);
      } catch (e) {
        this.showError(e);
      }
      this._animationTimer = setTimeout(tick, this.secondsToMs(this.config.animation_interval, 0.7));
    };

    this._animationTimer = setTimeout(tick, this.secondsToMs(this.config.animation_interval, 0.7));
  }

  stopAnimation() {
    clearTimeout(this._animationTimer);
    this._animationTimer = null;
  }

  togglePlay() {
    this._playing = !this._playing;
    this.playBtn.textContent = this._playing ? '⏸' : '▶️';
    if (this._playing) this.startAnimation();
    else this.stopAnimation();
  }

  fileToLabel(file) {
    const m = file.match(/geocontours-(\d{12})-/);
    if (!m) return file;
    const s = m[1];
    const d = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:00Z`);
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

  showError(e, sticky = false) {
    console.error(e);
    if (!this.errorEl) return;
    this.errorEl.textContent = String(e?.message || e);
    this.errorEl.style.display = 'block';
    if (!sticky) {
      clearTimeout(this._errorTimer);
      this._errorTimer = setTimeout(() => this.hideError(), 4000);
    }
  }

  hideError() {
    if (this.errorEl) this.errorEl.style.display = 'none';
  }
}

customElements.define('kmi-weather-radar-beta', KmiWeatherRadarBetaCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'kmi-weather-radar-beta',
  name: 'KMI Weather Radar Beta',
  description: 'Animated KMI/RMI beta precipitation radar for Belgium',
});
