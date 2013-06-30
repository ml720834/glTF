// Copyright (c) 2012, Motorola Mobility, Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//  * Neither the name of the Motorola Mobility, Inc. nor the names of its
//    contributors may be used to endorse or promote products derived from this
//    software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
// THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

var global = window;
(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory(global);
        module.exports.BinaryLoader = module.exports;
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], function () {
            return factory(root);
        });
    } else {
        // Browser globals
        factory(root);
    }
}(this, function (root) {
    "use strict";

    var WebGLTFBinaryLoader = Object.create(Object, {

        // errors
        MISSING_DESCRIPTION: { value: "MISSING_DESCRIPTION" },
        INVALID_PATH: { value: "INVALID_PATH" },
        INVALID_TYPE: { value: "INVALID_TYPE" },
        XMLHTTPREQUEST_STATUS_ERROR: { value: "XMLHTTPREQUEST_STATUS_ERROR" },
        NOT_FOUND: { value: "NOT_FOUND" },
        // misc constants
        ARRAY_BUFFER: { value: "ArrayBuffer" },

        _resources: { value: null, writable: true },

        _resourcesStatus: { value: null, writable: true },

        _resourcesBeingProcessedCount: { value: 0, writable: true },

        _bytesLimit: { value: 500000, writable: true },
        
        bytesLimit: {
            get: function() {
                return this._bytesLimit;
            },
            set: function(value) {
                if (this._bytesLimit !== value) {
                    this._bytesLimit = value;
                }
            }
        },

        //manage entries
        _containsResource: {
            enumerable: false,
            value: function(resourceID) {
                return this._resources[resourceID] ? true : false;
            }
        },

        init: {
            value: function() {
                this._resources = {};
                this._resourcesStatus = {};
                this._resourcesBeingProcessedCount = 0;
            }
        },

        _storeResource: {
            enumerable: false,
            value: function(resourceID, resource) {
                if (!resourceID) {
                    console.log("ERROR: entry does not contain id, cannot store");
                    return;
                }

                if (this._containsResource[resourceID]) {
                    console.log("WARNING: resource:"+resourceID+" is already stored, overriding");
                }

               this._resources[resourceID] = resource;
            }
        },

        _getResource: {
            enumerable: false,
            value: function(resourceID) {
                return this._resources[resourceID];
            }
        },

        _loadResource: {
            value: function(request, delegate) {
                var self = this;
                var path = request.path;
                var type = request.type;
                var path = request.path;

                if (!type) {
                    delegate.handleError(WebGLTFBinaryLoader.INVALID_TYPE, null);
                    return;
                }

                if (!path) {
                    delegate.handleError(WebGLTFBinaryLoader.INVALID_PATH);
                    return;
                }

                var xhr = new XMLHttpRequest();
                xhr.open('GET', path, true);
                xhr.responseType = (type === this.ARRAY_BUFFER) ? "arraybuffer" : "text";
                if (request.range) {
                    var header = "bytes=" + request.range[0] + "-" + (request.range[1] - 1);
                    xhr.setRequestHeader("Range", header);
                }
                //if this is not specified, 1 "big blob" scenes fails to load.
                xhr.setRequestHeader("If-Modified-Since", "Sat, 01 Jan 1970 00:00:00 GMT");
                xhr.onload = function(e) {
                    if ((this.status == 200) || (this.status == 206)) {
                        self._resourcesBeingProcessedCount--;

                        delegate.resourceAvailable(self, request, this.response);

                    } else {
                        delegate.handleError(WebGLTFBinaryLoader.XMLHTTPREQUEST_STATUS_ERROR, this.status);
                    }
                };
                xhr.send(null);
                var resourceStatus = this._resourcesStatus[request.id];
                if (resourceStatus) {
                    resourceStatus.xhr = xhr;
                }
            }
        },

        _processNextResource: {
            value: function(requestTree) {
                if (requestTree) {
                    var rootIsLeaf = !requestTree.left && !requestTree.right;
                    if (rootIsLeaf) {
                        this._handleRequest(requestTree.content);
                        return false;
                    } else {
                        var min = requestTree.removeMin();
                        this._handleRequest(min.content);
                    }
                }
                return true;
            }
        },

        send: { value: 0, writable: true },
        requested: { value: 0, writable: true },

        _handleRequest: {
            value: function(request) {
                var resourceStatus = this._resourcesStatus[request.id];
                var node = null;
                var status = null;
                var requestTree = this.requestTrees ? this.requestTrees[request.path] : null;
                if (resourceStatus) {
                    if (resourceStatus.status === "loading" )
                        return;
                    node = resourceStatus.node;
                    status = resourceStatus.status;
                }

                var self = this;
                var processResourceDelegate = {};

                this._resourcesStatus[request.id] =  { "status": "loading"};

                processResourceDelegate.resourceAvailable = function(resourceManager, req_, res_) {
                    // ask the delegate to convert the resource, typically here, the delegate is the renderer and will produce a webGL array buffer
                    // this could get more general and flexible by making an unique key with the id from the resource + the converted type (day "ARRAY_BUFFER" or "TEXTURE"..)
                    //, but as of now, this fexibility does not seem necessary.
                    var convertedResource = req_.delegate.convert(res_, req_.ctx);
                    self._storeResource(req_.id, convertedResource);
                    req_.delegate.resourceAvailable(convertedResource, req_.ctx);

                    delete self._resourcesStatus[req_.id];
                };

                processResourceDelegate.handleError = function(errorCode, info) {
                    request.delegate.handleError(errorCode, info);
                }

                self._resourcesBeingProcessedCount++;
                this._loadResource(request, processResourceDelegate);
            }
        },


        _elementSizeForGLType: {
            value: function(glType) {
                switch (glType) {
                    case "FLOAT" :
                        return Float32Array.BYTES_PER_ELEMENT;
                    case "UNSIGNED_BYTE" :
                        return Uint8Array.BYTES_PER_ELEMENT;
                    case "UNSIGNED_SHORT" :
                        return Uint16Array.BYTES_PER_ELEMENT;
                    case "FLOAT_VEC2" :
                        return Float32Array.BYTES_PER_ELEMENT * 2;
                    case "FLOAT_VEC3" :
                        return Float32Array.BYTES_PER_ELEMENT * 3;
                    case "FLOAT_VEC4" :
                        return Float32Array.BYTES_PER_ELEMENT * 4;
                    default:
                        return null;
                }
            }
        },

        _handleWrappedBufferViewResourceLoading: {
            value: function(wrappedBufferView, delegate, ctx) {
                var bufferView = wrappedBufferView.bufferView;
                var buffer = bufferView.buffer;
                var byteOffset = wrappedBufferView.byteOffset + bufferView.description.byteOffset;
                var range = [byteOffset , (this._elementSizeForGLType(wrappedBufferView.type) * wrappedBufferView.count) + byteOffset];

                this._handleRequest({   "id" : wrappedBufferView.id,
                                        "range" : range,
                                        "type" : buffer.description.type,
                                        "path" : buffer.description.path,
                                        "delegate" : delegate,
                                        "ctx" : ctx,
                                        "kind" : "single-part" }, null);
            }
        },
        
        getBuffer: {
        	
	            value: function(wrappedBufferView, delegate, ctx) {
	
	            var savedBuffer = this._getResource(wrappedBufferView.id);
	            if (savedBuffer) {
	                return savedBuffer;
	            } else {
	                this._handleWrappedBufferViewResourceLoading(wrappedBufferView, delegate, ctx);
	            }
	
	            return null;
	        }
        },

        removeAllResources: {
            value: function() {
                this._resources = {};
            }
        },

    });

    if(root) {
        root.WebGLTFBinaryLoader = WebGLTFBinaryLoader;
    }

    return root.WebGLTFBinaryLoader;

}));
