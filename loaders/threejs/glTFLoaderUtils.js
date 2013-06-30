/**
 * @author Tony Parisi / http://www.tonyparisi.com/
 */

THREE.GLTFLoaderUtils = Object.create(Object, {

    // errors
    MISSING_DESCRIPTION: { value: "MISSING_DESCRIPTION" },
    INVALID_PATH: { value: "INVALID_PATH" },
    INVALID_TYPE: { value: "INVALID_TYPE" },
    XMLHTTPREQUEST_STATUS_ERROR: { value: "XMLHTTPREQUEST_STATUS_ERROR" },
    NOT_FOUND: { value: "NOT_FOUND" },
    // misc constants
    ARRAY_BUFFER: { value: "ArrayBuffer" },

    _streams : { value:{}, writable: true },
    
    _resources: { value: {}, writable: true },

    _resourcesStatus: { value: {}, writable: true },


    //manage entries
    _containsResource: {
        enumerable: false,
        value: function(resourceID) {
            return this._resources[resourceID] ? true : false;
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
                delegate.handleError(GLTFLoaderUtils.INVALID_TYPE, null);
                return;
            }

            if (!path) {
                delegate.handleError(GLTFLoaderUtils.INVALID_PATH);
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

                    delegate.resourceAvailable(self, request, xhr.response);

                } else {
                    delegate.handleError(GLTFLoaderUtils.XMLHTTPREQUEST_STATUS_ERROR, this.status);
                }
            };
            xhr.send(null);
            var resourceStatus = this._resourcesStatus[request.id];
            if (resourceStatus) {
                resourceStatus.xhr = xhr;
            }
        }
    },

    send: { value: 0, writable: true },
    requested: { value: 0, writable: true },

    _handleRequest: {
        value: function(request) {
            var resourceStatus = this._resourcesStatus[request.id];
            var node = null;
            var status = null;
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
                                    "ctx" : ctx }, null);
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
