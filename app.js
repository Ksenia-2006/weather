/* global ymaps */

class WeatherApp {
    constructor() {
        this.widgets = [];
        this.map = null;
        this.markers = [];
        this.isAddingWidget = false;
        this.mapLoaded = false;
        this.CACHE_DURATION = 60 * 60 * 1000; // Кэш на 1 час

        this.init();
    }

    async init() {
        this.loadWidgetsFromStorage();
        this.bindEvents();
        this.renderWidgets();

        await this.initYandexMap();
    }

    async initYandexMap() {
        return new Promise((resolve) => {

            if (typeof ymaps !== 'undefined') {
                ymaps.ready(() => {
                    this.initMap();
                    resolve();
                });
            } else {
                // Если карты не загрузились за 5 секунд - показываем ошибку
                setTimeout(() => {
                    if (typeof ymaps === 'undefined') {
                        console.error('YMaps не загрузился');
                        this.showMapError();
                        resolve();
                    }
                }, 5000);
            }
        });
    }

    initMap() {
        try {
            const center = this.calculateMapCenter();

            this.map = new ymaps.Map('yandex-map', {
                center: [center.lat, center.lon],
                zoom: 10
            });

            this.map.controls.add('zoomControl');
            this.map.controls.add('fullscreenControl');

            this.renderMarkers();

            this.mapLoaded = true;
 
        } catch (error) {
            console.error('Ошибка при создании карты:', error);
            this.showMapError('Ошибка создания карты: ' + error.message);
        }
    }
    // Проверяем нужно ли обновить данные (прошло больше часа)
    needsRefresh(widget) {
        if (!widget.lastUpdated) {
            return true;
        }

        const now = Date.now();
        const lastUpdate = widget.lastUpdated;
        const timeDiff = now - lastUpdate;

        return timeDiff > this.CACHE_DURATION;
    }

    formatLastUpdateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    }

    showMapError(message = 'Не удалось загрузить карту') {
        const mapContainer = document.getElementById('yandex-map');
        mapContainer.innerHTML = `
            <div class="map-placeholder">
                <div class="icon"></div>
                <h3>${message}</h3>
                <p>Приложение работает в упрощенном режиме</p>
                <button onclick="app.retryMapLoad()" style="
                    background: #9b87f5; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    margin-top: 10px;
                ">Повторить загрузку</button>
            </div>
        `;
    }

    retryMapLoad() {
        console.log('Повторная попытка загрузки карты...');
        const mapContainer = document.getElementById('yandex-map');
        mapContainer.innerHTML = '<div id="yandex-map-inner" style="width:100%; height:100%;"></div>';
        this.initYandexMap();
    }

    renderMarkers() {
        if (!this.map) return;

        this.markers.forEach(marker => {
            this.map.geoObjects.remove(marker);
        });
        this.markers = [];

        this.widgets.forEach((widget, index) => {
            this.addMarkerToMap(widget, index);
        });

        if (this.widgets.length > 0) {
            const center = this.calculateMapCenter();
            this.map.setCenter([center.lat, center.lon], 10);
        }
    }

    addMarkerToMap(widget, index) {
        if (!this.map) return;

        const markerContent = this.generateMarkerContent(widget, index);
        const marker = this.createYmapsMarker(widget, markerContent, index);

        this.map.geoObjects.add(marker);
        this.markers.push(marker);
    }

    generateMarkerContent(widget, index) {
        const basicInfo = this.getMarkerBasicInfo(widget);
        const color = this.getMarkerColor(index);

        return this.buildMarkerHTML(widget, basicInfo, color, index);
    }

    getMarkerBasicInfo(widget) {
        const weatherData = widget.weatherData;
        return {
            temperature: weatherData ? `${weatherData.temperature}°C` : '...',
            description: weatherData ? weatherData.description : 'Загрузка...',
            lastUpdate: widget.lastUpdated ?
                `Обновлено: ${this.formatLastUpdateTime(widget.lastUpdated)}` : ''
        };
    }

    buildMarkerHTML(widget, basicInfo, color) {
        return `
        <div style="padding: 10px; min-width: 200px; font-family: Arial, sans-serif;">
            ${this.generateMarkerHeader(widget.id, color)}
            ${this.generateMarkerInfo(widget, basicInfo)}
            ${this.generateMarkerButtons(widget.id, color)}
        </div>
    `;
    }

    generateMarkerHeader(widgetId, color) {
        return `
            <h3 style="margin: 0 0 10px 0; color: ${color}; border-bottom: 2px solid ${color}; padding-bottom: 5px;">
                Погода #${widgetId}
            </h3>
        `;
    }

    generateMarkerInfo(widget, basicInfo) {
        const weatherData = widget.weatherData;
        return `
            <p style="margin: 5px 0;"><strong>Координаты:</strong><br>${widget.latitude.toFixed(4)}, ${widget.longitude.toFixed(4)}</p>
            <p style="margin: 5px 0;"><strong>Температура:</strong> ${basicInfo.temperature}</p>
            <p style="margin: 5px 0;"><strong>Погода:</strong> ${basicInfo.description}</p>
            <p style="margin: 5px 0; font-size: 11px; color: #666;">${basicInfo.lastUpdate}</p>
            ${weatherData ? `
                <p style="margin: 5px 0;"><strong>Влажность:</strong> ${weatherData.humidity}%</p>
                <p style="margin: 5px 0;"><strong>Ветер:</strong> ${weatherData.windSpeed} м/с</p>
            ` : ''}
        `;
    }

    generateMarkerButtons(widgetId, color) {
        return `
            <div style="margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap;">
                <button onclick="app.flyToWidget(${widgetId})" 
                        style="background: ${color}; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap;">
                    Перейти к виджету
                </button>
                <button onclick="app.refreshWidget(${widgetId})" 
                        style="background: #9b87f5; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap;">
                    Обновить
                </button>
                <button onclick="app.deleteWidget(${widgetId})" 
                        style="background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap;">
                    Удалить
                </button>
            </div>
        `;
    }

    createYmapsMarker(widget, content, index) {
        const color = this.getMarkerColor(index);
        const hintContent = `Погода: ${widget.weatherData ? widget.weatherData.temperature + '°C' : '...'}`;

        return new ymaps.Placemark([widget.latitude, widget.longitude], {
            balloonContent: content,
            hintContent: hintContent
        }, {
            preset: 'islands#circleIcon',
            iconColor: color
        });
    }

    getMarkerColor(index) {
        const colors = ['#9b87f5', '#6d5fd3', '#ff6b6b', '#4ecdc4', '#45b7d1', '#ffa726', '#7e57c2', '#26a69a'];
        return colors[index % colors.length];
    }

    async refreshWidget(widgetId) {
        const widget = this.widgets.find(w => w.id === widgetId);
        if (!widget) return;

        console.log(`Принудительное обновление виджета ${widgetId}`);

        widget.weatherData = null;
        await this.updateWidgetWeather(widget);
        this.saveWidgetsToStorage();
        this.renderWidgets();
        this.renderMap();
    }

    flyToWidget(widgetId) {
        const widget = this.widgets.find(w => w.id === widgetId);
        if (widget && this.map) {
            this.map.setCenter([widget.latitude, widget.longitude], 12);
            this.highlightWidget(widgetId);
        }
    }

    highlightWidget(widgetId) {
        document.querySelectorAll('.weather-widget').forEach(widget => {
            widget.style.boxShadow = 'none';
        });

        const targetWidget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (targetWidget) {
            targetWidget.style.boxShadow = '0 0 0 3px #9b87f5';
            targetWidget.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                if (targetWidget.style) {
                    targetWidget.style.boxShadow = 'none';
                }
            }, 3000);
        }
    }

    bindEvents() {
        const addButton = document.getElementById('add-widget-btn');

        if (addButton) {
            addButton.addEventListener('click', () => {
                this.addNewWidget();
            });

            document.getElementById('latitude-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addNewWidget();
                }
            });

            document.getElementById('longitude-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addNewWidget();
                }
            });
        }
    }

    async addNewWidget() {
        if (this.isAddingWidget) return;

        const validation = this.validateWidgetInputs();
        if (!validation.isValid) {
            alert(validation.errorMessage);
            return;
        }

        await this.processNewWidget(validation.latNum, validation.lonNum, validation.inputs);
    }

    validateWidgetInputs() {
        const inputs = this.getCoordinateInputs();

        if (!this.areCoordinatesValid(inputs.latitude, inputs.longitude)) {
            return this.createValidationResult(false, 'Пожалуйста, введите корректные координаты:\nШирота: -90 до 90\nДолгота: -180 до 180');
        }

        const latNum = parseFloat(inputs.latitude);
        const lonNum = parseFloat(inputs.longitude);

        if (this.isDuplicateWidget(latNum, lonNum)) {
            return this.createValidationResult(false, 'Виджет с такими координатами уже существует!');
        }

        return this.createValidationResult(true, null, latNum, lonNum, inputs);
    }

    getCoordinateInputs() {
        const latitudeInput = document.getElementById('latitude-input');
        const longitudeInput = document.getElementById('longitude-input');

        return {
            latitudeInput,
            longitudeInput,
            latitude: latitudeInput.value.trim(),
            longitude: longitudeInput.value.trim()
        };
    }

    areCoordinatesValid(latitude, longitude) {
        return this.validateCoordinates(latitude, longitude);
    }

    createValidationResult(isValid, errorMessage = null, latNum = null, lonNum = null, inputs = null) {
        return { isValid, errorMessage, latNum, lonNum, inputs };
    }

    // создания виджета с обработкой ошибок
    async processNewWidget(latNum, lonNum, inputs) {
        this.isAddingWidget = true;
        const addButton = this.prepareAddButton();

        try {
            await this.executeWidgetCreation(latNum, lonNum, inputs);
        } catch (error) {
            this.handleWidgetCreationError(error);
        } finally {
            this.resetAddButton(addButton);
        }
    }

    prepareAddButton() {
        const addButton = document.getElementById('add-widget-btn');
        addButton.disabled = true;
        addButton.textContent = 'Добавление...';
        return addButton;
    }

    async executeWidgetCreation(latNum, lonNum, inputs) {
        const widget = this.createNewWidget(latNum, lonNum);

        this.addWidgetToStorage(widget);
        this.updateUIAfterWidgetAdd(latNum, lonNum);

        await this.updateWidgetData(widget);
        this.finalizeWidgetCreation(inputs);
    }

    addWidgetToStorage(widget) {
        this.widgets.push(widget);
        this.saveWidgetsToStorage();
        this.renderWidgets();
    }

    updateUIAfterWidgetAdd(latNum, lonNum) {
        this.centerMapOnWidget(latNum, lonNum);
        this.renderMap();
    }

    async updateWidgetData(widget) {
        await this.updateWidgetWeather(widget);
        this.saveWidgetsToStorage();
        this.renderWidgets();
        this.renderMap();
    }

    finalizeWidgetCreation(inputs) {
        this.clearInputs(inputs.latitudeInput, inputs.longitudeInput);
    }

    handleWidgetCreationError(error) {
        console.error('Ошибка при добавлении виджета:', error);
        alert('Произошла ошибка при добавлении виджета');
    }

    resetAddButton(addButton) {
        this.isAddingWidget = false;
        addButton.disabled = false;
        addButton.textContent = 'Показать погоду';
    }

    createNewWidget(latNum, lonNum) {
        return {
            id: Date.now(),
            latitude: latNum,
            longitude: lonNum,
            weatherData: null,
            lastUpdated: null
        };
    }

    centerMapOnWidget(latNum, lonNum) {
        if (this.map) {
            this.map.setCenter([latNum, lonNum], 10);
        }
    }

    clearInputs(latitudeInput, longitudeInput) {
        latitudeInput.value = '';
        longitudeInput.value = '';
    }

    async updateWidgetWeather(widget) {
        console.log(`Обновление данных для виджета ${widget.id}`);

        const weatherData = await this.fetchWeatherData(widget.latitude, widget.longitude);
        if (weatherData) {
            widget.weatherData = weatherData;
            widget.lastUpdated = Date.now();
            console.log(`Данные обновлены для виджета ${widget.id} в ${new Date().toLocaleTimeString()}`);
        }
    }

    async fetchWeatherData(lat, lon) {
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return this.formatWeatherData(data);
        } catch (error) {
            console.error('Ошибка получения погоды:', error);
            alert('Не удалось получить данные о погоде. Проверьте координаты и подключение к интернету.');
            return null;
        }
    }

    formatWeatherData(data) {
        const current = data.current;
        const weatherInfo = this.getWeatherInfo(current.weather_code);

        return {
            temperature: Math.round(current.temperature_2m),
            description: weatherInfo.description,
            humidity: current.relative_humidity_2m,
            windSpeed: current.wind_speed_10m,
            icon: weatherInfo.icon,
        };
    }

    getWeatherInfo(weatherCode) {
        const weatherMap = {
            0: { description: "Ясно", icon: "clear" },
            1: { description: "Преимущественно ясно", icon: "clear" },
            2: { description: "Переменная облачность", icon: "partly_cloudy" },
            3: { description: "Пасмурно", icon: "cloudy" },
            45: { description: "Туман", icon: "fog" },
            48: { description: "Туман с изморозью", icon: "fog" },
            51: { description: "Легкая морось", icon: "light_rain" },
            61: { description: "Небольшой дождь", icon: "light_rain" },
            63: { description: "Умеренный дождь", icon: "rain" },
            71: { description: "Небольшой снег", icon: "snow" },
            73: { description: "Умеренный снег", icon: "snow" },
            75: { description: "Сильный снег", icon: "snow" },
            82: { description: "Сильный ливень", icon: "rain" },
            85: { description: "Небольшой снегопад", icon: "snow" },
            86: { description: "Сильный снегопад", icon: "snow" },
            95: { description: "Гроза", icon: "thunderstorm" },
            96: { description: "Гроза с небольшим градом", icon: "thunderstorm" },
            99: { description: "Гроза с сильным градом", icon: "thunderstorm" }
        };

        return weatherMap[weatherCode] || { description: "Неизвестно", icon: "wind" };
    }

    getWeatherIcon(weatherType) {
        const iconMap = {
            'clear': 'clear.png',
            'partly_cloudy': 'partly_cloudy.png',
            'cloudy': 'cloudy.png',
            'fog': 'fog.png',
            'light_rain': 'light_rain.png',
            'rain': 'rain.png',
            'snow': 'snow.png',
            'thunderstorm': 'thunderstorm.png',
            'default': 'wind.png'
        };

        return iconMap[weatherType] || iconMap['default'];
    }

    validateCoordinates(lat, lon) {
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);

        if (isNaN(latNum) || isNaN(lonNum)) {
            return false;
        }

        return latNum >= -90 && latNum <= 90 && lonNum >= -180 && lonNum <= 180;
    }

    isDuplicateWidget(latNum, lonNum) {
        return this.widgets.find(w =>
            Math.abs(w.latitude - latNum) < 0.001 &&
            Math.abs(w.longitude - lonNum) < 0.001
        );
    }

    deleteWidget(widgetId) {
        this.widgets = this.widgets.filter(w => w.id !== widgetId);
        this.saveWidgetsToStorage();
        this.renderWidgets();
        this.renderMap();
    }

    clearAllWidgets() {
        if (confirm('Вы уверены, что хотите удалить все виджеты?')) {
            this.widgets = [];
            this.saveWidgetsToStorage();
            this.renderWidgets();
            this.renderMap();
        }
    }

    saveWidgetsToStorage() {
        try {
            localStorage.setItem('weatherWidgets', JSON.stringify(this.widgets));
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

    loadWidgetsFromStorage() {
        try {
            const saved = localStorage.getItem('weatherWidgets');
            if (saved) {
                const parsedWidgets = JSON.parse(saved);
                this.widgets = parsedWidgets.map(widget => ({
                    ...widget,
                    latitude: parseFloat(widget.latitude),
                    longitude: parseFloat(widget.longitude),
                    lastUpdated: widget.lastUpdated || null
                }));
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.widgets = [];
        }
    }

    async loadInitialWeatherData() {
        console.log('Загрузка данных погоды для существующих виджетов...');

        const promises = this.widgets.map(async (widget) => {
            if (this.needsRefresh(widget)) {
                console.log(`Виджет ${widget.id} требует обновления`);
                await this.updateWidgetWeather(widget);
            } else {
                console.log(`Виджет ${widget.id} использует кэшированные данные`);
            }
        });

        await Promise.all(promises);
        this.saveWidgetsToStorage();
        this.renderWidgets();
        this.renderMap();
    }

    renderWidgets() {
        const container = document.getElementById('widgets-container');
        container.innerHTML = '';

        if (this.widgets.length === 0) {
            container.innerHTML = this.generateEmptyState();
            return;
        }

        this.renderClearAllButton(container);
        this.renderAllWidgets(container);
    }

    generateEmptyState() {
        return `
            <div class="empty-state">
                <div class="icon"></div>
                <h3>Нет виджетов погоды</h3>
                <p>Добавьте первый виджет, указав координаты</p>
            </div>
        `;
    }

    renderClearAllButton(container) {
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Очистить все виджеты';
        clearButton.className = 'weather-widget clear-all-btn';
        clearButton.addEventListener('click', () => this.clearAllWidgets());
        container.appendChild(clearButton);
    }

    renderAllWidgets(container) {
        this.widgets.forEach(widget => {
            const widgetElement = this.createWidgetElement(widget);
            container.appendChild(widgetElement);
        });
    }

    createWidgetElement(widget) {
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'weather-widget';
        widgetDiv.setAttribute('data-widget-id', widget.id);

        const widgetHTML = this.generateWidgetHTML(widget);
        widgetDiv.innerHTML = widgetHTML;

        this.bindWidgetEvents(widgetDiv, widget.id);
        return widgetDiv;
    }

    generateWidgetHTML(widget) {
        const headerHTML = this.generateWidgetHeader(widget);
        const contentHTML = this.generateWidgetContent(widget);

        return headerHTML + contentHTML;
    }

    generateWidgetHeader(widget) {
        return `
            <div class="widget-header">
                <div class="widget-title">Погода #${widget.id}</div>
                <div class="widget-header-buttons">
                    <button class="refresh-btn" data-id="${widget.id}" type="button" title="Обновить данные">🔄</button>
                    <button class="delete-btn" data-id="${widget.id}" type="button" title="Удалить виджет">×</button>
                </div>
            </div>
        `;
    }

    generateWidgetContent(widget) {
        const coordinatesHTML = this.generateCoordinatesHTML(widget);
        const weatherContentHTML = this.generateWeatherContentHTML(widget);

        return `
            <div class="weather-content">
                ${coordinatesHTML}
                ${weatherContentHTML}
                <button class="show-on-map-btn-full" data-id="${widget.id}" type="button">Показать на карте</button>
            </div>
        `;
    }

    generateCoordinatesHTML(widget) {
        return `
            <div class="coordinates">
                Ш: ${widget.latitude.toFixed(4)} | Д: ${widget.longitude.toFixed(4)}
            </div>
        `;
    }

    generateWeatherContentHTML(widget) {
        const weatherData = widget.weatherData;

        if (!weatherData) {
            return this.generateLoadingContent();
        }

        return this.generateWeatherDataContent(weatherData, widget.lastUpdated);
    }

    generateWeatherDataContent(weatherData, lastUpdated) {
        const iconSrc = `icons/${this.getWeatherIcon(weatherData.icon)}`;
        const lastUpdateText = lastUpdated ? this.formatLastUpdateTime(lastUpdated) : 'Не обновлялось';

        return `
            <img src="${iconSrc}" alt="${weatherData.description}" class="weather-icon">
            <div class="temperature">${weatherData.temperature}°C</div>
            <div class="weather-description">${weatherData.description}</div>
            <div class="last-update">Обновлено: ${lastUpdateText}</div>
            ${this.generateWeatherDetails(weatherData)}
        `;
    }

    generateLoadingContent() {
        return `
            <div class="loading-spinner"></div>
            <div class="temperature">--°</div>
            <div class="weather-description">Загрузка...</div>
            ${this.generateLoadingDetails()}
        `;
    }

    generateWeatherDetails(weatherData) {
        return `
            <div class="weather-details">
                <div class="detail-item">
                    <div class="detail-label">Влажность</div>
                    <div class="detail-value">${weatherData.humidity}%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Ветер</div>
                    <div class="detail-value">${weatherData.windSpeed} м/с</div>
                </div>
            </div>
        `;
    }

    generateLoadingDetails() {
        return `
            <div class="weather-details">
                <div class="detail-item">
                    <div class="detail-label">Влажность</div>
                    <div class="detail-value">--%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Ветер</div>
                    <div class="detail-value">-- м/с</div>
                </div>
            </div>
        `;
    }

    bindWidgetEvents(widgetElement, widgetId) {
        const deleteBtn = widgetElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            this.deleteWidget(widgetId);
        });

        const refreshBtn = widgetElement.querySelector('.refresh-btn');
        refreshBtn.addEventListener('click', () => {
            this.refreshWidget(widgetId);
        });

        const showOnMapBtn = widgetElement.querySelector('.show-on-map-btn-full');
        showOnMapBtn.addEventListener('click', () => {
            this.showOnMap(widgetId);
        });
    }

    showOnMap(widgetId) {
        const widget = this.widgets.find(w => w.id === widgetId);
        if (!widget || !this.map) return;

        this.map.setCenter([widget.latitude, widget.longitude], 12);

        const markerIndex = this.widgets.findIndex(w => w.id === widgetId);
        if (markerIndex !== -1 && this.markers[markerIndex]) {
            this.markers[markerIndex].balloon.open();
        }

        this.highlightWidget(widgetId);
    }

    renderMap() {
        if (!this.map) return;
        this.renderMarkers();
    }

    calculateMapCenter() {
        if (this.widgets.length === 0) {
            return { lat: 56.8389, lon: 60.6057 }; // Екб по умолчанию
        }

        const avgLat = this.widgets.reduce((sum, w) => sum + w.latitude, 0) / this.widgets.length;
        const avgLon = this.widgets.reduce((sum, w) => sum + w.longitude, 0) / this.widgets.length;

        return {
            lat: avgLat,
            lon: avgLon
        };
    }
}

let app;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, запуск приложения...');
    app = new WeatherApp();
    app.loadInitialWeatherData();
});