/**
 * Shared Mapbox configuration — single source of truth for all map instances.
 */
import mapboxgl from "mapbox-gl";

export const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY29ubmVjdHdpdGhyYmFsYSIsImEiOiJjbWxrc3QzZDgwMDVqM2VzY2phb2FjOW50In0.JF_UToZxKEOs0i01BA_esw";

export const MAPBOX_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

export const NAV_CONTROL_POSITION: mapboxgl.ControlPosition = "top-right";

/**
 * Initialise access token. Call once before creating a Map instance.
 */
export function initMapbox() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}
