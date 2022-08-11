(function (args, $, exports) {
    args = args[0] || {};

    function OnsiteManagerQRController (args) {
        let self = this;
        let elements = [];
        let selectedArea = null;
        let lastDetectedQRCodeTime = null;
        let categoryChoices = [];
        let msgDeclaration = null;
        const Barcode = require("ti.barcode");
        const onsiteService = Alloy.Globals.Services.getService("onsiteService");
        
        self.scanPeople = scanPeople;
        self.cancelOnsite = cancelOnsite;

        const TAP_MODE = {
            IN: 1,
            OUT: 0,
            FAILED: -1
        };
    
        init();

        function init () {            
            setupArea();
            setupBarCode();
            showInitialState();
            activateScanButton(false);

            Alloy.Globals.dispatcher.on("app:formElementUpdated", function (a) {
                selectedArea = $.form.getValues().onsiteAreas;
                
                activateScanButton(!!selectedArea);
            });
        }

        // SETUP BARCODE PROPERTIES
        function setupBarCode () {
            Barcode.allowRotation = true;
            Barcode.displayedMessage =
                "Bring the QR Code into view and hold steady.";
            Barcode.allowMenu = true;
            Barcode.allowInstructions = true;
            Barcode.useLED = false;
        
            Barcode.addEventListener("error", function (e) {
                alert("Error reading QR Code");
                Alloy.Globals.LogManager.info("ONSITE: Error reading QR Code");
            });
        
            Barcode.addEventListener("cancel", function (e) {
                Ti.API.info("Cancel received");
            });
        }

        // CREATE A WINDOW, WITH CAMERA ENABLED
        function scanQR () {
            if (!Alloy.Globals.online) {
                alert("Please connect to internet for onsite functionality");
                return;
            }
        
            var overlay = Ti.UI.createView({
                backgroundColor: "transparent",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            });
        
            cameraPermission(function (re) {
                reset();
                Barcode.capture({
                    animate: true,
                    overlay: overlay,
                    showCancel: true,
                    showRectangle: true,
                    keepOpen: false
                });
            });
        
            Barcode.addEventListener("success", _.once(startOnsiteRegistration));
        }

        function startOnsiteRegistration (e) {
            lastDetectedQRCodeTime = new Date().getTime();
            Alloy.Globals.LogManager.info("QR Scanned: " + e.result + " at " + lastDetectedQRCodeTime);

            let url = e.result;
            const isSameSite = url.indexOf(Alloy.Globals.UserSession.getValue("site")) !== -1;

            if (!isSameSite) {
                Barcode.cancel();
                setTimeout(() => {
                    alert("You cannot signin to this domain");
                }, 1000);
                return;
            }

            const userId = url.split("person-")[1];
            const areaId = selectedArea;

            if (!userId || !areaId) {
                Barcode.cancel();
                setTimeout(() => {
                    Alloy.Globals.toastMessage("Invalid URL code", {persistent: false, theme: "error"});
                }, 1000);
                return;
            }

            startLoading("Updating onsite...");

            setTimeout(() => {
                // Register QR Scan
                onsiteService
                    .registerQRScan(areaId, userId)
                    .then((res) => {
                        stopLoading();
                        showTappedState(res.message, res.mode);

                        let NumberOfSecToWait = res.message === "Tapped In" || res.message === "Tapped Out" ? 2000 : 5000;
                        setTimeout(() => {
                            showInitialState();
                        }, NumberOfSecToWait);
                    })
                    .catch((err) => {
                        Alloy.Globals.LogManager.error(err);
                        stopLoading();
                        Alloy.Globals.toastMessage(err, {persistent: false, theme: "error"});
                    });
            }, 1000);

            Barcode.cancel();
        }

        function showInitialState () {
            $.onsiteCard.hide();
            $.onsiteCard.height = 0;
            $.onsiteCard.top = 0;

            $.onsiteCardCountInfo.show();
            $.onsiteCardCountInfo.height = "190";
            $.onsiteCardCountInfo.top = "16";


            $.scanPeopleView.show();
            $.scanPeopleView.height = "148";
            $.scanPeopleView.top = "24";

            $.scanPeopleAreaView.show();
            $.scanPeopleAreaView.height = "300";
            $.scanPeopleAreaView.top = "24";

        }

        function showResultState () {
            $.onsiteCard.show();
            $.onsiteCard.height = "190";
            $.onsiteCard.top = 36;

            $.onsiteCardCountInfo.hide();
            $.onsiteCardCountInfo.height = 0;
            $.onsiteCardCountInfo.top = 0;

            $.scanPeopleView.hide();
            $.scanPeopleView.height = 0;
            $.scanPeopleView.top = 0;

            $.scanPeopleAreaView.hide();
            $.scanPeopleAreaView.height = 0;
            $.scanPeopleAreaView.top = 0;

            Alloy.Globals.dispatcher.trigger("app:formElementUpdated");
        }

        function hideResult () {
            $.onsiteCard.hide();
            $.onsiteCard.height = 0;
            $.onsiteCard.top = 0;

        }
        
        // CHECK & REQUEST FOR CAMERA PERMISSION IF REQUIRED
        function cameraPermission (callback) {
            if (OS_ANDROID) {
                if (Ti.Media.hasCameraPermissions()) {
                    if (callback) {
                        callback(true);
                    }
                } else {
                    Ti.Media.requestCameraPermissions(function (e) {
                        if (e.success) {
                            if (callback) {
                                callback(true);
                            }
                        } else {
                            if (callback) {
                                callback(false);
                            }
                            Alloy.Globals.LogManager.info("Photo Gallery: User denied camera permissions");
                            Ti.UI.createAlertDialog({
                                title: "Permission Required",
                                message: "This device has not be given permission to use the Camera. Please see the help documentation on how to configure permissions"
                            }).show();
                        }
                    });
                }
            }
        
            if (OS_IOS) {
                if (callback) {
                    callback(true);
                }
            }
        }
        
        // SETUP BARCODE PROPERTIES
        function setupBarCode () {
            Barcode.allowRotation = true;
            Barcode.displayedMessage =
                "Bring the QR Code into view and hold steady.";
            Barcode.allowMenu = true;
            Barcode.allowInstructions = true;
            Barcode.useLED = false;
        
            Barcode.addEventListener("error", function (e) {
                alert("Error reading QR Code");
                Alloy.Globals.LogManager.info("ONSITE: Error reading QR Code");
            });
        
            Barcode.addEventListener("cancel", function (e) {
                Ti.API.info("Cancel received");
            });
        }

        function activateScanButton (isActive = false) {
            $.onsiteScanNumber.text = "-";
            if (isActive) {
                $.scanPeopleView.backgroundColor = Alloy.Globals.colors.desaturatedOrange;

                onsiteService.getActiveOnsiteUsers(selectedArea).then((activeUserCount) => {
                    $.onsiteScanNumber.text = activeUserCount;
                }).catch(() => $.onsiteScanNumber.text = "?");


                let selectedAreaInfo = categoryChoices.find((cat) => cat.value.toString() === selectedArea.toString());
                $.onsiteScanInfo.text = selectedAreaInfo && selectedAreaInfo.msgDeclaration || "-" ;

            } else {
                $.scanPeopleView.backgroundColor = Alloy.Globals.colors.disabled;
            }
        }
        
        function setupArea () {
            onsiteService.getAreas().then((areas) => {
                _.each(areas.data, function (option) {
                    var choice = {
                        label: option.name,
                        value: option.id,
                        msgDeclaration: option.msg_declaration,
                        msgFailedEntry: option.msg_failed_entry
                    };
                    categoryChoices.push(choice);
                });
                
                elements.push({
                    type: "dropdown",
                    options: {
                        id: "onsiteAreas",
                        label: "Selected Area",
                        choices: categoryChoices
                    }
                });
    
                setTimeout(() => {
                    $.form.addElements(elements);
                }, 0);
            }).catch(() => {
                Alloy.Globals.toastMessage("unable to connect to server", {persistent: false, theme: "error"});
            });
        }

        function showTappedState (message, mode) {
            if (mode === TAP_MODE.IN) {
                $.onsiteCardLogoEnter.image = "/images/onsite_enter.png";
                $.tappedAllowed.color = "#007435";
            } else if (mode === TAP_MODE.OUT) {
                $.onsiteCardLogoEnter.image = "/images/onsite_exit.png";
                $.tappedAllowed.color = "#fd8609";
            } else {
                $.onsiteCardLogoEnter.image = "/images/onsite_noentry.png";
                $.tappedAllowed.color = "#FC1425";
            }

            $.tappedAllowed.text = message;
            $.onsiteCardInfo.text = Alloy.Globals.UserSession.getUser().username;

            $.tappedInResult.show();
            $.tappedInResult.height = 200;
            $.onsiteCardInfo.show();

            $.onsiteCardLogo.hide();
            $.onsiteCardLogo.height = 0;
            $.onsiteCardLogo.top = 0;
            $.onsiteCardLogo.bottom = 0;

            showResultState();
        }

        function cancelOnsite () {
            Alloy.Globals.currentPage = Alloy.Globals.controllerName.HOME;
            $.onsiteWindow.close();
        }

        function startLoading (message) {
            Alloy.Globals.loading.show(message || "Loading...");
        }

        function stopLoading () {
            Alloy.Globals.loading.hide();
        }

        function reset () {
            scannedBarcodes = {};
        }

        function scanPeople () {
            if (!!selectedArea) {
                scanQR();
            }
        }

    }

    _.extend(exports, new OnsiteManagerQRController(args));
})(arguments, $, exports);
