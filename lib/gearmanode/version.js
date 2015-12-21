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
    ['0.9.2', '2015-12-21', 'PR #41'],
    ['0.9.1', '2015-06-28', 'PR #35, Enh #24'],
    ['0.9.0', '2015-06-19', 'PR #29, fully implemented Gearman Protocol'],
    ['0.2.2', '2015-02-04', 'BF #26'],
    ['0.2.1', '2015-01-04', 'BF #25'],
    ['0.2.0', '2015-23-03', 'Added support for binary data, Enh #2'],
    ['0.1.8', '2014-24-08', 'Enh #16, BF #17'],
    ['0.1.7', '2014-14-07', 'BF #14'],
    ['0.1.6', '2014-17-06', 'BF #13'],
    ['0.1.5', '2014-20-03', 'added SET_CLIENT_ID; integration with Travis CI; BF #9'],
    ['0.1.4', '2014-28-02', 'added CAN_DO_TIMEOUT; BF #7'],
    ['0.1.3', '2014-20-02', 'BF #6'],
    ['0.1.2', '2013-27-11', 'added Worker#resetAbilities'],
    ['0.1.1', '2013-12-11', 'BF #4; added Job#reportWarning & Job#sendWorkData'],
    ['0.1.0', '2013-11-10', 'Initial version on Node.js v0.10.8 and gearmand v1.1.7']
];

exports.VERSION = exports.VERSION_HISTORY[0][0];
