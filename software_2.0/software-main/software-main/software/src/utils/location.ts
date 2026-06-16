export interface LocationPoint {
  id: string
  latitude: number
  longitude: number
  accuracy: number
  timestamp: string
  address?: string
  altitude?: number
  speed?: number
  filtered?: boolean
}

export interface LocationTrack {
  id: string
  startTime: string
  endTime?: string
  points: LocationPoint[]
  distance: number
  paused: boolean
  pauseCount: number
  totalPauseTime: number
}

export interface TrackingStatus {
  isTracking: boolean
  isPaused: boolean
  currentTrack?: LocationTrack
  trackDistance: string
  trackPoints: number
  trackDuration: string
  batteryLevel?: number
  gpsAccuracy?: number
  positioningMode?: string
  samplingFrequency?: number
}

export interface SatelliteInfo {
  satellites: number
  hdop: number
  pdop: number
  vdop: number
}

class KalmanFilter {
  private Q: number = 0.001
  private R: number = 0.01
  private P: number = 1
  private X: number = 0
  private K: number = 0

  constructor(initialValue: number = 0) {
    this.X = initialValue
  }

  update(measurement: number): number {
    this.P = this.P + this.Q
    this.K = this.P / (this.P + this.R)
    this.X = this.X + this.K * (measurement - this.X)
    this.P = (1 - this.K) * this.P
    return this.X
  }

  setProcessNoise(q: number) {
    this.Q = q
  }

  setMeasurementNoise(r: number) {
    this.R = r
  }
}

class PositionFilter {
  private latFilter: KalmanFilter
  private lngFilter: KalmanFilter
  private speedFilter: KalmanFilter
  private lastTimestamp: number = 0
  private static readonly MAX_SPEED_KMH = 250
  private static readonly MAX_ACCELERATION = 10

  constructor() {
    this.latFilter = new KalmanFilter()
    this.lngFilter = new KalmanFilter()
    this.speedFilter = new KalmanFilter()
  }

  filter(latitude: number, longitude: number, speed: number | undefined, timestamp: number): { latitude: number; longitude: number; speed: number } {
    const timeDelta = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 1
    this.lastTimestamp = timestamp

    const rawSpeed = this.speedFilter.update(speed || 0)
    const filteredSpeed = Math.min(rawSpeed, PositionFilter.MAX_SPEED_KMH / 3.6)
    
    const maxAllowedDistance = (PositionFilter.MAX_SPEED_KMH / 3.6) * timeDelta

    let filteredLat = this.latFilter.update(latitude)
    let filteredLng = this.lngFilter.update(longitude)

    const distanceFromLast = this.calculateDistance(
      { latitude: this.latFilter['X'], longitude: this.lngFilter['X'] },
      { latitude: filteredLat, longitude: filteredLng }
    )
    
    if (distanceFromLast > maxAllowedDistance) {
      const ratio = maxAllowedDistance / distanceFromLast
      filteredLat = this.latFilter['X'] + (filteredLat - this.latFilter['X']) * ratio
      filteredLng = this.lngFilter['X'] + (filteredLng - this.lngFilter['X']) * ratio
    }

    return { latitude: filteredLat, longitude: filteredLng, speed: filteredSpeed }
  }

  private calculateDistance(point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number {
    const R = 6371000
    const dLat = this.toRad(point2.latitude - point1.latitude)
    const dLon = this.toRad(point2.longitude - point1.longitude)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(point1.latitude)) * Math.cos(this.toRad(point2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180)
  }
}

type MovementState = 'stationary' | 'walking' | 'running' | 'driving'

class LocationService {
  private isTracking: boolean = false
  private isPaused: boolean = false
  private currentTrack: LocationTrack | null = null
  private watchId: number | null = null
  private trackStartTime: number = 0
  private lastPauseTime: number = 0
  private pauseDuration: number = 0
  private batteryLevel: number = 100
  private gpsAccuracy: number = 0
  private positioningMode: string = 'GPS'
  private samplingFrequency: number = 1000
  private positionFilter: PositionFilter = new PositionFilter()
  private movementState: MovementState = 'stationary'
  private lastLocation: LocationPoint | null = null
  private locationHistory: LocationPoint[] = []
  private powerSavingMode: boolean = false
  private gpsActive: boolean = false
  private gpsActiveStartTime: number = 0
  private consecutiveBadFixes: number = 0
  private lastSatelliteInfo: SatelliteInfo | null = null
  private cachedPosition: { latitude: number; longitude: number; timestamp: number } | null = null

  private static readonly FREQUENCIES = {
    stationary: 5000,
    walking: 2000,
    running: 1000,
    driving: 500
  }

  private static readonly POWER_THRESHOLD = 20
  private static readonly MAX_HISTORY_SIZE = 20
  private static readonly WARM_START_TIMEOUT = 300000
  private static readonly HOT_START_TIMEOUT = 60000

  async getCurrentPosition(forceFresh: boolean = false): Promise<LocationPoint> {
    return new Promise((resolve, reject) => {
      if (!forceFresh && this.cachedPosition && Date.now() - this.cachedPosition.timestamp < 5000) {
        resolve({
          id: Date.now().toString(),
          latitude: this.cachedPosition.latitude,
          longitude: this.cachedPosition.longitude,
          accuracy: 5,
          timestamp: new Date().toISOString()
        })
        return
      }

      const startTime = Date.now()
      let attempts = 0
      const maxAttempts = 3

      const tryGetLocation = () => {
        uni.getLocation({
          type: 'gcj02',
          altitude: true,
          highAccuracyExpireTime: 30000,
          success: (res) => {
            const fixTime = Date.now() - startTime
            console.log(`GPS fix time: ${fixTime}ms, Accuracy: ${res.accuracy}m`)

            this.gpsAccuracy = res.accuracy || 0
            this.consecutiveBadFixes = 0

            const filtered = this.positionFilter.filter(
              res.latitude,
              res.longitude,
              res.speed,
              Date.now()
            )

            this.cachedPosition = {
              latitude: filtered.latitude,
              longitude: filtered.longitude,
              timestamp: Date.now()
            }

            const point: LocationPoint = {
              id: Date.now().toString(),
              latitude: filtered.latitude,
              longitude: filtered.longitude,
              accuracy: Math.min(res.accuracy || 10, filtered.speed > 0 ? 5 : 3),
              altitude: res.altitude,
              speed: filtered.speed,
              timestamp: new Date().toISOString(),
              filtered: true
            }

            this.updateMovementState(point)
            this.adjustSamplingFrequency()
            resolve(point)
          },
          fail: (err) => {
            attempts++
            if (attempts < maxAttempts) {
              setTimeout(tryGetLocation, 500 * attempts)
            } else {
              this.consecutiveBadFixes++
              if (this.consecutiveBadFixes > 5) {
                this.switchToNetworkPositioning()
              }
              reject(err)
            }
          }
        })
      }

      tryGetLocation()
    })
  }

  private switchToNetworkPositioning() {
    if (this.positioningMode !== 'NETWORK') {
      this.positioningMode = 'NETWORK'
      console.log('Switching to network positioning')
      this.getNetworkPosition()
    }
  }

  private getNetworkPosition() {
    uni.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.cachedPosition = {
          latitude: res.latitude,
          longitude: res.longitude,
          timestamp: Date.now()
        }
      }
    })
  }

  startTracking(): LocationTrack {
    if (this.isTracking) {
      throw new Error('Tracking already started')
    }

    this.currentTrack = {
      id: Date.now().toString(),
      startTime: new Date().toISOString(),
      points: [],
      distance: 0,
      paused: false,
      pauseCount: 0,
      totalPauseTime: 0
    }

    this.isTracking = true
    this.isPaused = false
    this.trackStartTime = Date.now()
    this.startWatchLocation()
    this.startBatteryMonitoring()
    this.startPowerManagement()

    return this.currentTrack
  }

  stopTracking(): LocationTrack | null {
    if (!this.isTracking || !this.currentTrack) {
      return null
    }

    this.stopWatchLocation()
    this.stopBatteryMonitoring()
    this.stopPowerManagement()

    this.currentTrack.endTime = new Date().toISOString()
    this.currentTrack.paused = false
    this.isTracking = false
    this.isPaused = false

    const track = this.currentTrack
    this.saveTrack(track)
    this.currentTrack = null

    return track
  }

  pauseTracking(): boolean {
    if (!this.isTracking || this.isPaused) {
      return false
    }

    this.isPaused = true
    if (this.currentTrack) {
      this.currentTrack.paused = true
      this.currentTrack.pauseCount++
    }
    this.lastPauseTime = Date.now()

    if (this.powerSavingMode) {
      this.enterPowerSaving()
    }

    uni.showToast({ title: '已暂停追踪', icon: 'none' })
    return true
  }

  resumeTracking(): boolean {
    if (!this.isTracking || !this.isPaused) {
      return false
    }

    if (this.lastPauseTime > 0) {
      this.pauseDuration += Date.now() - this.lastPauseTime
      if (this.currentTrack) {
        this.currentTrack.totalPauseTime += Date.now() - this.lastPauseTime
      }
      this.lastPauseTime = 0
    }

    this.isPaused = false
    if (this.currentTrack) {
      this.currentTrack.paused = false
    }

    this.exitPowerSaving()

    uni.showToast({ title: '已恢复追踪', icon: 'none' })
    return true
  }

  private startWatchLocation() {
    let lastPoint: LocationPoint | null = null
    let lastUpdateTime = Date.now()

    const updateLocation = (res: UniApp.OnLocationChangeCallbackResult) => {
      if (!this.currentTrack || this.isPaused) return

      const now = Date.now()
      const timeDelta = now - lastUpdateTime

      if (timeDelta < this.samplingFrequency) return

      lastUpdateTime = now

      this.gpsActive = true
      this.gpsActiveStartTime = now

      const filtered = this.positionFilter.filter(
        res.latitude,
        res.longitude,
        res.speed,
        now
      )

      const point: LocationPoint = {
        id: Date.now().toString(),
        latitude: filtered.latitude,
        longitude: filtered.longitude,
        accuracy: res.accuracy || 0,
        altitude: res.altitude,
        speed: filtered.speed,
        timestamp: new Date().toISOString(),
        filtered: true
      }

      this.gpsAccuracy = res.accuracy || 0
      this.lastLocation = point
      this.updateMovementState(point)
      this.adjustSamplingFrequency()

      if (lastPoint) {
        const distance = this.calculateDistance(lastPoint, point)
        
        if (this.isValidDistance(distance, point.speed || 0, timeDelta)) {
          this.currentTrack!.distance += distance
        }
      }

      this.locationHistory.push(point)
      if (this.locationHistory.length > LocationService.MAX_HISTORY_SIZE) {
        this.locationHistory.shift()
      }

      this.currentTrack.points.push(point)
      lastPoint = point

      this.cachedPosition = {
        latitude: filtered.latitude,
        longitude: filtered.longitude,
        timestamp: now
      }
    }

    this.watchId = uni.onLocationChange(updateLocation)
  }

  private isValidDistance(distance: number, speed: number, timeDelta: number): boolean {
    const maxExpectedDistance = (speed + 5) * (timeDelta / 1000)
    return distance < maxExpectedDistance * 2 && distance < 500
  }

  private stopWatchLocation() {
    if (this.watchId !== null) {
      uni.offLocationChange()
      this.watchId = null
    }
    this.gpsActive = false
  }

  private updateMovementState(point: LocationPoint) {
    const speed = point.speed || 0

    if (speed < 1) {
      this.movementState = 'stationary'
    } else if (speed < 5) {
      this.movementState = 'walking'
    } else if (speed < 15) {
      this.movementState = 'running'
    } else {
      this.movementState = 'driving'
    }
  }

  private adjustSamplingFrequency() {
    let targetFrequency = LocationService.FREQUENCIES[this.movementState]

    if (this.powerSavingMode && this.movementState === 'stationary') {
      targetFrequency = 10000
    }

    if (this.batteryLevel < LocationService.POWER_THRESHOLD) {
      targetFrequency *= 2
    }

    if (targetFrequency !== this.samplingFrequency) {
      this.samplingFrequency = targetFrequency
      console.log(`Sampling frequency adjusted to ${targetFrequency}ms (state: ${this.movementState})`)
    }
  }

  private startPowerManagement() {
    setInterval(() => {
      if (!this.isTracking || this.isPaused) return

      const activeDuration = Date.now() - this.gpsActiveStartTime

      if (activeDuration > 60000 && this.movementState === 'stationary') {
        this.powerSavingMode = true
        this.enterPowerSaving()
      }
    }, 30000)
  }

  private stopPowerManagement() {
    this.powerSavingMode = false
  }

  private enterPowerSaving() {
    if (this.watchId !== null) {
      uni.offLocationChange()
      this.watchId = null
    }
    this.gpsActive = false
    console.log('Entering power saving mode')
  }

  private exitPowerSaving() {
    if (this.isTracking && !this.isPaused) {
      this.startWatchLocation()
    }
    this.gpsActive = true
    console.log('Exiting power saving mode')
  }

  private startBatteryMonitoring() {
    uni.getBatteryInfo({
      success: (res) => {
        this.batteryLevel = res.level || 100
        this.checkBatteryLevel(res.level || 100)
      }
    })

    if (typeof uni.onBatteryChange === 'function') {
      uni.onBatteryChange((res: { level?: number }) => {
        this.batteryLevel = res.level || 100
        this.checkBatteryLevel(this.batteryLevel)
      })
    }
  }

  private checkBatteryLevel(level: number) {
    if (level < LocationService.POWER_THRESHOLD && !this.powerSavingMode) {
      this.powerSavingMode = true
      uni.showToast({ title: '电量低，已开启省电模式', icon: 'none' })
    } else if (level >= LocationService.POWER_THRESHOLD + 10 && this.powerSavingMode) {
      this.powerSavingMode = false
      uni.showToast({ title: '电量恢复，已退出省电模式', icon: 'none' })
    }
  }

  private stopBatteryMonitoring() {
    if (typeof uni.offBatteryChange === 'function') {
      uni.offBatteryChange()
    }
  }

  private calculateDistance(point1: LocationPoint, point2: LocationPoint): number {
    const R = 6371000
    const dLat = this.toRad(point2.latitude - point1.latitude)
    const dLon = this.toRad(point2.longitude - point1.longitude)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(point1.latitude)) * Math.cos(this.toRad(point2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180)
  }

  private saveTrack(track: LocationTrack) {
    try {
      const tracks = this.getSavedTracks()
      tracks.unshift(track)
      const recentTracks = tracks.slice(0, 20)
      uni.setStorageSync('locationTracks', JSON.stringify(recentTracks))
    } catch (e) {
      console.error('Failed to save track:', e)
    }
  }

  getSavedTracks(): LocationTrack[] {
    try {
      const data = uni.getStorageSync('locationTracks')
      if (data) {
        return JSON.parse(data)
      }
    } catch (e) {
      console.error('Failed to get saved tracks:', e)
    }
    return []
  }

  getTrackingStatus(): TrackingStatus {
    let trackDistance = '0米'
    let trackPoints = 0
    let trackDuration = '00:00:00'

    if (this.currentTrack) {
      trackDistance = this.formatDistance(this.currentTrack.distance)
      trackPoints = this.currentTrack.points.length

      const elapsed = Math.floor((Date.now() - this.trackStartTime - this.pauseDuration) / 1000)
      trackDuration = this.formatDuration(elapsed)
    }

    return {
      isTracking: this.isTracking,
      isPaused: this.isPaused,
      currentTrack: this.currentTrack || undefined,
      trackDistance,
      trackPoints,
      trackDuration,
      batteryLevel: this.batteryLevel,
      gpsAccuracy: this.gpsAccuracy,
      positioningMode: this.positioningMode,
      samplingFrequency: this.samplingFrequency
    }
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}米`
    }
    return `${(meters / 1000).toFixed(2)}公里`
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  getMovementState(): MovementState {
    return this.movementState
  }

  getPositioningMode(): string {
    return this.positioningMode
  }

  isPowerSaving(): boolean {
    return this.powerSavingMode
  }
}

export const locationService = new LocationService()