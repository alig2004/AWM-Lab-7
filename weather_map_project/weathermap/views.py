import requests
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render

from .models import City

XWEATHERMAP_URL = "https://data.api.xweather.com/conditions/closest"


def map_view(request):
    """Render the main map page"""
    return render(request, 'weathermap/map.html')


def get_cities_json(request):
    """Return all cities as JSON"""
    cities = City.objects.all().values('id', 'name', 'country', 'latitude', 'longitude')
    return JsonResponse(list(cities), safe=False)


def get_weather(request, city_id):
    """Fetch current weather for a city from XWeather API (server-side, so credentials stay secret)"""
    try:
        city = City.objects.get(id=city_id)
    except City.DoesNotExist:
        return JsonResponse({'error': 'City not found'}, status=404)

    # Use the exact variable names defined in your settings.py
    client_id = getattr(settings, 'XWEATHER_CLIENT_ID', None)
    client_secret = getattr(settings, 'XWEATHER_CLIENT_SECRET', None)

    if not client_id or not client_secret:
        return JsonResponse({'error': 'XWeather API credentials (XWEATHER_CLIENT_ID and XWEATHER_CLIENT_SECRET) are not configured'}, status=503)

    params = {
        'p': f"{city.latitude},{city.longitude}",
        'client_id': client_id,
        'client_secret': client_secret,
        'units': 'metric',  # Metric units for Celsius, m/s, etc.
    }

    try:
        response = requests.get(XWEATHERMAP_URL, params=params, timeout=5)
        response.raise_for_status()
        weather_data = response.json()

        # XWeather returns data nested inside response -> periods
        period = weather_data['response'][0]['periods'][0]

        result = {
            'city': city.name,
            'country': city.country,
            'temperature': period.get('tempC'),
            'feels_like': period.get('feelslikeC'),
            'humidity': period.get('humidity'),
            'pressure': period.get('pressureMB'),
            'wind_speed': period.get('windSpeedMPS'),
            'description': period.get('weather'),
            'icon': period.get('icon'),
        }
        return JsonResponse(result)

    except requests.exceptions.HTTPError as e:
        # Never return str(e): it contains the request URL, including sensitive credentials
        status = e.response.status_code
        if status == 401:
            message = 'XWeather rejected the API credentials'
        else:
            message = f'XWeather returned HTTP {status}'
        return JsonResponse({'error': message}, status=502)
    except requests.exceptions.RequestException:
        return JsonResponse({'error': 'Could not get a response from XWeather'}, status=502)
    except (KeyError, IndexError):
        return JsonResponse({'error': 'Unexpected response format from XWeather'}, status=502)