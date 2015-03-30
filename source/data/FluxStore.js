(function (enyo, scope) {

	var kind = enyo.kind,
		EventEmitter = enyo.EventEmitter,
		StateSupport = enyo.StateSupport;

	function update(node, src) {
		var key, val;

		if (!(node && src)) return;

		// avoid iterating over null/undefined
		for (key in src) {
			// avoid looking this value up over and over
			val = src[key];
			// don't clear current values if one wasn't returned
			if (val != null) {
				// if there isn't a value already we short-circuit the object test for efficiency
				if (!node[key] || !enyo.isObject(val)) node[key] = val;
				else update(node[key], val);
			}
		}

		return node;
	}

	/**
	*
    *
	* @class enyo.FluxStore
	* @mixes enyo.EventEmitter
	* @extends enyo.Object
	* @public
	*/
	kind(
		/** @lends enyo.FluxStore.prototype */ {
		name: 'enyo.FluxStore',

		/**
		* @private
		*/
		kind: enyo.Object,


		/**
		* @private
		*/
		data: {},


		/**
		* @name enyo.FluxStore.id
		*
		* How a store is identitified to the Flux Dispatcher
		* This ID is used for subscribing to a store's
		* state notification change
		*
		* @public
		* @type {Number}
		*
		*/
		id: -1,

		mixins: [EventEmitter],

		/**
		* @name enyo.FluxStore.source
		*
		* The source that this FluxStore should use to fetch new
		* data sets.
		*
		* @public
		* @type {String}
		*
		*/
		source: '',

		published: {

			/**
			* @name enyo.FluxStore.MergeRoot
			*
			* When a source sends data to the store,
			* should the data root have the new data
			* merged, otherwise it will replace.
			*
			* @public
			* @type {Boolean}
			* @default true
			*
			*/
			MergeRoot: true
		},

		/**
		* @private
		*/
		add: function (data, opts) {
			if(this.MergeRoot) {
				update(this.data, data);
				return;
			}
			this.data = data;
		},

		/**
		* @public
		*/
		reset: function () {
			this.data = {};
		},

		/**
		* @private
		*/
		constructor: enyo.inherit(function(sup){
			return function(){
				sup.apply(this, arguments);
				if(enyo.FluxDispatcher) {
					//subscribe the store to the dispatcher
					this.id = enyo.FluxDispatcher.subscribe();
				}
			}
		}),

		/**
		* @name enyo.FluxStore.fetch
		*
		* Fetches the data from a [Source]{@link enyo.Source}
		*
		* @param {enyo.FluxStore~ActionOptions} [opts] - Optional configuration options.
		* @public
		*/
		fetch: function(opts) {

			var opts = opts || {};

			opts.success = opts.success || this.success.bind(this);
			opts.error = opts.error || this.error.bind(this);

			enyo.Source.execute('fetch', this, opts);
		},

		/**
		* @name enyo.FluxStore.success
		*
		* Success callback is called when the [Source]{@link enyo.Source} is successful
		*
		* @param {enyo.Source} [source] - The source that iniated the fetch.
		* @param {enyo.Source~Results} [res] - The result of the fetch.
		* @private
		*/
		success: function(source, res) {

			//when the result comes back from
			//the fetch add it to the store
			this.add(res);

			//tell the dispatcher to notify all subscribers
			//that the payload has been updated for this store
			enyo.FluxDispatcher.notify(this.id, this.data);
		},

		/**
		* @name enyo.FluxStore.error
		*
		* Error callback is called when the [Source]{@link enyo.Source} has failed
		*
		* @param {enyo.Source~Results} [res] - The result of the fetch.
		* @private
		*/
		error: function(res) {
			//error occured during fetch
			//todo: warn user
		}
	});

})(enyo, this);
