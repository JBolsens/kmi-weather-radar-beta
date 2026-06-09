# KMI Weather Radar Beta

Animated Home Assistant dashboard card for the Belgian KMI/RMI beta precipitation radar.

This project is a HACS custom **integration** that provides:

- a small Home Assistant backend proxy for KMI radar data, avoiding browser CORS issues;
- a Lovelace dashboard card served by the integration;
- animated radar frames, play/pause, rewind, timeline slider, local Belgium time and attribution.

## Installation with HACS

1. In HACS, add this repository as a custom repository.
2. Select type: **Integration**.
3. Install **KMI Weather Radar Beta**.
4. Restart Home Assistant.
5. Add the integration via **Settings → Devices & services → Add integration → KMI Weather Radar Beta**.
6. Add the dashboard resource manually:

```text
/kmi_weather_radar_beta/kmi-weather-radar-beta.js
```

Resource type:

```text
JavaScript module
```

## Dashboard YAML

```yaml
type: custom:kmi-weather-radar-beta
height: 500px
center:
  - 51.0
  - 4.5
zoom: 8
```

## Optional card options

```yaml
type: custom:kmi-weather-radar-beta
height: 500px
center: [51.0, 4.5]
zoom: 8
max_frames: 40
frame_interval: 700
refresh_interval: 120000
```

- `height`: CSS height of the card.
- `center`: initial map center as `[lat, lon]`.
- `zoom`: initial Leaflet zoom.
- `max_frames`: number of announced radar frames to use.
- `frame_interval`: animation speed in milliseconds.
- `refresh_interval`: how often the card checks for new radar frames, in milliseconds.

## Data and attribution

Radar data and base map tiles are loaded from meteo.be/KMI/RMI. The map displays attribution for OpenStreetMap, KMI and Leaflet.

This project is unofficial and not affiliated with KMI/RMI.

## Troubleshooting

### Card says `fout laden`

Check that:

- the integration has been added through Devices & services;
- the dashboard resource is added as JavaScript module;
- Home Assistant can reach `www.meteo.be` from the host;
- the browser console and Home Assistant logs do not show blocked requests.

### Card is installed but not found

Make sure the resource URL is exactly:

```text
/kmi_weather_radar_beta/kmi-weather-radar-beta.js
```

and that the card type is:

```yaml
type: custom:kmi-weather-radar-beta
```
