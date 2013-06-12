            ____                                 _   _           _
           / ___| ___  __ _ _ __ _ __ ___   __ _| \ | | ___   __| | ___
          | |  _ / _ \/ _` | '__| '_ ` _ \ / _` |  \| |/ _ \ / _` |/ _ \
          | |_| |  __/ (_| | |  | | | | | | (_| | |\  | (_) | (_| |  __/
           \____|\___|\__,_|_|  |_| |_| |_|\__,_|_| \_|\___/ \__,_|\___|


Node.js library for the Gearman distributed job system.


## Features
* support for multiple job servers
* UTF-8
* rock solid tests

## Client events
* **done** - when there's no submited job waiting for state CREATED
* **error** - when an error occured, typically a socket connection or transfer problem

## Job events
* **created** - when response to one of the SUBMIT_JOB* packets arrived
* **complete** - when the job completed successfully
* **abort** - when a job forcible termined by a client ending