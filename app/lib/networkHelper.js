/* global Alloy, Ti, a*/

function NetworkCall (apiKey) {
  var self = this;
  var deferred = Q.defer();
  var client;
  var endpoint;
  var endpointMethod;

  var defaultTimeout = 30000;
  var ExceptionService = Alloy.Globals.Services.getService("exception");
  var system = Alloy.Globals.Services.getService("system");

  self.setTransactionId = setTransactionId;
  self.transactionId = null;
  self.open = open;
  self.setTimeout = setTimeout;
  self.cancel = cancel;
  self.getPromise = getPromise;
  self.sendGET = sendGET;
  self.sendPUT = sendPUT;
  self.sendPOST = sendPOST;
  self.sendDELETE = sendDELETE;
  self.sendLogin = sendLogin;
  self.processData = processData;

  function open (method, url, params) {
    endpoint = url;
    endpointMethod = method;
    if (method == "GET" && params) {
      var parts = [] ;
      _.each(params, function (value, key) {
        parts.push(key + "=" + value);
      });
      url = url + "?" + parts.join("&");
    }
    Alloy.Globals.LogManager.debug("Network Call: Creating request with api-key: " + apiKey + " for url:" + url);
    client = Ti.Network.createHTTPClient({
      cache: false,
      onload: function (e) {
        try {
          if (!this.responseData) {
            deferred.reject(new Error("Network Call: Response is empty"));
          }
          var KB_TO_CHAR = 1000;
          var responseSize = (this.responseData.length > 0) ? Math.ceil(this.responseData.length / KB_TO_CHAR) : 0;
          Alloy.Globals.LogManager.info("🚀 Network Call: sent >> RESPONSE of size " + responseSize + " KB for call to " + this.location + " " + self.transactionId);
          try {
            var result = JSON.parse(this.responseText || "{}");
          } catch (e) {
            var error = ExceptionService.getNiceException(e);
            error.setCode("JSON_ERROR");
            error.setMessage("Network Call: Unable to parse server response: Invalid JSON.\n With message: " + error.message() + "\n data: ");
            deferred.reject(new Error(error.message()));
            error = null;
            return;
          }

          if (result.result === undefined) {
            Alloy.Globals.LogManager.transactionError(this.responseText, self.transactionId);
            deferred.reject(new Error(this.responseText));
          } else if (result.result.status == "error") {
            deferred.reject(ExceptionService.getNiceException({
              message: handleSystemError(result, this.location),
              code: result.result.code,
              data: result.data
            }));
          } else {
            deferred.resolve(result);
          }
        } catch (e) {
          var errorOnLoad = ExceptionService.getNiceException(e);
          errorOnLoad.setMessage("Network Call: onload error message: " + errorOnLoad.message());
          deferred.reject(errorOnLoad);
          errorOnLoad = null;
        }
        responseSize = null;
        result = null;
      },
      // Function called when an error occurs, including a timeout
      onerror: function (e) {
        if (this.status == 403 || this.status == 401) {
          /**
           * If user's api key is not valid any more, need to logout
           */
          logout();
        } else {
          var error = ExceptionService.getNiceException(e);
          var message;
          if (this.connected === false) {
            message = Alloy.Globals.printf(
              "Network Call >> Response: connection not found when calling %s %s status: %s message: %s",
              method,
              url,
              this.status,
              error.message()
            );
            Alloy.Globals.LogManager.transactionWarn(message, self.transactionId);
          } else {
            message = Alloy.Globals.printf(
              "Network Call >> Response: Error occurred when calling %s %s status: %s message: %s",
              method,
              url,
              this.status,
              error.message()
            );
            Alloy.Globals.LogManager.transactionError(message);
          }
        }
        deferred.reject(ExceptionService.getNiceException({ message: message, code: this.status, isConnected: this.connected}));
      },
      timeout: defaultTimeout
    });

    client.open(method, url);
    client.setRequestHeader("contentType", "application/json; charset=utf-8");
    client.setRequestHeader("Cache-Control", "no-cache");
    client.setRequestHeader("Cache-Control", "no-store");
    if (apiKey) {
      client.setRequestHeader("api-key", apiKey);
    }
  }

  function setTimeout (timeout) {
    client.timeout = (timeout);
  }

  function cancel (reason) {
    deferred.reject({
      error: Alloy.Globals.printf("Network Call: Request cancelled with reason %s", reason)
    });
  }

  function getPromise () {
    return deferred.promise;
  }

  function sendGET () {
    Alloy.Globals.LogManager.transactionTrace("Network Call: Sending GET request", self.transactionId);
    send();
  }

  function sendPUT (data) {
    Alloy.Globals.LogManager.transactionTrace("Network Call: Sending PUT request", self.transactionId);
    send(data, false);
  }

  function sendPOST (data, useRawData = false) {
    Alloy.Globals.LogManager.transactionTrace("Network Call: Sending POST request", self.transactionId);
    send(data, false, useRawData);
  }

  function sendDELETE (data) {
    Alloy.Globals.LogManager.transactionTrace("Network Call: Sending DELETE request", self.transactionId);
    send(data, false);
  }

  function sendLogin (data) {
    Alloy.Globals.LogManager.transactionTrace("Network Call: Sending Login request", self.transactionId);
    send(data, true);
  }

  /**
   * Send request to server
   * @param data
   * @param legacyOnly
   */
  function send (data, legacyOnly, useRawData = false) {
    try {
      var postData;
      var uuid = undefined;
      // There should be no data for a GET
      if (data) {
        if (data.uuid !== undefined) {
          uuid = data.uuid;
        }
        if (useRawData) {
          postData = JSON.stringify(data);
        } else {
          postData = processData(data, legacyOnly);
        }
      }
      Alloy.Globals.LogManager.trace(Alloy.Globals.printf((endpointMethod === "GET" ? "" : "🔼") + "🚀 Network Call: sent %s request to %s\n\n with data: %s\n\n", endpointMethod, endpoint, JSON.stringify(postData)), uuid);
      client.send(postData);
      Alloy.Globals.LogManager.transactionInfo(Alloy.Globals.printf((endpointMethod === "GET" ? "" : "🔼") + "🚀 Network Call: sent %s request to %s", endpointMethod, endpoint), self.transactionId, uuid);
      if (endpointMethod !== "GET") {
        if (!postData.password) {
          Alloy.Globals.LogManager.transactionInfo("📦 POST DATA = " + JSON.stringify(postData), self.transactionId, uuid);
        } else {
          Alloy.Globals.LogManager.transactionInfo("📦 POST DATA = ****", self.transactionId, uuid);
        }
      }
    } catch (e) {
      var error = ExceptionService.getNiceException(e);
      var message = "Request rejected" + error.message();
      Alloy.Globals.LogManager.transactionDebug(message, self.transactionId);
      deferred.reject(new Error(message));
      if (legacyOnly) {
        throw e;
      }
    }
    postData = null;
    uuid = null;
  }

  function processData (data, legacyOnly) {

    var postData = {};
    var media;
    // Filter out any objects
    for (var name in data) {
      if (name === "media") {
        media = data[name];
      } else if (!_.isObject(data[name])) {
        postData[name] = data[name];
      }
      /*
       * This is a hack to allow object through when needed
       * not that currently this will probably corrupt the request
       */
      if (name === "validObject") {
        _.each(data[name], function (val, key) {
          Alloy.Globals.LogManager.transactionTrace("Network Call: validObject with key " + key, self.transactionId);
          postData[key] = val;
        });
      }
    }
    if (data["ignoreStrigify"] === true) {
      return addPostMediaToPost(postData, media);
    }
    if (data.validObject !== undefined || (legacyOnly === false && system.minimumServerRequirementMet(Alloy.Globals.system.apiVersion.postAllDataAsNestedJson, "Can send all data as postSting"))) {
      // This is a hack to use the corruption of json data to send a valid request
      if (system.minimumServerRequirementMet(Alloy.Globals.system.apiVersion.androidDataAsPostNestedJson, "Can save nested data aon android")) {
        return addPostMediaToPost({ postString: JSON.stringify(postData) }, media);
      } else {
        return addPostMediaToPost({ post: postData }, media);
      }
    }

    return addPostMediaToPost(postData, media);
  }

  /**
   * We need to attach the media data for the attachments separately or it will not survive the stringification process
   * @param postData
   * @param media
   * @return {*}
   */
  function addPostMediaToPost (postData, media) {
    if (media !== undefined) {
      postData["media"] = media;
    }
    return postData;
  }

  function setTransactionId (transactionId) {
    self.transactionId = transactionId;
    client.setRequestHeader("transaction-id", transactionId);
  }

  function logout () {
    if (Alloy.Globals.UserSession.getUser()) {
      Alloy.Globals.dispatcher.trigger("app:logout", { message: "Session is no longer valid." });
    }
  }

  function handleSystemError (result, url) {
    var message;
    if (result.result && result.result.code == "4003") {
      logout();
      message = result.result.messages.join(",");
    } else {
      if (result.result) {
        message = Alloy.Globals.printf("Server error with code %s, message %s", result.result.code, result.result.messages.join(","));
      } else {
        message = Alloy.Globals.printf("Server error with code %s, message %s", result.status, result.responseText);
      }
    }
    return message;
  }
}

function NetworkClient (apiKey) {
  var self = this;

  self.init = init;
  self.getUrl = getUrl;
  self.open = open;
  self.login = login;
  self.isSsoEnabled = isSsoEnabled;

  function init (url) {
    self.url = url;
  }

  function getUrl (apiPath) {
    // Allow non-ssl if it is a .local domain
    var protocol = (self.url.indexOf(".local") !== -1) ? "http://" : "https://";
    return protocol + self.url + apiPath;
  }

  function open (method, apiPath, params) {
    try {
      var url = self.getUrl(apiPath);
      var logUrl = (params && params.api_key) ? url.replace(params.api_key, "xxx") : url;
      Alloy.Globals.LogManager.debug(Alloy.Globals.printf("Network Client: Calling %s %s", method, logUrl));
      var networkCall = new NetworkCall(apiKey);
      networkCall.open(method, url, params);
    } catch (e) {
      Alloy.Globals.LogManager.warn(Alloy.Globals.printf("Network Client: Issue calling  %s %s with message: %s", method, apiPath, e));
    }
    return networkCall;
  }

  function login (username, password) {
    var networkCall = self.open("POST", "/api/v2/login");
    // Send the request.
    networkCall.sendLogin({
      "username": username,
      "password": password,
      "uuid": Ti.Platform.id,
      "push_token": Ti.App.Properties.getString("push_token", "NOT_SET"),
      "type": Ti.Platform.osname
    });
    return networkCall.getPromise();
  }

  function isSsoEnabled (site) {
    var networkCall = self.open("GET", "/api/v3/sso/login/");
    // Send the request.
    networkCall.sendGET();
    return networkCall.getPromise();
  }
}

exports.getNetworkClient = function createNetworkClient (apiKey) {
  if (Ti.App.Properties.hasProperty("testmode") && Ti.App.Properties.getBool("testmode")) {
    var TestClient = require("testing/httpclient");
    Alloy.Globals.LogManager.trace("getNetworkClient: new TestClient");
    return new TestClient(apiKey);
  } else {
    return new NetworkClient(apiKey);
  }
};

exports.testProcessData = function testProcessData (data) {
  Alloy.Globals.LogManager.trace("getNetworkClient: new NetworkCall");
  return new NetworkCall("test-api-key").processData(data);
};

