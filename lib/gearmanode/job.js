

Job = function (options) {
    this.statusCallbacks = [];
};


Job.prototype.submit = function () {
    var client = this.client,
        data = {
            name: this.name,
            data: this.data,
            encoding: this.encoding
        };

    // Set the type given the priority
    if (!(this.priority in priorities)) { throw Error("invalid priority"); }
    data.type = priorities[this.priority];

    // Append _BG to background jobs' type
    if (this.background) { data.type += "_BG"; }

    client.getConnection().write(packet.encode(data), this.encoding);
    debug("Sent:", data);
    client.lastJobSubmitted = this;
};