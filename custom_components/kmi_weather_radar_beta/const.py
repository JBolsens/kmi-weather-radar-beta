DOMAIN = "kmi_weather_radar_beta"
NAME = "KMI Weather Radar Beta"
BASE_URL = "https://www.meteo.be/services/web2016/data/radar_zoomable"
ANIMATION_FILES_URL = f"{BASE_URL}/animation-files.js"
MAX_FRAMES_DEFAULT = 40
CACHE_TTL_SECONDS = 120

VERSION = "0.1.5"
CARD_FILENAME = "kmi-weather-radar-beta.js"
CARD_URL_PATH = f"/{DOMAIN}/{CARD_FILENAME}"
CARD_RESOURCE_URL = f"{CARD_URL_PATH}?v={VERSION}"
