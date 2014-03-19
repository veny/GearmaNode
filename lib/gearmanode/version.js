// Copyright 2013 The GearmaNode Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
 * @fileoverview This script represents changelog and history of version evolution.
 * @author vaclav.sykora@google.com (Vaclav Sykora)
 */


exports.VERSION_HISTORY = [
    ['0.1.5', '2014-19-03', 'added SET_CLIENT_ID, integration with Travis CI'],
    ['0.1.4', '2014-28-02', 'added CAN_DO_TIMEOUT, BF #7'],
    ['0.1.3', '2014-20-02', 'BF #6'],
    ['0.1.2', '2013-27-11', 'added Worker#resetAbilities'],
    ['0.1.1', '2013-12-11', 'BF #4; added Job#reportWarning & Job#sendWorkData'],
    ['0.1.0', '2013-11-10', 'Initial version on Node.js v0.10.8 and gearmand v1.1.7']
];

exports.VERSION = exports.VERSION_HISTORY[0][0];
