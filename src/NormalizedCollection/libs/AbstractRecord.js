'use strict';

var util = require('../../common/');

/**
 * A Record represents a set of merged data. The hierarchy of a normalized Collection
 * can be traversed as normal using parent() and child() calls:
 *    - RecordSet: The root of a normalized collection; a set of merged Firebase paths
 *    - Record: A child of RecordSet obtained by calling .child(recordId)
 *    - RecordField: A child of Record or RecordField which represents a wrapped Firebase path (no longer normalized)
 *
 * We wrap all of these levels, including the RecordField's, so that the
 * parent() and child() calls work as expected and return the normalized chain instead
 * of reverting to the underlying Firebase instances.
 *
 * AbstractRecord provides common functionality around observables, event handling, and field maps
 * used by all three implementations.
 *
 * @param fieldMap the field map applied to Record objects
 * @constructor
 */
function AbstractRecord(fieldMap) {
  var self = this;
  self.map = fieldMap;
  self.obs = new util.Observable(
    ['value', 'child_added', 'child_removed', 'child_moved', 'child_changed'],
    {
      onAdd: function(event) {
        var count = self.obs.getObservers(event).length;
        if( count === 1 ) {
          self._start(event, self.obs.getObservers().length);
        }
      },
      onRemove: function(event) {
        var count = self.obs.getObservers(event).length;
        if( count === 0 ) {
          self._stop(event, self.obs.getObservers().length);
        }
      }
    }
  );
  self.eventHandlers = {
    'value': util.bind(self._trigger, self, 'value'),
    'child_added': util.bind(self._trigger, self, 'child_added'),
    'child_changed': util.bind(self._trigger, self, 'child_changed'),
    'child_removed': util.bind(self._trigger, self, 'child_removed'),
    'child_moved': util.bind(self._trigger, self, 'child_moved')
  };
}

AbstractRecord.prototype = {
  /**
   * Called internally by AbstractRecord whenever the first listener
   * is attached for a given event. Also includes a count of the
   * total number of listeners
   *
   * @param {string} type
   * @param {int} totalListeners
   * @abstract
   */
  _start: abstract('_start'),

  /**
   * Called internally by AbstractRecord whenever
   * the last listener is detached for a given type. Also provides
   * the total listener count
   *
   * @param {string} type
   * @param {int} totalListeners
   * @abstract
   */
  _stop:  abstract('_stop'),

  /**
   * Should return true if the snapshots provided contain the child key and if it
   * exists in the fields for this record type.
   *
   * @param {Array} snapshots
   * @param {string} key
   * @abstract
   */
  hasChild: abstract('hasChild'),

  /**
   * Given a list of snapshots to iterate, returns the valid keys
   * which exist in both the snapshots and the field map, in the
   * order they should be iterated.
   *
   * Calls iterator with a {string|number} key for the next field to
   * iterate only.
   *
   * If iterator returns true, this method should abort and return true,
   * otherwise it should return false (same as Snapshot.forEach).
   *
   * @param {Array} snaps
   * @param {function} iterator
   * @param {object} [context]
   * @return {boolean} true if aborted
   * @abstract
   */
  forEachKey: abstract('forEach'),

  /**
   * When .child() is called on a Snapshot, this will reconcile
   * the correct refs and data for each child and return an array
   * containing the child snapshots for the specified key. For
   * a RecordSet, this should return children for all the fields
   * in the field map. For a Record, this should return a child
   * from the correct snapshot, or the first if the child is not
   * in the map.
   *
   * @param {Array} snaps
   * @param {string} key
   * @abstract
   */
  getChildSnaps: abstract('getChildSnaps'),

  /**
   * This should take all the data from a set of snapshots and
   * merge it together appropriately. For a RecordSet, this should
   * return records ordered by the first reference. For a Record,
   * this should return the fields in the field map.
   *
   * @param {Array} snaps
   * @param {boolean} isExport
   * @abstract
   */
  mergeData: abstract('mergeData'),

  /**
   * Returns the specific implementing class for this instance.
   *
   * @returns {Function}
   */
  getClass: abstract('getClass'),

  /**
   * @param {string} event
   * @param {function} callback
   * @param {function} [cancel]
   * @param {object} [context]
   */
  watch: function(event, callback, cancel, context) {
    this.obs.observe(event, callback, cancel, context);
  },

  /**
   * @param {string} event
   * @param {function} [callback]
   * @param {object} [context]
   */
  unwatch: function(event, callback, context) {
    this.obs.stopObserving(event, callback, context);
  },

  getFieldMap: function() {
    return this.map;
  },

  getPathManager: function() {
    return this.map.getPathManager();
  },

  _trigger: function() {
    this.obs.triggerEvent.apply(this.obs, arguments);
  },

  /**
   * @param {string} event
   * @returns {function}
   */
  _handler: function(event) {
    return this.eventHandlers[event];
  },

  /**
   * @param {object} error
   */
  _cancel: function(error) {
    util.error(error);
    this.obs.abortObservers(error);
  }
};

function abstract(method) {
  return function() {
    throw new Error('Classes implementing AbstractRecord must declare ' + method);
  };
}

module.exports = AbstractRecord;