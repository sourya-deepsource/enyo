/**
* This module has no exports. It merely extends {@link module:enyo/gesture} to enable touch events.
*
* @private
* @module enyo/touch
*/
require('enyo');

var
	utils = require('./utils'),
	gesture = require('./gesture'),
	dispatcher = require('./dispatcher'),
	platform = require('./platform');

var
	Dom = require('./dom'),
	Job = require('./job');

function dispatch (e) {
	return dispatcher.dispatch(e);
}

/**
* @private
*/
Dom.requiresWindow(function() {

	/**
	* Add touch-specific gesture feature
	* 
	* @private
	*/

	/**
	* @private
	*/
	var oldevents = gesture.events;
	
	/**
	* @ignore
	*/
	gesture.events.touchstart = function (e) {
		// for duration of this touch, only handle touch events.  Old event
		// structure will be restored during touchend.
		gesture.events = touchGesture;
		gesture.events.touchstart(e);
	};
	
	/**
	* @ignore
	*/
	var touchGesture = {

		/**
		* @ignore
		* @private
		*/
		_touchCount: 0,

		/**
		* @ignore
		* @private
		*/
		touchstart: function (e) {
			this._touchCount += e.changedTouches.length;
			this.excludedTarget = null;
			var event = this.makeEvent(e);
			//store the finger which generated the touchstart event
			this.currentIdentifier = event.identifier;
			gesture.down(event);
			// generate a new event object since over is a different event
			event = this.makeEvent(e);
			this.overEvent = event;
			gesture.over(event);
		},

		/**
		* @ignore
		* @private
		*/
		touchmove: function (e) {
			Job.stop('resetGestureEvents');
			// NOTE: allow user to supply a node to exclude from event
			// target finding via the drag event.
			var de = gesture.drag.dragEvent;
			this.excludedTarget = de && de.dragInfo && de.dragInfo.node;
			var event = this.makeEvent(e);
			// do not generate the move event if this touch came from a different
			// finger than the starting touch
			if (this.currentIdentifier !== event.identifier) {
				return;
			}
			gesture.move(event);
			// prevent default document scrolling if enyo.bodyIsFitting == true
			// avoid window scrolling by preventing default on this event
			// note: this event can be made unpreventable (native scrollers do this)
			if (Dom.bodyIsFitting) {
				e.preventDefault();
			}
			// synthesize over and out (normally generated via mouseout)
			if (this.overEvent && this.overEvent.target != event.target) {
				this.overEvent.relatedTarget = event.target;
				event.relatedTarget = this.overEvent.target;
				gesture.out(this.overEvent);
				gesture.over(event);
			}
			this.overEvent = event;
		},

		/**
		* @ignore
		* @private
		*/
		touchend: function (e) {
			gesture.up(this.makeEvent(e));
			// NOTE: in touch land, there is no distinction between
			// a pointer enter/leave and a drag over/out.
			// While it may make sense to send a leave event when a touch
			// ends, it does not make sense to send a dragout.
			// We avoid this by processing out after up, but
			// this ordering is ad hoc.
			gesture.out(this.overEvent);
			// reset the event handlers back to the mouse-friendly ones after
			// a short timeout. We can't do this directly in this handler
			// because it messes up Android to handle the mouseup event.
			// FIXME: for 2.1 release, conditional on platform being
			// desktop Chrome, since we're seeing issues in PhoneGap with this
			// code.
			this._touchCount -= e.changedTouches.length;
		},

		/**
		* Use `mouseup()` after touches are done to reset {@glossary event} handling 
		* back to default; this works as long as no one did a `preventDefault()` on
		* the touch events.
		* 
		* @ignore
		* @private
		*/
		mouseup: function () {
			if (this._touchCount === 0) {
				this.sawMousedown = false;
				gesture.events = oldevents;
			}
		},

		/**
		* @ignore
		* @private
		*/
		makeEvent: function (e) {
			var event = utils.clone(e.changedTouches[0]);
			event.srcEvent = e;
			event.target = this.findTarget(event);
			// normalize "mouse button" info
			event.which = 1;
			//enyo.log("target for " + inEvent.type + " at " + e.pageX + ", " + e.pageY + " is " + (e.target ? e.target.id : "none"));
			return event;
		},

		/**
		* @ignore
		* @private
		*/
		calcNodeOffset: function (node) {
			if (node.getBoundingClientRect) {
				var o = node.getBoundingClientRect();
				return {
					left: o.left,
					top: o.top,
					width: o.width,
					height: o.height
				};
			}
		},

		/**
		* @ignore
		* @private
		*/
		findTarget: function (e) {
			return document.elementFromPoint(e.clientX, e.clientY);
		},

		/**
		* NOTE: Will find only 1 element under the touch and will fail if an element is 
		* positioned outside the bounding box of its parent.
		* 
		* @ignore
		* @private
		*/
		findTargetTraverse: function (node, x, y) {
			var n = node || document.body;
			var o = this.calcNodeOffset(n);
			if (o && n != this.excludedTarget) {
				var adjX = x - o.left;
				var adjY = y - o.top;
				//enyo.log("test: " + n.id + " (left: " + o.left + ", top: " + o.top + ", width: " + o.width + ", height: " + o.height + ")");
				if (adjX>0 && adjY>0 && adjX<=o.width && adjY<=o.height) {
					//enyo.log("IN: " + n.id + " -> [" + adjX + "," + adjY + " in " + o.width + "x" + o.height + "] (children: " + n.childNodes.length + ")");
					var target;
					for (var n$=n.childNodes, i=n$.length-1, c; (c=n$[i]); i--) {
						target = this.findTargetTraverse(c, x, y);
						if (target) {
							return target;
						}
					}
					return n;
				}
			}
		},

		/**
		* @ignore
		* @private
		*/
		connect: function () {
			utils.forEach(['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'gestureend'], function(e) {
				// on iOS7 document.ongesturechange is never called
				document.addEventListener(e, dispatch, false);
			});

			if (platform.androidChrome <= 18 || platform.silk === 2) {
				// HACK: on Chrome for Android v18 on devices with higher density displays,
				// document.elementFromPoint expects screen coordinates, not document ones
				// bug also appears on Kindle Fire HD
				this.findTarget = function(e) {
					return document.elementFromPoint(e.screenX, e.screenY);
				};
			} else if (!document.elementFromPoint) {
				this.findTarget = function(e) {
					return this.findTargetTraverse(null, e.clientX, e.clientY);
				};
			}
		}
	};
	
	touchGesture.connect();
});
