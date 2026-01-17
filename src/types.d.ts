import L from "leaflet";


export interface Point {
  lat: number;
  lng: number;
}

/**
 * used to create MapRects
 * at creation, border/fill color will be the same
 */
export interface Rect {
  points: Point[];
  color: string;
  popupContent?: string;
  popupDefaultOpen?: boolean = false;

  // used to indicate editing
  redBorder?: boolean = false;

  // defaulted polygon params
  opacity?: number = 0.6;
};


// export interface Rect {
//   /** rectangles will be a single solid shade */
//   points: Point[];
//   color: string;
//   opacity?: number = 0.6;
//   popupContent?: string;
//   popupDefaultOpen?: boolean = false;
// }

/**
 * after the rectangle has been added to a map,
 * a reference to it is held here
 */
export interface MapRect {
  polygon: L.Polygon;
  rect: Rect;
}

export interface LocationInfo {
  name: string;
  lat: number;
  lng: number;
  zoom?: number = 19;
  rects?: Rect[] = [];
};
