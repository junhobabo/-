// 방사선 검출기 앱 JavaScript

class RadiationDetectorApp {
    constructor() {
        this.isDetecting = false;
        this.radiationValue = 0.00;
        this.measurementHistory = [];
        this.startTime = null;
        this.chartData = [];
        this.maxChartPoints = 60;
        this.settings = {
            cautionThreshold: 0.1,
            dangerThreshold: 1.0,
            soundAlerts: true,
            vibrationAlerts: true,
            sensitivity: 1.0
        };
        
        this.chart = null;
        this.detectionInterval = null;
        this.chartUpdateInterval = null;
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.initializeViews();
        this.initializeChart();
        this.bindEvents();
        this.updateDisplay();
    }

    loadSettings() {
        const saved = localStorage.getItem('radiationDetectorSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        const savedHistory = localStorage.getItem('radiationDetectorHistory');
        if (savedHistory) {
            this.measurementHistory = JSON.parse(savedHistory);
        }
    }

    saveSettings() {
        localStorage.setItem('radiationDetectorSettings', JSON.stringify(this.settings));
    }

    saveHistory() {
        // 최근 100개 기록만 유지
        if (this.measurementHistory.length > 100) {
            this.measurementHistory = this.measurementHistory.slice(-100);
        }
        localStorage.setItem('radiationDetectorHistory', JSON.stringify(this.measurementHistory));
    }

    initializeViews() {
        this.views = {
            main: document.getElementById('main-view'),
            settings: document.getElementById('settings-view'),
            history: document.getElementById('history-view'),
            help: document.getElementById('help-view')
        };
        
        this.showView('main');
    }

    showView(viewName) {
        Object.values(this.views).forEach(view => view.classList.remove('active'));
        this.views[viewName].classList.add('active');
    }

    initializeChart() {
        const canvas = document.getElementById('radiation-chart');
        const ctx = canvas.getContext('2d');
        
        this.chart = {
            canvas: canvas,
            ctx: ctx,
            data: [],
            maxPoints: this.maxChartPoints
        };
        
        this.drawChart();
    }

    drawChart() {
        const { ctx, canvas, data } = this.chart;
        const width = canvas.width;
        const height = canvas.height;
        
        // 캔버스 클리어
        ctx.clearRect(0, 0, width, height);
        
        // 배경
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim();
        ctx.fillRect(0, 0, width, height);
        
        if (data.length < 2) return;
        
        // 데이터 범위 계산
        const maxValue = Math.max(...data, this.settings.dangerThreshold * 1.2);
        const minValue = 0;
        
        // 격자 그리기
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim();
        ctx.lineWidth = 0.5;
        
        // 수평선
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 수직선
        for (let i = 0; i <= 10; i++) {
            const x = (width / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // 임계값 선 그리기
        const cautionY = height - ((this.settings.cautionThreshold - minValue) / (maxValue - minValue)) * height;
        const dangerY = height - ((this.settings.dangerThreshold - minValue) / (maxValue - minValue)) * height;
        
        // 주의 임계값
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, cautionY);
        ctx.lineTo(width, cautionY);
        ctx.stroke();
        
        // 위험 임계값
        ctx.strokeStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(0, dangerY);
        ctx.lineTo(width, dangerY);
        ctx.stroke();
        
        // 데이터 선 그리기
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        data.forEach((value, index) => {
            const x = (index / (this.maxChartPoints - 1)) * width;
            const y = height - ((value - minValue) / (maxValue - minValue)) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // 현재 값 점 그리기
        if (data.length > 0) {
            const lastValue = data[data.length - 1];
            const x = ((data.length - 1) / (this.maxChartPoints - 1)) * width;
            const y = height - ((lastValue - minValue) / (maxValue - minValue)) * height;
            
            ctx.fillStyle = this.getStatusColor(lastValue);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    bindEvents() {
        // 메인 화면 버튼들
        document.getElementById('start-stop-btn').addEventListener('click', () => {
            this.toggleDetection();
        });
        
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showView('settings');
            this.loadSettingsToForm();
        });
        
        document.getElementById('history-btn').addEventListener('click', () => {
            this.showView('history');
            this.updateHistoryView();
        });
        
        document.getElementById('help-btn').addEventListener('click', () => {
            this.showView('help');
        });
        
        // 뒤로 가기 버튼들
        document.getElementById('back-btn').addEventListener('click', () => {
            this.saveSettingsFromForm();
            this.showView('main');
        });
        
        document.getElementById('history-back-btn').addEventListener('click', () => {
            this.showView('main');
        });
        
        document.getElementById('help-back-btn').addEventListener('click', () => {
            this.showView('main');
        });
        
        // 설정 관련 이벤트
        document.getElementById('sensitivity').addEventListener('input', (e) => {
            document.getElementById('sensitivity-value').textContent = e.target.value;
        });
        
        document.getElementById('calibrate-btn').addEventListener('click', () => {
            this.performAutoCalibration();
        });
        
        // 기록 삭제
        document.getElementById('clear-history-btn').addEventListener('click', () => {
            if (confirm('모든 측정 기록을 삭제하시겠습니까?')) {
                this.clearHistory();
            }
        });
    }

    toggleDetection() {
        if (this.isDetecting) {
            this.stopDetection();
        } else {
            this.startDetection();
        }
    }

    startDetection() {
        this.isDetecting = true;
        this.startTime = new Date();
        this.chartData = [];
        
        // UI 업데이트
        document.getElementById('btn-text').textContent = '검출 중지';
        document.getElementById('start-stop-btn').classList.add('btn--secondary');
        document.getElementById('start-stop-btn').classList.remove('btn--primary');
        
        // 상태 표시 업데이트
        this.updateStatusIndicator('detecting', '검출 중');
        document.querySelector('.detection-display').classList.add('detecting');
        
        // 검출 시뮬레이션 시작
        this.detectionInterval = setInterval(() => {
            this.simulateRadiationDetection();
        }, 1000);
        
        // 차트 업데이트
        this.chartUpdateInterval = setInterval(() => {
            this.updateChart();
        }, 1000);
    }

    stopDetection() {
        this.isDetecting = false;
        
        // 인터벌 정리
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        
        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
            this.chartUpdateInterval = null;
        }
        
        // UI 업데이트
        document.getElementById('btn-text').textContent = '검출 시작';
        document.getElementById('start-stop-btn').classList.add('btn--primary');
        document.getElementById('start-stop-btn').classList.remove('btn--secondary');
        
        // 상태 표시 업데이트
        this.updateStatusIndicator('stopped', '대기 중');
        document.querySelector('.detection-display').classList.remove('detecting');
        
        // 측정 완료 시 기록 저장
        if (this.startTime) {
            const endTime = new Date();
            const duration = Math.round((endTime - this.startTime) / 1000);
            if (duration > 10) { // 10초 이상 측정한 경우만 기록
                this.saveMeasurement(this.radiationValue, this.getStatus(), duration);
            }
        }
    }

    simulateRadiationDetection() {
        // 실제 앱에서는 카메라 센서 데이터를 분석하지만, 
        // 웹 시뮬레이션에서는 현실적인 방사선 값을 생성
        const baseValue = 0.05; // 기본 배경 방사선
        const noise = (Math.random() - 0.5) * 0.02; // 노이즈
        const timeVariation = Math.sin(Date.now() / 10000) * 0.01; // 시간 변화
        
        // 때때로 더 높은 값 생성 (실제 방사선 검출 시뮬레이션)
        let spike = 0;
        if (Math.random() < 0.05) { // 5% 확률로 스파이크
            spike = Math.random() * 0.3;
        }
        
        this.radiationValue = Math.max(0, baseValue + noise + timeVariation + spike);
        this.radiationValue *= this.settings.sensitivity;
        
        this.updateDisplay();
        this.checkAlerts();
    }

    updateDisplay() {
        // 방사선 수치 업데이트
        const valueElement = document.getElementById('radiation-value');
        valueElement.textContent = this.radiationValue.toFixed(2);
        
        // 상태별 색상 적용
        const status = this.getStatus();
        valueElement.className = `reading-value ${status}`;
        
        // 상태 표시 업데이트
        if (this.isDetecting) {
            this.updateStatusIndicator(status, this.getStatusText(status));
        }
        
        // 신뢰도 표시
        const reliability = this.calculateReliability();
        document.getElementById('reliability').textContent = reliability + '%';
        
        // 측정 시간 업데이트
        if (this.startTime && this.isDetecting) {
            const elapsed = Math.floor((new Date() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('measurement-time').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // 안정화 시간 표시
        if (this.isDetecting) {
            const elapsed = Math.floor((new Date() - this.startTime) / 1000);
            if (elapsed < 240) { // 4분
                const remaining = 240 - elapsed;
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                document.getElementById('stabilization-time').textContent = 
                    `${minutes}:${seconds.toString().padStart(2, '0')} 남음`;
            } else {
                document.getElementById('stabilization-time').textContent = '완료';
            }
        } else {
            document.getElementById('stabilization-time').textContent = '--';
        }
        
        // 배터리 시뮬레이션 (서서히 감소)
        const batteryElement = document.getElementById('battery-level');
        if (this.isDetecting) {
            const elapsed = (new Date() - this.startTime) / 1000;
            const batteryDrain = Math.min(5, elapsed / 3600 * 10); // 시간당 10% 감소
            const battery = Math.max(85, 100 - batteryDrain);
            batteryElement.textContent = Math.round(battery) + '%';
        }
    }

    getStatus() {
        if (this.radiationValue >= this.settings.dangerThreshold) {
            return 'danger';
        } else if (this.radiationValue >= this.settings.cautionThreshold) {
            return 'caution';
        } else {
            return 'safe';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'danger': return '위험';
            case 'caution': return '주의';
            case 'safe': return '안전';
            default: return '대기 중';
        }
    }

    getStatusColor(value) {
        if (value >= this.settings.dangerThreshold) {
            return '#EF4444';
        } else if (value >= this.settings.cautionThreshold) {
            return '#F59E0B';
        } else {
            return '#10B981';
        }
    }

    updateStatusIndicator(status, text) {
        const light = document.getElementById('status-light');
        const textElement = document.getElementById('status-text');
        
        light.className = `status-light ${status}`;
        textElement.textContent = text;
    }

    calculateReliability() {
        if (!this.isDetecting) return '--';
        
        const elapsed = (new Date() - this.startTime) / 1000;
        const baseReliability = Math.min(95, 60 + (elapsed / 240) * 35); // 4분 후 95%
        
        // 배터리 수준에 따른 조정
        const batteryLevel = parseInt(document.getElementById('battery-level').textContent);
        const batteryFactor = batteryLevel < 20 ? 0.8 : 1.0;
        
        return Math.round(baseReliability * batteryFactor);
    }

    checkAlerts() {
        const status = this.getStatus();
        
        if (status === 'danger' || status === 'caution') {
            this.showAlert(status);
            
            if (this.settings.soundAlerts) {
                this.playAlertSound();
            }
            
            if (this.settings.vibrationAlerts && 'navigator' in window && 'vibrate' in navigator) {
                navigator.vibrate(status === 'danger' ? [200, 100, 200] : [100]);
            }
        }
    }

    showAlert(level) {
        // 알림 배너 표시 (실제 구현에서는 더 정교한 알림 시스템 사용)
        const message = level === 'danger' ? 
            '위험한 방사선 수치가 감지되었습니다!' : 
            '주의: 평소보다 높은 방사선 수치입니다.';
        
        // 간단한 알림 표시 (실제로는 더 나은 UI 구현)
        if (!document.querySelector('.alert-banner')) {
            const banner = document.createElement('div');
            banner.className = 'alert-banner';
            banner.textContent = message;
            document.body.appendChild(banner);
            
            setTimeout(() => {
                banner.classList.add('hidden');
                setTimeout(() => banner.remove(), 300);
            }, 3000);
        }
    }

    playAlertSound() {
        // 웹에서는 제한적이지만 간단한 비프음 생성 가능
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    updateChart() {
        if (!this.isDetecting) return;
        
        this.chartData.push(this.radiationValue);
        
        if (this.chartData.length > this.maxChartPoints) {
            this.chartData.shift();
        }
        
        this.chart.data = this.chartData;
        this.drawChart();
    }

    saveMeasurement(value, status, duration) {
        const measurement = {
            timestamp: new Date().toISOString(),
            value: value,
            status: status,
            duration: duration
        };
        
        this.measurementHistory.unshift(measurement);
        this.saveHistory();
    }

    updateHistoryView() {
        const tbody = document.getElementById('history-tbody');
        
        if (this.measurementHistory.length === 0) {
            tbody.innerHTML = '<div class="no-data">측정 기록이 없습니다</div>';
        } else {
            tbody.innerHTML = this.measurementHistory.slice(0, 20).map(record => {
                const date = new Date(record.timestamp);
                const timeString = date.toLocaleString('ko-KR');
                
                return `
                    <div class="table-row">
                        <div>${timeString}</div>
                        <div>${record.value.toFixed(2)}</div>
                        <div><span class="measurement-status ${record.status}">${this.getStatusText(record.status)}</span></div>
                    </div>
                `;
            }).join('');
        }
        
        // 통계 업데이트
        this.updateHistoryStats();
    }

    updateHistoryStats() {
        const totalMeasurements = this.measurementHistory.length;
        document.getElementById('total-measurements').textContent = totalMeasurements;
        
        if (totalMeasurements > 0) {
            const values = this.measurementHistory.map(r => r.value);
            const avgRadiation = values.reduce((a, b) => a + b, 0) / values.length;
            const maxRadiation = Math.max(...values);
            
            document.getElementById('avg-radiation').textContent = avgRadiation.toFixed(2);
            document.getElementById('max-radiation').textContent = maxRadiation.toFixed(2);
        } else {
            document.getElementById('avg-radiation').textContent = '0.00';
            document.getElementById('max-radiation').textContent = '0.00';
        }
    }

    clearHistory() {
        this.measurementHistory = [];
        this.saveHistory();
        this.updateHistoryView();
    }

    loadSettingsToForm() {
        document.getElementById('caution-threshold').value = this.settings.cautionThreshold;
        document.getElementById('danger-threshold').value = this.settings.dangerThreshold;
        document.getElementById('sound-alerts').checked = this.settings.soundAlerts;
        document.getElementById('vibration-alerts').checked = this.settings.vibrationAlerts;
        document.getElementById('sensitivity').value = this.settings.sensitivity;
        document.getElementById('sensitivity-value').textContent = this.settings.sensitivity;
    }

    saveSettingsFromForm() {
        this.settings.cautionThreshold = parseFloat(document.getElementById('caution-threshold').value);
        this.settings.dangerThreshold = parseFloat(document.getElementById('danger-threshold').value);
        this.settings.soundAlerts = document.getElementById('sound-alerts').checked;
        this.settings.vibrationAlerts = document.getElementById('vibration-alerts').checked;
        this.settings.sensitivity = parseFloat(document.getElementById('sensitivity').value);
        
        this.saveSettings();
    }

    performAutoCalibration() {
        const button = document.getElementById('calibrate-btn');
        const originalText = button.textContent;
        
        button.innerHTML = '<span class="loading-spinner"></span> 캘리브레이션 중...';
        button.disabled = true;
        
        // 시뮬레이션된 캘리브레이션 프로세스
        setTimeout(() => {
            // 기본값으로 재설정
            this.settings.sensitivity = 1.0;
            document.getElementById('sensitivity').value = 1.0;
            document.getElementById('sensitivity-value').textContent = '1.0';
            
            button.textContent = originalText;
            button.disabled = false;
            
            alert('캘리브레이션이 완료되었습니다.');
        }, 2000);
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.radiationApp = new RadiationDetectorApp();
});