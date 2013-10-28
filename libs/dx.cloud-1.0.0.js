(function (undefined) {
    "use strict";

    var
        API_HOST = "dxcloudservices.cloudapp.net",
        API_PORT = 80,
        API_CLASSES_STORAGE = "/api/tables/",
        API_FILE_STORAGE = "/api/files/",
        PUSH_PATH = "/api/push/",
        AUTH_PATH = "/api/authentication/",

        APP_ID,
        APP_SECRET,
        APP_AUTHENTICATION,
        LOCALSTORAGE_CURRENTUSER_KEY = "DXCloudCurrentUser",
        PUSH_OS = {
            IOs: 0,
            Android: 1,
            ServiceBus: 2,
            WinPhone: 3,
            TestMessagingSystem: 4
        }



    var CONTENT_TYPE = "Content-Type",
        CONTENT_TRANSFER_ENCODING = "X-Content-Transfer-Encoding",
        CONTENT_LENGTH = "Content-Length",
        ACCEPT = "Accept",
        APP_ID_HEADER = "ApplicationId",
        APP_SECRET_HEADER = "ApiKey",
        APP_AUTHENTICATION_HEADER = "Authorization",
        REQUEST_ID_HEADER = "x-ms-request-id",
        HTTP_GET = "GET",
        HTTP_POST = "POST",
        HTTP_PUT = "PUT",
        HTTP_DELETE = "DELETE",
        URL_SCHEME = "http://"


    var IS_NODE = typeof exports !== 'undefined';
    var DXCloud,
        User,
        Entity,
        File,
        Push;


    function init(params) {
        APP_ID = params.applicationId;
        APP_SECRET = params.apiKey;
        APP_AUTHENTICATION = params.authorization;
        if (!IS_NODE && params.isLocalUse && params.isLocalUse === true) {
            API_HOST = location.hostname;
            URL_SCHEME = location.protocol + '//';
            API_PORT = location.port;
        }
    }

    function createHttpRequest(options) {
        var REQUEST_TIMEOUT = 100000;
        if (!options.headers)
            options.headers = {};
        function createBrowserRequest() {
            var request = new XMLHttpRequest(),
                url,
                timeout;

            if (!options.url) {
                url = URL_SCHEME + options.host + (options.port ? (":" + options.port) : "") + options.path;
            }
            else
                url = options.url;

            request.open(options.method, url, true);

            for (var key in options.headers) {
                if (options.headers.hasOwnProperty(key) && key !== CONTENT_LENGTH)
                    request.setRequestHeader(key, options.headers[key]);
            }

            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    clearTimeout(timeout);
                    invokeIfDefined((request.status < 400 && request.status !== 0) ? options.success : options.error,
                                    (request.status < 400 && request.status !== 0) ? {
                                        statusCode: request.status,
                                        responseHeaders: request.getAllResponseHeaders(),
                                        body: request.responseText
                                    } : {
                                        statusCode: request.status,
                                        responseHeaders: request.getAllResponseHeaders(),
                                        message: request.responseText
                                    });
                }
            };

            if (options.body && options.method !== HTTP_GET)
                request.send(options.body);
            else
                request.send(null);

            timeout = setTimeout(function () {
                request.abort();
                invokeIfDefined(options.error, {
                    message: "Request timed out"
                })
            }, REQUEST_TIMEOUT);
        }

        function createNodeRequest() {
            var http = require('http');
            var params = {};
            options.host && (params.host = options.host);
            options.port && (params.port = options.port);
            options.path && (params.path = options.path);
            options.method && (params.method = options.method);
            options.agent && (params.agent = options.agent);
            options.headers && (params.headers = options.headers);
            var bodyResponse = '';
            var req = http.request(params, function (res) {
                res.on('data', function (chunk) {
                    bodyResponse += chunk;
                });
                res.on('end',
                    function () {
                        invokeIfDefined((res.statusCode < 400 && res.statusCode !== 0) ? options.success : options.error,
                                        (res.statusCode < 400 && res.statusCode !== 0) ? {
                                            statusCode: res.statusCode,
                                            responseHeaders: res.headers,
                                            body: bodyResponse
                                        } : {
                                            statusCode: res.statusCode,
                                            responseHeaders: res.headers,
                                            message: bodyResponse
                                        });
                    }
                );
            });
            req.on('error', function (e) {
                invokeIfDefined(options.error, {
                    message: e
                })
            });

            if (options.body && options.method !== HTTP_GET)
                req.write(options.body);
            req.end();

        }

        return IS_NODE ? createNodeRequest() : createBrowserRequest();
    }
    function ping(params) {
        createApiRequest({
            path: "",
            success: function (result) {
                invokeIfDefined(params.success);
            },
            error: function (err) {
                invokeIfDefined(params.error, {
                    message: err.message,
                    statusCode: err.statusCode,
                    requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                });
            }
        })
    }
    function createUser() {
        var currentUser;

        function userObjectFromLocalStorage() {
            try {
                return JSON.parse(localStorage.getItem(LOCALSTORAGE_CURRENTUSER_KEY));
            } catch (x) {
                return null;
            }
        }
        function saveUserToLocalStore() {
            if (!IS_NODE)
                localStorage.setItem(LOCALSTORAGE_CURRENTUSER_KEY, JSON.stringify(currentUser));
        }

        function loginWithFacebook(params) {
            params.data = {
                ApplicationId: APP_ID,
                ApiKey: APP_SECRET,
                FacebookToken: params.accessToken
            };
            login(params);
        }
        function loginWithTwitter() {
            var params = {};
            if (arguments.length == 1)
                params = arguments[0];
            else {
                params.token = arguments[0];
                params.tokenSecret = arguments[1];
                params.success = arguments[2];
                params.error = arguments[3];
            }
            params.data = {
                ApplicationId: APP_ID,
                ApiKey: APP_SECRET,
                TwitterToken: params.token,
                TwitterTokenSecret: params.tokenSecret
            };
            login(params);
        }
        function login(params) {
            if (!IS_NODE) {
                currentUser = userObjectFromLocalStorage();
                if (currentUser) {
                    invokeIfDefined(params.success, currentUser);
                    return;
                }
            }
            function handleSuccess(result) {
                currentUser = JSON.parse(result.body)
                if (currentUser && currentUser.SessionToken)
                    APP_AUTHENTICATION = "DX " + currentUser.SessionToken;
                saveUserToLocalStore();
                invokeIfDefined(params.success, {
                    user: currentUser,
                    requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                });
            }

            function handleError(result) {
                invokeIfDefined(params.error, {
                    requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined,
                    message: result.message ? result.message : result.body,
                    statusCode: result.statusCode
                });
            }

            createApiRequest({
                body: JSON.stringify(params.data),
                path: AUTH_PATH + "Login",
                port: API_PORT,
                success: handleSuccess,
                error: handleError
            });
        }
        function logout() {
            currentUser = undefined;
            if (!IS_NODE)
                localStorage.removeItem(LOCALSTORAGE_CURRENTUSER_KEY);
        }
        function getCurrentUser() {
            return currentUser || userObjectFromLocalStorage();
        }
        function save(params) {
            if (!currentUser) {
                invokeIfDefined(params.error, { message: "No current user" });
                return;
            }
            var newUser = currentUser;
            for (var key in params.data)
                if (params.data.hasOwnProperty(key))
                    newUser[key] = params.data[key];

            Entity.save({
                tableName: "DXUser",
                entity: newUser,
                success: function (res) {
                    currentUser = res;
                    if (currentUser && currentUser.SessionToken)
                        APP_AUTHENTICATION = "DX " + currentUser.SessionToken;
                    saveUserToLocalStore();
                    invokeIfDefined(params.success, currentUser);
                },
                error: params.error
            });
        }
        return {
            getCurrentUser: getCurrentUser,
            loginWithFacebook: loginWithFacebook,
            loginWithTwitter: loginWithTwitter,
            logout: logout,
            save: save
        };
    }

    function createEntity() {
        function loadByKey(params) {
            createApiRequest({
                path: generateTablePath(params.tableName, params.RowKey, params.PartitionKey),
                headers: params.headers,
                port: API_PORT,
                success: function (result) {
                    var entity = JSON.parse(result.body);
                    invokeIfDefined(params.success,
                        entity,
                        { requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined }
                    )
                },
                error: function (err) {
                    invokeIfDefined(error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });
        };
        function load(params) {
            params.continuationPartitionKey && (headers.continuationPartitionKey = params.continuationPartitionKey);
            params.continuationRowKey && (headers.continuationRowKey = params.continuationRowKey);

            createApiRequest({
                path: generateTablePath(params.tableName, undefined, undefined, params.query),
                port: API_PORT,
                headers: params.headers,
                success: function (result) {
                    var entities = JSON.parse(result.body);
                    invokeIfDefined(params.success,
                        entities,
                        {
                            requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined,
                            continuationRowKey: result.responseHeaders.continuationrowkey,
                            continuationPartitionKey: result.responseHeaders.continuationpartitionkey
                        }
                    )
                },
                error: function (err) {
                    invokeIfDefined(params.error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });

        }
        function save(params) {
            var method = HTTP_POST;
            params.entity.RowKey && (method = HTTP_PUT);
            createApiRequest({
                path: generateTablePath(params.tableName, params.entity.RowKey, params.entity.PartitionKey),
                headers: params.headers,
                port: API_PORT,
                body: JSON.stringify(params.entity),
                method: method,
                success: function (result) {
                    var entity = result.statusCode === 204 ? params.entity : JSON.parse(result.body);
                    invokeIfDefined(params.success,
                        entity,
                        {
                            etag: undefined,
                            requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                        }
                    )
                },
                error: function (err) {
                    invokeIfDefined(params.error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });

                }
            })
        }
        function destroy(params) {
            createApiRequest({
                path: generateTablePath(params.tableName, params.entity.RowKey, params.entity.PartitionKey, params.query),
                headers: params.headers,
                port: API_PORT,
                method: HTTP_DELETE,
                success: function (result) {
                    invokeIfDefined(params.success, {
                        requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                },
                error: function (err) {
                    invokeIfDefined(params.error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });
        }
        return {
            loadByKey: loadByKey,
            load: load,
            save: save,
            destroy: destroy
        }
    }

    function createFile() {
        function getUrl(fileName) {
            return URL_SCHEME + API_HOST + API_FILE_STORAGE +
                fileName + "?" + APP_ID_HEADER + "=" + APP_ID + "&" + APP_SECRET_HEADER + "=" + APP_SECRET;
        };

        function addACLHeader(headers, acl) {
            if (!headers)
                headers = {};
            if (acl)
                headers["X-DX-ACL"] = JSON.stringify(acl);
            return headers;
        }

        function saveAsText(params) {
            var headers = addACLHeader(params.headers, params.ACL);
            params.contentType && (headers[CONTENT_TYPE] = params.contentType);
            params.contentTransferEncoding && (headers[CONTENT_TRANSFER_ENCODING] = params.contentTransferEncoding);
            createApiRequest({
                path: generateBlobPath(params.fileName),
                port: API_PORT,
                method: HTTP_PUT,
                body: params.body,
                headers: headers,
                success: function (result) {
                    invokeIfDefined(params.success, {
                        url: JSON.parse(result.body).Url,
                        requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                },
                error: function (err) {
                    invokeIfDefined(params.error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            })
        };

        function saveBASE64(params) {
            params.contentTransferEncoding = "base64";
            saveAsText(params);
        };
        function loadContent(params) {
            load(params, true);
        }
        function loadInfo(params) {
            var success = params.success;
            params.success = function (result) {
                invokeIfDefined(success, {
                    content: JSON.parse(result.content),
                    requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                });
            }
            load(params, false);
        }
        function load(params, isContent) {
            createApiRequest({
                path: generateBlobPath(params.fileName) + ((isContent) ? "" : "?metadata=true"),
                headers: params.headers,
                port: API_PORT,
                success: function (result) {
                    invokeIfDefined(params.success, {
                        content: result.body,
                        requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                },
                error: function (err) {
                    invokeIfDefined(params.error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            })
        }
        function destroy(params) {
            createApiRequest({
                path: generateBlobPath(params.fileName),
                port: API_PORT,
                method: HTTP_DELETE,
                success: function (result) {
                    invokeIfDefined(params.success, {
                        requestId: result.responseHeaders ? result.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                },
                error: function (err) {
                    invokeIfDefined(params.error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });
        }
        function loadFolderContent(params) {//folderName, success, error) {
            createApiRequest({
                path: generateBlobPath(folderName ? (folderName.slice(0, folderName.lastIndexOf("/") + "/")) : ""),
                port: API_PORT,
                method: HTTP_GET,
                success: function (result) {
                    invokeIfDefined(success,
                        JSON.parse(result.body));
                },
                error: function (err) {
                    invokeIfDefined(error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });

        }
        return {
            getUrl: getUrl,
            saveAsText: saveAsText,
            saveBASE64: saveBASE64,
            loadContent: loadContent,
            loadInfo: loadInfo,
            loadFolderContent: loadFolderContent,
            destroy: destroy
        };
    };

    function createPush() {
        function registerDevice(token, os, success, error) {
            createApiRequest({
                path: PUSH_PATH + "Register",
                port: API_PORT,
                body: JSON.stringify({ ApplicationId: APP_ID, ApiKey: APP_SECRET, Os: os, Token: token }),
                success: function (result) {
                    invokeIfDefined(success);
                },
                error: function (err) {
                    invokeIfDefined(error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });
        };
        function push(pushMessage, success, error) {
            pushMessage.ApplicationId = APP_ID;
            pushMessage.ApiKey = APP_SECRET;
            createApiRequest({
                path: PUSH_PATH + "Push",
                port: API_PORT,
                body: JSON.stringify(pushMessage),
                success: function (result) {
                    invokeIfDefined(success);
                },
                error: function (err) {
                    invokeIfDefined(error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });
        }
        function destroy(pushMessage, success, error) {
            pushMessage.ApplicationId = APP_ID;
            pushMessage.ApiKey = APP_SECRET;
            createApiRequest({
                path: PUSH_PATH + "Push",
                port: API_PORT,
                method: HTTP_DELETE,
                body: JSON.stringify(pushMessage),
                success: function (result) {
                    invokeIfDefined(success);
                },
                error: function (err) {
                    invokeIfDefined(error, {
                        message: err.message,
                        statusCode: err.statusCode,
                        requestId: err.responseHeaders ? err.responseHeaders[REQUEST_ID_HEADER] : undefined
                    });
                }
            });
        }
        return {
            registerDevice: registerDevice,
            push: push,
            destroy: destroy,
            OS: PUSH_OS
        }
    };

    function invokeIfDefined(func) {
        if (Object.prototype.toString.call(func) === "[object Function]")
            return func.apply(this, Array.prototype.slice.call(arguments, 1));
    }
    function generateTablePath(className, rowKey, partitionKey, query) {
        var path = API_CLASSES_STORAGE;
        if (className) path += className;
        if (rowKey != undefined)
            path += '(' + "RowKey='" + rowKey + "'," + "PartitionKey='" + (partitionKey ? partitionKey : "") + "')";
        query && (path += "?" + query);
        return path;
    }
    function generateBlobPath(fileName) {
        return (API_FILE_STORAGE + fileName);
    }
    function createApiRequest(params) {
        if (!params.headers)
            params.headers = {};
        if (!params.host) params.host = API_HOST;
        if (!params.port) params.port = API_PORT;
        params.headers[APP_ID_HEADER] = APP_ID;
        params.headers[APP_SECRET_HEADER] = APP_SECRET;
        if (APP_AUTHENTICATION)
            params.headers[APP_AUTHENTICATION_HEADER] = APP_AUTHENTICATION;
        params.headers[ACCEPT] = 'application/json';

        params.headers['Expires'] = 'Mon, 26 Jul 1997 00:00:00 GMT';
        params.headers['Cache-Control'] = 'no-cache, must-revalidate';
        params.headers['Pragma'] = 'no-cache';
        if (params.body) {
            if (!params.headers[CONTENT_TYPE])
                params.headers[CONTENT_TYPE] = 'application/json';

            params.headers[CONTENT_LENGTH] = params.body.length;
        }

        if (!params.method)
            params.method = params.body ? HTTP_POST : HTTP_GET;
        createHttpRequest(params);
    }

    User = createUser();
    Entity = createEntity();
    File = createFile();
    Push = createPush();
    DXCloud = {
        init: init,
        ping: ping,
        httpRequest: createHttpRequest,
        User: User,
        Entity: Entity,
        File: File,
        Push: Push,
        AccessPermission: {
            None: "None",
            ReadOnly: "ReadOnly",
            ReadWrite: "ReadWrite",
            Owner: "Owner"
        }
    }

    if (!IS_NODE) {
        this.DXCloud = DXCloud;
    }
    else {
        for (var key in DXCloud) {
            if (DXCloud.hasOwnProperty(key))
                exports[key] = DXCloud[key];
        }
    }
}.call(this))





