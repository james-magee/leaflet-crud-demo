import L, { LatLngTuple, popup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocationInfo } from "./types";
import { locationMap, defaultLocationInfo } from "./locations";
import newColor from "./colors";
import { Point, MapRect } from "./types";
import {
  rotateRectangle,
  growRectangle,
  pointInPolygon,
  squareAtPoint,
  translatePolygon,
} from "./transforms";

class LocationViewer {
  static currentViewer: LocationViewer | null;

  div: HTMLDivElement;
  mapDiv: HTMLDivElement;
  leaflet: L.Map | null;
  locationInfo: LocationInfo;
  figures: MapRect[];
  focusedFigureIndex: number | null;
  mode: "view" | "draw";
  // class MapArea extends HTMLDivElement {
  // note: MapArea has-a HTMLDivElement instead of is-a (extending) it
  //       because support isn't as common for extending dom node types
  openHt = "500px";
  closedHt = "0px";

  constructor(location: string) {
    if (!Object.keys(locationMap).includes(location)) {
      console.log(`using default... ${location} not found`);
      this.locationInfo = defaultLocationInfo;
    } else {
      console.log(`using ${location}`);
      this.locationInfo = locationMap[location]!;
    }
    this.div = document.createElement("div");
    this.div.className = "maparea";
    this.mapDiv = document.createElement("div");
    this.mapDiv.id = "map";
    this.leaflet = null;
    this.figures = [];
    this.focusedFigureIndex = null;
    this.mode = "view";
    LocationViewer.currentViewer = null;

    // bind `this`
    this.toggleMap = this.toggleMap.bind(this);
    this.attachMap = this.attachMap.bind(this);
    this.detachMap = this.detachMap.bind(this);
    this.updateFigure = this.updateFigure.bind(this);
    this.addFigure = this.addFigure.bind(this);
  }

  addFigure(
    pts: Point[],
    fillColor: string,
    borderColor?: string,
    popupContent?: string,
    popupDefaultOpen: boolean = false,
  ): MapRect {
    if (!this.leaflet) throw Error("leaflet uninitialized");
    if (this.figures.some((f) => f.fillColor === fillColor))
      throw Error(`color ${fillColor} already in use.`);
    const polygon = L.polygon(pts, {
      fillColor: fillColor,
      color: borderColor ?? fillColor,
    });
    if (popupContent) {
      polygon.bindPopup(popupContent).on("add", () => {
        if (popupDefaultOpen) polygon.openPopup();
      });
    }
    polygon.addTo(this.leaflet);
    const figure = {
      polygon: polygon,
      fillColor: fillColor,
    };
    this.figures.push(figure);
    return figure;
  }

  updateFigure(
    index: number,
    {
      newPoints,
      newOptions,
    }: {
      newPoints?: Point[];
      newOptions?: L.PolylineOptions;
    },
  ) {
    if (!this.leaflet) throw Error("leaflet uninitialized.");
    let options = {
      color: this.figures[index]!.borderColor,
      fillColor: this.figures[index]!.fillColor,
      ...(newOptions ?? {}),
    };
    const points =
      newPoints ??
      (this.figures[index]!.polygon.getLatLngs()[0] as L.LatLng[]).map((o) => ({
        lat: o.lat,
        lng: o.lng,
      }));
    const polygon = L.polygon(points, options);
    const figure = {
      fillColor: options.fillColor!,
      borderColor: options.color!,
      polygon: polygon,
    };
    this.figures[index]!.polygon.remove();
    this.figures[index]! = figure;
    polygon.addTo(this.leaflet);
  }

  attachMap() {
    if (LocationViewer.currentViewer) return;
    this.div.appendChild(this.mapDiv);

    console.log("MAP ATTACHED");
    const leafletMap = L.map("map", { preferCanvas: false });
    this.leaflet = leafletMap;
    leafletMap.setView([this.locationInfo.lat, this.locationInfo.lng]);
    leafletMap.setZoom(this.locationInfo.zoom ?? 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(leafletMap);

    // draw the polygons; make sure to name them so they can be removed
    if (this.locationInfo.figs) {
      for (const figure of this.locationInfo.figs) {
        if (figure.popupContent) {
          this.addFigure(
            figure.coords,
            figure.color,
            figure.color,
            figure.popupContent,
            figure.popupDefaultOpen,
          );
        } else {
          this.addFigure(figure.coords, figure.color);
        }
      }
    }

    // spawn and focus command, and coord printing
    // clicking on polygon will focus it
    // clicking anywhere will unfocus
    // when there is no focused polygon, clicking outside of any existing one will create a new rect.
    // --
    // if not in edit mode, print coordinates of click
    leafletMap.on("click", (event: L.LeafletMouseEvent) => {
      if (this.mode === "view") {
        console.log(`Click at: ${event.latlng.lat}, ${event.latlng.lng}`);
        return;
      }
      const { lat, lng } = event.latlng;
      const clickPt: Point = { lat, lng };
      for (let i = 0; i < this.figures.length; i++) {
        const figure = this.figures[i]!;
        if (this.focusedFigureIndex === i) {
          this.updateFigure(i, {
            newOptions: { color: figure.fillColor },
          });
          this.focusedFigureIndex = null;
          return;
        }
        const points = (figure.polygon.getLatLngs()[0] as L.LatLng[]).map(
          (o) => ({ lat: o.lat, lng: o.lng }),
        );
        if (pointInPolygon(clickPt, points)) {
          this.updateFigure(i, {
            newOptions: { color: "red", fillColor: figure.fillColor },
          });
          this.focusedFigureIndex = i;
          return;
        }
      }
      const color = newColor();
      this.addFigure(squareAtPoint(clickPt), color, color);
      return;
    });

    // printing command -- "P"
    // console.log the coords of the rectangles (color-coded)
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (this.mode === "view") return;
      if (e.key !== "P") return;
      for (const figure of this.figures) {
        const coords = (figure.polygon.getLatLngs()[0] as L.LatLng[])
          .map((o) => [o.lat, o.lng])
          .flat();
        console.log(
          `%c${coords[0]} ${coords[1]}\n${coords[2]} ${coords[3]}\n${coords[4]} ${coords[5]}\n${coords[6]} ${coords[7]}\n`,
          `color: ${figure.fillColor}; font-size: medium`,
        );
      }
    });

    // rotation command -- "ArrowRight" and "ArrowLeft"
    // use right arrow for clockwise, left arrow for counterclockwise
    document.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (this.mode === "view") return;
        if (!(e.key === "ArrowRight" || e.key === "ArrowLeft")) return;
        if (this.focusedFigureIndex === null) return;
        const angle = e.key === "ArrowRight" ? 1 : -1;
        const pts = (
          this.figures[
            this.focusedFigureIndex
          ]!.polygon.getLatLngs()[0] as L.LatLng[]
        ).map((o: L.LatLng) => ({
          lat: o.lat,
          lng: o.lng,
        }));
        this.updateFigure(this.focusedFigureIndex, {
          newPoints: rotateRectangle(pts, angle),
        });
        e.stopPropagation();
      },
      { capture: true },
    );

    // Translation command -- WASD
    // (W-up, A-left, S-down, D-right)
    document.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (this.mode === "view") return;
        let north, east;
        if (!"wasd".includes(e.key)) return;
        if (this.focusedFigureIndex === null) return;
        const oldPoints = (
          this.figures[
            this.focusedFigureIndex
          ]!.polygon.getLatLngs()[0] as L.LatLng[]
        ).map((o) => ({ lat: o.lat, lng: o.lng }));
        if (e.key === "w") {
          north = 1;
          east = 0;
        } else if (e.key === "a") {
          north = 0;
          east = -1;
        } else if (e.key === "s") {
          north = -1;
          east = 0;
        } else {
          north = 0;
          east = 1;
        }
        this.updateFigure(this.focusedFigureIndex, {
          newPoints: translatePolygon(oldPoints, north, east),
        });
      },
      { capture: true },
    );

    // Scaling command
    // 1-increase length of first side, 2-increase length of second side
    // 3-decreaes                       4-decrease
    document.addEventListener(
      "keydown",
      (e) => {
        if (this.mode === "view") return;
        if (this.focusedFigureIndex === null) return;
        if (!"1234".includes(e.key)) return;
        const points = (
          this.figures[
            this.focusedFigureIndex
          ]!.polygon.getLatLngs()[0] as L.LatLng[]
        ).map((o) => ({ lat: o.lat, lng: o.lng }));
        let scaleA, scaleB;
        if (e.key === "1") {
          scaleA = 1;
          scaleB = 0;
        } else if (e.key === "2") {
          scaleA = -1;
          scaleB = 0;
        } else if (e.key === "3") {
          scaleA = 0;
          scaleB = 1;
        } else {
          scaleA = 0;
          scaleB = -1;
        }
        this.updateFigure(this.focusedFigureIndex, {
          newPoints: growRectangle(points, scaleA, scaleB),
        });
      },
      { capture: true },
    );

    // Removal command
    // "D" (uppercase)
    document.addEventListener(
      "keydown",
      (e) => {
        if (this.mode === "view") return;
        if (this.focusedFigureIndex === null) return;
        if (e.key !== "D") return;
        const figure = this.figures[this.focusedFigureIndex!]!;
        this.figures = this.figures.filter(
          (fig) => fig.fillColor !== figure.fillColor,
        );
        figure.polygon.remove();
        this.focusedFigureIndex = null;
      },
      { capture: true },
    );

    // toggle view and draw mode
    // "."
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === ".") this.mode = this.mode === "view" ? "draw" : "view";
        if (this.mode === "draw") return;
        if (this.focusedFigureIndex === null) return;
        this.updateFigure(this.focusedFigureIndex!, {
          newOptions: {
            color: this.figures[this.focusedFigureIndex!]!.fillColor,
          },
        });
        this.focusedFigureIndex = null;
      },
      { capture: true },
    );

    LocationViewer.currentViewer = this;
  }

  detachMap() {
    if (LocationViewer.currentViewer != this || !this.leaflet) return;
    this.leaflet.remove();
    this.leaflet.off();
    this.leaflet = null;
    this.figures = [];
    this.focusedFigureIndex = null;
    this.div.removeChild(this.mapDiv);
  }

  toggleMap() {
    if (LocationViewer.currentViewer === this) {
      this.detachMap();
      this.div.className = "maparea";
      LocationViewer.currentViewer = null;
      return;
    } else if (LocationViewer.currentViewer) {
      LocationViewer.currentViewer.toggleMap();
    }
    this.attachMap();
    this.div.className = this.div.className.concat(" open");
    LocationViewer.currentViewer = this;
  }

  attach(node: Element) {
    node.appendChild(this.div);
  }
}

const addClickListener = () => {
  const tbody = document.querySelector("tbody");
  if (!tbody) {
    return;
  }
  for (const rowIndex in [...Array(tbody.childElementCount).keys()]) {
    if (!tbody.children[rowIndex]) {
      return;
    }
    const tableRow = tbody.children[rowIndex]!;
    if (tableRow.children.length <= 2) {
      return;
    }
    if (!tableRow.children[2]) {
      return;
    }
    if (!("innerHTML" in tableRow.children[2])) {
      return;
    }
    const locationTd = tableRow.children[2]!;
    const location = locationTd.innerHTML.trim();
    locationTd.innerHTML = "";
    const btn = document.createElement("button");
    btn.innerHTML = location;
    locationTd.appendChild(btn);
    const mapArea = new LocationViewer(location);
    mapArea.attach(locationTd);
    btn.addEventListener("click", mapArea.toggleMap);
  }
};

// TODO: create a version that adds in case mutation already happened
const observer = new MutationObserver(() => {
  const tbody = document.querySelector("tbody");
  if (tbody) {
    observer.disconnect();
    addClickListener();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
