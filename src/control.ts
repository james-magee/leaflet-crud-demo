import L, { LatLngTuple, popup } from "leaflet";

export class ModeControl extends L.Control {
  _container: HTMLDivElement | null = null;
  initText: string;

  constructor(superArgs: object, initText: string) {
    super(superArgs);
    this.initText = initText;
  }

  onAdd() {
    this._container = L.DomUtil.create(
      "div",
      "leaflet-control map-mode-indicator",
    );
    this._container.innerText = this.initText;
    return this._container;
  }

  setText(text: string) {
    if (!this._container) throw new Error();
    this._container.innerText = text;
  }
}
