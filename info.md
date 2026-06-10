Animated Belgian KMI/RMI beta precipitation radar for Home Assistant.

After installation and restart, add the integration from Devices & services. The dashboard resource is registered automatically in storage-mode Lovelace dashboards. YAML-mode users may need to add `/kmi_weather_radar_beta/kmi-weather-radar-beta.js` manually as a JavaScript module.

Timing options use seconds:

```yaml
refresh_interval: 120
animation_interval: 0.7
```
