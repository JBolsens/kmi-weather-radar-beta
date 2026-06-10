# KMI Weather Radar Beta

Animated Home Assistant dashboard card for the Belgian KMI/RMI beta precipitation radar.

![KMI Weather Radar Beta overview](images/kmi-radar-overview.png)

![KMI Weather Radar Beta detail](images/kmi-radar-detail.png)

This HACS custom **integration** provides:

- a Home Assistant backend proxy for KMI radar data, avoiding browser CORS issues;
- a bundled Lovelace dashboard card served by the integration;
- automatic Lovelace resource registration in storage-mode dashboards;
- animated radar frames, play/pause, rewind, timeline slider, local Belgian time and attribution;
- configurable refresh and animation intervals, in seconds.

## Installation with HACS

1. In HACS, add this repository as a custom repository.
2. Select type: **Integration**.
3. Install **KMI Weather Radar Beta**.
4. Restart Home Assistant.
5. Add the integration via **Settings → Devices & services → Add integration → KMI Weather Radar Beta**.

The integration tries to automatically add this Lovelace resource:

```text
/kmi_weather_radar_beta/kmi-weather-radar-beta.js?v=<version>
```

If you use YAML-mode dashboards, or if automatic registration is unavailable in your Home Assistant setup, add the resource manually:

```text
URL: /kmi_weather_radar_beta/kmi-weather-radar-beta.js
Type: JavaScript module
```

## Dashboard YAML

```yaml
type: custom:kmi-weather-radar-beta
height: 500px
center:
  - 51.0
  - 4.5
zoom: 8
refresh_interval: 120
animation_interval: 0.7
max_frames: 40
```

## Card options

| Option | Default | Unit | Description |
| --- | ---: | --- | --- |
| `height` | `500px` | CSS size | Card height. |
| `center` | `[51.0, 4.5]` | latitude/longitude | Initial map center. |
| `zoom` | `8` | Leaflet zoom | Initial zoom level. |
| `max_frames` | `40` | frames | Maximum number of radar frames requested from the backend. |
| `refresh_interval` | `120` | seconds | How often the card asks Home Assistant for newly available radar frames. |
| `animation_interval` | `0.7` | seconds | Delay between animation frames. |
| `tile_url` | KMI light map | URL template | Optional Leaflet tile URL template. |
| `attribution` | `© OpenStreetMap \| © KMI \| Leaflet` | text | Map attribution text. |

`update_interval` is accepted as a backwards-compatible alias for `refresh_interval`, but `refresh_interval` is preferred. The old `frame_interval` option has been removed; use `animation_interval` instead.

## Notes

This project uses public KMI/RMI beta radar data and renders it locally in Home Assistant. It is not affiliated with or endorsed by KMI/RMI.

Attribution is shown on the card for OpenStreetMap, KMI and Leaflet.

## Brand icon

The included icon is an original radar/weather icon made for this project. It is not the official KMI logo.
