// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    if (typeof L === 'undefined') {
        console.error('Leaflet library not loaded');
        alert('Error: Leaflet mapping library not loaded. Please check your internet connection.');
        return;
    }

    const CITIES_URL = '/api/cities/';
    const weatherUrl = (cityId) => `/api/weather/${cityId}/`;

    // Initialize the map showing the whole world
    const map = L.map('map').setView([30, 10], 2);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    // Store markers for reference
    const markers = {};

    // Custom icon for city markers
    const cityIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
            background-color: #667eea;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            cursor: pointer;
        "></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    // Text from external APIs is escaped before it is placed in popup HTML
    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[character]));
    }

    // Fetch and display cities
    async function loadCities() {
        try {
            const response = await fetch(CITIES_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch cities (HTTP ${response.status})`);
            }

            const cities = await response.json();
            console.log(`Loaded ${cities.length} cities`);

            if (cities.length === 0) {
                showMapMessage('No cities found. Run: docker compose run --rm web python manage.py populate_cities');
                return;
            }

            cities.forEach(addCityMarker);
        } catch (error) {
            console.error('Error loading cities:', error);
            showMapMessage(`Failed to load cities: ${error.message}`);
        }
    }

    // Show a message in a popup in the middle of the map
    function showMapMessage(message) {
        L.popup()
            .setLatLng(map.getCenter())
            .setContent(`<div class="error-message">${escapeHtml(message)}</div>`)
            .openOn(map);
    }

    // Add a marker for a city
    function addCityMarker(city) {
        const marker = L.marker([city.latitude, city.longitude], {
            icon: cityIcon,
            title: `${city.name}, ${city.country}`
        }).addTo(map);

        marker.on('click', () => fetchWeatherData(city.id, marker));
        markers[city.id] = marker;
    }

    // Fetch weather data for a city from OUR Django API (server-side proxy to XWeather)
    async function fetchWeatherData(cityId, marker) {
        showLoading();

        try {
            const response = await fetch(weatherUrl(cityId));
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `Request failed (HTTP ${response.status})`);
            }

            displayWeatherPopup(data, marker);
        } catch (error) {
            console.error('Error fetching weather:', error);
            displayErrorPopup(marker, error.message);
        } finally {
            hideLoading();
        }
    }

    // Display weather information in a popup
    function displayWeatherPopup(data, marker) {
        // Updated to use XWeather's WxBlox icon CDN path
        const iconUrl = `https://cdn.aerisapi.com/wxblox/icons/${encodeURIComponent(data.icon)}`;
        const description = escapeHtml(data.description);

        const popupContent = `
            <div class="weather-popup">
                <h3>${escapeHtml(data.city)}, ${escapeHtml(data.country)}</h3>

                <div class="weather-icon-container">
                    <img src="${iconUrl}" alt="${description}">
                    <div class="weather-description">${description}</div>
                </div>

                <div class="weather-info">
                    <div class="weather-item">
                        <div>
                            <strong>Temperature</strong>
                            <span>${Number(data.temperature).toFixed(1)}°C</span>
                        </div>
                    </div>

                    <div class="weather-item">
                        <div>
                            <strong>Feels Like</strong>
                            <span>${Number(data.feels_like).toFixed(1)}°C</span>
                        </div>
                    </div>

                    <div class="weather-item">
                        <div>
                            <strong>Humidity</strong>
                            <span>${Number(data.humidity)}%</span>
                        </div>
                    </div>

                    <div class="weather-item">
                        <div>
                            <strong>Wind Speed</strong>
                            <span>${Number(data.wind_speed)} m/s</span>
                        </div>
                    </div>

                    <div class="weather-item">
                        <div>
                            <strong>Pressure</strong>
                            <span>${Number(data.pressure)} hPa</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent, {
            maxWidth: 320,
            className: 'weather-popup-container'
        }).openPopup();
    }

    // Display an error message in a popup
    function displayErrorPopup(marker, errorMessage = 'Unknown error') {
        const errorContent = `
            <div class="weather-popup">
                <h3>Error</h3>
                <div class="error-message">
                    Unable to fetch weather data: ${escapeHtml(errorMessage)}
                    <br><br>
                    Please try again later.
                </div>
            </div>
        `;

        marker.bindPopup(errorContent).openPopup();
    }

    // Show / hide the loading overlay
    function showLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.classList.add('active');
    }

    function hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.classList.remove('active');
    }

    // Initialize the application
    loadCities();

    // Helper for debugging in the browser console
    window.debugMap = { map, markers, loadCities };
});