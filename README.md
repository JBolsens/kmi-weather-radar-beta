# KMI Radar Card

Animated precipitation radar card for Home Assistant dashboards, using the Belgian Royal Meteorological Institute (KMI/IRM/RMI) zoomable radar data.

> Experimental: this card uses public endpoints that are used by the KMI precipitation beta page. Those endpoints are not an official public API and may change.

## HACS installation

1. Install it from HACS.
2. Add the card with type "kmi-radar-card" to a dashboard with example yaml below.

## Card configuration

```yaml
type: custom:kmi-radar-card
height: 500px
center:
  - 51.0
  - 4.5
zoom: 8
```

## Full example

```yaml
type: custom:kmi-radar-card
height: 500px
center:
  - 51.0
  - 4.5
zoom: 8
frame_count: 40
animation_speed: 700
refresh_interval: 120
show_controls: true
show_attribution: true
```

## Options

| Option | Default | Description |
|---|---:|---|
| `height` | `500px` | Card height. |
| `center` | `[51.0, 4.5]` | Initial map center as `[lat, lon]`. |
| `zoom` | `8` | Initial zoom. |
| `frame_count` | `40` | Number of radar frames to load from the KMI frame list. |
| `animation_speed` | `700` | Delay between frames in milliseconds. |
| `refresh_interval` | `120` | How often to check for a newer frame list, in seconds. |
| `show_controls` | `true` | Show play/pause, previous, timeline and timestamp controls. |
| `show_attribution` | `true` | Show Leaflet/KMI/OpenStreetMap attribution. |
| `data_base` | KMI data endpoint | Override the data endpoint. Useful if you mirror data locally. |
| `tile_url` | KMI tile endpoint | Override the background tile URL. |
| `tile_attribution` | `© OpenStreetMap \| © KMI \| Leaflet` | Attribution text for the base layer. |

## Local mirror fallback

If your browser/Home Assistant blocks cross-origin requests to `meteo.be`, you can mirror the files locally and set:

```yaml
type: custom:kmi-radar-card
data_base: /local/kmi-radar
```

The local directory must contain:

```text
files.txt
geocontours-*.pbf
```

## Attribution

This card displays attribution by default. Keep attribution enabled when publishing dashboards or screenshots.

Data and base map tiles: KMI/IRM/RMI and OpenStreetMap contributors. Rendering library: Leaflet.

## Disclaimer

This project is not affiliated with, endorsed by, or supported by the Royal Meteorological Institute of Belgium.
