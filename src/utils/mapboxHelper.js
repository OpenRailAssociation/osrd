import { MapController } from 'react-map-gl';

/**
 * This class allows binding keyboard events to react-map-gl. Since those events are not supported
 * by the lib, you can instanciate this KeyDownMapController and give it to your ReactMapGL
 * component as the `controller` prop, and keep its handler function up to date with an effect.
 */
export class KeyDownMapController extends MapController {
  constructor(handler) {
    super();
    this.setHandler(handler);
  }

  setHandler(handler) {
    this.handler = handler;
  }

  handleEvent(event) {
    if (this.handler && event.type === 'keydown') {
      this.handler(event);
    }

    return super.handleEvent(event);
  }
}
