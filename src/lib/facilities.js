import { API_BASE_URL } from './api.js'

const PHOTON_URL = 'https://photon.komoot.io/api/'
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const REQUEST_TIMEOUT_MS = 20000
const SEARCH_RADIUS_METERS = 5000

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(
        payload.message || `The location service returned HTTP ${response.status}.`,
      )
    }
    try {
      return await response.json()
    } catch {
      throw new Error('The location service returned an unreadable response.')
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The location service took too long to respond. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function searchLocations(query) {
  const url = new URL(PHOTON_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '5')
  url.searchParams.set('lang', 'en')

  const data = await fetchJson(url)
  return (data.features || [])
    .map((feature) => {
      const [longitude, latitude] = feature.geometry?.coordinates || []
      const properties = feature.properties || {}
      const label = [
        properties.name,
        properties.city || properties.county,
        properties.state,
        properties.country,
      ].filter(Boolean).join(', ')

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !label) {
        return null
      }

      return {
        latitude,
        longitude,
        label,
        id: `${properties.osm_type || 'place'}-${properties.osm_id || label}`,
      }
    })
    .filter(Boolean)
}

function distanceInKilometers(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const latitudeDifference = radians(to.latitude - from.latitude)
  const longitudeDifference = radians(to.longitude - from.longitude)
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.latitude))
      * Math.cos(radians(to.latitude))
      * Math.sin(longitudeDifference / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function formatAddress(tags) {
  if (tags['addr:full']) return tags['addr:full']

  const street = [
    tags['addr:housenumber'],
    tags['addr:street'],
  ].filter(Boolean).join(' ')
  const address = [
    street,
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:state'],
  ].filter(Boolean).join(', ')

  return address || 'Address not provided in the map listing.'
}

function mapFacility(element, origin) {
  const tags = element.tags || {}
  const latitude = Number(element.lat ?? element.center?.lat)
  const longitude = Number(element.lon ?? element.center?.lon)

  if (!tags.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  const phone = tags['contact:phone'] || tags.phone
  const osmType = element.type === 'relation' ? 'relation' : element.type

  return {
    id: `${osmType}-${element.id}`,
    name: tags.name,
    address: formatAddress(tags),
    distance: distanceInKilometers(origin, { latitude, longitude }),
    latitude,
    longitude,
    phone: phone || '',
    updatedAt: element.timestamp || '',
    mapUrl: `https://www.openstreetmap.org/${osmType}/${element.id}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  }
}

async function searchOpenMapFacilities(location) {
  const query = [
    '[out:json][timeout:20];',
    '(',
    `nwr(around:${SEARCH_RADIUS_METERS},${location.latitude},${location.longitude})`,
    '[amenity~"^(hospital|clinic|doctors|health_post)$"];',
    `nwr(around:${SEARCH_RADIUS_METERS},${location.latitude},${location.longitude})`,
    '[healthcare~"^(hospital|clinic|doctor|health_post|centre)$"];',
    ');out center meta tags;',
  ].join('')
  let lastError

  for (const endpoint of OVERPASS_URLS) {
    try {
      const url = new URL(endpoint)
      url.searchParams.set('data', query)
      const data = await fetchJson(url)
      const byId = new Map((data.elements || [])
        .map((element) => mapFacility(element, location))
        .filter(Boolean)
        .map((facility) => [facility.id, facility]))
      return Array.from(byId.values())
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 30)
    } catch (error) {
      lastError = error
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error('The map search took too long to respond. Please try again.')
  }
  throw new Error('Nearby map listings are temporarily unavailable. Please try again or use the official registry.')
}

export async function searchNearbyFacilities(location) {
  let registryError = 'The official facility registry could not be reached.'
  try {
    const registry = await fetchJson(`${API_BASE_URL}/api/facilities/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    })
    return {
      facilities: registry.facilities || [],
      source: 'official_registry',
      registryAvailable: true,
      registryMessage: '',
    }
  } catch (error) {
    registryError = error.message || registryError
  }

  try {
    const facilities = await searchOpenMapFacilities(location)
    return {
      facilities,
      source: 'openstreetmap',
      registryAvailable: false,
      registryMessage: registryError,
    }
  } catch (error) {
    throw new Error(
      `${error.message || 'Nearby map listings are unavailable.'} `
      + `Official registration search is also unavailable: ${registryError}`,
    )
  }
}
