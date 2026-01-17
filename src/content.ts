import L, { LatLngTuple, popup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocationInfo, MapRect } from "./types";
import { locationMap, defaultLocationInfo } from "./locations";
import newColor from "./colors";
import { Point, Rect } from "./types";
import { ModeControl } from "./control";
import {
  rotateRectangle,
  growRectangle,
  pointInPolygon,
  squareAtPoint,
  translatePolygon,
} from "./transforms";

/**
 * This class manages an individual location tab and its
 * corresponding leaflet map instance
 */
class LocationViewer {
  // note: LocationViewer has-a HTMLDivElement instead of is-a (extending) it
  //       because support isn't as common for extending dom node types
  static currentViewer: LocationViewer | null;

  div: HTMLDivElement;
  mapDiv: HTMLDivElement;
  leaflet: L.Map | null;
  locationInfo: LocationInfo;
  mapRects: MapRect[];
  cachedRects: Rect[];
  focusedFigureIndex: number | null;
  modeControl: ModeControl | null;
  associatedListeners: [string, (e: Event) => void, boolean][];
  mode: "view" | "draw";
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
    this.mapRects = [];
    /** persist rects here */
    this.cachedRects = [];
    this.focusedFigureIndex = null;
    this.mode = "view";

    /** for removing event listeners which hold references */
    this.associatedListeners = [];

    /** for showing mode (view/draw) */
    this.modeControl = null;
    LocationViewer.currentViewer = null;

    // bind `this`
    this.toggleMap = this.toggleMap.bind(this);
    this.attachMap = this.attachMap.bind(this);
    this.detachMap = this.detachMap.bind(this);
    this.updateFigure = this.updateFigure.bind(this);
    this.addRect = this.addRect.bind(this);
    this.deleteFigure = this.deleteFigure.bind(this);
    this.toggleLabel = this.toggleLabel.bind(this);
    this.addListener = this.addListener.bind(this);
  }

  addListener(
    eventName: keyof DocumentEventMap,
    handler: (e: any) => any, // weirdness with specifying event type...
    capture: boolean = true,
  ) {
    document.addEventListener(eventName, handler, { capture: capture });
    this.associatedListeners.push([eventName, handler, capture]);
  }

  addRect(rect: Rect): MapRect {
    if (!this.leaflet) throw new Error("leaflet uninitialized");
    if (this.mapRects.some((f) => f.rect.color === rect.color))
      throw new Error(`color ${rect.color} already in use.`);
    const polygon = L.polygon(rect.points, {
      fillColor: rect.color,
      color: rect.color,
      fillOpacity: 0.6,
      opacity: 0.6,
    });
    if (rect.popupContent) {
      polygon.bindPopup(rect.popupContent).on("add", () => {
        if (rect.popupDefaultOpen) polygon.openPopup();
      });
    }
    polygon.addTo(this.leaflet);
    const mapRect = {
      polygon: polygon,
      rect: rect,
    };
    this.mapRects.push(mapRect);
    return mapRect;
  }

  updateFigure(index: number, newRect: Rect) {
    if (!this.leaflet) throw new Error("leaflet uninitialized.");
    if (index >= this.mapRects.length || index < 0)
      throw new Error(
        `invalid index ${index} for number of mapRects: ${index}`,
      );

    // create new polygon, mapRect
    const polygon = L.polygon(newRect.points, {
      color: newRect.redBorder ? "red" : newRect.color,
      fillColor: newRect.color,
      opacity: newRect.redBorder ? 1 : 0.6,
      fillOpacity: 0.6,
    });
    const mapRect = {
      polygon: polygon,
      rect: newRect,
    };
    polygon.addTo(this.leaflet);

    // clean up / remove old polygon
    this.mapRects[index]!.polygon.remove();
    this.mapRects[index]! = mapRect;
  }

  deleteFigure(index: number) {
    const figureToRemove = this.mapRects[index]!;
    figureToRemove.polygon.remove();
    this.mapRects = this.mapRects.splice(index, 1);
    this.focusedFigureIndex = null;
  }

  toggleLabel(text: string) {
    if (this.modeControl) {
      this.modeControl.setText(text);
      return;
    }
    const control = new ModeControl({ position: "bottomleft" }, "DRAW MODE");
    this.modeControl = control;
    this.leaflet!.addControl(control);
  }

  attachMap() {
    if (LocationViewer.currentViewer) return;
    this.div.appendChild(this.mapDiv);
    const leafletMap = L.map("map", { preferCanvas: false });
    this.leaflet = leafletMap;
    leafletMap.setView([this.locationInfo.lat, this.locationInfo.lng]);
    leafletMap.setZoom(this.locationInfo.zoom ?? 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(leafletMap);

    // if existing polygons were added in a previous session, add them here
    if (this.cachedRects.length > 0) {
      this.cachedRects.forEach(this.addRect);
    }
    // draw the polygons; make sure to name them so they can be removed
    else if (this.locationInfo.rects) {
      this.locationInfo.rects.forEach(this.addRect);
    }

    if (this.modeControl) {
      const modeText = this.mode === "view" ? "VIEW MODE" : "DRAW MODE";
      this.leaflet.addControl(this.modeControl);
      this.modeControl.setText(modeText);
    }

    // spawn and focus command, and coord printing
    // clicking on polygon will focus it
    // clicking anywhere will unfocus
    // when there is no focused polygon, clicking outside of any existing one will create a new rect.
    // --
    // if not in edit mode, print coordinates of click
    leafletMap.on("click", (event: L.LeafletMouseEvent) => {
      // leaflet handles listener cleanup

      if (this.mode === "view") {
        console.log(`Click at: ${event.latlng.lat}, ${event.latlng.lng}`);
        return;
      }
      const { lat, lng } = event.latlng;
      const clickPt: Point = { lat, lng };

      // first check for intersection
      for (let i = 0; i < this.mapRects.length; i++) {
        const mapRect = this.mapRects[i]!;
        const points = mapRect.rect.points;
        // const points = (mapRect.polygon.getLatLngs()[0] as L.LatLng[]).map(
        //   (o) => ({ lat: o.lat, lng: o.lng }),
        // );
        if (pointInPolygon(clickPt, points)) {
          if (this.focusedFigureIndex === i) {
            // deselect current, end
            const newRect = { ...this.mapRects[this.focusedFigureIndex]!.rect };
            newRect.redBorder = false;
            this.updateFigure(this.focusedFigureIndex, newRect);
            this.focusedFigureIndex = null;
            return;
          } else if (this.focusedFigureIndex) {
            const newRect = { ...this.mapRects[this.focusedFigureIndex]!.rect };
            newRect.redBorder = false;
            this.updateFigure(this.focusedFigureIndex, newRect);
            this.focusedFigureIndex = null;
          }
          // if (this.focusedFigureIndex) {
          //   // deselect current rect
          //   const _newRect = {
          //     ...this.mapRects[this.focusedFigureIndex]!.rect,
          //   };
          //   _newRect.redBorder = false;
          //   this.updateFigure(this.focusedFigureIndex, _newRect);
          // }
          const newRect = { ...mapRect.rect };
          newRect.redBorder = true;
          this.updateFigure(i, newRect);
          this.focusedFigureIndex = i;
          return;
        }
      }

      // case: user clicks outside of all polygons while one is focused
      if (this.focusedFigureIndex) {
        const newRect = { ...this.mapRects[this.focusedFigureIndex]!.rect };
        newRect.redBorder = false;
        this.updateFigure(this.focusedFigureIndex, newRect);
        this.focusedFigureIndex = null;
        return;
      }

      // spawn new rect
      const color = newColor();
      const newRect: Rect = {
        points: squareAtPoint(clickPt),
        color: color,
      };
      this.addRect(newRect);
    });

    // printing command -- "P"
    // console.log the coords of the rectangles (color-coded)
    const printHandler = ((e: KeyboardEvent) => {
      if (this.mode === "view") return;
      if (e.key !== "P") return;
      for (const figure of this.mapRects) {
        const coords = (figure.polygon.getLatLngs()[0] as L.LatLng[])
          .map((o) => [o.lat, o.lng])
          .flat();
        console.log(
          `%c${coords[0]} ${coords[1]}\n${coords[2]} ${coords[3]}\n${coords[4]} ${coords[5]}\n${coords[6]} ${coords[7]}\n`,
          `color: ${figure.rect.color}; font-size: medium`,
        );
      }
    }).bind(this);
    // const printHandler = printHandler.bind(this);
    this.addListener("keydown", printHandler);

    // rotation command -- "ArrowRight" and "ArrowLeft"
    // use right arrow for clockwise, left arrow for counterclockwise
    const rotationHandler = (e: KeyboardEvent) => {
      if (this.mode === "view") return;
      if (!(e.key === "ArrowRight" || e.key === "ArrowLeft")) return;
      if (this.focusedFigureIndex === null) return;
      const angle = e.key === "ArrowRight" ? 1 : -1;

      // const pts = (
      //   this.mapRects[
      //     this.focusedFigureIndex
      //   ]!.polygon.getLatLngs()[0] as L.LatLng[]
      // ).map((o: L.LatLng) => ({
      //   lat: o.lat,
      //   lng: o.lng,
      // }));

      const oldRect = this.mapRects[this.focusedFigureIndex]!.rect;
      const newRect = { ...oldRect };
      newRect.points = rotateRectangle(oldRect.points, angle);
      this.updateFigure(this.focusedFigureIndex, newRect);
      e.stopPropagation();
    };
    this.addListener("keydown", rotationHandler);

    // Translation command -- WASD
    // (W-up, A-left, S-down, D-right)
    const translateHandler = (e: KeyboardEvent) => {
      if (this.mode === "view") return;
      let north, east;
      if (!"wasd".includes(e.key)) return;
      if (this.focusedFigureIndex === null) return;
      // const oldPoints = (
      //   this.mapRects[
      //     this.focusedFigureIndex
      //   ]!.polygon.getLatLngs()[0] as L.LatLng[]
      // ).map((o) => ({ lat: o.lat, lng: o.lng }));
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

      const oldRect = this.mapRects[this.focusedFigureIndex]!.rect;
      const newRect = { ...oldRect };
      newRect.points = translatePolygon(oldRect.points, north, east);
      this.updateFigure(this.focusedFigureIndex, newRect);
    };
    this.addListener("keydown", translateHandler);

    // Scaling command
    // 1-increase length of first side, 2-increase length of second side
    // 3-decreaes                       4-decrease
    const scaleHandler = (e: KeyboardEvent) => {
      if (this.mode === "view") return;
      if (this.focusedFigureIndex === null) return;
      if (!"1234".includes(e.key)) return;
      const points = (
        this.mapRects[
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

      const oldRect = this.mapRects[this.focusedFigureIndex]!.rect;
      const newRect = { ...oldRect };
      newRect.points = growRectangle(oldRect.points, scaleA, scaleB);
      this.updateFigure(this.focusedFigureIndex, newRect);
    };
    this.addListener("keydown", scaleHandler);

    // Delete command
    // "D" (uppercase)
    const rectDeleteHandler = (e: KeyboardEvent) => {
      if (this.mode === "view") return;
      if (this.focusedFigureIndex === null) return;
      if (e.key !== "D") return;
      this.deleteFigure(this.focusedFigureIndex);
      this.focusedFigureIndex = null;
    };
    this.addListener("keydown", rectDeleteHandler);
    // document.addEventListener("keydown", rectDeleteHandler, { capture: true });
    // docuemnt.removeEventListener("keydown", rectDeleteHandler);

    // toggle view and draw mode
    // "."
    const modeToggleHandler = ((e: KeyboardEvent) => {
      console.log(" . HANDLER CALLED");
      if (e.key !== ".") return;
      console.log("at this point as well...");
      // update the current mode
      this.mode = this.mode === "view" ? "draw" : "view";
      if (this.mode === "view") this.toggleLabel("VIEW MODE");
      if (this.mode === "draw") this.toggleLabel("DRAW MODE");
      if (this.mode === "draw" || this.focusedFigureIndex === null) return;
      const oldRect = this.mapRects[this.focusedFigureIndex]!.rect;
      const newRect = { ...oldRect };
      newRect.redBorder = false;
      this.updateFigure(this.focusedFigureIndex, newRect);
      this.toggleLabel("");
      this.focusedFigureIndex = null;
    }).bind(this);
    this.addListener("keydown", modeToggleHandler);
    // document.addEventListener("keydown", modeToggleHandler, { capture: true });
    // document.removeEventListener("keydown", modeToggleHandler);

    LocationViewer.currentViewer = this;
  }

  detachMap() {
    if (LocationViewer.currentViewer != this || !this.leaflet) return;
    console.log("DETACHING...");
    this.cachedRects = this.mapRects.map((mr) => mr.rect);
    this.mapRects = [];
    this.focusedFigureIndex = null;
    this.modeControl?.remove();
    this.leaflet.remove();
    this.leaflet.off();
    this.leaflet = null;
    this.div.removeChild(this.mapDiv);
    this.associatedListeners.forEach(([eventName, handler, capture]) =>
      document.removeEventListener(eventName, handler, { capture: capture }),
    );
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
    console.log("ATTACHING...");
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
