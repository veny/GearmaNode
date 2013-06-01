

var Job = exports.Job = function (options) {
    this.payload = options.payload;
    this.name = options.name;

    this.encoding = 'utf-8';
    // priority
    // FG v BG

    this.statusCallbacks = [];
};


Job.prototype.getPacketType = function () {
    return 7; //XXX
};