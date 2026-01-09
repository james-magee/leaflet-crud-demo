import L from "leaflet";


export interface Point {
  lat: number;
  lng: number;
}

/**
 * used to create MapRects
 * at creation, border/fill color will be the same
 */
export interface LocationRect {
  coords: Point[];
  color: string;
  popupContent?: string;
  popupDefaultOpen?: boolean = false;
};

/**
 * used to keep track of the figures drawn on
 * the leaflet map instance
 */
export interface MapRect {
  polygon: L.Polygon;
  fillColor: string;
  borderColor?: string;
}


export interface LocationInfo {
  name: string;
  lat: number;
  lng: number;
  zoom?: number = 19;
  figs?: LocationRect[] = [];
};
