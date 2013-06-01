

var Job = exports.Job = function (options) {
    this.payload = options.payload;
    this.name = options.name;

    this.statusCallbacks = [];
};
