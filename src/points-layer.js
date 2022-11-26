/**
 * @file
 *
 * Defines the {@link PointsLayer} class.
 *
 * @module points-layer
 */

import PointMarker from './point-marker';
import { clamp, objectHasProperty } from './utils';
import Konva from 'konva/lib/Core';

const defaultFontFamily = 'sans-serif';
const defaultFontSize = 10;
const defaultFontShape = 'normal';

/**
 * Creates a Konva.Layer that displays point markers against the audio
 * waveform.
 *
 * @class
 * @alias PointsLayer
 *
 * @param {Peaks} peaks
 * @param {WaveformOverview|WaveformZoomView} view
 * @param {Boolean} allowEditing
 */

function PointsLayer(peaks, view, allowEditing) {
  this._peaks        = peaks;
  this._view         = view;
  this._allowEditing = allowEditing;
  this._pointMarkers = {};
  this._layer        = new Konva.Layer();

  this._onPointsDrag = this._onPointsDrag.bind(this);

  this._onPointHandleClick       = this._onPointHandleClick.bind(this);
  this._onPointHandleDblClick    = this._onPointHandleDblClick.bind(this);
  this._onPointHandleDragStart   = this._onPointHandleDragStart.bind(this);
  this._onPointHandleDragMove    = this._onPointHandleDragMove.bind(this);
  this._onPointHandleDragEnd     = this._onPointHandleDragEnd.bind(this);
  this._pointHandleDragBoundFunc = this._pointHandleDragBoundFunc.bind(this);
  this._onPointHandleMouseEnter  = this._onPointHandleMouseEnter.bind(this);
  this._onPointHandleMouseLeave  = this._onPointHandleMouseLeave.bind(this);
  this._onPointHandleContextMenu = this._onPointHandleContextMenu.bind(this);

  this._onPointsUpdate    = this._onPointsUpdate.bind(this);
  this._onPointsAdd       = this._onPointsAdd.bind(this);
  this._onPointsRemove    = this._onPointsRemove.bind(this);
  this._onPointsRemoveAll = this._onPointsRemoveAll.bind(this);

  this._peaks.on('points.update', this._onPointsUpdate);
  this._peaks.on('points.add', this._onPointsAdd);
  this._peaks.on('points.remove', this._onPointsRemove);
  this._peaks.on('points.remove_all', this._onPointsRemoveAll);

  this._peaks.on('points.dragstart', this._onPointsDrag);
  this._peaks.on('points.dragmove', this._onPointsDrag);
  this._peaks.on('points.dragend', this._onPointsDrag);
}

/**
 * Adds the layer to the given {Konva.Stage}.
 *
 * @param {Konva.Stage} stage
 */

PointsLayer.prototype.addToStage = function(stage) {
  stage.add(this._layer);
};

PointsLayer.prototype.enableEditing = function(enable) {
  this._allowEditing = enable;
};

PointsLayer.prototype.formatTime = function(time) {
  return this._view.formatTime(time);
};

PointsLayer.prototype._onPointsUpdate = function(point) {
  const frameStartTime = this._view.getStartTime();
  const frameEndTime   = this._view.getEndTime();

  this._removePoint(point);

  if (point.isVisible(frameStartTime, frameEndTime)) {
    this._addPointMarker(point);
  }

  this.updatePoints(frameStartTime, frameEndTime);
};

PointsLayer.prototype._onPointsAdd = function(points) {
  const self = this;

  const frameStartTime = self._view.getStartTime();
  const frameEndTime   = self._view.getEndTime();

  points.forEach(function(point) {
    if (point.isVisible(frameStartTime, frameEndTime)) {
      self._addPointMarker(point);
    }
  });

  self.updatePoints(frameStartTime, frameEndTime);
};

PointsLayer.prototype._onPointsRemove = function(points) {
  const self = this;

  points.forEach(function(point) {
    self._removePoint(point);
  });
};

PointsLayer.prototype._onPointsRemoveAll = function() {
  this._layer.removeChildren();
  this._pointMarkers = {};
};

/**
 * Creates the Konva UI objects for a given point.
 *
 * @private
 * @param {Point} point
 * @returns {PointMarker}
 */

PointsLayer.prototype._createPointMarker = function(point) {
  const editable = this._allowEditing && point.editable;

  const marker = this._peaks.options.createPointMarker({
    point:      point,
    draggable:  editable,
    color:      point.color ? point.color : this._peaks.options.pointMarkerColor,
    fontFamily: this._peaks.options.fontFamily || defaultFontFamily,
    fontSize:   this._peaks.options.fontSize || defaultFontSize,
    fontStyle:  this._peaks.options.fontStyle || defaultFontShape,
    layer:      this,
    view:       this._view.getName()
  });

  return new PointMarker({
    point:         point,
    draggable:     editable,
    marker:        marker,
    onClick:       this._onPointHandleClick,
    onDblClick:    this._onPointHandleDblClick,
    onDragStart:   this._onPointHandleDragStart,
    onDragMove:    this._onPointHandleDragMove,
    onDragEnd:     this._onPointHandleDragEnd,
    dragBoundFunc: this._pointHandleDragBoundFunc,
    onMouseEnter:  this._onPointHandleMouseEnter,
    onMouseLeave:  this._onPointHandleMouseLeave,
    onContextMenu: this._onPointHandleContextMenu
  });
};

PointsLayer.prototype.getHeight = function() {
  return this._view.getHeight();
};

/**
 * Adds a Konva UI object to the layer for a given point.
 *
 * @private
 * @param {Point} point
 * @returns {PointMarker}
 */

PointsLayer.prototype._addPointMarker = function(point) {
  const pointMarker = this._createPointMarker(point);

  this._pointMarkers[point.id] = pointMarker;

  pointMarker.addToLayer(this._layer);

  return pointMarker;
};

PointsLayer.prototype._onPointsDrag = function(event) {
  this._updatePoint(event.point);
};

/**
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleDragMove = function(event, point) {
  const pointMarker = this._pointMarkers[point.id];

  const markerX = pointMarker.getX();

  const offset = markerX + pointMarker.getWidth();

  point._setTime(this._view.pixelOffsetToTime(offset));

  pointMarker.timeUpdated(point.time);

  this._peaks.emit('points.dragmove', {
    point: point,
    evt: event.evt
  });
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleMouseEnter = function(event, point) {
  this._peaks.emit('points.mouseenter', {
    point: point,
    evt: event.evt
  });
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleMouseLeave = function(event, point) {
  this._peaks.emit('points.mouseleave', {
    point: point,
    evt: event.evt
  });
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleClick = function(event, point) {
  this._peaks.emit('points.click', {
    point: point,
    evt: event.evt
  });
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleDblClick = function(event, point) {
  this._peaks.emit('points.dblclick', {
    point: point,
    evt: event.evt
  });
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleDragStart = function(event, point) {
  this._dragPointMarker = this._pointMarkers[point.id];

  this._peaks.emit('points.dragstart', {
    point: point,
    evt: event.evt
  });
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleDragEnd = function(event, point) {
  this._dragPointMarker = null;

  this._peaks.emit('points.dragend', {
    point: point,
    evt: event.evt
  });
};

PointsLayer.prototype._pointHandleDragBoundFunc = function(pos) {
  // Allow the marker to be moved horizontally but not vertically.
  return {
    x: clamp(pos.x, 0, this._view.getWidth()),
    y: this._dragPointMarker.getAbsolutePosition().y
  };
};

/**
 * @param {KonvaEventObject} event
 * @param {Point} point
 */

PointsLayer.prototype._onPointHandleContextMenu = function(event, point) {
  this._peaks.emit('points.contextmenu', {
    point: point,
    evt: event.evt
  });
};

/**
 * Updates the positions of all displayed points in the view.
 *
 * @param {Number} startTime The start of the visible range in the view,
 *   in seconds.
 * @param {Number} endTime The end of the visible range in the view,
 *   in seconds.
 */

PointsLayer.prototype.updatePoints = function(startTime, endTime) {
  // Update all points in the visible time range.
  const points = this._peaks.points.find(startTime, endTime);

  points.forEach(this._updatePoint.bind(this));

  // TODO: in the overview all points are visible, so no need to check
  this._removeInvisiblePoints(startTime, endTime);
};

/**
 * @private
 * @param {Point} point
 */

PointsLayer.prototype._updatePoint = function(point) {
  const pointMarker = this._findOrAddPointMarker(point);

  const pointMarkerOffset = this._view.timeToPixels(point.time);

  const pointMarkerX = pointMarkerOffset - this._view.getFrameOffset();

  pointMarker.setX(pointMarkerX);
};

/**
 * @private
 * @param {Point} point
 * @return {PointMarker}
 */

PointsLayer.prototype._findOrAddPointMarker = function(point) {
  let pointMarker = this._pointMarkers[point.id];

  if (!pointMarker) {
    pointMarker = this._addPointMarker(point);
  }

  return pointMarker;
};

/**
 * Remove any points that are not visible, i.e., are outside the given time
 * range.
 *
 * @private
 * @param {Number} startTime The start of the visible time range, in seconds.
 * @param {Number} endTime The end of the visible time range, in seconds.
 * @returns {Number} The number of points removed.
 */

PointsLayer.prototype._removeInvisiblePoints = function(startTime, endTime) {
  let count = 0;

  for (let pointId in this._pointMarkers) {
    if (objectHasProperty(this._pointMarkers, pointId)) {
      const point = this._pointMarkers[pointId].getPoint();

      if (!point.isVisible(startTime, endTime)) {
        this._removePoint(point);
        count++;
      }
    }
  }

  return count;
};

/**
 * Removes the UI object for a given point.
 *
 * @private
 * @param {Point} point
 */

PointsLayer.prototype._removePoint = function(point) {
  const pointMarker = this._pointMarkers[point.id];

  if (pointMarker) {
    pointMarker.destroy();
    delete this._pointMarkers[point.id];
  }
};

/**
 * Toggles visibility of the points layer.
 *
 * @param {Boolean} visible
 */

PointsLayer.prototype.setVisible = function(visible) {
  this._layer.setVisible(visible);
};

PointsLayer.prototype.destroy = function() {
  this._peaks.off('points.update', this._onPointsUpdate);
  this._peaks.off('points.add', this._onPointsAdd);
  this._peaks.off('points.remove', this._onPointsRemove);
  this._peaks.off('points.remove_all', this._onPointsRemoveAll);
  this._peaks.off('points.dragstart', this._onPointsDrag);
  this._peaks.off('points.dragmove', this._onPointsDrag);
  this._peaks.off('points.dragend', this._onPointsDrag);
};

PointsLayer.prototype.fitToView = function() {
  for (let pointId in this._pointMarkers) {
    if (objectHasProperty(this._pointMarkers, pointId)) {
      const pointMarker = this._pointMarkers[pointId];

      pointMarker.fitToView();
    }
  }
};

PointsLayer.prototype.draw = function() {
  this._layer.draw();
};

export default PointsLayer;
