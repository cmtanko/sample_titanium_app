(function (args, $, exports) {
    args = args[0] || {};

    function ScannedUserListController (args) {
        try {
            let self = this;
            self.cleanUp = cleanUp;
            self.listClick = listClick;
            self.applyFilter = applyFilter;
            self.closeWindow = closeWindow;
            self.manualRefresh = manualRefresh;
            self.applyTransform = applyTransform;

            const service = Alloy.Globals.Services.getService("scanneduser");
            const onsiteService = Alloy.Globals.Services.getService("onsiteService");
            const nav = Alloy.Globals.Services.getService("navigation");
            
            const areaId = args.areaId || "4";
            const onClose = args.onClose;
            
            let userCollection = [];
            let appRefreshInterval = null;
            init();
    
            function init () {
                Alloy.Globals.currentPage = "SCANNED_USER_LIST";
                
                Alloy.Globals.LogManager.debug("Scanned User List: Init Scanned User List");
                
                Alloy.Globals.toastMessage("Fetching users...", {
                    persistent: false,
                    theme: "success"
                });

                setTimeout(() => {
                    refreshScannedUsers();
                }, 0);
                

                appRefreshInterval = setInterval(() => {
                    refreshScannedUsers();
                }, 60000 * 5);
            }
    
            function refreshScannedUsers () {
                startClickLoading("Loading...");
                service.populate(areaId);
                userCollection = service.getCollection();
                setTimeout(() => {
                    stopLoading();
                }, 2000);
            }
    
            function manualRefresh (e) {
                e.hide && e.hide();
                startClickLoading("Loading...");
                setTimeout(() => {
                    refreshScannedUsers();
                    stopLoading();
                }, 1000);
            }
    
            function applyTransform (model) {
                var item = model.toJSON();
                item.detail = item.company;

                let searchTerms = [];
    
                try {
                    if (typeof item.search_terms === "string") {
                        searchTerms = JSON.parse(item.search_terms);
                    } else if (
                        item.search_terms !== undefined &&
                        item.search_terms !== null &&
                        item.search_terms.length !== undefined
                    ) {
                        searchTerms = item.search_terms;
                    }
                } catch (e) {
                    Alloy.Globals.LogManager.warn("Scanned User List: unable to get search terms for item: " +
                        item.uuid +
                        "search terms: " +
                        JSON.stringify(searchTerms));
                    searchTerms = [];
                }
    
                
                // Ensure that the id and form name are in the search params
                searchTerms.push(item.id);
                searchTerms.push(item.name);
                searchTerms.push(item.company);
                searchTerms.push(item.phone);
                item.search_terms = JSON.stringify(searchTerms);
                if (OS_IOS) {
                    item.canEditItem = false;
                }
                return item;
            }
    
            function applyFilter (collection) {
                return collection.filter((item) => true);
            }
    
            function listClick (e) {
                if (e.bindId === "exitButton") {
                    const userId = e.itemId;
                    if (!userId || !areaId) {
                        Alloy.Globals.toastMessage("Area or User not found");
                        Alloy.Globals.LogManager.error("Scanned User List: Unable to get user id from list item");
                        return;
                    }
                    
                    showTapOutConfirmation(userId, areaId);
                    return;
                } else if (e.bindId === "attachmentView") {
                    const userId = e.itemId;
                    openShowCompetencyWindow(userId, areaId);
                    return;
                } else {
                    const userId = e.itemId;
                    openShowCompetencyWindow(userId, areaId);
                    return;
                }
            }
    
    
            function showTapOutConfirmation (userId, areaId) {
                // get user firstname and lastname from userCollection based on userId
                let user = userCollection.find((user) => user.get("id") === userId);
                if (userId !== undefined) {
                    var dialog = Ti.UI.createAlertDialog({
                        cancel: 1,
                        buttonNames: [
                            "Yes, Sign Out",
                            "Cancel"
                        ],
                        message: `Are you sure you want to tap out ${user.get("name")}?`,
                        title: "Confirm Tap Out"
                    });
                    dialog.addEventListener("click", function (e) {
                        if (e.index === 0) {
                            tapUserOut(areaId, userId);
                        }
                    });
                    dialog.show();
                }
            }
    
            function tapUserOut (areaId, userId) {
                startClickLoading("Signing user out... ");
                let newAccessPoint = userCollection.find((user) => user.get("id") === userId).get("accessPoint");
                onsiteService
                    .tapUserOut(newAccessPoint, userId, true)
                    .then(() => {
                        Alloy.Globals.toastMessage("User has been tapped out");
                        refreshScannedUsers(true);
                        stopLoading();
                    })
                    .catch((err) => {
                        stopLoading();
                        Alloy.Globals.toastMessage("Unable to tap user out, please try again");
                        Alloy.Globals.LogManager.error(err);
                    });
            }
    
            function startClickLoading (message) {
                Alloy.Globals.loading.show(message || "Loading", true);
            }
    
            function stopLoading () {
                Alloy.Globals.loading.hide();
            }
    
            function cleanUp () {
                Alloy.Globals.dispatcher.off("app:ActionUpdated", refreshScannedUsers);
                $.destroy();
                $.off();
                self = null;
                closeWindow();
            }
    
            function closeWindow () {
                clearInterval(appRefreshInterval);
                Alloy.Globals.currentPage = Alloy.Globals.controllerName.HOME;
                $.userListWindow.close();
                onClose();
                // Alloy.Globals.dispatcher.trigger("app:recountTappedInUser");
            }
    
            // ON `Tap to View` BUTTON CLICK
            function showCompetencyList () {
                openWindowClickDebounce();
            }
            
            var openWindowClickDebounce = nav.debounce(openShowCompetencyWindow);
            
            function openShowCompetencyWindow (selectedUserId, selectedArea = "1") {
                if (!!selectedArea) {
                    Alloy.Globals.currentPage = "SCANNED_USER_LIST";
                    /*
                     * Alloy.createController("competencylist").getView().open();
                     * Alloy.createController("login").getView().open();
                     */

                    nav.openWindow("competencylist", {
                        tabIndex: 3,
                        areaId: selectedArea,
                        userId: selectedUserId,
                        userName: (userCollection.find((user) => user.get("id") === selectedUserId)).get("name"),
                        source: "scannedUserList",
                        onClose: () => {}
                    });
                }
            }
        } catch (error) {
            Alloy.Globals.LogManager.error(error);
        }
    }

    _.extend(exports, new ScannedUserListController(args));
})(arguments, $, exports);

function manualRefresh (e) {
    Alloy.Globals.LogManager.debug("Scanned User List: Manual refresh");
    exports.manualRefresh(e);
    Alloy.Globals.LogManager.debug("Scanned User List: Manual Refresh: done");
}
